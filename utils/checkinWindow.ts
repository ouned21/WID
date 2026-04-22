// =============================================================================
// Sprint 15 — Fenêtre du check-in du soir
// =============================================================================
// La CTA "Check-in du soir" sur /today est visible uniquement dans la fenêtre
// soir (20h → 04h du lendemain, heure de Paris). Elle disparaît dès qu'un
// message a été envoyé dans le journal pendant cette fenêtre.
//
// Règle produit sprint 15 :
//   - ≥ 1 message journal entre 20h et 04h → check-in compté
//   - la CTA ne réapparaît qu'à la prochaine fenêtre (20h le lendemain)
//
// Les helpers prennent un `Date` explicite pour être testables.
// =============================================================================

export const EVENING_START_HOUR = 20;
export const EVENING_END_HOUR = 4;

/** Heure locale Paris (0-23) pour un Date donné. Robuste aux fuseaux serveur. */
export function parisHour(now: Date): number {
  // Intl renvoie "00" à "23" en hour12:false
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0';
  // Intl renvoie parfois "24" à minuit selon runtime — normalise
  const n = parseInt(h, 10);
  return n === 24 ? 0 : n;
}

/** True si l'instant `now` est dans la fenêtre soir Paris (20h-23h59 ou 0h-3h59). */
export function isInEveningWindow(now: Date): boolean {
  const h = parisHour(now);
  return h >= EVENING_START_HOUR || h < EVENING_END_HOUR;
}

/**
 * Horodatage ISO du début de la fenêtre soir **courante**.
 * - si on est après 20h : aujourd'hui 20:00 Paris
 * - si on est entre 00h et 04h : hier 20:00 Paris
 * - sinon : null (hors fenêtre)
 *
 * Utilisé pour décider si `last_checkin_at` tombe dans la fenêtre courante.
 */
export function currentWindowStart(now: Date): Date | null {
  if (!isInEveningWindow(now)) return null;
  const h = parisHour(now);
  const start = new Date(now);
  if (h < EVENING_END_HOUR) {
    // Après minuit : fenêtre a commencé hier à 20h
    start.setDate(start.getDate() - 1);
  }
  start.setHours(EVENING_START_HOUR, 0, 0, 0);
  return start;
}

/**
 * True si un check-in est déjà fait pour la fenêtre courante.
 * False si on est hors fenêtre (rien à masquer) OU pas de check-in récent.
 */
export function hasCheckinForCurrentWindow(now: Date, lastCheckinAt: string | null): boolean {
  const windowStart = currentWindowStart(now);
  if (!windowStart) return false;
  if (!lastCheckinAt) return false;
  const last = new Date(lastCheckinAt);
  return last.getTime() >= windowStart.getTime();
}
