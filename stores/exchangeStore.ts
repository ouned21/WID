'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import type { TaskExchangeWithDetails, TaskExchangeStatus } from '@/types/database';

type ExchangeState = {
  exchanges: TaskExchangeWithDetails[];
  loading: boolean;
  error: string | null;

  fetchExchanges: (householdId: string) => Promise<void>;
  proposeExchange: (householdId: string, payload: {
    to_user_id: string;
    offered_task_id: string;
    requested_task_id: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  respondToExchange: (exchangeId: string, action: 'accepted' | 'rejected') => Promise<{ ok: boolean; error?: string }>;
  reset: () => void;
};

export const useExchangeStore = create<ExchangeState>((set, get) => ({
  exchanges: [],
  loading: false,
  error: null,

  fetchExchanges: async (householdId) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { data, error } = await supabase
      .from('task_exchanges')
      .select(`
        *,
        from_user:profiles!task_exchanges_from_user_id_fkey(id, display_name),
        to_user:profiles!task_exchanges_to_user_id_fkey(id, display_name),
        offered_task:household_tasks!task_exchanges_offered_task_id_fkey(id, name),
        requested_task:household_tasks!task_exchanges_requested_task_id_fkey(id, name)
      `)
      .eq('household_id', householdId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[exchangeStore] Erreur fetch:', error);
      set({ loading: false, error: error.message });
      return;
    }

    set({ exchanges: (data ?? []) as TaskExchangeWithDetails[], loading: false });
  },

  proposeExchange: async (householdId, payload) => {
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { ok: false, error: 'Non authentifié.' };

    if (payload.offered_task_id === payload.requested_task_id) {
      return { ok: false, error: 'Vous ne pouvez pas échanger une tâche contre elle-même.' };
    }

    const { error } = await supabase.from('task_exchanges').insert({
      household_id: householdId,
      from_user_id: userId,
      to_user_id: payload.to_user_id,
      offered_task_id: payload.offered_task_id,
      requested_task_id: payload.requested_task_id,
      status: 'pending',
    });

    if (error) return { ok: false, error: error.message };

    await get().fetchExchanges(householdId);
    return { ok: true };
  },

  respondToExchange: async (exchangeId, action) => {
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return { ok: false, error: 'Non authentifié.' };

    const exchange = get().exchanges.find((e) => e.id === exchangeId);
    if (!exchange) return { ok: false, error: 'Échange introuvable.' };

    // Vérifier que c'est bien le destinataire qui répond
    if (exchange.to_user_id !== userId) {
      return { ok: false, error: 'Seul le destinataire peut répondre.' };
    }

    // Mettre à jour le statut
    const { error: updateError } = await supabase
      .from('task_exchanges')
      .update({ status: action, updated_at: new Date().toISOString() })
      .eq('id', exchangeId);

    if (updateError) return { ok: false, error: updateError.message };

    // Si accepté : swapper les assigned_to
    if (action === 'accepted') {
      await supabase
        .from('household_tasks')
        .update({ assigned_to: exchange.to_user_id })
        .eq('id', exchange.offered_task_id);

      await supabase
        .from('household_tasks')
        .update({ assigned_to: exchange.from_user_id })
        .eq('id', exchange.requested_task_id);
    }

    await get().fetchExchanges(exchange.household_id);

    // Rafraîchir la liste des tâches si un échange a été accepté
    if (action === 'accepted') {
      await useTaskStore.getState().fetchTasks(exchange.household_id);
    }

    return { ok: true };
  },

  reset: () => set({ exchanges: [], loading: false, error: null }),
}));
