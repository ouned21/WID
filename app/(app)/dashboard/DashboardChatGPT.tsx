'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { createClient } from '@/lib/supabase';
import { taskLoad, loadTo10, scoreColor10, taskScoreDisplay } from '@/utils/designSystem';

/**
 * Dashboard style "ChatGPT" — inspiré des maquettes React Native originales.
 * Dark mode, gradients profonds, avatars illustrés, badges 3D, barres XP.
 */
export default function DashboardChatGPT() {
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { household, members, allMembers } = useHouseholdStore();
  const { fetchAnalytics } = useAnalyticsStore();
  const [weekTrend, setWeekTrend] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    if (!profile?.household_id) return;
    fetchTasks(profile.household_id);
    fetchAnalytics(profile.household_id);

    async function load() {
      const supabase = createClient();
      const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
      const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

      const [tw, lw, recent] = await Promise.all([
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('id', { count: 'exact', head: true })
          .eq('household_id', profile!.household_id!).eq('completed_by', profile!.id)
          .gte('completed_at', twoWeeksAgo.toISOString()).lt('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('completed_at')
          .eq('completed_by', profile!.id).order('completed_at', { ascending: false }).limit(500),
      ]);

      setWeekTrend((tw.count ?? 0) - (lw.count ?? 0));

      // XP = 10 par complétion
      const totalXp = (recent.data?.length ?? 0) * 10;
      setXp(totalXp);

      if (recent.data) {
        const days = new Set(recent.data.map((c) => c.completed_at.split('T')[0]));
        let s = 0;
        for (let i = 0; i < 365; i++) {
          const d2 = new Date(); d2.setDate(d2.getDate() - i);
          if (days.has(d2.toISOString().split('T')[0])) s++;
          else if (i > 0) break;
        }
        setStreak(s);
      }
    }
    load();
  }, [profile?.household_id, profile?.id, fetchTasks, fetchAnalytics]);

  const d = useMemo(() => {
    const my = tasks.filter((t) => t.assigned_to === profile?.id);
    const myLoad = my.reduce((s, t) => s + taskLoad(t), 0);
    const total = tasks.reduce((s, t) => s + taskLoad(t), 0);
    const myPct = total > 0 ? Math.round((myLoad / total) * 100) : 0;

    const top3 = [...my].sort((a, b) => taskLoad(b) - taskLoad(a)).slice(0, 3);

    const byMember = allMembers.map((m) => {
      const mt = tasks.filter((t) => t.assigned_to === m.id || t.assigned_to_phantom_id === m.id);
      return {
        id: m.id, name: m.display_name, isMe: m.id === profile?.id, isPhantom: m.isPhantom,
        score: mt.reduce((s, t) => s + taskLoad(t), 0),
        count: mt.length,
      };
    }).sort((a, b) => b.score - a.score);

    const maxScore = Math.max(...byMember.map((m) => m.score), 1);

    return { myLoad, myPct, top3, byMember, maxScore };
  }, [tasks, profile?.id, allMembers]);

  // XP → Niveau
  const level = xp < 100 ? 1 : xp < 300 ? 2 : xp < 600 ? 3 : xp < 1000 ? 4 : xp < 2000 ? 5 : xp < 5000 ? 6 : 7;
  const levelNames = ['', 'Débutant', 'Régulier', 'Organisé', 'Gestionnaire', 'Expert', 'Maître', 'Légende'];
  const levelThresholds = [0, 0, 100, 300, 600, 1000, 2000, 5000];
  const nextThreshold = levelThresholds[Math.min(level + 1, 7)] ?? 5000;
  const prevThreshold = levelThresholds[level] ?? 0;
  const xpProgress = nextThreshold > prevThreshold ? ((xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100 : 100;

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ═══════ HERO — COMMAND CENTER DARK ═══════ */}
      <div className="mx-4 rounded-3xl p-6 relative overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0a1628 0%, #162544 40%, #1a3a5c 100%)',
        boxShadow: '0 8px 32px rgba(10,22,40,0.5)',
      }}>
        {/* Étoiles décoratives */}
        <div className="absolute inset-0 opacity-30" style={{
          backgroundImage: 'radial-gradient(1px 1px at 20% 30%, white, transparent), radial-gradient(1px 1px at 80% 10%, white, transparent), radial-gradient(1px 1px at 50% 70%, white, transparent), radial-gradient(1px 1px at 10% 80%, white, transparent), radial-gradient(1px 1px at 90% 60%, white, transparent)',
        }} />

        <p className="text-[13px] text-white/50 font-medium mb-1">Command Center</p>

        {/* Score principal */}
        <div className="flex items-end gap-3 mb-3">
          <span className="text-[72px] font-black text-white leading-none" style={{
            textShadow: '0 4px 20px rgba(0,122,255,0.4)',
          }}>
            {loadTo10(d.myLoad)}
          </span>
          <span className="text-[20px] text-white/40 font-medium mb-3">/10</span>
        </div>

        {/* Trend */}
        {weekTrend !== null && (
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[13px] font-semibold" style={{
              color: weekTrend > 0 ? '#34d399' : weekTrend < 0 ? '#f87171' : '#94a3b8'
            }}>
              {weekTrend > 0 ? `↑ +${weekTrend}` : weekTrend < 0 ? `↓ ${weekTrend}` : '→ Stable'} cette semaine
            </span>
          </div>
        )}

        {/* Message */}
        <p className="text-[17px] font-bold text-white mb-1">
          {greeting} {profile?.display_name?.split(' ')[0]} 💪
        </p>
        <p className="text-[13px] text-white/50">
          {d.myPct > 55 ? 'Tu portes beaucoup. Pense à rééquilibrer.' :
           d.myPct < 35 ? 'Bon équilibre. Continue.' :
           'Tu gères bien le foyer.'}
        </p>

        {/* Stats row */}
        <div className="flex gap-4 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div>
            <p className="text-[22px] font-bold text-white">{d.myPct}%</p>
            <p className="text-[10px] text-white/40 uppercase">Contribution</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-white">{streak}</p>
            <p className="text-[10px] text-white/40 uppercase">🔥 Série</p>
          </div>
          <div>
            <p className="text-[22px] font-bold text-white">{tasks.filter(t => t.assigned_to === profile?.id).length}</p>
            <p className="text-[10px] text-white/40 uppercase">Tâches</p>
          </div>
        </div>
      </div>

      {/* ═══════ XP BAR ═══════ */}
      <div className="mx-4 rounded-2xl bg-white p-4" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center h-8 w-8 rounded-full text-[14px] font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
              {level}
            </span>
            <div>
              <p className="text-[14px] font-bold text-[#1c1c1e]">{levelNames[level]}</p>
              <p className="text-[11px] text-[#8e8e93]">XP {xp} / {nextThreshold}</p>
            </div>
          </div>
          {streak > 0 && (
            <span className="rounded-full px-2.5 py-1 text-[11px] font-bold"
              style={{ background: streak >= 7 ? '#fef3c7' : '#f0f2f8', color: streak >= 7 ? '#d97706' : '#8e8e93' }}>
              🔥 {streak} jours
            </span>
          )}
        </div>
        {/* Barre XP gradient */}
        <div className="h-3 rounded-full overflow-hidden" style={{ background: '#f0f2f8' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(100, xpProgress)}%`,
              background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899)',
            }} />
        </div>
      </div>

      {/* ═══════ LEADERBOARD FAMILLE ═══════ */}
      <div className="mx-4">
        <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">Leaderboard Famille</p>
        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          {d.byMember.map((m, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`;
            const pct = d.maxScore > 0 ? Math.round((m.score / d.maxScore) * 100) : 0;
            return (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3"
                style={i < d.byMember.length - 1 ? { borderBottom: '0.5px solid rgba(0,0,0,0.06)' } : {}}>
                <span className="text-[18px] w-7 text-center">{medal}</span>
                {/* Avatar */}
                <div className="flex items-center justify-center h-10 w-10 rounded-full text-[15px] font-bold text-white flex-shrink-0"
                  style={{
                    background: m.isPhantom ? '#94a3b8' :
                      m.isMe ? 'linear-gradient(135deg, #3b82f6, #8b5cf6)' :
                      'linear-gradient(135deg, #f59e0b, #ef4444)',
                  }}>
                  {m.isPhantom ? '👻' : m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[15px] font-semibold text-[#1c1c1e] truncate">
                      {m.name} {m.isMe ? '(moi)' : ''}
                    </p>
                    <span className="flex items-center justify-center h-8 w-8 rounded-full text-[13px] font-bold text-white flex-shrink-0"
                      style={{
                        background: m.score > 200 ? '#ef4444' : m.score > 100 ? '#f59e0b' : '#3b82f6',
                      }}>
                      {m.score}
                    </span>
                  </div>
                  {/* Barre */}
                  <div className="h-1.5 rounded-full mt-1" style={{ background: '#f0f2f8' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${pct}%`,
                      background: m.isMe ? 'linear-gradient(90deg, #3b82f6, #8b5cf6)' : '#e5e7eb',
                    }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════ PRIORITÉS ═══════ */}
      {d.top3.length > 0 && (
        <div className="mx-4">
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">Priorités</p>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            {d.top3.map((t, i) => {
              const sc = taskScoreDisplay(t);
              const color = scoreColor10(sc);
              const sb = t.score_breakdown as Record<string, number> | null;
              const tags: string[] = [];
              if (sc >= 8) tags.push('🔥 Urgent');
              else if (sb && sb.mental_load_score >= 12) tags.push('🧠 Mental');
              else if (sb && sb.physical_score >= 4) tags.push('💪 Physique');

              return (
                <Link key={t.id} href={`/tasks/${t.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-all active:bg-[#f9f9fb]"
                  style={i < d.top3.length - 1 ? { borderBottom: '0.5px solid rgba(0,0,0,0.06)' } : {}}>
                  {/* Score badge */}
                  <span className="flex items-center justify-center h-10 w-10 rounded-2xl text-[17px] font-black text-white flex-shrink-0"
                    style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}>
                    {sc}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1c1c1e] truncate">{t.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {tags.map((tag) => (
                        <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                          style={{ background: '#fef3c7', color: '#92400e' }}>
                          {tag}
                        </span>
                      ))}
                      <span className="text-[11px] text-[#8e8e93]">{t.category?.name}</span>
                    </div>
                  </div>
                  <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════ RÉCAP DU SOIR (après 17h) ═══════ */}
      {new Date().getHours() >= 17 && (
        <Link href="/tasks/recap" className="mx-4 rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-transform active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', boxShadow: '0 4px 16px rgba(30,27,75,0.4)' }}>
          <div>
            <p className="text-[15px] font-bold">🌙 Comment s&apos;est passée ta journée ?</p>
            <p className="text-[12px] text-white/50 mt-0.5">Coche en rafale, en 15 secondes</p>
          </div>
          <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
        </Link>
      )}

      {/* ═══════ PLANNING ═══════ */}
      <Link href="/planning" className="mx-4 rounded-2xl p-4 flex items-center justify-between transition-transform active:scale-[0.98]" style={{
        background: 'linear-gradient(135deg, #0ea5e9, #6366f1)',
        boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
      }}>
        <div>
          <p className="text-[15px] font-bold text-white">📅 Planning</p>
          <p className="text-[12px] text-white/60">
            {streak > 0 ? `🔥 Série ${streak} jours · ` : ''}Vue semaine, rééquilibrage →
          </p>
        </div>
      </Link>

      {/* ═══════ ACTIONS ═══════ */}
      <div className="mx-4 flex gap-3">
        <Link href="/tasks/new"
          className="flex-1 rounded-2xl p-4 text-center text-[15px] font-bold text-white transition-transform active:scale-[0.97]"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
          }}>
          + Ajouter
        </Link>
        <Link href="/tasks/log"
          className="flex-1 rounded-2xl p-4 text-center text-[15px] font-bold transition-transform active:scale-[0.97]"
          style={{
            color: '#3b82f6',
            background: 'white',
            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          }}>
          J&apos;ai fait ✓
        </Link>
      </div>
    </div>
  );
}
