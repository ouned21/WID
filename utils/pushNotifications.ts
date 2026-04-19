/**
 * Notifications Push Web pour Yova.
 *
 * - Demande la permission au premier lancement
 * - Programme une notification quotidienne à 21h (récap du soir)
 * - Rappelle les brouillons non finalisés
 */

const RECAP_HOUR = 21;
const RECAP_MINUTE = 0;

/**
 * Demande la permission de notifications.
 * Retourne true si accordée.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  const result = await Notification.requestPermission();
  return result === 'granted';
}

/**
 * Vérifie si les notifications sont supportées et autorisées.
 */
export function canNotify(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Envoie une notification immédiate.
 */
export function sendNotification(title: string, body: string, url?: string): void {
  if (!canNotify()) return;

  const notification = new Notification(title, {
    body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'yova',
  });

  if (url) {
    notification.onclick = () => {
      window.focus();
      window.location.href = url;
    };
  }
}

/**
 * Programme la notification du récap du soir (21h).
 * Pointe vers le journal IA — c'est l'action principale du soir.
 * Doit être appelé au chargement de l'app.
 */
export function scheduleEveningRecap(): void {
  if (!canNotify()) return;

  const now = new Date();
  const target = new Date();
  target.setHours(RECAP_HOUR, RECAP_MINUTE, 0, 0);

  // Si 21h est déjà passé aujourd'hui, programmer pour demain
  if (now > target) {
    target.setDate(target.getDate() + 1);
  }

  const delay = target.getTime() - now.getTime();

  setTimeout(() => {
    sendNotification(
      '🤖 Qu\'est-ce que t\'as géré aujourd\'hui ?',
      'Dis-le à Yova en une phrase — ça compte dans ton score.',
      '/journal',
    );

    // Reprogrammer pour le lendemain
    scheduleEveningRecap();
  }, delay);
}

/**
 * Vérifie s'il y a un brouillon non finalisé et envoie un rappel.
 * À appeler aux moments stratégiques (12h, 17h).
 */
export function checkDraftReminder(): void {
  if (!canNotify()) return;

  const draft = localStorage.getItem('yova_task_draft');
  if (draft && draft.trim()) {
    sendNotification(
      'Tâche en brouillon',
      `Tu n'as pas finalisé « ${draft} ». Envie de la créer ?`,
      `/tasks/new?draft=${encodeURIComponent(draft)}`,
    );
  }
}

/**
 * Programme les rappels de brouillon aux moments stratégiques.
 */
export function scheduleDraftReminders(): void {
  if (!canNotify()) return;

  const now = new Date();
  const reminders = [
    { hour: 12, minute: 15 }, // midi
    { hour: 17, minute: 30 }, // fin de journée
  ];

  for (const r of reminders) {
    const target = new Date();
    target.setHours(r.hour, r.minute, 0, 0);

    if (now < target) {
      const delay = target.getTime() - now.getTime();
      setTimeout(() => checkDraftReminder(), delay);
    }
  }
}
