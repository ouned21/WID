'use client';

import { taskLoad } from '@/utils/designSystem';

import { useEffect, useMemo, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';

type Period = 7 | 30 | 90;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 j' },
  { value: 30, label: '30 j' },
  { value: 90, label: '90 j' },
];

const MEMBER_COLORS = ['#007aff', '#af52de', '#ff9500', '#34c759', '#ff3b30', '#5856d6'];

export default function DistributionPage() {
  const { profile } = useAuthStore();
  const { period, memberAnalytics, categoryBreakdown, loading, setPeriod, fetchAnalytics } = useAnalyticsStore();
  const { tasks } = useTaskStore();
  const { members } = useHouseholdStore();

  // Historique des complétions par jour pour la tendance
  const [dailyHistory, setDailyHistory] = useState<Record<string, number[]>>({});

  useEffect(() => {
    if (profile?.household_id) fetchAnalytics(profile.household_id);
  }, [profile?.household_id, fetchAnalytics]);

  // Charger l'historique par jour pour la courbe
  useEffect(() => {
    if (!profile?.household_id) return;
    async function loadHistory() {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - period);

      const { data } = await supabase
        .from('task_completions')
        .select('completed_by, completed_at')
        .eq('household_id', profile!.household_id!)
        .gte('completed_at', since.toISOString())
        .order('completed_at', { ascending: true });

      if (!data) return;

      // Grouper par membre par jour
      const history: Record<string, number[]> = {};
      const dayMap: Record<string, Record<string, number>> = {};

      for (const c of data) {
        const day = c.completed_at.split('T')[0];
        if (!dayMap[c.completed_by]) dayMap[c.completed_by] = {};
        dayMap[c.completed_by][day] = (dayMap[c.completed_by][day] ?? 0) + 1;
      }

      // Convertir en tableau pour les N derniers jours
      const days: string[] = [];
      for (let i = period - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
      }

      for (const memberId of Object.keys(dayMap)) {
        history[memberId] = days.map((day) => dayMap[memberId][day] ?? 0);
      }

      setDailyHistory(history);
    }
    loadHistory();
  }, [profile?.household_id, period]);

  const percentages = memberAnalytics.map((m) => m.taskPercentage);
  const maxPct = Math.max(...percentages, 0);
  const minPct = Math.min(...percentages, 0);
  const imbalance = maxPct - minPct;

  const badgeColor = imbalance <= 10 ? '#34c759' : imbalance <= 25 ? '#ff9500' : '#ff3b30';
  const badgeLabel = imbalance <= 10 ? 'Équilibré' : imbalance <= 25 ? 'Léger déséquilibre' : 'Déséquilibre';
  const totalCompletions = memberAnalytics.reduce((s, m) => s + m.taskCount, 0);

  // Tendance : comparer la 1ère moitié de la période vs la 2ème
  const trend = useMemo(() => {
    if (Object.keys(dailyHistory).length === 0 || !profile?.id) return null;
    const myHistory = dailyHistory[profile.id];
    if (!myHistory || myHistory.length < 4) return null;
    const mid = Math.floor(myHistory.length / 2);
    const firstHalf = myHistory.slice(0, mid).reduce((s, v) => s + v, 0);
    const secondHalf = myHistory.slice(mid).reduce((s, v) => s + v, 0);
    if (firstHalf === 0 && secondHalf === 0) return null;
    const diff = secondHalf - firstHalf;
    return { diff, label: diff > 0 ? 'En hausse' : diff < 0 ? 'En baisse' : 'Stable', color: diff > 0 ? '#ff9500' : diff < 0 ? '#34c759' : '#8e8e93' };
  }, [dailyHistory, profile?.id]);

  return (
    <div className="pt-4 space-y-5">
      <div className="flex items-center justify-between px-4">
        <h2 className="text-[28px] font-bold text-[#1c1c1e]">Statistiques</h2>
        {totalCompletions > 0 && (
          <span className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: badgeColor }}>
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Période */}
      <div className="mx-4 rounded-lg p-0.5 flex" style={{ background: '#e5e5ea' }}>
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`flex-1 rounded-md py-[6px] text-[13px] font-semibold transition-all ${
              period === p.value ? 'bg-white text-[#1c1c1e] shadow-sm' : 'text-[#8e8e93]'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : totalCompletions === 0 ? (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-2">📊</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Aucune donnée</p>
          <p className="text-[15px] text-[#8e8e93] mt-1">Complétez des tâches pour voir les statistiques</p>
        </div>
      ) : (
        <>
          {/* Score global + tendance */}
          <div className="mx-4 rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[13px] opacity-80">Tâches complétées — {period} jours</p>
                <p className="text-[40px] font-bold mt-1">{totalCompletions}</p>
              </div>
              {trend && (
                <div className="text-right">
                  <p className="text-[11px] opacity-80">Tendance</p>
                  <p className="text-[15px] font-bold">{trend.label}</p>
                  <p className="text-[12px] opacity-70">{trend.diff > 0 ? '+' : ''}{trend.diff} vs période précédente</p>
                </div>
              )}
            </div>
          </div>

          {/* Mini graphe tendance (barres par jour) */}
          {profile?.id && dailyHistory[profile.id] && dailyHistory[profile.id].length > 0 && (
            <div className="mx-4">
              <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Ma tendance</p>
              <div className="rounded-xl bg-white p-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                <div className="flex items-end gap-[2px] h-[60px]">
                  {dailyHistory[profile.id].map((count, i) => {
                    const maxCount = Math.max(...dailyHistory[profile.id], 1);
                    const h = Math.max(2, (count / maxCount) * 56);
                    return (
                      <div key={i} className="flex-1 rounded-t" style={{
                        height: `${h}px`,
                        background: count > 0 ? '#007aff' : '#e5e5ea',
                      }} />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-[#c7c7cc]">
                  <span>il y a {period}j</span>
                  <span>Aujourd&apos;hui</span>
                </div>
              </div>
            </div>
          )}

          {/* Répartition par membre */}
          <div className="mx-4">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Par membre</p>
            <div className="rounded-xl bg-white p-4 space-y-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {memberAnalytics.map((m, i) => {
                const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                // Tendance par membre
                const memberHist = dailyHistory[m.memberId];
                let memberTrend = '';
                if (memberHist && memberHist.length >= 4) {
                  const mid = Math.floor(memberHist.length / 2);
                  const first = memberHist.slice(0, mid).reduce((s, v) => s + v, 0);
                  const second = memberHist.slice(mid).reduce((s, v) => s + v, 0);
                  if (second > first) memberTrend = '↑';
                  else if (second < first) memberTrend = '↓';
                  else memberTrend = '→';
                }
                return (
                  <div key={m.memberId} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: color }}>
                          {m.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[15px] font-medium text-[#1c1c1e]">{m.displayName}</span>
                        {memberTrend && <span className="text-[13px]">{memberTrend}</span>}
                      </div>
                      <span className="text-[15px] font-bold" style={{ color }}>{m.taskPercentage}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full" style={{ background: '#f2f2f7' }}>
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${m.taskPercentage}%`, background: color }} />
                    </div>
                    <p className="text-[12px] text-[#8e8e93]">{m.taskCount} tâche{m.taskCount > 1 ? 's' : ''} complétée{m.taskCount > 1 ? 's' : ''}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Breakdown par catégorie */}
          {categoryBreakdown.length > 0 && (
            <div className="mx-4">
              <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Par catégorie</p>
              <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {categoryBreakdown.map((cat, i) => (
                  <div key={cat.categoryId}
                    className="flex items-center justify-between px-4 py-3"
                    style={i < categoryBreakdown.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full" style={{ background: cat.colorHex }} />
                      <span className="text-[15px] text-[#1c1c1e]">{cat.categoryName}</span>
                    </div>
                    <span className="text-[15px] font-semibold text-[#8e8e93]">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Charge mentale cumulée par membre */}
          {members.length > 1 && (
            <div className="mx-4 pb-8">
              <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Charge mentale cumulée</p>
              <div className="rounded-xl bg-white p-4 space-y-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {members.map((m, i) => {
                  const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                  const myTasks = tasks.filter((t) => t.assigned_to === m.id);
                  const totalLoad = myTasks.reduce((sum, t) => sum + taskLoad(t), 0);
                  const maxLoad = Math.max(...members.map((mb) => {
                    const ts = tasks.filter((t) => t.assigned_to === mb.id);
                    return ts.reduce((s, t) => s + taskLoad(t), 0);
                  }), 1);
                  const pct = Math.round((totalLoad / maxLoad) * 100);
                  return (
                    <div key={m.id} className="space-y-1">
                      <div className="flex justify-between text-[13px]">
                        <span className="font-medium text-[#1c1c1e]">{m.display_name}</span>
                        <span className="font-bold" style={{ color }}>{totalLoad} pts</span>
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
        </>
      )}
    </div>
  );
}
