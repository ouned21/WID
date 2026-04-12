'use client';

import { useEffect, useRef } from 'react';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import {
  isNotificationEnabled,
  requestNotificationPermission,
  scheduleTaskNotification,
  cancelScheduledNotification,
} from '@/utils/notifications';

/**
 * Hook qui planifie les notifications pour les tâches du jour.
 * Se relance à chaque changement de la liste de tâches.
 */
export function useTaskNotifications() {
  const tasks = useTaskStore((s) => s.tasks);
  const household = useHouseholdStore((s) => s.household);
  const timerIds = useRef<number[]>([]);

  // Demander la permission une seule fois (pas à chaque reconnexion)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const alreadyAsked = localStorage.getItem('theload-notif-asked');
    if (!alreadyAsked) {
      requestNotificationPermission();
      localStorage.setItem('theload-notif-asked', '1');
    }
  }, []);

  // Planifier les notifications pour les tâches avec next_due_at dans les 24h
  useEffect(() => {
    if (!isNotificationEnabled()) return;

    // Annuler les anciennes notifications
    for (const id of timerIds.current) {
      cancelScheduledNotification(id);
    }
    timerIds.current = [];

    // Planifier les nouvelles
    for (const task of tasks) {
      if (!task.next_due_at) continue;

      const dueDate = new Date(task.next_due_at);
      const timerId = scheduleTaskNotification(
        task.id,
        task.name,
        dueDate,
        household?.name,
      );

      if (timerId !== null) {
        timerIds.current.push(timerId);
      }
    }

    // Cleanup au démontage
    return () => {
      for (const id of timerIds.current) {
        cancelScheduledNotification(id);
      }
    };
  }, [tasks, household?.name]);
}
