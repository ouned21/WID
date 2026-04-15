import type { Metadata, Viewport } from "next";
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
    default: "Aura — L'agent qui planifie ton foyer à ta place",
    template: "%s | Aura",
  },
  description: "Aura est l'agent intelligent qui pense à tout pour ton foyer. Laisse l'IA planifier, rappeler, anticiper — tu te concentres sur ce qui compte.",
  keywords: [
    // ── Promesse gratuit (agent IA planificateur) ──
    "agent IA foyer", "assistant maison", "planifier foyer", "gestion foyer automatique",
    "IA tâches domestiques", "assistant familial intelligent", "planificateur foyer IA",
    "application planification maison", "app famille IA", "anticipation tâches",
    "rappels intelligents foyer", "planning automatique famille", "calendrier foyer IA",
    "assistant couple IA", "IA organisation familiale", "app intelligente famille",
    "planification maison automatique", "gestion invisible foyer",
    // ── Promesse premium (mesure et répartition) ──
    "charge mentale", "tâches domestiques", "répartition tâches", "foyer",
    "couple", "famille", "ménage", "organisation maison", "gestion foyer",
    "équilibre couple", "partage tâches", "qui fait quoi", "tâches ménagères",
    "planning ménage", "organisation familiale", "charge mentale ménagère",
    "charge mentale couple", "inégalité tâches ménagères", "burn out domestique",
    "charge invisible", "répartition inégale", "épuisement parental",
    "application tâches ménagères", "app charge mentale", "outil charge mentale",
    "comment répartir les tâches en couple", "test charge mentale",
    // ── Événements de vie ──
    "organisation déménagement", "planning mariage", "préparer arrivée bébé",
    "organisation rentrée scolaire", "checklist vacances famille",
    // ── EN — International ──
    "AI household assistant", "smart home planner", "family AI", "mental load app",
    "household tasks", "chore tracking", "family task manager", "home management",
    // ── Marque ──
    "aura app", "aura foyer", "aura assistant",
  ],
  authors: [{ name: "Aura" }],
  creator: "Aura",
  manifest: "/manifest.json",
  metadataBase: new URL("https://wid-eight.vercel.app"),
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Aura",
  },
  openGraph: {
    title: "Aura — L'agent qui planifie ton foyer à ta place",
    description: "L'IA qui s'occupe de tout pour que tu n'aies plus à y penser. Planification automatique, rappels intelligents, anticipation des imprévus.",
    type: "website",
    url: "https://wid-eight.vercel.app",
    siteName: "Aura",
    locale: "fr_FR",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Aura — L'agent qui planifie ton foyer" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aura — L'agent qui planifie ton foyer",
    description: "L'IA qui pense à tout pour ton foyer.",
    creator: "@auraapp",
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

export const viewport: Viewport = {
  themeColor: "#007aff",
  width: "device-width",
  initialScale: 1,
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
        {children}
        <Analytics />
      </body>
    </html>
  );
}
