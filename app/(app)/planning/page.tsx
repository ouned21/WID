'use client';

import { useEffect, useMemo, useState } from 'react';
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
      ) : viewMode === 'week' ? (
        <WeekView tasks={tasks} weekStart={weekStart} />
      ) : (
        <MonthView tasks={tasks} monthStart={monthStart} />
      )}
    </div>
  );
}
