import { redirect } from 'next/navigation';

// Racine : redirige vers la landing marketing.
// force-dynamic : empêche toute mise en cache statique de la redirection.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootRedirect() {
  redirect('/landing');
}
