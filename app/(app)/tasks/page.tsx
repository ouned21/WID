'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { filterTasks, splitTasksIntoSections } from '@/utils/taskSelectors';
import { frequencyLabel } from '@/utils/frequency';
import type { TaskListItem, TaskCategory } from '@/types/database';

// -- Chip iOS ------------------------------------------------------------------

function Chip({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-4 py-[7px] text-[13px] font-semibold transition-all"
      style={active
        ? { background: color ?? '#007aff', color: 'white' }
        : { background: 'white', color: '#3c3c43', boxShadow: '0 0.5px 2px rgba(0,0,0,0.08)' }
      }
    >
      {label}
    </button>
  );
}

// -- Carte tâche iOS -----------------------------------------------------------

function TaskCard({ task, onComplete, isCompleted }: {
  task: TaskListItem;
  onComplete: (id: string) => Promise<void>;
  isCompleted: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'success' | 'exit'>('idle');

  const handleClick = useCallback(async () => {
    if (phase !== 'idle' || isCompleted) return;
    setPhase('success');
    onComplete(task.id);
    // Phase success (carte verte) pendant 800ms, puis exit (glisse et disparait)
    setTimeout(() => setPhase('exit'), 800);
  }, [task.id, onComplete, phase, isCompleted]);

  const catColor = task.category?.color_hex ?? '#8e8e93';
  const scoreColor = task.mental_load_score >= 7 ? '#ff3b30' : task.mental_load_score >= 4 ? '#ff9500' : '#34c759';

  // Calcul automatique : texte sombre ou clair selon la luminosite du fond
  const textOnCat = (() => {
    const hex = catColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#1c1c1e' : '#ffffff';
  })();

  if (isCompleted) return null;

  return (
    <div
      className={`rounded-2xl overflow-hidden flex flex-col transition-all ${
        phase === 'idle' ? 'bg-white' :
        phase === 'success' ? 'bg-[#34c759] scale-[0.94] duration-300' :
        'bg-[#34c759] opacity-0 scale-[0.8] duration-500'
      }`}
      style={phase === 'idle' ? { boxShadow: '0 1px 6px rgba(0,0,0,0.08)' } : {}}
    >
      {phase !== 'idle' ? (
        <div className="flex flex-col items-center justify-center py-8 px-3">
          <svg width="36" height="36" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" viewBox="0 0 24 24" className="mb-2">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-[14px] font-bold text-white text-center">{task.name}</p>
          <p className="text-[12px] text-white/80 mt-0.5">Validé !</p>
        </div>
      ) : (
        <>
          {/* Bandeau catégorie en haut */}
          <div className="px-3 py-2 flex items-center justify-between" style={{ background: catColor }}>
            <span className="text-[11px] font-semibold truncate" style={{ color: textOnCat }}>{task.category?.name}</span>
            <span className="text-right leading-tight" style={{ color: textOnCat }}><span className="block text-[9px] opacity-70">Charge mentale</span><span className="text-[13px] font-bold">{task.mental_load_score}/10</span></span>
          </div>

          {/* Corps de la carte */}
          <div className="flex-1 p-3 flex flex-col">
            <Link href={`/tasks/${task.id}`} className="flex-1">
              <h3 className="text-[15px] font-semibold text-[#1c1c1e] leading-tight mb-2">{task.name}</h3>
            </Link>

            <div className="space-y-1 mb-3">
              <p className="text-[11px] text-[#8e8e93]">{frequencyLabel(task.frequency)}</p>
              {task.assignee && (
                <div className="flex items-center gap-1">
                  <span className="h-4 w-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ background: '#007aff' }}>
                    {task.assignee.display_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[11px] text-[#3c3c43]">{task.assignee.display_name}</span>
                </div>
              )}
              {task.next_due_at && (
                <p className="text-[11px] text-[#8e8e93]">
                  {new Date(task.next_due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  {' · '}
                  {new Date(task.next_due_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>

            {/* Actions empilées */}
            <div className="space-y-1.5 mt-auto">
              <button onClick={handleClick}
                className="w-full rounded-lg py-[7px] text-[13px] font-semibold text-white" style={{ background: '#34c759' }}>
                ✓ Fait
              </button>
              <Link href={`/tasks/${task.id}`}
                className="block w-full rounded-lg py-[7px] text-center text-[13px] font-medium text-[#007aff]"
                style={{ background: '#f2f2f7' }}>
                Détail
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// -- Section tâches iOS --------------------------------------------------------

const SECTION_COLORS: Record<string, string> = {
  'En retard': '#ff3b30',
  'Aujourd\'hui': '#007aff',
  'Demain': '#af52de',
  'Cette semaine': '#5856d6',
  'Plus tard': '#8e8e93',
};

function TaskSection({ title, tasks, onComplete, completedIds }: {
  title: string;
  tasks: TaskListItem[];
  onComplete: (id: string) => Promise<void>;
  completedIds: Set<string>;
}) {
  const visibleCount = tasks.filter((t) => !completedIds.has(t.id)).length;
  if (visibleCount === 0) return null;

  const color = SECTION_COLORS[title] ?? '#8e8e93';

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 px-4 mb-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color }}>
          {title}
        </h3>
        <span className="rounded-full min-w-[20px] text-center px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: color }}>{visibleCount}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 px-4">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onComplete={onComplete} isCompleted={completedIds.has(task.id)} />
        ))}
      </div>
    </section>
  );
}

// -- Page principale -----------------------------------------------------------

export default function TasksPage() {
  const { profile } = useAuthStore();
  const { tasks, filters, loading, fetchTasks, completeTask, setFilters } = useTaskStore();
  const { members } = useHouseholdStore();

  useEffect(() => {
    if (profile?.household_id) fetchTasks(profile.household_id);
  }, [profile?.household_id, fetchTasks]);

  const categories = useMemo(() => {
    const map = new Map<string, TaskCategory>();
    for (const task of tasks) {
      if (task.category && !map.has(task.category.id)) map.set(task.category.id, task.category);
    }
    return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [tasks]);

  const vacationUserIds = useMemo(() => {
    return new Set(members.filter((m) => m.vacation_mode).map((m) => m.id));
  }, [members]);

  const sections = useMemo(() => {
    const filtered = filterTasks(tasks, filters, profile?.id ?? '', vacationUserIds);
    return splitTasksIntoSections(filtered);
  }, [tasks, filters, profile?.id, vacationUserIds]);

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const totalTasks = tasks.filter((t) => !completedIds.has(t.id)).length;

  const handleComplete = useCallback(async (taskId: string) => {
    const completionPromise = completeTask(taskId);
    const timerPromise = new Promise<void>((resolve) => setTimeout(resolve, 1200));
    await Promise.all([completionPromise, timerPromise]);
    setCompletedIds((prev) => new Set(prev).add(taskId));
  }, [completeTask]);

  return (
    <div>
      {/* Header de page */}
      <div className="flex items-end justify-between px-4 pt-4 pb-3">
        <div>
          <h2 className="text-[28px] font-bold text-[#1c1c1e]">Tâches</h2>
          {totalTasks > 0 && (
            <p className="text-[13px] text-[#8e8e93]">{totalTasks} active{totalTasks > 1 ? 's' : ''}</p>
          )}
        </div>
        <Link
          href="/tasks/new"
          className="flex items-center gap-1 rounded-full px-4 py-2 text-[15px] font-semibold text-white"
          style={{ background: '#007aff' }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouvelle
        </Link>
      </div>

      {/* Filtres */}
      <div className="px-4 pb-2 space-y-2">
        <div className="flex flex-wrap gap-2">
          <Chip label="Toutes" active={filters.categoryId === 'all'} onClick={() => setFilters({ categoryId: 'all' })} />
          {categories.map((cat) => (
            <Chip key={cat.id} label={cat.name} active={filters.categoryId === cat.id} onClick={() => setFilters({ categoryId: cat.id })} color={cat.color_hex} />
          ))}
        </div>
        <div className="flex gap-2">
          <Chip label="Toutes" active={filters.assignment === 'all'} onClick={() => setFilters({ assignment: 'all' })} />
          <Chip label="Mes tâches" active={filters.assignment === 'mine'} onClick={() => setFilters({ assignment: 'mine' })} />
        </div>
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : totalTasks === 0 ? (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-3">🏠</p>
          <h3 className="text-[20px] font-bold text-[#1c1c1e]">Bienvenue dans votre foyer !</h3>
          <p className="mt-2 text-[15px] text-[#8e8e93] max-w-[280px] mx-auto">
            Commencez par ajouter vos premières tâches depuis le catalogue ou en créant les vôtres.
          </p>
          <div className="mt-6 space-y-2 max-w-[260px] mx-auto text-left">
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#f2f2f7' }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: '#007aff' }}>1</span>
              <span className="text-[14px] text-[#1c1c1e]">Créez vos tâches</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#f2f2f7' }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: '#af52de' }}>2</span>
              <span className="text-[14px] text-[#1c1c1e]">Assignez-les</span>
            </div>
            <div className="flex items-center gap-3 rounded-xl p-3" style={{ background: '#f2f2f7' }}>
              <span className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: '#34c759' }}>3</span>
              <span className="text-[14px] text-[#1c1c1e]">Suivez la répartition</span>
            </div>
          </div>
          <Link
            href="/tasks/new"
            className="mt-6 inline-block rounded-full px-6 py-2.5 text-[15px] font-semibold text-white"
            style={{ background: '#007aff' }}
          >
            Créer ma première tâche
          </Link>
        </div>
      ) : (
        <div className="pt-2">
          <TaskSection title="En retard" tasks={sections.overdue} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Aujourd'hui" tasks={sections.today} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Demain" tasks={sections.tomorrow} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Cette semaine" tasks={sections.week} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Plus tard" tasks={sections.later} onComplete={handleComplete} completedIds={completedIds} />

          {/* Lien archives */}
          <div className="px-4 pt-2 pb-4">
            <Link href="/tasks/archived"
              className="block w-full rounded-xl bg-white py-3 text-center text-[15px] font-medium text-[#8e8e93]"
              style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              📁 Voir les tâches archivées
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
