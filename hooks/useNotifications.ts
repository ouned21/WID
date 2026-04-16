'use client';

import { useState, useEffect, useCallback } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

export type UseNotificationsReturn = {
  isSupported: boolean;
  permission: NotificationPermission;
  /** true si le rappel journal du soir est activé (stocké en localStorage) */
  journalReminderEnabled: boolean;
  /** Demande la permission et active le rappel */
  enableJournalReminder: () => Promise<boolean>;
  /** Désactive le rappel journal (ne retire pas la permission) */
  disableJournalReminder: () => void;
};

const JOURNAL_PREF_KEY = 'yova_journal_reminder_enabled';

export function useNotifications(): UseNotificationsReturn {
  const isSupported =
    typeof window !== 'undefined' && 'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    isSupported ? (Notification.permission as NotificationPermission) : 'default',
  );

  const [journalReminderEnabled, setJournalReminderEnabled] = useState<boolean>(false);

  // Lire la préférence au montage
  useEffect(() => {
    const stored = localStorage.getItem(JOURNAL_PREF_KEY);
    setJournalReminderEnabled(stored === 'true');
  }, []);

  // Sync permission si elle change (ex : retirée dans les paramètres OS)
  useEffect(() => {
    if (!isSupported) return;
    setPermission(Notification.permission as NotificationPermission);
  }, [isSupported]);

  const enableJournalReminder = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    let perm = Notification.permission as NotificationPermission;

    if (perm === 'default') {
      const result = await Notification.requestPermission();
      perm = result as NotificationPermission;
      setPermission(perm);
    }

    if (perm !== 'granted') return false;

    localStorage.setItem(JOURNAL_PREF_KEY, 'true');
    setJournalReminderEnabled(true);

    // Sauvegarder la préférence côté serveur (best-effort)
    try {
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journalReminder: true }),
      });
    } catch {
      // silencieux — la préférence est quand même sauvée en localStorage
    }

    return true;
  }, [isSupported]);

  const disableJournalReminder = useCallback(() => {
    localStorage.setItem(JOURNAL_PREF_KEY, 'false');
    setJournalReminderEnabled(false);

    // Supprimer côté serveur (best-effort)
    fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ journalReminder: false }),
    }).catch(() => {});
  }, []);

  return {
    isSupported,
    permission,
    journalReminderEnabled,
    enableJournalReminder,
    disableJournalReminder,
  };
}
