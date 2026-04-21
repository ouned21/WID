import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

/**
 * POST /api/ai/extract-memory
 *
 * Appelé après chaque journal réussi. Utilise Claude Haiku pour extraire
 * 0-3 faits nouveaux sur le foyer et les mémorise dans agent_memory_facts.
 *
 * Faits possibles :
 * - preference : "Jonathan déteste faire la vaisselle"
 * - pattern    : "Barbara complète ses tâches le soir"
 * - context    : "Le foyer prépare un déménagement en Géorgie en juillet"
 * - tension    : "Jonathan se sent surchargé cette semaine"
 * - milestone  : "Léa a commencé la danse le mercredi"
 *
 * Silencieux côté client — ne bloque pas l'UX, erreurs swallowed.
 */

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

const FACT_TYPE_EMOJI: Record<string, string> = {
  preference: '❤️',
  pattern: '🔄',
  context: '📍',
  tension: '⚡',
  milestone: '🌟',
};

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  let body: { journalId?: string; text?: string; householdId?: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ ok: false }, { status: 400 }); }

  const { journalId, text, householdId } = body;
  if (!text || !householdId) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = serviceClient();

  // Charger les faits existants (pour éviter les doublons)
  const { data: existingFacts } = await admin
    .from('agent_memory_facts')
    .select('content, fact_type')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(30);

  // Charger les membres pour le contexte
  const [membersRes, phantomsRes] = await Promise.all([
    admin.from('profiles').select('id, display_name').eq('household_id', householdId),
    admin.from('phantom_members').select('id, display_name').eq('household_id', householdId),
  ]);

  const members = membersRes.data ?? [];
  const phantoms = phantomsRes.data ?? [];

  const membersBlock = [
    ...members.map((m) => `- [${m.id}] ${m.display_name} (membre)`),
    ...phantoms.map((p) => `- [phantom:${p.id}] ${p.display_name} (enfant/fantôme)`),
  ].join('\n');

  const existingBlock = existingFacts && existingFacts.length > 0
    ? existingFacts.map((f) => `[${f.fact_type}] ${f.content}`).join('\n')
    : '(aucun fait mémorisé pour l\'instant)';

  const prompt = `Tu es le module mémoire de Yova, agent IA de gestion du foyer.

## Membres du foyer
${membersBlock}

## Faits déjà mémorisés (ne pas dupliquer)
${existingBlock}

## Nouveau message de l'utilisateur
"""
${text.slice(0, 1000)}
"""

## Ta mission
Extrais entre 0 et 3 NOUVEAUX faits sur les membres ou le foyer qui méritent d'être mémorisés à long terme.
Un fait est mémorisable s'il est :
- Stable (pas juste vrai aujourd'hui)
- Personnel (révèle quelque chose sur un membre ou la dynamique du foyer)
- Utile pour Yova dans ses prochaines interactions

Types de faits :
- preference : goût, aversion, habitude personnelle
- pattern : comportement récurrent
- context : situation actuelle du foyer (déménagement, travaux, événement)
- tension : surcharge, stress, déséquilibre
- milestone : événement marquant (nouveau job, naissance, rentrée scolaire)

Retourne UNIQUEMENT ce JSON (sans markdown) :
{
  "facts": [
    {
      "fact_type": "preference|pattern|context|tension|milestone",
      "content": "Phrase courte et factuelle en français (max 100 chars)",
      "confidence": 0.7,
      "about_user_id": "uuid-du-membre-si-applicable-sinon-null",
      "about_phantom_id": "uuid-du-fantôme-si-applicable-sinon-null"
    }
  ]
}

Si aucun fait nouveau mérite d'être mémorisé → retourne { "facts": [] }`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[extract-memory] Anthropic error:', response.status);
      return NextResponse.json({ ok: false });
    }

    const data = await response.json();
    const rawContent = data.content?.[0]?.text ?? '{"facts":[]}';

    let parsed: { facts: Array<{
      fact_type: string;
      content: string;
      confidence: number;
      about_user_id: string | null;
      about_phantom_id: string | null;
    }> };

    try {
      // Nettoyer les éventuels backticks markdown
      const clean = rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error('[extract-memory] JSON parse error:', rawContent);
      return NextResponse.json({ ok: false });
    }

    const facts = parsed.facts ?? [];
    if (facts.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

    // Valider et insérer les faits
    const validTypes = ['preference', 'pattern', 'context', 'tension', 'milestone'];
    const toInsert = facts
      .filter((f) => validTypes.includes(f.fact_type) && f.content?.length > 3)
      .slice(0, 3)
      .map((f) => ({
        household_id: householdId,
        about_user_id: f.about_user_id ?? null,
        about_phantom_id: f.about_phantom_id ?? null,
        fact_type: f.fact_type,
        content: f.content.slice(0, 500),
        confidence: Math.min(1, Math.max(0, f.confidence ?? 0.8)),
        source_journal_id: journalId ?? null,
        is_active: true,
      }));

    if (toInsert.length > 0) {
      const { error } = await admin.from('agent_memory_facts').insert(toInsert);
      if (error) {
        console.error('[extract-memory] Insert error:', error.message);
        return NextResponse.json({ ok: false });
      }
    }

    console.log(`[extract-memory] ${toInsert.length} fait(s) mémorisé(s) pour le foyer ${householdId}`);
    return NextResponse.json({ ok: true, inserted: toInsert.length, facts: toInsert });

  } catch (err) {
    console.error('[extract-memory] Error:', err);
    return NextResponse.json({ ok: false });
  }
}

export { FACT_TYPE_EMOJI };
