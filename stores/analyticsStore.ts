'use client';

import { create } from 'zustand';
import { createClient } from '@/lib/supabase';
import { useHouseholdStore } from '@/stores/householdStore';
import type { MemberAnalytics } from '@/types/database';

type AnalyticsPeriod = 7 | 30 | 90;

type AnalyticsState = {
  period: AnalyticsPeriod;
  memberAnalytics: MemberAnalytics[];
  categoryBreakdown: { categoryId: string; categoryName: string; colorHex: string; count: number }[];
  loading: boolean;
  error: string | null;

  setPeriod: (period: AnalyticsPeriod) => void;
  fetchAnalytics: (householdId: string) => Promise<void>;
  reset: () => void;
};

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  period: 7,
  memberAnalytics: [],
  categoryBreakdown: [],
  loading: false,
  error: null,

  /**
   * Change la période d'analyse (7, 30 ou 90 jours) et déclenche automatiquement
   * un rechargement des données si un foyer est actif. Sans effet si la période est identique.
   * @param period - Nombre de jours à analyser
   */
  setPeriod: (period) => {
    const current = get().period;
    if (period === current) return;
    set({ period });
    // Re-fetch avec la nouvelle periode
    const householdId = useHouseholdStore.getState().household?.id;
    if (householdId) get().fetchAnalytics(householdId);
  },

  /**
   * Charge les analytics du foyer pour la période courante.
   * Calcule la répartition des complétions par membre (réel + fantôme) et par catégorie.
   * L'ajustement d'arrondi garantit que la somme des pourcentages fait toujours 100%.
   * @param householdId - UUID du foyer à analyser
   */
  fetchAnalytics: async (householdId) => {
    set({ loading: true, error: null });
    const supabase = createClient();
    const period = get().period;
    const allMembers = useHouseholdStore.getState().allMembers;

    // Date de debut de la periode
    const since = new Date();
    since.setDate(since.getDate() - period);

    // Requête simple : completions du foyer sur la période
    const { data: rawCompletions, error } = await supabase
      .from('task_completions')
      .select('completed_by, completed_by_phantom_id, task_id, mental_load_score')
      .eq('household_id', householdId)
      .gte('completed_at', since.toISOString());

    if (error) {
      console.error('[analyticsStore] Erreur fetch completions:', error);
      set({ loading: false, error: error.message });
      return;
    }

    const completions = rawCompletions ?? [];
    const totalCompletions = completions.length;

    // Charger les catégories + charge mentale des tâches séparément
    const taskIds = [...new Set(completions.map((c) => c.task_id))];
    let taskCategories: Record<string, { categoryId: string; categoryName: string; colorHex: string }> = {};
    const taskMentalLoad = new Map<string, number>();

    if (taskIds.length > 0) {
      const { data: tasksData } = await supabase
        .from('household_tasks')
        .select('id, category_id, mental_load_score, task_categories(id, name, color_hex)')
        .in('id', taskIds);

      if (tasksData) {
        for (const t of tasksData) {
          const cat = t.task_categories as unknown as { id: string; name: string; color_hex: string } | null;
          if (cat) {
            taskCategories[t.id] = { categoryId: cat.id, categoryName: cat.name, colorHex: cat.color_hex };
          }
          if (typeof t.mental_load_score === 'number') {
            taskMentalLoad.set(t.id as string, t.mental_load_score);
          }
        }
      }
    }

    // -- Analytics par membre (réel + fantôme) --
    // Si completed_by_phantom_id est renseigné → compter pour le fantôme
    // Sinon → compter pour completed_by (le membre réel)
    const countByMember = new Map<string, number>();
    const loadByMember = new Map<string, number>();
    for (const c of completions) {
      const row = c as Record<string, unknown>;
      const phantomId = typeof row.completed_by_phantom_id === 'string' ? row.completed_by_phantom_id : null;
      const memberId = phantomId || c.completed_by;
      countByMember.set(memberId, (countByMember.get(memberId) ?? 0) + 1);
      // Score cumulé = charge mentale effectivement portée.
      // Priorité : mental_load_score enregistré lors de la complétion,
      // fallback : mental_load_score courant de la tâche.
      const compLoad = typeof row.mental_load_score === 'number' ? row.mental_load_score : null;
      const fallback = taskMentalLoad.get(c.task_id) ?? 0;
      const points = compLoad ?? fallback;
      loadByMember.set(memberId, (loadByMember.get(memberId) ?? 0) + points);
    }

    const totalLoad = [...loadByMember.values()].reduce((s, v) => s + v, 0);

    const rawPercentages = allMembers.map((m) => {
      const count = countByMember.get(m.id) ?? 0;
      const pct = totalCompletions > 0 ? (count / totalCompletions) * 100 : 0;
      return { memberId: m.id, displayName: m.display_name, taskCount: count, rawPct: pct };
    });

    // Ajustement d'arrondi : la somme des % doit faire 100
    const rounded = rawPercentages.map((r) => ({ ...r, taskPercentage: Math.floor(r.rawPct) }));
    const sumRounded = rounded.reduce((s, r) => s + r.taskPercentage, 0);
    const diff = totalCompletions > 0 ? 100 - sumRounded : 0;
    if (diff > 0) {
      // Ajouter la difference au membre avec le plus grand pourcentage
      const maxIdx = rounded.reduce((best, r, i) => r.rawPct > rounded[best].rawPct ? i : best, 0);
      rounded[maxIdx].taskPercentage += diff;
    }

    const memberAnalytics: MemberAnalytics[] = rounded.map((r) => {
      const myLoad = loadByMember.get(r.memberId) ?? 0;
      return {
        memberId: r.memberId,
        displayName: r.displayName,
        taskCount: r.taskCount,
        taskPercentage: r.taskPercentage,
        totalMentalLoad: myLoad,
        mentalLoadPercentage: totalLoad > 0 ? Math.round((myLoad / totalLoad) * 100) : 0,
      };
    });

    // -- Breakdown par catégorie --
    const catMap = new Map<string, { name: string; colorHex: string; count: number }>();
    for (const c of completions) {
      const catInfo = taskCategories[c.task_id];
      if (catInfo) {
        const existing = catMap.get(catInfo.categoryId);
        if (existing) {
          existing.count += 1;
        } else {
          catMap.set(catInfo.categoryId, { name: catInfo.categoryName, colorHex: catInfo.colorHex, count: 1 });
        }
      }
    }

    const categoryBreakdown = Array.from(catMap.entries())
      .map(([categoryId, info]) => ({
        categoryId,
        categoryName: info.name,
        colorHex: info.colorHex,
        count: info.count,
      }))
      .sort((a, b) => b.count - a.count);

    set({ memberAnalytics, categoryBreakdown, loading: false });
  },

  /** Réinitialise le store analytics (ex: après déconnexion ou changement de foyer). */
  reset: () => set({
    period: 7,
    memberAnalytics: [],
    categoryBreakdown: [],
    loading: false,
    error: null,
  }),
}));
