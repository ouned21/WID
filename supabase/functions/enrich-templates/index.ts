/**
 * Edge Function : enrich-templates
 *
 * Appelée automatiquement après chaque promotion de catalogue (cron lundi 3h).
 * Pour chaque template promu non encore enrichi (ai_enriched = false),
 * demande à Claude Haiku d'inférer les métadonnées optimales, puis met à jour.
 *
 * Peut aussi être appelée manuellement : POST /functions/v1/enrich-templates
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Prompt système compact pour Haiku (économique)
const SYSTEM_PROMPT = `Tu es un expert des tâches domestiques françaises.
Pour chaque tâche donnée, retourne un JSON avec ces champs exacts :
{
  "scoring_category": string,  // cleaning|tidying|shopping|laundry|meals|children|admin|outdoor|hygiene|pets|vehicle|transport|household_management|misc
  "default_duration": string,  // very_short(<5min)|short(5-20min)|medium(20-45min)|long(45-90min)|very_long(>90min)
  "default_physical": string,  // none|light|medium|high
  "default_frequency": string, // daily|biweekly|weekly|bimonthly|monthly|quarterly|semiannual|yearly|once
  "default_mental_load_score": number, // 1(trivial) à 8(très lourd)
  "typical_time": string,      // matin|midi|soir|flexible
  "description": string        // 3-8 mots décrivant le contexte, en français
}
Réponds UNIQUEMENT avec le JSON, sans texte autour.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  if (!ANTHROPIC_API_KEY) {
    return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY manquante' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Récupérer les templates promus non encore enrichis par l'IA
  const { data: templates, error } = await supabase
    .from('task_templates')
    .select('id, name, scoring_category, default_duration, default_physical, default_frequency')
    .eq('is_system', false)
    .ilike('description', '%en attente enrichissement IA%')
    .limit(20); // max 20 par run pour maîtriser les coûts Haiku

  if (error || !templates || templates.length === 0) {
    return new Response(JSON.stringify({ enriched: 0, message: 'Rien à enrichir' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let enrichedCount = 0;
  const results: { name: string; success: boolean; error?: string }[] = [];

  for (const tpl of templates) {
    try {
      // Appel Claude Haiku — le moins cher, parfait pour cette tâche structurée
      const aiRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5',
          max_tokens: 200,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Tâche : "${tpl.name}"` }],
        }),
      });

      if (!aiRes.ok) {
        results.push({ name: tpl.name, success: false, error: `Haiku ${aiRes.status}` });
        continue;
      }

      const aiData = await aiRes.json();
      const rawText = aiData.content?.[0]?.text ?? '';

      let metadata: Record<string, unknown>;
      try {
        // Extraire le JSON même si Haiku ajoute du texte autour (rare)
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        metadata = jsonMatch ? JSON.parse(jsonMatch[0]) : null;
      } catch {
        results.push({ name: tpl.name, success: false, error: 'JSON parse failed' });
        continue;
      }

      if (!metadata) {
        results.push({ name: tpl.name, success: false, error: 'No JSON in response' });
        continue;
      }

      // Mettre à jour le template avec les métadonnées enrichies
      const { error: updateError } = await supabase
        .from('task_templates')
        .update({
          scoring_category:         metadata.scoring_category         ?? tpl.scoring_category,
          default_duration:         metadata.default_duration         ?? tpl.default_duration,
          default_physical:         metadata.default_physical         ?? tpl.default_physical,
          default_frequency:        metadata.default_frequency        ?? tpl.default_frequency,
          default_mental_load_score: metadata.default_mental_load_score ?? 3,
          typical_time:             metadata.typical_time             ?? 'flexible',
          description:              metadata.description              ?? '',
        })
        .eq('id', tpl.id);

      if (updateError) {
        results.push({ name: tpl.name, success: false, error: updateError.message });
        continue;
      }

      // Marquer comme enrichi dans catalog_promotions
      await supabase
        .from('catalog_promotions')
        .update({ ai_enriched: true })
        .eq('template_id', tpl.id);

      enrichedCount++;
      results.push({ name: tpl.name, success: true });

      // Petite pause pour ne pas dépasser le rate limit Haiku
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      results.push({ name: tpl.name, success: false, error: String(err) });
    }
  }

  return new Response(
    JSON.stringify({
      enriched: enrichedCount,
      total: templates.length,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  );
});
