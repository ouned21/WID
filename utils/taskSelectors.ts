import { startOfDay, endOfDay, isBefore, isAfter, isWithinInterval } from 'date-fns';
import type { TaskListItem, TaskSections, TaskFilters } from '@/types/database';

/**
 * Filtre les taches selon les filtres actifs.
 * Fonction pure — pas de hook React, pas de state.
 */
export function filterTasks(
  tasks: TaskListItem[],
  filters: TaskFilters,
  currentUserId: string,
): TaskListItem[] {
  return tasks.filter((task) => {
    // Filtre par categorie
    if (filters.categoryId !== 'all' && task.category_id !== filters.categoryId) {
      return false;
    }
    // Filtre par assignation
    if (filters.assignment === 'mine' && task.assigned_to !== currentUserId) {
      return false;
    }
    return true;
  });
}

/**
 * Decoupe les taches en sections temporelles (en retard, aujourd'hui, a venir, plus tard).
 * Fonction pure.
 */
export function splitTasksIntoSections(
  tasks: TaskListItem[],
  now: Date = new Date(),
): TaskSections {
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  // "A venir" = les 7 prochains jours apres aujourd'hui
  const weekEnd = endOfDay(new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000));

  const overdue: TaskListItem[] = [];
  const today: TaskListItem[] = [];
  const upcoming: TaskListItem[] = [];
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
    } else if (isWithinInterval(dueDate, { start: todayEnd, end: weekEnd })) {
      upcoming.push(task);
    } else if (isAfter(dueDate, weekEnd)) {
      later.push(task);
    }
  }

  return { overdue, today, upcoming, later };
}
