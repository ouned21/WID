const XLSX = require('xlsx');

const wb = XLSX.utils.book_new();

// Feuille 1 : Timeline
const timeline = [
  ['Phase', 'Contenu', 'Duree estimee', 'Semaine cumulee', 'Statut'],
  ['Phase 1', 'Web app stable + Stripe', '2-3 semaines', 'Sem. 3', 'En cours'],
  ['Phase 2', 'Portage React Native / Expo', '6-10 semaines', 'Sem. 11', 'A venir'],
  ['Phase 3', 'Beta TestFlight', '2 semaines', 'Sem. 13', 'A venir'],
  ['Phase 4', 'Preparation App Store', '1 semaine', 'Sem. 14', 'A venir'],
  ['Phase 5', 'Soumission + Review Apple', '1-2 semaines', 'Sem. 16', 'A venir'],
  ['', '', '', '', ''],
  ['TOTAL', '', '~4 mois', 'Semaine 16', 'Objectif lancement'],
];
const ws1 = XLSX.utils.aoa_to_sheet(timeline);
ws1['!cols'] = [{wch:12},{wch:35},{wch:18},{wch:18},{wch:15}];
XLSX.utils.book_append_sheet(wb, ws1, 'Timeline');

// Feuille 2 : Taches
const tasks = [
  ['Phase', 'Tache', 'Priorite', 'Effort', 'Statut', 'Notes'],
  ['Phase 1 - Web', 'Finir les correctifs audit', 'CRITIQUE', 'Moyen', 'En cours', 'Agent en train de corriger'],
  ['Phase 1 - Web', 'Trouver + acheter le domaine', 'CRITIQUE', 'Faible', 'En cours', 'yova.app pris, chercher alternative'],
  ['Phase 1 - Web', 'Test complet Barbara', 'CRITIQUE', 'Faible', 'A faire', 'User test reel - remonter les bugs'],
  ['Phase 1 - Web', 'Corriger bugs Barbara', 'CRITIQUE', 'Variable', 'A faire', 'Depend du test'],
  ['Phase 1 - Web', 'Reactiver confirmation email Supabase', 'IMPORTANT', 'Tres faible', 'A faire', 'Desactive pour les tests'],
  ['Phase 1 - Web', 'Integrer Stripe', 'CRITIQUE', 'Eleve', 'A faire', 'Sans ca, 0 revenus'],
  ['Phase 1 - Web', 'Enforcer limites free (2 membres, quota IA)', 'IMPORTANT', 'Moyen', 'A faire', 'Paywall a implementer'],
  ['Phase 1 - Web', 'Mettre a jour domaine dans les metadonnees', 'MINEUR', 'Tres faible', 'A faire', 'Apres achat domaine'],
  ['Phase 2 - Native', 'Setup Expo + EAS', 'CRITIQUE', 'Faible', 'A faire', 'Compte Apple Developer deja actif'],
  ['Phase 2 - Native', 'Porter ecran Onboarding', 'CRITIQUE', 'Eleve', 'A faire', ''],
  ['Phase 2 - Native', 'Porter ecran Dashboard', 'CRITIQUE', 'Eleve', 'A faire', ''],
  ['Phase 2 - Native', 'Porter ecran Taches', 'CRITIQUE', 'Eleve', 'A faire', ''],
  ['Phase 2 - Native', 'Porter ecran Distribution / Analytics', 'IMPORTANT', 'Moyen', 'A faire', ''],
  ['Phase 2 - Native', 'Porter ecran Echanges', 'IMPORTANT', 'Moyen', 'A faire', ''],
  ['Phase 2 - Native', 'Porter ecran Profil', 'IMPORTANT', 'Moyen', 'A faire', ''],
  ['Phase 2 - Native', 'Porter ecran Upgrade / Paywall', 'CRITIQUE', 'Moyen', 'A faire', ''],
  ['Phase 2 - Native', 'Gestes natifs (swipe completer/supprimer)', 'IMPORTANT', 'Moyen', 'A faire', ''],
  ['Phase 2 - Native', 'Push notifications natives (APNs)', 'IMPORTANT', 'Moyen', 'A faire', ''],
  ['Phase 2 - Native', 'Auth Supabase + deep links iOS', 'CRITIQUE', 'Eleve', 'A faire', ''],
  ['Phase 2 - Native', 'Decision Stripe web vs Apple IAP', 'CRITIQUE', 'Faible', 'A faire', 'Apple prend 15-30% sur IAP'],
  ['Phase 2 - Native', 'Mode offline basique (queue locale)', 'IMPORTANT', 'Eleve', 'A faire', ''],
  ['Phase 3 - Beta', 'Build iOS via Expo EAS Build', 'CRITIQUE', 'Faible', 'A faire', ''],
  ['Phase 3 - Beta', 'Soumettre a TestFlight', 'CRITIQUE', 'Faible', 'A faire', ''],
  ['Phase 3 - Beta', 'Recruter 10-20 beta testeurs', 'CRITIQUE', 'Faible', 'A faire', 'Barbara + proches'],
  ['Phase 3 - Beta', 'Corriger bugs beta', 'CRITIQUE', 'Variable', 'A faire', ''],
  ['Phase 3 - Beta', 'Optimiser demarrage < 2 secondes', 'IMPORTANT', 'Moyen', 'A faire', ''],
  ['Phase 4 - App Store', 'Screenshots iPhone 6.5 + 5.5 pouces', 'CRITIQUE', 'Moyen', 'A faire', 'Obligatoires par Apple'],
  ['Phase 4 - App Store', 'Video de preview', 'MINEUR', 'Eleve', 'A faire', 'Optionnelle, booste conversions'],
  ['Phase 4 - App Store', 'Verifier nom disponible sur App Store', 'CRITIQUE', 'Tres faible', 'A faire', ''],
  ['Phase 4 - App Store', 'Description courte (170 car.)', 'CRITIQUE', 'Faible', 'A faire', ''],
  ['Phase 4 - App Store', 'Description longue (4000 car.)', 'CRITIQUE', 'Moyen', 'A faire', ''],
  ['Phase 4 - App Store', 'Mots-cles (100 car. max)', 'IMPORTANT', 'Faible', 'A faire', 'Taches menageres, couple, charge mentale'],
  ['Phase 4 - App Store', 'Categorie : Lifestyle ou Productivite', 'IMPORTANT', 'Tres faible', 'A faire', ''],
  ['Phase 4 - App Store', 'Age rating : 4+', 'CRITIQUE', 'Tres faible', 'A faire', ''],
  ['Phase 4 - App Store', 'Privacy policy URL', 'CRITIQUE', 'Tres faible', 'A faire', 'yova.app/legal/privacy'],
  ['Phase 4 - App Store', 'Prix + IAP configures', 'CRITIQUE', 'Moyen', 'A faire', ''],
  ['Phase 5 - Launch', 'Soumettre via App Store Connect', 'CRITIQUE', 'Faible', 'A faire', ''],
  ['Phase 5 - Launch', 'Review Apple (24h - 7 jours)', 'CRITIQUE', 'Faible', 'A faire', 'Prevoir 1 semaine'],
  ['Phase 5 - Launch', 'Corriger si rejet Apple', 'CRITIQUE', 'Variable', 'A faire', 'Causes : privacy, IAP, crashes'],
  ['Phase 5 - Launch', 'LAUNCH', 'CRITIQUE', '-', 'A faire', 'Objectif : dans ~4 mois'],
];
const ws2 = XLSX.utils.aoa_to_sheet(tasks);
ws2['!cols'] = [{wch:20},{wch:42},{wch:12},{wch:12},{wch:12},{wch:38}];
XLSX.utils.book_append_sheet(wb, ws2, 'Taches detaillees');

// Feuille 3 : Stripe vs IAP
const stripe = [
  ['Option', 'Commission Apple', 'UX', 'Complexite', 'Recommande ?', 'Description'],
  ['Apple IAP', '30% an 1 puis 15%', 'Native', 'Faible', 'Non', 'Obligatoire si abonnement in-app. Commission elevee.'],
  ['Stripe Web (Reader App)', '0%', 'Degradee', 'Faible', 'Moyen', "L'app ne propose pas d'IAP, redirige vers le web. Apple accepte."],
  ['Hybrid Stripe + Supabase', '0%', 'Bonne', 'Elevee', 'OUI (recommande)', "Abonnement cote web, l'app detecte le premium via Supabase."],
];
const ws3 = XLSX.utils.aoa_to_sheet(stripe);
ws3['!cols'] = [{wch:25},{wch:20},{wch:12},{wch:12},{wch:18},{wch:55}];
XLSX.utils.book_append_sheet(wb, ws3, 'Stripe vs IAP');

XLSX.writeFile(wb, 'C:/Users/jonat/Downloads/Yova_Roadmap_AppStore.xlsx');
console.log('Excel OK');
