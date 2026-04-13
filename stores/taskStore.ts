'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { useAuthStore } from '@/stores/authStore';
import { computeNextDueAt } from '@/utils/taskDueDate';
import type {
  HouseholdTask,
  TaskListItem,
  TaskCompletion,
  TaskFilters,
  Frequency,
} from '@/types/database';

// -----------------------------------------------------------------------------
// Payloads pour les actions
// -----------------------------------------------------------------------------

type CreateTaskPayload = {
  name: string;
  category_id: string;
  frequency: Frequency;
  mental_load_score: number;
  assigned_to?: string | null;
  next_due_at?: string | null;
  template_id?: string | null;
  custom_interval_days?: number | null;
  starts_at?: string | null;
  // Scoring V2 — dual score
  user_score?: number | null;
  global_score?: number | null;
  score_breakdown?: Record<string, unknown> | null;
  duration_estimate?: string | null;
  physical_effort?: string | null;
  scoring_category?: string | null;
  // V2 features
  is_fixed_assignment?: boolean;
  notifications_enabled?: boolean;
  estimated_cost?: number | null;
};

type CompleteTaskPayload = {
  mental_load_score?: number | null;
  duration_minutes?: number | null;
  note?: string | null;
  phantom_member_id?: string | null; // compléter au nom d'un membre fantôme
};

type UpdateTaskPayload = {
  name?: string;
  frequency?: Frequency;
  mental_load_score?: number;
  user_score?: number | null;
  global_score?: number | null;
  score_breakdown?: Record<string, unknown> | null;
  assigned_to?: string | null;
  category_id?: string;
  next_due_at?: string | null;
};

// -----------------------------------------------------------------------------
// Store
// -----------------------------------------------------------------------------

type TaskState = {
  tasks: TaskListItem[];
  selectedTask: TaskListItem | null;
  filters: TaskFilters;
  loading: boolean;
  creating: boolean;
  completing: boolean;
  updating: boolean;
  archiving: boolean;
  error: string | null;

  fetchTasks: (householdId: string) => Promise<void>;
  fetchTaskDetail: (taskId: string) => Promise<TaskCompletion[]>;
  createTask: (householdId: string, payload: CreateTaskPayload) => Promise<{ ok: boolean; error?: string }>;
  completeTask: (taskId: string, payload?: CompleteTaskPayload) => Promise<{ ok: boolean; error?: string }>;
  updateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<{ ok: boolean; error?: string }>;
  archiveTask: (taskId: string) => Promise<{ ok: boolean; error?: string }>;
  deleteTask: (taskId: string) => Promise<{ ok: boolean; error?: string }>;
  setFilters: (filters: Partial<TaskFilters>) => void;
  setSelectedTask: (task: TaskListItem | null) => void;
  clearError: () => void;
  reset: () => void;
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  selectedTask: null,
  filters: { categoryId: 'all', assignment: 'mine' },
  loading: false,
  creating: false,
  completing: false,
  updating: false,
  archiving: false,
  error: null,

  /**
   * Charge toutes les taches actives du foyer en une seule requete.
   * Inclut la categorie, l'assignee et la derniere completion (denormalise).
   */
  fetchTasks: async (householdId) => {
    set({ loading: true, error: null });
    try {
      const supabase = createClient();

      const { data, error } = await supabase
        .from('household_tasks')
        .select(`
          *,
          category:task_categories(id, name, icon, color_hex, sort_order),
          assignee:profiles!household_tasks_assigned_to_fkey(id, display_name, avatar_url),
          task_completions(id, completed_at, completed_by, mental_load_score, duration_minutes, note)
        `)
        .eq('household_id', householdId)
        .eq('is_active', true)
        .order('next_due_at', { ascending: true, nullsFirst: false });

      if (error) {
        set({ loading: false, error: error.message });
        return;
      }

    // Transformer : extraire la derniere completion de chaque tache
    const tasks: TaskListItem[] = (data ?? []).map((row: Record<string, unknown>) => {
      const completions = (row.task_completions as TaskCompletion[]) ?? [];
      const sorted = completions.sort(
        (a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime(),
      );
      const lastCompletion = sorted[0] ?? null;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { task_completions: _, ...rest } = row;
      return {
        ...rest,
        last_completion: lastCompletion ? { ...lastCompletion, completed_by_profile: null } : null,
      } as TaskListItem;
    });

    set({ tasks, loading: false });
    } catch (err) {
      console.error('[taskStore] fetchTasks failed:', err);
      set({ loading: false, error: 'Erreur de chargement des tâches.' });
    }
  },

  /**
   * Charge les 10 dernieres completions pour une tache specifique (page detail).
   */
  fetchTaskDetail: async (taskId) => {
    const supabase = createClient();

    const { data } = await supabase
      .from('task_completions')
      .select('*, completed_by_profile:profiles!task_completions_completed_by_fkey(id, display_name, avatar_url)')
      .eq('task_id', taskId)
      .order('completed_at', { ascending: false })
      .limit(10);

    return (data ?? []) as TaskCompletion[];
  },

  createTask: async (householdId, payload) => {
    // Validation
    if (!payload.name.trim()) return { ok: false, error: 'Le nom est obligatoire.' };
    if (payload.name.trim().length > 100) return { ok: false, error: 'Le nom ne doit pas dépasser 100 caractères.' };
    if (!payload.category_id) return { ok: false, error: 'La catégorie est obligatoire.' };
    if (payload.mental_load_score < 0 || payload.mental_load_score > 10) {
      return { ok: false, error: 'La charge mentale doit être entre 0 et 10.' };
    }
    if (payload.user_score != null && (payload.user_score < 0 || payload.user_score > 10)) {
      return { ok: false, error: 'Le score utilisateur doit être entre 0 et 10.' };
    }

    set({ creating: true, error: null });
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;
    if (!userId) { set({ creating: false }); return { ok: false, error: 'Non authentifié.' }; }

    const { error } = await supabase.from('household_tasks').insert({
      household_id: householdId,
      name: payload.name.trim(),
      category_id: payload.category_id,
      frequency: payload.frequency,
      mental_load_score: payload.mental_load_score,
      assigned_to: payload.assigned_to ?? null,
      next_due_at: payload.next_due_at ?? null,
      template_id: payload.template_id ?? null,
      custom_interval_days: payload.custom_interval_days ?? null,
      starts_at: payload.starts_at ?? null,
      created_by: userId,
      // Scoring V2
      user_score: payload.user_score ?? null,
      global_score: payload.global_score ?? null,
      score_breakdown: payload.score_breakdown ?? null,
      duration_estimate: payload.duration_estimate ?? null,
      physical_effort: payload.physical_effort ?? null,
      scoring_category: payload.scoring_category ?? null,
      is_fixed_assignment: payload.is_fixed_assignment ?? false,
      notifications_enabled: payload.notifications_enabled ?? true,
      estimated_cost: payload.estimated_cost ?? null,
    });

    set({ creating: false });

    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }

    // Recharger les taches
    await get().fetchTasks(householdId);
    return { ok: true };
  },

  completeTask: async (taskId, payload = {}) => {
    set({ completing: true, error: null });
    const supabase = createClient();
    const userId = useAuthStore.getState().user?.id;

    if (!userId) { set({ completing: false }); return { ok: false, error: 'Non authentifié.' }; }

    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) { set({ completing: false }); return { ok: false, error: 'Tâche introuvable.' }; }

    const now = new Date();

    // 1. Insérer la complétion
    const { error: completionError } = await supabase.from('task_completions').insert({
      task_id: taskId,
      household_id: task.household_id,
      completed_by: userId,
      completed_by_phantom_id: payload.phantom_member_id ?? null,
      completed_at: now.toISOString(),
      mental_load_score: payload.mental_load_score ?? task.mental_load_score,
      duration_minutes: payload.duration_minutes ?? null,
      note: payload.note ?? null,
    });

    if (completionError) {
      set({ completing: false, error: completionError.message });
      return { ok: false, error: completionError.message };
    }

    // 2. Calculer et mettre à jour la prochaine échéance
    const nextDueAt = computeNextDueAt(task.frequency, now, task.custom_interval_days);
    const { error: updateError } = await supabase
      .from('household_tasks')
      .update({ next_due_at: nextDueAt?.toISOString() ?? null })
      .eq('id', taskId);

    if (updateError) {
      console.error('[taskStore] Erreur update next_due_at:', updateError.message);
    }

    set({ completing: false });

    // 3. Recharger
    await get().fetchTasks(task.household_id);
    return { ok: true };
  },

  updateTask: async (taskId, payload) => {
    set({ updating: true, error: null });
    const supabase = createClient();

    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) { set({ updating: false }); return { ok: false, error: 'Tâche introuvable.' }; }

    // Si la frequence change, recalculer la prochaine echeance
    const updates: Record<string, unknown> = { ...payload };
    if (payload.frequency && payload.frequency !== task.frequency) {
      const nextDueAt = computeNextDueAt(payload.frequency);
      updates.next_due_at = nextDueAt?.toISOString() ?? null;
    }

    const { error } = await supabase
      .from('household_tasks')
      .update(updates)
      .eq('id', taskId);

    set({ updating: false });

    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }

    await get().fetchTasks(task.household_id);
    return { ok: true };
  },

  archiveTask: async (taskId) => {
    set({ archiving: true, error: null });
    const supabase = createClient();

    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) { set({ archiving: false }); return { ok: false, error: 'Tâche introuvable.' }; }

    const { error } = await supabase
      .from('household_tasks')
      .update({ is_active: false })
      .eq('id', taskId);

    set({ archiving: false });

    if (error) {
      set({ error: error.message });
      return { ok: false, error: error.message };
    }

    await get().fetchTasks(task.household_id);
    return { ok: true };
  },

  deleteTask: async (taskId) => {
    const supabase = createClient();

    const task = get().tasks.find((t) => t.id === taskId);
    if (!task) return { ok: false, error: 'Tâche introuvable.' };

    // Supprimer les complétions associées d'abord (FK)
    await supabase.from('task_completions').delete().eq('task_id', taskId);

    // Supprimer la tâche
    const { error } = await supabase.from('household_tasks').delete().eq('id', taskId);

    if (error) return { ok: false, error: error.message };

    await get().fetchTasks(task.household_id);
    return { ok: true };
  },

  setFilters: (partial) => set((state) => ({
    filters: { ...state.filters, ...partial },
  })),

  setSelectedTask: (task) => set({ selectedTask: task }),
  clearError: () => set({ error: null }),
  reset: () => set({
    tasks: [],
    selectedTask: null,
    filters: { categoryId: 'all', assignment: 'mine' },
    loading: false,
    creating: false,
    completing: false,
    updating: false,
    archiving: false,
    error: null,
  }),
}));
