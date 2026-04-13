const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat,
  TableOfContents
} = require("docx");

// Colors
const BLUE = "007AFF";
const GREEN = "34C759";
const ORANGE = "FF9500";
const RED = "FF3B30";
const DARK = "1C1C1E";
const MUTED = "8E8E93";
const LIGHT_BG = "F0F2F8";
const WHITE = "FFFFFF";
const HEADER_BG = "D5E8F0";

// Helpers
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };

function h1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text, bold: true, size: 32, font: "Arial", color: DARK })] });
}
function h2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text, bold: true, size: 26, font: "Arial", color: BLUE })] });
}
function h3(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 120 }, children: [new TextRun({ text, bold: true, size: 22, font: "Arial", color: DARK })] });
}
function p(text, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, size: 21, font: "Arial", color: DARK, ...opts })] });
}
function bold(text) {
  return new TextRun({ text, size: 21, font: "Arial", color: DARK, bold: true });
}
function normal(text) {
  return new TextRun({ text, size: 21, font: "Arial", color: DARK });
}
function muted(text) {
  return new TextRun({ text, size: 19, font: "Arial", color: MUTED, italics: true });
}
function para(...runs) {
  return new Paragraph({ spacing: { after: 120 }, children: runs });
}
function bullet(text, ref = "bullets", level = 0) {
  return new Paragraph({ numbering: { reference: ref, level }, spacing: { after: 60 }, children: [new TextRun({ text, size: 21, font: "Arial" })] });
}
function bulletBold(boldText, normalText, ref = "bullets", level = 0) {
  return new Paragraph({ numbering: { reference: ref, level }, spacing: { after: 60 }, children: [
    new TextRun({ text: boldText, size: 21, font: "Arial", bold: true }),
    new TextRun({ text: normalText, size: 21, font: "Arial" }),
  ] });
}

function makeRow(cells, isHeader = false) {
  return new TableRow({
    children: cells.map((text, i) => new TableCell({
      borders,
      margins: cellMargins,
      width: { size: Math.floor(9360 / cells.length), type: WidthType.DXA },
      shading: isHeader ? { fill: HEADER_BG, type: ShadingType.CLEAR } : undefined,
      children: [new Paragraph({ children: [new TextRun({ text: String(text), size: 19, font: "Arial", bold: isHeader, color: DARK })] })],
    })),
  });
}

function makeTable(headers, rows) {
  const colCount = headers.length;
  const colWidth = Math.floor(9360 / colCount);
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: Array(colCount).fill(colWidth),
    rows: [makeRow(headers, true), ...rows.map(r => makeRow(r))],
  });
}

function separator() {
  return new Paragraph({ spacing: { before: 200, after: 200 }, border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: LIGHT_BG.replace("#",""), space: 1 } }, children: [] });
}

// =====================================================
// DOCUMENT
// =====================================================

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 32, bold: true, font: "Arial" }, paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 26, bold: true, font: "Arial", color: BLUE }, paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, font: "Arial" }, paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      ]},
      { reference: "numbers", levels: [
        { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
      { reference: "checks", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u2713", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
      { reference: "unchecks", levels: [
        { level: 0, format: LevelFormat.BULLET, text: "\u25A1", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      ]},
    ],
  },
  sections: [
    // ===== COVER PAGE =====
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({ spacing: { before: 3000 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: "FAIRSHARE", size: 72, bold: true, font: "Arial", color: BLUE })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Spec Produit V2", size: 36, font: "Arial", color: DARK })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "Tu g\u00e8res tout dans ta t\u00eate ? On va le rendre visible.", size: 24, font: "Arial", color: MUTED, italics: true })] }),
        separator(),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 }, children: [new TextRun({ text: "Avril 2026", size: 22, font: "Arial", color: MUTED })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Document confidentiel", size: 19, font: "Arial", color: RED })] }),
        new PageBreak(),
      ],
    },
    // ===== TOC =====
    {
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "FairShare \u2014 Spec V2", size: 16, font: "Arial", color: MUTED })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Page ", size: 16, font: "Arial", color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], size: 16, font: "Arial", color: MUTED })] })] }) },
      children: [
        h1("Table des mati\u00e8res"),
        p("1. Vision Produit"),
        p("2. Architecture Technique"),
        p("3. Fonctionnalit\u00e9s"),
        p("4. Mon\u00e9tisation"),
        p("5. Roadmap"),
        p("6. \u00c9tude de March\u00e9"),
        p("7. Strat\u00e9gie d\u2019Acquisition"),
        p("8. Design System"),
        new PageBreak(),

        // ===== 1. VISION =====
        h1("1. Vision Produit"),
        h2("1.1 Mission"),
        p("FairShare est la premi\u00e8re application qui mesure le poids r\u00e9el des t\u00e2ches domestiques \u2014 pas juste le temps pass\u00e9, mais la charge mentale, l\u2019effort physique, l\u2019impact sur le foyer, et la fr\u00e9quence. Elle rend visible l\u2019invisible pour permettre aux couples et familles de r\u00e9\u00e9quilibrer leur quotidien."),

        h2("1.2 Promesse"),
        para(muted("\u00AB Tu g\u00e8res tout dans ta t\u00eate ? On va le rendre visible. \u00BB")),

        h2("1.3 Cible principale"),
        bullet("Femmes 25-45 ans en couple avec ou sans enfants"),
        bullet("Sensibles \u00e0 la notion de charge mentale"),
        bullet("Utilisatrices mobiles (iOS/Android, web-first en V1)"),
        bullet("Niveau tech : utilisatrices d\u2019apps courantes (Instagram, WhatsApp)"),

        h2("1.4 Positionnement concurrentiel"),
        p("FairShare se diff\u00e9rencie par :"),
        bullet("Un algorithme de scoring multi-axes unique (temps + physique + mental 6 dimensions + impact)"),
        bullet("Un onboarding r\u00e9volutionnaire par \u00e9quipements et enfants"),
        bullet("L\u2019assignation par swipe (style Tinder)"),
        bullet("Le mode \u00AB membre fant\u00f4me \u00BB pour utiliser l\u2019app seul(e)"),
        bullet("La g\u00e9n\u00e9ration automatique de sous-t\u00e2ches"),
        bullet("L\u2019IA int\u00e9gr\u00e9e pour les suggestions proactives"),

        new PageBreak(),

        // ===== 2. ARCHITECTURE =====
        h1("2. Architecture Technique"),
        h2("2.1 Stack"),
        makeTable(["Composant", "Technologie"], [
          ["Frontend", "Next.js 16 (App Router, React 19)"],
          ["Styling", "Tailwind CSS 4"],
          ["State", "Zustand (6 stores)"],
          ["Backend", "Supabase (PostgreSQL, Auth, RLS, Realtime)"],
          ["H\u00e9bergement", "Vercel (auto-deploy GitHub)"],
          ["IA", "Claude API (suggestions, sous-t\u00e2ches, r\u00e9sum\u00e9s)"],
          ["Notifications", "Web Push API (V1), Native Push (V2)"],
          ["Format", "PWA installable (V1), React Native (V2)"],
        ]),

        h2("2.2 Base de donn\u00e9es"),
        makeTable(["Table", "Description"], [
          ["profiles", "Utilisateurs, display_name, household_id, role, vacation_mode, target_share_percent"],
          ["households", "Foyers, invite_code, created_by"],
          ["phantom_members", "Membres fant\u00f4mes (sans compte), display_name, linked_profile_id"],
          ["household_tasks", "T\u00e2ches : name, category_id, frequency, scores, is_fixed_assignment, notifications_enabled, estimated_cost"],
          ["task_completions", "Historique : completed_by, completed_by_phantom_id, completed_at"],
          ["task_categories", "13 cat\u00e9gories (Nettoyage, Enfants, Cuisine, Admin, etc.)"],
          ["task_templates", "93+ templates enrichis avec scoring_category, typical_time, description"],
          ["task_associations", "~200 associations (\u00e9v\u00e9nements, \u00e9quipements, enfants, packs)"],
          ["onboarding_equipment", "29 \u00e9quipements s\u00e9lectionnables \u00e0 l\u2019onboarding"],
          ["task_exchanges", "Propositions d\u2019\u00e9change entre membres"],
        ]),

        h2("2.3 Algorithme de Scoring"),
        p("Le score global est calcul\u00e9 sur 4 axes :"),
        bulletBold("Axe 1 \u2014 Temps (1-8) : ", "bas\u00e9 sur la dur\u00e9e estim\u00e9e (tr\u00e8s court \u00e0 tr\u00e8s long)"),
        bulletBold("Axe 2 \u2014 Effort physique (0-5) : ", "aucun, l\u00e9ger, moyen, intense"),
        bulletBold("Axe 3 \u2014 Charge mentale (0-18) : ", "somme de 6 sous-dimensions (anticipation, cons\u00e9quence si oubli\u00e9, interruption, charge d\u00e9cisionnelle, rigidit\u00e9 horaire, poids de responsabilit\u00e9)"),
        bulletBold("Axe 4 \u2014 Impact foyer (1-4) : ", "\u00e0 quel point le foyer est affect\u00e9"),
        para(bold("Formule : "), normal("(Temps \u00d7 1.0) + (Physique \u00d7 0.8) + (Mental \u00d7 1.5) + (Impact \u00d7 1.0), normalis\u00e9 sur 36, affich\u00e9 sur 10.")),
        para(bold("Score dual : "), normal("user_score (0-10, choix utilisateur via slider) pour l\u2019affichage individuel. global_score (0-36, algo) pour les comparaisons entre membres.")),

        new PageBreak(),

        // ===== 3. FONCTIONNALITES =====
        h1("3. Fonctionnalit\u00e9s"),

        h2("3.1 Onboarding r\u00e9volutionnaire"),
        para(muted("KILLER FEATURE \u2014 Ce qui diff\u00e9rencie FairShare de tout le reste")),
        h3("\u00c9cran 1 \u2014 \u00ab Ton logement \u00bb"),
        p("Grille d\u2019ic\u00f4nes cliquables : 29 \u00e9quipements en 7 cat\u00e9gories (cuisine, salle de bain, linge, sols, ext\u00e9rieur, v\u00e9hicule, animaux). Chaque \u00e9quipement s\u00e9lectionn\u00e9 g\u00e9n\u00e8re automatiquement les t\u00e2ches d\u2019entretien associ\u00e9es."),
        h3("\u00c9cran 2 \u2014 \u00ab Ta famille \u00bb"),
        bullet("Des enfants ? Oui/Non"),
        bullet("Si oui : pr\u00e9nom + \u00e2ge (slider)"),
        bullet("0-2 ans \u2192 t\u00e2ches b\u00e9b\u00e9 (couches, biberons, bain, p\u00e9diatre...)", "bullets", 1),
        bullet("3-5 ans \u2192 t\u00e2ches petit (\u00e9cole, go\u00fbter, habiller...)", "bullets", 1),
        bullet("6-12 ans \u2192 t\u00e2ches enfant (devoirs, activit\u00e9s, cartable...)", "bullets", 1),
        bullet("13+ \u2192 t\u00e2ches ado (r\u00e9sultats scolaires, orientation...)", "bullets", 1),
        h3("\u00c9cran 3 \u2014 \u00ab C\u2019est pr\u00eat \u00bb"),
        p("R\u00e9sum\u00e9 : \u00ab On a cr\u00e9\u00e9 X t\u00e2ches pour ton foyer \u00bb. Aper\u00e7u du pool de t\u00e2ches non assign\u00e9es."),
        h3("\u00c9cran 4 \u2014 Assignation par swipe"),
        p("Pile de cartes style Tinder. Chaque carte = une t\u00e2che avec son score. Swipe gauche \u2192 membre A. Swipe droite \u2192 membre B. Skip \u2192 reste dans le pool."),

        h2("3.2 Cr\u00e9ation de t\u00e2che"),
        p("Champs principaux :"),
        bullet("Nom (avec autocompl\u00e9tion depuis 93+ templates)"),
        bullet("Type/cat\u00e9gorie (auto-d\u00e9tect\u00e9 par mots-cl\u00e9s, modifiable)"),
        bullet("Dur\u00e9e estim\u00e9e, effort physique, fr\u00e9quence"),
        bullet("Assignation (membres r\u00e9els + fant\u00f4mes)"),
        bullet("Score : slider 0-10 pr\u00e9-rempli par l\u2019algo, ajustable"),
        p("Options avanc\u00e9es :"),
        bullet("Assignation fixe / variable (toggle)"),
        bullet("Rappels activ\u00e9s/d\u00e9sactiv\u00e9s (toggle)"),
        bullet("Date de d\u00e9but diff\u00e9r\u00e9e"),
        p("Apr\u00e8s validation \u2014 si la t\u00e2che correspond \u00e0 un \u00e9v\u00e9nement connu (anniversaire, vacances...), l\u2019app propose automatiquement les sous-t\u00e2ches associ\u00e9es."),

        h2("3.3 FAB + (Floating Action Button)"),
        p("Bouton rond bleu \u00ab + \u00bb visible sur toutes les pages. Tape \u2192 overlay avec champ texte rapide. L\u2019utilisateur tape le nom et valide \u2192 redirig\u00e9 vers le formulaire complet pr\u00e9-rempli."),
        para(bold("Syst\u00e8me de brouillons : "), normal("si l\u2019utilisateur ferme sans valider, le brouillon est sauvegard\u00e9. Notifications de rappel aux moments strat\u00e9giques : midi, 17h-18h, 21h.")),

        h2("3.4 Liste des t\u00e2ches"),
        bullet("Cartes avec : nom, score /10, jauges Mental et Temps, assign\u00e9, date"),
        bullet("Sections : En retard, Aujourd\u2019hui, Demain, Cette semaine, Plus tard"),
        bullet("Bouton FAIT (animation verte) + bouton \ud83d\udc64 (compl\u00e9ter pour un fant\u00f4me)"),
        bullet("Recherche, filtres, lien \u00ab Ma journ\u00e9e \u00bb"),

        h2("3.5 R\u00e9cap du soir (/tasks/recap)"),
        p("Page \u00ab Ma journ\u00e9e \u00bb accessible depuis les t\u00e2ches et le dashboard (apr\u00e8s 17h)."),
        p("4 sections cochables :"),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [bold("\u00ab Tes t\u00e2ches \u00bb"), normal(" \u2014 assign\u00e9es, dues aujourd\u2019hui ou en retard. Pr\u00e9-coch\u00e9es si d\u00e9j\u00e0 faites.")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [bold("\u00ab Aussi fait aujourd\u2019hui ? \u00bb"), normal(" \u2014 t\u00e2ches du foyer non assign\u00e9es \u00e0 l\u2019utilisateur.")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [bold("\u00ab Suggestions \u00bb"), normal(" \u2014 templates du soir non encore dans le foyer. Cocher = quick log.")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [bold("\u00ab Autre chose... \u00bb"), normal(" \u2014 champ texte libre.")] }),
        para(bold("Flow : "), normal("coche en rafale (15 secondes) \u2192 \u00ab Termin\u00e9 \u00bb \u2192 \u00e9cran de succ\u00e8s \u2192 redirect dashboard.")),

        h2("3.6 Vue Planning / Calendrier (/planning)"),
        p("Remplace la page Boost dans la navigation principale."),
        bulletBold("Vue semaine : ", "colonnes Lun-Dim, blocs color\u00e9s par cat\u00e9gorie, initiale de l\u2019assign\u00e9"),
        bulletBold("Vue mois : ", "grille avec points color\u00e9s par jour (nombre et poids des t\u00e2ches)"),
        bulletBold("Cr\u00e9ation depuis le planning : ", "tap sur un jour \u2192 cr\u00e9er une t\u00e2che positionn\u00e9e"),
        bulletBold("Indicateur de charge : ", "score total par jour, jours surcharg\u00e9s en rouge"),

        h2("3.7 Membre fant\u00f4me"),
        p("Un membre fant\u00f4me est un membre du foyer qui n\u2019a pas de compte. L\u2019utilisateur actif logge les t\u00e2ches en son nom."),
        bullet("Ajouter/supprimer depuis la page Profil"),
        bullet("Visible partout avec un badge \ud83d\udc7b"),
        bullet("Assignable aux t\u00e2ches, compl\u00e9table \u00ab au nom de \u00bb"),
        bullet("Pr\u00e9sent dans les stats et analytics"),
        bullet("Exclu des propositions d\u2019\u00e9change"),
        bullet("Rattachable \u00e0 un vrai compte plus tard"),

        h2("3.8 Dashboard"),
        p("3 styles au choix : Vivid, Dark, Clean."),
        bullet("Score personnel /10 (hero card)"),
        bullet("Tendance, stats, streak"),
        bullet("Objectif vs r\u00e9alit\u00e9, \u00e9quilibre du foyer"),
        bullet("Top 3 priorit\u00e9s"),
        bullet("Lien r\u00e9cap du soir (apr\u00e8s 17h)"),
        bullet("Actions rapides"),

        h2("3.9 \u00c9changes de t\u00e2ches"),
        bullet("Moteur de suggestions comparant r\u00e9partition actuelle vs objectifs"),
        bullet("Seules les t\u00e2ches \u00ab variables \u00bb sont \u00e9changeables"),
        bullet("Fant\u00f4mes exclus des propositions"),
        bullet("Acceptation/refus par l\u2019autre membre"),

        h2("3.10 R\u00e9\u00e9quilibrage automatique"),
        p("L\u2019app d\u00e9tecte les pics de charge (jour > 2x la moyenne) et propose de d\u00e9caler les t\u00e2ches variables vers des jours plus l\u00e9gers."),

        h2("3.11 IA int\u00e9gr\u00e9e"),
        makeTable(["Fonction IA", "Description", "Priorit\u00e9"], [
          ["G\u00e9n\u00e9ration de sous-t\u00e2ches", "\u00ab Anniversaire L\u00e9a \u00bb \u2192 5-8 sous-t\u00e2ches positionn\u00e9es", "P1"],
          ["Suggestions proactives soir", "Analyse des habitudes \u2192 suggestions personnalis\u00e9es", "P1"],
          ["Cat\u00e9gorisation intelligente", "Comprend le contexte pour scorer plus pr\u00e9cis\u00e9ment", "P2"],
          ["R\u00e9\u00e9quilibrage intelligent", "Optimise le planning selon les contraintes", "P2"],
          ["R\u00e9sum\u00e9 hebdo", "\u00ab Cette semaine, Barbara a port\u00e9 68% du score... \u00bb", "P3"],
        ]),

        new PageBreak(),

        // ===== 4. MONETISATION =====
        h1("4. Mon\u00e9tisation"),
        h2("4.1 Mod\u00e8le Freemium"),
        h3("Gratuit"),
        bullet("Toutes les fonctionnalit\u00e9s core (cr\u00e9ation, scoring, r\u00e9cap, planning, fant\u00f4mes)"),
        bullet("1 foyer, membres illimit\u00e9s"),
        bullet("Templates de base (93+)"),
        bullet("\u00c9changes de t\u00e2ches"),
        h3("Premium (~3-5\u20ac/mois ou packs ponctuels)"),
        bullet("Packs projets : D\u00e9m\u00e9nagement (17 t\u00e2ches), Mariage (15), B\u00e9b\u00e9 (11), Rentr\u00e9e (7)"),
        bullet("IA avanc\u00e9e : r\u00e9sum\u00e9s hebdo, r\u00e9\u00e9quilibrage intelligent"),
        bullet("Statistiques avanc\u00e9es (historique illimit\u00e9, exports)"),

        new PageBreak(),

        // ===== 5. ROADMAP =====
        h1("5. Roadmap"),
        h2("V1 \u2014 Web PWA (actuel)"),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("Auth + foyer + invitation")] }),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("Score dual (slider utilisateur + algo)")] }),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("Dashboard 3 styles")] }),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("R\u00e9cap du soir (batch completion)")] }),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("Membre fant\u00f4me")] }),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("13 cat\u00e9gories, 93+ templates, ~200 associations")] }),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("FAB + avec brouillons, autocompl\u00e9tion")] }),
        new Paragraph({ numbering: { reference: "checks", level: 0 }, spacing: { after: 40 }, children: [normal("T\u00e2che fixe/variable, notifications auto/manuel")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Vue planning / calendrier")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Onboarding \u00e9quipements/enfants + swipe")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Suggestions sous-t\u00e2ches apr\u00e8s cr\u00e9ation")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("R\u00e9\u00e9quilibrage automatique")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Notification push web (21h)")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Enrichir templates \u00e0 500+")] }),

        h2("V2 \u2014 App native + IA"),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("React Native (iOS + Android)")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("IA : g\u00e9n\u00e9ration de sous-t\u00e2ches, suggestions proactives, r\u00e9sum\u00e9 hebdo")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Packs projets premium")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Rattachement fant\u00f4me \u2192 vrai compte")] }),

        h2("V3 \u2014 Croissance"),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Int\u00e9gration calendrier Google/Apple")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Widget iOS/Android")] }),
        new Paragraph({ numbering: { reference: "unchecks", level: 0 }, spacing: { after: 40 }, children: [normal("Multi-foyer (garde altern\u00e9e)")] }),

        new PageBreak(),

        // ===== 6. ETUDE DE MARCHE =====
        h1("6. \u00c9tude de March\u00e9"),
        h2("6.1 Taille du march\u00e9"),
        bullet("March\u00e9 apps gestion t\u00e2ches domestiques : ~500M$ en 2025, croissance 15%/an"),
        bullet("71% de la charge mentale port\u00e9e par les m\u00e8res (Universit\u00e9 de Bath, 2025)"),
        bullet("63% des femmes estiment faire plus que leur part vs 22% des hommes"),
        bullet("Un syst\u00e8me structur\u00e9 via app r\u00e9duit les disputes de 60% en 3 mois"),

        h2("6.2 Concurrence"),
        makeTable(["App", "Force", "Faiblesse vs FairShare"], [
          ["Sweepy (2M+ DL)", "IA pr\u00e9dictive, gamification", "M\u00e9nage uniquement"],
          ["Nipto (500K DL)", "Gamification, +40% initiative", "Buggy, basique"],
          ["Cozi (10M+ DL)", "Tr\u00e8s install\u00e9, famille", "Pas de scoring"],
          ["FairChore", "Gratuit, dette/cr\u00e9dit", "Pas de scoring multi-axes"],
          ["EvenUS", "Finances + t\u00e2ches", "Trop large"],
          ["Cupla (1M DL)", "-75% stress, design", "Pas de r\u00e9\u00e9quilibrage"],
          ["OurHome (1M DL)", "Gamification enfants", "Pas pour couples"],
        ]),

        h2("6.3 Avantages concurrentiels"),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [normal("Seul algo de scoring multi-axes (6 dimensions)")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [normal("Onboarding par \u00e9quipements (personne ne le fait)")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [normal("Swipe d\u2019assignation")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [normal("Membre fant\u00f4me (usage solo)")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [normal("Sous-t\u00e2ches automatiques")] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 }, children: [normal("IA int\u00e9gr\u00e9e")] }),

        new PageBreak(),

        // ===== 7. ACQUISITION =====
        h1("7. Strat\u00e9gie d\u2019Acquisition"),
        h2("7.1 SEO"),
        p("99 mots-cl\u00e9s positionn\u00e9s : charge mentale, t\u00e2ches domestiques, couple, parentalit\u00e9, burn-out, r\u00e9partition, suivi, outils."),
        h2("7.2 R\u00e9seaux sociaux"),
        bullet("TikTok/Instagram : contenu sur la charge mentale (sujet viral)"),
        bullet("Partenariats avec cr\u00e9atrices de contenu"),
        bullet("Format : \u00ab Combien tu scores ? \u00bb \u2192 partage de r\u00e9sultats"),
        h2("7.3 Partenariats"),
        bullet("Th\u00e9rapeutes de couple, coaches parentaux"),
        bullet("Associations f\u00e9ministes"),
        bullet("M\u00e9dias f\u00e9minins (Elle, Marie Claire, Madame Figaro)"),

        new PageBreak(),

        // ===== 8. DESIGN SYSTEM =====
        h1("8. Design System"),
        h2("8.1 Principes"),
        bullet("iOS-first : cartes blanches, coins arrondis, ombres l\u00e9g\u00e8res"),
        bullet("Touch-friendly : minimum 44x44px"),
        bullet("Ton empathique, pas gamifi\u00e9"),
        bullet("Design neutre, pas genr\u00e9"),

        h2("8.2 Couleurs"),
        makeTable(["Token", "Valeur", "Usage"], [
          ["blue", "#007AFF", "Accent principal, liens, boutons"],
          ["green", "#34C759", "Succ\u00e8s, scores bas, bouton FAIT"],
          ["orange", "#FF9500", "Scores moyens, alertes"],
          ["red", "#FF3B30", "Scores \u00e9lev\u00e9s, erreurs"],
          ["bg", "#F6F8FF", "Fond de page"],
          ["card", "#FFFFFF", "Cartes"],
          ["text", "#1C1C1E", "Texte principal"],
          ["textMuted", "#8E8E93", "Texte secondaire"],
        ]),

        h2("8.3 Typographie"),
        makeTable(["Taille", "Usage"], [
          ["40px black", "Score hero (dashboard)"],
          ["28px bold", "Titre de page"],
          ["18px semibold", "Titre de section"],
          ["15px regular", "Corps de texte"],
          ["12px regular", "Labels, l\u00e9gendes"],
          ["10px regular", "Micro-texte, badges"],
        ]),

        h2("8.4 Espacement"),
        p("Syst\u00e8me 8px : 8px (xs), 12px (sm), 16px (md), 24px (lg), 32px (xl)"),
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("C:\\Users\\jonat\\Downloads\\wid-web\\docs\\FairShare_Spec_V2.docx", buffer);
  console.log("OK: FairShare_Spec_V2.docx created");
});
