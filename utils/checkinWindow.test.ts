import { describe, it, expect } from 'vitest';
import {
  parisHour,
  isInEveningWindow,
  currentWindowStart,
  hasCheckinForCurrentWindow,
} from './checkinWindow';

// Tous les Date construits sont en UTC pour être indépendants du fuseau local du runner.
// Paris = UTC+1 (hiver) ou UTC+2 (été). On choisit des dates en hiver (fin avril peut
// être été — utilisons des timestamps UTC explicites avec conversion Paris pour vérifier).

describe('parisHour', () => {
  it('convertit un timestamp UTC en heure Paris', () => {
    // 2026-04-23 18:00 UTC = 20:00 Paris (CEST = UTC+2)
    const d = new Date('2026-04-23T18:00:00Z');
    expect(parisHour(d)).toBe(20);
  });

  it("00h Paris = 22h UTC en été", () => {
    // 2026-04-23 22:00 UTC = 00:00 Paris
    const d = new Date('2026-04-23T22:00:00Z');
    expect(parisHour(d)).toBe(0);
  });

  it('renvoie un entier 0-23', () => {
    const d = new Date('2026-04-23T12:00:00Z');
    const h = parisHour(d);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(23);
  });
});

describe('isInEveningWindow', () => {
  it('true à 20h Paris', () => {
    expect(isInEveningWindow(new Date('2026-04-23T18:00:00Z'))).toBe(true); // 20h Paris
  });
  it('true à 22h Paris', () => {
    expect(isInEveningWindow(new Date('2026-04-23T20:00:00Z'))).toBe(true); // 22h Paris
  });
  it('true à 02h Paris', () => {
    expect(isInEveningWindow(new Date('2026-04-24T00:00:00Z'))).toBe(true); // 02h Paris
  });
  it('false à 04h Paris', () => {
    expect(isInEveningWindow(new Date('2026-04-24T02:00:00Z'))).toBe(false); // 04h Paris
  });
  it('false à 14h Paris', () => {
    expect(isInEveningWindow(new Date('2026-04-23T12:00:00Z'))).toBe(false); // 14h Paris
  });
  it('false à 19h Paris', () => {
    expect(isInEveningWindow(new Date('2026-04-23T17:00:00Z'))).toBe(false); // 19h Paris
  });
});

describe('currentWindowStart', () => {
  it('null hors fenêtre', () => {
    expect(currentWindowStart(new Date('2026-04-23T12:00:00Z'))).toBeNull();
  });
  it('après 20h : début = aujourd\'hui 20h', () => {
    const now = new Date('2026-04-23T21:00:00Z'); // 23h Paris
    const start = currentWindowStart(now);
    expect(start).not.toBeNull();
    // start doit être à 20:00 Paris le 23 avril = 18:00 UTC (CEST)
    expect(parisHour(start!)).toBe(20);
    // Pas plus d'1 minute après 20h pile
    expect(start!.getTime()).toBeLessThanOrEqual(now.getTime());
  });
  it('avant 04h : début = hier 20h', () => {
    const now = new Date('2026-04-24T01:00:00Z'); // 03h Paris le 24
    const start = currentWindowStart(now);
    expect(start).not.toBeNull();
    expect(parisHour(start!)).toBe(20);
    expect(start!.getTime()).toBeLessThan(now.getTime());
    // Le start doit être la veille (au moins 3h de différence)
    expect(now.getTime() - start!.getTime()).toBeGreaterThan(2 * 3600 * 1000);
  });
});

describe('hasCheckinForCurrentWindow', () => {
  it('false hors fenêtre', () => {
    const now = new Date('2026-04-23T12:00:00Z');
    expect(hasCheckinForCurrentWindow(now, '2026-04-23T11:00:00Z')).toBe(false);
  });
  it('false si last_checkin_at null', () => {
    const now = new Date('2026-04-23T21:00:00Z');
    expect(hasCheckinForCurrentWindow(now, null)).toBe(false);
  });
  it('true si check-in dans la fenêtre courante', () => {
    const now = new Date('2026-04-23T21:00:00Z'); // 23h Paris
    // check-in à 20h30 Paris = 18:30 UTC
    expect(hasCheckinForCurrentWindow(now, '2026-04-23T18:30:00Z')).toBe(true);
  });
  it('false si check-in avant 20h du jour courant', () => {
    const now = new Date('2026-04-23T21:00:00Z'); // 23h Paris
    // check-in à 15h Paris = 13h UTC
    expect(hasCheckinForCurrentWindow(now, '2026-04-23T13:00:00Z')).toBe(false);
  });
  it('true à 02h du matin si check-in à 22h la veille', () => {
    const now = new Date('2026-04-24T00:30:00Z'); // 02h30 Paris le 24
    // check-in à 22h Paris le 23 = 20h UTC le 23
    expect(hasCheckinForCurrentWindow(now, '2026-04-23T20:00:00Z')).toBe(true);
  });
  it('false à 21h si check-in seulement à 05h du matin (trop ancien)', () => {
    const now = new Date('2026-04-23T19:00:00Z'); // 21h Paris
    // check-in à 05h Paris = 03h UTC le 23 — hors fenêtre précédente ET avant 20h du jour
    expect(hasCheckinForCurrentWindow(now, '2026-04-23T03:00:00Z')).toBe(false);
  });
});
