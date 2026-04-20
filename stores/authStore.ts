'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import type { Profile } from '@/types/database';
import type { Session, User } from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isInitialized: boolean;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;

  // Helpers premium
  isPremium: () => boolean;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  profile: null,
  isInitialized: false,
  loading: false,
  error: null,

  initialize: async () => {
    const supabase = createClient();

    // 1. Récupérer l'utilisateur via getUser() (vérification serveur, non spoofable)
    // getSession() lit depuis le localStorage local et peut être manipulé côté client.
    const { data: { user } } = await supabase.auth.getUser();
    const session = user ? (await supabase.auth.getSession()).data.session : null;

    set({ session, user });

    // 2. Charger le profil si connecte
    if (user) {
      await get().refreshProfile();
    }

    // 3. Ecouter les changements d'auth
    supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user ?? null;
      set({ session, user });

      if (user) {
        await get().refreshProfile();
      } else {
        set({ profile: null });
      }
    });

    // 4. Marquer comme initialise seulement apres tout
    set({ isInitialized: true });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!user) return;

    const supabase = createClient();

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('[authStore] Erreur chargement profil:', error.message);
      return;
    }

    // Si le profil n'existe pas, creer un profil minimal (fallback)
    if (!data) {
      const { error: upsertError } = await supabase.from('profiles').upsert({
        id: user.id,
        display_name: user.user_metadata?.display_name || user.email || 'Utilisateur',
      });

      if (upsertError) {
        console.error('[authStore] Erreur creation profil fallback:', upsertError.message);
        return;
      }

      // Re-lire le profil apres creation
      const { data: retry } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      set({ profile: retry as Profile | null });
      return;
    }

    set({ profile: data as Profile });
  },

  signUp: async (email, password, displayName) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    // Timeout 15s pour éviter que le bouton reste coincé en "Création..."
    // si Supabase hang (rate-limit, SMTP, réseau).
    const signUpPromise = supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT_15S')), 15000);
    });

    let error: { message: string } | null = null;
    try {
      const result = await Promise.race([signUpPromise, timeoutPromise]);
      error = result.error as { message: string } | null;
    } catch (e) {
      const isTimeout = e instanceof Error && e.message === 'TIMEOUT_15S';
      const msg = isTimeout
        ? 'La création prend plus de temps que prévu. Vérifie ta connexion puis réessaie — si le problème persiste, ton compte est peut-être déjà créé, essaie de te connecter.'
        : (e instanceof Error ? e.message : 'Erreur inconnue.');
      set({ loading: false, error: msg });
      return { ok: false, error: msg };
    }

    set({ loading: false });

    if (error) {
      const msg = error.message === 'User already registered'
        ? 'Un compte existe déjà avec cet email.'
        : error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }

    return { ok: true };
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    set({ loading: false });

    if (error) {
      const msg = error.message === 'Invalid login credentials'
        ? 'Email ou mot de passe incorrect.'
        : error.message;
      set({ error: msg });
      return { ok: false, error: msg };
    }

    return { ok: true };
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ session: null, user: null, profile: null, isInitialized: false });
  },

  clearError: () => set({ error: null }),

  isPremium: () => {
    const profile = get().profile;
    if (!profile?.is_premium) return false;
    if (profile.premium_until && new Date(profile.premium_until) < new Date()) return false;
    return true;
  },
}));
