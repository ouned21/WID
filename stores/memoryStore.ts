'use client';

/**
 * memoryStore — Sprint 3
 * Gère les faits mémorisés par Yova sur le foyer (agent_memory_facts).
 */

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import type { AgentMemoryFact } from '@/types/database';

export const FACT_TYPE_LABEL: Record<AgentMemoryFact['fact_type'], string> = {
  preference: 'Préférence',
  pattern: 'Habitude',
  context: 'Contexte',
  tension: 'Tension',
  milestone: 'Événement',
};

export const FACT_TYPE_EMOJI: Record<AgentMemoryFact['fact_type'], string> = {
  preference: '❤️',
  pattern: '🔄',
  context: '📍',
  tension: '⚡',
  milestone: '🌟',
};

type MemoryState = {
  facts: AgentMemoryFact[];
  loading: boolean;
  error: string | null;

  fetchMemory: (householdId: string) => Promise<void>;
  invalidateFact: (id: string) => Promise<{ ok: boolean }>;
  clearError: () => void;
};

export const useMemoryStore = create<MemoryState>((set) => ({
  facts: [],
  loading: false,
  error: null,

  fetchMemory: async (householdId) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { data, error } = await supabase
      .from('agent_memory_facts')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[memoryStore]', error.message);
      set({ loading: false, error: error.message });
      return;
    }

    set({ facts: (data as AgentMemoryFact[]) ?? [], loading: false });
  },

  invalidateFact: async (id) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('agent_memory_facts')
      .update({ is_active: false })
      .eq('id', id);

    if (error) return { ok: false };

    set((state) => ({
      facts: state.facts.filter((f) => f.id !== id),
    }));
    return { ok: true };
  },

  clearError: () => set({ error: null }),
}));
