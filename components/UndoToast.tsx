'use client';

/**
 * Toast avec bouton "Annuler" — pattern Gmail/iOS.
 * Apparaît au-dessus du nav bar, auto-dismiss après `durationMs` (défaut 4s).
 */

import { useEffect, useRef } from 'react';

export function UndoToast({
  message,
  onUndo,
  onDismiss,
  durationMs = 4000,
}: {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  durationMs?: number;
}) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    timer.current = setTimeout(onDismiss, durationMs);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [durationMs, onDismiss]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{
        bottom: 100,
        background: '#1c1c1e',
        boxShadow: '0 8px 32px rgba(0,0,0,0.24)',
        minWidth: 280,
        maxWidth: 'calc(100% - 32px)',
      }}
      role="status"
      aria-live="polite"
    >
      <p className="flex-1 text-[14px] text-white font-medium truncate">{message}</p>
      <button
        onClick={() => { if (timer.current) clearTimeout(timer.current); onUndo(); }}
        className="text-[14px] font-bold text-[#0a84ff] active:opacity-60 flex-shrink-0 px-2 -mx-2 py-1"
      >
        Annuler
      </button>
    </div>
  );
}
