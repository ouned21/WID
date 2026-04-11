'use client';

import { createClient } from '@/lib/supabase';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useAuthStore } from '@/stores/authStore';

let subscribed = false;
let channels: ReturnType<ReturnType<typeof createClient>['channel']>[] = [];

/**
 * Initialise les abonnements Realtime Supabase.
 * Écoute les changements sur household_tasks, task_completions et profiles
 * pour le foyer courant, et met à jour les stores automatiquement.
 */
export function initRealtime(householdId: string) {
  if (subscribed) return;
  subscribed = true;

  const supabase = createClient();

  // Channel tâches : INSERT, UPDATE, DELETE sur household_tasks
  const tasksChannel = supabase
    .channel(`household:${householdId}:tasks`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'household_tasks',
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        // Recharger toutes les tâches
        useTaskStore.getState().fetchTasks(householdId);
      },
    )
    .subscribe();

  // Channel complétions : INSERT sur task_completions
  const completionsChannel = supabase
    .channel(`household:${householdId}:completions`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'task_completions',
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        // Recharger tâches + analytics
        useTaskStore.getState().fetchTasks(householdId);
        useAnalyticsStore.getState().fetchAnalytics(householdId);
      },
    )
    .subscribe();

  // Channel membres : UPDATE sur profiles (changement de nom, vacances, etc.)
  const membersChannel = supabase
    .channel(`household:${householdId}:members`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `household_id=eq.${householdId}`,
      },
      () => {
        // Recharger les membres du foyer
        useHouseholdStore.getState().fetchHousehold(householdId);
      },
    )
    .subscribe();

  channels = [tasksChannel, completionsChannel, membersChannel];
}

/**
 * Arrête tous les abonnements Realtime.
 */
export function stopRealtime() {
  if (!subscribed) return;

  const supabase = createClient();
  for (const channel of channels) {
    supabase.removeChannel(channel);
  }
  channels = [];
  subscribed = false;
}
