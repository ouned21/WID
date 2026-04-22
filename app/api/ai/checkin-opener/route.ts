import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  buildOpenerCandidates,
  pickOpenerWithRotation,
  isMemoryEmpty,
  buildContextBlock,
  type OpenerContext,
  type OpenerSource,
} from '@/utils/checkinOpener';
import { isInEveningWindow } from '@/utils/checkinWindow';

/**
 * POST /api/ai/checkin-opener — Sprint 15bis
 *
 * Génère UNE question d'ouverture tailored quand l'user ouvre /journal dans la
 * fenêtre check-in du soir (20h-04h Paris). Appelé uniquement côté client
 * quand la CTA est active (`isInEveningWindow` && `!hasCheckinForCurrentWindow`).
 *
 * Body (optionnel) : {} — le serveur lit household_id depuis le profil.
 * Response :
 *   - { question, source, source_detail, is_static }  (200)
 *   - { error } sinon
 *
 * Règles :
 *   - Sonnet 4.6 (raisonnement + empathie) — pas Haiku
 *   - Max 25 mots, une seule question, ton confident
 *   - Court-circuit statique si mémoire vide (aucun fait/narrative/obs/turns)
 *   - Rotation anti-harcèlement : si même source_detail que l'opener précédent
 *     (< 30h), on descend d'un cran
 *   - Log dans checkin_openers_log pour audit + rotation
 */

export const maxDuration = 15;

const MODEL = 'claude-sonnet-4-6';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// Accueil statique dédié "mémoire vide" — évite un fallback Sonnet générique
// qui sonnerait faux au premier contact.
const EMPTY_MEMORY_OPENER =
  "On apprend à se connaître — raconte-moi ta soirée, je retiens tout pour la suite.";

export async function POST(_request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('household_id, display_name')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile?.household_id) {
    return NextResponse.json({ error: 'Pas de foyer associé' }, { status: 400 });
  }

  const now = new Date();
  // Garde-fou serveur : on ne paie pas Sonnet hors fenêtre même si le client appelle
  if (!isInEveningWindow(now)) {
    return NextResponse.json({ error: 'Hors fenêtre check-in' }, { status: 400 });
  }

  const householdId = profile.household_id;
  const admin = serviceClient();

  // ── Charger le contexte mémoire ─────────────────────────────────────────
  const [membersRes, phantomsRes, householdRes, factsRes, obsRes, turnsRes, lastOpenerRes] =
    await Promise.all([
      admin
        .from('profiles')
        .select('display_name')
        .eq('household_id', householdId),
      admin
        .from('phantom_members')
        .select('display_name, member_type, birth_date')
        .eq('household_id', householdId),
      admin
        .from('households')
        .select('yova_narrative')
        .eq('id', householdId)
        .maybeSingle(),
      admin
        .from('agent_memory_facts')
        .select('content, fact_type')
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(10),
      admin
        .from('observations')
        .select('type, severity, payload, detected_at')
        .eq('household_id', householdId)
        .is('user_acknowledged_at', null)
        .order('detected_at', { ascending: false })
        .limit(10),
      admin
        .from('conversation_turns')
        .select('speaker, content, created_at')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false })
        .limit(10),
      admin
        .from('checkin_openers_log')
        .select('source_detail, generated_at')
        .eq('household_id', householdId)
        .gte('generated_at', new Date(now.getTime() - 30 * 3_600_000).toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const members = [
    ...(membersRes.data ?? []).map((m) => ({
      display_name: m.display_name as string,
      member_type: 'adult' as const,
      birth_date: null as string | null,
    })),
    ...(phantomsRes.data ?? []).map((p) => ({
      display_name: p.display_name as string,
      member_type: (p.member_type as string | null) ?? null,
      birth_date: (p.birth_date as string | null) ?? null,
    })),
  ];

  const ctx: OpenerContext = {
    members,
    observations: (obsRes.data ?? []).map((o) => ({
      type: o.type as string,
      severity: o.severity as 'info' | 'notice' | 'alert',
      payload: (o.payload as Record<string, unknown> | null) ?? null,
      detected_at: o.detected_at as string,
    })),
    narrative: (householdRes.data?.yova_narrative as string | null) ?? null,
    facts: (factsRes.data ?? []).map((f) => ({
      content: f.content as string,
      fact_type: (f.fact_type as string | null) ?? null,
    })),
    recentTurns: (turnsRes.data ?? []).map((t) => ({
      speaker: t.speaker as 'user' | 'agent',
      content: t.content as string,
      created_at: t.created_at as string,
    })),
    lastOpenerSourceDetail: (lastOpenerRes.data?.source_detail as string | null) ?? null,
  };

  // ── Court-circuit mémoire vide ──────────────────────────────────────────
  if (isMemoryEmpty(ctx)) {
    await admin.from('checkin_openers_log').insert({
      household_id: householdId,
      user_id: user.id,
      question: EMPTY_MEMORY_OPENER,
      source: 'fallback',
      source_detail: null,
      is_static_fallback: true,
    });
    return NextResponse.json({
      question: EMPTY_MEMORY_OPENER,
      source: 'fallback' as OpenerSource,
      source_detail: null,
      is_static: true,
    });
  }

  // ── Choix du signal ─────────────────────────────────────────────────────
  const candidates = buildOpenerCandidates(ctx, now);
  const picked = pickOpenerWithRotation(candidates, ctx.lastOpenerSourceDetail);
  const contextBlock = buildContextBlock(ctx, now);

  // ── Appel Sonnet ────────────────────────────────────────────────────────
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'IA indisponible' }, { status: 503 });
  }

  const systemPrompt = `Tu es Yova, le "3e adulte du foyer". Tu ouvres le check-in du soir avec UNE SEULE question courte (max 25 mots) adressée à ${profile.display_name ?? 'l\'user'}.

Règles NON NÉGOCIABLES :
- UNE seule question, pas deux, pas d'intro
- Max 25 mots
- Ton confident, jamais coach, jamais culpabilisant, jamais de "il faudrait"
- N'invente AUCUN fait absent du contexte ci-dessous
- Pas de formule type "comment ça va ?" — tape plus juste, plus personnel
- Français naturel, tutoiement

Directive pour cette ouverture :
${picked.directive}

Contexte foyer disponible :
${contextBlock}

Réponds UNIQUEMENT avec la question, texte brut, pas de guillemets, pas de préfixe.`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        messages: [{ role: 'user', content: systemPrompt }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[checkin-opener] Claude error:', response.status);
      return NextResponse.json({ error: 'Erreur IA' }, { status: 502 });
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text?.trim() ?? '';
    // Nettoyage : retire guillemets éventuels + limite de sécurité à 200 char
    const question = raw.replace(/^["«\s]+|["»\s]+$/g, '').slice(0, 200);

    if (!question || question.length < 5) {
      return NextResponse.json({ error: 'Question vide' }, { status: 500 });
    }

    await admin.from('checkin_openers_log').insert({
      household_id: householdId,
      user_id: user.id,
      question,
      source: picked.source,
      source_detail: picked.source_detail,
      is_static_fallback: false,
    });

    return NextResponse.json({
      question,
      source: picked.source,
      source_detail: picked.source_detail,
      is_static: false,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return NextResponse.json({ error: 'Timeout IA' }, { status: 504 });
    }
    console.error('[checkin-opener] Error:', err);
    return NextResponse.json({ error: 'Erreur technique' }, { status: 500 });
  }
}
