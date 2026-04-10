'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { filterTasks, splitTasksIntoSections } from '@/utils/taskSelectors';
import { frequencyLabel } from '@/utils/frequency';
import type { TaskListItem, TaskCategory } from '@/types/database';

// -- Chip de filtre ------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
        active
          ? 'text-white shadow-sm'
          : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
      }`}
      style={active ? { backgroundColor: color ?? '#6366f1' } : {}}
    >
      {label}
    </button>
  );
}

// -- Carte de tâche ------------------------------------------------------------

function TaskCard({
  task,
  onComplete,
  isCompleted,
}: {
  task: TaskListItem;
  onComplete: (id: string) => Promise<void>;
  isCompleted: boolean;
}) {
  const [clicked, setClicked] = useState(false);

  const handleClick = useCallback(async () => {
    if (clicked || isCompleted) return;
    setClicked(true);
    onComplete(task.id);
  }, [task.id, onComplete, clicked, isCompleted]);

  const categoryColor = task.category?.color_hex ?? '#94a3b8';

  if (isCompleted) return null;

  return (
    <div className={`rounded-2xl border-l-4 p-4 shadow-sm transition-all duration-500 ${
      clicked ? 'bg-emerald-50 border-emerald-400 scale-[0.98]' : 'bg-white hover:shadow-md'
    }`}
    style={!clicked ? { borderLeftColor: categoryColor } : undefined}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <Link
            href={`/tasks/${task.id}`}
            className="text-sm font-bold text-slate-900 hover:text-indigo-600 transition-colors"
          >
            {task.name}
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span
              className="rounded-full px-2 py-0.5 font-medium text-white"
              style={{ backgroundColor: categoryColor }}
            >
              {task.category?.name}
            </span>
            <span className="text-slate-400">{frequencyLabel(task.frequency)}</span>
            {task.assignee && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 font-medium text-indigo-600">
                {task.assignee.display_name}
              </span>
            )}
            {task.next_due_at && (
              <span className="text-slate-400">
                {new Date(task.next_due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        {/* Score charge mentale — cercle coloré */}
        <div className={`flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-full ${
          task.mental_load_score >= 7 ? 'bg-red-100 text-red-700' :
          task.mental_load_score >= 4 ? 'bg-amber-100 text-amber-700' :
          'bg-emerald-100 text-emerald-700'
        }`}>
          <span className="text-sm font-bold leading-none">{task.mental_load_score}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {clicked ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white">
            ✓ Validé !
          </span>
        ) : (
          <button
            onClick={handleClick}
            className="rounded-lg bg-emerald-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600 transition-colors"
          >
            ✓ Fait
          </button>
        )}
        <Link
          href={`/tasks/${task.id}`}
          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
        >
          Modifier
        </Link>
      </div>
    </div>
  );
}

// -- Section de tâches ---------------------------------------------------------

const SECTION_STYLES: Record<string, { accent: string; bg: string; dot: string }> = {
  'En retard': { accent: 'text-red-600', bg: 'bg-red-50', dot: 'bg-red-500' },
  'Aujourd\'hui': { accent: 'text-indigo-600', bg: 'bg-indigo-50', dot: 'bg-indigo-500' },
  'Demain': { accent: 'text-violet-600', bg: 'bg-violet-50', dot: 'bg-violet-500' },
  'Cette semaine': { accent: 'text-sky-600', bg: 'bg-sky-50', dot: 'bg-sky-500' },
  'Plus tard': { accent: 'text-slate-500', bg: 'bg-slate-50', dot: 'bg-slate-400' },
};

function TaskSection({
  title,
  tasks,
  onComplete,
  completedIds,
}: {
  title: string;
  tasks: TaskListItem[];
  onComplete: (id: string) => Promise<void>;
  completedIds: Set<string>;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const style = SECTION_STYLES[title] ?? SECTION_STYLES['Plus tard'];

  // Ne pas compter les tâches déjà complétées dans le total affiché
  const visibleCount = tasks.filter((t) => !completedIds.has(t.id)).length;
  if (visibleCount === 0) return null;

  return (
    <section>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`mb-3 flex w-full items-center gap-2 rounded-lg ${style.bg} px-3 py-2`}
      >
        <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
        <span className={`text-sm font-bold ${style.accent}`}>
          {title}
        </span>
        <span className={`rounded-full ${style.bg} px-2 py-0.5 text-xs font-bold ${style.accent}`}>
          {visibleCount}
        </span>
        <span className={`ml-auto text-xs ${style.accent} transition-transform ${collapsed ? '' : 'rotate-90'}`}>
          ›
        </span>
      </button>
      {!collapsed && (
        <div className="space-y-3 pl-1">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onComplete={onComplete} isCompleted={completedIds.has(task.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

// -- Page principale -----------------------------------------------------------

export default function TasksPage() {
  const { profile } = useAuthStore();
  const { tasks, filters, loading, fetchTasks, completeTask, setFilters } = useTaskStore();

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks]);

  const categories = useMemo(() => {
    const map = new Map<string, TaskCategory>();
    for (const task of tasks) {
      if (task.category && !map.has(task.category.id)) {
        map.set(task.category.id, task.category);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [tasks]);

  const sections = useMemo(() => {
    const filtered = filterTasks(tasks, filters, profile?.id ?? '');
    return splitTasksIntoSections(filtered);
  }, [tasks, filters, profile?.id]);

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const totalTasks = tasks.filter((t) => !completedIds.has(t.id)).length;

  const handleComplete = useCallback(async (taskId: string) => {
    // Lancer la complétion en arrière-plan
    completeTask(taskId);
    // Attendre 1.5s pour que l'utilisateur voie le feedback, puis masquer
    setTimeout(() => {
      setCompletedIds((prev) => new Set(prev).add(taskId));
    }, 1500);
  }, [completeTask]);

  return (
    <div className="space-y-5">
      {/* Header avec compteur */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Tâches</h2>
          {totalTasks > 0 && (
            <p className="text-sm text-slate-400">{totalTasks} tâche{totalTasks > 1 ? 's' : ''} actives</p>
          )}
        </div>
        <Link
          href="/tasks/new"
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
        >
          + Nouvelle
        </Link>
      </div>

      {/* Filtres catégories */}
      <div className="flex flex-wrap gap-2">
        <FilterChip
          label="Toutes"
          active={filters.categoryId === 'all'}
          onClick={() => setFilters({ categoryId: 'all' })}
          color="#6366f1"
        />
        {categories.map((cat) => (
          <FilterChip
            key={cat.id}
            label={cat.name}
            active={filters.categoryId === cat.id}
            onClick={() => setFilters({ categoryId: cat.id })}
            color={cat.color_hex}
          />
        ))}
      </div>

      {/* Filtres assignation */}
      <div className="flex gap-2">
        <FilterChip
          label="Toutes"
          active={filters.assignment === 'all'}
          onClick={() => setFilters({ assignment: 'all' })}
          color="#6366f1"
        />
        <FilterChip
          label="Mes tâches"
          active={filters.assignment === 'mine'}
          onClick={() => setFilters({ assignment: 'mine' })}
          color="#6366f1"
        />
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        </div>
      ) : totalTasks === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-lg font-semibold text-slate-400">Aucune tâche</p>
          <p className="mt-1 text-sm text-slate-400">Créez votre première tâche pour commencer</p>
          <Link
            href="/tasks/new"
            className="mt-4 inline-block rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            + Créer une tâche
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          <TaskSection title="En retard" tasks={sections.overdue} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Aujourd'hui" tasks={sections.today} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Demain" tasks={sections.tomorrow} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Cette semaine" tasks={sections.week} onComplete={handleComplete} completedIds={completedIds} />
          <TaskSection title="Plus tard" tasks={sections.later} onComplete={handleComplete} completedIds={completedIds} />
        </div>
      )}
    </div>
  );
}
