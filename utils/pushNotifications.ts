/**
 * Notifications Push Web pour Yova.
 *
 * - Demande la permission au premier lancement
 * - Programme une notification quotidienne à 21h (check-in du soir → /journal)
 * - Bilan hebdo dimanche 9h (→ /journal)
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
      '🌙 Check-in du soir',
      'Raconte ta journée à Yova — ça prend 2 minutes.',
      '/journal',
    );

    // Reprogrammer pour le lendemain
    scheduleEveningRecap();
  }, delay);
}

/**
 * Programme la notification du bilan hebdo le dimanche à 9h.
 * Pointe vers le journal — le récap s'affiche là-bas automatiquement.
 */
export function scheduleWeeklyRecap(): void {
  if (!canNotify()) return;

  const now = new Date();
  const target = new Date();

  // Prochain dimanche à 9h
  const daysUntilSunday = ((7 - now.getDay()) % 7) || 7;
  target.setDate(now.getDate() + daysUntilSunday);
  target.setHours(9, 0, 0, 0);

  const delay = target.getTime() - now.getTime();

  setTimeout(() => {
    sendNotification(
      '📊 Bilan de la semaine',
      'Yova a analysé votre semaine — ouvrez le journal pour voir votre bilan.',
      '/journal',
    );
    // Reprogrammer pour la semaine suivante
    scheduleWeeklyRecap();
  }, delay);
}
