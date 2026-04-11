'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { frequencyLabel } from '@/utils/frequency';
import { computeMemberBalance, generateExchangeSuggestions } from '@/utils/exchangeSuggestions';

export default function DashboardPage() {
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { household, members } = useHouseholdStore();
  const { memberAnalytics, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchAnalytics(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchAnalytics]);

  const kpi = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);

    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) < todayStart).length;
    const todayTasks = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const d = new Date(t.next_due_at);
      return d >= todayStart && d < todayEnd;
    }).length;

    const totalActive = tasks.length;
    const myTasks = tasks.filter((t) => t.assigned_to === profile?.id);
    const myCount = myTasks.length;
    const myPercentage = totalActive > 0 ? Math.round((myCount / totalActive) * 100) : 0;

    // Charge mentale totale par membre
    const mentalByMember = new Map<string, number>();
    for (const t of tasks) {
      if (t.assigned_to) {
        mentalByMember.set(t.assigned_to, (mentalByMember.get(t.assigned_to) ?? 0) + t.mental_load_score);
      }
    }
    const myMentalTotal = mentalByMember.get(profile?.id ?? '') ?? 0;

    // Score d'équité (écart max entre membres)
    const mentalValues = Array.from(mentalByMember.values());
    const maxMental = Math.max(...mentalValues, 0);
    const minMental = Math.min(...mentalValues, 0);
    const equityGap = mentalValues.length > 1 ? maxMental - minMental : 0;
    const equityLabel = equityGap <= 3 ? 'Équilibré' : equityGap <= 8 ? 'Déséquilibre' : 'Fort déséquilibre';
    const equityColor = equityGap <= 3 ? '#34c759' : equityGap <= 8 ? '#ff9500' : '#ff3b30';

    // Top 3 tâches les plus lourdes
    const heaviest = [...tasks]
      .sort((a, b) => (b.global_score ?? b.mental_load_score) - (a.global_score ?? a.mental_load_score))
      .slice(0, 3);

    // Score global moyen
    const tasksWithScore = tasks.filter((t) => t.global_score != null);
    const avgGlobalScore = tasksWithScore.length > 0
      ? Math.round(tasksWithScore.reduce((sum, t) => sum + (t.global_score ?? 0), 0) / tasksWithScore.length)
      : null;

    return { overdue, todayTasks, totalActive, myCount, myPercentage, myMentalTotal, equityGap, equityLabel, equityColor, heaviest, avgGlobalScore, mentalByMember };
  }, [tasks, profile?.id]);

  // Balance et suggestions
  const balance = useMemo(() => computeMemberBalance(tasks, members), [tasks, members]);
  const suggestions = useMemo(() => generateExchangeSuggestions(tasks, members), [tasks, members]);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  })();

  return (
    <div className="pt-4 space-y-5">
      {/* Greeting */}
      <div className="px-4">
        <p className="text-[15px] text-[#8e8e93]">{greeting}</p>
        <h2 className="text-[28px] font-bold text-[#1c1c1e]">{profile?.display_name}</h2>
      </div>

      {/* KPI principaux — grille 2x2 */}
      <div className="px-4 grid grid-cols-2 gap-3">
        <Link href="/tasks" className="rounded-2xl p-4" style={{
          background: kpi.overdue > 0 ? 'linear-gradient(135deg, #ff3b30, #ff6b6b)' : 'white',
          color: kpi.overdue > 0 ? 'white' : '#1c1c1e',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <p className="text-[32px] font-bold">{kpi.overdue}</p>
          <p className="text-[13px] font-medium" style={{ opacity: 0.8 }}>En retard</p>
        </Link>

        <Link href="/tasks" className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] font-bold" style={{ color: '#007aff' }}>{kpi.todayTasks}</p>
          <p className="text-[13px] font-medium text-[#8e8e93]">Aujourd&apos;hui</p>
        </Link>

        <Link href="/distribution" className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] font-bold" style={{ color: '#af52de' }}>{kpi.myPercentage}%</p>
          <p className="text-[13px] font-medium text-[#8e8e93]">Ma part</p>
        </Link>

        <div className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] font-bold" style={{ color: kpi.equityColor }}>{kpi.equityGap}</p>
          <p className="text-[13px] font-medium text-[#8e8e93]">{kpi.equityLabel}</p>
        </div>
      </div>

      {/* Charge mentale par membre */}
      {members.length > 1 && (
        <div className="px-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Charge mentale cumulée</p>
          <div className="rounded-xl bg-white p-4 space-y-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {members.map((m, i) => {
              const colors = ['#007aff', '#af52de', '#ff9500', '#34c759'];
              const color = colors[i % colors.length];
              const mentalTotal = kpi.mentalByMember.get(m.id) ?? 0;
              const maxVal = Math.max(...Array.from(kpi.mentalByMember.values()), 1);
              const pct = Math.round((mentalTotal / maxVal) * 100);
              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium text-[#1c1c1e]">{m.display_name}</span>
                    <span className="font-bold" style={{ color }}>{mentalTotal} pts</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: '#f2f2f7' }}>
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Objectif vs réalité */}
      {balance.length > 1 && balance.some((b) => Math.abs(b.gap) > 3) && (
        <div className="px-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Objectif vs réalité</p>
          <div className="rounded-xl bg-white p-4 space-y-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {balance.map((b) => {
              const gapColor = Math.abs(b.gap) <= 5 ? '#34c759' : Math.abs(b.gap) <= 15 ? '#ff9500' : '#ff3b30';
              return (
                <div key={b.memberId} className="flex items-center justify-between">
                  <span className="text-[14px] text-[#1c1c1e]">{b.displayName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] text-[#8e8e93]">Objectif {b.targetPercent}%</span>
                    <span className="text-[13px] font-bold" style={{ color: gapColor }}>
                      Réel {b.currentPercent}%
                    </span>
                    {b.gap > 3 && <span className="text-[11px]" style={{ color: '#ff3b30' }}>↑ surcharge</span>}
                    {b.gap < -3 && <span className="text-[11px]" style={{ color: '#007aff' }}>↓ sous-charge</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestions d'échanges */}
      {suggestions.length > 0 && (
        <div className="px-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">💡 Suggestions de rééquilibrage</p>
          <div className="space-y-2">
            {suggestions.map((s, i) => (
              <div key={i} className="rounded-xl bg-white p-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                <p className="text-[14px] text-[#1c1c1e] mb-2">{s.impactDescription}</p>
                <div className="flex items-center gap-2 mb-3">
                  <span className="rounded-lg px-2 py-1 text-[12px] font-medium" style={{ background: '#fff2f2', color: '#ff3b30' }}>
                    {s.taskToGive.name}
                  </span>
                  <span className="text-[#8e8e93]">↔</span>
                  <span className="rounded-lg px-2 py-1 text-[12px] font-medium" style={{ background: '#f0f4ff', color: '#007aff' }}>
                    {s.taskToReceive.name}
                  </span>
                </div>
                <Link href={`/exchanges?offer=${s.taskToGive.id}&request=${s.taskToReceive.id}&to=${s.toMemberId}`}
                  className="block w-full rounded-lg py-2 text-center text-[14px] font-semibold text-white"
                  style={{ background: '#007aff' }}>
                  Proposer cet échange
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tâches les plus lourdes */}
      {kpi.heaviest.length > 0 && (
        <div className="px-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Tâches les plus lourdes</p>
          <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {kpi.heaviest.map((t, i) => {
              const score = t.global_score ?? t.mental_load_score;
              const scoreColor = score >= 25 ? '#ff3b30' : score >= 17 ? '#ff9500' : '#007aff';
              return (
                <Link key={t.id} href={`/tasks/${t.id}`}
                  className="flex items-center justify-between px-4 py-3"
                  style={i < kpi.heaviest.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{t.name}</p>
                    <p className="text-[12px] text-[#8e8e93]">
                      {t.category?.name} · {frequencyLabel(t.frequency)}
                      {t.assignee && ` · ${t.assignee.display_name}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[17px] font-bold" style={{ color: scoreColor }}>{score}</span>
                    <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Tâches du jour */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">À faire aujourd&apos;hui</p>
          <Link href="/tasks" className="text-[13px] font-medium" style={{ color: '#007aff' }}>Tout voir</Link>
        </div>

        {kpi.todayTasks === 0 && kpi.overdue === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-[28px] mb-1">✨</p>
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Tout est à jour !</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {tasks
              .filter((t) => {
                if (!t.next_due_at) return false;
                const d = new Date(t.next_due_at);
                const now = new Date();
                const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                return d < todayEnd;
              })
              .slice(0, 5)
              .map((task, i, arr) => (
                <Link key={task.id} href={`/tasks/${task.id}`}
                  className="flex items-center justify-between px-4 py-3"
                  style={i < arr.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{
                      background: task.next_due_at && new Date(task.next_due_at) < new Date(new Date().setHours(0,0,0,0)) ? '#ff3b30' : '#007aff'
                    }} />
                    <span className="text-[15px] text-[#1c1c1e] truncate">{task.name}</span>
                  </div>
                  <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
                </Link>
              ))}
          </div>
        )}
      </div>

      {/* Répartition rapide */}
      {memberAnalytics.length > 1 && (
        <div className="px-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Répartition (7 jours)</p>
            <Link href="/distribution" className="text-[13px] font-medium" style={{ color: '#007aff' }}>Détails</Link>
          </div>
          <div className="rounded-xl bg-white p-4 space-y-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {memberAnalytics.map((m, i) => {
              const colors = ['#007aff', '#af52de', '#ff9500', '#34c759'];
              const color = colors[i % colors.length];
              return (
                <div key={m.memberId} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className="font-medium text-[#1c1c1e]">{m.displayName}</span>
                    <span className="font-bold" style={{ color }}>{m.taskPercentage}%</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: '#f2f2f7' }}>
                    <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${m.taskPercentage}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="px-4 grid grid-cols-2 gap-3 pb-8">
        <Link href="/tasks/new"
          className="rounded-2xl p-4 text-center text-[15px] font-semibold text-white"
          style={{ background: '#007aff' }}>
          + Nouvelle tâche
        </Link>
        <Link href="/tasks/log"
          className="rounded-2xl p-4 text-center text-[15px] font-semibold"
          style={{ color: '#007aff', background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          J&apos;ai fait une tâche
        </Link>
      </div>
    </div>
  );
}
