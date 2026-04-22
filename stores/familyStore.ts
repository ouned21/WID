'use client';

/**
 * familyStore — Sprint 1
 * Gère le contexte vivant du foyer (household_profile) et les fiches membres
 * enrichies (phantom_members avec birth_date, school_class, specifics…).
 *
 * Conçu pour alimenter l'onglet "Famille" (V1 nav 3 onglets).
 */

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import type {
  HouseholdProfile,
  PhantomMember,
  PhantomMemberSpecifics,
  ExternalHelp,
} from '@/types/database';

// ── Types ──────────────────────────────────────────────────────────────────

export type AddMemberPayload = {
  display_name: string;
  member_type: 'adult' | 'child' | 'other';
  birth_date?: string | null;
  school_class?: string | null;
  specifics?: PhantomMemberSpecifics;
};

export type UpdateMemberPayload = Partial<
  Pick<PhantomMember, 'display_name' | 'member_type' | 'birth_date' | 'school_class' | 'specifics'>
>;

export type UpdateHouseholdProfilePayload = Partial<
  Pick<HouseholdProfile, 'energy_level' | 'current_life_events' | 'external_help' | 'crisis_mode_active' | 'notes'>
>;

type FamilyState = {
  householdProfile: HouseholdProfile | null;
  members: PhantomMember[];   // tous les membres fantômes enrichis
  loading: boolean;
  saving: boolean;
  error: string | null;

  // Charge tout : household_profile + phantom_members enrichis
  fetchFamily: (householdId: string) => Promise<void>;

  // household_profile
  updateHouseholdProfile: (payload: UpdateHouseholdProfilePayload) => Promise<{ ok: boolean; error?: string }>;
  toggleCrisisMode: () => Promise<{ ok: boolean; error?: string }>;

  // phantom_members
  addMember: (payload: AddMemberPayload) => Promise<{ ok: boolean; error?: string }>;
  updateMember: (id: string, payload: UpdateMemberPayload) => Promise<{ ok: boolean; error?: string }>;
  removeMember: (id: string) => Promise<{ ok: boolean; error?: string }>;

  clearError: () => void;
};

// ── Helpers ────────────────────────────────────────────────────────────────

/** Calcule l'âge en années à partir d'une date ISO (YYYY-MM-DD) */
export function ageFromDate(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const birth = new Date(isoDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Formate une date ISO en 'DD/MM/YYYY' pour l'affichage */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useFamilyStore = create<FamilyState>((set, get) => ({
  householdProfile: null,
  members: [],
  loading: false,
  saving: false,
  error: null,

  // ── fetchFamily ──────────────────────────────────────────────────────────
  fetchFamily: async (householdId) => {
    set({ loading: true, error: null });
    try {
      const supabase = createClient();

      const [profileRes, membersRes] = await Promise.all([
        supabase
          .from('household_profile')
          .select('*')
          .eq('household_id', householdId)
          .maybeSingle(),
        supabase
          .from('phantom_members')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: true }),
      ]);

      if (profileRes.error) {
        console.error('[familyStore] household_profile:', profileRes.error.message);
      }
      if (membersRes.error) {
        console.error('[familyStore] phantom_members:', membersRes.error.message);
      }

      // Si pas de profil foyer (ancien foyer), on le crée silencieusement
      let hp = profileRes.data as HouseholdProfile | null;
      if (!hp) {
        const { data: created } = await supabase
          .from('household_profile')
          .insert({ household_id: householdId })
          .select()
          .single();
        hp = created as HouseholdProfile | null;
      }

      set({
        householdProfile: hp,
        members: (membersRes.data as PhantomMember[]) ?? [],
        loading: false,
      });
    } catch (err) {
      console.error('[familyStore] fetchFamily exception:', err);
      set({ loading: false, error: 'Impossible de charger les données du foyer.' });
    }
  },

  // ── updateHouseholdProfile ───────────────────────────────────────────────
  updateHouseholdProfile: async (payload) => {
    const profile = useAuthStore.getState().profile;
    const householdId = profile?.household_id;
    if (!householdId) return { ok: false, error: 'Aucun foyer.' };

    set({ saving: true, error: null });
    const supabase = createClient();

    const { data, error } = await supabase
      .from('household_profile')
      .update(payload)
      .eq('household_id', householdId)
      .select()
      .single();

    set({ saving: false });

    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }

    set({ householdProfile: data as HouseholdProfile });
    return { ok: true };
  },

  // ── toggleCrisisMode ─────────────────────────────────────────────────────
  toggleCrisisMode: async () => {
    const current = get().householdProfile?.crisis_mode_active ?? false;
    return get().updateHouseholdProfile({
      crisis_mode_active: !current,
      ...(current ? {} : { crisis_started_at: new Date().toISOString() } as object),
    } as UpdateHouseholdProfilePayload);
  },

  // ── addMember ────────────────────────────────────────────────────────────
  addMember: async (payload) => {
    const profile = useAuthStore.getState().profile;
    const householdId = profile?.household_id;
    if (!householdId) return { ok: false, error: 'Aucun foyer.' };

    set({ saving: true, error: null });
    const supabase = createClient();

    const { data, error } = await supabase
      .from('phantom_members')
      .insert({
        household_id: householdId,
        created_by: profile.id,
        display_name: payload.display_name.trim(),
        member_type: payload.member_type,
        birth_date: payload.birth_date ?? null,
        school_class: payload.school_class ?? null,
        specifics: payload.specifics ?? {},
      })
      .select()
      .single();

    set({ saving: false });

    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }

    set((state) => ({ members: [...state.members, data as PhantomMember] }));
    return { ok: true };
  },

  // ── updateMember ─────────────────────────────────────────────────────────
  updateMember: async (id, payload) => {
    set({ saving: true, error: null });
    const supabase = createClient();

    const { data, error } = await supabase
      .from('phantom_members')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    set({ saving: false });

    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }

    set((state) => ({
      members: state.members.map((m) =>
        m.id === id ? (data as PhantomMember) : m
      ),
    }));
    return { ok: true };
  },

  // ── removeMember ─────────────────────────────────────────────────────────
  removeMember: async (id) => {
    set({ saving: true, error: null });
    const supabase = createClient();

    const { error } = await supabase
      .from('phantom_members')
      .delete()
      .eq('id', id);

    set({ saving: false });

    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }

    set((state) => ({ members: state.members.filter((m) => m.id !== id) }));
    return { ok: true };
  },

  clearError: () => set({ error: null }),
}));
