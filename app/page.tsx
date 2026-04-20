import { redirect } from 'next/navigation';

// Racine : redirige vers la landing marketing.
// force-dynamic : empêche toute mise en cache statique de la redirection.
// Nécessaire car Vercel a servi pendant plusieurs jours un artefact compilé
// issu d'un commit antérieur (redirect('/login')) malgré un code source à jour.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function RootRedirect() {
  redirect('/landing');
}
