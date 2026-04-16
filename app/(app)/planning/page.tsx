'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { taskScoreDisplay, scoreColor10, taskScoreCompare } from '@/utils/designSystem';
import {
  addDays, addWeeks, addMonths, format, isSameDay,
  startOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TaskListItem } from '@/types/database';

type ViewMode = 'week' | 'month';

const CATEGORY_EMOJI: Record<string, string> = {
  cleaning: '🧹', tidying: '🗂', shopping: '🛒', laundry: '👕',
  meals: '🍳', children: '👶', admin: '📋', transport: '🚗',
  household_management: '🏠', outdoor: '🌿', hygiene: '🪥',
  pets: '🐾', vehicle: '🔧', misc: '📌',
};

function getTasksForDay(tasks: TaskListItem[], day: Date): TaskListItem[] {
  return tasks.filter((t) => t.next_due_at && isSameDay(new Date(t.next_due_at), day));
}

function dayLoad(tasks: TaskListItem[]) {
  return tasks.reduce((s, t) => s + taskScoreCompare(t), 0);
}

// ── Puce de jour (selector horizontal) ──────────────────────────────────────

function DayChip({
  day, tasks, isSelected, isToday, onClick,
}: {
  day: Date; tasks: TaskListItem[]; isSelected: boolean; isToday: boolean; onClick: () => void;
}) {
  const count = tasks.length;
  const load = dayLoad(tasks);
  const isHeavy = load > 20;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1 flex-shrink-0 rounded-2xl transition-all"
      style={{
        width: 52, padding: '10px 0',
        background: isSelected ? '#007aff' : isToday ? '#EEF4FF' : 'white',
        boxShadow: isSelected ? '0 4px 12px rgba(0,122,255,0.3)' : '0 1px 3px rgba(0,0,0,0.04)',
      }}
    >
      <span className="text-[10px] font-semibold uppercase"
        style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : '#8e8e93' }}>
        {format(day, 'EEE', { locale: fr })}
      </span>
      <span className="text-[18px] font-bold"
        style={{ color: isSelected ? 'white' : isToday ? '#007aff' : '#1c1c1e' }}>
        {format(day, 'd')}
      </span>
      {count > 0 ? (
        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
          style={{
            background: isSelected ? 'rgba(255,255,255,0.25)' : isHeavy ? '#ff3b30' : '#34c759',
            color: isSelected ? 'white' : 'white',
          }}>
          {count}
        </span>
      ) : (
        <span className="text-[10px]" style={{ color: isSelected ? 'rgba(255,255,255,0.4)' : '#c7c7cc' }}>·</span>
      )}
    </button>
  );
}

// ── Carte de tâche (vue jour) ─────────────────────────────────────────────────

function TaskCard({ task }: { task: TaskListItem }) {
  const score = taskScoreDisplay(task);
  const color = scoreColor10(score);
  const catColor = task.category?.color_hex ?? '#8e8e93';
  const emoji = CATEGORY_EMOJI[task.scoring_category ?? ''] ?? '📌';
  const assignee = task.assignee?.display_name ?? null;

  return (
    <Link href={`/tasks/${task.id}`}
      className="flex items-center gap-3 px-4 py-3.5 transition-all active:scale-[0.98]"
      style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
      {/* Icône catégorie */}
      <div className="flex items-center justify-center rounded-xl flex-shrink-0 text-[20px]"
        style={{ width: 44, height: 44, background: `${catColor}15` }}>
        {emoji}
      </div>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-semibold text-[#1c1c1e] truncate">{task.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {assignee && (
            <span className="text-[12px] text-[#8e8e93]">👤 {assignee}</span>
          )}
          {task.duration_estimate && (
            <span className="text-[12px] text-[#8e8e93]">
              ⏱ {
                task.duration_estimate === 'very_short' ? '5 min' :
                task.duration_estimate === 'short' ? '15 min' :
                task.duration_estimate === 'medium' ? '30 min' :
                task.duration_estimate === 'long' ? '1h' : '2h+'
              }
            </span>
          )}
        </div>
      </div>

      {/* Score */}
      <div className="flex flex-col items-end gap-1">
        <span className="text-[13px] font-bold" style={{ color }}>{score}/10</span>
        <div className="w-2 h-2 rounded-full" style={{ background: catColor }} />
      </div>
    </Link>
  );
}

// ── Vue Semaine ──────────────────────────────────────────────────────────────

function WeekView({ tasks, weekStart }: { tasks: TaskListItem[]; weekStart: Date }) {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Sélectionner aujourd'hui si dans la semaine, sinon le premier jour
  const defaultDay = days.find((d) => isSameDay(d, today)) ?? days[0];
  const [selectedDay, setSelectedDay] = useState<Date>(defaultDay);

  // Mettre à jour selectedDay si weekStart change
  useEffect(() => {
    const newDefault = days.find((d) => isSameDay(d, today)) ?? days[0];
    setSelectedDay(newDefault);
  }, [weekStart.toISOString()]); // eslint-disable-line react-hooks/exhaustive-deps

  const dayTasks = getTasksForDay(tasks, selectedDay);
  const totalLoad = dayLoad(dayTasks);

  return (
    <div>
      {/* Sélecteur de jour horizontal */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {days.map((day) => (
          <DayChip
            key={day.toISOString()}
            day={day}
            tasks={getTasksForDay(tasks, day)}
            isSelected={isSameDay(day, selectedDay)}
            isToday={isSameDay(day, today)}
            onClick={() => setSelectedDay(day)}
          />
        ))}
      </div>

      {/* Header du jour sélectionné */}
      <div className="mx-4 mt-3 mb-2 flex items-center justify-between">
        <div>
          <p className="text-[18px] font-bold text-[#1c1c1e] capitalize">
            {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
          </p>
          {dayTasks.length > 0 && (
            <p className="text-[12px] text-[#8e8e93] mt-0.5">
              {dayTasks.length} tâche{dayTasks.length > 1 ? 's' : ''} · charge {totalLoad > 20 ? '🔴' : totalLoad > 10 ? '🟡' : '🟢'} {totalLoad} pts
            </p>
          )}
        </div>
        <Link
          href={`/tasks/new?date=${format(selectedDay, 'yyyy-MM-dd')}`}
          className="flex items-center gap-1 rounded-xl px-3 py-2 text-[13px] font-semibold"
          style={{ background: '#EEF4FF', color: '#007aff' }}
        >
          + Tâche
        </Link>
      </div>

      {/* Liste des tâches */}
      {dayTasks.length === 0 ? (
        <div className="mx-4 rounded-2xl bg-white py-10 text-center"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[32px] mb-2">☀️</p>
          <p className="text-[15px] font-semibold text-[#1c1c1e]">Journée libre</p>
          <p className="text-[13px] text-[#8e8e93] mt-1">Aucune tâche prévue ce jour-là</p>
        </div>
      ) : (
        <div className="mx-4 rounded-2xl bg-white overflow-hidden"
          style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          {dayTasks
            .sort((a, b) => taskScoreCompare(b) - taskScoreCompare(a))
            .map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          {/* Dernière ligne sans bordure → retire le borderBottom du dernier */}
        </div>
      )}
    </div>
  );
}

// ── Vue Mois ─────────────────────────────────────────────────────────────────

function MonthView({ tasks, monthStart }: { tasks: TaskListItem[]; monthStart: Date }) {
  const today = new Date();
  const monthEnd = endOfMonth(monthStart);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const firstDow = getDay(monthStart);
  const paddingDays = firstDow === 0 ? 6 : firstDow - 1;

  const selectedTasks = selectedDay ? getTasksForDay(tasks, selectedDay) : [];

  return (
    <div>
      {/* En-têtes jours */}
      <div className="grid grid-cols-7 gap-1 px-4 mb-1">
        {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
          <p key={i} className="text-[11px] font-bold text-center text-[#8e8e93]">{d}</p>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-1 px-4">
        {Array.from({ length: paddingDays }).map((_, i) => <div key={`pad-${i}`} />)}

        {allDays.map((day) => {
          const dt = getTasksForDay(tasks, day);
          const load = dayLoad(dt);
          const isToday = isSameDay(day, today);
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;
          const isHeavy = load > 20;
          const isMedium = load > 8 && load <= 20;

          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className="rounded-xl flex flex-col items-center justify-start transition-all"
              style={{
                minHeight: 52, paddingTop: 6,
                background: isSelected ? '#007aff' : isToday ? '#EEF4FF' : 'white',
                boxShadow: isSelected ? '0 4px 12px rgba(0,122,255,0.25)' : '0 0.5px 2px rgba(0,0,0,0.04)',
              }}
            >
              <span className="text-[13px] font-semibold"
                style={{ color: isSelected ? 'white' : isToday ? '#007aff' : '#1c1c1e' }}>
                {format(day, 'd')}
              </span>

              {dt.length > 0 && (
                <div className="flex gap-0.5 mt-1 flex-wrap justify-center px-1">
                  {dt.slice(0, 3).map((t) => (
                    <span key={t.id} className="rounded-full"
                      style={{
                        width: 5, height: 5,
                        background: isSelected ? 'rgba(255,255,255,0.7)' : (t.category?.color_hex ?? '#8e8e93'),
                      }} />
                  ))}
                </div>
              )}

              {(isHeavy || isMedium) && (
                <span className="text-[9px] font-bold mt-0.5"
                  style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : isHeavy ? '#ff3b30' : '#ff9500' }}>
                  {load}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Détail du jour sélectionné */}
      {selectedDay && (
        <div className="mx-4 mt-4">
          <p className="text-[13px] font-bold text-[#8e8e93] uppercase tracking-[0.1em] mb-2 px-1 capitalize">
            {format(selectedDay, 'EEEE d MMMM', { locale: fr })}
          </p>

          {selectedTasks.length === 0 ? (
            <div className="rounded-2xl bg-white py-6 text-center"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-[13px] text-[#8e8e93]">Aucune tâche ce jour-là</p>
              <Link href={`/tasks/new?date=${format(selectedDay, 'yyyy-MM-dd')}`}
                className="inline-block mt-2 text-[13px] font-semibold"
                style={{ color: '#007aff' }}>
                + Ajouter une tâche
              </Link>
            </div>
          ) : (
            <div className="rounded-2xl bg-white overflow-hidden"
              style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {selectedTasks
                .sort((a, b) => taskScoreCompare(b) - taskScoreCompare(a))
                .map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bottom sheet "Toutes les tâches" ─────────────────────────────────────────

type TaskActionSheetProps = {
  tasks: TaskListItem[];
  onClose: () => void;
  onArchive: (taskId: string) => void;
  onAssign: (taskId: string, memberId: string | null, isPhantom: boolean) => void;
};

// Carte tâche avec actions (assigner + retirer)
function ActionTaskRow({
  task,
  onArchive,
  onAssign,
  localAssigneeName,
}: {
  task: TaskListItem;
  onArchive: (id: string) => void;
  onAssign: (id: string, memberId: string | null, name: string, isPhantom: boolean) => void;
  localAssigneeName: string | null;
}) {
  const { allMembers } = useHouseholdStore();
  const [isAssigning, setIsAssigning] = useState(false);
  const emoji = CATEGORY_EMOJI[task.scoring_category ?? ''] ?? '📌';
  const catColor = task.category?.color_hex ?? '#8e8e93';
  const assigneeName = localAssigneeName ?? task.assignee?.display_name ?? null;

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.07)' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="flex items-center justify-center rounded-xl flex-shrink-0 text-[18px]"
          style={{ width: 40, height: 40, background: `${catColor}18` }}>
          {emoji}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#1c1c1e] truncate">{task.name}</p>
          <p className="text-[12px] text-[#8e8e93] mt-0.5">
            {task.next_due_at ? format(new Date(task.next_due_at), 'd MMM', { locale: fr }) : 'Non planifié'}
            {assigneeName && <span className="ml-2">· 👤 {assigneeName}</span>}
          </p>
        </div>
      </div>

      {!isAssigning ? (
        <div className="flex border-t" style={{ borderColor: '#f0f2f8' }}>
          <button onClick={() => setIsAssigning(true)}
            className="flex-1 py-2.5 text-[13px] font-semibold text-center"
            style={{ color: '#007aff', borderRight: '0.5px solid #f0f2f8' }}>
            👤 Assigner
          </button>
          <button onClick={() => onArchive(task.id)}
            className="flex-1 py-2.5 text-[13px] font-semibold text-center"
            style={{ color: '#ff3b30' }}>
            🗑 Retirer
          </button>
        </div>
      ) : (
        <div className="border-t px-4 py-3" style={{ borderColor: '#f0f2f8', background: '#fafafa' }}>
          <p className="text-[12px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2">
            Qui s&apos;en occupe ?
          </p>
          <div className="flex flex-wrap gap-2">
            {allMembers.map((m) => (
              <button key={m.id}
                onClick={() => { onAssign(task.id, m.id, m.display_name, m.isPhantom); setIsAssigning(false); }}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold"
                style={{
                  background: m.isPhantom ? 'linear-gradient(135deg, #8e8e93, #636366)' : 'linear-gradient(135deg, #007aff, #5856d6)',
                  color: 'white',
                }}>
                {m.isPhantom ? '👻' : '👤'} {m.display_name}
              </button>
            ))}
            <button onClick={() => { onAssign(task.id, null, '—', false); setIsAssigning(false); }}
              className="rounded-xl px-3 py-2 text-[13px] font-semibold"
              style={{ background: '#f0f2f8', color: '#8e8e93' }}>
              Non assigné
            </button>
            <button onClick={() => setIsAssigning(false)}
              className="rounded-xl px-3 py-2 text-[13px] font-semibold"
              style={{ background: '#fff0f0', color: '#ff3b30' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Ligne simple sans actions (tâches lointaines)
function SimpleTaskRow({ task }: { task: TaskListItem }) {
  const emoji = CATEGORY_EMOJI[task.scoring_category ?? ''] ?? '📌';
  const catColor = task.category?.color_hex ?? '#8e8e93';
  return (
    <div className="flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: '0.5px solid #f0f2f8' }}>
      <div className="flex items-center justify-center rounded-xl flex-shrink-0 text-[16px]"
        style={{ width: 36, height: 36, background: `${catColor}15` }}>
        {emoji}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#1c1c1e] truncate">{task.name}</p>
        {task.next_due_at && (
          <p className="text-[12px] text-[#8e8e93]">
            {format(new Date(task.next_due_at), 'd MMM', { locale: fr })}
          </p>
        )}
      </div>
    </div>
  );
}

function TaskActionSheet({ tasks, onClose, onArchive, onAssign }: TaskActionSheetProps) {
  const now = new Date();
  const in7Days = addDays(now, 7);
  const in30Days = addDays(now, 30);

  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [assignedNames, setAssignedNames] = useState<Record<string, string>>({});
  const [showLater, setShowLater] = useState(false);

  const visible = tasks.filter((t) => !archived.has(t.id) && t.next_due_at);

  // 3 groupes selon l'urgence
  const soon   = visible.filter((t) => new Date(t.next_due_at!) <= in7Days);
  const thisMonth = visible.filter((t) => { const d = new Date(t.next_due_at!); return d > in7Days && d <= in30Days; });
  const later  = visible.filter((t) => new Date(t.next_due_at!) > in30Days);

  const handleArchive = useCallback((id: string) => {
    setArchived((p) => new Set([...p, id]));
    onArchive(id);
  }, [onArchive]);

  const handleAssign = useCallback((id: string, memberId: string | null, name: string, isPhantom: boolean) => {
    setAssignedNames((p) => ({ ...p, [id]: name }));
    onAssign(id, memberId, isPhantom);
  }, [onAssign]);

  return (
    <div className="fixed inset-0 z-[70] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative rounded-t-[28px] bg-[#f6f8ff] w-full max-h-[88vh] flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

        {/* Handle + header */}
        <div className="flex-shrink-0 px-5 pt-3 pb-4 bg-white rounded-t-[28px]">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full" style={{ background: '#e5e5ea' }} />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[18px] font-bold text-[#1c1c1e]">Personnalise ton planning</p>
              <p className="text-[13px] text-[#8e8e93]">{visible.length} tâches · assigne celles qui arrivent bientôt</p>
            </div>
            <button onClick={onClose}
              className="flex items-center justify-center rounded-full h-8 w-8 text-[15px] font-bold"
              style={{ background: '#f0f2f8', color: '#8e8e93' }}>
              ✕
            </button>
          </div>
        </div>

        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto px-4 pb-10 pt-4 space-y-5">

          {/* ── Groupe 1 : Cette semaine (ACTIF) ── */}
          <div>
            <p className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
              🔥 Cette semaine · {soon.length} tâche{soon.length > 1 ? 's' : ''}
            </p>
            {soon.length === 0 ? (
              <div className="rounded-2xl bg-white px-4 py-5 text-center"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                <p className="text-[13px] text-[#8e8e93]">Rien de prévu cette semaine 🎉</p>
              </div>
            ) : (
              <div className="space-y-2">
                {soon.map((t) => (
                  <ActionTaskRow
                    key={t.id}
                    task={t}
                    onArchive={handleArchive}
                    onAssign={handleAssign}
                    localAssigneeName={assignedNames[t.id] ?? null}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Groupe 2 : Ce mois (liste simple, pas d'actions) ── */}
          {thisMonth.length > 0 && (
            <div>
              <p className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">
                📅 Dans les 30 jours · {thisMonth.length} tâches
              </p>
              <div className="rounded-2xl bg-white overflow-hidden"
                style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                {thisMonth.map((t) => <SimpleTaskRow key={t.id} task={t} />)}
              </div>
            </div>
          )}

          {/* ── Groupe 3 : Plus tard (collapsed) ── */}
          {later.length > 0 && (
            <div>
              <button
                onClick={() => setShowLater((p) => !p)}
                className="w-full flex items-center justify-between px-1 mb-2"
              >
                <p className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wide">
                  🗓 Plus tard · {later.length} tâches
                </p>
                <span className="text-[12px] text-[#8e8e93]">{showLater ? '▲ Masquer' : '▼ Voir'}</span>
              </button>
              {showLater && (
                <div className="rounded-2xl bg-white overflow-hidden"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
                  {later.map((t) => <SimpleTaskRow key={t.id} task={t} />)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section "Toutes les tâches à venir" (planning page) ──────────────────────

function AllTasksSection({ tasks }: { tasks: TaskListItem[] }) {
  const { archiveTask, updateTask } = useTaskStore();
  const [showSheet, setShowSheet] = useState(false);
  const PREVIEW_COUNT = 8;

  const sorted = useMemo(() =>
    [...tasks]
      .filter((t) => t.next_due_at)
      .sort((a, b) => new Date(a.next_due_at!).getTime() - new Date(b.next_due_at!).getTime()),
    [tasks],
  );

  // Preview : priorité aux tâches de la semaine
  const now = new Date();
  const in7Days = addDays(now, 7);
  const soonTasks = sorted.filter((t) => new Date(t.next_due_at!) <= in7Days);
  const preview = soonTasks.length >= 3
    ? sorted.slice(0, PREVIEW_COUNT)   // si on a des tâches urgentes, montrer les premières
    : sorted.slice(0, PREVIEW_COUNT);  // sinon pareil (les plus proches)
  const remaining = sorted.length - PREVIEW_COUNT;

  const handleArchive = useCallback(async (taskId: string) => {
    await archiveTask(taskId);
  }, [archiveTask]);

  const handleAssign = useCallback(async (taskId: string, memberId: string | null, isPhantom: boolean) => {
    await updateTask(taskId, {
      assigned_to: isPhantom ? null : memberId,
      assigned_to_phantom_id: isPhantom ? memberId : null,
    });
  }, [updateTask]);

  if (sorted.length === 0) return null;

  return (
    <>
      <div className="px-4 mt-2">
        {/* Header section */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wide">Ton planning</p>
            <p className="text-[20px] font-black text-[#1c1c1e]">Aura a tout organisé pour toi.</p>
          </div>
        </div>

        {/* Preview list */}
        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          {preview.map((task, i) => {
            const emoji = CATEGORY_EMOJI[task.scoring_category ?? ''] ?? '📌';
            const catColor = task.category?.color_hex ?? '#8e8e93';
            return (
              <div key={task.id} className="flex items-center gap-3 px-4 py-3"
                style={i < preview.length - 1 ? { borderBottom: '0.5px solid #f0f2f8' } : {}}>
                <div className="flex items-center justify-center rounded-xl flex-shrink-0 text-[16px]"
                  style={{ width: 38, height: 38, background: `${catColor}18` }}>
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1c1c1e] truncate">{task.name}</p>
                  <p className="text-[12px] text-[#8e8e93]">
                    {format(new Date(task.next_due_at!), 'EEE d MMM', { locale: fr })}
                    {task.assignee?.display_name && (
                      <span className="ml-2">· 👤 {task.assignee.display_name}</span>
                    )}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Bouton "+ N autres" */}
          {remaining > 0 && (
            <button
              onClick={() => setShowSheet(true)}
              className="w-full py-3.5 text-[14px] font-semibold text-center"
              style={{ color: '#007aff', borderTop: '0.5px solid #f0f2f8' }}
            >
              + {remaining} autres
            </button>
          )}
        </div>
      </div>

      {/* Bottom sheet */}
      {showSheet && (
        <TaskActionSheet
          tasks={sorted}
          onClose={() => setShowSheet(false)}
          onArchive={handleArchive}
          onAssign={handleAssign}
        />
      )}
    </>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function PlanningPage() {
  const { profile } = useAuthStore();
  const { tasks, loading, fetchTasks } = useTaskStore();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const monthStart = startOfMonth(addMonths(today, monthOffset));

  useEffect(() => {
    if (profile?.household_id && tasks.length === 0) {
      fetchTasks(profile.household_id);
    }
  }, [profile?.household_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats globales
  const weekStats = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    const totalTasks = days.reduce((s, d) => s + getTasksForDay(tasks, d).length, 0);
    const totalLoad = days.reduce((s, d) => s + dayLoad(getTasksForDay(tasks, d)), 0);
    return { totalTasks, totalLoad };
  }, [tasks, weekStart]);

  const weekLabel = format(weekStart, "'Sem.' w · MMM yyyy", { locale: fr });
  const monthLabel = format(monthStart, 'MMMM yyyy', { locale: fr });

  return (
    <div className="pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header */}
      <div className="px-4 pt-4 flex items-end justify-between">
        <div>
          <h2 className="text-[28px] font-bold text-[#1c1c1e]">Planning</h2>
          <p className="text-[13px] text-[#8e8e93] mt-0.5">
            {viewMode === 'week'
              ? `${weekStats.totalTasks} tâche${weekStats.totalTasks > 1 ? 's' : ''} · ${weekStats.totalLoad} pts cette semaine`
              : format(monthStart, 'MMMM yyyy', { locale: fr })}
          </p>
        </div>

        {/* Toggle semaine / mois */}
        <div className="flex rounded-xl overflow-hidden p-0.5" style={{ background: '#f0f2f8' }}>
          <button onClick={() => setViewMode('week')}
            className="px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-all"
            style={viewMode === 'week'
              ? { background: 'white', color: '#007aff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { color: '#8e8e93' }}>
            Semaine
          </button>
          <button onClick={() => setViewMode('month')}
            className="px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-all"
            style={viewMode === 'month'
              ? { background: 'white', color: '#007aff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
              : { color: '#8e8e93' }}>
            Mois
          </button>
        </div>
      </div>

      {/* Navigation temporelle */}
      <div className="flex items-center justify-between px-4">
        <button
          onClick={() => viewMode === 'week' ? setWeekOffset(weekOffset - 1) : setMonthOffset(monthOffset - 1)}
          className="flex items-center justify-center rounded-xl w-9 h-9"
          style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', color: '#007aff' }}>
          ‹
        </button>

        <button
          onClick={() => { setWeekOffset(0); setMonthOffset(0); }}
          className="text-[14px] font-semibold capitalize"
          style={{ color: (weekOffset === 0 && monthOffset === 0) ? '#8e8e93' : '#007aff' }}>
          {viewMode === 'week' ? weekLabel : monthLabel}
        </button>

        <button
          onClick={() => viewMode === 'week' ? setWeekOffset(weekOffset + 1) : setMonthOffset(monthOffset + 1)}
          className="flex items-center justify-center rounded-xl w-9 h-9"
          style={{ background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', color: '#007aff' }}>
          ›
        </button>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="mx-4 rounded-3xl bg-white py-16 text-center"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <p className="text-[48px] mb-3">📅</p>
          <p className="text-[17px] font-bold text-[#1c1c1e]">Aucune tâche planifiée</p>
          <p className="text-[13px] text-[#8e8e93] mt-1 mb-4">Crée des tâches pour les voir ici</p>
          <Link href="/tasks/new"
            className="inline-block rounded-xl px-5 py-2.5 text-[14px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
            + Créer une tâche
          </Link>
        </div>
      ) : (
        <>
          {viewMode === 'week' ? (
            <WeekView tasks={tasks} weekStart={weekStart} />
          ) : (
            <MonthView tasks={tasks} monthStart={monthStart} />
          )}
          <AllTasksSection tasks={tasks} />
        </>
      )}
    </div>
  );
}
