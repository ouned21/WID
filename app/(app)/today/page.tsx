'use client';

/**
 * Page "Aujourd'hui" — Sprint 2
 * Onglet central : greeting Yova contextuel + tâches urgentes + accès rapide.
 */

import { useEffect } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useFamilyStore } from '@/stores/familyStore';
import { filterTasks, splitTasksIntoSections } from '@/utils/taskSelectors';
import type { TaskListItem, PhantomMember } from '@/types/database';

// ── Greeting contextuel ────────────────────────────────────────────────────

function buildGreeting(
  firstName: string,
  energyLevel: string | undefined,
  lifeEvents: string[],
  isCrisis: boolean,
  hour: number,
): string {
  const timeGreet = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  if (isCrisis) {
    return `${timeGreet} ${firstName}. Mode crise activé — on fait le minimum vital, je suis là.`;
  }

  if (lifeEvents.length > 0) {
    const ev = lifeEvents[0].toLowerCase();
    return `${timeGreet} ${firstName}. Tu traverses "${ev}" en ce moment — comment tu vas aujourd'hui ?`;
  }

  if (energyLevel === 'low') {
    return `${timeGreet} ${firstName}. Je sens que c'est chargé. On prend ça doucement — dis-moi ce que tu as géré.`;
  }

  if (energyLevel === 'high') {
    return `${timeGreet} ${firstName} ! Bonne énergie aujourd'hui. Voilà ce qui t'attend.`;
  }

  return `${timeGreet} ${firstName}. Voici ce qui compte aujourd'hui.`;
}

// ── Badge assignation ──────────────────────────────────────────────────────

function AssigneeBadge({
  task,
  currentUserId,
  phantomMembers,
}: {
  task: TaskListItem;
  currentUserId: string;
  phantomMembers: PhantomMember[];
}) {
  // Assigné à moi → rien (implicite, c'est ma tâche)
  if (task.assigned_to === currentUserId) return null;

  // Assigné à un vrai membre (pas moi)
  if (task.assignee && task.assigned_to !== currentUserId) {
    const firstName = task.assignee.display_name.split(' ')[0];
    return (
      <span
        className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
        style={{ background: '#f0f7ff', color: '#007aff' }}
      >
        {firstName}
      </span>
    );
  }

  // Assigné à un membre fantôme (enfant, autre)
  if (task.assigned_to_phantom_id) {
    const phantom = phantomMembers.find((m) => m.id === task.assigned_to_phantom_id);
    if (phantom) {
      return (
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{ background: '#f5f0ff', color: '#af52de' }}
        >
          {phantom.display_name.split(' ')[0]}
        </span>
      );
    }
  }

  // Non assigné → rien (implicite)
  return null;
}

// ── Mini task card ─────────────────────────────────────────────────────────

function TodayTaskCard({
  task,
  currentUserId,
  phantomMembers,
  onComplete,
}: {
  task: TaskListItem;
  currentUserId: string;
  phantomMembers: PhantomMember[];
  onComplete: (id: string) => void;
}) {
  const isOverdue =
    !!task.next_due_at &&
    new Date(task.next_due_at) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div
      className="flex items-center gap-3 px-4 py-3.5 bg-white rounded-2xl"
      style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}
    >
      {/* Bouton compléter */}
      <button
        onClick={() => onComplete(task.id)}
        className="flex-shrink-0 w-[26px] h-[26px] rounded-full border-2 flex items-center justify-center transition-colors active:scale-90"
        style={{ borderColor: isOverdue ? '#ff3b30' : '#007aff' }}
        aria-label={`Marquer "${task.name}" comme fait`}
      />

      {/* Contenu */}
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{task.name}</p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isOverdue && (
            <span
              className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full"
              style={{ background: '#fff2f2', color: '#ff3b30' }}
            >
              En retard
            </span>
          )}
          {task.category && (
            <span className="text-[12px] text-[#8e8e93]">
              {task.category.icon} {task.category.name}
            </span>
          )}
          <AssigneeBadge
            task={task}
            currentUserId={currentUserId}
            phantomMembers={phantomMembers}
          />
        </div>
      </div>

      {/* Détail */}
      <Link
        href={`/tasks/${task.id}`}
        className="flex-shrink-0 text-[#c7c7cc]"
        aria-label="Détail de la tâche"
      >
        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Link>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────

export default function TodayPage() {
  const { profile } = useAuthStore();
  const { tasks, loading: tasksLoading, fetchTasks, completeTask, filters } = useTaskStore();
  const { householdProfile, members: phantomMembers, loading: familyLoading, fetchFamily } = useFamilyStore();

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchFamily(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchFamily]);

  const firstName = profile?.display_name?.split(' ')[0] ?? 'toi';
  const hour = new Date().getHours();
  const isCrisis = householdProfile?.crisis_mode_active ?? false;

  const greeting = buildGreeting(
    firstName,
    householdProfile?.energy_level,
    householdProfile?.current_life_events ?? [],
    isCrisis,
    hour,
  );

  // Sections temporelles
  const filtered = filterTasks(tasks, filters, profile?.id ?? '', new Set());
  const sections = splitTasksIntoSections(filtered);
  const urgentTasks: TaskListItem[] = [...sections.overdue, ...sections.today];
  const upcomingCount = sections.tomorrow.length + sections.week.length + sections.later.length;

  const handleComplete = async (taskId: string) => {
    await completeTask(taskId);
  };

  const isLoading = tasksLoading || familyLoading;

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    );
  }

  // Formatage date
  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const todayCapitalized = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  return (
    <div className="space-y-5 pb-4">

      {/* ── En-tête ── */}
      <div>
        <p className="text-[13px] text-[#8e8e93] font-medium">{todayCapitalized}</p>
        <h1 className="text-[28px] font-bold text-[#1c1c1e] leading-tight mt-0.5">
          Aujourd&apos;hui
        </h1>
      </div>

      {/* ── Mode crise ── */}
      {isCrisis && (
        <Link
          href="/family"
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
          style={{ background: '#fff2f0', border: '1.5px solid #ff3b30' }}
        >
          <span className="text-[22px]">🚨</span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Mode crise actif</p>
            <p className="text-[13px] text-[#ff3b30]">Seul l&apos;essentiel est affiché</p>
          </div>
          <svg width="16" height="16" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

      {/* ── Greeting Yova ── */}
      <div
        className="rounded-2xl px-4 py-4"
        style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[15px] font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          >
            Y
          </div>
          <p className="text-[15px] text-white/90 leading-relaxed flex-1">{greeting}</p>
        </div>
        <Link
          href="/journal"
          className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-[14px] font-semibold text-white transition-opacity active:opacity-70"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}
        >
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Raconter ma journée à Yova
        </Link>
      </div>

      {/* ── Tâches urgentes ── */}
      {urgentTasks.length === 0 ? (
        <div
          className="rounded-2xl px-4 py-8 text-center"
          style={{ background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}
        >
          <p className="text-[36px] mb-2">✨</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Rien à faire aujourd&apos;hui</p>
          <p className="text-[14px] text-[#8e8e93] mt-1">
            {upcomingCount > 0
              ? `${upcomingCount} tâche${upcomingCount > 1 ? 's' : ''} à venir cette semaine`
              : 'Profite ou raconte ta journée à Yova'}
          </p>
        </div>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[17px] font-semibold text-[#1c1c1e]">
              {sections.overdue.length > 0 ? '🔥 À traiter' : '📋 Du jour'}
            </h2>
            <Link href="/tasks" className="text-[14px] text-[#007aff] font-medium">
              Mes tâches
            </Link>
          </div>
          <div className="space-y-2">
            {urgentTasks.slice(0, 6).map((task) => (
              <TodayTaskCard
                key={task.id}
                task={task}
                currentUserId={profile?.id ?? ''}
                phantomMembers={phantomMembers}
                onComplete={handleComplete}
              />
            ))}
            {urgentTasks.length > 6 && (
              <Link
                href="/tasks"
                className="block text-center text-[14px] text-[#007aff] font-medium py-2"
              >
                +{urgentTasks.length - 6} tâches de plus →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── À venir (si tâches urgentes affichées) ── */}
      {urgentTasks.length > 0 && upcomingCount > 0 && (
        <Link
          href="/tasks"
          className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white"
          style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}
        >
          <div>
            <p className="text-[15px] font-medium text-[#1c1c1e]">À venir</p>
            <p className="text-[13px] text-[#8e8e93]">
              {upcomingCount} tâche{upcomingCount > 1 ? 's' : ''} cette semaine
            </p>
          </div>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" className="text-[#c7c7cc]">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

    </div>
  );
}
