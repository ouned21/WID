import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "FairShare — Mesurez, équilibrez, allégez la charge de votre foyer",
    template: "%s | FairShare",
  },
  description: "Application de suivi et rééquilibrage des tâches domestiques. Mesurez la charge mentale, visualisez la répartition, proposez des échanges entre membres du foyer.",
  keywords: [
    // ── FR — Termes principaux (20) ──
    "charge mentale", "tâches domestiques", "répartition tâches", "foyer",
    "couple", "famille", "ménage", "organisation maison", "gestion foyer",
    "équilibre couple", "partage tâches", "qui fait quoi", "tâches ménagères",
    "corvées maison", "planning ménage", "organisation familiale",
    "charge mentale ménagère", "gestion du quotidien", "vie de couple",
    "planning familial domestique",
    // ── FR — Problème / douleur (25) ──
    "charge mentale couple", "inégalité tâches ménagères", "burn out domestique",
    "charge invisible", "répartition inégale", "conflit ménage couple",
    "épuisement parental", "surcharge mentale", "fatigue domestique",
    "charge mentale femme", "charge mentale mère", "travail invisible",
    "frustration ménage", "dispute tâches couple", "injustice domestique",
    "double journée femme", "burn out parental", "épuisement couple",
    "stress domestique", "charge mentale définition", "charge mentale symptômes",
    "charge mentale test", "charge mentale parentale", "inégalité domestique",
    "déséquilibre couple tâches",
    // ── FR — Solution / transactionnel (30) ──
    "application tâches ménagères", "app charge mentale", "suivi tâches maison",
    "appli partage tâches ménagères", "application répartition tâches couple",
    "planification domestique", "tableau de bord foyer", "outil charge mentale",
    "suivi charge mentale", "mesurer charge mentale", "calculer charge mentale",
    "gestion tâches couple", "échange de tâches", "rééquilibrage foyer",
    "application organisation foyer", "app ménage couple", "app corvées maison",
    "application gratuite tâches maison", "outil charge mentale gratuit",
    "comment répartir les tâches en couple", "app pour équilibrer le ménage",
    "réduire charge mentale couple", "solution charge mentale",
    "charge mentale couple solution", "organiser les tâches à deux",
    "application planning ménage", "app liste tâches foyer",
    "application gestion foyer gratuite", "meilleure app tâches ménagères 2026",
    "app suivi tâches domestiques",
    // ── FR — Catégories de tâches (15) ──
    "nettoyage maison", "rangement maison", "courses alimentaires", "linge repassage",
    "cuisine repas", "bricolage maison", "jardin entretien", "tâches administratives",
    "enfants organisation", "animaux domestiques", "voiture entretien",
    "planning repas semaine", "ménage salle de bain", "entretien maison",
    "organisation rentrée scolaire",
    // ── FR — Features / fonctionnalités (20) ──
    "scoring tâches ménagères", "score difficulté tâche", "calendrier partagé couple",
    "planning partagé famille", "notification rappel tâche", "récap du soir app",
    "assignation tâches automatique", "onboarding équipements maison",
    "membre fantôme app", "utiliser app seule sans conjoint",
    "suggestion échange tâches", "rééquilibrage automatique",
    "sous-tâches automatiques", "templates tâches ménagères",
    "statistiques répartition foyer", "objectif répartition couple",
    "mode vacances tâches", "swipe assignation tâches",
    "création rapide tâche", "autocomplétion tâches",
    // ── FR — Longue traîne / questions (20) ──
    "comment alléger la charge mentale dans le couple",
    "comment organiser les tâches ménagères en famille",
    "quelle app pour répartir les tâches du foyer",
    "comment mesurer la charge mentale",
    "comment partager les tâches quand on est en couple",
    "mon conjoint ne fait rien à la maison",
    "pourquoi la charge mentale repose sur les femmes",
    "comment réduire sa charge mentale au quotidien",
    "application pour ne plus se disputer sur le ménage",
    "outil pour visualiser qui fait quoi dans le couple",
    "comment gérer les tâches domestiques avec un bébé",
    "répartition tâches couple avec enfants",
    "comment motiver son conjoint à faire le ménage",
    "tableau de répartition des tâches couple gratuit",
    "fallait demander charge mentale",
    "charge mentale bande dessinée emma",
    "comment faire un planning ménage efficace",
    "répartition 50 50 tâches couple",
    "calendrier tâches ménagères à imprimer",
    "check-list tâches ménagères complète",
    // ── FR — Concurrence (10) ──
    "alternative nipto", "alternative sweepy", "alternative maydée",
    "alternative cozi", "alternative fairchore", "alternative ourhome",
    "meilleure app ménage 2026", "comparatif app tâches ménagères",
    "nipto vs fairshare", "sweepy vs fairshare",
    // ── FR — Événements de vie (10) ──
    "organisation déménagement checklist", "planning mariage tâches",
    "préparer arrivée bébé checklist", "organisation rentrée scolaire",
    "checklist vacances famille", "organisation noël famille",
    "préparation anniversaire enfant", "tâches après déménagement",
    "liste naissance organisation", "organisation garde alternée",
    // ── EN — International (20) ──
    "mental load", "household tasks", "chore tracking", "family task manager",
    "mental load app", "household management", "chore sharing", "fair division",
    "household chore app", "family chores", "task sharing app", "home management",
    "mental load tracker", "household equity", "chore balance", "domestic labor",
    "invisible labor", "emotional labor", "cognitive load household",
    "best chore app for couples",
    // ── Marque (5) ──
    "fairshare", "fairshare app", "fair share tâches", "fair share ménage",
    "fairshare charge mentale",
  ],
  authors: [{ name: "FairShare" }],
  creator: "FairShare",
  manifest: "/manifest.json",
  themeColor: "#007aff",
  metadataBase: new URL("https://wid-eight.vercel.app"),
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "FairShare",
  },
  openGraph: {
    title: "FairShare — Mesurez, équilibrez, allégez",
    description: "La première app qui mesure vraiment la charge mentale de votre foyer. Scoring automatique, répartition, échanges de tâches, gamification.",
    type: "website",
    url: "https://wid-eight.vercel.app",
    siteName: "FairShare",
    locale: "fr_FR",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "FairShare — Mesurez, équilibrez, allégez" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "FairShare — Mesurez, équilibrez, allégez",
    description: "La première app qui mesure vraiment la charge mentale de votre foyer.",
    creator: "@fairshareapp",
    images: ["/og-image.png"],
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }, { url: "/icon-512.png", sizes: "512x512", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "FairShare",
              "description": "Application de suivi et rééquilibrage des tâches domestiques. Mesurez la charge mentale, visualisez la répartition.",
              "url": "https://wid-eight.vercel.app",
              "applicationCategory": "ProductivityApplication",
              "operatingSystem": "Web",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "EUR",
              },
              "inLanguage": "fr",
            }),
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
