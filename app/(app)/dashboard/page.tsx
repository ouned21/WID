'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

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

  // KPI calculés
  const kpi = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) < todayStart).length;
    const todayTasks = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const d = new Date(t.next_due_at);
      return d >= todayStart && d < new Date(todayStart.getTime() + 86400000);
    }).length;

    const totalActive = tasks.length;

    // Charge mentale moyenne (ancien score 0-5)
    const avgMentalLoad = totalActive > 0
      ? Math.round(tasks.reduce((sum, t) => sum + t.mental_load_score, 0) / totalActive * 10) / 10
      : 0;

    // Répartition
    const myTasks = tasks.filter((t) => t.assigned_to === profile?.id).length;
    const myPercentage = totalActive > 0 ? Math.round((myTasks / totalActive) * 100) : 0;

    // Score global moyen (si disponible)
    const tasksWithScore = tasks.filter((t) => t.global_score != null);
    const avgGlobalScore = tasksWithScore.length > 0
      ? Math.round(tasksWithScore.reduce((sum, t) => sum + (t.global_score ?? 0), 0) / tasksWithScore.length)
      : null;

    return { overdue, todayTasks, totalActive, avgMentalLoad, myTasks, myPercentage, avgGlobalScore };
  }, [tasks, profile?.id]);

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

      {/* KPI Cards — grille 2x2 */}
      <div className="px-4 grid grid-cols-2 gap-3">
        {/* Tâches en retard */}
        <Link href="/tasks" className="rounded-2xl p-4" style={{
          background: kpi.overdue > 0 ? 'linear-gradient(135deg, #ff3b30, #ff6b6b)' : 'white',
          color: kpi.overdue > 0 ? 'white' : '#1c1c1e',
          boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <p className="text-[32px] font-bold">{kpi.overdue}</p>
          <p className="text-[13px] font-medium" style={{ opacity: 0.8 }}>En retard</p>
        </Link>

        {/* Aujourd'hui */}
        <Link href="/tasks" className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] font-bold" style={{ color: '#007aff' }}>{kpi.todayTasks}</p>
          <p className="text-[13px] font-medium text-[#8e8e93]">Aujourd&apos;hui</p>
        </Link>

        {/* Ma part */}
        <Link href="/distribution" className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] font-bold" style={{ color: '#af52de' }}>{kpi.myPercentage}%</p>
          <p className="text-[13px] font-medium text-[#8e8e93]">Ma part</p>
        </Link>

        {/* Score moyen */}
        <Link href="/distribution" className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] font-bold" style={{ color: '#ff9500' }}>
            {kpi.avgGlobalScore ?? kpi.avgMentalLoad}
          </p>
          <p className="text-[13px] font-medium text-[#8e8e93]">
            {kpi.avgGlobalScore != null ? 'Score moyen' : 'Charge moy.'}
          </p>
        </Link>
      </div>

      {/* Quick Log — tâches du jour */}
      <div className="px-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">À faire aujourd&apos;hui</p>
          <Link href="/tasks" className="text-[13px] font-medium" style={{ color: '#007aff' }}>Tout voir</Link>
        </div>

        {kpi.todayTasks === 0 && kpi.overdue === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <p className="text-[28px] mb-1">✨</p>
            <p className="text-[15px] font-semibold text-[#1c1c1e]">Tout est à jour !</p>
            <p className="text-[13px] text-[#8e8e93] mt-1">Aucune tâche prévue pour le moment</p>
          </div>
        ) : (
          <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {tasks
              .filter((t) => {
                if (!t.next_due_at) return false;
                const d = new Date(t.next_due_at);
                const now = new Date();
                const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
                return d < todayEnd; // aujourd'hui + en retard
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

      {/* Quick actions */}
      <div className="px-4 grid grid-cols-2 gap-3 pb-4">
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

      {/* Répartition rapide */}
      {memberAnalytics.length > 1 && (
        <div className="px-4 pb-8">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide">Répartition</p>
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
    </div>
  );
}
