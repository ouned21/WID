'use client';

import { taskLoad, taskScoreDisplay, scoreColor10 } from '@/utils/designSystem';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { createClient } from '@/lib/supabase';

export default function DashboardClassic() {
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { household, members } = useHouseholdStore();
  const { fetchAnalytics } = useAnalyticsStore();

  const [weekTrend, setWeekTrend] = useState<number | null>(null);

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchAnalytics(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchAnalytics]);

  // Charger la tendance semaine
  useEffect(() => {
    if (!profile?.household_id || !profile?.id) return;
    async function loadTrend() {
      const supabase = createClient();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

      const [thisWeek, lastWeek] = await Promise.all([
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', twoWeeksAgo.toISOString()).lt('completed_at', weekAgo.toISOString()),
      ]);

      const tw = thisWeek.count ?? 0;
      const lw = lastWeek.count ?? 0;
      setWeekTrend(tw - lw);
    }
    loadTrend();
  }, [profile?.household_id, profile?.id]);

  const data = useMemo(() => {
    const durationMap: Record<string, number> = { very_short: 3, short: 10, medium: 22, long: 45, very_long: 75 };
    const myTasks = tasks.filter((t) => t.assigned_to === profile?.id);
    const myLoad = myTasks.reduce((sum, t) => sum + taskLoad(t), 0);
    const totalLoad = tasks.reduce((sum, t) => sum + taskLoad(t), 0);

    const myPercent = totalLoad > 0 ? Math.round((myLoad / totalLoad) * 100) : 0;
    const targetPercent = profile?.target_share_percent ?? 50;
    const gap = myPercent - targetPercent;
    const progressToTarget = Math.min(100, Math.max(0, 100 - Math.abs(gap) * 2));

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) < todayStart).length;
    const todayCount = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const d = new Date(t.next_due_at);
      return d >= todayStart && d < new Date(todayStart.getTime() + 86400000);
    }).length;

    const heaviest = [...myTasks]
      .sort((a, b) => taskLoad(b) - taskLoad(a))
      .slice(0, 3);

    const loadByMember = members.map((m) => {
      const mTasks = tasks.filter((t) => t.assigned_to === m.id);
      const load = mTasks.reduce((s, t) => s + taskLoad(t), 0);
      const time = mTasks.reduce((s, t) => s + (durationMap[t.duration_estimate ?? 'medium'] ?? 15), 0);
      return { id: m.id, name: m.display_name, load, time, isMe: m.id === profile?.id };
    }).sort((a, b) => b.load - a.load);

    const maxLoad = Math.max(...loadByMember.map((m) => m.load), 1);
    const myTimeMin = loadByMember.find((m) => m.isMe)?.time ?? 0;

    const avgLoadPerTask = myTasks.length > 0 ? Math.round(myLoad / myTasks.length) : 0;
    const loadColor = myLoad === 0 ? '#8e8e93' : avgLoadPerTask <= 10 ? '#34c759' : avgLoadPerTask <= 20 ? '#007aff' : avgLoadPerTask <= 28 ? '#ff9500' : '#ff3b30';
    const loadMsg = myLoad === 0 ? 'Aucune charge' : avgLoadPerTask <= 10 ? 'Charge légère — ça roule' : avgLoadPerTask <= 20 ? 'Charge modérée — sous contrôle' : avgLoadPerTask <= 28 ? 'Charge élevée — attention' : 'Surcharge — rééquilibrage urgent';

    return { myLoad, myPercent, targetPercent, gap, progressToTarget, overdue, todayCount, heaviest, loadByMember, maxLoad, myTimeMin, loadColor, loadMsg, myTasks };
  }, [tasks, profile?.id, profile?.target_share_percent, members]);

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  const trendText = weekTrend === null ? '' : weekTrend > 0 ? `+${weekTrend} cette semaine` : weekTrend < 0 ? `${weekTrend} cette semaine` : 'Stable cette semaine';
  const trendColor = weekTrend === null ? '#8e8e93' : weekTrend > 2 ? '#34c759' : weekTrend < -2 ? '#ff9500' : '#8e8e93';

  return (
    <div className="pt-4 space-y-4 pb-8">
      {/* Greeting */}
      <div className="px-4">
        <p className="text-[14px] text-[#8e8e93]">{greeting}</p>
        <h2 className="text-[26px] font-bold text-[#1c1c1e]">{profile?.display_name}</h2>
      </div>

      {/* HERO — Mon Load */}
      <div className="mx-4 rounded-3xl p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${data.loadColor}ee, ${data.loadColor}88)` }}>
        {/* Cercle decoratif */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="absolute -right-4 -bottom-12 w-24 h-24 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />

        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-white/70 uppercase font-bold tracking-wider">Mon Load</p>
              <p className="text-[52px] font-black text-white leading-none mt-1">{data.myLoad}</p>
            </div>
            {weekTrend !== null && (
              <div className="text-right">
                <span className="text-[13px] font-semibold" style={{ color: trendColor === '#8e8e93' ? 'rgba(255,255,255,0.7)' : 'white' }}>
                  {weekTrend > 0 ? '↑' : weekTrend < 0 ? '↓' : '→'}
                </span>
                <p className="text-[11px] text-white/60 mt-0.5">{trendText}</p>
              </div>
            )}
          </div>

          <p className="text-[14px] text-white/90 font-medium mt-2">{data.loadMsg}</p>

          <div className="flex gap-4 mt-3 text-[11px] text-white/60">
            <span>{data.myTasks.length} tâche{data.myTasks.length > 1 ? 's' : ''}</span>
            <span>~{data.myTimeMin >= 60 ? `${Math.floor(data.myTimeMin / 60)}h${data.myTimeMin % 60 > 0 ? String(data.myTimeMin % 60).padStart(2, '0') : ''}` : `${data.myTimeMin}min`}</span>
          </div>

          {/* Barre objectif */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-white/50 mb-1">
              <span>Objectif {data.targetPercent}%</span>
              <span>Réalité {data.myPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-white/20">
              <div className="h-1.5 rounded-full bg-white transition-all duration-700" style={{ width: `${data.progressToTarget}%` }} />
            </div>
            <p className="text-[10px] text-white/50 mt-1">
              {Math.abs(data.gap) <= 5 ? '✓ Dans l\'objectif' : data.gap > 0 ? `${data.gap}% au-dessus` : `${Math.abs(data.gap)}% en dessous`}
            </p>
          </div>
        </div>
      </div>

      {/* Alertes */}
      {(data.overdue > 0 || data.todayCount > 0) && (
        <div className="px-4 flex gap-2">
          {data.overdue > 0 && (
            <Link href="/tasks" className="flex-1 rounded-2xl px-4 py-3 flex items-center gap-3" style={{ background: '#ff3b30', color: 'white' }}>
              <span className="text-[24px] font-black">{data.overdue}</span>
              <span className="text-[13px] font-medium opacity-90">en retard</span>
            </Link>
          )}
          <Link href="/tasks" className="flex-1 rounded-2xl bg-white px-4 py-3 flex items-center gap-3" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <span className="text-[24px] font-black" style={{ color: '#007aff' }}>{data.todayCount}</span>
            <span className="text-[13px] font-medium text-[#8e8e93]">aujourd&apos;hui</span>
          </Link>
        </div>
      )}

      {/* Équilibre foyer */}
      {data.loadByMember.length > 1 && (
        <div className="mx-4 rounded-2xl bg-white p-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-3">Équilibre du foyer</p>
          {data.loadByMember.map((m, i) => {
            const colors = ['#007aff', '#af52de', '#ff9500', '#34c759'];
            const color = colors[i % colors.length];
            const pct = Math.round((m.load / data.maxLoad) * 100);
            const timeStr = m.time >= 60 ? `${Math.floor(m.time / 60)}h${m.time % 60 > 0 ? String(m.time % 60).padStart(2, '0') : ''}` : `${m.time}min`;
            return (
              <div key={m.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className={`font-semibold ${m.isMe ? '' : 'text-[#1c1c1e]'}`} style={m.isMe ? { color } : {}}>
                    {m.name} {m.isMe && '(moi)'}
                  </span>
                  <span className="text-[#8e8e93]">{m.load} pts · {timeStr}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: '#f0f2f8' }}>
                  <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Top 3 priorités */}
      {data.heaviest.length > 0 && (
        <div className="mx-4">
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-2 px-1">Priorités</p>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {data.heaviest.map((t, i) => {
              const score10 = taskScoreDisplay(t);
              const scCompare = taskLoad(t);
              const sc = scoreColor10(score10);
              const tags: string[] = [];
              if (scCompare >= 25) tags.push('🔥');
              const sb = t.score_breakdown as Record<string, number> | null;
              if (sb && sb.mental_load_score >= 12) tags.push('🧠');
              if (sb && sb.physical_score >= 4) tags.push('💪');
              return (
                <Link key={t.id} href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3"
                  style={i < data.heaviest.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <span className="text-[22px] font-black w-8 text-center" style={{ color: sc }}>{score10}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#1c1c1e] truncate">{t.name}</p>
                    <p className="text-[11px] text-[#8e8e93]">{t.category?.name} {tags.join(' ')}</p>
                  </div>
                  <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Teaser gamification */}
      <Link href="/boost" className="mx-4 rounded-2xl p-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #ff9500, #ff3b30)', boxShadow: '0 2px 8px rgba(255,59,48,0.2)' }}>
        <div>
          <p className="text-[14px] font-bold text-white">Progression</p>
          <p className="text-[11px] text-white/70">Niveaux, badges, challenges →</p>
        </div>
        <span className="text-[24px]">🔥</span>
      </Link>

      {/* Quick actions */}
      <div className="px-4 grid grid-cols-2 gap-2">
        <Link href="/tasks/new"
          className="rounded-2xl p-3.5 text-center text-[14px] font-bold text-white"
          style={{ background: '#007aff' }}>
          + Nouvelle tâche
        </Link>
        <Link href="/tasks/log"
          className="rounded-2xl p-3.5 text-center text-[14px] font-bold"
          style={{ color: '#007aff', background: 'white', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          J&apos;ai fait une tâche
        </Link>
      </div>
    </div>
  );
}
