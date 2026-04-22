/**
 * API Route : /api/onboarding/chat
 *
 * Claude pilote la conversation d'onboarding de bout en bout.
 * Le frontend envoie l'historique complet à chaque message (stateless).
 *
 * Quand Claude a assez d'infos, il répond avec YOVA_DONE + JSON structuré
 * qui contient context + taskRows + children + householdMeta.
 * Le backend détecte le marqueur, parse le JSON, et retourne done:true.
 *
 * Chips : Claude peut inclure [opt1|opt2] en fin de message pour
 * proposer des réponses rapides. Le backend les parse et les retourne séparément.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const CATEGORY_IDS: Record<string, string> = {
  cleaning:             '11111111-1111-1111-1111-111111111111',
  tidying:              '22222222-2222-2222-2222-222222222222',
  shopping:             '33333333-3333-3333-3333-333333333333',
  laundry:              '44444444-4444-4444-4444-444444444444',
  children:             '55555555-5555-5555-5555-555555555555',
  meals:                '66666666-6666-6666-6666-666666666666',
  admin:                '77777777-7777-7777-7777-777777777777',
  outdoor:              '88888888-8888-8888-8888-888888888888',
  hygiene:              '99999999-9999-9999-9999-999999999999',
  pets:                 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  vehicle:              'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  household_management: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
};

function buildSystemPrompt(): string {
  const now = new Date();
  now.setHours(9, 0, 0, 0);
  const todayISO = now.toISOString();

  return `Tu es Yova, l'assistant IA d'un foyer. Tu accueilles un nouvel utilisateur qui s'inscrit.

TON OBJECTIF : Collecter les informations nécessaires pour créer une liste de tâches ménagères personnalisées et calibrées pour ce foyer. Tu poses des questions naturellement, tu t'adaptes aux réponses, tu n'es jamais culpabilisant.

STYLE : Chaleureux, concis, bienveillant. Tutoie l'utilisateur. Pas de listes à puces dans tes questions.
UNE SEULE QUESTION PAR MESSAGE — surtout pour les questions avec suggestions rapides (chips). Ne regroupe jamais deux questions à chips dans la même bulle.

INFORMATIONS À COLLECTER (toutes nécessaires avant de générer) :
- householdSize : nombre de personnes dans le foyer
- hasChildren + childrenRaw : y a-t-il des enfants ? Si oui, prénoms et âges (ex: "Léa 7 ans, Tom 4 ans")
- constraints : allergies ou contraintes alimentaires ("" si aucune)
- hasExternalHelp + externalHelpRaw : aide extérieure (femme de ménage, baby-sitter, livraison repas...) ("" si aucune)
- equipment : liste des équipements disponibles — IMPORTANT : quand tu poses cette question, termine ton message exactement par [SHOW_EQUIPMENT] (sans rien après). Le frontend affichera une sélection visuelle à l'utilisateur. Tu n'as pas besoin de lister les équipements toi-même.
- energyLevel : niveau d'énergie actuel du foyer — "low" (épuisé), "medium" (ça va), "high" (en forme)
- groceriesDone : état des courses — "done" (faites récemment), "todo" (à faire), "delivery" (livraison habituelle)
- laundryDone : état de la lessive — "done" (faite), "todo" (à lancer)
- dinnerPlanned : dîner ce soir — "yes" (prévu), "no" (pas encore)

ADAPTATION :
- Si foyer solo → l'aide extérieure est souvent non pertinente, demande rapidement
- Si pas d'enfants → ne demande pas les détails enfants
- Si énergie=low → génère uniquement les tâches vitales (cuisine, linge, enfants si présents)
- Regroupe les questions quand c'est naturel ("T'as un lave-vaisselle ? Et un robot aspirateur ?")
- Un foyer simple (solo, pas d'enfants) → 4-5 échanges suffisent
- Un foyer complexe (famille, contraintes) → jusqu'à 8 échanges

SUGGESTIONS RAPIDES — RÈGLE ABSOLUE :
Pour CHAQUE question listée ci-dessous, ton message DOIT se terminer par exactement ces chips (rien après, pas de ponctuation) :
- Question taille foyer → [1|2|3|4|5|6+]
- Question enfants      → [Oui|Non]
- Question aide ext.    → [Oui, on a de l'aide|Non, on gère seuls]
- Question énergie      → [Épuisé 😴|Ça va 😊|En forme 💪]
- Question courses      → [Faites ✓|À faire|Livraison 📦]
- Question lessive      → [Faite ✓|À lancer]
- Question dîner        → [Prévu ✓|Pas encore]

IMPORTANT : les chips doivent être le TOUT DERNIER élément du message, collées à la fin, sans phrase après.
Pour les questions ouvertes (prénoms enfants, contraintes, aide extérieure détail...), pas de chips.

QUAND TU AS TOUTES LES INFORMATIONS :
1. Écris une phrase de conclusion chaleureuse (1-2 phrases, ex: "Parfait, j'ai tout ce qu'il me faut !")
2. Puis exactement sur une nouvelle ligne : YOVA_DONE
3. Puis immédiatement le JSON brut (PAS de blocs code, PAS de balises, juste le JSON directement) :

{
  "context": {
    "householdSize": <number>,
    "hasChildren": <boolean>,
    "childrenRaw": "<string>",
    "constraints": "<string>",
    "hasExternalHelp": <boolean>,
    "externalHelpRaw": "<string>",
    "equipment": ["<string>", ...],
    "energyLevel": "<low|medium|high>",
    "groceriesDone": "<done|todo|delivery>",
    "laundryDone": "<done|todo>",
    "dinnerPlanned": "<yes|no>"
  },
  "tasks": [
    {
      "name": "<nom court, action claire, en français>",
      "category": "<cleaning|tidying|shopping|laundry|children|meals|admin|outdoor|hygiene|pets|vehicle|household_management>",
      "frequency": "<daily|every_other_day|twice_weekly|weekly|biweekly|monthly|quarterly|yearly>",
      "duration_estimate": "<very_short|short|medium|long|very_long>",
      "physical_effort": "<none|light|medium|high>",
      "mental_load_score": <1 à 5>,
      "next_due_at": "<ISO8601 datetime>"
    }
  ],
  "children": [
    { "name": "<string>", "age": <number>, "school_class": "<string ou null>" }
  ],
  "householdMeta": {
    "energy_level": "<low|medium|high>",
    "has_external_help": <boolean>,
    "external_help_description": "<string ou null>"
  }
}

RÈGLES DE GÉNÉRATION DES TÂCHES (à appliquer dans le JSON final) :
- Entre 10 et 18 tâches, adaptées à CE foyer spécifiquement
- N'inclus PAS les tâches couvertes par l'aide extérieure (ex: si femme de ménage → pas de ménage)
- Si enfants : inclus tâches enfants (bain du soir, devoirs, préparation école, activités)
- Si animal mentionné dans les équipements : inclus tâches animaux (nourriture, sortie, litière...)
- Si jardin mentionné : inclus entretien extérieur
- Si énergie=low : tâches vitales uniquement (cuisine simple, linge, enfants)
- Calibre next_due_at selon l'état actuel (date actuelle : ${todayISO}) :
  * Courses "done" → prochaine dans ~5 jours
  * Courses "todo" → aujourd'hui ou demain
  * Courses "delivery" → prochaine dans ~7 jours
  * Lessive "done" → prochaine dans ~4 jours
  * Lessive "todo" → aujourd'hui
  * Dîner "yes" → prochaine tâche repas demain
  * Dîner "no" → aujourd'hui`;
}

async function getAuthUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY manquante' }, { status: 500 });
  }

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: 'messages requis' }, { status: 400 });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 4096,
        system: buildSystemPrompt(),
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[onboarding/chat] Claude error:', errText);
      // Retourne le détail de l'erreur Claude pour faciliter le debug
      let claudeDetail = '';
      try { claudeDetail = JSON.parse(errText)?.error?.message ?? errText; } catch { claudeDetail = errText; }
      return NextResponse.json(
        { error: `Erreur IA : ${claudeDetail}`, reply: "Désolé, j'ai un souci technique. Réessaie dans un instant." },
        { status: 502 }
      );
    }

    const data = await response.json();
    const rawText: string = data.content?.[0]?.text ?? '';

    // ── Detect YOVA_DONE ───────────────────────────────────────────────────
    const doneMarker = 'YOVA_DONE';
    const doneIdx = rawText.indexOf(doneMarker);

    if (doneIdx !== -1) {
      const replyText = rawText.slice(0, doneIdx).trim();
      // Strip markdown code fences that Claude sometimes adds (```json ... ```)
      const jsonStr = rawText
        .slice(doneIdx + doneMarker.length)
        .trim()
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

      try {
        const parsed = JSON.parse(jsonStr) as {
          context: Record<string, unknown>;
          tasks: {
            name: string; category: string; frequency: string;
            duration_estimate: string; physical_effort: string;
            mental_load_score: number; next_due_at: string;
          }[];
          children: { name: string; age: number; school_class: string | null }[];
          householdMeta: { energy_level: string; has_external_help: boolean; external_help_description: string | null };
        };

        const now = new Date();
        now.setHours(9, 0, 0, 0);

        const VALID_FREQUENCIES = new Set(['daily','every_other_day','twice_weekly','weekly','biweekly','monthly','quarterly','yearly']);
        const VALID_DURATIONS   = new Set(['very_short','short','medium','long','very_long']);
        const VALID_EFFORTS     = new Set(['none','light','medium','high']);

        const taskRows = (parsed.tasks ?? []).map(t => ({
          name:               t.name,
          category_id:        CATEGORY_IDS[t.category] ?? CATEGORY_IDS.cleaning,
          frequency:          VALID_FREQUENCIES.has(t.frequency) ? t.frequency : 'weekly',
          duration_estimate:  VALID_DURATIONS.has(t.duration_estimate) ? t.duration_estimate : 'short',
          physical_effort:    VALID_EFFORTS.has(t.physical_effort) ? t.physical_effort : 'medium',
          mental_load_score:  Math.min(5, Math.max(1, t.mental_load_score ?? 3)),
          scoring_category:   t.category           || 'cleaning',
          is_active:          true,
          is_fixed_assignment: false,
          notifications_enabled: true,
          assigned_to:        null,
          next_due_at:        t.next_due_at        || now.toISOString(),
        }));

        return NextResponse.json({
          reply: replyText,
          done: true,
          taskRows,
          children:      parsed.children      ?? [],
          householdMeta: parsed.householdMeta ?? null,
        });
      } catch (parseErr) {
        // JSON malformed — log and continue as regular message so conversation doesn't break
        console.error('[onboarding/chat] YOVA_DONE JSON parse error:', parseErr);
        console.error('[onboarding/chat] Raw JSON attempted:', rawText.slice(doneIdx + doneMarker.length, doneIdx + doneMarker.length + 200));
      }
    }

    // ── [SHOW_EQUIPMENT] marker — affiche la grille d'équipements ────────
    if (rawText.includes('[SHOW_EQUIPMENT]')) {
      const reply = rawText.replace('[SHOW_EQUIPMENT]', '').trim();
      return NextResponse.json({ reply, done: false, chips: [], showEquipment: true });
    }

    // ── Regular message — extract optional chips [opt1|opt2] ──────────────
    const chipsMatch = rawText.match(/\[([^\]]{1,120})\]\s*$/);
    let chips = chipsMatch
      ? chipsMatch[1].split('|').map(c => c.trim()).filter(Boolean)
      : [];
    const reply = chipsMatch
      ? rawText.slice(0, rawText.lastIndexOf('[')).trim()
      : rawText.trim();

    // ── Fallback chips si Claude a oublié ─────────────────────────────────
    // Détecte le type de question et injecte les chips si absentes
    if (chips.length === 0) {
      const r = reply.toLowerCase();
      if (/\bcombien\b.*\bmaison\b|\bmaison\b.*\bcombien\b|\bpersonnes?\b.*\bfoyer\b|\bfoyer\b.*\bcombien\b|\bvous êtes combien\b/.test(r))
        chips = ['1', '2', '3', '4', '5', '6+'];
      else if (/\benfants?\b/.test(r) && /\?/.test(r))
        chips = ['Oui', 'Non'];
      else if (/\baide ext[eé]rieure\b|\baide (à la maison|domestique)\b/.test(r) && /\?/.test(r) && !/quel type|précis|fr[eé]quence|combien de fois/.test(r))
        chips = ['Oui, on a de l\'aide', 'Non, on gère seuls'];
      else if (/\b[eé]nergie\b|\b[eé]puis[eé]\b|\fen forme\b|\bfatigue\b|\bniveau\b.*\b[eé]nergie\b/.test(r))
        chips = ['Épuisé 😴', 'Ça va 😊', 'En forme 💪'];
      else if (/\bcourses?\b/.test(r) && /\?/.test(r))
        chips = ['Faites ✓', 'À faire', 'Livraison 📦'];
      else if (/\blessiv[e]?\b/.test(r) && /\?/.test(r))
        chips = ['Faite ✓', 'À lancer'];
      else if (/\bd[îi]ner\b|\bsoir\b.*\brepas\b|\brepas\b.*\bsoir\b/.test(r) && /\?/.test(r))
        chips = ['Prévu ✓', 'Pas encore'];
    }

    return NextResponse.json({ reply, done: false, chips });

  } catch (err) {
    console.error('[onboarding/chat] Exception:', err);
    return NextResponse.json(
      { error: 'Erreur serveur', reply: "Désolé, j'ai un souci. Réessaie dans un instant." },
      { status: 500 }
    );
  }
}
