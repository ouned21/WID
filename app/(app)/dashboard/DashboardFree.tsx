'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { taskLoad, loadTo10 } from '@/utils/designSystem';
import { addDays, startOfWeek, isSameDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Dashboard pour les utilisateurs GRATUITS.
 *
 * Vue Planning  : semaine en un coup d'œil + insight Yova + tâches du jour
 * Vue Score     : météo du foyer + score paywallé + feed de vie
 *
 * Le dernier choix est mémorisé dans localStorage (yova_home_view).
 */

const CATEGORY_EMOJI: Record<string, string> = {
  cleaning: '🧹', tidying: '🗂', shopping: '🛒', laundry: '👕',
  meals: '🍳', children: '👶', admin: '📋', transport: '🚗',
  household_management: '🏠', outdoor: '🌿', hygiene: '🪥',
  pets: '🐾', vehicle: '🔧', misc: '📌',
};

type WeatherState = { icon: string; label: string; sub: string; color: string };
type HomeView = 'planning' | 'score';
const HOME_VIEW_KEY = 'yova_home_view';

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

  // Vue mémorisée (planning par défaut)
  const [homeView, setHomeView] = useState<HomeView>('planning');

  useEffect(() => {
    const saved = localStorage.getItem(HOME_VIEW_KEY) as HomeView | null;
    if (saved === 'score' || saved === 'planning') setHomeView(saved);
  }, []);

  const switchView = (v: HomeView) => {
    setHomeView(v);
    localStorage.setItem(HOME_VIEW_KEY, v);
  };

  useEffect(() => {
    if (profile?.household_id) fetchTasks(profile.household_id);
  }, [profile?.household_id, fetchTasks]);

  // ── Calculs temporels ────────────────────────────────────────────────────────
  const d = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrowStart = new Date(todayStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 86400000);

    const my = tasks.filter((t) => t.assigned_to === profile?.id);
    const myLoad = my.reduce((s, t) => s + taskLoad(t), 0);

    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at) < todayStart);
    const today = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const x = new Date(t.next_due_at);
      return x >= todayStart && x < tomorrowStart;
    });
    const myToday = today.filter((t) => t.assigned_to === profile?.id);
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

    return { myLoad, overdue, today, myToday, tomorrow, thisWeek, totalActive: tasks.length };
  }, [tasks, profile?.id]);

  // ── Données semaine pour la vue Planning ────────────────────────────────────
  const weekDays = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(ws, i);
      const dayTasks = tasks.filter((t) => t.next_due_at && isSameDay(new Date(t.next_due_at), day));
      const load = dayTasks.reduce((s, t) => s + taskLoad(t), 0);
      return { day, count: dayTasks.length, load };
    });
  }, [tasks]);

  const peakDay = useMemo(
    () => weekDays.reduce((max, d) => (d.count > max.count ? d : max), weekDays[0]),
    [weekDays],
  );

  // ── UI helpers ───────────────────────────────────────────────────────────────
  const score10 = loadTo10(d.myLoad);
  const weather = getWeather(d.overdue.length, d.totalActive);
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  const feedItems = useMemo(() => {
    const items: { emoji: string; title: string; body: string; href?: string }[] = [];

    if (d.overdue.length > 0) {
      items.push({
        emoji: '⚠️',
        title: `${d.overdue.length} tâche${d.overdue.length > 1 ? 's' : ''} en retard`,
        body: d.overdue.length === 1 ? d.overdue[0].name : `${d.overdue[0].name} + ${d.overdue.length - 1} autre${d.overdue.length > 2 ? 's' : ''}`,
        href: '/planning?tab=tasks',
      });
    }
    if (d.today.length > 0) {
      items.push({
        emoji: '📅',
        title: `Aujourd'hui : ${d.today.length} tâche${d.today.length > 1 ? 's' : ''}`,
        body: d.today.length === 1 ? d.today[0].name : `${d.today[0].name} + ${d.today.length - 1} autre${d.today.length > 2 ? 's' : ''}`,
        href: '/planning?tab=tasks',
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
      items.push({ emoji: '✨', title: 'Tout est calme', body: 'Aucune tâche ne t\'attend pour le moment. Profite.' });
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

      {/* ═══════ TOGGLE VUE ═══════ */}
      <div className="px-4">
        <div className="flex rounded-2xl p-1" style={{ background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <button
            onClick={() => switchView('planning')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold transition-all"
            style={homeView === 'planning'
              ? { background: 'linear-gradient(135deg, #007aff, #5856d6)', color: 'white', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }
              : { color: '#8e8e93' }}>
            📅 Planning
          </button>
          <button
            onClick={() => switchView('score')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold transition-all"
            style={homeView === 'score'
              ? { background: 'linear-gradient(135deg, #007aff, #5856d6)', color: 'white', boxShadow: '0 2px 8px rgba(0,122,255,0.25)' }
              : { color: '#8e8e93' }}>
            ⚖️ Score
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*                      VUE PLANNING                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {homeView === 'planning' && (
        <>
          {/* Semaine en un coup d'œil */}
          <div className="mx-4">
            <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">
              Cette semaine
            </p>
            <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="flex p-3 gap-1">
                {weekDays.map(({ day, count, load }, i) => {
                  const isToday = isSameDay(day, new Date());
                  const isHeavy = load > 20;
                  const isMedium = load > 8;
                  const dotColor = count === 0 ? '#e5e5ea' : isHeavy ? '#ff3b30' : isMedium ? '#ff9500' : '#34c759';
                  return (
                    <Link
                      key={i}
                      href={`/planning?date=${format(day, 'yyyy-MM-dd')}`}
                      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl transition-all active:scale-95"
                      style={{ background: isToday ? '#EEF4FF' : 'transparent' }}
                    >
                      <span className="text-[9px] font-bold uppercase" style={{ color: isToday ? '#007aff' : '#8e8e93' }}>
                        {format(day, 'EEE', { locale: fr })}
                      </span>
                      <span className="text-[16px] font-bold" style={{ color: isToday ? '#007aff' : '#1c1c1e' }}>
                        {format(day, 'd')}
                      </span>
                      <span className="h-2 w-2 rounded-full" style={{ background: dotColor }} />
                      {count > 0 && (
                        <span className="text-[9px] font-bold" style={{ color: dotColor }}>{count}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Insight Yova */}
          {peakDay && peakDay.count > 0 && (
            <div className="mx-4 rounded-2xl p-4" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)', boxShadow: '0 4px 16px rgba(102,126,234,0.25)' }}>
              <div className="flex items-start gap-3">
                <span className="text-[24px]">🧠</span>
                <div>
                  <p className="text-[13px] font-bold text-white capitalize">
                    {isSameDay(peakDay.day, new Date())
                      ? 'Aujourd\'hui est ton jour le plus chargé'
                      : `${format(peakDay.day, 'EEEE', { locale: fr })} sera ton jour le plus chargé`}
                  </p>
                  <p className="text-[12px] text-white/70 mt-0.5 capitalize">
                    {peakDay.count} tâche{peakDay.count > 1 ? 's' : ''} · {format(peakDay.day, 'EEEE d MMMM', { locale: fr })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Mes tâches aujourd'hui */}
          <div className="mx-4">
            <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">
              Mes tâches aujourd&apos;hui
            </p>
            {d.myToday.length === 0 ? (
              <div className="rounded-2xl bg-white py-8 text-center" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                <p className="text-[28px] mb-2">☀️</p>
                <p className="text-[14px] font-semibold text-[#1c1c1e]">Rien aujourd&apos;hui !</p>
                <p className="text-[12px] text-[#8e8e93] mt-0.5">Tu es libre.</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                {d.myToday.map((task, i) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-3 px-4 py-3.5 active:bg-[#f0f2f8] transition-colors"
                    style={{ borderBottom: i < d.myToday.length - 1 ? '0.5px solid var(--ios-separator)' : undefined }}
                  >
                    <span className="text-[20px]">{CATEGORY_EMOJI[task.scoring_category ?? ''] ?? '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-[#1c1c1e] truncate">{task.name}</p>
                    </div>
                    <span className="text-[18px] text-[#c7c7cc]">›</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Accès planning complet */}
          <Link
            href="/planning"
            className="mx-4 rounded-2xl bg-white px-5 py-4 flex items-center justify-between active:scale-[0.98] transition-transform"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div>
              <p className="text-[15px] font-bold text-[#1c1c1e]">Planning complet</p>
              <p className="text-[12px] text-[#8e8e93] mt-0.5">Semaine, mois et toutes les tâches</p>
            </div>
            <svg width="7" height="12" fill="none" stroke="#007aff" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12">
              <path d="M1 1l5 5-5 5" />
            </svg>
          </Link>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*                       VUE SCORE                           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {homeView === 'score' && (
        <>
          {/* Météo du foyer */}
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

          {/* Score paywallé */}
          <button
            onClick={() => router.push('/upgrade?feature=score')}
            className="mx-4 rounded-2xl bg-white p-5 flex items-center justify-between transition-transform active:scale-[0.98] text-left"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl" style={{
                background: 'linear-gradient(135deg, #f0f2f8, #e0e5f0)',
              }}>
                <span className="text-[28px] font-black" style={{ color: '#1c1c1e', filter: 'blur(6px)', userSelect: 'none' }}>
                  {score10}
                </span>
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#1c1c1e]">Mon Score</p>
                <p className="text-[12px] text-[#8e8e93] mt-0.5">Découvre le poids réel de tes tâches</p>
              </div>
            </div>
            <span className="text-[12px] font-bold px-2.5 py-1 rounded-full" style={{
              background: 'linear-gradient(135deg, #007aff, #5856d6)', color: 'white',
            }}>
              Premium
            </span>
          </button>

          {/* Répartition paywallée */}
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
                background: 'linear-gradient(135deg, #007aff, #5856d6)', color: 'white',
              }}>
                Premium
              </span>
            </button>
          )}

          {/* Récap du soir */}
          <Link
            href="/tasks/recap"
            className="mx-4 rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-transform active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #1c1c3e, #3a1c71)', boxShadow: '0 4px 16px rgba(28,28,62,0.3)' }}
          >
            <div>
              <p className="text-[17px] font-bold">📋 Comment se passe ta journée ?</p>
              <p className="text-[13px] text-white/70 mt-0.5">Coche ce que tu as fait, en 15 secondes</p>
            </div>
            <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12">
              <path d="M1 1l5 5-5 5" />
            </svg>
          </Link>

          {/* Feed de vie du foyer */}
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
        </>
      )}
    </div>
  );
}
