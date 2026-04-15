'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { taskScoreDisplay, scoreColor10, taskScoreCompare } from '@/utils/designSystem';
import {
  startOfWeek, endOfWeek, addWeeks, addDays, format, isSameDay,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay, isBefore, isAfter,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import type { TaskListItem } from '@/types/database';
import { computeDayLoads, generateRebalanceSuggestions, type RebalanceSuggestion } from '@/utils/rebalancer';

// -- Types -------------------------------------------------------------------

type ViewMode = 'week' | 'month';

// -- Helpers -----------------------------------------------------------------

function getTasksForDay(tasks: TaskListItem[], day: Date): TaskListItem[] {
  return tasks.filter((t) => {
    if (!t.next_due_at) return false;
    return isSameDay(new Date(t.next_due_at), day);
  });
}

function dayScore(tasks: TaskListItem[]): number {
  return tasks.reduce((sum, t) => sum + taskScoreCompare(t), 0);
}

// -- Composants --------------------------------------------------------------

function WeekDayHeader({ day, isToday }: { day: Date; isToday: boolean }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-semibold uppercase" style={{ color: isToday ? '#007aff' : '#8e8e93' }}>
        {format(day, 'EEE', { locale: fr })}
      </p>
      <p
        className="text-[15px] font-bold mt-0.5 mx-auto flex items-center justify-center rounded-full"
        style={{
          width: 30, height: 30,
          color: isToday ? 'white' : '#1c1c1e',
          background: isToday ? '#007aff' : 'transparent',
        }}
      >
        {format(day, 'd')}
      </p>
    </div>
  );
}

function TaskBlock({ task }: { task: TaskListItem }) {
  const score = taskScoreDisplay(task);
  const color = scoreColor10(score);
  const catColor = task.category?.color_hex ?? '#8e8e93';
  const assigneeLetter = task.assignee?.display_name?.charAt(0)?.toUpperCase() ?? '';

  return (
    <Link href={`/tasks/${task.id}`}
      className="block rounded-lg px-2 py-1.5 mb-1 transition-all active:scale-[0.97]"
      style={{ background: `${catColor}15`, borderLeft: `3px solid ${catColor}` }}>
      <p className="text-[9px] sm:text-[11px] font-semibold text-[#1c1c1e] truncate leading-tight">{task.name}</p>
      <div className="flex items-center gap-1 mt-0.5">
        <span className="text-[10px] font-bold" style={{ color }}>{score}</span>
        {assigneeLetter && (
          <span className="flex items-center justify-center rounded-full text-[8px] font-bold text-white"
            style={{ width: 14, height: 14, background: '#007aff' }}>
            {assigneeLetter}
          </span>
        )}
      </div>
    </Link>
  );
}

function WeekView({ tasks, weekStart, userId }: { tasks: TaskListItem[]; weekStart: Date; userId: string }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  return (
    <div>
      {/* Header jours */}
      <div className="grid grid-cols-7 gap-0.5 mb-3">
        {days.map((day) => (
          <WeekDayHeader key={day.toISOString()} day={day} isToday={isSameDay(day, today)} />
        ))}
      </div>

      {/* Contenu */}
      <div className="grid grid-cols-7 gap-0.5" style={{ minHeight: '400px' }}>
        {days.map((day) => {
          const dayTasks = getTasksForDay(tasks, day);
          const total = dayScore(dayTasks);
          const isHeavy = total > 20;
          const isToday2 = isSameDay(day, today);

          return (
            <div key={day.toISOString()}
              className="rounded-xl p-1.5 flex flex-col"
              style={{
                background: isToday2 ? '#EEF4FF' : isHeavy ? '#FFF5F5' : '#f9f9fb',
                minHeight: 120,
              }}>
              {/* Score du jour */}
              {dayTasks.length > 0 && (
                <p className="text-[9px] font-bold text-center mb-1" style={{ color: isHeavy ? '#ff3b30' : '#8e8e93' }}>
                  {total} pts
                </p>
              )}

              {/* Tâches */}
              <div className="flex-1 overflow-hidden">
                {dayTasks.slice(0, 4).map((t) => (
                  <TaskBlock key={t.id} task={t} />
                ))}
                {dayTasks.length > 4 && (
                  <p className="text-[9px] text-[#8e8e93] text-center">+{dayTasks.length - 4}</p>
                )}
              </div>

              {/* Ajouter */}
              <Link href={`/tasks/new?date=${format(day, 'yyyy-MM-dd')}`}
                className="text-[10px] text-center mt-auto pt-1"
                style={{ color: '#007aff' }}>
                +
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthView({ tasks, monthStart }: { tasks: TaskListItem[]; monthStart: Date }) {
  const today = new Date();
  const monthEnd2 = endOfMonth(monthStart);
  const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd2 });

  // Padding pour commencer au lundi
  const firstDayOfWeek = getDay(monthStart); // 0=dim, 1=lun...
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;

  return (
    <div>
      {/* Header jours de la semaine */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <p key={d} className="text-[10px] font-semibold text-[#8e8e93] text-center uppercase">{d}</p>
        ))}
      </div>

      {/* Grille */}
      <div className="grid grid-cols-7 gap-0.5">
        {/* Padding */}
        {Array.from({ length: paddingDays }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}

        {allDays.map((day) => {
          const dayTasks = getTasksForDay(tasks, day);
          const total = dayScore(dayTasks);
          const isToday2 = isSameDay(day, today);
          const isHeavy = total > 20;

          return (
            <Link key={day.toISOString()} href={`/tasks/new?date=${format(day, 'yyyy-MM-dd')}`}
              className="rounded-xl p-1.5 text-center flex flex-col items-center gap-0.5"
              style={{
                background: isToday2 ? '#EEF4FF' : 'transparent',
                minHeight: 48,
              }}>
              <span className="text-[13px] font-semibold" style={{ color: isToday2 ? '#007aff' : '#1c1c1e' }}>
                {format(day, 'd')}
              </span>

              {/* Points colorés */}
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 flex-wrap justify-center">
                  {dayTasks.slice(0, 3).map((t) => (
                    <span key={t.id} className="rounded-full"
                      style={{
                        width: 6, height: 6,
                        background: t.category?.color_hex ?? '#8e8e93',
                      }} />
                  ))}
                  {dayTasks.length > 3 && (
                    <span className="text-[8px] text-[#8e8e93]">+{dayTasks.length - 3}</span>
                  )}
                </div>
              )}

              {/* Score si lourd */}
              {isHeavy && (
                <span className="text-[8px] font-bold" style={{ color: '#ff3b30' }}>{total}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// -- Page principale ---------------------------------------------------------

export default function PlanningPage() {
  const { profile } = useAuthStore();
  const { tasks, loading, fetchTasks } = useTaskStore();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [applyingRebalance, setApplyingRebalance] = useState<string | null>(null);

  const today = new Date();
  const weekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const weekEnd2 = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 1 });
  const monthStart = startOfMonth(addWeeks(today, monthOffset * 4)); // approximation

  useEffect(() => {
    if (profile?.household_id && tasks.length === 0) {
      fetchTasks(profile.household_id);
    }
  }, [profile?.household_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Stats de la semaine
  const weekStats = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
    let totalScore = 0;
    let totalTasks = 0;
    for (const day of days) {
      const dt = getTasksForDay(tasks, day);
      totalTasks += dt.length;
      totalScore += dayScore(dt);
    }
    return { totalScore, totalTasks };
  }, [tasks, weekStart]);

  // Suggestions de rééquilibrage
  const rebalanceSuggestions = useMemo(() => {
    if (tasks.length === 0) return [];
    const dayLoads = computeDayLoads(tasks, 14, profile?.id);
    return generateRebalanceSuggestions(dayLoads, 3);
  }, [tasks, profile?.id]);

  const handleApplyRebalance = async (suggestion: RebalanceSuggestion) => {
    setApplyingRebalance(suggestion.task.id);
    const { createClient } = await import('@/lib/supabase');
    const supabase = createClient();
    await supabase
      .from('household_tasks')
      .update({ next_due_at: suggestion.toDate.toISOString() })
      .eq('id', suggestion.task.id);
    if (profile?.household_id) await fetchTasks(profile.household_id);
    setApplyingRebalance(null);
  };

  const weekLabel = `${format(weekStart, 'd MMM', { locale: fr })} — ${format(weekEnd2, 'd MMM yyyy', { locale: fr })}`;
  const monthLabel = format(monthStart, 'MMMM yyyy', { locale: fr });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-4 pt-4">
        <div>
          <h2 className="text-[28px] font-bold text-[#1c1c1e]">Planning</h2>
          <p className="text-[13px] text-[#8e8e93]">
            {weekStats.totalTasks} tâche{weekStats.totalTasks > 1 ? 's' : ''} cette semaine
          </p>
        </div>
        {/* Toggle semaine/mois */}
        <div className="flex rounded-lg overflow-hidden" style={{ background: '#f0f2f8' }}>
          <button onClick={() => setViewMode('week')}
            className="px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={viewMode === 'week' ? { background: '#007aff', color: 'white' } : { color: '#3c3c43' }}>
            Semaine
          </button>
          <button onClick={() => setViewMode('month')}
            className="px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={viewMode === 'month' ? { background: '#007aff', color: 'white' } : { color: '#3c3c43' }}>
            Mois
          </button>
        </div>
      </div>

      {/* Navigation temporelle */}
      <div className="flex items-center justify-between px-4">
        <button onClick={() => viewMode === 'week' ? setWeekOffset(weekOffset - 1) : setMonthOffset(monthOffset - 1)}
          className="text-[15px] font-medium" style={{ color: '#007aff' }}>
          ← Préc.
        </button>
        <p className="text-[15px] font-semibold text-[#1c1c1e] capitalize">
          {viewMode === 'week' ? weekLabel : monthLabel}
        </p>
        <button onClick={() => viewMode === 'week' ? setWeekOffset(weekOffset + 1) : setMonthOffset(monthOffset + 1)}
          className="text-[15px] font-medium" style={{ color: '#007aff' }}>
          Suiv. →
        </button>
      </div>

      {/* Score total semaine */}
      {viewMode === 'week' && weekStats.totalScore > 0 && (
        <div className="mx-4 rounded-2xl px-4 py-3 flex items-center justify-between"
          style={{ background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <span className="text-[13px] text-[#8e8e93]">Score total semaine</span>
          <span className="text-[20px] font-bold" style={{
            color: weekStats.totalScore > 100 ? '#ff3b30' : weekStats.totalScore > 60 ? '#ff9500' : '#34c759'
          }}>
            {weekStats.totalScore}
          </span>
        </div>
      )}

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : (
        <div className="mx-4">
          {viewMode === 'week' ? (
            <WeekView tasks={tasks} weekStart={weekStart} userId={profile?.id ?? ''} />
          ) : (
            <MonthView tasks={tasks} monthStart={monthStart} />
          )}
        </div>
      )}

      {/* Suggestions de rééquilibrage */}
      {rebalanceSuggestions.length > 0 && viewMode === 'week' && (
        <div className="mx-4">
          <p className="text-[11px] font-bold text-[#ff9500] uppercase tracking-[0.15em] mb-2 px-1">
            Rééquilibrage suggéré
          </p>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {rebalanceSuggestions.map((s, i) => (
              <div key={s.task.id}
                className="px-4 py-3"
                style={i < rebalanceSuggestions.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                <p className="text-[14px] font-semibold text-[#1c1c1e]">{s.task.name}</p>
                <p className="text-[12px] text-[#8e8e93] mt-0.5">
                  {s.fromDateStr} → {s.toDateStr} (−{s.scoreReduction} pts)
                </p>
                <button
                  onClick={() => handleApplyRebalance(s)}
                  disabled={applyingRebalance === s.task.id}
                  className="mt-2 rounded-lg px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                  style={{ background: '#ff9500' }}>
                  {applyingRebalance === s.task.id ? 'Décalage...' : 'Décaler'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bouton aujourd'hui */}
      {(weekOffset !== 0 || monthOffset !== 0) && (
        <div className="px-4">
          <button onClick={() => { setWeekOffset(0); setMonthOffset(0); }}
            className="w-full rounded-xl py-2.5 text-[14px] font-semibold text-center"
            style={{ color: '#007aff', background: '#EEF4FF' }}>
            Revenir à aujourd&apos;hui
          </button>
        </div>
      )}
    </div>
  );
}
