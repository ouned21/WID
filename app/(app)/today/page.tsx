'use client';

/**
 * Page "Aujourd'hui" — Sprint 2 (refactor spec V1)
 *
 * Structure spec :
 * 1. Banner crise (si mode crise ON)
 * 2. Card "Maintenant" — 1 tâche urgente épinglée
 * 3. À faire aujourd'hui — 3-5 items max, durée + "Report demain"
 * 4. Sur le radar — collapsible, anticipations
 * 5. Check-in du soir — CTA Parler à Yova (visible après 20h uniquement)
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useFamilyStore } from '@/stores/familyStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';
import { filterTasks, splitTasksIntoSections } from '@/utils/taskSelectors';
import type { TaskListItem, HouseholdMember, AgentMemoryFact } from '@/types/database';

// ── Helpers ────────────────────────────────────────────────────────────────

const DURATION_LABEL: Record<string, string> = {
  very_short: '5 min',
  short:      '15 min',
  medium:     '30 min',
  long:       '1h',
  very_long:  '2h+',
};

function buildGreeting(
  firstName: string,
  energyLevel: string | undefined,
  lifeEvents: string[],
  isCrisis: boolean,
  hour: number,
  memoryFacts: AgentMemoryFact[],
): string {
  if (isCrisis) return `Mode crise — on fait l'essentiel, je suis là.`;
  const tension = memoryFacts.find((f) => f.fact_type === 'tension');
  if (tension) return `Je me souviens — ${tension.content.charAt(0).toLowerCase()}${tension.content.slice(1)}.`;
  if (lifeEvents.length > 0) return `Tu traverses "${lifeEvents[0].toLowerCase()}" — comment tu vas ?`;
  const context = memoryFacts.find((f) => f.fact_type === 'context');
  if (context) return `${context.content.charAt(0).toLowerCase()}${context.content.slice(1)}.`;
  if (energyLevel === 'low') return `C'est chargé en ce moment. On prend ça doucement.`;
  if (hour < 10) return `Belle journée qui commence, ${firstName}.`;
  if (hour < 18) return `Voici ce qui compte aujourd'hui.`;
  return `Bonsoir ${firstName}. Voilà où tu en es.`;
}

function tomorrowISO(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(8, 0, 0, 0);
  return d.toISOString();
}

// ── Assignation ────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0] ?? '').join('').slice(0, 2).toUpperCase();
}

/** Bulle d'initiales cliquable — affiche l'assigné ou l'icône foyer */
function AssigneeBadge({
  task,
  allMembers,
  currentUserId,
  onClick,
}: {
  task: TaskListItem;
  allMembers: HouseholdMember[];
  currentUserId: string;
  onClick: () => void;
}) {
  const member = task.assigned_to
    ? allMembers.find((m) => !m.isPhantom && m.id === task.assigned_to) ?? null
    : task.assigned_to_phantom_id
    ? allMembers.find((m) => m.isPhantom && m.id === task.assigned_to_phantom_id) ?? null
    : null;

  const isMe = !!member && !member.isPhantom && member.id === currentUserId;
  const color = !member ? '#e5e5ea' : isMe ? '#007aff' : member.isPhantom ? '#af52de' : '#34c759';
  const label = !member ? '👥' : getInitials(member.display_name);
  const title = !member ? 'Assigner' : member.display_name;

  return (
    <button
      onClick={onClick}
      title={title}
      className="flex-shrink-0 w-[28px] h-[28px] rounded-full flex items-center justify-center text-[10px] font-bold active:scale-90 transition-transform"
      style={{ background: color, color: member ? 'white' : '#8e8e93' }}
      aria-label={`Assigner cette tâche (actuellement : ${title})`}
    >
      {label}
    </button>
  );
}

/** Bottom sheet pour choisir un assigné */
function AssignSheet({
  taskName,
  allMembers,
  currentUserId,
  currentAssignedUserId,
  currentAssignedPhantomId,
  onAssign,
  onClose,
}: {
  taskName: string;
  allMembers: HouseholdMember[];
  currentUserId: string;
  currentAssignedUserId: string | null;
  currentAssignedPhantomId: string | null;
  onAssign: (userId: string | null, phantomId: string | null) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[20px] bg-white pb-safe"
        style={{ boxShadow: '0 -4px 30px rgba(0,0,0,0.12)' }}
      >
        <div className="px-4 pt-4 pb-2">
          <div className="w-10 h-1 rounded-full bg-[#e5e5ea] mx-auto mb-4" />
          <p className="text-[13px] text-[#8e8e93] mb-0.5">Assigner</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e] truncate mb-4">{taskName}</p>

          <div className="space-y-1 mb-4">
            {/* Option : Foyer (personne) */}
            <button
              onClick={() => onAssign(null, null)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-[#f2f2f7] transition-colors"
            >
              <div className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[16px]"
                style={{ background: '#f2f2f7' }}>
                👥
              </div>
              <div className="text-left">
                <p className="text-[15px] font-medium text-[#1c1c1e]">Foyer</p>
                <p className="text-[12px] text-[#8e8e93]">N&apos;importe qui peut le faire</p>
              </div>
              {!currentAssignedUserId && !currentAssignedPhantomId && (
                <svg className="ml-auto" width="18" height="18" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>

            {/* Membres */}
            {allMembers.map((m) => {
              const isMe = !m.isPhantom && m.id === currentUserId;
              const isSelected = m.isPhantom
                ? m.id === currentAssignedPhantomId
                : m.id === currentAssignedUserId;
              const color = isMe ? '#007aff' : m.isPhantom ? '#af52de' : '#34c759';

              return (
                <button
                  key={m.id}
                  onClick={() => onAssign(m.isPhantom ? null : m.id, m.isPhantom ? m.id : null)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:bg-[#f2f2f7] transition-colors"
                >
                  <div
                    className="w-[36px] h-[36px] rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
                    style={{ background: color }}
                  >
                    {getInitials(m.display_name)}
                  </div>
                  <p className="text-[15px] font-medium text-[#1c1c1e]">
                    {isMe ? `Moi (${m.display_name})` : m.display_name}
                  </p>
                  {isSelected && (
                    <svg className="ml-auto" width="18" height="18" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-xl text-[15px] font-semibold text-[#8e8e93]"
            style={{ background: '#f2f2f7' }}
          >
            Annuler
          </button>
          <div className="h-2" />
        </div>
      </div>
    </>
  );
}

// ── Card "Maintenant" ──────────────────────────────────────────────────────

function CardMaintenant({
  task, onComplete, onPostpone, justCompleted,
}: {
  task: TaskListItem;
  onComplete: (id: string) => void;
  onPostpone: (id: string) => void;
  justCompleted: boolean;
}) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{
      background: justCompleted
        ? 'linear-gradient(135deg, #34c759, #30d158)'
        : 'linear-gradient(135deg, #007aff, #5856d6)',
      boxShadow: justCompleted
        ? '0 4px 20px rgba(52,199,89,0.35)'
        : '0 4px 20px rgba(0,122,255,0.35)',
      transition: 'all 0.4s ease',
    }}>
      <div className="px-4 pt-4 pb-3">
        <p className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mb-1">Maintenant</p>
        <p className="text-[20px] font-bold text-white leading-snug"
          style={{ textDecoration: justCompleted ? 'line-through' : 'none', opacity: justCompleted ? 0.7 : 1 }}>
          {task.name}
        </p>
        {task.duration_estimate && !justCompleted && (
          <p className="text-[13px] text-white/60 mt-0.5">
            ⏱ {DURATION_LABEL[task.duration_estimate] ?? task.duration_estimate}
          </p>
        )}
        {justCompleted && (
          <p className="text-[15px] text-white mt-1 font-medium">✓ Fait !</p>
        )}
      </div>
      {!justCompleted && (
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => onComplete(task.id)}
            className="flex-1 py-2.5 rounded-xl text-[15px] font-bold text-white active:scale-95 transition-transform"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            ✓ Fait
          </button>
          <button
            onClick={() => onPostpone(task.id)}
            className="px-4 py-2.5 rounded-xl text-[14px] font-medium text-white/80 active:scale-95 transition-transform"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            Report demain
          </button>
        </div>
      )}
    </div>
  );
}

// ── Card tâche ─────────────────────────────────────────────────────────────

function TodayTaskCard({
  task, onComplete, onPostpone, justCompleted, justPostponed, allMembers, currentUserId, onOpenAssign,
}: {
  task: TaskListItem;
  onComplete: (id: string) => void;
  onPostpone: (id: string) => void;
  justCompleted: boolean;
  justPostponed: boolean;
  allMembers: HouseholdMember[];
  currentUserId: string;
  onOpenAssign: (taskId: string) => void;
}) {
  const isOverdue = !!task.next_due_at && new Date(task.next_due_at) < new Date(new Date().setHours(0, 0, 0, 0));

  if (justPostponed) return null;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl transition-all duration-300"
      style={{
        boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)',
        opacity: justCompleted ? 0.45 : 1,
        transform: justCompleted ? 'scale(0.98)' : 'scale(1)',
      }}
    >
      {/* Bouton compléter */}
      <button
        onClick={() => !justCompleted && onComplete(task.id)}
        className="flex-shrink-0 w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center transition-all duration-200 active:scale-90"
        style={{
          borderColor: justCompleted ? '#34c759' : isOverdue ? '#ff3b30' : '#007aff',
          background: justCompleted ? '#34c759' : 'transparent',
        }}
        aria-label={`Marquer "${task.name}" comme fait`}
      >
        {justCompleted && (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[15px] font-medium text-[#1c1c1e] truncate"
          style={{ textDecoration: justCompleted ? 'line-through' : 'none', color: justCompleted ? '#8e8e93' : '#1c1c1e' }}
        >
          {task.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isOverdue && !justCompleted && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#fff2f2', color: '#ff3b30' }}>En retard</span>
          )}
          {task.duration_estimate && !justCompleted && (
            <span className="text-[12px] text-[#8e8e93]">⏱ {DURATION_LABEL[task.duration_estimate]}</span>
          )}
          {justCompleted && <span className="text-[11px] font-semibold text-[#34c759]">✓ Fait !</span>}
        </div>
      </div>

      {/* Badge assignation */}
      {!justCompleted && (
        <AssigneeBadge
          task={task}
          allMembers={allMembers}
          currentUserId={currentUserId}
          onClick={() => onOpenAssign(task.id)}
        />
      )}

      {/* Report demain */}
      {!justCompleted && (
        <button
          onClick={() => onPostpone(task.id)}
          className="flex-shrink-0 text-[12px] text-[#c7c7cc] font-medium px-2 py-1 rounded-lg active:bg-[#f2f2f7] transition-colors"
          aria-label="Reporter à demain"
        >
          Demain
        </button>
      )}
    </div>
  );
}

// ── Sur le radar ───────────────────────────────────────────────────────────

function SurLeRadar({ tasks }: { tasks: TaskListItem[] }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 0) return null;

  return (
    <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-[17px]">📡</span>
          <div className="text-left">
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Sur le radar</p>
            <p className="text-[12px] text-[#8e8e93]">{tasks.length} chose{tasks.length > 1 ? 's' : ''} à venir</p>
          </div>
        </div>
        <svg
          width="16" height="16" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[#f2f2f7]">
          {tasks.map((task, i) => (
            <div
              key={task.id}
              className="flex items-center justify-between px-4 py-3"
              style={i < tasks.length - 1 ? { borderBottom: '0.5px solid #f2f2f7' } : {}}
            >
              <p className="text-[14px] text-[#1c1c1e]">{task.name}</p>
              {task.next_due_at && (
                <p className="text-[12px] text-[#8e8e93] ml-2 flex-shrink-0">
                  {new Date(task.next_due_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── CTA Check-in du soir ───────────────────────────────────────────────────

function CheckInDuSoir() {
  return (
    <Link
      href="/journal"
      className="flex items-center gap-4 px-4 py-4 rounded-2xl"
      style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 text-[16px] font-bold text-white"
        style={{ background: 'rgba(255,255,255,0.15)' }}>Y</div>
      <div className="flex-1">
        <p className="text-[15px] font-semibold text-white">Check-in du soir</p>
        <p className="text-[13px] text-white/60">Raconte ta journée à Yova — 3 min</p>
      </div>
      <svg width="16" height="16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  );
}

// ── Page principale ────────────────────────────────────────────────────────

export default function TodayPage() {
  const { profile } = useAuthStore();
  const { tasks, loading: tasksLoading, fetchTasks, completeTask, updateTask, filters } = useTaskStore();
  const { householdProfile, members: phantomMembers, loading: familyLoading, fetchFamily } = useFamilyStore();
  const { allMembers, fetchHousehold } = useHouseholdStore();

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [postponedIds, setPostponedIds] = useState<Set<string>>(new Set());
  const [memoryFacts, setMemoryFacts] = useState<AgentMemoryFact[]>([]);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  const loadMemoryFacts = useCallback(async (householdId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from('agent_memory_facts')
      .select('*')
      .eq('household_id', householdId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(10);
    setMemoryFacts((data as AgentMemoryFact[]) ?? []);
  }, []);

  useEffect(() => {
    if (!profile?.household_id) return;
    const hid = profile.household_id;
    fetchTasks(hid);
    fetchFamily(hid);
    fetchHousehold(hid);
    loadMemoryFacts(hid);

    const onVisible = () => { if (document.visibilityState === 'visible') { fetchTasks(hid); loadMemoryFacts(hid); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [profile?.household_id, fetchTasks, fetchFamily, fetchHousehold, loadMemoryFacts]);

  // ── Actions ──
  const handleComplete = async (taskId: string) => {
    setCompletedIds(prev => new Set(prev).add(taskId));
    await completeTask(taskId);
  };

  const handlePostpone = async (taskId: string) => {
    setPostponedIds(prev => new Set(prev).add(taskId));
    await updateTask(taskId, { next_due_at: tomorrowISO() });
    if (profile?.household_id) fetchTasks(profile.household_id);
  };

  const handleAssign = async (userId: string | null, phantomId: string | null) => {
    if (!assigningTaskId) return;
    await updateTask(assigningTaskId, {
      assigned_to: userId,
      assigned_to_phantom_id: phantomId,
    });
    setAssigningTaskId(null);
  };

  // ── Données ──
  const filtered = filterTasks(tasks, filters, profile?.id ?? '', new Set());
  const sections = splitTasksIntoSections(filtered);
  const urgentAll: TaskListItem[] = [...sections.overdue, ...sections.today].filter(t => !postponedIds.has(t.id));

  // Card "Maintenant" = tâche la plus urgente non complétée
  const maintenant = urgentAll.find(t => !completedIds.has(t.id)) ?? null;
  // À faire aujourd'hui = les 5 suivantes (hors maintenant)
  const aTFaire = urgentAll.filter(t => t.id !== maintenant?.id).slice(0, 5);
  // Sur le radar = demain + semaine (capped 5)
  const radar: TaskListItem[] = [...sections.tomorrow, ...sections.week].slice(0, 5);

  const isCrisis = householdProfile?.crisis_mode_active ?? false;
  const hour = new Date().getHours();
  const firstName = profile?.display_name?.split(' ')[0] ?? 'toi';
  const greeting = buildGreeting(firstName, householdProfile?.energy_level, householdProfile?.current_life_events ?? [], isCrisis, hour, memoryFacts);
  const isEvening = hour >= 20;

  const isLoading = (tasksLoading || familyLoading) && tasks.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-3 pb-6">

      {/* ── En-tête ── */}
      <div className="pt-1">
        <p className="text-[13px] text-[#8e8e93] font-medium capitalize">{todayLabel}</p>
        <h1 className="text-[28px] font-bold text-[#1c1c1e] leading-tight mt-0.5">Aujourd&apos;hui</h1>
        {greeting && (
          <p className="text-[14px] text-[#8e8e93] mt-1 leading-snug">{greeting}</p>
        )}
      </div>

      {/* 1. Banner crise */}
      {isCrisis && (
        <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl" style={{ background: '#fff2f0', border: '1.5px solid #ff3b30' }}>
          <span className="text-[20px]">🚨</span>
          <div>
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Yova te tient cette semaine.</p>
            <p className="text-[13px] text-[#ff3b30]">Juste l&apos;essentiel.</p>
          </div>
        </div>
      )}

      {/* 2. Card "Maintenant" */}
      {maintenant && (
        <CardMaintenant
          task={maintenant}
          onComplete={handleComplete}
          onPostpone={handlePostpone}
          justCompleted={completedIds.has(maintenant.id)}
        />
      )}

      {/* Rien à faire */}
      {!maintenant && urgentAll.length === 0 && (
        <div className="rounded-2xl px-4 py-10 text-center bg-white" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}>
          <p className="text-[40px] mb-2">✨</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Rien à faire aujourd&apos;hui</p>
          <p className="text-[14px] text-[#8e8e93] mt-1">
            {radar.length > 0
              ? `${radar.length} chose${radar.length > 1 ? 's' : ''} à venir sur le radar`
              : 'Profite — ou parle à Yova'}
          </p>
        </div>
      )}

      {/* 3. À faire aujourd'hui */}
      {aTFaire.length > 0 && (
        <section className="space-y-2">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide px-1">
            À faire aujourd&apos;hui
          </p>
          {aTFaire.map(task => (
            <TodayTaskCard
              key={task.id}
              task={task}
              onComplete={handleComplete}
              onPostpone={handlePostpone}
              justCompleted={completedIds.has(task.id)}
              justPostponed={postponedIds.has(task.id)}
              allMembers={allMembers}
              currentUserId={profile?.id ?? ''}
              onOpenAssign={setAssigningTaskId}
            />
          ))}
        </section>
      )}

      {/* 4. Sur le radar */}
      <SurLeRadar tasks={radar} />

      {/* Lien "Cette semaine" */}
      <Link
        href="/week"
        className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white active:bg-[#f2f2f7] transition-colors"
        style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-[18px]">📅</span>
          <div>
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Cette semaine</p>
            <p className="text-[12px] text-[#8e8e93]">Vue de coordination du foyer</p>
          </div>
        </div>
        <svg width="16" height="16" fill="none" stroke="#c7c7cc" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>

      {/* 5. Check-in du soir (uniquement après 20h) */}
      {isEvening && <CheckInDuSoir />}

      {/* Sheet assignation */}
      {assigningTaskId && (() => {
        const t = tasks.find((t) => t.id === assigningTaskId);
        if (!t) return null;
        return (
          <AssignSheet
            taskName={t.name}
            allMembers={allMembers}
            currentUserId={profile?.id ?? ''}
            currentAssignedUserId={t.assigned_to ?? null}
            currentAssignedPhantomId={t.assigned_to_phantom_id ?? null}
            onAssign={handleAssign}
            onClose={() => setAssigningTaskId(null)}
          />
        );
      })()}

    </div>
  );
}
