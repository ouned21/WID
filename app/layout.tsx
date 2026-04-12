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
    // Francais — termes principaux
    "charge mentale", "tâches domestiques", "répartition tâches", "foyer",
    "couple", "famille", "ménage", "organisation maison", "gestion foyer",
    "équilibre couple", "partage tâches", "qui fait quoi",
    // Francais — problème/douleur
    "charge mentale couple", "inégalité tâches ménagères", "burn out domestique",
    "charge invisible", "répartition inégale", "conflit ménage couple",
    // Francais — solution
    "application tâches ménagères", "app charge mentale", "suivi tâches maison",
    "to-do list foyer", "productivité domestique", "gamification ménage",
    "scoring tâches", "échange de tâches", "rééquilibrage foyer",
    // Anglais — SEO international
    "mental load", "household tasks", "chore tracking", "family task manager",
    "mental load app", "household management", "chore sharing",
    // Marque
    "fairshare", "fairshare app", "fair share", "fair share app",
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
