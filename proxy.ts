import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Proxy Next.js (anciennement Middleware) : rafraichit la session Supabase
 * sur chaque requete et redirige en fonction de l'etat d'authentification.
 *
 * - Pas connecte -> /login
 * - Connecte sans foyer -> /household
 * - Connecte avec foyer -> /tasks (si sur /login ou /register ou /household)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Rafraichir la session (important : ne pas supprimer)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isHouseholdPage = pathname.startsWith('/household');
  const isLandingPage = pathname === '/landing';
  const isLegalPage = pathname.startsWith('/legal/');

  // Mode preview : pas de redirections (pour le preview local)
  if (request.nextUrl.searchParams.has('preview')) {
    return response;
  }

  // Pas connecte : redirect vers /login (sauf si deja sur une page auth, landing, ou légale)
  if (!user && !isAuthPage && !isLandingPage && !isLegalPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Connecte : verifier si l'utilisateur a un foyer
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('household_id')
      .eq('id', user.id)
      .maybeSingle();

    const hasHousehold = !!profile?.household_id;

    // Connecte sans foyer : redirect vers /household
    if (!hasHousehold && !isHouseholdPage && !isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/household';
      return NextResponse.redirect(url);
    }

    // Connecte avec foyer mais sur une page auth/household : redirect vers dashboard ou onboarding
    if (hasHousehold && (isAuthPage || isHouseholdPage)) {
      // Vérifier si le foyer a des tâches (sinon → onboarding)
      const { count } = await supabase
        .from('household_tasks')
        .select('id', { count: 'exact', head: true })
        .eq('household_id', profile!.household_id)
        .eq('is_active', true);

      const url = request.nextUrl.clone();
      url.pathname = (count ?? 0) === 0 ? '/onboarding' : '/dashboard';
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Toutes les routes sauf les fichiers statiques et les API internes Next.js
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
