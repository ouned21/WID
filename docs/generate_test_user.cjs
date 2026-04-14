const XLSX = require('xlsx');

const tests = [
  // ── PREMIER LANCEMENT ──
  ['01','P0','Premier lancement','Créer un compte','Va sur l\'app → clique "Créer mon compte" → entre ton prénom, un email, un mot de passe fort → valide','Tu vois un message "Vérifie tes emails"','',''],
  ['02','P0','Premier lancement','Se connecter','Clique "Se connecter" → entre email + mdp','Tu arrives sur la page "Créer ou rejoindre un foyer"','',''],
  ['03','P0','Premier lancement','Créer un foyer','Clique "Créer un foyer" → tape un nom (ex: "Chez nous") → valide','Tu arrives sur la page Onboarding avec les équipements','',''],
  ['04','P0','Premier lancement','Sélectionner tes équipements','Coche tout ce que tu as chez toi (four, frigo, lave-vaisselle, etc.) → clique Suivant','Tu arrives sur l\'écran "Ta famille"','',''],
  ['05','P0','Premier lancement','Ajouter un enfant','Clique "Oui j\'ai des enfants" → entre un prénom + âge → clique "Générer les tâches"','Tu vois "X tâches créées" avec un nombre > 20','',''],
  ['06','P0','Premier lancement','Assigner les tâches','Pour chaque carte, clique sur ton nom ou celui de Barbara → ou clique "Passer"','Les tâches défilent une par une → à la fin tu arrives sur /tasks','',''],

  // ── TÂCHES ──
  ['07','P0','Tâches','Voir la liste des tâches','Clique sur l\'onglet "Tâches" en bas','Tu vois les tâches classées par date : En retard, Aujourd\'hui, Demain, etc.','',''],
  ['08','P0','Tâches','Créer une tâche','Clique le bouton bleu "Nouvelle" en haut → tape "Nettoyer la salle de bain" → choisis une durée → valide','La tâche apparaît dans la liste','',''],
  ['09','P0','Tâches','Auto-détection catégorie','Quand tu tapes "école" dans le nom, regarde si la catégorie "Enfants" se sélectionne automatiquement','Un badge "Détecté auto" apparaît à côté de la catégorie','',''],
  ['10','P1','Tâches','Autocomplétion','Tape "Net" dans le nom de la tâche et attends','Une liste déroulante propose des tâches pré-enregistrées (Nettoyer le four, etc.)','',''],
  ['11','P0','Tâches','Ajuster le score','Quand tu crées une tâche, regarde le slider "Score" → déplace-le de 5 à 8','Le chiffre change, et un texte "Algo suggère 5/10" apparaît avec un bouton Restaurer','',''],
  ['12','P0','Tâches','Compléter une tâche','Sur une tâche dans la liste, clique le bouton vert "FAIT"','La carte devient verte avec un ✓ pendant 1 seconde puis disparaît','',''],
  ['13','P0','Tâches','Supprimer une tâche','Clique l\'icône poubelle rouge sur une tâche → confirme','La tâche disparaît définitivement','',''],
  ['14','P1','Tâches','Voir le détail','Clique sur le nom d\'une tâche (pas sur FAIT)','Tu arrives sur une page avec tous les détails : nom, fréquence, assigné, historique','',''],
  ['15','P1','Tâches','Modifier une tâche','Sur la page détail, change le nom et clique ailleurs','Tu vois "✓ Sauvegardé" en haut','',''],
  ['16','P1','Tâches','Archiver une tâche','Sur la page détail, clique "📁 Archiver" → confirme','La tâche disparaît de la liste active','',''],
  ['17','P1','Tâches','Restaurer une archive','Va dans Tâches → "📁 Voir les tâches archivées" → clique "Restaurer"','La tâche réapparaît dans la liste active','',''],
  ['18','P0','Tâches','Rechercher','Tape "cuisine" dans la barre de recherche en haut de la liste','Seules les tâches contenant "cuisine" apparaissent','',''],
  ['19','P1','Tâches','Filtre Mes tâches / Toutes','Clique "Mes tâches" puis "Toutes"','Le nombre de tâches change selon le filtre','',''],

  // ── SOUS-TÂCHES AUTOMATIQUES ──
  ['20','P0','Sous-tâches','Sous-tâches anniversaire','Crée une tâche "Anniversaire Léa" → valide','Après la création, un écran propose des sous-tâches : cadeau, gâteau, invitations, etc.','',''],
  ['21','P1','Sous-tâches','Accepter les sous-tâches','Laisse les cases cochées → clique "Créer X sous-tâches"','Les sous-tâches apparaissent dans la liste des tâches','',''],
  ['22','P1','Sous-tâches','Refuser les sous-tâches','Clique "Passer" au lieu de créer','Aucune sous-tâche créée, tu reviens à la liste','',''],

  // ── FAB + (BOUTON BLEU ROND) ──
  ['23','P0','FAB +','Bouton visible partout','Navigue entre Accueil, Tâches, Planning, Profil','Le bouton bleu "+" est visible en bas à droite sur chaque page','',''],
  ['24','P0','FAB +','Création rapide','Clique le "+" → tape "Courses Lidl" → appuie sur Entrée','Tu arrives sur le formulaire de création avec "Courses Lidl" déjà écrit','',''],
  ['25','P1','FAB +','Brouillon sauvé','Clique le "+" → tape "Dentiste Hugo" → ferme en cliquant à côté','Rouvre le formulaire de création → "Dentiste Hugo" est pré-rempli','',''],

  // ── RÉCAP DU SOIR ──
  ['26','P0','Récap soir','Accéder au récap','Dans la liste des tâches, clique la carte "🌙 Ma journée"','Tu vois 4 sections : Tes tâches, Aussi fait, Suggestions, Autre chose','',''],
  ['27','P0','Récap soir','Cocher des tâches','Coche 3 tâches dans les différentes sections','Le bouton "Terminé (3)" en bas montre le bon compteur','',''],
  ['28','P0','Récap soir','Valider le récap','Clique "Terminé (3)"','Écran de succès "3 tâches enregistrées" puis redirect vers le dashboard','',''],
  ['29','P1','Récap soir','Tâches déjà faites','Si tu as déjà complété des tâches aujourd\'hui, regarde si elles apparaissent grisées et barrées','Les tâches faites sont pré-cochées et non cliquables','',''],
  ['30','P1','Récap soir','Texte libre','Tape "Rangé le garage" dans le champ "Autre chose" → coche → Terminé','La tâche est enregistrée comme quick log','',''],

  // ── PLANNING ──
  ['31','P0','Planning','Voir le planning','Clique l\'onglet "Planning" en bas','Tu vois la semaine en cours avec les tâches positionnées par jour','',''],
  ['32','P0','Planning','Naviguer dans le temps','Clique "Suiv. →" pour voir la semaine prochaine, puis "← Préc." pour revenir','Les dates changent correctement','',''],
  ['33','P1','Planning','Vue mois','Clique le bouton "Mois" en haut à droite','Tu vois un calendrier mensuel avec des points colorés sur les jours qui ont des tâches','',''],
  ['34','P1','Planning','Créer depuis le planning','Clique le petit "+" sur un jour précis','Le formulaire de création s\'ouvre avec cette date pré-remplie','',''],
  ['35','P1','Planning','Rééquilibrage','Si un jour est en rouge (surchargé), regarde en bas s\'il y a une suggestion "Décaler"','La suggestion propose de déplacer une tâche vers un jour plus léger','',''],

  // ── DASHBOARD ──
  ['36','P0','Dashboard','Voir le dashboard','Clique l\'onglet "Accueil" en bas','Tu vois ton score /10, tes stats, l\'équilibre du foyer','',''],
  ['37','P1','Dashboard','Score correct','Compare le score affiché avec le total de tes tâches','Le score /10 correspond au poids de tes tâches assignées','',''],
  ['38','P1','Dashboard','Barres d\'équilibre','Regarde la section "Équilibre du foyer"','Chaque membre (toi, Barbara, fantômes) a une barre proportionnelle','',''],
  ['39','P1','Dashboard','Top 3 priorités','Regarde les 3 tâches les plus lourdes','Ce sont bien les tâches avec les scores les plus élevés','',''],
  ['40','P1','Dashboard','Changer le style','Va dans Profil → change le style dashboard (Vivid/Dark/Clean) → retourne au dashboard','Le style a changé et persiste après un refresh de la page','',''],

  // ── MEMBRE FANTÔME ──
  ['41','P0','Fantôme','Ajouter un fantôme','Va dans Profil → en bas de la liste des membres, clique "+" → tape "Jonathan" → Ajouter','Jonathan apparaît avec un 👻 dans la liste','',''],
  ['42','P0','Fantôme','Assigner une tâche au fantôme','Crée une nouvelle tâche → dans le dropdown "Assigner à", choisis "👻 Jonathan"','La tâche est créée et assignée à Jonathan','',''],
  ['43','P0','Fantôme','Compléter pour le fantôme','Sur une tâche dans la liste, clique le petit bouton "👤" → choisis "👻 Jonathan"','La tâche est complétée au nom de Jonathan','',''],
  ['44','P1','Fantôme','Stats du fantôme','Va dans Distribution → regarde les barres de répartition','Jonathan apparaît avec sa part de complétions','',''],
  ['45','P1','Fantôme','Dashboard du fantôme','Va dans le Dashboard → regarde les barres d\'équilibre','Jonathan apparaît dans les barres','',''],
  ['46','P0','Fantôme','Supprimer le fantôme','Va dans Profil → clique "Retirer" à côté de Jonathan → confirme','Jonathan disparaît, ses tâches deviennent "non assigné"','',''],

  // ── ÉCHANGES ──
  ['47','P0','Échanges','Proposer un échange','Va dans Profil → Échanges → "Proposer" → choisis un membre, une tâche à donner, une tâche à recevoir → valide','La proposition apparaît dans "Mes propositions"','',''],
  ['48','P0','Échanges','Accepter un échange (autre user)','Connecte-toi avec l\'autre compte → va dans Échanges → clique "Accepter"','Les 2 tâches sont swappées (tu as celle de l\'autre et inversement)','',''],
  ['49','P1','Échanges','Refuser un échange','Clique "Refuser" sur une proposition reçue','La proposition disparaît','',''],
  ['50','P1','Échanges','Tâche fixe non échangeable','Crée une tâche avec "Assignation fixe" activée → essaie de l\'échanger','La tâche n\'apparaît PAS dans le dropdown "Je donne"','',''],

  // ── PROFIL ──
  ['51','P0','Profil','Voir le profil','Clique l\'onglet "Profil" en bas','Tu vois ton nom, ton rôle, tes stats, les membres du foyer','',''],
  ['52','P1','Profil','Objectif répartition','Déplace le slider "Je vise X% des tâches" → note la valeur → refresh la page','La valeur est conservée après le refresh','',''],
  ['53','P1','Profil','Mode vacances','Active le mode vacances → confirme → va dans Tâches','Tes tâches sont masquées, un bandeau "Mode vacances" apparaît','',''],
  ['54','P1','Profil','Désactiver vacances','Désactive le mode vacances → confirme → va dans Tâches','Tes tâches réapparaissent','',''],
  ['55','P1','Profil','Copier le code invitation','Clique sur le code d\'invitation (6 lettres)','Un message "Copié !" apparaît, tu peux coller le code ailleurs','',''],
  ['56','P0','Profil','Déconnexion','Clique "Se déconnecter" → confirme','Tu es redirigé vers la page de connexion','',''],

  // ── MULTI-UTILISATEUR (avec Barbara) ──
  ['57','P0','Multi-user','Barbara rejoint le foyer','Sur un autre navigateur, inscris Barbara → entre le code d\'invitation → rejoint le foyer','Barbara voit les mêmes tâches que toi','',''],
  ['58','P0','Multi-user','Tu crées une tâche → Barbara la voit','Crée une tâche de ton côté → regarde l\'écran de Barbara','La tâche apparaît en temps réel chez Barbara sans refresh','',''],
  ['59','P0','Multi-user','Barbara complète → tu vois','Barbara clique FAIT sur une tâche → regarde ton écran','La tâche disparaît en temps réel de ton côté','',''],
  ['60','P1','Multi-user','Échange entre vous','Propose un échange à Barbara → Barbara accepte','Les tâches sont swappées des deux côtés','',''],
  ['61','P1','Multi-user','Stats cohérentes','Les 2 regardent la page Distribution','Les pourcentages et barres sont identiques','',''],

  // ── SECOND COMPTE (INVITÉ) ──
  ['62','P0','Invitation','Inviter quelqu\'un','Donne le code d\'invitation à Barbara → elle crée un compte et le tape','Barbara rejoint le foyer et voit tout','',''],

  // ── LANDING PAGE ──
  ['63','P1','Landing','Page publique','Va sur l\'app en navigation privée (sans être connecté)','Tu vois la page d\'accueil avec le hero, les features, le CTA','',''],
  ['64','P1','Landing','Bouton inscription','Clique "Commencer gratuitement"','Tu arrives sur la page d\'inscription','',''],

  // ── RESPONSIVE MOBILE ──
  ['65','P1','Mobile','Navigation mobile','Ouvre l\'app sur ton téléphone (ou DevTools 375px)','Les 4 onglets sont lisibles, le contenu ne dépasse pas','',''],
  ['66','P1','Mobile','Formulaire création','Crée une tâche sur mobile','Tous les champs sont accessibles, le slider fonctionne','',''],
  ['67','P1','Mobile','Planning mobile','Ouvre le planning sur mobile','Les 7 colonnes sont lisibles (texte petit mais lisible)','',''],
  ['68','P1','Mobile','Récap mobile','Ouvre le récap du soir sur mobile','Les checkboxes sont assez grandes pour les doigts (≥44px)','',''],

  // ── EDGE CASES ──
  ['69','P1','Edge case','Caractères spéciaux','Crée une tâche avec le nom "Café crème à l\'école 🎒"','La tâche s\'affiche correctement avec les accents et l\'emoji','',''],
  ['70','P1','Edge case','0 tâches','Supprime toutes tes tâches → regarde le dashboard et le planning','Aucun crash, messages vides appropriés','',''],
  ['71','P1','Edge case','Tâche en retard','Crée une tâche avec une date d\'hier','Elle apparaît dans la section "En retard" en rouge','',''],
  ['72','P1','Edge case','Compléter 2 fois la même tâche','Complète la même tâche quotidienne 2 fois','2 entrées dans l\'historique, la date avance 2 fois','',''],
];

const wb = XLSX.utils.book_new();
const headers = ['#', 'Priorité', 'Section', 'Test', 'Comment tester (1 phrase)', 'Ce qui doit se passer', 'Ce qui se passe vraiment', 'OK / KO'];

const data = [headers, ...tests];

const ws = XLSX.utils.aoa_to_sheet(data);

ws['!cols'] = [
  { wch: 4 },   // #
  { wch: 7 },   // Priorité
  { wch: 14 },  // Section
  { wch: 30 },  // Test
  { wch: 65 },  // Comment tester
  { wch: 50 },  // Ce qui doit se passer
  { wch: 30 },  // Ce qui se passe vraiment
  { wch: 8 },   // OK / KO
];

XLSX.utils.book_append_sheet(wb, ws, 'Tests Utilisateur');

XLSX.writeFile(wb, 'C:\\Users\\jonat\\Downloads\\wid-web\\docs\\FairShare_Test_Utilisateur.xlsx');
console.log(`OK: ${tests.length} tests utilisateur`);
