#!/usr/bin/env node
/**
 * reset-db.js — Reset complet de la base Supabase
 * Usage : npm run db:reset
 *
 * Prérequis dans .env.local :
 *   NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx  ← supabase.com/dashboard/account/tokens
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// ── Lire .env.local ───────────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  if (!fs.existsSync(envPath)) throw new Error('.env.local introuvable');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=\s][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}

// ── Confirmation ──────────────────────────────────────────────────────────────
function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (a) => { rl.close(); resolve(a.trim()); });
  });
}

// ── Exécuter SQL via Supabase Management API ──────────────────────────────────
async function runQuery(projectRef, accessToken, sql) {
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query: sql }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err}`);
  }
  return res.json().catch(() => ({}));
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🤖  Aura — Reset base de données Supabase\n');

  const env = loadEnv();
  const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
  const accessToken = env['SUPABASE_ACCESS_TOKEN'];

  if (!supabaseUrl) {
    console.error('❌  NEXT_PUBLIC_SUPABASE_URL manquant dans .env.local');
    process.exit(1);
  }
  if (!accessToken || accessToken.startsWith('#') || accessToken === 'sbp_xxxx') {
    console.error('❌  SUPABASE_ACCESS_TOKEN manquant dans .env.local');
    console.error('   → Va sur https://supabase.com/dashboard/account/tokens');
    console.error('   → Crée un token, colle-le dans .env.local :');
    console.error('     SUPABASE_ACCESS_TOKEN=sbp_...\n');
    process.exit(1);
  }

  // Extraire le project ref depuis l'URL
  const projectRef = supabaseUrl.replace('https://', '').split('.')[0];

  const sqlFile = path.join(ROOT, 'supabase', 'RESET_FULL.sql');
  if (!fs.existsSync(sqlFile)) throw new Error('supabase/RESET_FULL.sql introuvable');

  const sql = fs.readFileSync(sqlFile, 'utf8');

  console.log(`📋  Fichier : supabase/RESET_FULL.sql`);
  console.log(`🔗  Projet  : ${projectRef}\n`);
  console.log('⚠️   ATTENTION — toutes les données seront supprimées.\n');

  const answer = await ask('Tape OUI pour confirmer → ');
  if (answer !== 'OUI') {
    console.log('\n❌  Annulé.\n');
    process.exit(0);
  }

  console.log('\n⏳  Reset en cours...\n');

  try {
    await runQuery(projectRef, accessToken, sql);
    console.log('✅  Reset terminé avec succès !');
    console.log('📌  Tu peux recréer ton compte sur l\'app.\n');
  } catch (err) {
    // L'API peut timeout sur de gros SQL — essayer en morceaux
    console.log('⚠️   Envoi en bloc échoué, tentative par parties...\n');

    const parts = [
      'reset_part1_drop_et_base.sql',
      'reset_part2a_tables.sql',
      'reset_part2b_onboarding.sql',
      'reset_part3_ai_fonctions_vues.sql',
      'add_task_associations.sql',
    ];

    for (const part of parts) {
      const partPath = path.join(ROOT, 'supabase', part);
      if (!fs.existsSync(partPath)) { console.log(`  ⚠️  ${part} introuvable, ignoré`); continue; }
      process.stdout.write(`  ▶  ${part}... `);
      try {
        await runQuery(projectRef, accessToken, fs.readFileSync(partPath, 'utf8'));
        console.log('✓');
      } catch (e) {
        console.log('✗');
        console.error(`     Erreur : ${e.message}\n`);
        process.exit(1);
      }
    }

    console.log('\n✅  Reset terminé avec succès !');
    console.log('📌  Tu peux recréer ton compte sur l\'app.\n');
  }
}

main().catch((err) => {
  console.error('\n❌  Erreur :', err.message, '\n');
  process.exit(1);
});
