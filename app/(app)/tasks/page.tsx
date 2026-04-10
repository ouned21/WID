'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { filterTasks, splitTasksIntoSections } from '@/utils/taskSelectors';
import { frequencyLabel } from '@/utils/frequency';
import type { TaskListItem, TaskCategory } from '@/types/database';

// -- Composant chip de filtre --------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'bg-slate-900 text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

// -- Composant carte de tâche --------------------------------------------------

function TaskCard({
  task,
  onComplete,
}: {
  task: TaskListItem;
  onComplete: (id: string) => Promise<void>;
}) {
  const [justCompleted, setJustCompleted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = useCallback(async () => {
    if (isLoading || justCompleted) return;
    setIsLoading(true);
    await onComplete(task.id);
    setIsLoading(false);
    setJustCompleted(true);
    setTimeout(() => setJustCompleted(false), 2500);
  }, [task.id, onComplete, isLoading, justCompleted]);

  return (
    <div className={`rounded-xl border p-4 shadow-sm transition-all duration-300 ${
      justCompleted
        ? 'border-green-300 bg-green-50 opacity-60'
        : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: task.category?.color_hex ?? '#94a3b8' }}
            />
            <Link
              href={`/tasks/${task.id}`}
              className="text-sm font-semibold text-slate-900 hover:underline"
            >
              {task.name}
            </Link>
          </div>
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{task.category?.name}</span>
            <span>·</span>
            <span>{frequencyLabel(task.frequency)}</span>
            {task.assignee && (
              <>
                <span>·</span>
                <span>{task.assignee.display_name}</span>
              </>
            )}
            {task.next_due_at && (
              <>
                <span>·</span>
                <span>{new Date(task.next_due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
              </>
            )}
          </div>
        </div>

        {/* Score charge mentale */}
        <div className="flex flex-col items-center">
          <span className={`text-lg font-bold ${
            task.mental_load_score >= 7 ? 'text-red-600' :
            task.mental_load_score >= 4 ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {task.mental_load_score}
          </span>
          <span className="text-[10px] text-slate-400">charge</span>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        {justCompleted ? (
          <span className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white">
            Fait ! Prochaine échéance reprogrammée
          </span>
        ) : (
          <button
            onClick={handleClick}
            disabled={isLoading}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {isLoading ? 'En cours...' : 'Fait'}
          </button>
        )}
        <Link
          href={`/tasks/${task.id}`}
          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          Modifier
        </Link>
      </div>
    </div>
  );
}

// -- Composant section de tâches -----------------------------------------------

function TaskSection({
  title,
  tasks,
  emptyText,
  onComplete,
  defaultCollapsed = false,
}: {
  title: string;
  tasks: TaskListItem[];
  emptyText: string;
  onComplete: (id: string) => Promise<void>;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (tasks.length === 0 && defaultCollapsed) return null;

  if (tasks.length === 0) {
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold text-slate-500 uppercase tracking-wide">
          {title}
        </h3>
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
          {emptyText}
        </p>
      </section>
    );
  }

  return (
    <section>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-2 flex w-full items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wide hover:text-slate-700"
      >
        <span className={`transition-transform ${collapsed ? '' : 'rotate-90'}`}>›</span>
        {title} ({tasks.length})
      </button>
      {!collapsed && (
        <div className="space-y-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onComplete={onComplete} />
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

  // Charger les tâches au montage
  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks]);

  // Extraire les catégories uniques des tâches chargées
  const categories = useMemo(() => {
    const map = new Map<string, TaskCategory>();
    for (const task of tasks) {
      if (task.category && !map.has(task.category.id)) {
        map.set(task.category.id, task.category);
      }
    }
    return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
  }, [tasks]);

  // Filtrer et découper en sections
  const sections = useMemo(() => {
    const filtered = filterTasks(tasks, filters, profile?.id ?? '');
    return splitTasksIntoSections(filtered);
  }, [tasks, filters, profile?.id]);

  // Nombre de tâches effectuées récemment (dernière completion existe)
  const recentlyCompleted = useMemo(() => {
    return tasks.filter((t) => t.last_completion != null);
  }, [tasks]);

  const handleComplete = useCallback(async (taskId: string) => {
    await completeTask(taskId);
  }, [completeTask]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Tâches</h2>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
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
        />
        {categories.map((cat) => (
          <FilterChip
            key={cat.id}
            label={cat.name}
            active={filters.categoryId === cat.id}
            onClick={() => setFilters({ categoryId: cat.id })}
          />
        ))}
      </div>

      {/* Filtres assignation */}
      <div className="flex gap-2">
        <FilterChip
          label="Toutes"
          active={filters.assignment === 'all'}
          onClick={() => setFilters({ assignment: 'all' })}
        />
        <FilterChip
          label="Mes tâches"
          active={filters.assignment === 'mine'}
          onClick={() => setFilters({ assignment: 'mine' })}
        />
      </div>

      {/* Contenu */}
      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : (
        <div className="space-y-6">
          <TaskSection title="En retard" tasks={sections.overdue} emptyText="Aucune tâche en retard." onComplete={handleComplete} />
          <TaskSection title="Aujourd'hui" tasks={sections.today} emptyText="Aucune tâche prévue aujourd'hui." onComplete={handleComplete} />
          <TaskSection title="Demain" tasks={sections.tomorrow} emptyText="Rien de prévu demain." onComplete={handleComplete} />
          <TaskSection title="Cette semaine" tasks={sections.week} emptyText="Rien de prévu cette semaine." onComplete={handleComplete} />
          <TaskSection title="Plus tard" tasks={sections.later} emptyText="Aucune tâche planifiée." onComplete={handleComplete} />
        </div>
      )}
    </div>
  );
}
