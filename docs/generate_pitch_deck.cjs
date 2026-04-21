/**
 * Génère docs/YOVA_PITCH.pptx — pitch deck Yova V1 partageable
 * Usage : node docs/generate_pitch_deck.cjs
 */
const pptxgen = require('pptxgenjs');
const path = require('path');

const OUT = path.join(__dirname, 'YOVA_PITCH.pptx');

// ── Palette "Berry & Cream" — chaude, intime, pas corporate ──
const C = {
  berry: '6D2E46',      // primary dark (foncé chaleureux)
  berrySoft: '8A4A62',  // secondary
  rose: 'A26769',       // dusty rose, accent
  cream: 'F3E9DC',      // light background
  creamLight: 'FAF4EC', // very light bg
  ink: '2A1A1F',        // dark text
  muted: '6B5760',      // muted text
  white: 'FFFFFF',
  accent: 'D8A96B',     // warm gold accent
};

const F = {
  header: 'Georgia',
  body: 'Calibri',
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.3 x 7.5
pres.author = 'Jonathan — Yova';
pres.title = 'Yova — Le 3e adulte du foyer';

// ── Helpers ──
const LAYOUT_W = 13.3;
const LAYOUT_H = 7.5;

function addFooter(slide, pageNum, totalPages) {
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: LAYOUT_H - 0.3, w: LAYOUT_W, h: 0.3,
    fill: { color: C.berry }, line: { color: C.berry },
  });
  slide.addText('YOVA', {
    x: 0.5, y: LAYOUT_H - 0.3, w: 2, h: 0.3,
    fontFace: F.header, fontSize: 10, color: C.cream, bold: true,
    valign: 'middle', margin: 0, charSpacing: 4,
  });
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: LAYOUT_W - 1.5, y: LAYOUT_H - 0.3, w: 1, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.cream,
    valign: 'middle', align: 'right', margin: 0,
  });
}

function addBerryDot(slide, x, y, size = 0.15, color = C.accent) {
  slide.addShape(pres.shapes.OVAL, {
    x, y, w: size, h: size,
    fill: { color }, line: { color },
  });
}

const TOTAL_PAGES = 14;

// ═══════════════════════════════════════════════════════════
// SLIDE 1 — Title
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.berry };

  // Accent dot
  s.addShape(pres.shapes.OVAL, {
    x: 1, y: 1, w: 0.25, h: 0.25,
    fill: { color: C.accent }, line: { color: C.accent },
  });

  s.addText('YOVA', {
    x: 1, y: 1.4, w: 8, h: 0.6,
    fontFace: F.header, fontSize: 14, color: C.accent, bold: true,
    charSpacing: 8, margin: 0,
  });

  s.addText('Le 3e adulte du foyer.', {
    x: 1, y: 2.5, w: 11, h: 1.5,
    fontFace: F.header, fontSize: 60, color: C.cream, bold: true,
    margin: 0,
  });

  s.addText('Pour les parents qui en ont plein le dos.', {
    x: 1, y: 4.1, w: 11, h: 0.8,
    fontFace: F.body, fontSize: 24, color: C.rose, italic: true,
    margin: 0,
  });

  // Ligne séparatrice accent
  s.addShape(pres.shapes.RECTANGLE, {
    x: 1, y: 5.2, w: 1.5, h: 0.04,
    fill: { color: C.accent }, line: { color: C.accent },
  });

  s.addText('V1 — Spec produit  ·  Avril 2026', {
    x: 1, y: 5.4, w: 10, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.cream, margin: 0,
  });
}

// ═══════════════════════════════════════════════════════════
// SLIDE 2 — Le problème
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  // Header bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('01  ·  LE PROBLÈME', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true,
    charSpacing: 4, margin: 0,
  });

  s.addText('Les parents sont au bout du rouleau.', {
    x: 0.8, y: 1, w: 11.5, h: 1.4,
    fontFace: F.header, fontSize: 40, color: C.ink, bold: true,
    margin: 0,
  });

  // Stat cards
  const stats = [
    { n: '~40%', l: 'des parents en burn-out parental en France (2024)' },
    { n: '8h/j', l: 'de charge mentale invisible, majoritairement portée par un seul' },
    { n: '73%', l: "des couples disent que ça crée des tensions régulières" },
  ];
  stats.forEach((st, i) => {
    const x = 0.8 + i * 4.1;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.2, w: 3.8, h: 2.8,
      fill: { color: C.white }, line: { color: C.cream, width: 1 },
      shadow: { type: 'outer', blur: 8, offset: 2, angle: 90, color: '000000', opacity: 0.08 },
    });
    s.addText(st.n, {
      x: x + 0.2, y: 3.5, w: 3.4, h: 1.2,
      fontFace: F.header, fontSize: 54, color: C.berry, bold: true, margin: 0,
    });
    s.addText(st.l, {
      x: x + 0.2, y: 4.9, w: 3.4, h: 1,
      fontFace: F.body, fontSize: 13, color: C.ink, margin: 0,
    });
  });

  s.addText('Sources : Enquête Gras Savoye 2024, OPE, URIOPSS.', {
    x: 0.8, y: 6.5, w: 11, h: 0.4,
    fontFace: F.body, fontSize: 10, color: C.muted, italic: true, margin: 0,
  });

  addFooter(s, 2, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 3 — La dérive silencieuse
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.berry };

  s.addText('02  ·  LA DÉRIVE SILENCIEUSE', {
    x: 0.8, y: 0.6, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.accent, bold: true,
    charSpacing: 4, margin: 0,
  });

  s.addText('« Ça fait 10 jours qu\'on achète des plats industriels. »', {
    x: 0.8, y: 1.6, w: 11.5, h: 2,
    fontFace: F.header, fontSize: 36, color: C.cream, italic: true,
    margin: 0,
  });

  s.addText([
    { text: "Personne n'a fait les courses. ", options: { breakLine: true, color: C.rose } },
    { text: 'Barbara dort 5h. ', options: { breakLine: true, color: C.rose } },
    { text: "J'oublie les rendez-vous pédiatre. ", options: { breakLine: true, color: C.rose } },
    { text: 'On vit en mode survie.', options: { color: C.rose } },
  ], {
    x: 0.8, y: 3.8, w: 11.5, h: 2.2,
    fontFace: F.body, fontSize: 20, italic: true, margin: 0,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 6.2, w: 1.5, h: 0.04,
    fill: { color: C.accent }, line: { color: C.accent },
  });

  s.addText('Le pire : on le voit. On ne peut pas l\'arrêter.', {
    x: 0.8, y: 6.3, w: 11, h: 0.5,
    fontFace: F.body, fontSize: 14, color: C.accent, bold: true, margin: 0,
  });

  addFooter(s, 3, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 4 — Pour qui
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('03  ·  POUR QUI', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
  });

  s.addText('Le persona de Yova.', {
    x: 0.8, y: 1, w: 11.5, h: 1.2,
    fontFace: F.header, fontSize: 40, color: C.ink, bold: true, margin: 0,
  });

  const traits = [
    { t: '30-45 ans', d: 'Tranche la plus touchée par la charge mentale parentale.' },
    { t: 'Couple, 1-3 enfants', d: 'Généralement en bas âge (< 10 ans). Charge concrète élevée.' },
    { t: 'Deux actifs en surcharge', d: 'Job + parentalité + vie sociale = plus de bande passante.' },
    { t: 'Conscient mais impuissant', d: 'Voit les dérives, ne peut pas les corriger seul.' },
    { t: 'Revenus moyens +', d: 'Peut payer 15 €/mois pour reprendre le contrôle.' },
    { t: 'Digital à l\'aise, pas power user IA', d: "N'utilise pas ChatGPT à fond. Veut une app qui fait le travail." },
  ];

  traits.forEach((tr, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.8 + col * 6.2;
    const y = 2.5 + row * 1.3;

    addBerryDot(s, x, y + 0.2, 0.2, C.rose);
    s.addText(tr.t, {
      x: x + 0.5, y, w: 5.5, h: 0.5,
      fontFace: F.header, fontSize: 16, color: C.berry, bold: true, margin: 0,
    });
    s.addText(tr.d, {
      x: x + 0.5, y: y + 0.5, w: 5.5, h: 0.7,
      fontFace: F.body, fontSize: 12, color: C.ink, margin: 0,
    });
  });

  addFooter(s, 4, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 5 — La solution
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.berry };

  s.addText('04  ·  LA SOLUTION', {
    x: 0.8, y: 0.6, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.accent, bold: true, charSpacing: 4, margin: 0,
  });

  s.addText('Yova est une IA qui vit dans votre foyer.', {
    x: 0.8, y: 1.2, w: 11.5, h: 1.4,
    fontFace: F.header, fontSize: 38, color: C.cream, bold: true, margin: 0,
  });

  s.addText([
    { text: 'Elle connaît vos enfants. Leurs âges, leurs allergies, leurs activités.', options: { breakLine: true } },
    { text: 'Elle connaît votre couple. Votre fatigue, vos contraintes, vos routines.', options: { breakLine: true } },
    { text: 'Elle voit vos dérives avant vous. Elle vous tient la main, avec douceur.', options: { breakLine: true } },
    { text: 'Elle pense à votre place quand vous n\'y arrivez plus.', options: {} },
  ], {
    x: 0.8, y: 3, w: 11.5, h: 2.8,
    fontFace: F.body, fontSize: 18, color: C.cream, margin: 0, paraSpaceAfter: 10,
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 6.2, w: 1.5, h: 0.04,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  s.addText('Le 3e adulte qui tient le cap.', {
    x: 0.8, y: 6.3, w: 11, h: 0.5,
    fontFace: F.body, fontSize: 16, color: C.accent, bold: true, italic: true, margin: 0,
  });

  addFooter(s, 5, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 6 — Les 4 piliers
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('05  ·  LES 4 PILIERS', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('Ce qui fait que Yova tient debout.', {
    x: 0.8, y: 1, w: 11.5, h: 1,
    fontFace: F.header, fontSize: 36, color: C.ink, bold: true, margin: 0,
  });

  const piliers = [
    { n: '01', t: 'Connaissance intime', d: 'Mémoire vivante du foyer : membres, âges, contraintes, routines, épisodes de vie.' },
    { n: '02', t: 'Détection de dérives', d: 'Jobs quotidiens qui repèrent les patterns inquiétants. Yova voit ce que vous ne voyez plus.' },
    { n: '03', t: 'Proactivité douce', d: 'Rappels et suggestions au bon ton, au bon moment. Jamais culpabilisant.' },
    { n: '04', t: 'Mode crise', d: 'Quand tout dérape, Yova réduit au minimum vital et porte le reste. L\'app simplifie, pas compliquée.' },
  ];

  piliers.forEach((p, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.8 + col * 6.2;
    const y = 2.4 + row * 2.4;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 5.9, h: 2.1,
      fill: { color: C.white }, line: { color: C.cream, width: 1 },
      shadow: { type: 'outer', blur: 10, offset: 3, angle: 90, color: '000000', opacity: 0.08 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: 2.1,
      fill: { color: C.accent }, line: { color: C.accent },
    });
    s.addText(p.n, {
      x: x + 0.3, y: y + 0.2, w: 1, h: 0.4,
      fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
    });
    s.addText(p.t, {
      x: x + 0.3, y: y + 0.6, w: 5.4, h: 0.6,
      fontFace: F.header, fontSize: 22, color: C.berry, bold: true, margin: 0,
    });
    s.addText(p.d, {
      x: x + 0.3, y: y + 1.2, w: 5.4, h: 0.9,
      fontFace: F.body, fontSize: 12, color: C.ink, margin: 0,
    });
  });

  addFooter(s, 6, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 7 — Pourquoi pas ChatGPT
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('06  ·  POURQUOI PAS CHATGPT', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('Ce que ChatGPT ne peut pas faire.', {
    x: 0.8, y: 1, w: 11.5, h: 1,
    fontFace: F.header, fontSize: 34, color: C.ink, bold: true, margin: 0,
  });

  // Comparison table
  const rows = [
    ['', 'ChatGPT', 'Yova'],
    ['Proactivité', 'Passif — attend qu\'on lui demande', 'Voit les dérives, te ping au bon moment'],
    ['Unité de vie', 'Mono-user, pas de notion de foyer', 'Le foyer est l\'unité, partagé par les parents'],
    ['Mémoire', 'Limitée, individuelle', 'Mémoire vivante du foyer, évolutive'],
    ['Friction', 'Il faut prompter proprement', 'Tu parles normal, l\'app fait le travail'],
    ['Rituel', 'Aucun rituel intégré', 'Rituel vocal du soir, 3 min'],
  ];

  const tbl = rows.map((r, idx) => r.map((cell) => ({
    text: cell,
    options: idx === 0
      ? { bold: true, fill: { color: C.berry }, color: C.cream, fontSize: 13, align: 'left' }
      : { fontSize: 12, color: C.ink, fill: { color: idx % 2 === 0 ? C.white : C.cream } },
  })));

  s.addTable(tbl, {
    x: 0.8, y: 2.3, w: 11.7,
    colW: [2.5, 4.6, 4.6],
    rowH: 0.6,
    fontFace: F.body,
    border: { pt: 0.5, color: C.cream },
  });

  addFooter(s, 7, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 8 — Nav 3 onglets
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.berry };

  s.addText('07  ·  L\'APP', {
    x: 0.8, y: 0.6, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.accent, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('3 onglets. Rien de plus.', {
    x: 0.8, y: 1.1, w: 11.5, h: 1.1,
    fontFace: F.header, fontSize: 38, color: C.cream, bold: true, margin: 0,
  });
  s.addText('Un foyer en surcharge ne peut pas gérer une app compliquée.', {
    x: 0.8, y: 2.2, w: 11.5, h: 0.5,
    fontFace: F.body, fontSize: 14, color: C.rose, italic: true, margin: 0,
  });

  const onglets = [
    { icon: '📅', t: 'Aujourd\'hui', d: 'L\'inbox unique. Ce qui compte maintenant, 3-5 items max. Rien de plus.' },
    { icon: '👨‍👩‍👧', t: 'Famille', d: 'Le foyer vivant. Membres, contraintes, observations de Yova.' },
    { icon: '💬', t: 'Parler à Yova', d: 'Chat et vocal. Check-in du soir, conversation libre, historique.' },
  ];

  onglets.forEach((o, i) => {
    const x = 0.8 + i * 4.1;
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.2, w: 3.9, h: 3.4,
      fill: { color: C.berrySoft }, line: { color: C.berrySoft },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.2, w: 3.9, h: 0.08,
      fill: { color: C.accent }, line: { color: C.accent },
    });
    s.addText(o.icon, {
      x: x + 0.3, y: 3.5, w: 1, h: 1,
      fontSize: 36, margin: 0,
    });
    s.addText(o.t, {
      x: x + 0.3, y: 4.6, w: 3.4, h: 0.6,
      fontFace: F.header, fontSize: 22, color: C.cream, bold: true, margin: 0,
    });
    s.addText(o.d, {
      x: x + 0.3, y: 5.3, w: 3.4, h: 1.2,
      fontFace: F.body, fontSize: 12, color: C.cream, margin: 0,
    });
  });

  addFooter(s, 8, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 9 — Écran Aujourd'hui
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('08  ·  ÉCRAN AUJOURD\'HUI', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('« Ouvre l\'app, vois ce qui compte, zéro charge mentale. »', {
    x: 0.8, y: 1, w: 11.5, h: 1,
    fontFace: F.header, fontSize: 26, color: C.ink, italic: true, margin: 0,
  });

  // Phone mockup
  const px = 1.5, py = 2.3, pw = 3.5, ph = 5;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x: px, y: py, w: pw, h: ph,
    fill: { color: C.ink }, line: { color: C.ink }, rectRadius: 0.25,
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: px + 0.15, y: py + 0.3, w: pw - 0.3, h: ph - 0.5,
    fill: { color: C.white }, line: { color: C.white },
  });

  // Banner crise
  s.addShape(pres.shapes.RECTANGLE, {
    x: px + 0.2, y: py + 0.45, w: pw - 0.4, h: 0.4,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  s.addText('🫂 Mode crise actif', {
    x: px + 0.3, y: py + 0.45, w: pw - 0.5, h: 0.4,
    fontFace: F.body, fontSize: 10, color: C.white, bold: true, valign: 'middle', margin: 0,
  });

  s.addText('18h30 · Maintenant', {
    x: px + 0.3, y: py + 1, w: pw - 0.5, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.muted, margin: 0,
  });
  s.addText('Dîner à préparer', {
    x: px + 0.3, y: py + 1.3, w: pw - 0.5, h: 0.3,
    fontFace: F.header, fontSize: 14, color: C.berry, bold: true, margin: 0,
  });
  s.addText('→ Pâtes au saumon (12 min)', {
    x: px + 0.3, y: py + 1.6, w: pw - 0.5, h: 0.3,
    fontFace: F.body, fontSize: 10, color: C.ink, margin: 0,
  });

  s.addText('À faire aujourd\'hui', {
    x: px + 0.3, y: py + 2.1, w: pw - 0.5, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.muted, bold: true, charSpacing: 2, margin: 0,
  });
  const tasks = [
    '○  Lancer machine à laver',
    '○  Signer autorisation Léa',
    '○  Appeler pédiatre pour Mia',
  ];
  tasks.forEach((t, i) => {
    s.addText(t, {
      x: px + 0.3, y: py + 2.45 + i * 0.3, w: pw - 0.5, h: 0.3,
      fontFace: F.body, fontSize: 10, color: C.ink, margin: 0,
    });
  });

  s.addText('Sur le radar', {
    x: px + 0.3, y: py + 3.55, w: pw - 0.5, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.muted, bold: true, charSpacing: 2, margin: 0,
  });
  s.addText('💡  Anniv de Léa dans 5 jours — on en parle ?', {
    x: px + 0.3, y: py + 3.85, w: pw - 0.5, h: 0.3,
    fontFace: F.body, fontSize: 9, color: C.rose, italic: true, margin: 0,
  });

  // Annotations à droite
  const ax = 6, ay = 2.5;
  const annots = [
    { t: 'Banner contextuel', d: 'Visible si mode crise ON. Rappel doux.' },
    { t: 'Card « Maintenant »', d: '1 seule chose urgente, s\'il y en a une.' },
    { t: '3-5 tâches max', d: 'Pas de liste exhaustive. Anti-surcharge.' },
    { t: 'Radar', d: 'Anticipations Yova collapsible.' },
  ];
  annots.forEach((a, i) => {
    const y = ay + i * 1.1;
    s.addShape(pres.shapes.RECTANGLE, {
      x: ax, y, w: 0.06, h: 1, fill: { color: C.accent }, line: { color: C.accent },
    });
    s.addText(a.t, {
      x: ax + 0.2, y, w: 6, h: 0.35,
      fontFace: F.header, fontSize: 15, color: C.berry, bold: true, margin: 0,
    });
    s.addText(a.d, {
      x: ax + 0.2, y: y + 0.35, w: 6, h: 0.6,
      fontFace: F.body, fontSize: 12, color: C.ink, margin: 0,
    });
  });

  addFooter(s, 9, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 10 — Écran Famille
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('09  ·  ÉCRAN FAMILLE', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('« Ce que Yova sait de vous. »', {
    x: 0.8, y: 1, w: 11.5, h: 1,
    fontFace: F.header, fontSize: 28, color: C.ink, italic: true, margin: 0,
  });

  const sections = [
    { t: 'Membres', d: 'Adultes + enfants avec âges, classes, allergies, activités, routines.' },
    { t: 'Contexte actuel', d: 'Niveau d\'énergie, événements de vie difficiles, aides externes.' },
    { t: 'Routines & équipements', d: 'Héritage Yova, allégé au strict utile.' },
    { t: 'Ce que Yova a remarqué ⭐', d: '« 8 livraisons ce mois / Barbara < 6h sur 5 nuits / salon pas rangé depuis dimanche ». LA feature wow.' },
  ];

  sections.forEach((sec, i) => {
    const y = 2.5 + i * 1.15;
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.8, y, w: 12, h: 1,
      fill: { color: C.white }, line: { color: C.cream, width: 1 },
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.8, y, w: 0.08, h: 1,
      fill: { color: i === 3 ? C.accent : C.rose }, line: { color: i === 3 ? C.accent : C.rose },
    });
    s.addText(sec.t, {
      x: 1.1, y: y + 0.1, w: 4, h: 0.4,
      fontFace: F.header, fontSize: 18, color: C.berry, bold: true, margin: 0,
    });
    s.addText(sec.d, {
      x: 1.1, y: y + 0.5, w: 11, h: 0.5,
      fontFace: F.body, fontSize: 13, color: C.ink, margin: 0,
    });
  });

  addFooter(s, 10, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 11 — Parler à Yova
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.berry };

  s.addText('10  ·  PARLER À YOVA', {
    x: 0.8, y: 0.6, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.accent, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('Le rituel du soir.', {
    x: 0.8, y: 1.1, w: 11.5, h: 1.1,
    fontFace: F.header, fontSize: 40, color: C.cream, bold: true, margin: 0,
  });
  s.addText('3 minutes, vocal. Tu poses ton téléphone, tu racontes. Yova écoute, extrait, anticipe.', {
    x: 0.8, y: 2.2, w: 11.5, h: 0.6,
    fontFace: F.body, fontSize: 14, color: C.rose, italic: true, margin: 0,
  });

  // Script example
  const turns = [
    { who: 'Yova', t: 'Coucou. Comment s\'est passée ta journée ?', color: C.accent },
    { who: 'Toi', t: 'Claqué. Barbara a encore pas dormi, les filles étaient infernales au dîner…', color: C.cream },
    { who: 'Yova', t: 'Je note. Vous avez prévu quoi demain pour le dîner ?', color: C.accent },
    { who: 'Toi', t: '… j\'y ai pas pensé.', color: C.cream },
    { who: 'Yova', t: 'OK. Je te propose des pâtes sauce tomate (12 min, Léa adore) — je te mets l\'ingrédient qui manque sur la liste courses ?', color: C.accent },
    { who: 'Toi', t: 'Oui vas-y.', color: C.cream },
  ];

  turns.forEach((tr, i) => {
    const y = 3 + i * 0.55;
    s.addText(tr.who.toUpperCase() + ' ·', {
      x: 0.8, y, w: 1.2, h: 0.4,
      fontFace: F.body, fontSize: 11, color: tr.color, bold: true, charSpacing: 3, margin: 0,
    });
    s.addText(tr.t, {
      x: 2, y, w: 11, h: 0.4,
      fontFace: F.body, fontSize: 14, color: C.cream, italic: tr.who === 'Yova', margin: 0,
    });
  });

  addFooter(s, 11, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 12 — Mémoire vivante (tech)
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('11  ·  LA TECH', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('Une mémoire à 3 couches.', {
    x: 0.8, y: 1, w: 11.5, h: 1,
    fontFace: F.header, fontSize: 34, color: C.ink, bold: true, margin: 0,
  });

  const layers = [
    { n: '1', t: 'Mémoire structurée', d: 'Postgres : membres, contraintes, routines, événements. Source de vérité factuelle.' },
    { n: '2', t: 'Mémoire narrative', d: 'pgvector : chaque conversation stockée en embeddings. Recherchable sémantiquement.' },
    { n: '3', t: 'Observations', d: 'Jobs quotidiens détectent les patterns (cooking drift, sleep deficit, event unprepared).' },
  ];

  layers.forEach((l, i) => {
    const y = 2.4 + i * 1.3;
    s.addShape(pres.shapes.OVAL, {
      x: 0.8, y, w: 1, h: 1,
      fill: { color: C.berry }, line: { color: C.berry },
    });
    s.addText(l.n, {
      x: 0.8, y, w: 1, h: 1,
      fontFace: F.header, fontSize: 32, color: C.cream, bold: true, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(l.t, {
      x: 2.1, y: y + 0.05, w: 10, h: 0.4,
      fontFace: F.header, fontSize: 22, color: C.berry, bold: true, margin: 0,
    });
    s.addText(l.d, {
      x: 2.1, y: y + 0.5, w: 10, h: 0.5,
      fontFace: F.body, fontSize: 13, color: C.ink, margin: 0,
    });
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 6.4, w: 1.5, h: 0.04,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  s.addText('Stack : Next.js · Supabase + pgvector · Claude (Haiku + Sonnet) · Deepgram STT · ElevenLabs TTS', {
    x: 0.8, y: 6.5, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.muted, margin: 0,
  });

  addFooter(s, 12, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 13 — Business model
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.creamLight };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.15, h: LAYOUT_H,
    fill: { color: C.berry }, line: { color: C.berry },
  });

  s.addText('12  ·  BUSINESS MODEL', {
    x: 0.8, y: 0.5, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.rose, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('Simple. Juste. Défendable.', {
    x: 0.8, y: 1, w: 11.5, h: 1,
    fontFace: F.header, fontSize: 34, color: C.ink, bold: true, margin: 0,
  });

  // Free card
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 2.4, w: 5.8, h: 4.3,
    fill: { color: C.white }, line: { color: C.cream, width: 1 },
  });
  s.addText('FREE', {
    x: 1.1, y: 2.7, w: 5, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.muted, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('0 €', {
    x: 1.1, y: 3.1, w: 5, h: 1,
    fontFace: F.header, fontSize: 48, color: C.ink, bold: true, margin: 0,
  });
  s.addText([
    { text: '1 check-in vocal / semaine', options: { bullet: true, breakLine: true } },
    { text: 'Tâches basiques', options: { bullet: true, breakLine: true } },
    { text: 'Onboarding complet', options: { bullet: true, breakLine: true } },
    { text: 'Pas de mémoire longue', options: { bullet: true, breakLine: true, color: C.muted } },
    { text: 'Pas de mode crise', options: { bullet: true, color: C.muted } },
  ], {
    x: 1.1, y: 4.3, w: 5.2, h: 2.2,
    fontFace: F.body, fontSize: 12, color: C.ink, paraSpaceAfter: 6, margin: 0,
  });

  // Premium card
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.9, y: 2.4, w: 5.8, h: 4.3,
    fill: { color: C.berry }, line: { color: C.berry },
    shadow: { type: 'outer', blur: 10, offset: 3, angle: 90, color: '000000', opacity: 0.15 },
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 6.9, y: 2.4, w: 5.8, h: 0.1,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  s.addText('PREMIUM', {
    x: 7.2, y: 2.7, w: 5, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.accent, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('14,99 € / mois', {
    x: 7.2, y: 3.1, w: 5.2, h: 1,
    fontFace: F.header, fontSize: 38, color: C.cream, bold: true, margin: 0,
  });
  s.addText('ou 149 € / an (−17 %)', {
    x: 7.2, y: 4, w: 5, h: 0.3,
    fontFace: F.body, fontSize: 11, color: C.rose, italic: true, margin: 0,
  });
  s.addText([
    { text: 'Tout illimité', options: { bullet: true, breakLine: true, bold: true } },
    { text: 'Mémoire longue du foyer', options: { bullet: true, breakLine: true } },
    { text: 'Détection de dérives', options: { bullet: true, breakLine: true } },
    { text: 'Mode crise', options: { bullet: true, breakLine: true } },
    { text: '2 users foyer', options: { bullet: true } },
  ], {
    x: 7.2, y: 4.4, w: 5.2, h: 2.1,
    fontFace: F.body, fontSize: 12, color: C.cream, paraSpaceAfter: 6, margin: 0,
  });

  addFooter(s, 13, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
// SLIDE 14 — Roadmap + Contact
// ═══════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.berry };

  s.addText('13  ·  ROADMAP', {
    x: 0.8, y: 0.6, w: 8, h: 0.4,
    fontFace: F.body, fontSize: 11, color: C.accent, bold: true, charSpacing: 4, margin: 0,
  });
  s.addText('6 mois jusqu\'au launch public.', {
    x: 0.8, y: 1.1, w: 11.5, h: 1.1,
    fontFace: F.header, fontSize: 34, color: C.cream, bold: true, margin: 0,
  });

  const milestones = [
    { m: 'M1', t: 'Fondations pivot', d: 'Nav 3 onglets, fiches membres enrichies' },
    { m: 'M2', t: 'Mémoire longue', d: 'pgvector, faits durables, rétention vraie' },
    { m: 'M3', t: 'Parler à Yova', d: 'Vocal STT/TTS, rituel du soir' },
    { m: 'M4', t: 'Détection dérives', d: 'Jobs, observations, notifs douces' },
    { m: 'M5', t: 'Mode crise + anticipations', d: 'Simplification UX, anniv/rdv/vacances' },
    { m: 'M6', t: 'Beta + launch', d: '30-50 users hors foyer fondateur, paywall' },
  ];

  milestones.forEach((ms, i) => {
    const y = 2.5 + i * 0.7;
    s.addShape(pres.shapes.OVAL, {
      x: 0.8, y, w: 0.5, h: 0.5,
      fill: { color: C.accent }, line: { color: C.accent },
    });
    s.addText(ms.m, {
      x: 0.8, y, w: 0.5, h: 0.5,
      fontFace: F.header, fontSize: 12, color: C.berry, bold: true, align: 'center', valign: 'middle', margin: 0,
    });
    s.addText(ms.t, {
      x: 1.5, y: y + 0.05, w: 4, h: 0.4,
      fontFace: F.header, fontSize: 17, color: C.cream, bold: true, margin: 0,
    });
    s.addText(ms.d, {
      x: 5.5, y: y + 0.08, w: 7, h: 0.4,
      fontFace: F.body, fontSize: 13, color: C.rose, italic: true, margin: 0,
    });
  });

  // Contact
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 6.7, w: 1.5, h: 0.04,
    fill: { color: C.accent }, line: { color: C.accent },
  });
  s.addText('Jonathan · fondateur · ouned21 sur GitHub', {
    x: 0.8, y: 6.8, w: 12, h: 0.4,
    fontFace: F.body, fontSize: 12, color: C.cream, margin: 0,
  });

  addFooter(s, 14, TOTAL_PAGES);
}

// ═══════════════════════════════════════════════════════════
pres.writeFile({ fileName: OUT }).then(() => {
  console.log('Écrit :', OUT);
  console.log('  14 slides, palette Berry & Cream.');
});
