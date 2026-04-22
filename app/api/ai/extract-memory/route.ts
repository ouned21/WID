import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import {
  extractStructuredFallback,
  applyStructuredUpdates,
  mergeStructuredUpdates,
  type PhantomRow,
  type StructuredUpdate,
} from '@/lib/structuredMemory';

// Re-exports conservés pour les tests historiques (sprint 14)
export {
  normalizeName,
  levenshtein,
  matchPhantomByName,
  extractStructuredFallback,
  applyStructuredUpdates,
} from '@/lib/structuredMemory';

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

// ── Sprint 14 — helpers (matchPhantomByName, extractStructuredFallback,
// applyStructuredUpdates, mergeStructuredUpdates) déplacés dans
// lib/structuredMemory.ts. Cf. imports + re-exports en haut du fichier.

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
    .select('id, content, fact_type')
    .eq('household_id', householdId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(40);

  // Charger les membres pour le contexte
  const [membersRes, phantomsRes] = await Promise.all([
    admin.from('profiles').select('id, display_name').eq('household_id', householdId),
    admin.from('phantom_members').select('id, display_name, specifics').eq('household_id', householdId),
  ]);

  const members = membersRes.data ?? [];
  const phantoms = phantomsRes.data ?? [];

  const membersBlock = [
    ...members.map((m) => `- [${m.id}] ${m.display_name} (membre)`),
    ...phantoms.map((p) => `- [phantom:${p.id}] ${p.display_name} (enfant/fantôme)`),
  ].join('\n');

  // Liste des prénoms phantoms pour le prompt (structured_updates)
  const phantomNames = phantoms.map((p) => p.display_name).join(', ') || '(aucun)';
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentYear = new Date().getFullYear();

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

### Règles STRICTES anti-doublon
1. Compare CHAQUE fait que tu envisages avec la liste "Faits déjà mémorisés" ci-dessus.
2. Si un fait existant couvre déjà le même sujet avec la même signification → n'en crée PAS un nouveau. Retourne facts: [].
3. Un fait n'est NOUVEAU que s'il apporte une information absente de la liste existante.
4. Les types "tension" et "context" évoluent — si la situation a changé, indique "replaces": true dans le JSON pour qu'on désactive l'ancien.

### Critères de mémorisation
- Stable (pas juste vrai aujourd'hui, sauf tensions/milestones)
- Personnel (révèle quelque chose sur un membre ou la dynamique du foyer)
- Utile pour Yova dans ses prochaines interactions

### Types de faits
- preference : goût, aversion, habitude personnelle
- pattern : comportement récurrent
- context : situation actuelle du foyer (déménagement, travaux, événement)
- tension : surcharge, stress, déséquilibre (transitoire)
- milestone : événement marquant (nouveau job, naissance, rentrée scolaire)

## Faits structurés à écrire dans les fiches membres (nouveau — sprint 14)

Certains faits méritent d'être enregistrés dans la fiche structurée du membre concerné (et pas seulement en mémoire narrative). Trois champs uniquement :

- **birth_date** : date de naissance / anniversaire d'un enfant ou adulte fantôme
- **school_class** : classe scolaire d'un enfant (CP, CE1, 6ème, etc.) — forme courte telle que dit l'user
- **allergies** : allergies alimentaires / intolérances

### Règles d'extraction structurée — strictes
- Aujourd'hui : ${todayIso} (année courante : ${currentYear})
- **birth_date** : convertis en YYYY-MM-DD. Si année absente ("le 13 mai"), utilise ${currentYear} si la date n'est pas passée, sinon ${currentYear + 1}. **Si date relative ("dans 2 mois", "la semaine prochaine", "bientôt") → NE PAS EXTRAIRE** (n'ajoute rien aux structured_updates)
- **school_class** : forme courte trimée ("CE1", "6ème", "Grande Section"). Ne corrige pas l'user.
- **allergies** : liste de strings en français, minuscules ("arachides", "fruits à coque"). Une allergie par entrée.
- Le \`member_name\` DOIT être exactement le prénom d'un phantom de cette liste : ${phantomNames}. Si le prénom n'est pas dans la liste, n'extrais rien.
- Confidence < 0.8 = skippé côté serveur. N'invente jamais.

### IMPORTANT — format check-in du soir
Le message peut être au format question/réponse (check-in guidé : "Comment ça va ?" "Et à la maison ?"…). **Ignore les questions Yova**, extrais les faits des réponses user peu importe le format. Si l'user mentionne l'anniversaire / la classe / une allergie d'un membre connu, tu DOIS produire un \`structured_updates\` — c'est une info structurée critique, pas un fait narratif flou.

### Exemples obligatoires à suivre

Exemple 1 (anniversaire, format check-in) :
Input : "Comment ça va ? l'anniversaire d'Eva c'est le 13 mai"
Output structured_updates : [{"member_name": "Eva", "field": "birth_date", "value": "${currentYear}-05-13", "confidence": 0.95}]
(ne pas créer de fait narratif "événement le 13 mai" — c'est un birthday structuré)

Exemple 2 (classe, forme parlée) :
Input : "Tina rentre en CE1 en septembre"
Output structured_updates : [{"member_name": "Tina", "field": "school_class", "value": "CE1", "confidence": 0.9}]

Exemple 3 (allergie) :
Input : "Eva est allergique aux arachides"
Output structured_updates : [{"member_name": "Eva", "field": "allergies", "value": ["arachides"], "confidence": 0.95}]

Exemple 4 (date relative — NE PAS extraire) :
Input : "l'anniversaire de Tina c'est dans 2 mois"
Output structured_updates : [] (date relative ignorée)

### Format de sortie

Retourne UNIQUEMENT ce JSON (sans markdown) :
{
  "facts": [
    {
      "fact_type": "preference|pattern|context|tension|milestone",
      "content": "Phrase courte et factuelle en français (max 100 chars)",
      "confidence": 0.7,
      "about_user_id": "uuid-du-membre-si-applicable-sinon-null",
      "about_phantom_id": "uuid-du-fantôme-si-applicable-sinon-null",
      "replaces": false
    }
  ],
  "structured_updates": [
    {
      "member_name": "Eva",
      "field": "birth_date | school_class | allergies",
      "value": "2019-05-13" | "CE1" | ["arachides"],
      "confidence": 0.95
    }
  ]
}

Si aucun fait VRAIMENT nouveau → \`facts: []\`. Si aucun fait structuré détecté → \`structured_updates: []\`.`;

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

    let parsed: {
      facts: Array<{
        fact_type: string;
        content: string;
        confidence: number;
        about_user_id: string | null;
        about_phantom_id: string | null;
        replaces?: boolean;
      }>;
      structured_updates?: StructuredUpdate[];
    };

    try {
      // Nettoyer les éventuels backticks markdown
      const clean = rawContent.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error('[extract-memory] JSON parse error:', rawContent);
      return NextResponse.json({ ok: false });
    }

    const facts = parsed.facts ?? [];

    // ── Déduplication par overlap de mots ───────────────────────────────────
    // Évite les insertions si un fait très similaire existe déjà
    function wordOverlap(a: string, b: string): number {
      const words = (s: string) => new Set(
        s.toLowerCase().split(/[\s,.''-]+/).filter((w) => w.length > 3)
      );
      const wa = words(a);
      const wb = words(b);
      if (wa.size === 0 || wb.size === 0) return 0;
      let common = 0;
      for (const w of wa) { if (wb.has(w)) common++; }
      return common / Math.min(wa.size, wb.size);
    }

    const existingList = existingFacts ?? [];
    // Types transitoires : on désactive l'ancien si le nouveau "remplace"
    const TRANSIENT_TYPES = ['tension', 'context'];

    // Valider et insérer les faits
    const validTypes = ['preference', 'pattern', 'context', 'tension', 'milestone'];
    const toInsert: Array<{
      household_id: string;
      about_user_id: string | null;
      about_phantom_id: string | null;
      fact_type: string;
      content: string;
      confidence: number;
      source_journal_id: string | null;
      is_active: boolean;
    }> = [];

    for (const f of facts) {
      if (!validTypes.includes(f.fact_type) || !f.content || f.content.length <= 3) continue;

      // Cherche un fait existant du même type très similaire
      const similar = existingList.find(
        (e) => e.fact_type === f.fact_type && wordOverlap(e.content, f.content) >= 0.5
      );

      if (similar) {
        // Désactiver l'ancien fait pour les types transitoires si replaces = true
        if (TRANSIENT_TYPES.includes(f.fact_type) && (f as { replaces?: boolean }).replaces && similar.id) {
          await admin.from('agent_memory_facts').update({ is_active: false }).eq('id', similar.id);
          console.log(`[extract-memory] Désactivation ancien fait transitoire: "${similar.content}"`);
        } else {
          console.log(`[extract-memory] Doublon ignoré: "${f.content}" ≈ "${similar.content}"`);
          continue;
        }
      }

      if (toInsert.length >= 3) break;
      toInsert.push({
        household_id: householdId,
        about_user_id: f.about_user_id ?? null,
        about_phantom_id: f.about_phantom_id ?? null,
        fact_type: f.fact_type,
        content: f.content.slice(0, 500),
        confidence: Math.min(1, Math.max(0, f.confidence ?? 0.8)),
        source_journal_id: journalId ?? null,
        is_active: true,
      });
    }

    if (toInsert.length > 0) {
      const { error } = await admin.from('agent_memory_facts').insert(toInsert);
      if (error) {
        console.error('[extract-memory] Insert error:', error.message);
        return NextResponse.json({ ok: false });
      }
    }

    // ── Sprint 14 — Auto-sync faits structurés vers phantom_members ────────
    // Combine Haiku (principal) + regex déterministe (fallback/doublon).
    const fallbackUpdates = extractStructuredFallback(text, phantoms.map((p) => p.display_name));
    const mergedUpdates = mergeStructuredUpdates(parsed.structured_updates, fallbackUpdates);
    if (fallbackUpdates.length > 0 && (!parsed.structured_updates || parsed.structured_updates.length === 0)) {
      console.log(`[extract-memory] fallback regex a détecté ${fallbackUpdates.length} fait(s) non vus par Haiku`);
    }

    const applied = await applyStructuredUpdates({
      admin,
      householdId,
      journalId: journalId ?? null,
      phantoms: phantoms as PhantomRow[],
      updates: mergedUpdates,
    });

    console.log(`[extract-memory] ${toInsert.length} fait(s) mémorisé(s) + ${applied.length} champ(s) fiche(s) (haiku: ${(parsed.structured_updates ?? []).length}, regex: ${fallbackUpdates.length}) pour le foyer ${householdId}`);
    return NextResponse.json({
      ok: true,
      inserted: toInsert.length,
      facts: toInsert,
      structured_updates: applied,
    });

  } catch (err) {
    console.error('[extract-memory] Error:', err);
    return NextResponse.json({ ok: false });
  }
}

export { FACT_TYPE_EMOJI };
