import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Supabase cote navigateur (Client Components).
 * Utilise @supabase/ssr pour gerer les cookies automatiquement.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
