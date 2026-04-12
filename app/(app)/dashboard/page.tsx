'use client';

import { useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { computeMemberBalance } from '@/utils/exchangeSuggestions';

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

  const data = useMemo(() => {
    const myTasks = tasks.filter((t) => t.assigned_to === profile?.id);
    const myLoad = myTasks.reduce((sum, t) => sum + Math.min(36, t.global_score ?? (t.mental_load_score * 7)), 0);
    const totalLoad = tasks.reduce((sum, t) => sum + Math.min(36, t.global_score ?? (t.mental_load_score * 7)), 0);

    // Mon % réel
    const myPercent = totalLoad > 0 ? Math.round((myLoad / totalLoad) * 100) : 0;
    const targetPercent = profile?.target_share_percent ?? 50;
    const gap = myPercent - targetPercent;

    // Tâches en retard
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) < todayStart).length;
    const todayTasks = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const d = new Date(t.next_due_at);
      return d >= todayStart && d < new Date(todayStart.getTime() + 86400000);
    }).length;

    // Top 3 tâches les plus lourdes (les miennes)
    const heaviest = [...myTasks]
      .sort((a, b) => (b.global_score ?? b.mental_load_score * 7) - (a.global_score ?? a.mental_load_score * 7))
      .slice(0, 3);

    // Temps estimé par membre (en minutes)
    const durationMap: Record<string, number> = { very_short: 3, short: 10, medium: 22, long: 45, very_long: 75 };
    const timeByMember = members.map((m) => {
      const mTasks = tasks.filter((t) => t.assigned_to === m.id);
      const totalMin = mTasks.reduce((s, t) => {
        const est = t.duration_estimate ? (durationMap[t.duration_estimate] ?? 15) : 15;
        return s + est;
      }, 0);
      return { id: m.id, name: m.display_name, minutes: totalMin, isMe: m.id === profile?.id };
    }).sort((a, b) => b.minutes - a.minutes);

    const myTimeMin = timeByMember.find((m) => m.isMe)?.minutes ?? 0;
    const maxTimeMin = Math.max(...timeByMember.map((m) => m.minutes), 1);

    // Load par membre pour la comparaison
    const loadByMember = members.map((m) => {
      const mTasks = tasks.filter((t) => t.assigned_to === m.id);
      const load = mTasks.reduce((s, t) => s + Math.min(36, t.global_score ?? (t.mental_load_score * 7)), 0);
      return { id: m.id, name: m.display_name, load, isMe: m.id === profile?.id };
    }).sort((a, b) => b.load - a.load);

    const maxLoad = Math.max(...loadByMember.map((m) => m.load), 1);

    // Niveau de charge
    const avgLoadPerTask = myTasks.length > 0 ? Math.round(myLoad / myTasks.length) : 0;
    const loadLevel = myLoad === 0 ? 'Aucune charge' :
      avgLoadPerTask <= 10 ? 'Charge légère' :
      avgLoadPerTask <= 20 ? 'Charge modérée' :
      avgLoadPerTask <= 28 ? 'Charge élevée' :
      'Charge critique';
    const loadColor = myLoad === 0 ? '#8e8e93' :
      avgLoadPerTask <= 10 ? '#34c759' :
      avgLoadPerTask <= 20 ? '#007aff' :
      avgLoadPerTask <= 28 ? '#ff9500' :
      '#ff3b30';

    return { myLoad, totalLoad, myPercent, targetPercent, gap, overdue, todayTasks, heaviest, loadByMember, maxLoad, loadLevel, loadColor, myTasks, timeByMember, myTimeMin, maxTimeMin };
  }, [tasks, profile?.id, profile?.target_share_percent, members]);

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

      {/* 1. MON LOAD — le KPI central */}
      <div className="mx-4 rounded-2xl p-6 text-center text-white" style={{ background: `linear-gradient(135deg, ${data.loadColor}, ${data.loadColor}cc)` }}>
        <p className="text-[13px] uppercase tracking-wide font-semibold opacity-80">Mon Load total</p>
        <p className="text-[56px] font-black leading-none mt-1">{data.myLoad}</p>
        <p className="text-[15px] font-medium mt-1 opacity-90">{data.loadLevel}</p>
        <div className="flex justify-center gap-4 mt-3 text-[12px] opacity-70">
          <span>{data.myTasks.length} tâche{data.myTasks.length > 1 ? 's' : ''}</span>
          <span>·</span>
          <span>~{data.myTimeMin >= 60 ? `${Math.floor(data.myTimeMin / 60)}h${data.myTimeMin % 60 > 0 ? `${data.myTimeMin % 60}min` : ''}` : `${data.myTimeMin}min`} estimées</span>
        </div>
      </div>

      {/* 2. OBJECTIF VS RÉALITÉ */}
      <div className="mx-4 rounded-2xl bg-white p-5" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
        <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-3">Objectif vs Réalité</p>
        <div className="flex items-center justify-between mb-2">
          <div className="text-center flex-1">
            <p className="text-[11px] text-[#8e8e93]">Objectif</p>
            <p className="text-[28px] font-bold text-[#007aff]">{data.targetPercent}%</p>
          </div>
          <div className="text-center px-4">
            <span className="text-[20px]" style={{ color: Math.abs(data.gap) <= 5 ? '#34c759' : data.gap > 0 ? '#ff3b30' : '#007aff' }}>
              {data.gap > 5 ? '⬆' : data.gap < -5 ? '⬇' : '✓'}
            </span>
          </div>
          <div className="text-center flex-1">
            <p className="text-[11px] text-[#8e8e93]">Réalité</p>
            <p className="text-[28px] font-bold" style={{ color: Math.abs(data.gap) <= 5 ? '#34c759' : data.gap > 0 ? '#ff3b30' : '#007aff' }}>{data.myPercent}%</p>
          </div>
        </div>
        <p className="text-[12px] text-center" style={{ color: Math.abs(data.gap) <= 5 ? '#34c759' : '#ff9500' }}>
          {Math.abs(data.gap) <= 5 ? 'Vous êtes dans l\'objectif ✓' :
           data.gap > 0 ? `Vous portez ${data.gap}% de plus que votre objectif` :
           `Vous êtes ${Math.abs(data.gap)}% en dessous de votre objectif`}
        </p>
      </div>

      {/* 3. ALERTES — en retard + aujourd'hui */}
      {(data.overdue > 0 || data.todayTasks > 0) && (
        <div className="px-4 grid grid-cols-2 gap-3">
          {data.overdue > 0 && (
            <Link href="/tasks" className="rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #ff3b30, #ff6b6b)', color: 'white' }}>
              <p className="text-[28px] font-bold">{data.overdue}</p>
              <p className="text-[13px] font-medium opacity-80">En retard</p>
            </Link>
          )}
          <Link href="/tasks" className="rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <p className="text-[28px] font-bold" style={{ color: '#007aff' }}>{data.todayTasks}</p>
            <p className="text-[13px] font-medium text-[#8e8e93]">Aujourd&apos;hui</p>
          </Link>
        </div>
      )}

      {/* 4. ÉQUILIBRE DU FOYER */}
      {data.loadByMember.length > 1 && (
        <div className="mx-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Équilibre du foyer</p>
          <div className="rounded-xl bg-white p-4 space-y-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {data.loadByMember.map((m, i) => {
              const colors = ['#007aff', '#af52de', '#ff9500', '#34c759'];
              const color = colors[i % colors.length];
              const pct = Math.round((m.load / data.maxLoad) * 100);
              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className={`font-medium ${m.isMe ? 'text-[#007aff]' : 'text-[#1c1c1e]'}`}>
                      {m.name} {m.isMe && '(moi)'}
                    </span>
                    <span className="font-bold" style={{ color }}>{m.load} pts</span>
                  </div>
                  <div className="h-2.5 rounded-full" style={{ background: '#f2f2f7' }}>
                    <div className="h-2.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4b. TEMPS PAR MEMBRE */}
      {data.timeByMember.length > 1 && (
        <div className="mx-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Temps estimé par membre</p>
          <div className="rounded-xl bg-white p-4 space-y-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {data.timeByMember.map((m, i) => {
              const colors = ['#5856d6', '#007aff', '#ff9500', '#34c759'];
              const color = colors[i % colors.length];
              const pct = Math.round((m.minutes / data.maxTimeMin) * 100);
              const timeStr = m.minutes >= 60 ? `${Math.floor(m.minutes / 60)}h${m.minutes % 60 > 0 ? `${m.minutes % 60}` : ''}` : `${m.minutes}min`;
              return (
                <div key={m.id} className="space-y-1">
                  <div className="flex justify-between text-[13px]">
                    <span className={`font-medium ${m.isMe ? 'text-[#5856d6]' : 'text-[#1c1c1e]'}`}>
                      {m.name} {m.isMe && '(moi)'}
                    </span>
                    <span className="font-bold" style={{ color }}>{timeStr}</span>
                  </div>
                  <div className="h-2.5 rounded-full" style={{ background: '#f2f2f7' }}>
                    <div className="h-2.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. MES TÂCHES LES PLUS LOURDES */}
      {data.heaviest.length > 0 && (
        <div className="mx-4">
          <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Mes tâches les plus lourdes</p>
          <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            {data.heaviest.map((t, i) => {
              const score = Math.min(36, t.global_score ?? (t.mental_load_score * 7));
              const scoreColor = score <= 8 ? '#34c759' : score <= 16 ? '#007aff' : score <= 24 ? '#ff9500' : '#ff3b30';
              return (
                <Link key={t.id} href={`/tasks/${t.id}`}
                  className="flex items-center justify-between px-4 py-3"
                  style={i < data.heaviest.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-medium text-[#1c1c1e] truncate">{t.name}</p>
                    <p className="text-[12px] text-[#8e8e93]">{t.category?.name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-[9px] text-[#8e8e93] uppercase">Load</p>
                      <p className="text-[17px] font-bold" style={{ color: scoreColor }}>{score}</p>
                    </div>
                    <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. ACTIONS RAPIDES */}
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
