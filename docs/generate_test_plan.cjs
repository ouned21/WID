/**
 * Génère docs/PLAN_TESTS_PRE_BARBARA.xlsx
 * Plan exhaustif de tests manuels à effectuer avant d'impliquer Barbara.
 * Usage : node docs/generate_test_plan.cjs
 */
const XLSX = require('C:/Users/jonat/Downloads/wid-web/node_modules/xlsx');
const path = require('path');

const OUT = path.join(__dirname, 'PLAN_TESTS_PRE_BARBARA.xlsx');

// Colonnes: N°, Étape / Action, Résultat attendu, Statut, Note
const HEADERS = ['N°', 'Étape / Action', 'Résultat attendu', 'Statut', 'Note'];
const COLS = [{ wch: 5 }, { wch: 48 }, { wch: 56 }, { wch: 10 }, { wch: 32 }];

function sheet(rows) {
  const ws = XLSX.utils.aoa_to_sheet([HEADERS, ...rows]);
  ws['!cols'] = COLS;
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };
  return ws;
}

// ============ SHEETS ============

const intro = [
  ['0.1', 'Lire cette feuille avant de commencer', 'Comprendre la structure : 1 onglet = 1 flow. Statut : À faire / OK / KO.', '', ''],
  ['0.2', 'Environnement de test', 'Appareil A = téléphone Jonathan. Appareil B = téléphone Barbara (utilisé par Jonathan pour simuler).', '', ''],
  ['0.3', 'Pré-requis BDD', 'Reset propre (données user seulement, préserver onboarding_equipment / task_categories / task_templates).', '', ''],
  ['0.4', 'Clé API Anthropic', 'Vérifier qu\'elle est bien injectée dans Supabase Edge Function secrets.', '', ''],
  ['0.5', 'Service Worker', 'Ctrl+Shift+R sur chaque appareil avant de commencer (évite cache yova-v1 obsolète).', '', ''],
  ['0.6', 'Ordre recommandé', '1-Auth/Onboarding → 2-Dashboard/Score → 3-Tâches → 4-Planning → 5-Création → 6-Journal → 7-Fantôme → 8-2nd user → 9-Notifs → 10-Profil → 11-Edge cases.', '', ''],
  ['0.7', 'Légende Statut', 'Remplir "OK" si conforme, "KO" + note si problème, laisser vide si pas testé.', '', ''],
];

const authOnboarding = [
  // Inscription
  ['1.1', 'Ouvrir wid-eight.vercel.app sur appareil A', 'Landing page s\'affiche sans erreur.', '', ''],
  ['1.2', 'Cliquer "Commencer" / "S\'inscrire"', 'Redirige vers /register.', '', ''],
  ['1.3', 'Saisir email invalide (ex: "abc")', 'Message d\'erreur visible, inscription bloquée.', '', ''],
  ['1.4', 'Saisir mot de passe trop court', 'Message d\'erreur, inscription bloquée.', '', ''],
  ['1.5', 'S\'inscrire avec email+mdp valides', 'Compte créé, redirige vers création foyer ou onboarding.', '', ''],
  ['1.6', 'Vérifier en BDD : ligne dans auth.users + profiles', 'Les deux existent, id cohérents.', '', ''],
  // Login
  ['1.7', 'Se déconnecter puis retour /login', 'Page login accessible, champs vides.', '', ''],
  ['1.8', 'Login avec mauvais mdp', 'Erreur claire affichée.', '', ''],
  ['1.9', 'Login avec bonnes credentials', 'Retour sur dashboard avec session active.', '', ''],
  // Foyer
  ['1.10', 'Création du foyer (étape after register)', 'Nom du foyer saisissable, validation OK.', '', ''],
  ['1.11', 'Vérifier profiles.household_id rempli', 'Non null en BDD.', '', ''],
  // Onboarding équipements
  ['1.12', 'Étape 1/2 Équipements — voir les 29 items', 'Tous les équipements de onboarding_equipment s\'affichent.', '', ''],
  ['1.13', 'Sélectionner 5-10 équipements variés', 'Chips changent d\'état visuellement (sélectionnés).', '', ''],
  ['1.14', 'Désélectionner un équipement', 'Chip revient à l\'état non sélectionné.', '', ''],
  ['1.15', 'Valider sans rien sélectionner', 'Soit bloqué, soit avertissement clair.', '', ''],
  ['1.16', 'Valider avec sélection', 'Passe à l\'étape famille.', '', ''],
  // Onboarding famille
  ['1.17', 'Étape 2/2 Famille — ajouter 0 membre et valider', 'Foyer solo accepté, génération IA déclenchée.', '', ''],
  ['1.18', 'Retour en arrière, ajouter 1 fantôme', 'Ajout OK, pas de limite (mode test = illimité).', '', ''],
  ['1.19', 'Valider la famille', 'Écran "Yova analyse ton foyer" s\'affiche.', '', ''],
  ['1.20', 'Écran thinking — attendre < 35s', 'Passe à l\'écran résultats avec 15-25 tâches.', '', ''],
  ['1.21', 'Vérifier tâches générées par IA', 'Noms contextuels (ex: "Nettoyer filtre lave-vaisselle") — pas le fallback générique.', '', ''],
  ['1.22', 'Consommation Anthropic vérifiable', 'Crédits consommés visibles sur console Anthropic.', '', ''],
  ['1.23', 'Résultats : bouton supprimer (cercle rouge) sur tâche', 'Tâche disparaît instantanément de la liste.', '', ''],
  ['1.24', 'Résultats : Valider / Continuer', 'Redirige vers /planning ou dashboard.', '', ''],
  // Edge case
  ['1.25', 'Si Edge Function timeout > 35s', 'Fallback catalogue statique déclenché, 8-13 tâches créées. Jamais 0 tâche.', '', ''],
  ['1.26', 'Déconnexion immédiate après onboarding', 'Retour login, reconnexion donne accès à l\'état créé.', '', ''],
];

const dashboard = [
  ['2.1', 'Ouvrir /dashboard après login', 'Style "Score" (free) par défaut, pas le command.', '', ''],
  ['2.2', 'Vue Score — en-tête avec % global', 'Score foyer, nom mis en avant.', '', ''],
  ['2.3', 'Carte membres avec barres TEMPS + MENTAL', 'Barres visibles, % affichés, score composite à côté de chaque nom.', '', ''],
  ['2.4', 'Section "Non assignées"', 'Barres TEMPS + MENTAL du bucket non-assigné visibles.', '', ''],
  ['2.5', 'Bannière orange < 80% assigné', 'Visible si des tâches ne sont pas assignées. Tap → /tasks/assign.', '', ''],
  ['2.6', 'Insight "Yova a remarqué"', 'Texte d\'insight cohérent, CTA cliquable.', '', ''],
  ['2.7', 'CTA "Rééquilibrer →"', 'Pointe vers /tasks/rebalance.', '', ''],
  ['2.8', 'CTA "Assigner les tâches →"', 'Pointe vers /tasks/assign.', '', ''],
  ['2.9', 'Section "Par catégorie"', 'Barres par catégorie (cuisine, ménage…), sans icônes ✅⚠️🔴 (neutre).', '', ''],
  ['2.10', 'Section "Tendance 4 semaines"', 'Mini-barres par membre sur 4 semaines — labels "3 sem." / "2 sem." / "1 sem." / "Cette sem.".', '', ''],
  ['2.11', 'Section "Aujourd\'hui pour toi"', 'Liste tâches du jour, cliquables (ouvre bottom sheet).', '', ''],
  ['2.12', 'Section "7 prochains jours"', 'Affichée après "Aujourd\'hui".', '', ''],
  ['2.13', 'Bandeau "Parler à Yova" (premium)', 'Carte gradient violet/indigo visible, présence forte.', '', ''],
  ['2.14', 'Suggestion IA (bulle)', 'Proposition cohérente, boutons Accepter / Pas maintenant.', '', ''],
  ['2.15', 'Tap "Pas maintenant"', 'Suggestion disparaît, une nouvelle charge dans ~400ms (pas besoin de quitter la page).', '', ''],
  ['2.16', 'Tap "Accepter"', 'Tâche créée, nouvelle suggestion proposée.', '', ''],
  ['2.17', 'Feed du dashboard — lignes cliquables', 'Toute la ligne clique (pas juste "Voir →").', '', ''],
  ['2.18', '"Aujourd\'hui" → /tasks?filter=today', 'Filtre appliqué à l\'arrivée.', '', ''],
  ['2.19', '"Demain" → /planning?date=YYYY-MM-DD de demain', 'Ouvre directement sur le bon jour.', '', ''],
  ['2.20', '"Cette semaine" → /planning', 'Vue semaine.', '', ''],
];

const tasks = [
  ['3.1', 'Ouvrir /tasks', 'Filtre par défaut = "Toutes" (toutes les tâches du foyer). PAS "Mes tâches".', '', ''],
  ['3.2', 'Compte "AUJOURD\'HUI N" = compte planning pour aujourd\'hui', 'Les deux pages affichent le même nombre pour le même jour.', '', ''],
  ['3.3', 'Switcher chip "Mes tâches"', 'Filtre tâches assigned_to = moi OU non-assignées.', '', ''],
  ['3.4', 'Switcher chip "Toutes"', 'Toutes les tâches du foyer y compris celles de Barbara/fantômes.', '', ''],
  ['3.5', 'Filtre catégorie', 'Uniquement les tâches de la catégorie choisie.', '', ''],
  ['3.6', 'Sections : overdue / aujourd\'hui / demain / semaine / plus tard', 'Buckets corrects, tâches au bon endroit selon next_due_at.', '', ''],
  ['3.7', 'Tap sur une tâche', 'Ouvre /tasks/[id] (fiche détail).', '', ''],
  ['3.8', 'Fiche tâche — en-tête', 'Nom, catégorie, icône membre assigné.', '', ''],
  ['3.9', 'Score "Charge mentale X/10"', 'Label clair (pas juste "4/10 Premium"). Editable pour TOUS (pas de 🔒).', '', ''],
  ['3.10', 'Modifier charge mentale → select', 'Valeur sauve immédiatement (autoSave).', '', ''],
  ['3.11', 'Bouton ✓ Marquer comme fait', 'Crée une ligne dans task_completions, redirige ou toast de confirmation.', '', ''],
  ['3.12', 'Bouton 📅 Décaler → picker', 'Demain / +1 semaine / +1 mois.', '', ''],
  ['3.13', 'Décaler "Demain"', 'next_due_at = J+1 9h. Tâche bouge dans planning.', '', ''],
  ['3.14', 'Bouton Supprimer (cercle rouge)', 'Suppression optimiste, tâche disparaît instantanément.', '', ''],
  ['3.15', 'Section Historique (en dernier)', 'Liste des complétions passées pour cette tâche.', '', ''],
  ['3.16', 'PAS de bouton "Proposer un échange"', 'Feature supprimée — ne doit plus apparaître.', '', ''],
  ['3.17', 'Bouton retour (pill bleu chevron)', 'Design cohérent, retour à /tasks.', '', ''],
  // Historique
  ['3.18', 'Ouvrir /tasks/archived (Historique)', 'Liste des complétions (pas is_active=false).', '', ''],
  ['3.19', 'Filtrer/scroller dans l\'historique', 'Infos : nom tâche, qui l\'a fait, durée, note.', '', ''],
  // Assign
  ['3.20', 'Ouvrir /tasks/assign', 'Note "Assigner ≠ faire seul·e" en haut. Liste tâches non assignées.', '', ''],
  ['3.21', 'Assigner une tâche à un membre via chip', 'Maj optimiste UI puis sync DB.', '', ''],
  ['3.22', 'Supprimer une tâche depuis /tasks/assign', 'Retirée de la liste.', '', ''],
  ['3.23', 'Toutes tâches assignées', 'Bannière < 80% disparaît du dashboard.', '', ''],
  // Rebalance
  ['3.24', 'Ouvrir /tasks/rebalance', 'Carte score actuel visible, 3 propositions de swap.', '', ''],
  ['3.25', 'Tap sur un swap proposé', 'Tâche réassignée, score recalcule en live, aperçu avant/après.', '', ''],
  ['3.26', 'Après équilibrage (<10 pts d\'écart)', 'État "Équilibré" ou "Aucune suggestion".', '', ''],
];

const planning = [
  ['4.1', 'Ouvrir /planning', 'Vue semaine + aujourd\'hui présélectionné.', '', ''],
  ['4.2', 'Tap sur un autre jour', 'Liste de tâches de ce jour. Header affiche "X tâches · charge Y pts".', '', ''],
  ['4.3', '/planning?date=2026-04-25 en direct', 'Planning pré-sélectionne ce jour à l\'ouverture.', '', ''],
  ['4.4', 'Tap sur une tâche (zone gauche)', 'Ouvre TaskActionSheet (bottom sheet style iOS).', '', ''],
  ['4.5', 'Bottom sheet — actions disponibles', 'Marquer fait / Décaler / Supprimer / Voir détail.', '', ''],
  ['4.6', 'Bouton ✓ inline (zone droite)', 'Complétion directe sans ouvrir sheet. Tâche disparaît.', '', ''],
  ['4.7', 'Décaler depuis le bottom sheet', 'Panel Demain/+1sem/+1mois, tâche bouge.', '', ''],
  ['4.8', 'Supprimer (cercle rouge)', 'Suppression, tâche disparaît.', '', ''],
  ['4.9', 'Tâches des autres jours sont cliquables', 'Fix : toutes les dates, pas seulement aujourd\'hui.', '', ''],
  ['4.10', 'Section "Ton Planning" (bas de page)', 'Liste TaskCard cliquables (pas du texte inline).', '', ''],
  ['4.11', 'Cohérence avec /tasks', 'Même nombre de tâches aujourd\'hui dans /tasks et /planning.', '', ''],
  ['4.12', 'Doublon "Cuisiner repas du soir"', 'À nettoyer en BDD — vérifier qu\'il n\'y en a plus qu\'un après suppression.', '', ''],
];

const createTask = [
  ['5.1', 'Ouvrir /tasks/new', 'Formulaire simple : nom + date + bouton créer.', '', ''],
  ['5.2', 'Saisir nom + date', 'Champs fonctionnels.', '', ''],
  ['5.3', '"Options avancées ▾" visible (pas "Voir les détails")', 'Label correct.', '', ''],
  ['5.4', 'Déplier options avancées', 'Accordéon ouvre : Assignation fixe / Rappels / Date début différée / Score 4 axes.', '', ''],
  ['5.5', 'Icônes ⓘ sur chaque option', 'Tooltip/popover au tap.', '', ''],
  ['5.6', 'Score 4 axes dans options avancées', 'Sliders temps / physique / mental / impact.', '', ''],
  ['5.7', 'Créer une 1ère tâche', 'Passe à l\'écran d\'assignation.', '', ''],
  ['5.8', 'Header "1 TÂCHE EN ATTENTE" avec espace', 'Pas de "TÂCHEEN" collé.', '', ''],
  ['5.9', 'Foyer solo — écran assignation skippé', 'Auto-assigné au seul membre, pas de swipe.', '', ''],
  ['5.10', 'Foyer 2+ membres — liste boutons (pas swipe)', 'Boutons membres clairs + "Passer".', '', ''],
  ['5.11', 'Assigner à membre fantôme', 'Tâche bien assignée à phantom_member.', '', ''],
  ['5.12', 'Bouton "Assigner →" (pas "Plus de tâches →")', 'Label correct.', '', ''],
  ['5.13', 'Bouton "✓ Valider et terminer"', 'Sauvegarde + redirige /tasks. Permet de sortir sans créer plus.', '', ''],
  ['5.14', 'Message final "✅ Tâches créées !"', 'Bouton "Voir mes tâches" présent.', '', ''],
  ['5.15', 'Créer une tâche avec assignation fixe', 'is_fixed_assignment = true en BDD, pas de rotation.', '', ''],
  ['5.16', 'Créer tâche avec date différée', 'N\'apparaît pas avant la date.', '', ''],
];

const journal = [
  ['6.1', 'Ouvrir /journal', 'Page chat, bouton "Historique" visible (toggle).', '', ''],
  ['6.2', 'Historique affiché par défaut', 'Messages passés visibles à l\'ouverture.', '', ''],
  ['6.3', 'Toggle "Masquer / Historique"', 'Bascule fonctionne.', '', ''],
  ['6.4', 'Écrire un message simple', 'Message envoyé, Yova répond.', '', ''],
  ['6.5', 'Message évoquant une tâche ("j\'ai fait la vaisselle")', 'Tâche détectée, complétion créée, score bump.', '', ''],
  ['6.6', 'Crédits IA non limités (mode test)', 'Pas d\'erreur "limite atteinte" (FREE_AI_MONTHLY_LIMIT=9999).', '', ''],
  // Récap dimanche
  ['6.7', 'Ouvrir journal UN DIMANCHE', 'Carte dark gradient "Bilan de la semaine" visible en haut.', '', ''],
  ['6.8', 'Récap — barres par membre', 'Pourcentages cohérents avec la semaine écoulée.', '', ''],
  ['6.9', 'Récap — total complétions de la semaine', 'Chiffre visible et correct.', '', ''],
  ['6.10', 'Rouvrir journal même dimanche', 'Récap s\'affiche toujours (localStorage key yova_weekly_recap_DATE).', '', ''],
  ['6.11', 'Changer de semaine (simuler lundi)', 'Nouveau récap éligible pour le dimanche suivant.', '', ''],
  ['6.12', 'Simuler non-dimanche', 'Carte récap masquée.', '', ''],
];

const phantom = [
  ['7.1', 'Pendant onboarding — ajouter un membre fantôme "Papa"', 'Fantôme apparaît dans famille.', '', ''],
  ['7.2', 'Vérifier BDD : ligne dans phantom_members', 'household_id correct, is_phantom=true implicite.', '', ''],
  ['7.3', 'Post-onboarding : fantôme visible dans membres', 'Apparaît dans dashboard, /tasks/assign, etc.', '', ''],
  ['7.4', 'Assigner une tâche à un fantôme', 'assigned_to_phantom_id rempli, assigned_to null.', '', ''],
  ['7.5', 'Tâche fantôme visible dans planning', 'Nom fantôme affiché sur la tâche.', '', ''],
  ['7.6', 'Score foyer inclut le fantôme', 'Barres fantôme visibles dans dashboard.', '', ''],
  ['7.7', 'Historique — complétions par fantôme', 'Peut-on logger une complétion pour un fantôme ?', '', ''],
  ['7.8', 'Profil : ajouter/éditer/supprimer fantôme', 'Actions disponibles, cohérence foyer.', '', ''],
  ['7.9', 'Rééquilibrage avec fantôme', 'Algo prend en compte le fantôme comme membre.', '', ''],
  ['7.10', 'Transformer un fantôme en vrai user (si possible)', 'Flow de conversion — à documenter si absent.', '', ''],
];

const secondUser = [
  // Préparation
  ['8.1', 'Sur app A : créer un lien / code d\'invitation', 'Jonathan récupère un lien partage foyer.', '', ''],
  ['8.2', 'Noter le household_id et le lien', 'Pour pouvoir l\'utiliser sur l\'appareil B.', '', ''],
  // Inscription sur B
  ['8.3', 'Sur appareil B : ouvrir le lien d\'invitation', 'Landing ou écran join foyer.', '', ''],
  ['8.4', 'Créer compte Barbara (email différent)', 'Compte créé, associé automatiquement au foyer.', '', ''],
  ['8.5', 'Vérifier BDD : profiles Barbara avec household_id = celui de Jonathan', 'Correct.', '', ''],
  ['8.6', 'Barbara ne refait PAS l\'onboarding complet', 'Directe accès au dashboard du foyer existant.', '', ''],
  // Vues partagées
  ['8.7', 'Barbara voit les membres existants (Jonathan + fantômes)', 'Oui, avec leurs scores.', '', ''],
  ['8.8', 'Barbara voit les tâches assignées à Jonathan', 'Oui, en mode "Toutes".', '', ''],
  ['8.9', 'Barbara voit SES tâches (si déjà assignées)', 'Mode "Mes tâches" → uniquement les siennes + non-assignées.', '', ''],
  // Actions Barbara
  ['8.10', 'Barbara crée une tâche', 'Visible sur appareil A (Jonathan) après refresh.', '', ''],
  ['8.11', 'Barbara complète une tâche', 'Complétion visible côté Jonathan, score mis à jour.', '', ''],
  ['8.12', 'Barbara ouvre son journal', 'Journal indépendant (user_id = Barbara).', '', ''],
  // Interactions croisées
  ['8.13', 'Jonathan assigne une tâche à Barbara', 'Barbara voit la tâche dans "Mes tâches".', '', ''],
  ['8.14', 'Rééquilibrage entre Jonathan et Barbara', 'Page /tasks/rebalance propose des swaps.', '', ''],
  ['8.15', 'Conflit : les deux marquent la même tâche "fait" simultanément', 'Pas de double complétion. Idempotent ou gestion d\'erreur claire.', '', ''],
  ['8.16', 'Remplacement d\'un fantôme par Barbara', 'Si Barbara rejoint "à la place" du fantôme Papa — est-ce que les tâches fantôme migrent vers elle ? Documenter.', '', ''],
  // Dashboard
  ['8.17', 'Dashboard côté Barbara — sa contribution centrée', 'Elle voit son % en premier ? Ou score foyer global ?', '', ''],
  ['8.18', 'Score hebdo cohérent entre les 2 vues', 'Jonathan et Barbara voient les mêmes pourcentages.', '', ''],
  ['8.19', 'Suggestion IA différente selon l\'utilisateur', 'Contextualisée à la charge personnelle.', '', ''],
  // RLS
  ['8.20', 'Barbara essaie de voir les journaux de Jonathan', 'Bloqué par RLS (user_journals.user_id = auth.uid()).', '', ''],
  ['8.21', 'Barbara essaie de modifier household_tasks d\'un autre foyer', 'Bloqué par RLS.', '', ''],
  ['8.22', 'Barbara quitte le foyer', 'Scenario à documenter/implémenter.', '', ''],
];

const notifications = [
  ['9.1', 'Profil : activer "Rappels Yova"', 'Permission navigateur demandée, accordée.', '', ''],
  ['9.2', 'Label bouton correct', '"Rappels Yova — journal 21h · bilan dimanche 9h"', '', ''],
  ['9.3', 'Notif journal 21h', 'Titre "🤖 Qu\'est-ce que t\'as géré aujourd\'hui ?" pointe sur /journal.', '', ''],
  ['9.4', 'Notif dimanche 9h', 'Titre "📊 Bilan de la semaine" pointe sur /journal.', '', ''],
  ['9.5', 'Click notif → ouvre la bonne page', 'Deep link fonctionnel.', '', ''],
  ['9.6', 'Désactiver puis réactiver', 'Cycle fonctionnel sans bug.', '', ''],
  ['9.7', 'Fermer le navigateur puis attendre 21h', 'Notif arrive toujours (Service Worker).', '', ''],
  ['9.8', 'iOS : PWA installée — fiabilité background', 'Connue comme limitée — documenter si ça passe ou pas.', '', ''],
];

const profile = [
  ['10.1', 'Ouvrir /profile', 'Informations user + foyer.', '', ''],
  ['10.2', 'Sélecteur de style dashboard', '5 options : Score ⚖️ / Vivid 🚀 / Dark 💎 / Clean ⬜ / Galaxy ✨.', '', ''],
  ['10.3', 'Changer le style → vérifier sur dashboard', 'Visuel change immédiatement.', '', ''],
  ['10.4', 'Préférences créneau (multi-select)', 'Matin / Soir / Weekend / Peu importe — sélection multiple OK.', '', ''],
  ['10.5', '"Peu importe" efface les autres si sélectionné', 'Comportement correct.', '', ''],
  ['10.6', 'Tout décocher', 'Fallback sur "flexible".', '', ''],
  ['10.7', 'Sauvegarde des préférences', 'Persistent après refresh.', '', ''],
  ['10.8', 'Raccourcis : PAS de lien /exchanges', 'Supprimé, ne doit pas apparaître.', '', ''],
  ['10.9', 'Bouton notifications (voir onglet 9)', '', '', ''],
  ['10.10', 'Déconnexion', 'Redirige /login, session Supabase clearée.', '', ''],
  ['10.11', 'Suppression compte (RGPD)', 'Flow hard delete 30j documenté et fonctionnel.', '', ''],
  ['10.12', 'Export données', 'Si présent — last_export_at mis à jour.', '', ''],
  ['10.13', 'CGU / Privacy links', 'Pages /legal/cgu et /legal/privacy s\'ouvrent.', '', ''],
];

const edgeCases = [
  ['11.1', 'Offline — ouvrir l\'app sans réseau', 'Service Worker sert la dernière version en cache.', '', ''],
  ['11.2', 'Action offline (ex: marquer fait)', 'Erreur claire OU mise en queue.', '', ''],
  ['11.3', 'Revenir online', 'Sync correcte, pas de données perdues.', '', ''],
  ['11.4', 'Rotation téléphone portrait ↔ paysage', 'Pas de layout cassé.', '', ''],
  ['11.5', 'Refresh en plein onboarding thinking', 'Soit reprend, soit reset propre. Pas d\'état inconsistant.', '', ''],
  ['11.6', 'Deux onglets ouverts en parallèle', 'Actions d\'un onglet se répercutent après refresh de l\'autre.', '', ''],
  ['11.7', 'Session expirée', 'Redirige /login proprement, message clair.', '', ''],
  ['11.8', 'Suppression tâche déjà complétée', 'Comportement cohérent.', '', ''],
  ['11.9', 'Compléter une tâche déjà complétée (deux taps rapides)', 'Pas de double completion.', '', ''],
  ['11.10', 'Créer 50+ tâches', 'UI reste fluide, pas de bug perf.', '', ''],
  ['11.11', 'Noms tâches avec caractères spéciaux (émoji, quotes)', 'Sanitisé correctement, pas d\'injection.', '', ''],
  ['11.12', 'Tentative XSS dans nom tâche / journal', 'Echappée, pas de script exécuté.', '', ''],
  ['11.13', 'Rate limit journal IA (mode test = 9999)', 'Pas de blocage prématuré.', '', ''],
  ['11.14', 'Bouton retour navigateur après chaque flow', 'Historique cohérent, pas d\'état étrange.', '', ''],
  ['11.15', 'Deep link partagé /planning?date=2026-04-25', 'Ouverture directe fonctionne (+ auth redirect si déco).', '', ''],
  ['11.16', 'Installer PWA sur iOS et Android', 'Icône, splash screen, fonctionne offline-first.', '', ''],
  ['11.17', 'Console DevTools — aucune erreur rouge', 'Parcours complet sans erreur JS.', '', ''],
  ['11.18', 'Console — aucune erreur réseau 4xx/5xx inattendue', 'Propre.', '', ''],
  ['11.19', 'Lighthouse perf > 70', 'Mesure avant prod.', '', ''],
  ['11.20', 'Accessibilité : navigation au clavier', 'Tab/Enter fonctionnent sur actions principales.', '', ''],
];

// ============ BUILD WORKBOOK ============
const wb = XLSX.utils.book_new();
const sheets = [
  ['0 · Lisez-moi', intro],
  ['1 · Auth & Onboarding', authOnboarding],
  ['2 · Dashboard & Score', dashboard],
  ['3 · Tâches & Actions', tasks],
  ['4 · Planning', planning],
  ['5 · Création tâche', createTask],
  ['6 · Journal & Récap', journal],
  ['7 · Mode Fantôme', phantom],
  ['8 · 2e utilisateur (Barbara)', secondUser],
  ['9 · Notifications', notifications],
  ['10 · Profil & Réglages', profile],
  ['11 · Edge cases & régression', edgeCases],
];
for (const [name, rows] of sheets) {
  XLSX.utils.book_append_sheet(wb, sheet(rows), name);
}
XLSX.writeFile(wb, OUT);
const total = sheets.reduce((s, [, r]) => s + r.length, 0);
console.log(`✓ Écrit : ${OUT}`);
console.log(`  ${sheets.length} onglets, ${total} cas de test.`);
