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

    // 1. Recuperer la session existante
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const user = session?.user ?? null;

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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });

    set({ loading: false });

    if (error) {
      const msg = error.message === 'User already registered'
        ? 'Un compte existe deja avec cet email.'
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
    set({ session: null, user: null, profile: null });
  },

  clearError: () => set({ error: null }),
}));
