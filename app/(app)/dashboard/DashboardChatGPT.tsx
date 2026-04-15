'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { taskLoad, loadTo10 } from '@/utils/designSystem';
import { LABELS, getScoreGradient } from '@/utils/labels';

/**
 * Dashboard style "Galaxy" — dark mode full screen, inspiré maquettes ChatGPT.
 * Tout en sombre (pas juste une carte), chiffre énorme, fond cosmique.
 */
export default function DashboardChatGPT() {
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
    <div style={{
      marginLeft: '-16px',
      marginRight: '-16px',
      marginTop: '-24px',
      marginBottom: '-112px',
      paddingLeft: '16px',
      paddingRight: '16px',
      paddingTop: '24px',
      paddingBottom: '112px',
      minHeight: 'calc(100vh + 136px)',
      background: 'linear-gradient(180deg, #0a1628 0%, #0f1e3a 50%, #162544 100%)',
    }}>
      {/* Étoiles décoratives en fond */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(1px 1px at 15% 20%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 85% 15%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 50% 60%, rgba(255,255,255,0.4), transparent), radial-gradient(1.5px 1.5px at 25% 75%, rgba(255,255,255,0.3), transparent), radial-gradient(1px 1px at 75% 85%, rgba(255,255,255,0.4), transparent), radial-gradient(1px 1px at 10% 50%, rgba(255,255,255,0.2), transparent), radial-gradient(1.5px 1.5px at 90% 45%, rgba(255,255,255,0.3), transparent)',
        backgroundSize: '100% 100%',
        opacity: 0.6,
      }} />

      <div className="relative z-10" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* ═══════ HERO — MON SCORE ═══════ */}
        <div className="rounded-[28px] p-7 relative overflow-hidden" style={{
          background: gradient.bg,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          marginTop: '20px',
        }}>
          <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="absolute -left-10 -bottom-20 w-44 h-44 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

          <div className="relative z-10">
            <p className="text-[12px] font-bold uppercase tracking-[0.25em]" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {LABELS.dashboard.myScore}
            </p>

            <div className="flex items-baseline gap-3 mt-3 mb-4">
              <span className="text-[130px] font-black leading-none text-white" style={{
                textShadow: '0 8px 40px rgba(0,0,0,0.3), 0 0 60px rgba(255,255,255,0.1)',
                letterSpacing: '-0.05em',
              }}>
                {score10}
              </span>
              <span className="text-[32px] font-bold text-white/50">{LABELS.dashboard.scoreSuffix}</span>
            </div>

            {evolutionText && (
              <p className="text-[17px] font-semibold text-white">
                {weekTrend !== null && weekTrend > 0 && '↑ '}
                {weekTrend !== null && weekTrend < 0 && '↓ '}
                {evolutionText}
              </p>
            )}
            <p className="text-[14px] mt-1 text-white/80">
              🎯 {LABELS.dashboard.targetLabel(d.target, d.myPct)}
            </p>
            <p className="text-[14px] mt-3 leading-snug text-white/90">
              {interpretation}
            </p>
          </div>
        </div>

        {/* ═══════ ÉQUILIBRE DU FOYER ═══════ */}
        {d.byMember.length > 1 && (
          <div className="rounded-[24px] p-5 backdrop-blur-xl" style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <p className="text-[11px] font-bold text-white/50 uppercase tracking-[0.2em] mb-4">
              {LABELS.dashboard.householdBalance}
            </p>
            {d.byMember.map((m, i) => {
              const c = ['#60a5fa', '#a78bfa', '#fbbf24', '#34d399'][i % 4];
              const pct = Math.round((m.load / d.maxLoad) * 100);
              return (
                <div key={m.id} className="mb-3 last:mb-0">
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="font-semibold text-white">
                      {m.isPhantom && '👻 '}{m.name} {m.isMe && <span className="text-[11px] text-white/50">(moi)</span>}
                    </span>
                    <span className="text-white/60">{m.load} pts</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-2 rounded-full transition-all duration-1000" style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${c}, ${c}cc)`,
                      boxShadow: `0 0 12px ${c}80`,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ═══════ RÉCAP DU SOIR ═══════ */}
        {new Date().getHours() >= 17 && (
          <Link href="/tasks/recap" className="rounded-[24px] px-6 py-5 flex items-center justify-between text-white"
            style={{
              background: 'linear-gradient(135deg, rgba(49,46,129,0.8), rgba(30,27,75,0.8))',
              border: '1px solid rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
            <div>
              <p className="text-[16px] font-bold">{LABELS.dashboard.eveningRecap}</p>
              <p className="text-[12px] text-white/60 mt-0.5">{LABELS.dashboard.eveningRecapSub}</p>
            </div>
            <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
          </Link>
        )}
      </div>
    </div>
  );
}
