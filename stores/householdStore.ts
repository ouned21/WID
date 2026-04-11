'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { generateInviteCode } from '@/utils/inviteCode';
import { isUniqueViolation } from '@/utils/validation';
import { useAuthStore } from '@/stores/authStore';
import type { Household, Profile } from '@/types/database';

type HouseholdState = {
  household: Household | null;
  members: Profile[];
  loading: boolean;
  error: string | null;

  fetchHousehold: (householdId: string) => Promise<void>;
  createHousehold: (name: string) => Promise<{ ok: boolean; error?: string }>;
  joinHousehold: (inviteCode: string) => Promise<{ ok: boolean; error?: string }>;
  renameHousehold: (newName: string) => Promise<{ ok: boolean; error?: string }>;
  leaveHousehold: () => Promise<{ ok: boolean; error?: string }>;
  clearError: () => void;
  reset: () => void;
};

const MAX_INVITE_CODE_RETRIES = 5;

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  household: null,
  members: [],
  loading: false,
  error: null,

  fetchHousehold: async (householdId) => {
    const supabase = createClient();

    const [householdRes, membersRes] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).single(),
      supabase.from('profiles').select('*').eq('household_id', householdId).is('left_at', null),
    ]);

    if (householdRes.data) {
      set({ household: householdRes.data as Household });
    }
    if (membersRes.data) {
      set({ members: membersRes.data as Profile[] });
    }
  },

  createHousehold: async (name) => {
    set({ loading: true, error: null });
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;

    if (!userId) {
      set({ loading: false, error: 'Non authentifié.' });
      return { ok: false, error: 'Non authentifié.' };
    }

    // Generer un code d'invitation unique (retry si collision)
    let lastError: string | null = null;
    for (let attempt = 0; attempt < MAX_INVITE_CODE_RETRIES; attempt++) {
      const inviteCode = generateInviteCode();
      const householdId = crypto.randomUUID();

      const { error: insertError } = await supabase.from('households').insert({
        id: householdId,
        name,
        invite_code: inviteCode,
        created_by: userId,
      });

      if (insertError) {
        if (isUniqueViolation(insertError)) {
          lastError = 'Collision de code, nouvelle tentative...';
          continue; // Retry avec un nouveau code
        }
        set({ loading: false, error: insertError.message });
        return { ok: false, error: insertError.message };
      }

      // Mettre a jour le profil de l'utilisateur
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          household_id: householdId,
          role: 'admin',
          joined_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (profileError) {
        set({ loading: false, error: profileError.message });
        return { ok: false, error: profileError.message };
      }

      // Rafraichir le profil dans authStore
      await useAuthStore.getState().refreshProfile();
      await get().fetchHousehold(householdId);

      set({ loading: false });
      return { ok: true };
    }

    set({ loading: false, error: lastError || 'Impossible de générer un code unique.' });
    return { ok: false, error: lastError || 'Impossible de générer un code unique.' };
  },

  joinHousehold: async (inviteCode) => {
    set({ loading: true, error: null });
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;
    const currentProfile = useAuthStore.getState().profile;

    if (!userId) {
      set({ loading: false, error: 'Non authentifié.' });
      return { ok: false, error: 'Non authentifié.' };
    }

    if (currentProfile?.household_id) {
      set({ loading: false, error: 'Vous appartenez déjà à un foyer.' });
      return { ok: false, error: 'Vous appartenez déjà à un foyer.' };
    }

    // Chercher le foyer par code d'invitation
    const { data: household, error: fetchError } = await supabase
      .from('households')
      .select('*')
      .eq('invite_code', inviteCode.toUpperCase())
      .eq('is_active', true)
      .maybeSingle();

    if (fetchError || !household) {
      set({ loading: false, error: 'Code d\'invitation invalide.' });
      return { ok: false, error: 'Code d\'invitation invalide.' };
    }

    // Verifier l'expiration du code
    if (household.invite_code_expires_at && new Date(household.invite_code_expires_at) < new Date()) {
      set({ loading: false, error: 'Ce code d\'invitation a expire.' });
      return { ok: false, error: 'Ce code d\'invitation a expire.' };
    }

    // Rejoindre le foyer
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        household_id: household.id,
        role: 'member',
        joined_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (updateError) {
      set({ loading: false, error: updateError.message });
      return { ok: false, error: updateError.message };
    }

    await useAuthStore.getState().refreshProfile();
    await get().fetchHousehold(household.id);

    set({ loading: false });
    return { ok: true };
  },

  renameHousehold: async (newName) => {
    const supabase = createClient();
    const householdId = get().household?.id;
    if (!householdId) return { ok: false, error: 'Aucun foyer.' };

    const { error } = await supabase
      .from('households')
      .update({ name: newName })
      .eq('id', householdId);

    if (error) return { ok: false, error: error.message };

    set((state) => ({
      household: state.household ? { ...state.household, name: newName } : null,
    }));
    return { ok: true };
  },

  leaveHousehold: async () => {
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { ok: false, error: 'Non authentifié.' };

    const { error } = await supabase
      .from('profiles')
      .update({
        household_id: null,
        role: null,
        left_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) return { ok: false, error: error.message };

    await useAuthStore.getState().refreshProfile();
    set({ household: null, members: [] });
    return { ok: true };
  },

  clearError: () => set({ error: null }),
  reset: () => set({ household: null, members: [], loading: false, error: null }),
}));
