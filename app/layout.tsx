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
    // FR — Termes principaux
    "charge mentale", "tâches domestiques", "répartition tâches", "foyer",
    "couple", "famille", "ménage", "organisation maison", "gestion foyer",
    "équilibre couple", "partage tâches", "qui fait quoi", "tâches ménagères",
    "corvées maison", "planning ménage", "organisation familiale",
    // FR — Problème / douleur
    "charge mentale couple", "inégalité tâches ménagères", "burn out domestique",
    "charge invisible", "répartition inégale", "conflit ménage couple",
    "épuisement parental", "surcharge mentale", "fatigue domestique",
    "charge mentale femme", "charge mentale mère", "travail invisible",
    "frustration ménage", "dispute tâches couple", "injustice domestique",
    // FR — Solution
    "application tâches ménagères", "app charge mentale", "suivi tâches maison",
    "to-do list foyer", "productivité domestique", "gamification ménage",
    "scoring tâches", "échange de tâches", "rééquilibrage foyer",
    "gestion tâches couple", "planification domestique", "tableau de bord foyer",
    "suivi charge mentale", "mesurer charge mentale", "calculer charge mentale",
    // FR — Catégories de tâches
    "nettoyage maison", "rangement", "courses", "linge", "cuisine",
    "bricolage maison", "jardin entretien", "tâches administratives",
    "enfants organisation", "animaux domestiques", "voiture entretien",
    // FR — Features
    "objectif répartition", "suggestion échange tâches", "mode vacances app",
    "notification rappel tâche", "dashboard charge mentale", "statistiques foyer",
    "leaderboard famille", "badges gamification", "XP tâches maison",
    // FR — Longue traîne
    "comment répartir les tâches en couple", "app pour équilibrer le ménage",
    "outil charge mentale gratuit", "application gratuite tâches maison",
    "alternative nipto", "alternative sweepy", "alternative maydée",
    "meilleure app ménage", "app organisation foyer couple",
    // EN — International
    "mental load", "household tasks", "chore tracking", "family task manager",
    "mental load app", "household management", "chore sharing", "fair division",
    "household chore app", "family chores", "task sharing app", "home management",
    "mental load tracker", "household equity", "chore balance", "domestic labor",
    "invisible labor", "emotional labor", "cognitive load household",
    // Marque
    "fairshare", "fairshare app", "fair share", "fair share app", "fair share ménage",
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
