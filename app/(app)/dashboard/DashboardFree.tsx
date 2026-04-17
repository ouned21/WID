'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { taskLoad, loadTo10 } from '@/utils/designSystem';

/**
 * Dashboard pour les utilisateurs GRATUITS.
 *
 * - Météo du foyer (état émotionnel visuel, pas de niveau)
 * - Feed de vie (actions Yova + rappels + aujourd'hui)
 * - Score VISIBLE mais PAYWALLÉ (clic → /upgrade?feature=score)
 *
 * Pas de : barres de comparaison, insights, stats détaillées, évolution chiffrée
 */

type WeatherState = {
  icon: string;
  label: string;
  sub: string;
  color: string;
};

function getWeather(overdue: number, total: number): WeatherState {
  if (total === 0) return { icon: '☀️', label: 'Ciel dégagé', sub: 'Ton foyer est serein', color: '#34c759' };
  const ratio = overdue / total;
  if (ratio === 0) return { icon: '☀️', label: 'Ciel dégagé', sub: 'Ton foyer est serein', color: '#34c759' };
  if (ratio < 0.15) return { icon: '🌤', label: 'Quelques nuages', sub: 'Presque tout est à jour', color: '#5ac8fa' };
  if (ratio < 0.35) return { icon: '☁️', label: 'Nuageux', sub: 'Quelques tâches attendent', color: '#ff9500' };
  if (ratio < 0.6) return { icon: '🌧', label: 'Pluvieux', sub: 'Du retard s\'accumule', color: '#ff6b00' };
  return { icon: '⛈', label: 'Orageux', sub: 'Ton foyer a besoin de toi', color: '#ff3b30' };
}

export default function DashboardFree() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers } = useHouseholdStore();
  const [loadingAi, setLoadingAi] = useState(false);

  useEffect(() => {
    if (profile?.household_id) fetchTasks(profile.household_id);
  }, [profile?.household_id, fetchTasks]);

  const d = useMemo(() => {
    const my = tasks.filter((t) => t.assigned_to === profile?.id);
    const myLoad = my.reduce((s, t) => s + taskLoad(t), 0);

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) < todayStart);
    const today = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const x = new Date(t.next_due_at);
      return x >= todayStart && x < tomorrowStart;
    });
    const tomorrow = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const x = new Date(t.next_due_at);
      return x >= tomorrowStart && x < new Date(tomorrowStart.getTime() + 86400000);
    });
    const thisWeek = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const x = new Date(t.next_due_at);
      return x >= tomorrowStart && x < weekEnd;
    });

    return {
      myLoad,
      overdue,
      today,
      tomorrow,
      thisWeek,
      totalActive: tasks.length,
    };
  }, [tasks, profile?.id]);

  const score10 = loadTo10(d.myLoad);
  const weather = getWeather(d.overdue.length, d.totalActive);
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  // Feed : les actions d'Yova
  const feedItems = useMemo(() => {
    const items: { emoji: string; title: string; body: string; href?: string }[] = [];

    if (d.overdue.length > 0) {
      items.push({
        emoji: '⚠️',
        title: `${d.overdue.length} tâche${d.overdue.length > 1 ? 's' : ''} en retard`,
        body: d.overdue.length === 1 ? d.overdue[0].name : `${d.overdue[0].name} + ${d.overdue.length - 1} autre${d.overdue.length > 2 ? 's' : ''}`,
        href: '/tasks',
      });
    }

    if (d.today.length > 0) {
      items.push({
        emoji: '📅',
        title: `Aujourd'hui : ${d.today.length} tâche${d.today.length > 1 ? 's' : ''}`,
        body: d.today.length === 1 ? d.today[0].name : `${d.today[0].name} + ${d.today.length - 1} autre${d.today.length > 2 ? 's' : ''}`,
        href: '/tasks',
      });
    }

    if (d.tomorrow.length > 0) {
      items.push({
        emoji: '🔔',
        title: `Demain : ${d.tomorrow.length} tâche${d.tomorrow.length > 1 ? 's' : ''}`,
        body: d.tomorrow.length === 1 ? d.tomorrow[0].name : `${d.tomorrow[0].name} + ${d.tomorrow.length - 1} autre${d.tomorrow.length > 2 ? 's' : ''}`,
        href: `/planning?date=${new Date(Date.now() + 86400000).toISOString().slice(0, 10)}`,
      });
    }

    if (d.thisWeek.length > 0 && items.length < 4) {
      items.push({
        emoji: '🗓',
        title: `Cette semaine : ${d.thisWeek.length} tâche${d.thisWeek.length > 1 ? 's' : ''}`,
        body: 'Yova les a planifiées pour toi',
        href: '/planning',
      });
    }

    if (items.length === 0) {
      items.push({
        emoji: '✨',
        title: 'Tout est calme',
        body: 'Aucune tâche ne t\'attend pour le moment. Profite.',
      });
    }

    return items;
  }, [d]);

  return (
    <div className="pt-4 pb-8" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ═══════ GREETING ═══════ */}
      <div className="px-4">
        <p className="text-[14px] text-[#8e8e93]">{greeting}</p>
        <h2 className="text-[26px] font-bold text-[#1c1c1e] leading-tight">{profile?.display_name?.split(' ')[0]}</h2>
      </div>

      {/* ═══════ MÉTÉO DU FOYER ═══════ */}
      <div className="mx-4 rounded-3xl p-6 relative overflow-hidden" style={{
        background: `linear-gradient(135deg, ${weather.color}ee, ${weather.color}99)`,
        boxShadow: `0 8px 32px ${weather.color}30`,
      }}>
        <div className="absolute -right-12 -top-12 w-44 h-44 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
        <div className="absolute -left-8 -bottom-16 w-36 h-36 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

        <div className="relative z-10 flex items-center gap-5">
          <div className="text-[72px] leading-none">{weather.icon}</div>
          <div>
            <p className="text-[11px] text-white/70 uppercase tracking-[0.2em] font-bold mb-1">Ton foyer</p>
            <p className="text-[24px] font-black text-white leading-tight">{weather.label}</p>
            <p className="text-[14px] text-white/80 mt-0.5">{weather.sub}</p>
          </div>
        </div>
      </div>

      {/* ═══════ SCORE PAYWALLÉ ═══════ */}
      <button
        onClick={() => router.push('/upgrade?feature=score')}
        className="mx-4 rounded-2xl bg-white p-5 flex items-center justify-between transition-transform active:scale-[0.98] text-left"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl" style={{
            background: 'linear-gradient(135deg, #f0f2f8, #e0e5f0)',
          }}>
            {/* Chiffre flouté */}
            <span className="text-[28px] font-black" style={{
              color: '#1c1c1e',
              filter: 'blur(6px)',
              userSelect: 'none',
            }}>
              {score10}
            </span>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#1c1c1e]">Mon Score</p>
            <p className="text-[12px] text-[#8e8e93] mt-0.5">Découvre le poids réel de tes tâches</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{
            background: 'linear-gradient(135deg, #007aff, #5856d6)',
            color: 'white',
          }}>
            Premium
          </span>
        </div>
      </button>

      {/* ═══════ RÉPARTITION PAYWALLÉE ═══════ */}
      {allMembers.length > 1 && (
        <button
          onClick={() => router.push('/upgrade?feature=repartition')}
          className="mx-4 rounded-2xl bg-white p-5 flex items-center justify-between transition-transform active:scale-[0.98] text-left"
          style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl text-[28px]" style={{
              background: 'linear-gradient(135deg, #f0f2f8, #e0e5f0)',
            }}>
              ⚖️
            </div>
            <div>
              <p className="text-[15px] font-bold text-[#1c1c1e]">Répartition du foyer</p>
              <p className="text-[12px] text-[#8e8e93] mt-0.5">Vois qui fait quoi dans ton foyer</p>
            </div>
          </div>
          <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{
            background: 'linear-gradient(135deg, #007aff, #5856d6)',
            color: 'white',
          }}>
            Premium
          </span>
        </button>
      )}

      {/* ═══════ RÉCAP DU SOIR ═══════ */}
      <Link href="/tasks/recap" className="mx-4 rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-transform active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg, #1c1c3e, #3a1c71)', boxShadow: '0 4px 16px rgba(28,28,62,0.3)' }}>
        <div>
          <p className="text-[17px] font-bold">📋 Comment se passe ta journée ?</p>
          <p className="text-[13px] text-white/70 mt-0.5">Coche ce que tu as fait, en 15 secondes</p>
        </div>
        <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12"><path d="M1 1l5 5-5 5" /></svg>
      </Link>

      {/* ═══════ FEED DE VIE DU FOYER ═══════ */}
      <div className="mx-4">
        <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">
          Ce qui se passe dans ton foyer
        </p>
        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          {feedItems.map((item, i) => {
            const inner = (
              <>
                <span className="text-[22px] flex-shrink-0">{item.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-semibold text-[#1c1c1e]">{item.title}</p>
                  <p className="text-[12px] text-[#8e8e93] mt-0.5 leading-relaxed">{item.body}</p>
                </div>
                {item.href && <span className="text-[18px] text-[#c7c7cc] flex-shrink-0">›</span>}
              </>
            );
            const style = i < feedItems.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {};
            return item.href ? (
              <Link key={i} href={item.href}
                className="px-4 py-4 flex items-center gap-3 active:bg-[#f0f2f8] transition-colors"
                style={style}>
                {inner}
              </Link>
            ) : (
              <div key={i} className="px-4 py-4 flex items-center gap-3" style={style}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>


      {loadingAi && null}
    </div>
  );
}
