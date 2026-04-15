'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { taskLoad, loadTo10 } from '@/utils/designSystem';
import { LABELS, getScoreGradient } from '@/utils/labels';

export default function DashboardClassic() {
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers } = useHouseholdStore();
  const { fetchAnalytics } = useAnalyticsStore();
  const [weekTrend, setWeekTrend] = useState<number | null>(null);

  useEffect(() => {
    if (!profile?.household_id) return;
    fetchTasks(profile.household_id);
    fetchAnalytics(profile.household_id);

    async function load() {
      const { createClient } = await import('@/lib/supabase');
      const supabase = createClient();
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const [tw, lw] = await Promise.all([
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', twoWeeksAgo.toISOString()).lt('completed_at', weekAgo.toISOString()),
      ]);
      setWeekTrend((tw.count ?? 0) - (lw.count ?? 0));
    }
    load();
  }, [profile?.household_id, profile?.id, fetchTasks, fetchAnalytics]);

  const d = useMemo(() => {
    const my = tasks.filter((t) => t.assigned_to === profile?.id);
    const myLoad = my.reduce((s, t) => s + taskLoad(t), 0);
    const total = tasks.reduce((s, t) => s + taskLoad(t), 0);
    const myPct = total > 0 ? Math.round((myLoad / total) * 100) : 0;
    const target = profile?.target_share_percent ?? 50;

    const byMember = allMembers.map((m) => {
      const mt = tasks.filter((t) => t.assigned_to === m.id || t.assigned_to_phantom_id === m.id);
      return {
        id: m.id, name: m.display_name, isMe: m.id === profile?.id, isPhantom: m.isPhantom,
        load: mt.reduce((s, t) => s + taskLoad(t), 0),
      };
    }).sort((a, b) => b.load - a.load);

    const maxLoad = Math.max(...byMember.map((m) => m.load), 1);
    return { myLoad, myPct, target, byMember, maxLoad };
  }, [tasks, profile?.id, profile?.target_share_percent, allMembers]);

  const score10 = loadTo10(d.myLoad);
  const gradient = getScoreGradient(score10);

  const evolutionText =
    weekTrend === null ? null :
    weekTrend > 0 ? LABELS.dashboard.weekTrendUp(weekTrend) :
    weekTrend < 0 ? LABELS.dashboard.weekTrendDown(weekTrend) :
    LABELS.dashboard.weekTrendStable;

  const interpretation = LABELS.dashboard.interpretation(score10, d.myPct, d.target);

  return (
    <div className="pt-4 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ═══════ HERO — MON SCORE (épuré) ═══════ */}
      <div className="mx-4 rounded-2xl p-6" style={{
        background: gradient.bg,
      }}>
        <p className="text-[12px] font-semibold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {LABELS.dashboard.myScore}
        </p>
        <div className="flex items-baseline gap-2 mt-2 mb-3">
          <span className="text-[80px] font-black leading-none text-white">{score10}</span>
          <span className="text-[22px] font-semibold text-white/60">{LABELS.dashboard.scoreSuffix}</span>
        </div>
        {evolutionText && (
          <p className="text-[15px] font-semibold text-white">
            {weekTrend !== null && weekTrend > 0 && '↑ '}
            {weekTrend !== null && weekTrend < 0 && '↓ '}
            {evolutionText}
          </p>
        )}
        <p className="text-[13px] mt-1 text-white/80">
          🎯 {LABELS.dashboard.targetLabel(d.target, d.myPct)}
        </p>
        <p className="text-[13px] mt-2 leading-snug text-white/90">
          {interpretation}
        </p>
      </div>

      {/* ═══════ ÉQUILIBRE DU FOYER ═══════ */}
      {d.byMember.length > 1 && (
        <div className="mx-4 rounded-2xl bg-white p-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wider mb-3">
            {LABELS.dashboard.householdBalance}
          </p>
          {d.byMember.map((m, i) => {
            const c = ['#007aff', '#af52de', '#ff9500', '#34c759'][i % 4];
            const pct = Math.round((m.load / d.maxLoad) * 100);
            return (
              <div key={m.id} className="mb-2.5 last:mb-0">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="font-medium" style={{ color: m.isMe ? c : '#1c1c1e' }}>
                    {m.isPhantom && '👻 '}{m.name} {m.isMe && <span className="text-[10px] text-[#8e8e93]">(moi)</span>}
                  </span>
                  <span className="text-[#8e8e93]">{m.load}</span>
                </div>
                <div className="h-2 rounded-full" style={{ background: '#f0f2f8' }}>
                  <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ RÉCAP DU SOIR ═══════ */}
      {new Date().getHours() >= 17 && (
        <Link href="/tasks/recap" className="mx-4 rounded-2xl p-4 flex items-center justify-between text-white"
          style={{ background: 'linear-gradient(135deg, #1c1c3e, #3a1c71)' }}>
          <div>
            <p className="text-[14px] font-bold">{LABELS.dashboard.eveningRecap}</p>
            <p className="text-[11px] text-white/70">{LABELS.dashboard.eveningRecapSub}</p>
          </div>
          <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
        </Link>
      )}
    </div>
  );
}
