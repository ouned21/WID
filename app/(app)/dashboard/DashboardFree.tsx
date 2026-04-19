'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { taskLoad, weeklyMinutes, formatWeeklyTime } from '@/utils/designSystem';
import { addDays, isSameDay, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import SuggestionCard, { type Suggestion } from '@/components/SuggestionCard';

/**
 * Dashboard Free — le miroir, pas l'outil.
 *
 * Vue Score    : répartition membres + insight Yova + journal + tâches du jour
 * Vue Planning : semaine en un coup d'œil + tâches du jour pour moi
 *
 * Score est la vue par défaut. Le dernier choix est mémorisé (yova_home_view).
 */

type HomeView = 'planning' | 'score';
const HOME_VIEW_KEY = 'yova_home_view';

export default function DashboardFree() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers, fetchHousehold } = useHouseholdStore();

  // Vue mémorisée (score par défaut)
  const [homeView, setHomeView] = useState<HomeView>('score');

  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(HOME_VIEW_KEY) as HomeView | null;
    if (saved === 'score' || saved === 'planning') setHomeView(saved);
  }, []);

  const switchView = (v: HomeView) => {
    setHomeView(v);
    localStorage.setItem(HOME_VIEW_KEY, v);
  };

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchHousehold(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchHousehold]);

  useEffect(() => {
    fetch('/api/suggestions/next')
      .then((r) => r.json())
      .then((data) => {
        if (data?.suggestion) setSuggestion(data.suggestion as Suggestion);
      })
      .catch(() => {});
  }, []);

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

  // ── Planning roulant : aujourd'hui + les 6 prochains jours ─────────────────
  const weekDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const day = addDays(today, i);
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
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  const firstName = profile?.display_name?.split(' ')[0] ?? '';

  return (
    <div className="pt-4 pb-10" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ═══ GREETING ═══ */}
      <div className="px-4">
        <p className="text-[14px] text-[#8e8e93]">{greeting}</p>
        <h2 className="text-[26px] font-bold text-[#1c1c1e] leading-tight">{firstName}</h2>
      </div>

      {/* ═══════ TOGGLE VUE — pill sombre avec indicateur glissant ═══════ */}
      <div className="px-4">
        <div
          className="flex p-1 rounded-2xl relative"
          style={{
            background: 'rgba(22,22,34,0.92)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.18)',
          }}
        >
          {/* Indicateur glissant */}
          <div
            className="absolute top-1 bottom-1 rounded-xl"
            style={{
              width: 'calc(50% - 4px)',
              left: homeView === 'score' ? '4px' : 'calc(50%)',
              background: 'rgba(255,255,255,0.97)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.2)',
              transition: 'left 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            }}
          />
          <button
            onClick={() => switchView('score')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold relative z-10"
            style={{ color: homeView === 'score' ? '#1c1c1e' : 'rgba(255,255,255,0.45)' }}
          >
            ⚖️ Score
          </button>
          <button
            onClick={() => switchView('planning')}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[14px] font-semibold relative z-10"
            style={{ color: homeView === 'planning' ? '#1c1c1e' : 'rgba(255,255,255,0.45)' }}
          >
            📅 Planning
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/*                      VUE PLANNING                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {homeView === 'planning' && (
        <>
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
                        7 prochains jours
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
              {peakDay && peakDay.count > 1 && (() => {
                const todayStart = new Date(new Date().setHours(0, 0, 0, 0));
                const peakIsToday = isSameDay(peakDay.day, new Date());
                const peakIsPast = peakDay.day < todayStart && !peakIsToday;
                if (peakIsPast && d.overdue.length > 0) return null;
                const verb = peakIsToday
                  ? ' est ton jour le plus chargé'
                  : peakIsPast
                  ? ' était ton jour le plus chargé'
                  : ' sera ton jour le plus chargé';
                const label = peakIsToday
                  ? 'Aujourd\'hui'
                  : format(peakDay.day, 'EEEE', { locale: fr });
                return (
                  <div className="px-5 py-4 flex items-start gap-3"
                    style={{ borderTop: '0.5px solid #f0f2f8', background: '#fafafe' }}>
                    <span className="text-[17px] mt-0.5">💡</span>
                    <p className="text-[13px] leading-relaxed" style={{ color: '#3c3c43' }}>
                      <span className="font-bold capitalize">{label}</span>
                      {verb}
                      {' '}— {peakDay.count} tâche{peakDay.count > 1 ? 's' : ''} prévue{peakDay.count > 1 ? 's' : ''}.
                    </p>
                  </div>
                );
              })()}
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
        const totalMinutes = tasks.reduce((s, t) => s + weeklyMinutes(t), 0);

        const memberScores = allMembers.map((member, idx) => {
          const mt = tasks.filter((t) =>
            member.isPhantom ? t.assigned_to_phantom_id === member.id : t.assigned_to === member.id,
          );
          const load = mt.reduce((s, t) => s + taskLoad(t), 0);
          const mins = mt.reduce((s, t) => s + weeklyMinutes(t), 0);
          const pct = totalLoad > 0 ? Math.round((load / totalLoad) * 100) : 0;
          const timePct = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
          const FILLS = [
            'linear-gradient(90deg,#ff6b6b,#ff3030)',
            'linear-gradient(90deg,#4ecdc4,#26b5ab)',
            'linear-gradient(90deg,#c084fc,#a855f7)',
          ];
          const TIME_FILLS = [
            'linear-gradient(90deg,#ff9a9e,#ff6b6b)',
            'linear-gradient(90deg,#a8edea,#4ecdc4)',
            'linear-gradient(90deg,#e0c3fc,#c084fc)',
          ];
          const scoreFinal = Math.round((pct + timePct) / 2);
          return { member, pct, timePct, scoreFinal, mins, fill: FILLS[idx] ?? FILLS[0], timeFill: TIME_FILLS[idx] ?? TIME_FILLS[0] };
        });
        const maxPct = Math.max(...memberScores.map((m) => m.pct));
        const anyAssigned = memberScores.some((m) => m.pct > 0);
        const isUnbalanced = allMembers.length > 1 && maxPct > 65;

        // ── Tâches non assignées ──────────────────────────────────
        const unassignedTasks = tasks.filter(
          (t) => !t.assigned_to && !t.assigned_to_phantom_id,
        );
        const unassignedLoad = unassignedTasks.reduce((s, t) => s + taskLoad(t), 0);
        const unassignedMins = unassignedTasks.reduce((s, t) => s + weeklyMinutes(t), 0);
        const unassignedPct = totalLoad > 0 ? Math.round((unassignedLoad / totalLoad) * 100) : 0;
        const unassignedTimePct = totalMinutes > 0 ? Math.round((unassignedMins / totalMinutes) * 100) : 0;
        const hasUnassigned = unassignedTasks.length > 0;

        // ── Insight dynamique ─────────────────────────────────────
        const CATS_LABEL: Record<string, string> = {
          meals: 'cuisine', cleaning: 'ménage', tidying: 'rangement',
          shopping: 'courses', laundry: 'linge', children: 'enfants',
          admin: 'admin', outdoor: 'extérieur', hygiene: 'hygiène',
          pets: 'animaux', vehicle: 'voiture',
        };
        let insightText = 'Ajoute tes premières tâches — Yova analysera qui fait quoi dans ton foyer.';
        let insightCta: string | null = null;

        // Priorité : non assignées > divergence mental/temps > déséquilibre > catégorie > équilibré
        if (hasUnassigned && totalLoad > 0) {
          // L'insight ajoute la dimension temps — pas visible dans la carte
          const timeStr = unassignedMins > 0 ? ` soit ~${formatWeeklyTime(unassignedMins)}/sem` : '';
          insightText = `${unassignedTasks.length} tâche${unassignedTasks.length > 1 ? 's' : ''} sans responsable${timeStr} qui flottent dans le vide. Assigne-les — même temporairement — pour que chacun sache ce qu'il doit faire.`;
          insightCta = 'Assigner les tâches →';
        } else if (memberScores.length >= 2 && totalLoad > 0 && totalMinutes > 0) {
          const myMember = memberScores.find((m) => !m.member.isPhantom && m.member.id === profile?.id);

          // ── Divergence charge mentale ≠ temps réel ────────────────
          // Si la différence entre timePct et pct dépasse 20 points, c'est un signal fort.
          const divergentMember = memberScores
            .filter((m) => m.pct > 0 || m.timePct > 0)
            .find((m) => Math.abs(m.timePct - m.pct) >= 15);

          if (divergentMember) {
            const isMe = divergentMember.member.id === profile?.id;
            const name = isMe ? 'Tu passes' : `${divergentMember.member.display_name} passe`;
            const timeSuffix = formatWeeklyTime(divergentMember.mins);
            if (divergentMember.timePct > divergentMember.pct) {
              // Beaucoup de temps, peu de charge mentale → tâches physiques/répétitives sous-valorisées
              insightText = `${name} ${formatWeeklyTime(divergentMember.mins)}/sem (${divergentMember.timePct}% du temps) mais seulement ${divergentMember.pct}% de la charge mentale. Des tâches longues et répétitives qui restent invisibles dans le score.`;
            } else {
              // Beaucoup de charge mentale, peu de temps → charge cognitive/admin
              insightText = `${name} ${timeSuffix}/sem mais porte ${divergentMember.pct}% de la charge mentale. L'organisation, la planification — ça ne se voit pas dans le temps, mais ça pèse.`;
            }
            insightCta = 'Voir le détail →';
          } else if (myMember) {
            // ── Analyse catégorie / équilibre classique ────────────
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
              onClick={() => router.push(hasUnassigned ? '/tasks/assign' : '/score')}
              className="mx-4 rounded-[22px] p-5 relative overflow-hidden transition-transform active:scale-[0.98] text-left w-[calc(100%-32px)]"
              style={{ background: 'linear-gradient(148deg,#16163a 0%,#2b1e72 55%,#163260 100%)' }}
            >
              {/* Orbe déco */}
              <div className="absolute rounded-full pointer-events-none"
                style={{ width: 160, height: 160, background: 'rgba(255,255,255,0.035)', top: -50, right: -40 }} />

              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-bold uppercase tracking-[1.5px]"
                  style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Répartition · Cette semaine
                </p>
                {totalMinutes > 0 && (
                  <p className="text-[10px] font-semibold"
                    style={{ color: 'rgba(255,255,255,0.3)' }}>
                    ~{formatWeeklyTime(totalMinutes)} au total
                  </p>
                )}
              </div>

              {memberScores.map((ms) => {
                const hasData = ms.pct > 0 || ms.timePct > 0;
                return (
                  <div key={ms.member.id} className="mb-4">
                    {/* Nom + totaux */}
                    <div className="flex justify-between items-baseline mb-2">
                      <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                        {ms.member.display_name}
                      </span>
                      {hasData ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                            {formatWeeklyTime(ms.mins)}/sem
                          </span>
                          <span className="text-[13px] font-black text-white">{ms.scoreFinal}%</span>
                        </div>
                      ) : (
                        <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                          Aucune tâche assignée
                        </span>
                      )}
                    </div>

                    {hasData ? (
                      <>
                        {/* Barre charge mentale */}
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[9px] font-bold uppercase tracking-[0.08em] w-[58px] flex-shrink-0"
                            style={{ color: 'rgba(255,255,255,0.35)' }}>
                            Mental
                          </span>
                          <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${ms.pct}%`, background: ms.fill }} />
                          </div>
                          <span className="text-[10px] font-bold w-[28px] text-right flex-shrink-0 text-white">
                            {ms.pct}%
                          </span>
                        </div>

                        {/* Barre temps réel */}
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-[0.08em] w-[58px] flex-shrink-0"
                            style={{ color: 'rgba(255,255,255,0.35)' }}>
                            Temps
                          </span>
                          <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                            <div className="h-full rounded-full"
                              style={{ width: `${ms.timePct}%`, background: ms.timeFill }} />
                          </div>
                          <span className="text-[10px] font-bold w-[28px] text-right flex-shrink-0"
                            style={{ color: 'rgba(255,255,255,0.6)' }}>
                            {ms.timePct}%
                          </span>
                        </div>
                      </>
                    ) : (
                      /* Ligne neutre quand 0 tâche assignée */
                      <div className="h-[5px] rounded-full w-full" style={{ background: 'rgba(255,255,255,0.07)' }} />
                    )}
                  </div>
                );
              })}

              {/* Ligne tâches non assignées */}
              {hasUnassigned && (
                <div className="mb-1">
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,165,0,0.9)' }}>
                      ⚠️ Non assignées
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.45)' }}>
                        {formatWeeklyTime(unassignedMins)}/sem
                      </span>
                      <span className="text-[13px] font-black" style={{ color: 'rgba(255,165,0,0.9)' }}>
                        {Math.round((unassignedPct + unassignedTimePct) / 2)}%
                      </span>
                    </div>
                  </div>
                  {/* Barre charge mentale */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em] w-[58px] flex-shrink-0"
                      style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Mental
                    </span>
                    <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${unassignedPct}%`, background: 'linear-gradient(90deg,#ff9500,#ffcc00)' }} />
                    </div>
                    <span className="text-[10px] font-bold w-[28px] text-right flex-shrink-0"
                      style={{ color: 'rgba(255,165,0,0.9)' }}>
                      {unassignedPct}%
                    </span>
                  </div>
                  {/* Barre temps */}
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.08em] w-[58px] flex-shrink-0"
                      style={{ color: 'rgba(255,255,255,0.35)' }}>
                      Temps
                    </span>
                    <div className="flex-1 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                      <div className="h-full rounded-full"
                        style={{ width: `${unassignedTimePct}%`, background: 'linear-gradient(90deg,#ffcc00,#ffe566)' }} />
                    </div>
                    <span className="text-[10px] font-bold w-[28px] text-right flex-shrink-0"
                      style={{ color: 'rgba(255,165,0,0.7)' }}>
                      {unassignedTimePct}%
                    </span>
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: 'rgba(255,165,0,0.7)' }}>
                    {unassignedTasks.length} tâche{unassignedTasks.length > 1 ? 's' : ''} sans responsable — assigne-les pour un meilleur suivi
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mt-3">
                {isUnbalanced && (
                  <div className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[11px] font-bold"
                    style={{ background: 'rgba(255,100,100,0.18)', border: '1px solid rgba(255,100,100,0.28)', color: '#ff8c8c' }}>
                    ⚠️ Déséquilibré
                  </div>
                )}
                {!isUnbalanced && anyAssigned && !hasUnassigned && (
                  <div className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[11px] font-bold"
                    style={{ background: 'rgba(52,199,89,0.18)', border: '1px solid rgba(52,199,89,0.28)', color: '#34c759' }}>
                    ✅ Tout assigné
                  </div>
                )}
                {hasUnassigned && (
                  <div className="inline-flex items-center gap-1.5 rounded-[9px] px-3 py-1 text-[11px] font-bold"
                    style={{ background: 'rgba(255,149,0,0.18)', border: '1px solid rgba(255,149,0,0.3)', color: '#ff9500' }}>
                    📋 Assigner →
                  </div>
                )}
              </div>
            </button>

            {/* ── Insight Yova ── */}
            <div className="mx-4 rounded-[16px] bg-white px-[14px] py-[12px] flex gap-[10px]"
              style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
              <span className="text-[20px] flex-shrink-0 pt-0.5">💡</span>
              <div>
                <p className="text-[12px] font-bold text-[#1c1c1e] mb-1">Yova a remarqué</p>
                <p className="text-[11px] leading-[1.45]" style={{ color: '#8e8e93' }}>{insightText}</p>
                {insightCta && (
                  <button onClick={() => router.push(hasUnassigned ? '/tasks/assign' : '/score')}
                    className="text-[11px] font-bold mt-1.5 block"
                    style={{ color: '#007aff' }}>
                    {insightCta}
                  </button>
                )}
              </div>
            </div>

            {/* ── Yova suggère ── */}
            {suggestion && (
              <SuggestionCard
                suggestion={suggestion}
                onAccept={() => setSuggestion(null)}
                onDismiss={() => setSuggestion(null)}
              />
            )}

            {/* ── Journal IA ── */}
            <button
              onClick={() => router.push('/journal')}
              className="mx-4 rounded-3xl p-5 text-left transition-transform active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 8px 24px rgba(118,75,162,0.22)',
              }}
            >
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full text-[24px] flex-shrink-0"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  🤖
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.15em] font-bold text-white/70 mb-0.5">Journal IA</p>
                  <p className="text-[16px] font-bold text-white leading-tight">
                    Qu&apos;est-ce que t&apos;as géré aujourd&apos;hui ?
                  </p>
                  <p className="text-[12px] text-white/75 mt-0.5">Raconte en une phrase. Yova note tout.</p>
                </div>
                <div className="text-white/50 text-[20px]">→</div>
              </div>
            </button>

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
                        {assigneeName ? (
                          <span className="text-[10px] font-bold px-2 py-1 rounded-[7px] flex-shrink-0 text-white"
                            style={{ background: badgeFill }}>
                            {assigneeName}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-1 rounded-[7px] flex-shrink-0"
                            style={{ background: '#f0f2f8', color: '#8e8e93' }}>
                            Non assigné
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
