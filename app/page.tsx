import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';

// Racine : redirige les utilisateurs connectés vers /today,
// les autres vers la landing marketing.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function RootRedirect() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  redirect(user ? '/today' : '/landing');
}
