/**
 * API Route : /api/onboarding/chat — STREAMING (SSE)
 *
 * Diffuse la réponse Claude token par token via Server-Sent Events.
 * Dès que YOVA_DONE est détecté dans le stream, l'event { type:'generating' }
 * est envoyé immédiatement → le frontend bascule sur l'écran de génération
 * SANS attendre la fin du JSON. Le JSON continue à arriver en arrière-plan.
 *
 * Events SSE émis :
 *   { type: 'reply',      reply, chips }             → message conversationnel normal
 *   { type: 'equipment',  reply }                    → afficher le picker équipements
 *   { type: 'generating', replyText }                → YOVA_DONE détecté, basculer écran
 *   { type: 'done',       replyText, taskRows, ... } → JSON parsé, lancer persistTasks
 *   { type: 'error',      message }                  → erreur
 */

// Augmente la limite Vercel à 60s — claude-sonnet peut prendre 20-30s pour générer
// le JSON complet des tâches (18 tâches + context + children + adults)
export const maxDuration = 60;

import { NextRequest } from 'next/server';
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

// ── System prompt ────────────────────────────────────────────────────────────

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
- adultsRaw : si householdSize > 1, calcule d'abord le nombre d'autres adultes = householdSize - nombre_d_enfants_déclarés - 1 (toi). EXEMPLES : foyer de 4 avec 2 enfants → 1 seul autre adulte → question au singulier "Et ton partenaire/colocataire, comment il/elle s'appelle ?". Foyer de 5 avec 2 enfants → 2 autres adultes → question au pluriel "Et les deux autres adultes, comment ils s'appellent ?". Si l'utilisateur est seul avec des enfants (0 autre adulte) → adultsRaw = "", passe à la suite sans demander.
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
- Question allergies/contraintes alimentaires → [Aucune allergie 👍|On a des allergies]
- Question aide ext.    → [Oui, on a de l'aide|Non, on gère seuls]
- Question énergie      → [Épuisé 😴|Ça va 😊|En forme 💪]
- Question courses      → [Faites ✓|À faire|Livraison 📦]
- Question lessive      → [Faite ✓|À lancer]
- Question dîner        → [Prévu ✓|Pas encore]

IMPORTANT : les chips doivent être le TOUT DERNIER élément du message, collées à la fin, sans phrase après.
Pour les questions ouvertes (prénoms enfants, aide extérieure détail...), pas de chips.
Si le chip "Aucune allergie 👍" est choisi, traite constraints comme "".

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
      "frequency": "<daily|weekly|biweekly|monthly|quarterly|semiannual|yearly|once>",
      "duration_estimate": "<very_short|short|medium|long|very_long>",
      "physical_effort": "<none|light|medium|high>",
      "mental_load_score": <1 à 5>,
      "next_due_at": "<ISO8601 datetime>"
    }
  ],
  "children": [
    { "name": "<string>", "age": <number>, "school_class": "<string ou null>" }
  ],
  "adults": [
    { "name": "<string>" }
  ],
  "householdMeta": {
    "energy_level": "<low|medium|high>",
    "has_external_help": <boolean>,
    "external_help_description": "<string ou null>"
  }
}

RÈGLES DE GÉNÉRATION DES TÂCHES (à appliquer dans le JSON final) :
- Entre 10 et 18 tâches, adaptées à CE foyer spécifiquement
- Chaque tâche doit avoir un nom UNIQUE — aucun doublon dans la liste
- N'inclus PAS les tâches couvertes par l'aide extérieure (ex: si femme de ménage → pas de ménage)
- Si enfants : inclus tâches enfants (préparation école, devoirs, activités, réappro couches/hygiène si < 3 ans)
- ❌ EXCLURE absolument ces rituels automatiques que personne n'oublie : bain du soir, douche, brossage dents, coucher des enfants, repas du matin, débarrasser la table, faire/laver la vaisselle, faire son lit — ils génèrent du bruit sans aucune valeur
- ❌ EXCLURE : sortir les poubelles quotidiennement (inclure seulement la collecte hebdomadaire ou le tri sélectif)
- ✅ INCLURE uniquement les tâches qui demandent une planification consciente ou qu'on oublie vraiment : courses, linge, cuisine du soir (menu à décider), ménage profond, admin, réappro stocks, entretien, prep enfants (école, activités)
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

// ── Auth ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

const encoder = new TextEncoder();

function sseEvent(ctrl: ReadableStreamDefaultController, data: object) {
  ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

/** Injecte les chips de fallback si Claude a oublié de les mettre */
function injectFallbackChips(reply: string): string[] {
  const r = reply.toLowerCase();
  if (/\bcombien\b.*\bmaison\b|\bmaison\b.*\bcombien\b|\bpersonnes?\b.*\bfoyer\b|\bfoyer\b.*\bcombien\b|\bvous [êe]tes combien\b/.test(r))
    return ['1', '2', '3', '4', '5', '6+'];
  if (/\benfants?\b/.test(r) && /[?]/.test(r) && !/pr[eé]nom|[âa]ge|classe|d[eé]tail/.test(r))
    return ['Oui', 'Non'];
  if (/allergi|contrainte.*alimentaire|alimentaire.*contrainte/.test(r) && /[?:]/.test(r))
    return ['Aucune allergie 👍', 'On a des allergies'];
  if (/aide ext|aide.*maison|aide.*domestique/.test(r) && /[?:]/.test(r) && !/quel type|pr[eé]cis|fr[eé]quence|combien de fois/.test(r))
    return ["Oui, on a de l'aide", 'Non, on gère seuls'];
  if (/[eé]nergie|[eé]puis[eé]|en forme|fatigue|sentez.*niveau|niveau.*[eé]nergie/.test(r))
    return ['Épuisé 😴', 'Ça va 😊', 'En forme 💪'];
  if (/\bcourses?\b/.test(r) && !/pr[eé]nom|enfant|adulte/.test(r))
    return ['Faites ✓', 'À faire', 'Livraison 📦'];
  if (/lessiv/.test(r))
    return ['Faite ✓', 'À lancer'];
  if (/d[îi]ner|soir.*repas|repas.*soir|ce soir.*pr[eé]vu|pr[eé]vu.*ce soir/.test(r))
    return ['Prévu ✓', 'Pas encore'];
  return [];
}

/** Parse et valide les tâches du JSON Claude */
function buildTaskRows(tasks: {
  name: string; category: string; frequency: string;
  duration_estimate: string; physical_effort: string;
  mental_load_score: number; next_due_at: string;
}[]) {
  const now = new Date(); now.setHours(9, 0, 0, 0);
  const VALID_FREQ = new Set(['daily','weekly','biweekly','monthly','quarterly','semiannual','yearly','once']);
  const VALID_DUR  = new Set(['very_short','short','medium','long','very_long']);
  const VALID_EFF  = new Set(['none','light','medium','high']);

  return tasks.map(t => ({
    name:                  t.name,
    category_id:           CATEGORY_IDS[t.category] ?? CATEGORY_IDS.cleaning,
    frequency:             VALID_FREQ.has(t.frequency) ? t.frequency : 'weekly',
    duration_estimate:     VALID_DUR.has(t.duration_estimate) ? t.duration_estimate : 'short',
    physical_effort:       VALID_EFF.has(t.physical_effort) ? t.physical_effort : 'medium',
    mental_load_score:     Math.min(5, Math.max(1, t.mental_load_score ?? 3)),
    scoring_category:      t.category || 'cleaning',
    is_active:             true,
    is_fixed_assignment:   false,
    notifications_enabled: true,
    assigned_to:           null,
    next_due_at:           (t.next_due_at && !isNaN(Date.parse(t.next_due_at)))
                             ? t.next_due_at
                             : now.toISOString(),
  }));
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getAuthUser();
  if (!user) {
    return new Response(`data: ${JSON.stringify({ type: 'error', message: 'Non authentifié' })}\n\n`, {
      status: 401, headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  if (!ANTHROPIC_API_KEY) {
    return new Response(`data: ${JSON.stringify({ type: 'error', message: 'ANTHROPIC_API_KEY manquante' })}\n\n`, {
      status: 500, headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  const { messages } = await req.json() as {
    messages: { role: 'user' | 'assistant'; content: string }[];
  };

  if (!messages?.length) {
    return new Response(`data: ${JSON.stringify({ type: 'error', message: 'messages requis' })}\n\n`, {
      status: 400, headers: { 'Content-Type': 'text/event-stream' },
    });
  }

  // Ouvrir le stream Claude avec stream: true
  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      // Haiku : 3-5s au lieu de 20-30s avec Sonnet → évite le timeout Vercel
      // Qualité suffisante pour l'onboarding (collecte de données + génération de tâches)
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      stream: true,
      system: buildSystemPrompt(),
      messages,
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    let claudeDetail = errText;
    try { claudeDetail = (JSON.parse(errText) as { error?: { message?: string } }).error?.message ?? errText; } catch { /* ignore */ }
    return new Response(
      `data: ${JSON.stringify({ type: 'error', message: `Erreur IA : ${claudeDetail}` })}\n\n`,
      { status: 502, headers: { 'Content-Type': 'text/event-stream' } },
    );
  }

  // Créer le ReadableStream SSE vers le client
  const readable = new ReadableStream({
    async start(ctrl) {
      const reader = claudeRes.body!.getReader();
      const decoder = new TextDecoder();

      let accumulated = '';     // texte Claude complet accumulé
      let generatingSent = false; // YOVA_DONE déjà signalé ?
      let sseBuffer = '';         // buffer pour les lignes SSE incomplètes

      try {
        // ── Lire le stream Claude token par token ──
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          sseBuffer += decoder.decode(value, { stream: true });
          const lines = sseBuffer.split('\n');
          sseBuffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6).trim();
            if (payload === '[DONE]') continue;

            try {
              const evt = JSON.parse(payload) as {
                type: string;
                delta?: { type: string; text?: string };
              };

              if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
                accumulated += evt.delta.text ?? '';

                // Dès que YOVA_DONE apparaît : signaler le frontend IMMÉDIATEMENT
                if (!generatingSent && accumulated.includes('YOVA_DONE')) {
                  generatingSent = true;
                  const replyText = accumulated.slice(0, accumulated.indexOf('YOVA_DONE')).trim();
                  sseEvent(ctrl, { type: 'generating', replyText });
                }
              }
            } catch { /* ligne SSE malformée — ignorer */ }
          }
        }

        // ── Stream terminé : traiter le texte complet ──
        const DONE_MARKER = 'YOVA_DONE';
        const doneIdx = accumulated.indexOf(DONE_MARKER);

        if (doneIdx !== -1) {
          // Conversation terminée : parser le JSON des tâches
          const replyText = accumulated.slice(0, doneIdx).trim();
          const jsonStr = accumulated
            .slice(doneIdx + DONE_MARKER.length)
            .trim()
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/, '')
            .trim();

          try {
            const parsed = JSON.parse(jsonStr) as {
              tasks: { name: string; category: string; frequency: string; duration_estimate: string; physical_effort: string; mental_load_score: number; next_due_at: string }[];
              children: { name: string; age: number; school_class: string | null }[];
              adults:   { name: string }[];
              householdMeta: { energy_level: string; has_external_help: boolean; external_help_description: string | null };
            };

            sseEvent(ctrl, {
              type:          'done',
              replyText,
              taskRows:      buildTaskRows(parsed.tasks ?? []),
              children:      parsed.children      ?? [],
              adults:        parsed.adults        ?? [],
              householdMeta: parsed.householdMeta ?? null,
            });
          } catch (parseErr) {
            console.error('[onboarding/chat] YOVA_DONE JSON parse error:', parseErr);
            sseEvent(ctrl, { type: 'error', message: 'Erreur de parsing de la réponse IA. Réessaie.' });
          }

        } else if (accumulated.includes('[SHOW_EQUIPMENT]')) {
          // Afficher le picker équipements
          const reply = accumulated.replace('[SHOW_EQUIPMENT]', '').trim();
          sseEvent(ctrl, { type: 'equipment', reply });

        } else {
          // Message conversationnel normal — extraire les chips
          const chipsMatch = accumulated.match(/\[([^\]]{1,120})\]\s*$/);
          let chips = chipsMatch
            ? chipsMatch[1].split('|').map(c => c.trim()).filter(Boolean)
            : [];
          const reply = chipsMatch
            ? accumulated.slice(0, accumulated.lastIndexOf('[')).trim()
            : accumulated.trim();

          // Fallback chips si Claude a oublié
          if (chips.length === 0) chips = injectFallbackChips(reply);

          sseEvent(ctrl, { type: 'reply', reply, chips });
        }

      } catch (err) {
        console.error('[onboarding/chat] stream error:', err);
        sseEvent(ctrl, { type: 'error', message: 'Erreur réseau. Rechargez la page.' });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no', // désactive le buffering nginx/Vercel
      'Connection':        'keep-alive',
    },
  });
}
