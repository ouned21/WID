'use client';

/**
 * Sprint 12 — Carte projet groupée pour /today.
 *
 * Affiche un projet parent (row household_tasks référencée par d'autres via
 * parent_project_id) avec ses sous-tâches en accordéon. Tap sur le titre →
 * expand. Chaque sous-tâche reste actionable via TaskActionsSheet.
 *
 * Règles :
 *  - Le parent lui-même n'a pas de bouton "Fait" (il se complète automatiquement
 *    quand 100 % des enfants sont faits — logique côté consommateur, pas ici).
 *  - Progress = enfants due today ou overdue qui restent à faire.
 */

import { useState } from 'react';
import type { TaskListItem, HouseholdMember } from '@/types/database';

const DURATION_LABEL: Record<string, string> = {
  very_short: '5 min', short: '15 min', medium: '30 min', long: '1h', very_long: '2h+',
};

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

function AssigneeMini({ task, allMembers, currentUserId }: {
  task: TaskListItem; allMembers: HouseholdMember[]; currentUserId: string;
}) {
  const member = task.assigned_to
    ? allMembers.find((m) => !m.isPhantom && m.id === task.assigned_to) ?? null
    : task.assigned_to_phantom_id
    ? allMembers.find((m) => m.isPhantom && m.id === task.assigned_to_phantom_id) ?? null
    : null;
  const isMe = !!member && !member.isPhantom && member.id === currentUserId;
  const color = !member ? '#e5e5ea' : isMe ? '#007aff' : member.isPhantom ? '#af52de' : '#34c759';
  const label = !member ? '·' : getInitials(member.display_name);
  return (
    <div className="flex-shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold"
      style={{ background: color, color: member ? 'white' : '#8e8e93' }}
      title={member?.display_name ?? 'Foyer'}>
      {label}
    </div>
  );
}

export function ProjectGroupCard({
  parent,
  subtasks,
  doneChildIds,
  allMembers,
  currentUserId,
  onOpenActions,
  onCompleteChild,
}: {
  parent: TaskListItem;
  subtasks: TaskListItem[];
  doneChildIds: Set<string>;
  allMembers: HouseholdMember[];
  currentUserId: string;
  onOpenActions: (taskId: string) => void;
  onCompleteChild: (taskId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const done = subtasks.filter((c) => doneChildIds.has(c.id)).length;
  const total = subtasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const nextChild = subtasks.find((c) => !doneChildIds.has(c.id) && c.next_due_at);
  const nextDue = nextChild?.next_due_at
    ? new Date(nextChild.next_due_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
    : null;

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-[#f9f9fb] transition-colors"
      >
        <span className="text-[20px] flex-shrink-0">📋</span>
        <div className="flex-1 text-left min-w-0">
          <p className="text-[15px] font-semibold text-[#1c1c1e] truncate">{parent.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[12px] text-[#8e8e93]">{done}/{total} faits</span>
            {nextDue && <span className="text-[12px] text-[#8e8e93]">· prochaine {nextDue}</span>}
          </div>
          <div className="mt-1.5 h-[3px] w-full rounded-full bg-[#f2f2f7] overflow-hidden">
            <div className="h-full rounded-full transition-all duration-300"
              style={{ width: `${pct}%`, background: pct === 100 ? '#34c759' : '#007aff' }} />
          </div>
        </div>
        <svg width="14" height="14" fill="none" stroke="#c7c7cc" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[#f2f2f7]">
          {subtasks.map((child, i) => {
            const isDone = doneChildIds.has(child.id);
            const isOverdue = !!child.next_due_at && new Date(child.next_due_at) < new Date(new Date().setHours(0, 0, 0, 0));
            return (
              <div
                key={child.id}
                className="flex items-center gap-2.5 px-4 py-2.5"
                style={i < subtasks.length - 1 ? { borderBottom: '0.5px solid #f2f2f7' } : {}}
              >
                <button
                  onClick={() => !isDone && onCompleteChild(child.id)}
                  disabled={isDone}
                  className="flex-shrink-0 w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center"
                  style={{
                    borderColor: isDone ? '#34c759' : isOverdue ? '#ff3b30' : '#007aff',
                    background: isDone ? '#34c759' : 'transparent',
                  }}
                  aria-label={`Marquer "${child.name}" comme fait`}
                >
                  {isDone && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] truncate"
                    style={{ textDecoration: isDone ? 'line-through' : 'none', color: isDone ? '#8e8e93' : '#1c1c1e' }}>
                    {child.name}
                  </p>
                  {!isDone && child.duration_estimate && (
                    <span className="text-[11px] text-[#8e8e93]">⏱ {DURATION_LABEL[child.duration_estimate]}</span>
                  )}
                </div>
                {!isDone && (
                  <>
                    <AssigneeMini task={child} allMembers={allMembers} currentUserId={currentUserId} />
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenActions(child.id); }}
                      className="flex-shrink-0 w-[24px] h-[24px] rounded-full flex items-center justify-center text-[#8e8e93] active:bg-[#f2f2f7]"
                      aria-label="Plus d'actions"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers pour regrouper une liste de tâches par projet
// ---------------------------------------------------------------------------

export type ProjectGroup = {
  parent: TaskListItem;
  subtasks: TaskListItem[];
};

/**
 * Sépare une liste de tâches en (projets groupés, tâches orphelines).
 * - Un parent = task dont l'id apparaît comme parent_project_id d'une autre.
 * - Les parents eux-mêmes sont retirés de la liste orpheline (virtuels).
 */
export function groupTasksByProject(tasks: TaskListItem[]): {
  projects: ProjectGroup[];
  orphans: TaskListItem[];
} {
  const parentIds = new Set<string>();
  for (const t of tasks) {
    if (t.parent_project_id) parentIds.add(t.parent_project_id);
  }

  const childrenByParent = new Map<string, TaskListItem[]>();
  for (const t of tasks) {
    if (t.parent_project_id && parentIds.has(t.parent_project_id)) {
      const list = childrenByParent.get(t.parent_project_id) ?? [];
      list.push(t);
      childrenByParent.set(t.parent_project_id, list);
    }
  }

  const projects: ProjectGroup[] = [];
  const orphans: TaskListItem[] = [];

  for (const t of tasks) {
    if (parentIds.has(t.id)) {
      // C'est un parent → carte projet
      const sorted = (childrenByParent.get(t.id) ?? []).sort((a, b) => {
        const da = a.next_due_at ? new Date(a.next_due_at).getTime() : Number.MAX_SAFE_INTEGER;
        const db = b.next_due_at ? new Date(b.next_due_at).getTime() : Number.MAX_SAFE_INTEGER;
        return da - db;
      });
      projects.push({ parent: t, subtasks: sorted });
    } else if (!t.parent_project_id) {
      orphans.push(t);
    }
    // Les enfants (parent_project_id non null) ne sont jamais orphelins
  }

  return { projects, orphans };
}
