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
  title: "The Load — Mesurez, équilibrez, allégez",
  description: "Application de suivi et rééquilibrage des tâches domestiques. Mesurez la charge mentale, visualisez la répartition, proposez des échanges.",
  manifest: "/manifest.json",
  themeColor: "#007aff",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Load",
  },
  openGraph: {
    title: "The Load — Mesurez, équilibrez, allégez",
    description: "La première app qui mesure vraiment la charge mentale de votre foyer.",
    type: "website",
    url: "https://wid-eight.vercel.app",
    siteName: "The Load",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Load",
    description: "Mesurez, équilibrez, allégez la charge de votre foyer.",
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
      <body className="min-h-full flex flex-col">{children}<Analytics /></body>
    </html>
  );
}
