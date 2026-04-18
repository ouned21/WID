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
          {/* ── Carte semaine complète ── */}
          <div className="mx-4">
            <div className="rounded-3xl bg-white overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>

              {/* En-tête carte */}
              {(() => {
                const totalWeek = weekDays.reduce((s, d) => s + d.count, 0);
                const overdueWeek = d.overdue.length;
                const statusOk = overdueWeek === 0;
                return (
                  <div className="px-5 pt-5 pb-4 flex items-start justify-between"
                    style={{ borderBottom: '0.5px solid #f0f2f8' }}>
                    <div>
                      <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-1">
                        Cette semaine
                      </p>
                      <p className="text-[16px] font-bold" style={{ color: statusOk ? '#34c759' : '#ff9500' }}>
                        {statusOk
                          ? totalWeek === 0 ? '🌿 Rien de planifié' : '✅ Tout est planifié'
                          : `⚠️ ${overdueWeek} tâche${overdueWeek > 1 ? 's' : ''} en retard`}
                      </p>
                    </div>
                    <Link href="/planning"
                      className="text-[13px] font-semibold mt-1"
                      style={{ color: '#007aff' }}>
                      Tout voir →
                    </Link>
                  </div>
                );
              })()}

              {/* Lignes par jour */}
              {weekDays.map(({ day, count, load }, i) => {
                const isToday = isSameDay(day, new Date());
                const loadLabel = load === 0 ? 'libre' : load < 8 ? 'léger' : load < 20 ? 'normal' : 'chargé';
                const loadColor = load === 0 ? '#c7c7cc' : load < 8 ? '#34c759' : load < 20 ? '#ff9500' : '#ff3b30';
                const barPct = Math.min(100, Math.round((load / 28) * 100));

                return (
                  <Link
                    key={i}
                    href={`/planning?date=${format(day, 'yyyy-MM-dd')}`}
                    className="flex items-center gap-3 px-5 py-3 active:bg-[#f5f7ff] transition-colors"
                    style={{
                      borderBottom: i < 6 ? '0.5px solid #f0f2f8' : undefined,
                      background: isToday ? '#EEF4FF' : undefined,
                    }}
                  >
                    {/* Jour */}
                    <span className="text-[14px] font-bold w-8 flex-shrink-0 capitalize"
                      style={{ color: isToday ? '#007aff' : '#1c1c1e' }}>
                      {format(day, 'EEE', { locale: fr })}
                    </span>

                    {/* Nombre tâches */}
                    <span className="text-[12px] w-[68px] flex-shrink-0"
                      style={{ color: count === 0 ? '#c7c7cc' : '#3c3c43' }}>
                      {count === 0 ? '—' : `${count} tâche${count > 1 ? 's' : ''}`}
                    </span>

                    {/* Barre de charge */}
                    <div className="flex-1 h-[6px] rounded-full" style={{ background: '#f0f2f8' }}>
                      {barPct > 0 && (
                        <div className="h-[6px] rounded-full"
                          style={{ width: `${barPct}%`, background: loadColor, minWidth: 6 }} />
                      )}
                    </div>

                    {/* Label */}
                    <span className="text-[11px] font-semibold w-11 text-right flex-shrink-0"
                      style={{ color: loadColor }}>
                      {loadLabel}
                    </span>
                  </Link>
                );
              })}

              {/* Insight Yova */}
              {peakDay && peakDay.count > 1 && (
                <div className="px-5 py-4 flex items-start gap-3"
                  style={{ borderTop: '0.5px solid #f0f2f8', background: '#fafafe' }}>
                  <span className="text-[17px] mt-0.5">💡</span>
                  <p className="text-[13px] leading-relaxed" style={{ color: '#3c3c43' }}>
                    <span className="font-bold capitalize">
                      {isSameDay(peakDay.day, new Date())
                        ? 'Aujourd\'hui'
                        : format(peakDay.day, 'EEEE', { locale: fr })}
                    </span>
                    {isSameDay(peakDay.day, new Date())
                      ? ' est ton jour le plus chargé'
                      : ' sera ton jour le plus chargé'}
                    {' '}— {peakDay.count} tâche{peakDay.count > 1 ? 's' : ''} prévue{peakDay.count > 1 ? 's' : ''}.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Aujourd'hui pour toi ── */}
          <div className="mx-4">
            <div className="rounded-3xl bg-white overflow-hidden" style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <div className="px-5 pt-4 pb-3" style={{ borderBottom: '0.5px solid #f0f2f8' }}>
                <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em]">
                  📌 Aujourd&apos;hui pour toi
                </p>
              </div>

              {d.myToday.length === 0 ? (
                <div className="px-5 py-6 flex items-center gap-3">
                  <span className="text-[24px]">☀️</span>
                  <div>
                    <p className="text-[14px] font-semibold text-[#1c1c1e]">Rien de prévu</p>
                    <p className="text-[12px] text-[#8e8e93] mt-0.5">Profite de ta journée.</p>
                  </div>
                </div>
              ) : (
                d.myToday.map((task, i) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 active:bg-[#f5f7ff] transition-colors"
                    style={{ borderBottom: i < d.myToday.length - 1 ? '0.5px solid #f0f2f8' : undefined }}
                  >
                    <span className="text-[8px]" style={{ color: '#007aff' }}>›</span>
                    <span className="text-[14px] font-medium text-[#1c1c1e] flex-1 truncate">{task.name}</span>
                    <span className="text-[18px] text-[#c7c7cc]">›</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*                       VUE SCORE                           */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {homeView === 'score' && (() => {
        // ── Calcul répartition globale ────────────────────────────
        const totalLoad = tasks.reduce((s, t) => s + taskLoad(t), 0);
        const memberScores = allMembers.map((member, idx) => {
          const mt = tasks.filter((t) =>
            member.isPhantom ? t.assigned_to_phantom_id === member.id : t.assigned_to === member.id,
          );
          const load = mt.reduce((s, t) => s + taskLoad(t), 0);
          const pct = totalLoad > 0 ? Math.round((load / totalLoad) * 100) : 0;
          const FILLS = [
            'linear-gradient(90deg,#ff6b6b,#ff3030)',
            'linear-gradient(90deg,#4ecdc4,#26b5ab)',
            'linear-gradient(90deg,#c084fc,#a855f7)',
          ];
          return { member, pct, fill: FILLS[idx] ?? FILLS[0] };
        });
        const maxPct = Math.max(...memberScores.map((m) => m.pct));
        const isUnbalanced = allMembers.length > 1 && maxPct > 65;

        // ── Insight dynamique ─────────────────────────────────────
        // Trouver la catégorie la plus déséquilibrée pour le user courant
        const CATS_LABEL: Record<string, string> = {
          meals: 'cuisine', cleaning: 'ménage', tidying: 'rangement',
          shopping: 'courses', laundry: 'linge', children: 'enfants',
          admin: 'admin', outdoor: 'extérieur', hygiene: 'hygiène',
          pets: 'animaux', vehicle: 'voiture',
        };
        let insightText = 'Assigne des tâches aux membres pour voir la répartition.';
        let insightCta: string | null = null;
        if (memberScores.length >= 2 && totalLoad > 0) {
          const myMember = memberScores.find((m) => !m.member.isPhantom && m.member.id === profile?.id);
          if (myMember) {
            const catKeys = Object.keys(CATS_LABEL);
            let mostSkewed = { cat: '', myPct: 0 };
            for (const cat of catKeys) {
              const catTasks = tasks.filter((t) => t.scoring_category === cat);
              const catTotal = catTasks.reduce((s, t) => s + taskLoad(t), 0);
              if (catTotal === 0) continue;
              const myLoad = catTasks
                .filter((t) => t.assigned_to === profile?.id)
                .reduce((s, t) => s + taskLoad(t), 0);
              const myPct = Math.round((myLoad / catTotal) * 100);
              if (myPct > mostSkewed.myPct) mostSkewed = { cat, myPct };
            }
            if (mostSkewed.myPct > 75) {
              const partner = memberScores.find((m) => m.member.id !== profile?.id && !m.member.isPhantom)
                ?? memberScores.find((m) => m.member.id !== profile?.id);
              const partnerName = partner?.member.display_name ?? 'ton partenaire';
              insightText = `Tu gères la ${CATS_LABEL[mostSkewed.cat] ?? mostSkewed.cat} à ${mostSkewed.myPct}% — ${partnerName} n'a aucune tâche dans cette catégorie.`;
              insightCta = 'Rééquilibrer →';
            } else if (myMember.pct > 65) {
              insightText = `Tu portes ${myMember.pct}% de la charge du foyer cette semaine.`;
              insightCta = 'Voir le détail →';
            } else if (myMember.pct > 0) {
              insightText = `La répartition est équilibrée — continue comme ça !`;
            }
          }
        }

        // ── Tâches du jour (tous les membres) ────────────────────
        const todayAllTasks = d.today.slice(0, 5);

        return (
          <>
            {/* ── Big card sombre Répartition ── */}
            <button
              onClick={() => router.push('/score')}
              className="mx-4 rounded-[22px] p-5 relative overflow-hidden transition-transform active:scale-[0.98] text-left w-[calc(100%-32px)]"
              style={{ background: 'linear-gradient(148deg,#16163a 0%,#2b1e72 55%,#163260 100%)' }}
            >
              {/* Orbe déco */}
              <div className="absolute rounded-full pointer-events-none"
                style={{ width: 160, height: 160, background: 'rgba(255,255,255,0.035)', top: -50, right: -40 }} />

              <p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-4"
                style={{ color: 'rgba(255,255,255,0.4)' }}>
                Répartition · Cette semaine
              </p>

              {memberScores.map((ms) => (
                <div key={ms.member.id} className="mb-3 last:mb-1">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {ms.member.display_name}
                    </span>
                    <span className="text-[13px] font-black text-white">{ms.pct} %</span>
                  </div>
                  <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${ms.pct}%`, background: ms.fill }} />
                  </div>
                </div>
              ))}

              {isUnbalanced && (
                <div className="inline-flex items-center gap-1.5 mt-3 rounded-[9px] px-3 py-1 text-[11px] font-bold"
                  style={{ background: 'rgba(255,100,100,0.18)', border: '1px solid rgba(255,100,100,0.28)', color: '#ff8c8c' }}>
                  ⚠️ Déséquilibré
                </div>
              )}
              {!isUnbalanced && totalLoad > 0 && (
                <div className="inline-flex items-center gap-1.5 mt-3 rounded-[9px] px-3 py-1 text-[11px] font-bold"
                  style={{ background: 'rgba(52,199,89,0.18)', border: '1px solid rgba(52,199,89,0.28)', color: '#34c759' }}>
                  ✅ Équilibré
                </div>
              )}
            </button>

            {/* ── Insight Yova ── */}
            <div className="mx-4 rounded-[16px] bg-white px-[14px] py-[12px] flex gap-[10px]"
              style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
              <span className="text-[20px] flex-shrink-0 pt-0.5">💡</span>
              <div>
                <p className="text-[12px] font-bold text-[#1c1c1e] mb-1">Yova a remarqué</p>
                <p className="text-[11px] leading-[1.45]" style={{ color: '#8e8e93' }}>{insightText}</p>
                {insightCta && (
                  <button onClick={() => router.push('/score')}
                    className="text-[11px] font-bold mt-1.5 block"
                    style={{ color: '#007aff' }}>
                    {insightCta}
                  </button>
                )}
              </div>
            </div>

            {/* ── Aujourd'hui ── */}
            {todayAllTasks.length > 0 && (
              <div className="mx-4">
                <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-2 px-1">
                  Aujourd&apos;hui
                </p>
                <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                  {todayAllTasks.map((task, i) => {
                    const catColor = task.category?.color_hex ?? '#8e8e93';
                    const assigneeName = task.assignee?.display_name
                      ?? allMembers.find((m) => m.isPhantom && m.id === task.assigned_to_phantom_id)?.display_name
                      ?? null;
                    const isOverdue = task.next_due_at && new Date(task.next_due_at) < new Date(new Date().setHours(0, 0, 0, 0));
                    const memberIdx = assigneeName
                      ? allMembers.findIndex((m) => m.display_name === assigneeName)
                      : -1;
                    const BADGE_FILLS = [
                      'linear-gradient(135deg,#5856d6,#007aff)',
                      'linear-gradient(135deg,#26b5ab,#4ecdc4)',
                      'linear-gradient(135deg,#a855f7,#c084fc)',
                    ];
                    const badgeFill = memberIdx >= 0 ? (BADGE_FILLS[memberIdx] ?? BADGE_FILLS[0]) : 'linear-gradient(135deg,#8e8e93,#636366)';

                    return (
                      <Link key={task.id} href={`/tasks/${task.id}`}
                        className="flex items-center gap-3 px-4 py-3 active:bg-[#f5f7ff] transition-colors"
                        style={{ borderBottom: i < todayAllTasks.length - 1 ? '0.5px solid #f0f0f5' : undefined }}>
                        <span className="w-[9px] h-[9px] rounded-full flex-shrink-0" style={{ background: catColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-[#1c1c1e] truncate">{task.name}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: '#8e8e93' }}>
                            {task.category?.name ?? ''}
                            {isOverdue ? ' · En retard' : ' · Aujourd\'hui'}
                          </p>
                        </div>
                        {assigneeName && (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-[7px] flex-shrink-0 text-white"
                            style={{ background: badgeFill }}>
                            {assigneeName}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Récap du soir ── */}
            <Link
              href="/tasks/recap"
              className="mx-4 rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-transform active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg,#1c1c3e,#3a1c71)', boxShadow: '0 4px 16px rgba(28,28,62,0.3)' }}
            >
              <div>
                <p className="text-[17px] font-bold">📋 Comment se passe ta journée ?</p>
                <p className="text-[13px] text-white/70 mt-0.5">Coche ce que tu as fait, en 15 secondes</p>
              </div>
              <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12">
                <path d="M1 1l5 5-5 5" />
              </svg>
            </Link>
          </>
        );
      })()}
    </div>
  );
}
