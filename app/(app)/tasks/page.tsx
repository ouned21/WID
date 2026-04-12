'use client';

import { taskLoad } from '@/utils/designSystem';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { filterTasks, splitTasksIntoSections } from '@/utils/taskSelectors';
import { frequencyLabel } from '@/utils/frequency';
import type { TaskListItem } from '@/types/database';

// -- Chip ----------------------------------------------------------------------

function Chip({ label, active, onClick, color }: {
  label: string; active: boolean; onClick: () => void; color?: string;
}) {
  return (
    <button onClick={onClick}
      className="rounded-full px-3.5 py-[7px] text-[13px] font-semibold transition-all"
      style={active
        ? { background: color ?? '#007aff', color: 'white' }
        : { background: 'white', color: '#3c3c43', boxShadow: '0 0.5px 2px rgba(0,0,0,0.08)' }
      }>
      {label}
    </button>
  );
}

// -- Jauge mini ----------------------------------------------------------------

/**
 * Jauge en base 10 avec couleurs cohérentes :
 * 0-3 vert, 4-5 orange, 6-7 orange foncé, 8-10 rouge
 */
function GaugeBar({ label, value }: { label: string; value: number }) {
  const v = Math.min(10, Math.max(0, value));
  const pct = (v / 10) * 100;
  const c = v <= 3 ? '#34c759' : v <= 5 ? '#ff9500' : v <= 7 ? '#ff6b00' : '#ff3b30';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px] flex-shrink-0 text-[#8e8e93] font-medium" style={{ width: '95px' }}>{label}</span>
      <div className="flex-1 h-2.5 rounded-full" style={{ background: '#e8ecf2' }}>
        <div className="h-2.5 rounded-full transition-all" style={{ width: `${pct}%`, background: c }} />
      </div>
      <span className="text-[11px] font-bold flex-shrink-0 w-[18px] text-right" style={{ color: c }}>{v}</span>
    </div>
  );
}

// -- Carte tâche ---------------------------------------------------------------

function TaskCard({ task, onComplete, onDelete, isCompleted }: {
  task: TaskListItem;
  onComplete: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isCompleted: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'success' | 'exit'>('idle');

  const handleClick = useCallback(async () => {
    if (phase !== 'idle' || isCompleted) return;
    setPhase('success');
    onComplete(task.id);
    setTimeout(() => setPhase('exit'), 800);
  }, [task.id, onComplete, phase, isCompleted]);

  const catColor = task.category?.color_hex ?? '#8e8e93';

  if (isCompleted) return null;

  const sb = task.score_breakdown as Record<string, number> | null;

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
        <div className="flex flex-col items-center justify-center py-6 px-3">
          <svg width="32" height="32" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" viewBox="0 0 24 24" className="mb-1">
            <path d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-[14px] font-bold text-white text-center">{task.name}</p>
        </div>
      ) : (
        <>
          <Link href={`/tasks/${task.id}`} className="flex-1 p-4 flex flex-col">
            {/* Nom + Score /10 */}
            <div className="flex items-start justify-between gap-2 mb-3">
              <h3 className="text-[17px] font-bold text-[#1c1c1e] leading-snug line-clamp-2 flex-1">{task.name}</h3>
              {(() => {
                const gs = taskLoad(task);
                const score10 = Math.round((gs / 36) * 10);
                const c = score10 <= 3 ? '#34c759' : score10 <= 5 ? '#ff9500' : score10 <= 7 ? '#ff6b00' : '#ff3b30';
                return (
                  <div className="flex flex-col items-end flex-shrink-0">
                    <span className="text-[22px] font-black leading-none" style={{ color: c }}>{score10}</span>
                    <span className="text-[10px] text-[#c7c7cc]">/10</span>
                  </div>
                );
              })()}
            </div>

            {/* 2 jauges /10 */}
            {(() => {
              const gs = taskLoad(task);
              const ratio = gs / 36;
              const mentalRaw = sb?.mental_load_score ?? Math.round(ratio * 18);
              const mental10 = Math.round((mentalRaw / 18) * 10);

              // Temps : convertir time_score en minutes puis en base 10 (10 = 60 min)
              const timeScoreToMin: Record<number, number> = { 1: 3, 2: 10, 3: 15, 4: 22, 5: 30, 6: 45, 7: 60, 8: 75 };
              const timeRaw = sb?.time_score ?? Math.round(ratio * 8);
              const minutes = timeScoreToMin[timeRaw] ?? Math.round((timeRaw / 8) * 60);
              const time10 = Math.min(10, Math.round((minutes / 60) * 10));

              return (
                <div className="space-y-1.5 mb-3">
                  <GaugeBar label="Charge mentale" value={mental10} />
                  <GaugeBar label="Temps" value={time10} />
                </div>
              );
            })()}

            {/* Assignée + date */}
            <div className="flex items-center gap-2 mt-auto">
              {task.assignee ? (
                <span className="flex items-center gap-1">
                  <span className="h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ background: '#007aff' }}>
                    {task.assignee.display_name.charAt(0).toUpperCase()}
                  </span>
                  <span className="text-[13px] text-[#3c3c43]">{task.assignee.display_name}</span>
                </span>
              ) : (
                <span className="text-[13px] text-[#b0b0b8]">Non assigné</span>
              )}
              {task.next_due_at && (
                <span className="text-[13px] text-[#8e8e93]">
                  {new Date(task.next_due_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          </Link>

          {/* Actions */}
          <div className="px-4 pb-3 flex items-center justify-end gap-2">
            <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClick(); }}
              className="rounded-lg px-3.5 py-[5px] text-[12px] font-bold tracking-wide transition-all"
              style={{ background: '#34c759', color: 'white' }}>
              FAIT
            </button>
            <button onClick={(e) => {
              e.preventDefault(); e.stopPropagation();
              if (confirm('Supprimer cette tâche ?')) onDelete(task.id);
            }}
              className="rounded-lg px-2.5 py-[5px] text-[14px] font-bold transition-all"
              style={{ color: '#ff3b30', background: '#fff2f2' }}>
              ✕
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// -- Section -------------------------------------------------------------------

const SECTION_COLORS: Record<string, string> = {
  'En retard': '#ff3b30',
  'Aujourd\'hui': '#007aff',
  'Demain': '#af52de',
  'Cette semaine': '#5856d6',
  'Plus tard': '#8e8e93',
};

function TaskSection({ title, tasks, onComplete, onDelete, completedIds }: {
  title: string; tasks: TaskListItem[];
  onComplete: (id: string) => Promise<void>; onDelete: (id: string) => Promise<void>; completedIds: Set<string>;
}) {
  const visibleCount = tasks.filter((t) => !completedIds.has(t.id)).length;
  if (visibleCount === 0) return null;
  const color = SECTION_COLORS[title] ?? '#8e8e93';

  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 px-4 mb-2">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color }}>{title}</h3>
        <span className="rounded-full min-w-[20px] text-center px-1.5 py-0.5 text-[11px] font-bold text-white" style={{ background: color }}>{visibleCount}</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 px-3">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} onComplete={onComplete} onDelete={onDelete} isCompleted={completedIds.has(task.id)} />
        ))}
      </div>
    </section>
  );
}

// -- Page principale -----------------------------------------------------------

export default function TasksPage() {
  const { profile } = useAuthStore();
  const { tasks, filters, loading, fetchTasks, completeTask, deleteTask, setFilters } = useTaskStore();
  const { members } = useHouseholdStore();

  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [showScoreInfo, setShowScoreInfo] = useState(false);

  useEffect(() => {
    if (profile?.household_id) fetchTasks(profile.household_id);
  }, [profile?.household_id, fetchTasks]);

  const vacationUserIds = useMemo(() => {
    return new Set(members.filter((m) => m.vacation_mode).map((m) => m.id));
  }, [members]);

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const sections = useMemo(() => {
    let filtered = filterTasks(tasks, filters, profile?.id ?? '', vacationUserIds);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((t) => t.name.toLowerCase().includes(q));
    }
    return splitTasksIntoSections(filtered);
  }, [tasks, filters, profile?.id, vacationUserIds, searchQuery]);

  const totalTasks = tasks.filter((t) => !completedIds.has(t.id)).length;

  const handleComplete = useCallback(async (taskId: string) => {
    const completionPromise = completeTask(taskId);
    const timerPromise = new Promise<void>((resolve) => setTimeout(resolve, 1200));
    await Promise.all([completionPromise, timerPromise]);
    setCompletedIds((prev) => new Set(prev).add(taskId));
  }, [completeTask]);

  const handleDelete = useCallback(async (taskId: string) => {
    await deleteTask(taskId);
  }, [deleteTask]);

  // Sections à afficher selon le filtre
  const visibleSections = useMemo(() => {
    const all = [
      { key: 'overdue', title: 'En retard', tasks: sections.overdue },
      { key: 'today', title: 'Aujourd\'hui', tasks: sections.today },
      { key: 'tomorrow', title: 'Demain', tasks: sections.tomorrow },
      { key: 'week', title: 'Cette semaine', tasks: sections.week },
      { key: 'later', title: 'Plus tard', tasks: sections.later },
    ];
    if (sectionFilter === 'all') return all;
    return all.filter((s) => s.key === sectionFilter);
  }, [sections, sectionFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Header */}
      <div className="flex items-end justify-between px-4 pt-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[28px] font-bold text-[#1c1c1e]">Tâches</h2>
            <button onClick={() => setShowScoreInfo(!showScoreInfo)}
              className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white mt-1"
              style={{ background: '#8e8e93' }}
              aria-label="Comment lire le score FairShare">
              i
            </button>
          </div>
          {totalTasks > 0 && (
            <p className="text-[13px] text-[#8e8e93]">{totalTasks} tâche{totalTasks > 1 ? 's' : ''} active{totalTasks > 1 ? 's' : ''}</p>
          )}
        </div>
        <Link href="/tasks/new"
          className="flex items-center gap-1 rounded-full px-4 py-2 text-[15px] font-semibold text-white"
          style={{ background: '#007aff' }}>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouvelle
        </Link>
      </div>

      {/* Panneau explication score FairShare */}
      {showScoreInfo && (
        <div className="mx-4 mb-3 rounded-2xl bg-white p-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-[16px] font-bold text-[#1c1c1e]">Comment lire le score FairShare</h3>
            <button onClick={() => setShowScoreInfo(false)} className="text-[17px] text-[#8e8e93]">✕</button>
          </div>
          <p className="text-[13px] text-[#8e8e93] mb-3">
            Chaque tâche est évaluée sur <strong className="text-[#1c1c1e]">10</strong>. Plus le score est élevé, plus la tâche pèse dans votre quotidien.
          </p>
          <div className="space-y-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold w-[110px]">Charge mentale</span>
              <span className="text-[12px] text-[#8e8e93]">Anticipation, décisions, stress, responsabilité</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold w-[110px]">Temps</span>
              <span className="text-[12px] text-[#8e8e93]">Durée nécessaire (10 = 60 minutes)</span>
            </div>
          </div>
          <div className="space-y-1.5 text-[12px]">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#34c759' }} />
              <span className="text-[#1c1c1e]"><strong>0–3</strong> — Léger</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff9500' }} />
              <span className="text-[#1c1c1e]"><strong>4–5</strong> — Modéré</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff6b00' }} />
              <span className="text-[#1c1c1e]"><strong>6–7</strong> — Élevé</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: '#ff3b30' }} />
              <span className="text-[#1c1c1e]"><strong>8–10</strong> — Critique</span>
            </div>
          </div>
        </div>
      )}

      {/* Mode vacances */}
      {profile?.vacation_mode && (() => {
        const daysSinceVacation = profile.vacation_started_at
          ? Math.floor((Date.now() - new Date(profile.vacation_started_at).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const isLong = daysSinceVacation >= 7;
        return (
          <div className="mx-4 mb-4 rounded-2xl p-5 text-center" style={{ background: isLong ? '#fff2f2' : '#fff8e1' }}>
            <p className="text-[28px] mb-1">{isLong ? '⚠️' : '🏖️'}</p>
            <p className="text-[17px] font-bold text-[#1c1c1e]">
              {isLong ? `Mode vacances actif depuis ${daysSinceVacation} jours` : 'Mode vacances actif'}
            </p>
            <Link href="/profile" className="inline-block mt-3 rounded-xl px-5 py-2 text-[14px] font-semibold text-white"
              style={{ background: isLong ? '#ff3b30' : '#007aff' }}>
              {isLong ? 'Désactiver maintenant' : 'Gérer'}
            </Link>
          </div>
        );
      })()}

      {/* Recherche */}
      <div className="px-4 pb-2">
        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher une tâche..."
          className="w-full rounded-xl px-4 py-2.5 text-[15px] bg-white text-[#1c1c1e] outline-none placeholder:text-[#c7c7cc]"
          style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }} />
      </div>

      {/* Filtres */}
      <div className="px-4 pb-2 space-y-2">
        {/* Ligne 1 : Mes tâches / Toutes */}
        <div className="flex gap-1.5">
          <Chip label="Mes tâches" active={filters.assignment === 'mine'} onClick={() => setFilters({ assignment: 'mine' })} />
          <Chip label="Toutes" active={filters.assignment === 'all'} onClick={() => setFilters({ assignment: 'all' })} />
        </div>
        {/* Ligne 2 : filtres par section */}
        <div className="flex gap-1.5">
          <Chip label="Toutes" active={sectionFilter === 'all'} onClick={() => setSectionFilter('all')} />
          <Chip label="En retard" active={sectionFilter === 'overdue'} onClick={() => setSectionFilter('overdue')} color="#ff3b30" />
          <Chip label="Aujourd'hui" active={sectionFilter === 'today'} onClick={() => setSectionFilter('today')} color="#007aff" />
        </div>
        {/* Ligne 3 */}
        <div className="flex gap-1.5">
          <Chip label="Demain" active={sectionFilter === 'tomorrow'} onClick={() => setSectionFilter('tomorrow')} color="#af52de" />
          <Chip label="Semaine" active={sectionFilter === 'week'} onClick={() => setSectionFilter('week')} color="#5856d6" />
          <Chip label="Plus tard" active={sectionFilter === 'later'} onClick={() => setSectionFilter('later')} />
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
          <h3 className="text-[20px] font-bold text-[#1c1c1e]">Bienvenue !</h3>
          <p className="mt-2 text-[15px] text-[#8e8e93]">Commencez par ajouter vos premières tâches.</p>
          <Link href="/tasks/new" className="mt-4 inline-block rounded-full px-6 py-2.5 text-[15px] font-semibold text-white" style={{ background: '#007aff' }}>
            Créer ma première tâche
          </Link>
        </div>
      ) : (
        <div className="pt-2">
          {visibleSections.map((s) => (
            <TaskSection key={s.key} title={s.title} tasks={s.tasks} onComplete={handleComplete} onDelete={handleDelete} completedIds={completedIds} />
          ))}

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
// force deploy 1775950066
