'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { taskLoad } from '@/utils/designSystem';

/**
 * Dashboard Free — le miroir, pas l'outil.
 *
 * Priorité 1 : qui fait quoi (barres membres)
 * Priorité 2 : urgence du jour
 * Priorité 3 : insight rapide (calculé en local, sans API)
 * Priorité 4 : accès Journal
 */

const CATEGORY_LABELS: Record<string, string> = {
  cleaning: 'ménage', tidying: 'rangement', shopping: 'courses',
  laundry: 'linge', meals: 'cuisine', children: 'enfants',
  admin: 'admin', transport: 'transport', household_management: 'gestion',
  outdoor: 'extérieur', hygiene: 'hygiène', pets: 'animaux',
  vehicle: 'véhicule', misc: 'divers',
};

import type { TaskListItem, HouseholdMember } from '@/types/database';

/** Génère un insight rapide à partir des tâches assignées — pas d'API. */
function computeQuickInsight(
  tasks: TaskListItem[],
  members: HouseholdMember[],
  myId: string,
): string | null {
  if (tasks.length === 0 || members.length < 2) return null;

  // Compter la charge par membre et par catégorie
  const memberLoad: Record<string, number> = {};
  const myCatLoad: Record<string, number> = {};
  const totalCatLoad: Record<string, number> = {};

  for (const t of tasks) {
    const memberId = t.assigned_to ?? '';
    const load = taskLoad(t);
    const cat = t.scoring_category ?? 'misc';

    memberLoad[memberId] = (memberLoad[memberId] ?? 0) + load;
    totalCatLoad[cat] = (totalCatLoad[cat] ?? 0) + load;
    if (memberId === myId) {
      myCatLoad[cat] = (myCatLoad[cat] ?? 0) + load;
    }
  }

  const totalLoad = Object.values(memberLoad).reduce((s, v) => s + v, 0);
  const myLoad = memberLoad[myId] ?? 0;
  const myPct = totalLoad > 0 ? Math.round((myLoad / totalLoad) * 100) : 0;

  // Si forte asymétrie globale
  if (myPct >= 70) {
    return `Tu prends en charge ${myPct}% des tâches du foyer en ce moment.`;
  }
  if (myPct <= 30 && totalLoad > 0) {
    return `Ton partenaire assure ${100 - myPct}% des tâches. Il serait bien de rééquilibrer.`;
  }

  // Chercher la catégorie où l'utilisateur est le plus dominant
  let maxDom = 0;
  let domCat = '';
  for (const [cat, load] of Object.entries(myCatLoad)) {
    const total = totalCatLoad[cat] ?? 1;
    const dom = load / total;
    if (dom > maxDom && total > 0) {
      maxDom = dom;
      domCat = cat;
    }
  }
  if (maxDom >= 0.85 && domCat) {
    const label = CATEGORY_LABELS[domCat] ?? domCat;
    return `Tu gères la quasi-totalité des tâches de ${label} dans le foyer.`;
  }

  // Chercher la catégorie la plus en retard
  const now = Date.now();
  const overdueByCat: Record<string, number> = {};
  for (const t of tasks) {
    if (t.next_due_at && new Date(t.next_due_at).getTime() < now) {
      const cat = t.scoring_category ?? 'misc';
      overdueByCat[cat] = (overdueByCat[cat] ?? 0) + 1;
    }
  }
  const topOverdueCat = Object.entries(overdueByCat).sort((a, b) => b[1] - a[1])[0];
  if (topOverdueCat && topOverdueCat[1] >= 2) {
    const label = CATEGORY_LABELS[topOverdueCat[0]] ?? topOverdueCat[0];
    return `${topOverdueCat[1]} tâches de ${label} attendent depuis quelques jours.`;
  }

  return null;
}

export default function DashboardFree() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers, fetchHousehold } = useHouseholdStore();
  const [animBars, setAnimBars] = useState(false);

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchHousehold(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchHousehold]);

  // Animer les barres une fois les données chargées
  useEffect(() => {
    if (tasks.length > 0) {
      const t = setTimeout(() => setAnimBars(true), 100);
      return () => clearTimeout(t);
    }
  }, [tasks.length]);

  const d = useMemo(() => {
    // Charge par membre
    const byMember = allMembers.map((m) => {
      const mt = tasks.filter((t) => t.assigned_to === m.id || t.assigned_to_phantom_id === m.id);
      return {
        id: m.id,
        name: m.display_name,
        isMe: m.id === profile?.id,
        isPhantom: m.isPhantom,
        load: mt.reduce((s, t) => s + taskLoad(t), 0),
        count: mt.length,
      };
    }).sort((a, b) => b.load - a.load);

    const totalLoad = byMember.reduce((s, m) => s + m.load, 0);
    const withPct = byMember.map((m) => ({
      ...m,
      pct: totalLoad > 0 ? Math.round((m.load / totalLoad) * 100) : 0,
    }));

    // Vrai déséquilibre si écart > 20 pts entre les deux premiers
    const isImbalanced = withPct.length >= 2 && Math.abs(withPct[0].pct - withPct[1].pct) > 20;

    // Tâches urgentes
    const now = Date.now();
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const overdue = tasks.filter((t) => t.next_due_at && new Date(t.next_due_at).getTime() < now);
    const todayDue = tasks.filter((t) => {
      if (!t.next_due_at) return false;
      const d = new Date(t.next_due_at).getTime();
      return d >= now && d <= todayEnd.getTime();
    });

    const urgent = overdue[0] ?? todayDue[0] ?? null;

    return { byMember: withPct, totalLoad, isImbalanced, urgent, overdueCount: overdue.length };
  }, [tasks, allMembers, profile?.id]);

  const quickInsight = useMemo(
    () => computeQuickInsight(tasks, allMembers, profile?.id ?? ''),
    [tasks, allMembers, profile?.id],
  );

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? 'Bonjour' : h < 18 ? 'Bon après-midi' : 'Bonsoir';
  })();

  const firstName = profile?.display_name?.split(' ')[0] ?? '';

  // Couleurs par membre
  const COLORS = ['#007aff', '#af52de', '#ff9500', '#34c759'];

  return (
    <div className="pt-4 pb-10" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ═══ GREETING ═══ */}
      <div className="px-4">
        <p className="text-[14px] text-[#8e8e93]">{greeting}</p>
        <h2 className="text-[26px] font-bold text-[#1c1c1e] leading-tight">{firstName}</h2>
      </div>

      {/* ═══ CARTE MIROIR PRINCIPALE ═══ */}
      <div className="mx-4 rounded-3xl bg-white overflow-hidden" style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.07)' }}>

        {/* — Répartition — */}
        <div className="px-5 pt-5 pb-4">
          <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-4">
            Cette semaine
          </p>

          {d.byMember.length === 0 ? (
            <p className="text-[14px] text-[#8e8e93] text-center py-3">
              Aucune tâche assignée pour l&apos;instant.
            </p>
          ) : d.byMember.length === 1 ? (
            /* Solo (pas de partenaire) */
            <div>
              <div className="flex justify-between text-[14px] mb-2">
                <span className="font-semibold text-[#1c1c1e]">{d.byMember[0].name}</span>
                <span className="font-bold" style={{ color: COLORS[0] }}>{d.byMember[0].pct}%</span>
              </div>
              <div className="h-3 rounded-full" style={{ background: '#f0f2f8' }}>
                <div
                  className="h-3 rounded-full"
                  style={{
                    width: animBars ? `${d.byMember[0].pct}%` : '0%',
                    background: COLORS[0],
                    transition: 'width 1s cubic-bezier(0.34,1.56,0.64,1)',
                  }}
                />
              </div>
              <button
                onClick={() => router.push('/invite')}
                className="mt-4 w-full rounded-xl py-2.5 text-[13px] font-semibold text-center"
                style={{ background: '#EEF4FF', color: '#007aff' }}
              >
                + Inviter mon partenaire
              </button>
            </div>
          ) : (
            /* Multi-membres */
            <div className="space-y-3">
              {d.byMember.slice(0, 3).map((m, i) => (
                <div key={m.id}>
                  <div className="flex justify-between items-center text-[14px] mb-1.5">
                    <span className="font-semibold" style={{ color: m.isMe ? COLORS[i] : '#1c1c1e' }}>
                      {m.isPhantom && '👻 '}{m.name}
                      {m.isMe && <span className="text-[11px] text-[#8e8e93] font-normal ml-1">(moi)</span>}
                    </span>
                    <span className="font-bold text-[15px]" style={{ color: COLORS[i] }}>{m.pct}%</span>
                  </div>
                  <div className="h-3 rounded-full" style={{ background: '#f0f2f8' }}>
                    <div
                      className="h-3 rounded-full"
                      style={{
                        width: animBars ? `${m.pct}%` : '0%',
                        background: COLORS[i],
                        transition: `width ${0.8 + i * 0.15}s cubic-bezier(0.34,1.56,0.64,1)`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Badge équilibre */}
          {d.byMember.length >= 2 && (
            <div className="mt-4 flex items-center gap-2">
              {d.isImbalanced ? (
                <>
                  <span className="text-[16px]">⚠️</span>
                  <span className="text-[13px] font-semibold" style={{ color: '#ff9500' }}>Déséquilibré</span>
                  <button
                    onClick={() => router.push('/tasks/new')}
                    className="ml-auto text-[12px] font-semibold px-3 py-1 rounded-full"
                    style={{ background: '#fff8e6', color: '#ff9500' }}
                  >
                    Rééquilibrer →
                  </button>
                </>
              ) : (
                <>
                  <span className="text-[16px]">✅</span>
                  <span className="text-[13px] font-semibold" style={{ color: '#34c759' }}>Équilibré</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* — Séparateur — */}
        <div style={{ height: '0.5px', background: 'var(--ios-separator, rgba(60,60,67,0.12))' }} />

        {/* — Urgence du jour — */}
        {d.urgent ? (
          <Link href="/tasks" className="px-5 py-4 flex items-center gap-3 active:bg-[#f9f9fb]">
            <span className="text-[20px] flex-shrink-0">{d.overdueCount > 0 ? '⚠️' : '📌'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wide mb-0.5">
                {d.overdueCount > 0 ? `${d.overdueCount} en retard` : 'Urgent aujourd\'hui'}
              </p>
              <p className="text-[14px] font-semibold text-[#1c1c1e] truncate">{d.urgent.name}</p>
              {d.urgent.assignee && (
                <p className="text-[12px] text-[#8e8e93]">→ {d.urgent.assignee.display_name}</p>
              )}
            </div>
            <svg width="7" height="12" fill="none" stroke="#c7c7cc" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12">
              <path d="M1 1l5 5-5 5" />
            </svg>
          </Link>
        ) : (
          <div className="px-5 py-4 flex items-center gap-3">
            <span className="text-[20px]">✨</span>
            <p className="text-[14px] text-[#8e8e93]">Rien d&apos;urgent aujourd&apos;hui. Profite.</p>
          </div>
        )}

        {/* — Insight rapide — */}
        {quickInsight && (
          <>
            <div style={{ height: '0.5px', background: 'var(--ios-separator, rgba(60,60,67,0.12))' }} />
            <div className="px-5 py-4 flex items-start gap-3">
              <span className="text-[18px] flex-shrink-0 mt-0.5">💡</span>
              <div>
                <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-wide mb-0.5">Yova a remarqué</p>
                <p className="text-[14px] text-[#1c1c1e] leading-snug">{quickInsight}</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ JOURNAL ═══ */}
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

      {/* ═══ SCORE DÉTAILLÉ (premium teaser) ═══ */}
      <button
        onClick={() => router.push('/upgrade?feature=score')}
        className="mx-4 rounded-2xl bg-white p-4 flex items-center justify-between transition-transform active:scale-[0.98]"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-[20px]"
            style={{ background: 'linear-gradient(135deg, #f0f2f8, #e0e5f0)' }}>
            📊
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[#1c1c1e]">Score détaillé par catégorie</p>
            <p className="text-[12px] text-[#8e8e93]">Cuisine · Ménage · Enfants · Admin…</p>
          </div>
        </div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#007aff,#5856d6)', color: 'white' }}>
          Premium
        </span>
      </button>

      {/* ═══ RÉCAP DU SOIR ═══ */}
      <Link
        href="/tasks/recap"
        className="mx-4 rounded-2xl px-5 py-4 flex items-center justify-between text-white transition-transform active:scale-[0.98]"
        style={{ background: 'linear-gradient(135deg,#1c1c3e,#3a1c71)', boxShadow: '0 4px 16px rgba(28,28,62,0.25)' }}
      >
        <div>
          <p className="text-[15px] font-bold">☀️ Comment se passe ta journée ?</p>
          <p className="text-[12px] text-white/70 mt-0.5">Coche ce que tu as fait, en 15 secondes</p>
        </div>
        <svg width="7" height="12" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" viewBox="0 0 7 12">
          <path d="M1 1l5 5-5 5" />
        </svg>
      </Link>

    </div>
  );
}
