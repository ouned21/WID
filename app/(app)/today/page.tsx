'use client';

/**
 * Page "Aujourd'hui" — Sprint 5
 * Complétion rapide + indicateur d'équilibre hebdo + insight Yova.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useFamilyStore } from '@/stores/familyStore';
import { useMemoryStore } from '@/stores/memoryStore';
import { filterTasks, splitTasksIntoSections } from '@/utils/taskSelectors';
import { createClient } from '@/lib/supabase';
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
  if (isCrisis) return `${timeGreet} ${firstName}. Mode crise activé — on fait le minimum vital, je suis là.`;
  if (lifeEvents.length > 0) {
    const ev = lifeEvents[0].toLowerCase();
    return `${timeGreet} ${firstName}. Tu traverses "${ev}" en ce moment — comment tu vas aujourd'hui ?`;
  }
  if (energyLevel === 'low') return `${timeGreet} ${firstName}. Je sens que c'est chargé. On prend ça doucement.`;
  if (energyLevel === 'high') return `${timeGreet} ${firstName} ! Bonne énergie. Voilà ce qui t'attend.`;
  return `${timeGreet} ${firstName}. Voici ce qui compte aujourd'hui.`;
}

// ── Insight Yova (client-side, pas d'appel API) ───────────────────────────

type BalanceMember = { name: string; pct: number; isMe: boolean };

function buildYovaInsight(
  balance: BalanceMember[],
  facts: { fact_type: string; content: string }[],
  urgentCount: number,
): string {
  // Déséquilibre fort
  if (balance.length >= 2) {
    const sorted = [...balance].sort((a, b) => b.pct - a.pct);
    const gap = sorted[0].pct - sorted[1].pct;
    if (gap > 25) {
      const top = sorted[0];
      const low = sorted[1];
      if (top.isMe) {
        return `Tu portes ${top.pct}% de la charge cette semaine — ${low.name} est à ${low.pct}%. C'est le moment d'en parler.`;
      } else {
        return `${top.name} porte ${top.pct}% de la charge cette semaine — pense à t'impliquer.`;
      }
    }
    if (gap <= 10 && sorted[0].pct > 0) {
      return `Bonne semaine — répartition équilibrée (${sorted.map(m => `${m.name} ${m.pct}%`).join(', ')}).`;
    }
  }

  // Fact tension en mémoire
  const tension = facts.find(f => f.fact_type === 'tension');
  if (tension) return `Je me souviens : ${tension.content.toLowerCase()}. Garde ça en tête aujourd'hui.`;

  // Fact contexte en mémoire
  const context = facts.find(f => f.fact_type === 'context');
  if (context) return `Contexte : ${context.content}. Je l'intègre dans mes suggestions.`;

  // Rien de spécial
  if (urgentCount === 0) return `Aucune tâche urgente aujourd'hui — profite ou raconte ta journée pour que je note ce que tu as géré.`;
  return `${urgentCount} tâche${urgentCount > 1 ? 's' : ''} à traiter. Raconte-moi ce que tu as fait en fin de journée.`;
}

// ── Badge assignation ──────────────────────────────────────────────────────

function AssigneeBadge({
  task, currentUserId, phantomMembers,
}: {
  task: TaskListItem;
  currentUserId: string;
  phantomMembers: PhantomMember[];
}) {
  if (task.assigned_to === currentUserId) {
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#e8f4ff', color: '#007aff' }}>Moi</span>;
  }
  if (task.assignee && task.assigned_to !== currentUserId) {
    return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f0f7ff', color: '#007aff' }}>{task.assignee.display_name.split(' ')[0]}</span>;
  }
  if (task.assigned_to_phantom_id) {
    const phantom = phantomMembers.find(m => m.id === task.assigned_to_phantom_id);
    if (phantom) {
      return <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: '#f5f0ff', color: '#af52de' }}>{phantom.display_name.split(' ')[0]}</span>;
    }
  }
  return null;
}

// ── Carte tâche avec complétion rapide ─────────────────────────────────────

function TodayTaskCard({
  task, currentUserId, phantomMembers, onComplete, justCompleted,
}: {
  task: TaskListItem;
  currentUserId: string;
  phantomMembers: PhantomMember[];
  onComplete: (id: string) => void;
  justCompleted: boolean;
}) {
  const isOverdue = !!task.next_due_at && new Date(task.next_due_at) < new Date(new Date().setHours(0, 0, 0, 0));

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
          className="text-[15px] font-medium text-[#1c1c1e] truncate transition-all duration-200"
          style={{ textDecoration: justCompleted ? 'line-through' : 'none', color: justCompleted ? '#8e8e93' : '#1c1c1e' }}
        >
          {task.name}
        </p>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {isOverdue && !justCompleted && (
            <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#fff2f2', color: '#ff3b30' }}>En retard</span>
          )}
          {justCompleted && (
            <span className="text-[11px] font-semibold text-[#34c759]">✓ Fait !</span>
          )}
          {task.category && !justCompleted && (
            <span className="text-[12px] text-[#8e8e93]">{task.category.icon} {task.category.name}</span>
          )}
          {!justCompleted && <AssigneeBadge task={task} currentUserId={currentUserId} phantomMembers={phantomMembers} />}
        </div>
      </div>

      {/* Chevron vers détail */}
      {!justCompleted && (
        <Link href={`/tasks/${task.id}`} className="flex-shrink-0 text-[#c7c7cc]" aria-label="Détail">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}
    </div>
  );
}

// ── Barre d'équilibre ─────────────────────────────────────────────────────

const BALANCE_COLORS = [
  { bg: 'linear-gradient(90deg,#ff6b6b,#ff3030)', light: '#fff2f2', text: '#ff3b30' },
  { bg: 'linear-gradient(90deg,#4ecdc4,#26b5ab)', light: '#f0fafa', text: '#26b5ab' },
  { bg: 'linear-gradient(90deg,#a78bfa,#7c3aed)', light: '#f5f0ff', text: '#7c3aed' },
  { bg: 'linear-gradient(90deg,#fb923c,#ea580c)', light: '#fff7ed', text: '#ea580c' },
];

function WeeklyBalanceBar({ balance }: { balance: BalanceMember[] }) {
  if (balance.length === 0 || balance.every(m => m.pct === 0)) return null;

  return (
    <div>
      {/* Barre segmentée */}
      <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
        {balance.map((m, i) => (
          m.pct > 0 ? (
            <div
              key={i}
              className="transition-all duration-700 rounded-full"
              style={{ width: `${m.pct}%`, background: BALANCE_COLORS[i % BALANCE_COLORS.length].bg }}
            />
          ) : null
        ))}
      </div>
      {/* Légende */}
      <div className="flex items-center gap-4 mt-2 flex-wrap">
        {balance.map((m, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: BALANCE_COLORS[i % BALANCE_COLORS.length].bg }} />
            <span className="text-[12px] text-[#3c3c43]">
              {m.isMe ? 'Toi' : m.name}
            </span>
            <span className="text-[12px] font-bold" style={{ color: BALANCE_COLORS[i % BALANCE_COLORS.length].text }}>
              {m.pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────

export default function TodayPage() {
  const { profile } = useAuthStore();
  const { tasks, loading: tasksLoading, fetchTasks, completeTask, filters } = useTaskStore();
  const { householdProfile, members: phantomMembers, loading: familyLoading, fetchFamily } = useFamilyStore();
  const { facts, fetchMemory } = useMemoryStore();

  // Complétion rapide — état optimiste local
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // Équilibre hebdomadaire
  const [weeklyBalance, setWeeklyBalance] = useState<BalanceMember[]>([]);
  const [balanceLoaded, setBalanceLoaded] = useState(false);

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchFamily(profile.household_id);
      fetchMemory(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchFamily, fetchMemory]);

  // ── Charger l'équilibre hebdo ──
  const loadWeeklyBalance = useCallback(async () => {
    if (!profile?.household_id || !profile?.id) return;
    const supabase = createClient();

    // Lundi de la semaine courante
    const now = new Date();
    const day = now.getDay(); // 0=dim
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    monday.setHours(0, 0, 0, 0);

    const [{ data: completions }, { data: realMembers }] = await Promise.all([
      supabase
        .from('task_completions')
        .select('completed_by, task_id')
        .gte('completed_at', monday.toISOString()),
      supabase
        .from('profiles')
        .select('id, display_name')
        .eq('household_id', profile.household_id),
    ]);

    if (!completions || !realMembers || realMembers.length === 0) {
      setBalanceLoaded(true);
      return;
    }

    // Complétion par membre (real seulement pour l'équilibre)
    const countMap: Record<string, number> = {};
    for (const c of completions) {
      if (c.completed_by) countMap[c.completed_by] = (countMap[c.completed_by] ?? 0) + 1;
    }

    const total = Object.values(countMap).reduce((s, n) => s + n, 0);
    if (total === 0) {
      setBalanceLoaded(true);
      return;
    }

    const balance: BalanceMember[] = realMembers
      .map(m => ({
        name: m.display_name?.split(' ')[0] ?? '?',
        pct: Math.round(((countMap[m.id] ?? 0) / total) * 100),
        isMe: m.id === profile.id,
      }))
      .filter(m => m.pct > 0)
      .sort((a, b) => b.pct - a.pct);

    // Arrondir pour que le total soit exactement 100%
    const sum = balance.reduce((s, m) => s + m.pct, 0);
    if (balance.length > 0 && sum !== 100) balance[0].pct += 100 - sum;

    setWeeklyBalance(balance);
    setBalanceLoaded(true);
  }, [profile?.household_id, profile?.id]);

  useEffect(() => {
    loadWeeklyBalance();
  }, [loadWeeklyBalance]);

  // ── Complétion rapide ──
  const handleComplete = async (taskId: string) => {
    setCompletedIds(prev => new Set(prev).add(taskId));
    await completeTask(taskId);
    // Réactualiser le solde après complétion
    setTimeout(loadWeeklyBalance, 800);
  };

  // ── Sections ──
  const filtered = filterTasks(tasks, filters, profile?.id ?? '', new Set());
  const sections = splitTasksIntoSections(filtered);
  const urgentTasks: TaskListItem[] = [...sections.overdue, ...sections.today];
  const upcomingCount = sections.tomorrow.length + sections.week.length + sections.later.length;

  const firstName = profile?.display_name?.split(' ')[0] ?? 'toi';
  const hour = new Date().getHours();
  const isCrisis = householdProfile?.crisis_mode_active ?? false;
  const greeting = buildGreeting(firstName, householdProfile?.energy_level, householdProfile?.current_life_events ?? [], isCrisis, hour);
  const yovaInsight = buildYovaInsight(weeklyBalance, facts, urgentTasks.length);

  const isLoading = (tasksLoading || familyLoading) && tasks.length === 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    );
  }

  const todayLabel = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const todayCapitalized = todayLabel.charAt(0).toUpperCase() + todayLabel.slice(1);

  return (
    <div className="space-y-4 pb-4">

      {/* ── En-tête ── */}
      <div>
        <p className="text-[13px] text-[#8e8e93] font-medium">{todayCapitalized}</p>
        <h1 className="text-[28px] font-bold text-[#1c1c1e] leading-tight mt-0.5">Aujourd&apos;hui</h1>
      </div>

      {/* ── Mode crise ── */}
      {isCrisis && (
        <Link href="/family" className="flex items-center gap-3 px-4 py-3.5 rounded-2xl"
          style={{ background: '#fff2f0', border: '1.5px solid #ff3b30' }}>
          <span className="text-[22px]">🚨</span>
          <div className="flex-1">
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Mode crise actif</p>
            <p className="text-[13px] text-[#ff3b30]">Seul l&apos;essentiel est affiché</p>
          </div>
          <svg width="16" height="16" fill="none" stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24"><path d="M9 18l6-6-6-6" /></svg>
        </Link>
      )}

      {/* ── Bloc Yova : greeting + insight + équilibre ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
        {/* Greeting */}
        <div className="flex items-start gap-3 px-4 pt-4 pb-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-[15px] font-bold text-white"
            style={{ background: 'rgba(255,255,255,0.15)' }}>Y</div>
          <p className="text-[15px] text-white/90 leading-relaxed flex-1">{greeting}</p>
        </div>

        {/* Insight Yova */}
        <div className="mx-4 mb-3 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <p className="text-[13px] text-white/70 leading-relaxed">✦ {yovaInsight}</p>
        </div>

        {/* Équilibre hebdo */}
        {balanceLoaded && weeklyBalance.length > 0 && (
          <div className="mx-4 mb-4 px-3 py-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-wide mb-2.5">
              Cette semaine
            </p>
            <WeeklyBalanceBar balance={weeklyBalance} />
          </div>
        )}

        {/* Lien journal */}
        <Link href="/journal"
          className="mx-4 mb-4 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold text-white transition-opacity active:opacity-70"
          style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)' }}>
          <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          Raconter ma journée à Yova
        </Link>
      </div>

      {/* ── Tâches urgentes ── */}
      {urgentTasks.length === 0 ? (
        <div className="rounded-2xl px-4 py-8 text-center bg-white" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}>
          <p className="text-[36px] mb-2">✨</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Rien à faire aujourd&apos;hui</p>
          <p className="text-[14px] text-[#8e8e93] mt-1">
            {upcomingCount > 0
              ? `${upcomingCount} tâche${upcomingCount > 1 ? 's' : ''} à venir cette semaine`
              : 'Profite — ou raconte ta journée à Yova'}
          </p>
        </div>
      ) : (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-[17px] font-semibold text-[#1c1c1e]">
              {sections.overdue.length > 0 ? '🔥 À traiter' : '📋 Du jour'}
            </h2>
            <Link href="/tasks" className="text-[14px] text-[#007aff] font-medium">Mes tâches</Link>
          </div>
          <div className="space-y-2">
            {urgentTasks.slice(0, 6).map(task => (
              <TodayTaskCard
                key={task.id}
                task={task}
                currentUserId={profile?.id ?? ''}
                phantomMembers={phantomMembers}
                onComplete={handleComplete}
                justCompleted={completedIds.has(task.id)}
              />
            ))}
            {urgentTasks.length > 6 && (
              <Link href="/tasks" className="block text-center text-[14px] text-[#007aff] font-medium py-2">
                +{urgentTasks.length - 6} tâches de plus →
              </Link>
            )}
          </div>
        </section>
      )}

      {/* ── À venir ── */}
      {urgentTasks.length > 0 && upcomingCount > 0 && (
        <Link href="/tasks" className="flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white"
          style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.08)' }}>
          <div>
            <p className="text-[15px] font-medium text-[#1c1c1e]">À venir</p>
            <p className="text-[13px] text-[#8e8e93]">{upcomingCount} tâche{upcomingCount > 1 ? 's' : ''} cette semaine</p>
          </div>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24" className="text-[#c7c7cc]">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </Link>
      )}

    </div>
  );
}
