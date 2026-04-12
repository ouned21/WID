'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { createClient } from '@/lib/supabase';
import { loadColor, loadMessage, taskLoad } from '@/utils/designSystem';

export default function DashboardCommand() {
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { household, members } = useHouseholdStore();
  const { fetchAnalytics } = useAnalyticsStore();
  const [weekTrend, setWeekTrend] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchAnalytics(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchAnalytics]);

  // Tendance + streak
  useEffect(() => {
    if (!profile?.household_id || !profile?.id) return;
    async function load() {
      const supabase = createClient();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

      const [tw, lw, recent] = await Promise.all([
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', twoWeeksAgo.toISOString()).lt('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('completed_at')
          .eq('completed_by', profile!.id).order('completed_at', { ascending: false }).limit(200),
      ]);

      setWeekTrend((tw.count ?? 0) - (lw.count ?? 0));

      if (recent.data) {
        const days = new Set(recent.data.map((c) => c.completed_at.split('T')[0]));
        let s = 0;
        for (let i = 0; i < 365; i++) {
          const d = new Date(); d.setDate(d.getDate() - i);
          if (days.has(d.toISOString().split('T')[0])) s++;
          else if (i > 0) break;
        }
        setStreak(s);
      }
    }
    load();
  }, [profile?.household_id, profile?.id]);

  const d = useMemo(() => {
    const dMap: Record<string, number> = { very_short: 3, short: 10, medium: 22, long: 45, very_long: 75 };
    const my = tasks.filter((t) => t.assigned_to === profile?.id);
    const myLoad = my.reduce((s, t) => s + taskLoad(t), 0);
    const total = tasks.reduce((s, t) => s + taskLoad(t), 0);
    const myPct = total > 0 ? Math.round((myLoad / total) * 100) : 0;
    const target = profile?.target_share_percent ?? 50;
    const gap = myPct - target;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) < todayStart).length;
    const today = tasks.filter((t) => { if (!t.next_due_at) return false; const x = new Date(t.next_due_at); return x >= todayStart && x < new Date(todayStart.getTime() + 86400000); }).length;

    const top3 = [...my].sort((a, b) => taskLoad(b) - taskLoad(a)).slice(0, 3);

    const byMember = members.map((m) => {
      const mt = tasks.filter((t) => t.assigned_to === m.id);
      return {
        id: m.id, name: m.display_name, isMe: m.id === profile?.id,
        load: mt.reduce((s, t) => s + taskLoad(t), 0),
        time: mt.reduce((s, t) => s + (dMap[t.duration_estimate ?? 'medium'] ?? 15), 0),
        count: mt.length,
      };
    }).sort((a, b) => b.load - a.load);

    const maxLoad = Math.max(...byMember.map((m) => m.load), 1);
    const myTime = byMember.find((m) => m.isMe)?.time ?? 0;
    const avg = my.length > 0 ? Math.round(myLoad / my.length) : 0;

    return { myLoad, myPct, target, gap, overdue, today, top3, byMember, maxLoad, myTime, avg, myCount: my.length };
  }, [tasks, profile?.id, profile?.target_share_percent, members]);

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; })();
  const color = loadColor(d.avg);
  const msg = loadMessage(d.avg);
  const trendArrow = weekTrend === null ? '' : weekTrend > 0 ? '↑' : weekTrend < 0 ? '↓' : '→';
  const trendTxt = weekTrend === null ? '' : weekTrend > 0 ? `+${weekTrend} cette semaine` : weekTrend < 0 ? `${weekTrend} cette semaine` : 'Stable';
  const fmtTime = (m: number) => m >= 60 ? `${Math.floor(m / 60)}h${m % 60 > 0 ? String(m % 60).padStart(2, '0') : ''}` : `${m}min`;

  return (
    <div className="pt-4 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Greeting */}
      <div className="px-4 flex items-end justify-between">
        <div>
          <p className="text-[12px] text-[#8e8e93]">{greeting}</p>
          <h2 className="text-[28px] font-bold text-[#1c1c1e]">{profile?.display_name}</h2>
        </div>
        {streak > 0 && (
          <div className="flex items-center gap-1 rounded-full px-3 py-1" style={{ background: '#fff8e1' }}>
            <span className="text-[14px]">🔥</span>
            <span className="text-[13px] font-bold text-[#ff9500]">{streak}j</span>
          </div>
        )}
      </div>

      {/* ═══════ HERO CARD ═══════ */}
      <div className="mx-4 rounded-3xl p-6 relative overflow-hidden" style={{
        background: `linear-gradient(145deg, ${color}ee 0%, ${color}99 50%, ${color}66 100%)`,
        boxShadow: `0 8px 32px ${color}40`,
      }}>
        {/* Cercles decoratifs */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }} />
        <div className="absolute right-8 -bottom-16 w-32 h-32 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <div className="absolute -left-6 bottom-4 w-20 h-20 rounded-full" style={{ background: 'rgba(255,255,255,0.04)' }} />

        <div className="relative z-10">
          {/* Score */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] text-white/60 uppercase font-bold tracking-[0.2em]">My Load</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-[64px] font-black text-white leading-none" style={{ textShadow: '0 2px 12px rgba(0,0,0,0.2)' }}>{d.myLoad}</span>
                <span className="text-[16px] text-white/40 font-medium">pts</span>
              </div>
            </div>
            {weekTrend !== null && weekTrend !== 0 && (
              <div className="rounded-xl px-3 py-1.5 mt-2" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <p className="text-[14px] font-bold text-white">{trendArrow}</p>
                <p className="text-[9px] text-white/70">{trendTxt}</p>
              </div>
            )}
          </div>

          {/* Message */}
          <p className="text-[15px] text-white/90 font-semibold mt-3">{msg}</p>

          {/* Stats row */}
          <div className="flex gap-6 mt-3">
            <div>
              <p className="text-[20px] font-bold text-white">{d.myCount}</p>
              <p className="text-[10px] text-white/50">tâches</p>
            </div>
            <div>
              <p className="text-[20px] font-bold text-white">~{fmtTime(d.myTime)}</p>
              <p className="text-[10px] text-white/50">estimées</p>
            </div>
            <div>
              <p className="text-[20px] font-bold text-white">{d.myPct}%</p>
              <p className="text-[10px] text-white/50">du foyer</p>
            </div>
          </div>

          {/* Barre objectif */}
          <div className="mt-4">
            <div className="h-1.5 rounded-full bg-white/20">
              <div className="h-1.5 rounded-full bg-white transition-all duration-1000" style={{
                width: `${Math.min(100, Math.max(5, 100 - Math.abs(d.gap) * 2))}%`
              }} />
            </div>
            <div className="flex justify-between mt-1 text-[9px] text-white/40">
              <span>Objectif {d.target}%</span>
              <span>{Math.abs(d.gap) <= 5 ? '✓ Dans l\'objectif' : d.gap > 0 ? `+${d.gap}% au-dessus` : `${d.gap}%`}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════ ALERTES ═══════ */}
      {(d.overdue > 0 || d.today > 0) && (
        <div className="px-4 flex gap-2">
          {d.overdue > 0 && (
            <Link href="/tasks" className="flex-1 rounded-2xl px-4 py-3.5 flex items-center gap-3 transition-transform active:scale-[0.97]" style={{
              background: 'linear-gradient(135deg, #ff3b30, #ff6b6b)',
              boxShadow: '0 4px 12px rgba(255,59,48,0.3)',
            }}>
              <span className="text-[26px] font-black text-white">{d.overdue}</span>
              <div>
                <p className="text-[13px] font-semibold text-white">en retard</p>
                <p className="text-[10px] text-white/60">à traiter</p>
              </div>
            </Link>
          )}
          <Link href="/tasks" className="flex-1 rounded-2xl bg-white px-4 py-3.5 flex items-center gap-3 transition-transform active:scale-[0.97]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
            <span className="text-[26px] font-black" style={{ color: '#007aff' }}>{d.today}</span>
            <div>
              <p className="text-[13px] font-semibold text-[#1c1c1e]">aujourd&apos;hui</p>
              <p className="text-[10px] text-[#8e8e93]">prévues</p>
            </div>
          </Link>
        </div>
      )}

      {/* ═══════ ÉQUILIBRE FOYER ═══════ */}
      {d.byMember.length > 1 && (
        <div className="mx-4 rounded-2xl bg-white p-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-3">Équilibre du foyer</p>
          {d.byMember.map((m, i) => {
            const c = ['#007aff', '#af52de', '#ff9500', '#34c759'][i % 4];
            const pct = Math.round((m.load / d.maxLoad) * 100);
            return (
              <div key={m.id} className="mb-3 last:mb-0">
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="font-semibold" style={{ color: m.isMe ? c : '#1c1c1e' }}>
                    {m.name} {m.isMe && <span className="text-[10px] text-[#8e8e93]">(moi)</span>}
                  </span>
                  <span className="text-[#8e8e93]">{m.load} pts · {fmtTime(m.time)}</span>
                </div>
                <div className="h-2.5 rounded-full" style={{ background: '#f2f2f7' }}>
                  <div className="h-2.5 rounded-full transition-all duration-1000" style={{ width: `${pct}%`, background: c }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══════ PRIORITÉS ═══════ */}
      {d.top3.length > 0 && (
        <div className="mx-4">
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">Priorités</p>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
            {d.top3.map((t, i) => {
              const sc = taskLoad(t);
              const c = loadColor(sc);
              const sb = t.score_breakdown as Record<string, number> | null;
              const tags: string[] = [];
              if (sc >= 25) tags.push('🔥');
              if (sb && sb.mental_load_score >= 12) tags.push('🧠');
              if (sb && sb.physical_score >= 4) tags.push('💪');
              return (
                <Link key={t.id} href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3.5 transition-colors active:bg-[#f8f8f8]"
                  style={i < d.top3.length - 1 ? { borderBottom: '0.5px solid rgba(60,60,67,0.12)' } : {}}>
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: `${c}18` }}>
                    <span className="text-[18px] font-black" style={{ color: c }}>{sc}</span>
                  </div>
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

      {/* ═══════ TEASER BOOST ═══════ */}
      <Link href="/boost" className="mx-4 rounded-2xl p-4 flex items-center justify-between transition-transform active:scale-[0.98]" style={{
        background: 'linear-gradient(135deg, #ff9500, #ff3b30)',
        boxShadow: '0 4px 16px rgba(255,149,0,0.3)',
      }}>
        <div>
          <p className="text-[15px] font-bold text-white">Progression</p>
          <p className="text-[12px] text-white/70">
            {streak > 0 ? `🔥 Série ${streak} jours · ` : ''}Niveaux, badges, challenges →
          </p>
        </div>
        <span className="text-[28px]">⚡</span>
      </Link>

      {/* ═══════ ACTIONS ═══════ */}
      <div className="px-4 flex gap-2">
        <Link href="/tasks/new"
          className="flex-1 rounded-2xl p-3.5 text-center text-[14px] font-bold text-white transition-transform active:scale-[0.97]"
          style={{ background: '#007aff', boxShadow: '0 4px 12px rgba(0,122,255,0.3)' }}>
          + Ajouter
        </Link>
        <Link href="/tasks/log"
          className="flex-1 rounded-2xl p-3.5 text-center text-[14px] font-bold transition-transform active:scale-[0.97]"
          style={{ color: '#007aff', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          J&apos;ai fait ✓
        </Link>
      </div>
    </div>
  );
}
