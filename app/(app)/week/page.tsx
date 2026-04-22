'use client';

/**
 * Page "Cette semaine" — Vue de coordination foyer sur 7 jours
 *
 * Objectif : permettre à Barbara et Jonathan de voir d'un coup d'œil
 * ce qui est planifié cette semaine et qui fait quoi.
 * Read-only — pas de planning lourd, juste de la visibilité.
 */

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import type { TaskListItem, HouseholdMember } from '@/types/database';

// ── Helpers ────────────────────────────────────────────────────────────────

const DURATION_LABEL: Record<string, string> = {
  very_short: '5 min',
  short:      '15 min',
  medium:     '30 min',
  long:       '1h',
  very_long:  '2h+',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getMemberColor(member: HouseholdMember, isMe: boolean): string {
  if (isMe) return '#007aff';
  if (member.isPhantom) return '#af52de';
  return '#34c759';
}

/** Retourne les 7 prochains jours (aujourd'hui inclus), minuit local */
function getNextSevenDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Clé YYYY-MM-DD locale (pas UTC) */
function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' });
}

function getDayDate(date: Date): string {
  if (new Date().toDateString() === date.toDateString()) return '';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── Sous-composants ────────────────────────────────────────────────────────

function MemberBadge({
  task,
  allMembers,
  currentUserId,
}: {
  task: TaskListItem;
  allMembers: HouseholdMember[];
  currentUserId: string;
}) {
  const member = task.assigned_to
    ? allMembers.find((m) => !m.isPhantom && m.id === task.assigned_to) ?? null
    : task.assigned_to_phantom_id
    ? allMembers.find((m) => m.isPhantom && m.id === task.assigned_to_phantom_id) ?? null
    : null;

  if (!member) {
    // Tâche non assignée → icône foyer neutre
    return (
      <div
        className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center text-[11px]"
        style={{ background: '#f2f2f7' }}
        title="Foyer"
      >
        👥
      </div>
    );
  }

  const isMe = !member.isPhantom && member.id === currentUserId;

  return (
    <div
      className="w-[26px] h-[26px] rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
      style={{ background: getMemberColor(member, isMe) }}
      title={member.display_name}
    >
      {getInitials(member.display_name)}
    </div>
  );
}

function WeekTaskRow({
  task,
  allMembers,
  currentUserId,
}: {
  task: TaskListItem;
  allMembers: HouseholdMember[];
  currentUserId: string;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 bg-white rounded-2xl"
      style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.07)' }}
    >
      <MemberBadge task={task} allMembers={allMembers} currentUserId={currentUserId} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{task.name}</p>
        {task.duration_estimate && (
          <p className="text-[12px] text-[#8e8e93] mt-0.5">
            ⏱ {DURATION_LABEL[task.duration_estimate] ?? task.duration_estimate}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Légende membres ────────────────────────────────────────────────────────

function MemberLegend({ allMembers, currentUserId }: { allMembers: HouseholdMember[]; currentUserId: string }) {
  if (allMembers.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 px-1">
      {allMembers.map((m) => {
        const isMe = !m.isPhantom && m.id === currentUserId;
        return (
          <div key={m.id} className="flex items-center gap-1.5">
            <div
              className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
              style={{ background: getMemberColor(m, isMe) }}
            >
              {getInitials(m.display_name)}
            </div>
            <span className="text-[12px] text-[#8e8e93]">
              {isMe ? 'Moi' : m.display_name}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────

export default function WeekPage() {
  const { profile } = useAuthStore();
  const { tasks, loading: tasksLoading, fetchTasks } = useTaskStore();
  const { allMembers, fetchHousehold, loading: householdLoading } = useHouseholdStore();

  useEffect(() => {
    if (!profile?.household_id) return;
    const hid = profile.household_id;
    fetchTasks(hid);
    fetchHousehold(hid);
  }, [profile?.household_id, fetchTasks, fetchHousehold]);

  const days = useMemo(() => getNextSevenDays(), []);

  /** Tasks groupées par jour (clé = YYYY-MM-DD local) */
  const grouped = useMemo(() => {
    const map = new Map<string, TaskListItem[]>();
    for (const day of days) {
      map.set(localDateKey(day), []);
    }
    for (const task of tasks) {
      if (!task.next_due_at) continue;
      const taskDate = new Date(task.next_due_at);
      const key = localDateKey(taskDate);
      if (map.has(key)) {
        map.get(key)!.push(task);
      }
    }
    return map;
  }, [tasks, days]);

  const totalCount = useMemo(
    () => [...grouped.values()].reduce((acc, t) => acc + t.length, 0),
    [grouped],
  );

  const isLoading = (tasksLoading || householdLoading) && tasks.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">

      {/* ── En-tête ── */}
      <div className="pt-1">
        <Link
          href="/today"
          className="inline-flex items-center gap-1 text-[14px] text-[#007aff] font-medium mb-3"
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Aujourd&apos;hui
        </Link>
        <h1 className="text-[28px] font-bold text-[#1c1c1e] leading-tight">Cette semaine</h1>
        <p className="text-[14px] text-[#8e8e93] mt-0.5">
          {totalCount > 0
            ? `${totalCount} tâche${totalCount > 1 ? 's' : ''} planifiée${totalCount > 1 ? 's' : ''} pour le foyer`
            : 'Vue de coordination foyer'}
        </p>
      </div>

      {/* ── Légende membres ── */}
      {allMembers.length > 0 && (
        <MemberLegend allMembers={allMembers} currentUserId={profile?.id ?? ''} />
      )}

      {/* ── Semaine vide ── */}
      {totalCount === 0 && (
        <div
          className="rounded-2xl bg-white px-4 py-12 text-center"
          style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}
        >
          <p className="text-[40px] mb-2">✨</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Semaine tranquille</p>
          <p className="text-[14px] text-[#8e8e93] mt-1">Aucune tâche planifiée sur les 7 prochains jours</p>
        </div>
      )}

      {/* ── Jours ── */}
      {days.map((day) => {
        const key = localDateKey(day);
        const dayTasks = grouped.get(key) ?? [];
        const isToday = day.toDateString() === new Date().toDateString();
        const label = getDayLabel(day);
        const dateStr = getDayDate(day);

        return (
          <div key={key}>
            {/* Label jour */}
            <div className="flex items-baseline gap-2 px-1 mb-2">
              <p
                className={`text-[13px] font-semibold uppercase tracking-wide ${
                  isToday ? 'text-[#007aff]' : 'text-[#8e8e93]'
                }`}
              >
                {label}
              </p>
              {dateStr && (
                <p className="text-[12px] text-[#c7c7cc]">{dateStr}</p>
              )}
              {dayTasks.length > 0 && (
                <p className="text-[12px] text-[#c7c7cc] ml-auto">
                  {dayTasks.length} tâche{dayTasks.length > 1 ? 's' : ''}
                </p>
              )}
            </div>

            {/* Tâches du jour */}
            {dayTasks.length === 0 ? (
              <div
                className="rounded-2xl px-4 py-3 text-[13px] text-[#c7c7cc] italic"
                style={{ background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}
              >
                Rien de prévu
              </div>
            ) : (
              <div className="space-y-1.5">
                {dayTasks.map((task) => (
                  <WeekTaskRow
                    key={task.id}
                    task={task}
                    allMembers={allMembers}
                    currentUserId={profile?.id ?? ''}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
