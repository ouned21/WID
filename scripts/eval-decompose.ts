/**
 * Sprint 12 — Eval manuelle de la décomposition de projets.
 *
 * Tape 10 prompts variés contre l'endpoint /api/ai/decompose-project en
 * environnement staging (Vercel preview) ou local (http://localhost:3000).
 * Produit un rapport JSON + Markdown pour revue humaine (pas de pass/fail
 * automatique — c'est Jonathan qui juge si chaque sortie est "utilisable").
 *
 * Usage :
 *   EVAL_BASE_URL=https://xxx.vercel.app \
 *   EVAL_COOKIE="sb-access-token=...; sb-refresh-token=..." \
 *   npx tsx scripts/eval-decompose.ts
 *
 * La cookie doit correspondre à un user avec household + consentement RGPD.
 * Lancer le script UNE fois avant démo — les 10 appels coûtent ~0,20€.
 */

const BASE_URL = process.env.EVAL_BASE_URL ?? 'http://localhost:3000';
const COOKIE = process.env.EVAL_COOKIE ?? '';

const PROMPTS: Array<{ label: string; prompt: string }> = [
  { label: 'déjeuner famille', prompt: 'organise le déjeuner de dimanche' },
  { label: 'anniversaire enfant', prompt: 'prépare l\'anniversaire de Léa (7 ans) dans 2 semaines' },
  { label: 'week-end parents', prompt: 'planifie le week-end chez mes parents le 10 mai' },
  { label: 'rentrée scolaire', prompt: 'prépare la rentrée scolaire des enfants' },
  { label: 'rdv pédiatre', prompt: 'organise le rdv pédiatre de Léa avec les courses associées' },
  { label: 'ménage de printemps', prompt: 'planifie le ménage de printemps sur 2 week-ends' },
  { label: 'apéro amis', prompt: 'organise un apéro avec nos potes samedi soir, on sera 8' },
  { label: 'sortie parc', prompt: 'prépare une sortie au parc dimanche avec pique-nique' },
  { label: 'voyage court', prompt: 'organise le voyage à Lyon ce week-end (aller vendredi soir, retour dimanche)' },
  { label: 'rentrée incomplète', prompt: 'organise un dîner avec mes potes' /* devrait déclencher pending */ },
];

type Out = {
  ok: boolean;
  pending_question: string | null;
  pending_missing: string | null;
  project_decomposed: {
    title: string;
    subtask_count: number;
    target_date: string | null;
    subtasks: Array<{ name: string; next_due_at: string; duration_minutes: number; notes: string | null }>;
  } | null;
  duration_ms?: number;
  error?: string;
  message?: string;
};

async function runOne(prompt: string, label: string) {
  const start = Date.now();
  try {
    const res = await fetch(`${BASE_URL}/api/ai/decompose-project`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(COOKIE ? { Cookie: COOKIE } : {}),
      },
      body: JSON.stringify({ prompt }),
    });
    const body = (await res.json()) as Out;
    const elapsed = Date.now() - start;
    return { label, prompt, status: res.status, elapsed, body };
  } catch (err) {
    return { label, prompt, status: 0, elapsed: Date.now() - start, body: { error: String(err) } as Out };
  }
}

function toMarkdown(rows: Awaited<ReturnType<typeof runOne>>[]) {
  const lines: string[] = [
    `# Eval décompose-project — ${new Date().toISOString()}`,
    '',
    `Base URL : \`${BASE_URL}\``,
    '',
    '| # | Label | Status | Durée | Sortie |',
    '|---|-------|--------|-------|--------|',
  ];
  rows.forEach((r, i) => {
    const d = r.body;
    let summary: string;
    if (d.pending_question) {
      summary = `❓ "${d.pending_question}"`;
    } else if (d.project_decomposed) {
      const subs = d.project_decomposed.subtasks.map((s) => `- ${s.name}`).join('<br>');
      summary = `📋 **${d.project_decomposed.title}** · ${d.project_decomposed.subtask_count} sous-tâches<br>${subs}`;
    } else {
      summary = `❌ ${d.error ?? 'unknown'}`;
    }
    lines.push(`| ${i + 1} | ${r.label} | ${r.status} | ${r.elapsed}ms | ${summary} |`);
  });
  return lines.join('\n');
}

async function main() {
  if (!COOKIE) {
    console.error('Missing EVAL_COOKIE env var — obtain it from DevTools after login.');
    process.exit(1);
  }
  const rows: Awaited<ReturnType<typeof runOne>>[] = [];
  for (const p of PROMPTS) {
    console.log(`→ ${p.label}: ${p.prompt}`);
    const row = await runOne(p.prompt, p.label);
    rows.push(row);
    console.log(`  ${row.status} · ${row.elapsed}ms · ${row.body.project_decomposed ? `${row.body.project_decomposed.subtask_count} tâches` : row.body.pending_question ? 'pending' : row.body.error ?? 'no-result'}`);
  }

  const avg = Math.round(rows.reduce((a, r) => a + r.elapsed, 0) / rows.length);
  console.log(`\n—— Résumé ——`);
  console.log(`Temps moyen : ${avg}ms (cible < 8000ms)`);
  console.log(`Succès complets : ${rows.filter((r) => r.body.project_decomposed).length}/${rows.length}`);
  console.log(`Pending questions : ${rows.filter((r) => r.body.pending_question).length}/${rows.length}`);
  console.log(`Erreurs : ${rows.filter((r) => r.body.error).length}/${rows.length}`);

  console.log('\n—— Markdown report ——\n');
  console.log(toMarkdown(rows));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
