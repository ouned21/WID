'use client';

import { useState } from 'react';
import { useTaskStore } from '@/stores/taskStore';

type Props = {
  taskId: string;
  onDone?: () => void;
  variant?: 'inline' | 'full';
};

export default function PostponeButton({ taskId, onDone, variant = 'inline' }: Props) {
  const { updateTask } = useTaskStore();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const postpone = async (days: number) => {
    setSaving(true);
    const next = new Date();
    next.setDate(next.getDate() + days);
    next.setHours(9, 0, 0, 0);
    await updateTask(taskId, { next_due_at: next.toISOString() });
    setSaving(false);
    setOpen(false);
    onDone?.();
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={variant === 'full' ? 'w-full rounded-xl bg-white py-3 text-[15px] font-medium' : 'text-[13px] font-semibold'}
        style={variant === 'full'
          ? { color: '#ff9500', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }
          : { color: '#ff9500' }}
      >
        📅 Décaler
      </button>
    );
  }

  return (
    <div className={variant === 'full' ? 'rounded-xl overflow-hidden' : 'rounded-xl overflow-hidden'}
      style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
      <div className="bg-white px-4 py-2.5 flex items-center justify-between"
        style={{ borderBottom: '0.5px solid #f0f2f8' }}>
        <p className="text-[12px] font-semibold text-[#8e8e93] uppercase tracking-wide">Décaler à…</p>
        <button onClick={() => setOpen(false)} className="text-[20px] text-[#c7c7cc] leading-none">×</button>
      </div>
      <div className="flex bg-white">
        {[
          { label: 'Demain', days: 1 },
          { label: '+1 semaine', days: 7 },
          { label: '+1 mois', days: 30 },
        ].map((opt, i) => (
          <button
            key={opt.days}
            onClick={() => postpone(opt.days)}
            disabled={saving}
            className="flex-1 py-3 text-[13px] font-semibold disabled:opacity-50 transition-colors active:bg-[#f0f2f8]"
            style={{
              color: '#ff9500',
              borderRight: i < 2 ? '0.5px solid #f0f2f8' : undefined,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
