'use client';

/**
 * Page "Cette semaine / Ce mois" — Vue de coordination foyer
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { TaskActionsSheet } from '@/components/TaskActionsSheet';
import { UndoToast } from '@/components/UndoToast';
import { createClient } from '@/lib/supabase';
import type { TaskListItem, HouseholdMember } from '@/types/database';

type ViewMode = 'week' | 'month';

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

// Sprint 13 — palette stable pour les chips de projet (hash → 6 couleurs iOS-like)
const PROJECT_CHIP_PALETTE = [
  { bg: '#F3EDFF', fg: '#7c3aed' }, // violet
  { bg: '#E5F0FF', fg: '#007aff' }, // bleu
  { bg: '#FFE8EE', fg: '#ff2d55' }, // rose
  { bg: '#FFEFD9', fg: '#d97706' }, // orange
  { bg: '#DEF6E2', fg: '#15803d' }, // vert
  { bg: '#DCF1FB', fg: '#0891b2' }, // teal
];

function projectChipColor(parentId: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < parentId.length; i++) hash = (hash + parentId.charCodeAt(i)) | 0;
  return PROJECT_CHIP_PALETTE[Math.abs(hash) % PROJECT_CHIP_PALETTE.length];
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

/** Retourne les 30 prochains jours (aujourd'hui inclus) */
function getNextThirtyDays(): Date[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });
}

/** Date dans 7 jours à minuit */
function getSevenDaysFromNow(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 7);
  return d;
}

function getMonthLabel(): string {
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 29);
  return `${today.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
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

function ProjectChip({
  parentId,
  title,
  onClick,
}: {
  parentId: string;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  const c = projectChipColor(parentId);
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold flex-shrink-0 active:opacity-70"
      style={{ background: c.bg, color: c.fg, maxWidth: '140px' }}
      title={`Projet : ${title}`}
      aria-label={`Filtrer par projet ${title}`}
    >
      <span>✨</span>
      <span className="truncate">{title}</span>
    </button>
  );
}

function WeekTaskRow({
  task,
  allMembers,
  currentUserId,
  projectInfo,
  onOpenActions,
  onFilterProject,
}: {
  task: TaskListItem;
  allMembers: HouseholdMember[];
  currentUserId: string;
  projectInfo: { parentId: string; title: string } | null;
  onOpenActions: (taskId: string) => void;
  onFilterProject: (parentId: string) => void;
}) {
  return (
    <button
      onClick={() => onOpenActions(task.id)}
      className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-2xl active:bg-[#f8f8fa] transition-colors text-left"
      style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.07)' }}
      aria-label={`Actions sur ${task.name}`}
    >
      <MemberBadge task={task} allMembers={allMembers} currentUserId={currentUserId} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{task.name}</p>
          {projectInfo && (
            <ProjectChip
              parentId={projectInfo.parentId}
              title={projectInfo.title}
              onClick={(e) => { e.stopPropagation(); onFilterProject(projectInfo.parentId); }}
            />
          )}
        </div>
        {task.duration_estimate && (
          <p className="text-[12px] text-[#8e8e93] mt-0.5">
            ⏱ {DURATION_LABEL[task.duration_estimate] ?? task.duration_estimate}
          </p>
        )}
      </div>
      <svg className="flex-shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="#c7c7cc">
        <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
      </svg>
    </button>
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
  const { tasks, loading: tasksLoading, fetchTasks, completeTask, updateTask, archiveTask, unarchiveTask } = useTaskStore();
  const { allMembers, fetchHousehold, loading: householdLoading } = useHouseholdStore();
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [actionsTaskId, setActionsTaskId] = useState<string | null>(null);
  const [archivedToast, setArchivedToast] = useState<{ taskId: string; taskName: string } | null>(null);
  // Sprint 13 — filtre par projet (tap sur chip) ; null = tout afficher.
  const [filteredProjectId, setFilteredProjectId] = useState<string | null>(null);

  const handleSheetComplete = async () => {
    if (!actionsTaskId) return;
    const id = actionsTaskId;
    setActionsTaskId(null);
    await completeTask(id);
  };
  const handleSheetPostpone = async (nextDueIso: string) => {
    if (!actionsTaskId) return;
    const id = actionsTaskId;
    setActionsTaskId(null);
    await updateTask(id, { next_due_at: nextDueIso });
    if (profile?.household_id) fetchTasks(profile.household_id);
  };
  const handleSheetReassign = async (userId: string | null, phantomId: string | null) => {
    if (!actionsTaskId) return;
    const id = actionsTaskId;
    setActionsTaskId(null);
    await updateTask(id, { assigned_to: userId, assigned_to_phantom_id: phantomId });
  };
  const handleSheetArchive = async () => {
    if (!actionsTaskId) return;
    const id = actionsTaskId;
    const task = tasks.find((t) => t.id === id);
    setActionsTaskId(null);
    await archiveTask(id);
    if (task) setArchivedToast({ taskId: id, taskName: task.name });
  };

  const handleUndoArchive = async () => {
    if (!archivedToast || !profile?.household_id) return;
    const id = archivedToast.taskId;
    setArchivedToast(null);
    await unarchiveTask(id, profile.household_id);
  };

  useEffect(() => {
    if (!profile?.household_id) return;
    const hid = profile.household_id;
    fetchTasks(hid);
    fetchHousehold(hid);
  }, [profile?.household_id, fetchTasks, fetchHousehold]);

  const weekDays  = useMemo(() => getNextSevenDays(), []);
  const monthDays = useMemo(() => getNextThirtyDays(), []);
  const days = viewMode === 'week' ? weekDays : monthDays;

  // Sprint 13 — lookup des parents (pour chip "Projet : X")
  // Une tâche est un parent si son id apparaît comme parent_project_id d'une autre.
  // Certains parents peuvent être archivés (is_active=false) et donc absents du
  // store — on fetch leur nom séparément pour ne pas perdre le chip sur leurs enfants.
  const [archivedParentTitles, setArchivedParentTitles] = useState<Map<string, string>>(new Map());
  const parentIdToTitle = useMemo(() => {
    const parentIds = new Set<string>();
    for (const t of tasks) if (t.parent_project_id) parentIds.add(t.parent_project_id);
    const map = new Map<string, string>();
    for (const t of tasks) if (parentIds.has(t.id)) map.set(t.id, t.name);
    for (const [id, title] of archivedParentTitles) {
      if (!map.has(id)) map.set(id, title);
    }
    return map;
  }, [tasks, archivedParentTitles]);

  useEffect(() => {
    const referenced = new Set<string>();
    for (const t of tasks) if (t.parent_project_id) referenced.add(t.parent_project_id);
    const activeParents = new Set(tasks.filter((t) => referenced.has(t.id)).map((t) => t.id));
    const missing = [...referenced].filter((id) => !activeParents.has(id) && !archivedParentTitles.has(id));
    if (missing.length === 0) return;
    const supabase = createClient();
    supabase.from('household_tasks').select('id, name').in('id', missing).then(({ data }) => {
      if (!data || data.length === 0) return;
      setArchivedParentTitles((prev) => {
        const next = new Map(prev);
        for (const row of data) next.set(row.id as string, row.name as string);
        return next;
      });
    });
  }, [tasks, archivedParentTitles]);

  const projectInfoFor = (task: TaskListItem): { parentId: string; title: string } | null => {
    // Enfant → chip label = nom du parent.
    if (task.parent_project_id && parentIdToTitle.has(task.parent_project_id)) {
      return { parentId: task.parent_project_id, title: parentIdToTitle.get(task.parent_project_id)! };
    }
    // Parent lui-même → chip pointe vers lui, même couleur que ses enfants.
    if (parentIdToTitle.has(task.id)) {
      return { parentId: task.id, title: task.name };
    }
    return null;
  };

  // Tasks filtrées par projet si un filtre est actif.
  const filteredTasks = useMemo(() => {
    if (!filteredProjectId) return tasks;
    return tasks.filter((t) => t.parent_project_id === filteredProjectId || t.id === filteredProjectId);
  }, [tasks, filteredProjectId]);

  /** Tasks groupées par jour (Sprint 14 — masque les parents de projet du grid).
   * Les parents sont toujours visibles dans "Projets à venir" (section > 7j).
   * Cohérence avec /today où ProjectGroupCard masque déjà les parents du grid. */
  const grouped = useMemo(() => {
    const parentIdsSet = new Set(parentIdToTitle.keys());
    const map = new Map<string, TaskListItem[]>();
    for (const day of days) {
      map.set(localDateKey(day), []);
    }
    for (const task of filteredTasks) {
      if (!task.next_due_at) continue;
      if (parentIdsSet.has(task.id)) continue; // masque le parent (sous-tâches gardent le chip)
      const key = localDateKey(new Date(task.next_due_at));
      if (map.has(key)) map.get(key)!.push(task);
    }
    return map;
  }, [filteredTasks, days, parentIdToTitle]);

  const totalCount = useMemo(
    () => [...grouped.values()].reduce((acc, t) => acc + t.length, 0),
    [grouped],
  );

  /** Projets ponctuels (frequency=once) hors de la fenêtre */
  const projectTasks = useMemo(() => {
    const sevenDaysFromNow = getSevenDaysFromNow();
    if (viewMode === 'month') return [];
    return filteredTasks
      .filter((t) => t.frequency === 'once' && t.next_due_at && new Date(t.next_due_at) >= sevenDaysFromNow)
      .sort((a, b) => new Date(a.next_due_at!).getTime() - new Date(b.next_due_at!).getTime());
  }, [filteredTasks, viewMode]);

  const filteredProjectTitle = filteredProjectId ? parentIdToTitle.get(filteredProjectId) ?? null : null;

  const isLoading = (tasksLoading || householdLoading) && tasks.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    );
  }

  // En vue mois roulant, on n'affiche que les jours avec des tâches (tout est dans le futur)
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const visibleDays = viewMode === 'month'
    ? days.filter((d) => (grouped.get(localDateKey(d))?.length ?? 0) > 0)
    : days;

  return (
    <div className="space-y-4 pb-8">

      {/* ── En-tête ── */}
      <div className="pt-1">
        <Link href="/today" className="inline-flex items-center gap-1 text-[14px] text-[#007aff] font-medium mb-3">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Aujourd&apos;hui
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[28px] font-bold text-[#1c1c1e] leading-tight">
              {viewMode === 'week' ? 'Cette semaine' : 'Ce mois'}
            </h1>
            <p className="text-[14px] text-[#8e8e93] mt-0.5">
              {totalCount > 0
                ? `${totalCount} tâche${totalCount > 1 ? 's' : ''} planifiée${totalCount > 1 ? 's' : ''} pour le foyer`
                : viewMode === 'week' ? 'Vue de coordination foyer' : getMonthLabel()}
            </p>
          </div>
          {/* Toggle Semaine / Mois */}
          <div className="flex rounded-xl overflow-hidden p-0.5 flex-shrink-0" style={{ background: '#f0f2f8' }}>
            <button onClick={() => setViewMode('week')}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all"
              style={viewMode === 'week'
                ? { background: 'white', color: '#007aff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                : { color: '#8e8e93' }}>
              7 j
            </button>
            <button onClick={() => setViewMode('month')}
              className="px-3 py-1.5 text-[12px] font-semibold rounded-lg transition-all"
              style={viewMode === 'month'
                ? { background: 'white', color: '#007aff', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                : { color: '#8e8e93' }}>
              Mois
            </button>
          </div>
        </div>
      </div>

      {/* ── Filtre projet actif (Sprint 13) ── */}
      {filteredProjectId && (() => {
        const c = projectChipColor(filteredProjectId);
        return (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: c.bg }}
          >
            <span className="text-[13px]">✨</span>
            <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: c.fg }}>
              Projet : {filteredProjectTitle ?? 'inconnu'}
            </span>
            <button
              onClick={() => setFilteredProjectId(null)}
              className="text-[12px] font-semibold px-2 py-1 rounded-lg active:opacity-60"
              style={{ background: 'white', color: c.fg }}
            >
              Tout voir ✕
            </button>
          </div>
        );
      })()}

      {/* ── Légende membres ── */}
      {allMembers.length > 0 && (
        <MemberLegend allMembers={allMembers} currentUserId={profile?.id ?? ''} />
      )}

      {/* ── Vide ── */}
      {totalCount === 0 && (() => {
        // En vue semaine, compter les tâches existantes hors fenêtre 7j
        const sevenDaysFromNow = getSevenDaysFromNow();
        const futureCount = viewMode === 'week'
          ? tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) >= sevenDaysFromNow).length
          : 0;
        return (
          <div className="rounded-2xl bg-white px-4 py-12 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-[40px] mb-2">✨</p>
            <p className="text-[17px] font-semibold text-[#1c1c1e]">
              {viewMode === 'week' ? 'Rien cette semaine' : 'Mois tranquille'}
            </p>
            {viewMode === 'week' && futureCount > 0 ? (
              <>
                <p className="text-[14px] text-[#8e8e93] mt-1">
                  {futureCount} tâche{futureCount > 1 ? 's' : ''} à venir plus tard
                </p>
                <button
                  onClick={() => setViewMode('month')}
                  className="mt-4 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[13px] font-semibold text-white"
                  style={{ background: '#007aff' }}
                >
                  Voir le mois
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </button>
              </>
            ) : (
              <p className="text-[14px] text-[#8e8e93] mt-1">Aucune tâche planifiée</p>
            )}
          </div>
        );
      })()}

      {/* ── Projets à venir (semaine uniquement) ── */}
      {projectTasks.length > 0 && (
        <div>
          <div className="flex items-baseline gap-2 px-1 mb-2">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[#8e8e93]">Projets à venir</p>
            <p className="text-[12px] text-[#c7c7cc] ml-auto">{projectTasks.length} tâche{projectTasks.length > 1 ? 's' : ''}</p>
          </div>
          <div className="space-y-1.5">
            {projectTasks.map((task) => {
              const dateLabel = new Date(task.next_due_at!).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
              const pInfo = projectInfoFor(task);
              return (
                <button
                  key={task.id}
                  onClick={() => setActionsTaskId(task.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-white rounded-2xl active:bg-[#f8f8fa] transition-colors text-left"
                  style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.07)' }}
                  aria-label={`Actions sur ${task.name}`}
                >
                  <MemberBadge task={task} allMembers={allMembers} currentUserId={profile?.id ?? ''} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{task.name}</p>
                      {pInfo && (
                        <ProjectChip
                          parentId={pInfo.parentId}
                          title={pInfo.title}
                          onClick={(e) => { e.stopPropagation(); setFilteredProjectId(pInfo.parentId); }}
                        />
                      )}
                    </div>
                    {task.duration_estimate && (
                      <p className="text-[12px] text-[#8e8e93] mt-0.5">⏱ {DURATION_LABEL[task.duration_estimate] ?? task.duration_estimate}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-[#8e8e93] flex-shrink-0">{dateLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Jours ── */}
      {visibleDays.map((day) => {
        const key = localDateKey(day);
        const dayTasks = grouped.get(key) ?? [];
        const isToday = day.toDateString() === new Date().toDateString();
        const label = getDayLabel(day);
        const dateStr = getDayDate(day);

        return (
          <div key={key}>
            <div className="flex items-baseline gap-2 px-1 mb-2">
              <p className={`text-[13px] font-semibold uppercase tracking-wide ${isToday ? 'text-[#007aff]' : 'text-[#8e8e93]'}`}>
                {label}
              </p>
              {dateStr && <p className="text-[12px] text-[#c7c7cc]">{dateStr}</p>}
              {dayTasks.length > 0 && (
                <p className="text-[12px] text-[#c7c7cc] ml-auto">{dayTasks.length} tâche{dayTasks.length > 1 ? 's' : ''}</p>
              )}
            </div>

            {dayTasks.length === 0 ? (
              viewMode === 'week' ? (
                <div className="rounded-2xl px-4 py-3 text-[13px] text-[#c7c7cc] italic" style={{ background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                  Rien de prévu
                </div>
              ) : null
            ) : (
              <div className="space-y-1.5">
                {dayTasks.map((task) => (
                  <WeekTaskRow
                    key={task.id}
                    task={task}
                    allMembers={allMembers}
                    currentUserId={profile?.id ?? ''}
                    projectInfo={projectInfoFor(task)}
                    onOpenActions={setActionsTaskId}
                    onFilterProject={setFilteredProjectId}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {/* Undo toast (archive) */}
      {archivedToast && (
        <UndoToast
          message={`"${archivedToast.taskName}" retirée — Yova ne la proposera plus`}
          onUndo={handleUndoArchive}
          onDismiss={() => setArchivedToast(null)}
        />
      )}

      {/* Sheet d'actions */}
      {actionsTaskId && (() => {
        const t = tasks.find((t) => t.id === actionsTaskId);
        if (!t) return null;
        return (
          <TaskActionsSheet
            task={t}
            allMembers={allMembers}
            currentUserId={profile?.id ?? ''}
            onComplete={handleSheetComplete}
            onPostpone={handleSheetPostpone}
            onReassign={handleSheetReassign}
            onArchive={handleSheetArchive}
            onClose={() => setActionsTaskId(null)}
          />
        );
      })()}
    </div>
  );
}
