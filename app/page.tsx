import { redirect } from 'next/navigation';

// Racine : redirige vers la landing marketing.
// Cache bump 2026-04-20 : forcer Vercel à invalider un build corrompu
// qui servait un Location: /login au lieu de /landing.
export default function Home() {
  redirect('/landing');
}
