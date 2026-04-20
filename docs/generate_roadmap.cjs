/**
 * Génère docs/ROADMAP.xlsx — state-of-the-union Yova.
 * Source de vérité unique : ce qui est fait, ce qui attend, ce qu'on reporte.
 * Usage : node docs/generate_roadmap.cjs
 */
const XLSX = require('C:/Users/jonat/Downloads/wid-web/node_modules/xlsx');
const path = require('path');

const OUT = path.join(__dirname, 'ROADMAP.xlsx');

const HEADERS = ['N°', 'Item', 'Détail', 'Statut', 'Priorité', 'Note'];
const COLS = [{ wch: 5 }, { wch: 40 }, { wch: 60 }, { wch: 10 }, { wch: 10 }, { wch: 24 }];

function sheet(rows) {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = COLS;
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

// Statut : Fait | En cours | À faire
// Priorité : P0 (critique) | P1 (important) | P2 (bonus)

// ═══════════════════════════════════════════════════════════════════════
// ONGLET 1 : Prêt à tester (Fait)
// ═══════════════════════════════════════════════════════════════════════
const ready = [
  ['1.1', 'BDD propre', 'Reset user data : 29 équipements, 13 catégories, 456 templates, 185 associations (dont 43 packs).', 'Fait', 'P0', ''],
  ['1.2', 'Onboarding IA', 'Claude Haiku via Supabase Edge Function (150s timeout). Fallback catalogue statique si IA échoue.', 'Fait', 'P0', ''],
  ['1.3', 'Dashboard Score unique', 'Skins Vivid/Dark/Clean/Galaxy supprimés. Score est le seul skin.', 'Fait', 'P0', ''],
  ['1.4', 'Page Tâches refonte', 'Chips Portée + Horizon, liste 1 col, label "Charge", icône 👻 Pour… claire, breakdown du header.', 'Fait', 'P0', ''],
  ['1.5', 'Planning', 'Bottom sheet iOS, toutes les dates cliquables, deep-link ?date=YYYY-MM-DD.', 'Fait', 'P0', ''],
  ['1.6', 'Création tâche', 'Options avancées repliées, ⓘ tooltips, foyer solo auto-assigné (pas de swipe).', 'Fait', 'P0', ''],
  ['1.7', 'Journal + récap dimanche', 'Toggle historique, récap hebdo en carte gradient les dimanches.', 'Fait', 'P0', ''],
  ['1.8', 'Notifications', 'Rappels Yova : journal 21h + bilan dimanche 9h.', 'Fait', 'P0', ''],
  ['1.9', 'Catalogue de tâches', '/tasks/catalog unique (Packs Déménagement/Mariage/Bébé fusionnés). Filtres Tout/Disponibles/Installées. Catégories repliables.', 'Fait', 'P0', ''],
  ['1.10', 'Tap ligne catalogue', 'Tâche installée → fiche détail. Disponible → /tasks/new pré-rempli.', 'Fait', 'P1', ''],
  ['1.11', 'Statistiques /distribution', 'Score cumulé = charge COMPLÉTÉE (pas assignée). Seuil 5 complétions avant tendance. Badge Déséquilibre → /tasks/rebalance.', 'Fait', 'P0', ''],
  ['1.12', 'Profil refonte', 'Fondateur foyer, Associer fantôme, tap-copy code, jours Di Lu Ma Me Je Ve Sa, objectif dynamique selon nb membres, accordéon RGPD.', 'Fait', 'P0', ''],
  ['1.13', 'Renouveler code d\'invitation', 'Admin uniquement. Ancien code invalidé, membres existants non affectés.', 'Fait', 'P1', ''],
  ['1.14', 'IA journal scope strict', 'Refuse relationnel/santé/juridique/psy/décisions de vie. Détection projet logistique + création tâches datées. Défense anti-injection renforcée.', 'Fait', 'P0', ''],
  ['1.15', 'Décomposition auto des tâches', 'À la création, Claude détecte les tâches complexes et propose des sous-tâches. Écran review auto avec tout coché. Brand Yova (✨ + gradient).', 'Fait', 'P1', ''],
  ['1.16', 'Plan de test PLAN_TESTS_PRE_BARBARA.xlsx', '13 onglets, 245 cas dont 53 cause-effet (action → vérification sur pages impactées).', 'Fait', 'P0', ''],
  ['1.17', 'Nettoyage code legacy', '23 fichiers obsolètes supprimés (FairShare/Aura/skins morts/utils orphelins). -5308 lignes.', 'Fait', 'P1', ''],
  ['1.18', 'Page /score supprimée', 'Doublon de /distribution. Redirections corrigées.', 'Fait', 'P1', ''],
];

// ═══════════════════════════════════════════════════════════════════════
// ONGLET 2 : À développer (Features prévues pas encore branchées)
// ═══════════════════════════════════════════════════════════════════════
const toDevelop = [
  ['2.1', 'Wire up /api/ai/anticipate', 'Endpoint d\'anticipation proactive (tâches à venir, rappels). Route existe côté serveur. Brancher au dashboard : appel hebdomadaire qui affiche une carte "Yova anticipe : X tâches vont arriver cette semaine".', 'À faire', 'P1', 'User insistait dessus'],
  ['2.2', 'Wire up /api/ai/insights', 'Insights IA hebdomadaires (version Premium de ce que DashboardFree fait côté client). Brancher au dashboard derrière gate Premium.', 'À faire', 'P2', ''],
  ['2.3', 'Wire up /api/ai/weekly-summary', 'Version IA enrichie du récap dimanche (actuellement stats pures côté client). Remplacer la carte récap dans /journal par appel Claude.', 'À faire', 'P2', ''],
  ['2.4', 'UX subtasks : refiner', 'La décomposition auto est active. Tester le comportement sur 5-10 tâches variées. Ajuster le seuil de Claude (3+ sous-tâches min). Ajouter analytics : combien de fois l\'écran s\'affiche, combien sont créées vs passées.', 'À faire', 'P2', ''],
  ['2.5', 'Présenter subtasks dans /tasks/catalog', 'Quand un template est ajouté via catalogue, vérifier que la décomposition auto se déclenche aussi (pas seulement via /tasks/new).', 'À faire', 'P2', ''],
];

// ═══════════════════════════════════════════════════════════════════════
// ONGLET 3 : Dette technique (à traiter avant V1 publique)
// ═══════════════════════════════════════════════════════════════════════
const tech = [
  ['3.1', 'Fix 22 "as unknown as never"', 'Hacks TypeScript autour de getHouseholdPreferences et assimilés. Retyper proprement. ~30-45 min. Risque régression, à faire post-test Barbara.', 'À faire', 'P2', 'Post-Barbara'],
  ['3.2', 'DROP TABLE task_exchanges', 'Feature supprimée du code mais table encore en base. Migration SQL + virer la purge défensive dans /api/account/delete.', 'À faire', 'P2', 'Schema cleanup'],
  ['3.3', 'Tests E2E', 'Cypress ou Playwright. Zéro test actuellement (vitest configuré mais seulement 2 fichiers).', 'À faire', 'P1', ''],
  ['3.4', 'TypeScript strict', 'Activer "strict": true dans tsconfig et corriger les retombées.', 'À faire', 'P2', ''],
  ['3.5', 'Accessibilité ARIA', 'Attributs aria-label sur actions principales, navigation clavier, focus visible.', 'À faire', 'P2', ''],
  ['3.6', 'Performance', 'Lazy loading composants, optimisation images, Lighthouse > 80.', 'À faire', 'P2', ''],
  ['3.7', 'Monitoring Sentry', 'Aucune alerte sur erreurs prod actuellement. Intégrer Sentry + alertes Slack.', 'À faire', 'P1', ''],
];

// ═══════════════════════════════════════════════════════════════════════
// ONGLET 4 : Avant lancement commercial
// ═══════════════════════════════════════════════════════════════════════
const preLaunch = [
  ['4.1', 'Réactiver freemium gates', 'grep -r "TODO: réactiver" → 3 points à modifier : FREE_AI_MONTHLY_LIMIT, requirePremium, atFreeLimit onboarding.', 'À faire', 'P0', 'Marqués en TODO'],
  ['4.2', 'Stripe', 'Aucun système de paiement. Intégrer Stripe Checkout + webhooks + renouvellement.', 'À faire', 'P0', ''],
  ['4.3', 'Email confirmation', 'Désactivé pour les tests. Réactiver côté Supabase Auth.', 'À faire', 'P0', ''],
  ['4.4', 'Domaine', 'yova.app pris. Alternative : yova.fr, yova.co, essayer yovahome.com.', 'À faire', 'P0', ''],
  ['4.5', 'Relecture CGU + Privacy', 'Pages existent. Relecture juridique avant lancement.', 'À faire', 'P1', ''],
  ['4.6', 'Hard delete 30j RGPD', 'Politique de rétention à vérifier / automatiser via cron Supabase.', 'À faire', 'P1', ''],
  ['4.7', 'Tester flow export', 'Valider /api/user/export-data de bout en bout (download JSON complet).', 'À faire', 'P1', ''],
  ['4.8', 'Landing page marketing', 'Remplacer la landing actuelle (technique) par une vraie landing produit avec pricing/CTA.', 'À faire', 'P0', ''],
];

// ═══════════════════════════════════════════════════════════════════════
// ONGLET 5 : Phase 2 (après lancement)
// ═══════════════════════════════════════════════════════════════════════
const phase2 = [
  ['5.1', 'React Native / Expo', 'Portage natif iOS/Android pour App Store + Play Store.', 'À faire', 'P1', 'Phase 2'],
  ['5.2', 'Gamification tamagochi', 'Abandonnée V1, à reconsidérer selon feedback utilisateurs.', 'À faire', 'P2', ''],
  ['5.3', 'Push notifications natives', 'Actuellement PWA (iOS background peu fiable). Nécessite portage natif.', 'À faire', 'P1', 'Lié 5.1'],
  ['5.4', 'Intégration calendrier', 'Google Cal, Apple Cal. Synchro bidirectionnelle.', 'À faire', 'P2', ''],
  ['5.5', 'Multi-foyers', 'Permettre à un user d\'appartenir à plusieurs foyers (parents séparés, colocations multiples).', 'À faire', 'P2', ''],
  ['5.6', 'Invitations email', 'Envoyer un lien avec code d\'invitation par email (pas juste partager le code à la main).', 'À faire', 'P2', ''],
];

// ═══════════════════════════════════════════════════════════════════════
// ONGLET 6 : Principes de design produit
// ═══════════════════════════════════════════════════════════════════════
const principles = [
  ['6.1', 'Scope IA strict', 'L\'IA traite la logistique domestique UNIQUEMENT. Refuse relationnel/santé/juridique/psy/décisions de vie.', 'Actif', '', ''],
  ['6.2', 'Score = charge portée', 'Pas charge assignée. Barbara arrive à 0, pas à 59. L\'app récompense ce qu\'on fait, pas ce qu\'on prévoit.', 'Actif', '', ''],
  ['6.3', 'Assigner ≠ faire seul·e', 'Note pédagogique dans l\'onboarding et /tasks/assign. La charge mentale inclut "y penser", même si on le fait à deux.', 'Actif', '', ''],
  ['6.4', 'Données insuffisantes', 'Seuil 5 complétions avant d\'afficher des tendances. Évite les faux signaux "+2 vs période précédente".', 'Actif', '', ''],
  ['6.5', 'Onboarding unique', 'Rite d\'initiation non-rejouable. Gestion continue du catalogue via /tasks/catalog.', 'Actif', '', ''],
  ['6.6', 'Pas de gamification infantile', 'Pas de badges, pas de niveaux, pas de streaks. L\'équilibre est l\'objectif, pas le score.', 'Actif', '', ''],
  ['6.7', 'Révélation progressive', 'Options avancées repliées par défaut. L\'utilisateur qui débute ne voit que l\'essentiel.', 'Actif', '', ''],
  ['6.8', 'IA = auto + review', 'Pas de bouton "lance l\'IA". L\'IA travaille seule, l\'utilisateur voit le résultat et arbitre.', 'Actif', '', ''],
];

// ═══════════════════════════════════════════════════════════════════════
// ONGLET 0 : Lisez-moi
// ═══════════════════════════════════════════════════════════════════════
const intro = [
  ['0.1', 'Structure', 'Un onglet = une catégorie. 6 statuts : Fait / En cours / À faire / Actif. Priorité P0 (critique) > P1 (important) > P2 (bonus).', '', '', ''],
  ['0.2', 'Ordre de lecture', '1-Prêt (où on est) → 2-À développer (proche) → 3-Dette tech (moyen terme) → 4-Pré-launch (avant vente) → 5-Phase 2 (après launch) → 6-Principes (le pourquoi).', '', '', ''],
  ['0.3', 'Mise à jour', 'Régénérer avec : node docs/generate_roadmap.cjs. Source : le .cjs, pas le .xlsx (qui est généré).', '', '', ''],
  ['0.4', 'Statut actuel', 'On est prêt à tester avec Barbara. Le plan de test est dans docs/PLAN_TESTS_PRE_BARBARA.xlsx (245 cas, 13 onglets).', '', '', ''],
];

// ═══════════════════════════════════════════════════════════════════════
// BUILD
// ═══════════════════════════════════════════════════════════════════════
const wb = XLSX.utils.book_new();
const sheets = [
  ['0 · Lisez-moi', intro],
  ['1 · Prêt à tester', ready],
  ['2 · À développer', toDevelop],
  ['3 · Dette technique', tech],
  ['4 · Avant launch', preLaunch],
  ['5 · Phase 2', phase2],
  ['6 · Principes produit', principles],
];
for (const [name, rows] of sheets) {
  XLSX.utils.book_append_sheet(wb, sheet(rows), name);
}
XLSX.writeFile(wb, OUT);
const total = sheets.reduce((s, [, r]) => s + r.length, 0);
console.log(`Ecrit : ${OUT}`);
console.log(`  ${sheets.length} onglets, ${total} items.`);
