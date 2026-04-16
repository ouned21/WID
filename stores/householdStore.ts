'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { generateInviteCode } from '@/utils/inviteCode';
import { isUniqueViolation } from '@/utils/validation';
import { useAuthStore } from '@/stores/authStore';
import type { Household, Profile, PhantomMember, HouseholdMember } from '@/types/database';

/** Fusionne profils réels et fantômes en un type unifié */
function buildAllMembers(members: Profile[], phantomMembers: PhantomMember[]): HouseholdMember[] {
  const real: HouseholdMember[] = members.map((m) => ({
    id: m.id,
    display_name: m.display_name,
    avatar_url: m.avatar_url,
    isPhantom: false,
    target_share_percent: m.target_share_percent,
    vacation_mode: m.vacation_mode,
  }));
  const phantom: HouseholdMember[] = phantomMembers.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    avatar_url: null,
    isPhantom: true,
    target_share_percent: p.target_share_percent,
    vacation_mode: false,
  }));
  return [...real, ...phantom];
}

type HouseholdState = {
  household: Household | null;
  members: Profile[];
  phantomMembers: PhantomMember[];
  allMembers: HouseholdMember[]; // profils + fantômes fusionnés
  loading: boolean;
  error: string | null;

  fetchHousehold: (householdId: string) => Promise<void>;
  createHousehold: (name: string) => Promise<{ ok: boolean; error?: string }>;
  joinHousehold: (inviteCode: string) => Promise<{ ok: boolean; error?: string }>;
  renameHousehold: (newName: string) => Promise<{ ok: boolean; error?: string }>;
  leaveHousehold: () => Promise<{ ok: boolean; error?: string }>;
  addPhantomMember: (name: string) => Promise<{ ok: boolean; error?: string }>;
  removePhantomMember: (id: string) => Promise<{ ok: boolean; error?: string }>;
  linkPhantomToReal: (phantomId: string, realProfileId: string) => Promise<{ ok: boolean; error?: string }>;
  clearError: () => void;
  reset: () => void;
};

const MAX_INVITE_CODE_RETRIES = 5;

export const useHouseholdStore = create<HouseholdState>((set, get) => ({
  household: null,
  members: [],
  phantomMembers: [],
  allMembers: [],
  loading: false,
  error: null,

  fetchHousehold: async (householdId) => {
    const supabase = createClient();

    const [householdRes, membersRes, phantomRes] = await Promise.all([
      supabase.from('households').select('*').eq('id', householdId).single(),
      supabase.from('profiles').select('*').eq('household_id', householdId).is('left_at', null),
      supabase.from('phantom_members').select('*').eq('household_id', householdId),
    ]);

    const members = (membersRes.data as Profile[]) ?? [];
    // phantom_members peut échouer si la table n'existe pas encore (legacy)
    if (phantomRes.error) {
      console.warn('[householdStore] phantom_members:', phantomRes.error.message);
    }
    const phantomMembers = (phantomRes.data as PhantomMember[]) ?? [];

    set({
      household: householdRes.data ? (householdRes.data as Household) : get().household,
      members,
      phantomMembers,
      allMembers: buildAllMembers(members, phantomMembers),
    });
  },

  createHousehold: async (name) => {
    set({ loading: true, error: null });
    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue';
      set({ loading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  joinHousehold: async (inviteCode) => {
    set({ loading: true, error: null });
    try {
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inattendue';
      set({ loading: false, error: msg });
      return { ok: false, error: msg };
    }
  },

  renameHousehold: async (newName) => {
    const supabase = createClient();
    const householdId = get().household?.id;
    if (!householdId) return { ok: false, error: 'Aucun foyer.' };
    const profile = useAuthStore.getState().profile;
    if (profile?.role !== 'admin') return { ok: false, error: 'Seul l\'administrateur peut renommer le foyer.' };

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

  addPhantomMember: async (displayName) => {
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;
    const householdId = get().household?.id;
    if (!userId || !householdId) return { ok: false, error: 'Non authentifié.' };

    const { error } = await supabase.from('phantom_members').insert({
      household_id: householdId,
      display_name: displayName.trim(),
      created_by: userId,
    });

    if (error) return { ok: false, error: error.message };

    await get().fetchHousehold(householdId);
    return { ok: true };
  },

  removePhantomMember: async (id) => {
    const supabase = createClient();
    const householdId = get().household?.id;
    if (!householdId) return { ok: false, error: 'Aucun foyer.' };

    const { error } = await supabase.from('phantom_members').delete().eq('id', id);

    if (error) return { ok: false, error: error.message };

    await get().fetchHousehold(householdId);
    return { ok: true };
  },

  /**
   * Rattache un membre fantôme à un vrai profil.
   * Transfère toutes les complétions et assignations, puis supprime le fantôme.
   */
  linkPhantomToReal: async (phantomId, realProfileId) => {
    const supabase = createClient();
    const householdId = get().household?.id;
    if (!householdId) return { ok: false, error: 'Aucun foyer.' };

    // 1. Marquer le fantôme comme rattaché
    await supabase
      .from('phantom_members')
      .update({ linked_profile_id: realProfileId })
      .eq('id', phantomId);

    // 2. Transférer les complétions : completed_by_phantom_id → completed_by
    await supabase
      .from('task_completions')
      .update({ completed_by: realProfileId, completed_by_phantom_id: null })
      .eq('completed_by_phantom_id', phantomId);

    // 3. Transférer les assignations : assigned_to_phantom_id → assigned_to
    await supabase
      .from('household_tasks')
      .update({ assigned_to: realProfileId, assigned_to_phantom_id: null })
      .eq('assigned_to_phantom_id', phantomId);

    // 4. Supprimer le fantôme
    await supabase
      .from('phantom_members')
      .delete()
      .eq('id', phantomId);

    // 5. Rafraîchir
    await get().fetchHousehold(householdId);
    return { ok: true };
  },

  clearError: () => set({ error: null }),
  reset: () => set({ household: null, members: [], phantomMembers: [], allMembers: [], loading: false, error: null }),
}));
