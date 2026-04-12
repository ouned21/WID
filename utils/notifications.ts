/**
 * Gestion des notifications web pour FairShare.
 * Utilise l'API Notification du navigateur pour les rappels de tâches.
 */

/** Vérifie si les notifications sont supportées */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Demande la permission de notification */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/** Vérifie si les notifications sont activées */
export function isNotificationEnabled(): boolean {
  return isNotificationSupported() && Notification.permission === 'granted';
}

/** Planifie une notification pour une tâche à une date donnée */
export function scheduleTaskNotification(
  taskId: string,
  taskName: string,
  dueAt: Date,
  householdName?: string,
): number | null {
  if (!isNotificationEnabled()) return null;

  const now = new Date();
  const delay = dueAt.getTime() - now.getTime();

  // Ne pas planifier si la date est passée ou trop lointaine (> 24h)
  if (delay <= 0 || delay > 24 * 60 * 60 * 1000) return null;

  const timerId = window.setTimeout(() => {
    new Notification(`FairShare — ${taskName}`, {
      body: householdName
        ? `Tâche prévue maintenant · ${householdName}`
        : 'Tâche prévue maintenant',
      icon: '/favicon.ico',
      tag: `task-${taskId}`,
    });
  }, delay);

  return timerId;
}

/** Annule une notification planifiée */
export function cancelScheduledNotification(timerId: number): void {
  window.clearTimeout(timerId);
}
