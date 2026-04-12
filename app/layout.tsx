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
    default: "The Load — Mesurez, équilibrez, allégez la charge de votre foyer",
    template: "%s | The Load",
  },
  description: "Application de suivi et rééquilibrage des tâches domestiques. Mesurez la charge mentale, visualisez la répartition, proposez des échanges entre membres du foyer.",
  keywords: [
    "charge mentale", "tâches domestiques", "répartition tâches", "foyer",
    "couple", "famille", "ménage", "organisation", "to-do", "productivité",
    "équilibre", "mental load", "household", "gamification",
    "the load", "scoring tâches", "échange de tâches",
  ],
  authors: [{ name: "The Load" }],
  creator: "The Load",
  manifest: "/manifest.json",
  themeColor: "#007aff",
  metadataBase: new URL("https://wid-eight.vercel.app"),
  alternates: {
    canonical: "/",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Load",
  },
  openGraph: {
    title: "The Load — Mesurez, équilibrez, allégez",
    description: "La première app qui mesure vraiment la charge mentale de votre foyer. Scoring automatique, répartition, échanges de tâches, gamification.",
    type: "website",
    url: "https://wid-eight.vercel.app",
    siteName: "The Load",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Load — Mesurez, équilibrez, allégez",
    description: "La première app qui mesure vraiment la charge mentale de votre foyer.",
    creator: "@theloadapp",
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
              "name": "The Load",
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
