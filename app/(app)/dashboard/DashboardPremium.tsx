'use client';

import { taskLoad, loadTo10, scoreColor10, taskScoreDisplay } from '@/utils/designSystem';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';
import { createClient } from '@/lib/supabase';

export default function DashboardPremium() {
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { household, members } = useHouseholdStore();
  const { fetchAnalytics } = useAnalyticsStore();
  const [weekTrend, setWeekTrend] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (profile?.household_id) { fetchTasks(profile.household_id); fetchAnalytics(profile.household_id); }
  }, [profile?.household_id, fetchTasks, fetchAnalytics]);

  useEffect(() => {
    if (!profile?.household_id || !profile?.id) return;
    async function load() {
      const supabase = createClient();
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
      const [tw, lw, recent] = await Promise.all([
        supabase.from('task_completions').select('id', { count: 'exact', head: true }).eq('household_id', profile!.household_id!).eq('completed_by', profile!.id).gte('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('id', { count: 'exact', head: true }).eq('household_id', profile!.household_id!).eq('completed_by', profile!.id).gte('completed_at', twoWeeksAgo.toISOString()).lt('completed_at', weekAgo.toISOString()),
        supabase.from('task_completions').select('completed_at').eq('completed_by', profile!.id).order('completed_at', { ascending: false }).limit(200),
      ]);
      setWeekTrend((tw.count ?? 0) - (lw.count ?? 0));
      if (recent.data) {
        const days = new Set(recent.data.map((c) => c.completed_at.split('T')[0]));
        let s = 0;
        for (let i = 0; i < 365; i++) { const d = new Date(); d.setDate(d.getDate() - i); if (days.has(d.toISOString().split('T')[0])) s++; else if (i > 0) break; }
        setStreak(s);
      }
    }
    load();
  }, [profile?.household_id, profile?.id]);

  const d = useMemo(() => {
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
      const mt = tasks.filter((t) => t.assigned_to === m.id || t.assigned_to_phantom_id === m.id);
      return { id: m.id, name: m.display_name, load: mt.reduce((s, t) => s + taskLoad(t), 0), isMe: m.id === profile?.id };
    }).sort((a, b) => b.load - a.load);
    const maxLoad = Math.max(...byMember.map((m) => m.load), 1);
    const avg = my.length > 0 ? Math.round(myLoad / my.length) : 0;
    const msg = myLoad === 0 ? 'Aucune charge active.' :
      avg <= 10 ? 'Charge légère. Tu gères.' :
      avg <= 20 ? 'Charge modérée. Sous contrôle.' :
      avg <= 28 ? 'Charge élevée. Trois tâches concentrent l\'essentiel.' :
      'Surcharge détectée. Rééquilibrage conseillé.';
    return { myLoad, myPct, target, gap, overdue, today, top3, byMember, maxLoad, msg };
  }, [tasks, profile?.id, profile?.target_share_percent, members]);

  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir'; })();

  return (
    <main className="min-h-screen px-4 pb-28 pt-4 text-slate-900" style={{ background: 'radial-gradient(circle at top, #f8fbff, white 42%, #eef4ff)' }}>
      <div className="mx-auto flex max-w-md flex-col gap-5">

        {/* HERO — Command Center dark */}
        <section className="overflow-hidden rounded-[30px] p-6 text-white" style={{
          background: 'linear-gradient(135deg, #0f172a, #1e1b4b)',
          boxShadow: '0 20px 60px rgba(15,23,42,0.35)',
        }}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-300">Command Center</p>
              <h1 className="mt-2 text-[42px] font-semibold tracking-tight">{loadTo10(d.myLoad)}<span className="text-[18px] text-slate-400">/10</span></h1>
              {weekTrend !== null && weekTrend !== 0 && (
                <div className="mt-3 inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1" style={{
                  background: weekTrend > 0 ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  color: weekTrend > 0 ? '#86efac' : '#fca5a5',
                  borderColor: weekTrend > 0 ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                }}>
                  {weekTrend > 0 ? '+' : ''}{weekTrend} cette semaine
                </div>
              )}
              <p className="mt-4 max-w-[18rem] text-sm leading-6 text-slate-300">{d.msg}</p>
            </div>
            <div className="rounded-2xl px-3 py-2 text-right backdrop-blur" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="text-xs uppercase tracking-wide text-slate-300">Focus</div>
              <div className="mt-1 text-lg font-semibold">{d.myPct}%</div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4 backdrop-blur" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="text-xs uppercase tracking-wide text-slate-400">En retard</div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: d.overdue > 0 ? '#fda4af' : '#e2e8f0' }}>{d.overdue}</div>
            </div>
            <div className="rounded-2xl p-4 backdrop-blur" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="text-xs uppercase tracking-wide text-slate-400">Aujourd&apos;hui</div>
              <div className="mt-2 text-2xl font-semibold">{d.today}</div>
            </div>
          </div>
        </section>

        {/* OBJECTIF VS RÉALITÉ */}
        <section className="rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(226,232,240,0.7)', boxShadow: '0 10px 35px rgba(15,23,42,0.08)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Objectif vs réalité</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">
                {Math.abs(d.gap) <= 5 ? 'Vous êtes dans l\'objectif' : d.gap > 0 ? 'Au-dessus de l\'objectif' : 'En dessous de l\'objectif'}
              </h2>
            </div>
            <div className="rounded-full px-3 py-1 text-sm font-medium" style={{
              background: Math.abs(d.gap) <= 5 ? '#ecfdf5' : '#fef3c7',
              color: Math.abs(d.gap) <= 5 ? '#047857' : '#d97706',
            }}>
              {Math.abs(d.gap) <= 5 ? 'Stable' : `${d.gap > 0 ? '+' : ''}${d.gap}%`}
            </div>
          </div>
          <div className="mt-5 grid grid-cols-3 items-center gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <div className="text-xs text-slate-500">Objectif</div>
              <div className="mt-1 text-2xl font-semibold">{d.target}%</div>
            </div>
            <div className="text-center text-2xl text-slate-300">→</div>
            <div className="rounded-2xl p-4 text-center" style={{ background: '#eff6ff' }}>
              <div className="text-xs text-slate-500">Réalité</div>
              <div className="mt-1 text-2xl font-semibold" style={{ color: '#1d4ed8' }}>{d.myPct}%</div>
            </div>
          </div>
        </section>

        {/* PLANNING */}
        <Link href="/planning" className="block rounded-[26px] p-5 ring-1" style={{
          background: 'linear-gradient(to right, #eef4ff, #f0f0ff, #f5f0ff)',
          boxShadow: '0 10px 30px rgba(0,122,255,0.08)',
          borderColor: 'rgba(0,122,255,0.15)',
        }}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: '#007aff' }}>Planning</p>
              <h3 className="mt-1 text-lg font-semibold text-slate-900">
                {streak > 0 ? `Série ${streak} jours · ` : ''}Vue semaine & rééquilibrage
              </h3>
              <p className="mt-1 text-sm text-slate-600">Visualise ta semaine et optimise la répartition.</p>
            </div>
            <div className="rounded-full bg-white px-3 py-2 text-sm font-medium shadow-sm" style={{ color: '#007aff' }}>Voir</div>
          </div>
        </Link>

        {/* PRIORITÉS */}
        {d.top3.length > 0 && (
          <section className="rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(226,232,240,0.7)', boxShadow: '0 10px 35px rgba(15,23,42,0.08)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Mes tâches les plus lourdes</p>
                <h3 className="mt-1 text-lg font-semibold">Priorités</h3>
              </div>
              <Link href="/tasks" className="text-sm font-medium" style={{ color: '#2563eb' }}>Voir tout</Link>
            </div>
            <div className="mt-4 space-y-3">
              {d.top3.map((t) => {
                const sc = taskScoreDisplay(t);
                const scCompare = taskLoad(t);
                const sb = t.score_breakdown as Record<string, number> | null;
                const badge = scCompare >= 25 ? 'Urgent' : (sb && sb.mental_load_score >= 12) ? 'Mental' : (sb && sb.physical_score >= 4) ? 'Physique' : 'Standard';
                return (
                  <Link key={t.id} href={`/tasks/${t.id}`}
                    className="flex items-center justify-between rounded-2xl border px-4 py-4"
                    style={{ borderColor: 'rgba(241,245,249,1)', background: 'rgba(248,250,252,0.8)' }}>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">{t.name}</div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span>{t.category?.name}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300" />
                        <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 ring-1 ring-slate-200">{badge}</span>
                      </div>
                    </div>
                    <div className="ml-4 rounded-2xl bg-white px-3 py-2 text-right shadow-sm ring-1 ring-slate-200">
                      <div className="text-[11px] uppercase tracking-wide text-slate-400">Load</div>
                      <div className="text-lg font-semibold" style={{ color: scoreColor10(sc) }}>{sc}<span className="text-xs text-slate-400">/10</span></div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* ÉQUILIBRE FOYER */}
        {d.byMember.length > 1 && (
          <section className="rounded-[26px] border bg-white p-5" style={{ borderColor: 'rgba(226,232,240,0.7)', boxShadow: '0 10px 35px rgba(15,23,42,0.08)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Équilibre foyer</p>
                <h3 className="mt-1 text-lg font-semibold">Répartition actuelle</h3>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              {d.byMember.map((m, i) => {
                const gradients = ['from-blue-500 to-cyan-400', 'from-fuchsia-500 to-pink-400', 'from-amber-400 to-orange-400', 'from-emerald-400 to-green-400'];
                const grad = gradients[i % gradients.length];
                const pct = Math.round((m.load / d.maxLoad) * 100);
                return (
                  <div key={m.id}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{m.name} {m.isMe && <span className="text-slate-400">(moi)</span>}</span>
                      <span className="text-slate-500">{m.load} pts</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full bg-gradient-to-r ${grad} transition-all duration-1000`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ACTIONS */}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/tasks/new" className="rounded-[22px] px-4 py-4 text-center text-sm font-semibold text-white" style={{
            background: '#0f172a',
            boxShadow: '0 12px 30px rgba(15,23,42,0.22)',
          }}>
            + Nouvelle tâche
          </Link>
          <Link href="/tasks/log" className="rounded-[22px] bg-white px-4 py-4 text-center text-sm font-semibold text-slate-900 ring-1 ring-slate-200 shadow-sm">
            J&apos;ai fait une tâche
          </Link>
        </div>
      </div>
    </main>
  );
}
