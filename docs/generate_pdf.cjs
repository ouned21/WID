const PdfPrinter = require('pdfmake/src/printer');
const fs = require('fs');

const fonts = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

const printer = new PdfPrinter(fonts);

const BLUE = '#007AFF';
const MUTED = '#8E8E93';
const DARK = '#1C1C1E';

const dd = {
  defaultStyle: { font: 'Helvetica', fontSize: 10, lineHeight: 1.4 },
  pageSize: 'A4',
  pageMargins: [50, 60, 50, 50],

  header: (currentPage) => currentPage > 1 ? {
    text: 'FairShare — Spec Produit V2', alignment: 'right', fontSize: 8, color: MUTED, margin: [0, 20, 50, 0]
  } : null,

  footer: (currentPage, pageCount) => ({
    text: `Page ${currentPage} / ${pageCount}`, alignment: 'center', fontSize: 8, color: MUTED, margin: [0, 0, 0, 20]
  }),

  content: [
    // ===== COVER =====
    { text: '', margin: [0, 120, 0, 0] },
    { text: 'FAIRSHARE', fontSize: 36, bold: true, color: BLUE, alignment: 'center' },
    { text: 'Spec Produit V2', fontSize: 18, alignment: 'center', margin: [0, 10, 0, 20] },
    { text: '"Tu g\u00e8res tout dans ta t\u00eate ? On va le rendre visible."', fontSize: 12, italics: true, color: MUTED, alignment: 'center', margin: [0, 0, 0, 40] },
    { canvas: [{ type: 'line', x1: 150, y1: 0, x2: 350, y2: 0, lineWidth: 1, lineColor: '#E0E0E0' }], margin: [0, 0, 0, 40] },
    { text: 'Avril 2026', fontSize: 11, color: MUTED, alignment: 'center' },
    { text: 'Document confidentiel', fontSize: 10, color: '#FF3B30', alignment: 'center', margin: [0, 5, 0, 0] },
    { text: '', pageBreak: 'after' },

    // ===== TABLE DES MATIERES =====
    { text: 'Table des mati\u00e8res', fontSize: 20, bold: true, margin: [0, 0, 0, 15] },
    { text: '1. Vision Produit', fontSize: 11, margin: [0, 3] },
    { text: '2. Architecture Technique', fontSize: 11, margin: [0, 3] },
    { text: '3. Fonctionnalit\u00e9s', fontSize: 11, margin: [0, 3] },
    { text: '4. Mon\u00e9tisation', fontSize: 11, margin: [0, 3] },
    { text: '5. Roadmap', fontSize: 11, margin: [0, 3] },
    { text: '6. \u00c9tude de March\u00e9', fontSize: 11, margin: [0, 3] },
    { text: '7. Strat\u00e9gie d\u2019Acquisition', fontSize: 11, margin: [0, 3] },
    { text: '8. Design System', fontSize: 11, margin: [0, 3] },
    { text: '', pageBreak: 'after' },

    // ===== 1. VISION =====
    { text: '1. Vision Produit', fontSize: 20, bold: true, color: DARK, margin: [0, 0, 0, 15] },

    { text: '1.1 Mission', fontSize: 14, bold: true, color: BLUE, margin: [0, 10, 0, 5] },
    'FairShare est la premi\u00e8re application qui mesure le poids r\u00e9el des t\u00e2ches domestiques \u2014 pas juste le temps pass\u00e9, mais la charge mentale, l\u2019effort physique, l\u2019impact sur le foyer, et la fr\u00e9quence. Elle rend visible l\u2019invisible pour permettre aux couples et familles de r\u00e9\u00e9quilibrer leur quotidien.',

    { text: '1.2 Promesse', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { text: '\u00ab Tu g\u00e8res tout dans ta t\u00eate ? On va le rendre visible. \u00bb', italics: true, color: MUTED },

    { text: '1.3 Cible principale', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'Femmes 25-45 ans en couple avec ou sans enfants',
      'Sensibles \u00e0 la notion de charge mentale',
      'Utilisatrices mobiles (iOS/Android, web-first en V1)',
      'Niveau tech : utilisatrices d\u2019apps courantes (Instagram, WhatsApp)',
    ]},

    { text: '1.4 Diff\u00e9renciation', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'Algorithme de scoring multi-axes unique (temps + physique + mental 6 dimensions + impact)',
      'Onboarding r\u00e9volutionnaire par \u00e9quipements et enfants',
      'Assignation par swipe (style Tinder)',
      'Mode \u00ab membre fant\u00f4me \u00bb pour utiliser l\u2019app seul(e)',
      'G\u00e9n\u00e9ration automatique de sous-t\u00e2ches',
      'IA int\u00e9gr\u00e9e (Claude API) pour suggestions proactives',
    ]},

    { text: '', pageBreak: 'after' },

    // ===== 2. ARCHITECTURE =====
    { text: '2. Architecture Technique', fontSize: 20, bold: true, color: DARK, margin: [0, 0, 0, 15] },

    { text: '2.1 Stack technique', fontSize: 14, bold: true, color: BLUE, margin: [0, 10, 0, 8] },
    {
      table: {
        headerRows: 1, widths: ['30%', '70%'],
        body: [
          [{ text: 'Composant', bold: true, fillColor: '#D5E8F0' }, { text: 'Technologie', bold: true, fillColor: '#D5E8F0' }],
          ['Frontend', 'Next.js 16 (App Router, React 19)'],
          ['Styling', 'Tailwind CSS 4'],
          ['State', 'Zustand (6 stores)'],
          ['Backend', 'Supabase (PostgreSQL, Auth, RLS, Realtime)'],
          ['H\u00e9bergement', 'Vercel (auto-deploy GitHub)'],
          ['IA', 'Claude API (suggestions, sous-t\u00e2ches, r\u00e9sum\u00e9s)'],
          ['Notifications', 'Web Push API (V1), Native Push (V2)'],
          ['Format', 'PWA installable (V1), React Native (V2)'],
        ],
      },
      layout: 'lightHorizontalLines',
    },

    { text: '2.2 Base de donn\u00e9es', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 8] },
    {
      table: {
        headerRows: 1, widths: ['25%', '75%'],
        body: [
          [{ text: 'Table', bold: true, fillColor: '#D5E8F0' }, { text: 'Description', bold: true, fillColor: '#D5E8F0' }],
          ['profiles', 'Utilisateurs, display_name, household_id, role, vacation_mode, target_share_percent'],
          ['households', 'Foyers, invite_code, created_by'],
          ['phantom_members', 'Membres fant\u00f4mes (sans compte), display_name, linked_profile_id'],
          ['household_tasks', 'T\u00e2ches : scores dual (user_score /10, global_score /36), is_fixed_assignment, notifications_enabled, estimated_cost'],
          ['task_completions', 'Historique : completed_by, completed_by_phantom_id, completed_at'],
          ['task_categories', '13 cat\u00e9gories (Nettoyage \u00e0 Transport)'],
          ['task_templates', '93+ templates enrichis (scoring_category, typical_time, description)'],
          ['task_associations', '~200 associations (\u00e9v\u00e9nements, \u00e9quipements, enfants, packs)'],
          ['onboarding_equipment', '29 \u00e9quipements s\u00e9lectionnables'],
          ['task_exchanges', 'Propositions d\u2019\u00e9change entre membres'],
        ],
      },
      layout: 'lightHorizontalLines',
    },

    { text: '2.3 Algorithme de scoring', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'Le score global est calcul\u00e9 sur 4 axes :',
    { ul: [
      { text: [{ text: 'Temps (1-8) : ', bold: true }, 'bas\u00e9 sur la dur\u00e9e estim\u00e9e'] },
      { text: [{ text: 'Physique (0-5) : ', bold: true }, 'aucun, l\u00e9ger, moyen, intense'] },
      { text: [{ text: 'Charge mentale (0-18) : ', bold: true }, '6 sous-dimensions (anticipation, cons\u00e9quence si oubli\u00e9, interruption, d\u00e9cision, rigidit\u00e9, responsabilit\u00e9)'] },
      { text: [{ text: 'Impact foyer (1-4) : ', bold: true }, '\u00e0 quel point le foyer est affect\u00e9'] },
    ]},
    { text: 'Formule : (T\u00d71.0) + (P\u00d70.8) + (M\u00d71.5) + (I\u00d71.0), normalis\u00e9 /36, affich\u00e9 /10.', margin: [0, 5, 0, 0] },
    { text: [{ text: 'Score dual : ', bold: true }, 'user_score (0-10, choix utilisateur via slider) pour l\u2019affichage. global_score (0-36, algo) pour les comparaisons.'], margin: [0, 5, 0, 0] },

    { text: '', pageBreak: 'after' },

    // ===== 3. FONCTIONNALITES =====
    { text: '3. Fonctionnalit\u00e9s', fontSize: 20, bold: true, color: DARK, margin: [0, 0, 0, 15] },

    { text: '3.1 Onboarding r\u00e9volutionnaire', fontSize: 14, bold: true, color: BLUE, margin: [0, 10, 0, 5] },
    { text: 'KILLER FEATURE', fontSize: 9, color: '#FF3B30', bold: true, margin: [0, 0, 0, 5] },
    { text: '\u00c9cran 1 \u2014 "Ton logement"', bold: true, margin: [0, 5, 0, 3] },
    'Grille de 29 \u00e9quipements cliquables en 7 cat\u00e9gories (cuisine, salle de bain, linge, sols, ext\u00e9rieur, v\u00e9hicule, animaux). Chaque s\u00e9lection g\u00e9n\u00e8re les t\u00e2ches d\u2019entretien associ\u00e9es.',
    { text: '\u00c9cran 2 \u2014 "Ta famille"', bold: true, margin: [0, 8, 0, 3] },
    'Enfants par tranche d\u2019\u00e2ge : 0-2 ans (couches, biberons), 3-5 ans (\u00e9cole, go\u00fbter), 6-12 ans (devoirs, activit\u00e9s), 13+ (orientation, argent de poche).',
    { text: '\u00c9cran 3 \u2014 "C\u2019est pr\u00eat"', bold: true, margin: [0, 8, 0, 3] },
    'R\u00e9sum\u00e9 : "On a cr\u00e9\u00e9 X t\u00e2ches pour ton foyer".',
    { text: '\u00c9cran 4 \u2014 Assignation par swipe', bold: true, margin: [0, 8, 0, 3] },
    'Pile de cartes style Tinder. Swipe gauche \u2192 membre A. Swipe droite \u2192 membre B. Skip \u2192 pool non assign\u00e9.',

    { text: '3.2 Cr\u00e9ation de t\u00e2che', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'Nom avec autocompl\u00e9tion (93+ templates)',
      'Cat\u00e9gorie auto-d\u00e9tect\u00e9e par mots-cl\u00e9s',
      'Dur\u00e9e, effort physique, fr\u00e9quence, assignation',
      'Score : slider 0-10 pr\u00e9-rempli par l\u2019algo, ajustable',
      'Options : assignation fixe/variable, rappels on/off',
      'Apr\u00e8s validation : suggestions de sous-t\u00e2ches automatiques',
    ]},

    { text: '3.3 FAB + (Floating Action Button)', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'Bouton rond bleu "+" permanent sur toutes les pages. Cr\u00e9ation rapide avec brouillons sauvegard\u00e9s en localStorage. Rappels aux moments strat\u00e9giques (midi, 17h, 21h).',

    { text: '3.4 Liste des t\u00e2ches', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'Cartes avec score /10, jauges Mental et Temps, sections temporelles (En retard, Aujourd\u2019hui, Demain, Semaine, Plus tard). Bouton FAIT + bouton fant\u00f4me pour compl\u00e9ter au nom d\u2019un membre sans compte.',

    { text: '3.5 R\u00e9cap du soir', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    '4 sections cochables : tes t\u00e2ches, aussi fait aujourd\u2019hui ?, suggestions (templates), texte libre. Batch completion en 15 secondes. Notification push \u00e0 21h.',

    { text: '3.6 Planning / Calendrier', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'Remplace Boost dans la navigation. Vue semaine (colonnes, blocs color\u00e9s par cat\u00e9gorie) + vue mois (points color\u00e9s). Score total par jour. Cr\u00e9ation depuis le planning. Indicateur de jours surcharg\u00e9s.',

    { text: '3.7 Membre fant\u00f4me', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'Membre sans compte, ajout depuis le profil (pr\u00e9nom). Assignable, compl\u00e9table "au nom de", pr\u00e9sent dans les stats. Exclu des \u00e9changes. Rattachable \u00e0 un vrai compte plus tard.',

    { text: '3.8 Dashboard', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    '3 styles (Vivid/Dark/Clean). Score /10, tendance, stats, \u00e9quilibre foyer, top 3 priorit\u00e9s. Lien r\u00e9cap du soir apr\u00e8s 17h.',

    { text: '3.9 \u00c9changes de t\u00e2ches', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'Moteur de suggestions. Swap uniquement sur les t\u00e2ches variables (is_fixed_assignment = false). Fant\u00f4mes exclus.',

    { text: '3.10 R\u00e9\u00e9quilibrage automatique', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'D\u00e9tection des pics de charge (jour > 2x la moyenne). Proposition de d\u00e9calage des t\u00e2ches variables.',

    { text: '3.11 IA int\u00e9gr\u00e9e', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 8] },
    {
      table: {
        headerRows: 1, widths: ['20%', '55%', '25%'],
        body: [
          [{ text: 'Fonction', bold: true, fillColor: '#D5E8F0' }, { text: 'Description', bold: true, fillColor: '#D5E8F0' }, { text: 'Priorit\u00e9', bold: true, fillColor: '#D5E8F0' }],
          ['Sous-t\u00e2ches', '"Anniversaire L\u00e9a" \u2192 5-8 sous-t\u00e2ches positionn\u00e9es', 'P1'],
          ['Suggestions soir', 'Analyse habitudes \u2192 suggestions personnalis\u00e9es', 'P1'],
          ['Cat\u00e9gorisation', 'Comprend le contexte pour scorer', 'P2'],
          ['R\u00e9\u00e9quilibrage', 'Optimise le planning', 'P2'],
          ['R\u00e9sum\u00e9 hebdo', '"Barbara a port\u00e9 68% du score..."', 'P3'],
        ],
      },
      layout: 'lightHorizontalLines',
    },

    { text: '', pageBreak: 'after' },

    // ===== 4. MONETISATION =====
    { text: '4. Mon\u00e9tisation', fontSize: 20, bold: true, color: DARK, margin: [0, 0, 0, 15] },

    { text: 'Gratuit', fontSize: 14, bold: true, color: '#34C759', margin: [0, 10, 0, 5] },
    { ul: [
      'Toutes les fonctionnalit\u00e9s core',
      '1 foyer, membres illimit\u00e9s',
      'Templates de base (93+)',
      '\u00c9changes de t\u00e2ches',
    ]},

    { text: 'Premium (~3-5\u20ac/mois ou packs ponctuels)', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'Pack D\u00e9m\u00e9nagement (17 t\u00e2ches)',
      'Pack Mariage (15 t\u00e2ches)',
      'Pack B\u00e9b\u00e9 arrive (11 t\u00e2ches)',
      'Pack Rentr\u00e9e scolaire (7 t\u00e2ches)',
      'IA avanc\u00e9e : r\u00e9sum\u00e9s hebdo, r\u00e9\u00e9quilibrage intelligent',
      'Statistiques avanc\u00e9es',
    ]},

    // ===== 5. ROADMAP =====
    { text: '5. Roadmap', fontSize: 20, bold: true, color: DARK, margin: [0, 30, 0, 15] },

    { text: 'V1 \u2014 Web PWA (actuel)', fontSize: 14, bold: true, color: BLUE, margin: [0, 10, 0, 5] },
    { ul: [
      '\u2713 Auth + foyer + invitation',
      '\u2713 Score dual (slider utilisateur + algo)',
      '\u2713 Dashboard 3 styles',
      '\u2713 R\u00e9cap du soir (batch completion)',
      '\u2713 Membre fant\u00f4me',
      '\u2713 13 cat\u00e9gories, 93+ templates, ~200 associations',
      '\u2713 FAB +, autocompl\u00e9tion, fixe/variable',
      '\u25a1 Vue planning / calendrier',
      '\u25a1 Onboarding \u00e9quipements/enfants + swipe',
      '\u25a1 Suggestions sous-t\u00e2ches',
      '\u25a1 R\u00e9\u00e9quilibrage automatique',
      '\u25a1 Notifications push web',
      '\u25a1 Enrichir templates \u00e0 500+',
    ]},

    { text: 'V2 \u2014 App native + IA', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'React Native (iOS + Android)',
      'IA : sous-t\u00e2ches, suggestions, r\u00e9sum\u00e9 hebdo',
      'Packs projets premium',
      'Rattachement fant\u00f4me \u2192 vrai compte',
    ]},

    { text: 'V3 \u2014 Croissance', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'Int\u00e9gration Google/Apple Calendar',
      'Widget iOS/Android',
      'Multi-foyer (garde altern\u00e9e)',
    ]},

    { text: '', pageBreak: 'after' },

    // ===== 6. ETUDE MARCHE =====
    { text: '6. \u00c9tude de March\u00e9', fontSize: 20, bold: true, color: DARK, margin: [0, 0, 0, 15] },

    { text: '6.1 March\u00e9', fontSize: 14, bold: true, color: BLUE, margin: [0, 10, 0, 5] },
    { ul: [
      'March\u00e9 apps t\u00e2ches domestiques : ~500M$ en 2025, croissance 15%/an',
      '71% de la charge mentale port\u00e9e par les m\u00e8res (Universit\u00e9 de Bath, 2025)',
      '63% des femmes estiment faire plus que leur part vs 22% des hommes',
      'Un syst\u00e8me structur\u00e9 via app r\u00e9duit les disputes de 60% en 3 mois',
    ]},

    { text: '6.2 Concurrence', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 8] },
    {
      table: {
        headerRows: 1, widths: ['25%', '35%', '40%'],
        body: [
          [{ text: 'App', bold: true, fillColor: '#D5E8F0' }, { text: 'Force', bold: true, fillColor: '#D5E8F0' }, { text: 'Faiblesse vs FairShare', bold: true, fillColor: '#D5E8F0' }],
          ['Sweepy (2M+ DL)', 'IA pr\u00e9dictive', 'M\u00e9nage uniquement'],
          ['Nipto (500K DL)', 'Gamification, +40% initiative', 'Buggy, basique'],
          ['Cozi (10M+ DL)', 'Tr\u00e8s install\u00e9', 'Pas de scoring'],
          ['FairChore', 'Gratuit, dette/cr\u00e9dit', 'Pas de scoring multi-axes'],
          ['EvenUS', 'Finances + t\u00e2ches', 'Trop large'],
          ['Cupla (1M DL)', '-75% stress', 'Pas de r\u00e9\u00e9quilibrage'],
        ],
      },
      layout: 'lightHorizontalLines',
    },

    // ===== 7. ACQUISITION =====
    { text: '7. Strat\u00e9gie d\u2019Acquisition', fontSize: 20, bold: true, color: DARK, margin: [0, 30, 0, 15] },

    { text: 'SEO', fontSize: 14, bold: true, color: BLUE, margin: [0, 10, 0, 5] },
    '99 mots-cl\u00e9s positionn\u00e9s. Mots-cl\u00e9s transactionnels prioritaires : "application charge mentale", "appli partage t\u00e2ches m\u00e9nag\u00e8res", "charge mentale couple solution".',

    { text: 'Influenceurs', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      '@taspensea (206K followers) \u2014 Priorit\u00e9 absolue',
      'Emma (emmaclit.com) \u2014 "Fallait demander", r\u00e9f\u00e9rence nationale',
      'Titiou Lecoq \u2014 France Info, auteure "Lib\u00e9r\u00e9es !"',
    ]},

    { text: 'M\u00e9dias', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'Cheek Magazine, Terrafemina, Rockie Mag (ont d\u00e9j\u00e0 couvert des apps similaires)',
      'Podcasts : Bliss Stories, La Matrescence, M\u00e8re...Credi !',
    ]},

    { text: 'Partenariats', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    { ul: [
      'Th\u00e9rapeutes de couple (ANCCEF, Resalib)',
      'Contexte favorable : sant\u00e9 mentale "Grande Cause Nationale" 2025-2026',
    ]},

    { text: '', pageBreak: 'after' },

    // ===== 8. DESIGN =====
    { text: '8. Design System', fontSize: 20, bold: true, color: DARK, margin: [0, 0, 0, 15] },

    { text: 'Principes', fontSize: 14, bold: true, color: BLUE, margin: [0, 10, 0, 5] },
    { ul: [
      'iOS-first : cartes blanches, coins arrondis, ombres l\u00e9g\u00e8res',
      'Touch-friendly : minimum 44x44px',
      'Ton empathique, pas gamifi\u00e9',
      'Design neutre, pas genr\u00e9',
    ]},

    { text: 'Couleurs', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 8] },
    {
      table: {
        headerRows: 1, widths: ['25%', '25%', '50%'],
        body: [
          [{ text: 'Token', bold: true, fillColor: '#D5E8F0' }, { text: 'Valeur', bold: true, fillColor: '#D5E8F0' }, { text: 'Usage', bold: true, fillColor: '#D5E8F0' }],
          ['blue', '#007AFF', 'Accent principal, liens, boutons'],
          ['green', '#34C759', 'Succ\u00e8s, scores bas, bouton FAIT'],
          ['orange', '#FF9500', 'Scores moyens, alertes'],
          ['red', '#FF3B30', 'Scores \u00e9lev\u00e9s, erreurs'],
          ['bg', '#F6F8FF', 'Fond de page'],
          ['text', '#1C1C1E', 'Texte principal'],
          ['textMuted', '#8E8E93', 'Texte secondaire'],
        ],
      },
      layout: 'lightHorizontalLines',
    },

    { text: 'Typographie', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 8] },
    {
      table: {
        headerRows: 1, widths: ['30%', '70%'],
        body: [
          [{ text: 'Taille', bold: true, fillColor: '#D5E8F0' }, { text: 'Usage', bold: true, fillColor: '#D5E8F0' }],
          ['40px black', 'Score hero (dashboard)'],
          ['28px bold', 'Titre de page'],
          ['18px semibold', 'Titre de section'],
          ['15px regular', 'Corps de texte'],
          ['12px regular', 'Labels, l\u00e9gendes'],
          ['10px regular', 'Micro-texte, badges'],
        ],
      },
      layout: 'lightHorizontalLines',
    },

    { text: 'Espacement', fontSize: 14, bold: true, color: BLUE, margin: [0, 15, 0, 5] },
    'Syst\u00e8me 8px : 8px (xs), 12px (sm), 16px (md), 24px (lg), 32px (xl).',
  ],
};

const pdfDoc = printer.createPdfKitDocument(dd);
const stream = fs.createWriteStream('C:\\Users\\jonat\\Downloads\\wid-web\\docs\\FairShare_Spec_V2.pdf');
pdfDoc.pipe(stream);
pdfDoc.end();
stream.on('finish', () => console.log('OK: PDF created'));
