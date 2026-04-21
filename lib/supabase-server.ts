import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client Supabase côté serveur (Server Components / Route Handlers).
 * Lit les cookies pour récupérer la session auth sans exposer le service_role key.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    },
  );
}
