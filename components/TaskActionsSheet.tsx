'use client';

/**
 * Bottom sheet d'actions sur une tâche — Sprint micro-actions.
 *
 * 4 actions principales : Fait / Reporter / Réassigner / Pas pertinent.
 * Sous-vues intégrées pour "Reporter" (demain / +3j / +7j) et "Réassigner" (liste membres).
 *
 * Utilisé depuis /today (long-press ou bouton ⋯) et /week (tap row).
 */

import { useState } from 'react';
import type { TaskListItem, HouseholdMember } from '@/types/database';

// ── Helpers ────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/** "Demain" : toujours today + 1 (absolu). */
function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

/** "+N jours" : délai relatif par rapport à la date actuelle de la tâche.
 *  Si la tâche est en retard (passée) ou sans date, on part d'aujourd'hui pour
 *  ne pas replanifier dans le passé. */
function delayFromTaskISO(task: TaskListItem, days: number): string {
  const now = new Date();
  const taskDue = task.next_due_at ? new Date(task.next_due_at) : null;
  const base = taskDue && taskDue.getTime() > now.getTime() ? taskDue : now;
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

// ── Composants internes ────────────────────────────────────────────────────

function SheetShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] bg-white pb-safe"
        style={{ boxShadow: '0 -4px 30px rgba(0,0,0,0.12)' }}
      >
        <div className="px-4 pt-4 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea] mx-auto mb-4" />
          {children}
          <div className="h-2" />
        </div>
      </div>
    </>
  );
}

function ActionRow({
  icon,
  label,
  hint,
  tone = 'default',
  onClick,
}: {
  icon: string;
  label: string;
  hint?: string;
  tone?: 'default' | 'danger';
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-[#f2f2f7] transition-colors"
    >
      <div
        className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[18px]"
        style={{ background: '#f2f2f7' }}
      >
        {icon}
      </div>
      <div className="text-left flex-1 min-w-0">
        <p
          className="text-[15px] font-medium"
          style={{ color: tone === 'danger' ? '#ff3b30' : '#1c1c1e' }}
        >
          {label}
        </p>
        {hint && <p className="text-[12px] text-[#8e8e93] truncate">{hint}</p>}
      </div>
    </button>
  );
}

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-1 text-[14px] text-[#007aff] font-medium mb-2 active:opacity-60"
    >
      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {title}
    </button>
  );
}

// ── Sheet principal ────────────────────────────────────────────────────────

type View = 'main' | 'postpone' | 'assign';

export function TaskActionsSheet({
  task,
  allMembers,
  currentUserId,
  onComplete,
  onPostpone,
  onReassign,
  onArchive,
  onClose,
}: {
  task: TaskListItem;
  allMembers: HouseholdMember[];
  currentUserId: string;
  onComplete: () => void;
  onPostpone: (nextDueIso: string) => void;
  onReassign: (userId: string | null, phantomId: string | null) => void;
  onArchive: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<View>('main');

  const currentAssignee = task.assigned_to
    ? allMembers.find((m) => !m.isPhantom && m.id === task.assigned_to) ?? null
    : task.assigned_to_phantom_id
    ? allMembers.find((m) => m.isPhantom && m.id === task.assigned_to_phantom_id) ?? null
    : null;

  return (
    <SheetShell onClose={onClose}>
      <p className="text-[13px] text-[#8e8e93] mb-0.5">
        {view === 'main' ? 'Action' : view === 'postpone' ? 'Reporter à…' : 'Réassigner'}
      </p>
      <p className="text-[17px] font-semibold text-[#1c1c1e] truncate mb-4">{task.name}</p>

      {view === 'main' && (
        <div className="space-y-1 mb-3">
          <ActionRow
            icon="✓"
            label="Fait"
            hint="Marquer comme terminée"
            onClick={onComplete}
          />
          <ActionRow
            icon="⏭"
            label="Reporter"
            hint="Demain, +3 jours, +7 jours"
            onClick={() => setView('postpone')}
          />
          <ActionRow
            icon="👤"
            label="Réassigner"
            hint={currentAssignee ? `Actuellement : ${currentAssignee.display_name}` : 'Actuellement : Foyer'}
            onClick={() => setView('assign')}
          />
          <ActionRow
            icon="🚫"
            label="Pas pertinent"
            hint="Yova ne la proposera plus"
            tone="danger"
            onClick={onArchive}
          />
        </div>
      )}

      {view === 'postpone' && (
        <>
          <BackHeader title="Retour" onBack={() => setView('main')} />
          <div className="space-y-1 mb-3">
            <ActionRow icon="→" label="Demain" onClick={() => onPostpone(tomorrowISO())} />
            <ActionRow icon="⇥" label="+3 jours" hint="à partir de la date actuelle" onClick={() => onPostpone(delayFromTaskISO(task, 3))} />
            <ActionRow icon="⟫" label="+7 jours" hint="à partir de la date actuelle" onClick={() => onPostpone(delayFromTaskISO(task, 7))} />
          </div>
        </>
      )}

      {view === 'assign' && (
        <>
          <BackHeader title="Retour" onBack={() => setView('main')} />
          <div className="space-y-1 mb-3">
            <button
              onClick={() => onReassign(null, null)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-[#f2f2f7] transition-colors"
            >
              <div
                className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[16px]"
                style={{ background: '#f2f2f7' }}
              >
                👥
              </div>
              <div className="text-left flex-1">
                <p className="text-[15px] font-medium text-[#1c1c1e]">Foyer</p>
                <p className="text-[12px] text-[#8e8e93]">N&apos;importe qui peut le faire</p>
              </div>
              {!task.assigned_to && !task.assigned_to_phantom_id && (
                <svg width="18" height="18" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            {allMembers.map((m) => {
              const isMe = !m.isPhantom && m.id === currentUserId;
              const isSelected = m.isPhantom
                ? m.id === task.assigned_to_phantom_id
                : m.id === task.assigned_to;
              const color = isMe ? '#007aff' : m.isPhantom ? '#af52de' : '#34c759';

              return (
                <button
                  key={m.id}
                  onClick={() => onReassign(m.isPhantom ? null : m.id, m.isPhantom ? m.id : null)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-[#f2f2f7] transition-colors"
                >
                  <div
                    className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                    style={{ background: color }}
                  >
                    {getInitials(m.display_name)}
                  </div>
                  <p className="text-[15px] font-medium text-[#1c1c1e] flex-1 text-left">
                    {isMe ? `Moi (${m.display_name})` : m.display_name}
                  </p>
                  {isSelected && (
                    <svg width="18" height="18" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}

      <button
        onClick={onClose}
        className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-[#8e8e93]"
        style={{ background: '#f2f2f7' }}
      >
        Annuler
      </button>
    </SheetShell>
  );
}
