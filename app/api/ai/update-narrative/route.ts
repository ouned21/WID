import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

/**
 * POST /api/ai/update-narrative
 *
 * Met à jour le portrait narratif du foyer après chaque journal.
 * Appelé en fire-and-forget depuis parse-journal.
 *
 * Haiku prend le portrait actuel + le nouveau journal
 * et génère un portrait mis à jour (3-5 phrases, style narratif).
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

function serviceClient() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: NextRequest) {
  let body: { householdId?: unknown; journalText?: unknown; userName?: unknown };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const householdId = typeof body.householdId === 'string' ? body.householdId : null;
  const journalText = typeof body.journalText === 'string' ? body.journalText.slice(0, 3000) : null;
  const userName = typeof body.userName === 'string' ? body.userName : 'l\'utilisateur';

  if (!householdId || !journalText) {
    return NextResponse.json({ error: 'householdId et journalText requis' }, { status: 400 });
  }

  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'API key manquante' }, { status: 500 });
  }

  const admin = serviceClient();

  // Charger le portrait actuel
  const { data: household } = await admin
    .from('households')
    .select('yova_narrative')
    .eq('id', householdId)
    .maybeSingle();

  const currentNarrative = household?.yova_narrative ?? '';

  const prompt = currentNarrative
    ? `Tu es Yova, assistant IA d'un foyer. Tu maintiens un portrait vivant des habitants pour mieux les connaître.

Portrait actuel du foyer :
"""
${currentNarrative}
"""

Nouveau journal de ${userName} :
"""
${journalText}
"""

Mets à jour le portrait en intégrant les nouvelles informations importantes.
Règles :
- 4-6 phrases maximum, style narratif fluide (pas une liste de faits)
- Conserve les infos importantes du portrait actuel
- Intègre les nouvelles infos naturellement (prénoms, habitudes, événements en cours, ce que la personne aime/déteste, dynamique du foyer)
- Inclus les tensions/défis actuels s'ils sont mentionnés
- Français naturel, pas de formules robotiques

Réponds UNIQUEMENT avec le portrait mis à jour (texte brut, pas de JSON).`
    : `Tu es Yova, assistant IA d'un foyer. Tu crées un premier portrait des habitants à partir d'un journal.

Premier journal de ${userName} :
"""
${journalText}
"""

Crée un portrait initial du foyer.
Règles :
- 3-5 phrases, style narratif (comme si tu décrivais ces personnes à quelqu'un)
- Inclus : prénoms connus, rôles, habitudes, ce qui se passe en ce moment, dynamique
- Français naturel

Réponds UNIQUEMENT avec le portrait (texte brut, pas de JSON).`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('[update-narrative] Claude error:', response.status);
      return NextResponse.json({ error: 'Erreur IA' }, { status: 502 });
    }

    const data = await response.json();
    const narrative = data.content?.[0]?.text?.trim() ?? '';

    if (!narrative || narrative.length < 10) {
      return NextResponse.json({ error: 'Narrative vide' }, { status: 500 });
    }

    // Sauvegarder en DB
    await admin
      .from('households')
      .update({
        yova_narrative: narrative,
        yova_narrative_updated_at: new Date().toISOString(),
      })
      .eq('id', householdId);

    return NextResponse.json({ ok: true, narrative });

  } catch (err) {
    console.error('[update-narrative] Error:', err);
    return NextResponse.json({ error: 'Erreur technique' }, { status: 500 });
  }
}
