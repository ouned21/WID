'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { taskLoad, loadTo10 } from '@/utils/designSystem';
import { LABELS, getScoreGradient } from '@/utils/labels';

export default function DashboardCommand() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers } = useHouseholdStore();
  const { fetchAnalytics } = useAnalyticsStore();
  const [weekTrend, setWeekTrend] = useState<number | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<{ emoji: string; title: string; body: string }[]>([]);
  const [loadingAi, setLoadingAi] = useState(false);

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
        count: mt.length,
      };
    }).sort((a, b) => b.load - a.load);

    const maxLoad = Math.max(...byMember.map((m) => m.load), 1);

    return { myLoad, myPct, target, byMember, maxLoad };
  }, [tasks, profile?.id, profile?.target_share_percent, allMembers]);

  const score10 = loadTo10(d.myLoad);
  const gradient = getScoreGradient(score10);

  // Phrase d'évolution
  const evolutionText =
    weekTrend === null ? null :
    weekTrend > 0 ? LABELS.dashboard.weekTrendUp(weekTrend) :
    weekTrend < 0 ? LABELS.dashboard.weekTrendDown(weekTrend) :
    LABELS.dashboard.weekTrendStable;

  const interpretation = LABELS.dashboard.interpretation(score10, d.myPct, d.target);

  return (
    <div className="pt-4 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ═══════ HERO — MON SCORE ═══════ */}
      <div className="mx-4 rounded-3xl p-6 relative overflow-hidden" style={{
        background: gradient.bg,
        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
      }}>
        {/* Cercles décoratifs */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="absolute -left-8 -bottom-12 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="relative z-10">
          <p className="text-[13px] font-bold uppercase tracking-[0.2em]" style={{ color: 'rgba(255,255,255,0.75)' }}>
            {LABELS.dashboard.myScore}
          </p>

          {/* Grand score */}
          <div className="flex items-baseline gap-3 mt-2 mb-4">
            <span className="text-[96px] font-black leading-none" style={{
              color: gradient.text,
              textShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
              {score10}
            </span>
            <span className="text-[24px] font-bold" style={{ color: 'rgba(255,255,255,0.6)' }}>
              {LABELS.dashboard.scoreSuffix}
            </span>
          </div>

          {/* Évolution */}
          {evolutionText && (
            <p className="text-[16px] font-semibold" style={{ color: gradient.text }}>
              {weekTrend !== null && weekTrend > 0 && '↑ '}
              {weekTrend !== null && weekTrend < 0 && '↓ '}
              {evolutionText}
            </p>
          )}

          {/* Objectif */}
          <p className="text-[14px] mt-1" style={{ color: 'rgba(255,255,255,0.8)' }}>
            🎯 {LABELS.dashboard.targetLabel(d.target, d.myPct)}
          </p>

          {/* Phrase descriptive */}
          <p className="text-[14px] mt-3 leading-snug" style={{ color: 'rgba(255,255,255,0.9)' }}>
            {interpretation}
          </p>
        </div>
      </div>

      {/* ═══════ ÉQUILIBRE DU FOYER ═══════ */}
      {d.byMember.length > 1 && (
        <div className="mx-4 rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-3">
            {LABELS.dashboard.householdBalance}
          </p>
          {d.byMember.map((m, i) => {
            const c = ['#007aff', '#af52de', '#ff9500', '#34c759'][i % 4];
            const pct = Math.round((m.load / d.maxLoad) * 100);
            return (
              <div key={m.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-[13px] mb-1">
                  <span className="font-semibold" style={{ color: m.isMe ? c : '#1c1c1e' }}>
                    {m.isPhantom && '👻 '}{m.name} {m.isMe && <span className="text-[11px] text-[#8e8e93]">(moi)</span>}
                  </span>
                  <span className="text-[#8e8e93]">{m.load} pts</span>
                </div>
                <div className="h-2.5 rounded-full" style={{ background: '#f0f2f8' }}>
                  <div className="h-2.5 rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ JOURNAL AURA ═══════ */}
      <button
        onClick={() => router.push('/journal')}
        className="mx-4 rounded-3xl p-5 text-left transition-transform active:scale-[0.98]"
        style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          boxShadow: '0 8px 24px rgba(118, 75, 162, 0.25)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full text-[28px] flex-shrink-0" style={{ background: 'rgba(255,255,255,0.25)' }}>
            🤖
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-white/70 mb-0.5">Parler à Yova</p>
            <p className="text-[17px] font-bold text-white leading-tight">Raconte-moi ta journée</p>
            <p className="text-[12px] text-white/80 mt-0.5">J&apos;enregistre tout ce que tu as fait en une phrase</p>
          </div>
          <div className="text-[20px] text-white/60">→</div>
        </div>
      </button>

      {/* ═══════ IA INSIGHTS ═══════ */}
      {!aiSummary && !loadingAi && profile?.household_id && (
        <div className="mx-4">
          <button onClick={async () => {
            setLoadingAi(true);
            try {
              const [sumRes, insRes] = await Promise.all([
                fetch('/api/ai/weekly-summary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: profile.household_id }) }),
                fetch('/api/ai/insights', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ householdId: profile.household_id }) }),
              ]);
              const sumData = await sumRes.json();
              const insData = await insRes.json();
              if (sumData.summary) setAiSummary(sumData.summary);
              if (insData.insights) setAiInsights(insData.insights);
            } catch { /* silencieux */ }
            setLoadingAi(false);
          }}
            className="w-full rounded-2xl p-4 text-left transition-transform active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #f0f0ff, #e8f4ff)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="flex items-center gap-3">
              <span className="text-[24px]">🤖</span>
              <div>
                <p className="text-[15px] font-bold text-[#1c1c1e]">{LABELS.dashboard.aiInsights}</p>
                <p className="text-[12px] text-[#8e8e93]">{LABELS.dashboard.aiInsightsSubtitle}</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {loadingAi && (
        <div className="mx-4 rounded-2xl bg-white p-4 flex items-center justify-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#007aff] border-t-transparent mr-3" />
          <span className="text-[14px] text-[#8e8e93]">Analyse en cours...</span>
        </div>
      )}

      {aiSummary && (
        <div className="mx-4 rounded-2xl bg-white p-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[16px]">🤖</span>
            <p className="text-[13px] font-bold text-[#8e8e93] uppercase tracking-wide">{LABELS.dashboard.aiInsights}</p>
          </div>
          <p className="text-[14px] text-[#1c1c1e] leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {aiInsights.length > 0 && (
        <div className="mx-4 rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="px-4 pt-3 text-[13px] font-bold text-[#8e8e93] uppercase tracking-wide">{LABELS.dashboard.aiInsightsTitle}</p>
          {aiInsights.map((ins, i) => (
            <div key={i} className="px-4 py-3" style={i < aiInsights.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
              <p className="text-[14px] font-semibold text-[#1c1c1e]">{ins.emoji} {ins.title}</p>
              <p className="text-[13px] text-[#8e8e93] mt-0.5">{ins.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* ═══════ RÉCAP DU SOIR (après 17h) ═══════ */}
      {new Date().getHours() >= 17 && (
        <Link href="/tasks/recap" className="mx-4 rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-transform active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #1c1c3e, #3a1c71)', boxShadow: '0 2px 8px rgba(28,28,62,0.3)' }}>
          <div>
            <p className="text-[15px] font-bold">{LABELS.dashboard.eveningRecap}</p>
            <p className="text-[12px] text-white/70 mt-0.5">{LABELS.dashboard.eveningRecapSub}</p>
          </div>
          <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
        </Link>
      )}
    </div>
  );
}
