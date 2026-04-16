import type { NextConfig } from "next";

const securityHeaders = [
  // Empêche le clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Empêche le MIME-sniffing
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Contrôle le Referer
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Désactive fonctionnalités non utilisées
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Force HTTPS — 2 ans, preload
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Content Security Policy
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-eval' : requis par Next.js 16 pour le hot-reload et certains modules.
      // Retirer 'unsafe-eval' casse le build en production sur Vercel.
      // TODO: Évaluer la migration vers nonces CSP quand Next.js le supportera nativement.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      "font-src 'self'",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "worker-src 'self'",
      "manifest-src 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
