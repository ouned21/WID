import { startOfDay, endOfDay, addDays, isBefore, isAfter, isWithinInterval } from 'date-fns';
import type { TaskListItem, TaskSections, TaskFilters } from '@/types/database';

/**
 * Filtre les tâches selon les filtres actifs.
 * Fonction pure — pas de hook React, pas de state.
 */
export function filterTasks(
  tasks: TaskListItem[],
  filters: TaskFilters,
  currentUserId: string,
  vacationUserIds: Set<string> = new Set(),
): TaskListItem[] {
  const now = new Date();

  // Si l'utilisateur courant est en vacances, il ne voit aucune tâche
  if (vacationUserIds.has(currentUserId)) {
    return [];
  }

  return tasks.filter((task) => {
    // Masquer les tâches assignées à un membre en vacances (pour tous les membres)
    if (task.assigned_to && vacationUserIds.has(task.assigned_to)) {
      return false;
    }
    if (filters.categoryId !== 'all' && task.category_id !== filters.categoryId) {
      return false;
    }
    if (filters.assignment === 'mine' && task.assigned_to !== currentUserId) {
      return false;
    }
    return true;
  });
}

/**
 * Découpe les tâches en sections temporelles.
 * Ordre : En retard → Aujourd'hui → Demain → Cette semaine → Plus tard.
 * Fonction pure.
 */
export function splitTasksIntoSections(
  tasks: TaskListItem[],
  now: Date = new Date(),
): TaskSections {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));
  const weekEnd = endOfDay(addDays(now, 7));

  const overdue: TaskListItem[] = [];
  const today: TaskListItem[] = [];
  const tomorrow: TaskListItem[] = [];
  const week: TaskListItem[] = [];
  const later: TaskListItem[] = [];

  for (const task of tasks) {
    if (!task.next_due_at) {
      later.push(task);
      continue;
    }

    const dueDate = new Date(task.next_due_at);

    if (isBefore(dueDate, todayStart)) {
      overdue.push(task);
    } else if (isWithinInterval(dueDate, { start: todayStart, end: todayEnd })) {
      today.push(task);
    } else if (isWithinInterval(dueDate, { start: tomorrowStart, end: tomorrowEnd })) {
      tomorrow.push(task);
    } else if (isWithinInterval(dueDate, { start: tomorrowEnd, end: weekEnd })) {
      week.push(task);
    } else if (isAfter(dueDate, weekEnd)) {
      later.push(task);
    }
  }

  return { overdue, today, tomorrow, week, later };
}
