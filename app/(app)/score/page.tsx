'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { createClient } from '@/lib/supabase';
import { taskLoad } from '@/utils/designSystem';

/**
 * Score détaillé — Répartition par catégorie
 * Design : mockup yova-concept.html / Screen 2
 *
 * - Catégories avec barres J (rouge) / B (teal) + status
 * - Tendance hebdomadaire (basée sur task_completions)
 */

// ── Config catégories dans l'ordre d'affichage ───────────────────────────────

const CATS = [
  { key: 'meals',                label: 'Cuisine',        emoji: '🍳' },
  { key: 'cleaning',             label: 'Ménage',         emoji: '🧹' },
  { key: 'tidying',              label: 'Rangement',      emoji: '🗂' },
  { key: 'shopping',             label: 'Courses',        emoji: '🛒' },
  { key: 'laundry',              label: 'Linge',          emoji: '👕' },
  { key: 'children',             label: 'Enfants',        emoji: '🧒' },
  { key: 'admin',                label: 'Admin',          emoji: '📋' },
  { key: 'outdoor',              label: 'Extérieur',      emoji: '🌿' },
  { key: 'hygiene',              label: 'Hygiène',        emoji: '🚿' },
  { key: 'pets',                 label: 'Animaux',        emoji: '🐾' },
  { key: 'vehicle',              label: 'Voiture',        emoji: '🚗' },
  { key: 'household_management', label: 'Gestion foyer',  emoji: '🏠' },
];

// Couleurs par rang de membre (même palette que le mockup)
const MEMBER_COLORS = ['#ff4444', '#26b5ab', '#af52de', '#ff9500'];

type Period = 'week' | 'month' | '3months';

type WeekBar = { label: string; height: number; opacity: number };

// ── Composant principal ──────────────────────────────────────────────────────

export default function ScoreDetailPage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks } = useTaskStore();
  const { allMembers, household, fetchHousehold } = useHouseholdStore();

  const [period, setPeriod] = useState<Period>('week');
  const [weekBars, setWeekBars] = useState<WeekBar[]>([]);

  // Fetch data
  useEffect(() => {
    if (!profile?.household_id) return;
    fetchTasks(profile.household_id);
    if (!household) fetchHousehold(profile.household_id);
  }, [profile?.household_id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch completions pour la tendance
  useEffect(() => {
    if (!profile?.id) return;

    async function loadTrend() {
      const supabase = createClient();
      const since = new Date(Date.now() - 28 * 86400000).toISOString();
      const { data } = await supabase
        .from('task_completions')
        .select('completed_at, score_at_completion')
        .eq('completed_by', profile!.id)
        .gte('completed_at', since)
        .order('completed_at');

      if (!data || data.length === 0) {
        setWeekBars([]);
        return;
      }

      // Grouper par semaine (0 = la plus ancienne, 3 = la plus récente)
      const now = Date.now();
      const buckets = [0, 0, 0, 0]; // S1 S2 S3 S4
      for (const c of data) {
        const daysAgo = Math.floor((now - new Date(c.completed_at).getTime()) / 86400000);
        const weekIdx = Math.min(3, Math.floor(daysAgo / 7));
        // weekIdx 0 = cette semaine, 3 = il y a 4 semaines → inverser
        buckets[3 - weekIdx] += c.score_at_completion ?? 0;
      }

      const maxVal = Math.max(...buckets, 1);
      setWeekBars([
        { label: 'S1', height: Math.round((buckets[0] / maxVal) * 44), opacity: 0.28 },
        { label: 'S2', height: Math.round((buckets[1] / maxVal) * 44), opacity: 0.45 },
        { label: 'S3', height: Math.round((buckets[2] / maxVal) * 44), opacity: 0.65 },
        { label: 'S4', height: Math.round((buckets[3] / maxVal) * 44), opacity: 1 },
      ]);
    }

    loadTrend();
  }, [profile?.id]);

  // ── Calcul répartition par catégorie ───────────────────────────────────────

  const categoryRows = useMemo(() => {
    if (!allMembers.length) return [];

    return CATS.map(({ key, label, emoji }) => {
      const catTasks = tasks.filter((t) => t.scoring_category === key);
      if (catTasks.length === 0) return null;

      const totalLoad = catTasks.reduce((s, t) => s + taskLoad(t), 0);
      if (totalLoad === 0) return null;

      const memberLoads = allMembers.map((member, idx) => {
        const mt = catTasks.filter((t) =>
          member.isPhantom
            ? t.assigned_to_phantom_id === member.id
            : t.assigned_to === member.id,
        );
        const load = mt.reduce((s, t) => s + taskLoad(t), 0);
        const pct = Math.round((load / totalLoad) * 100);
        return {
          member,
          load,
          pct,
          color: MEMBER_COLORS[idx] ?? '#8e8e93',
          initial: member.display_name.charAt(0).toUpperCase(),
        };
      });

      // Pourcentage non assigné
      const assignedLoad = memberLoads.reduce((s, m) => s + m.load, 0);
      const unassignedPct = Math.round(((totalLoad - assignedLoad) / totalLoad) * 100);

      // Statut équilibre (pour 2 membres)
      const maxPct = Math.max(...memberLoads.map((m) => m.pct));
      const status = allMembers.length < 2 ? 'ok' : maxPct <= 60 ? 'ok' : maxPct <= 80 ? 'warn' : 'critical';

      return { key, label, emoji, memberLoads, unassignedPct, status };
    }).filter(Boolean);
  }, [tasks, allMembers]);

  // ── Score global ───────────────────────────────────────────────────────────

  const globalScores = useMemo(() => {
    if (!allMembers.length) return [];
    const totalLoad = tasks.reduce((s, t) => s + taskLoad(t), 0);
    if (totalLoad === 0) return [];

    return allMembers.map((member, idx) => {
      const mt = tasks.filter((t) =>
        member.isPhantom ? t.assigned_to_phantom_id === member.id : t.assigned_to === member.id,
      );
      const load = mt.reduce((s, t) => s + taskLoad(t), 0);
      const pct = Math.round((load / totalLoad) * 100);
      return { member, pct, color: MEMBER_COLORS[idx] ?? '#8e8e93' };
    });
  }, [tasks, allMembers]);

  // ── Tendance globale ───────────────────────────────────────────────────────

  const trendNote = useMemo(() => {
    if (!categoryRows.length || allMembers.length < 2) return null;
    const imbalances = categoryRows
      .filter(Boolean)
      .map((r) => Math.max(...r!.memberLoads.map((m) => m.pct)));
    const avg = imbalances.reduce((s, v) => s + v, 0) / imbalances.length;
    if (avg <= 55) return '✅ Bonne répartition globale';
    if (avg <= 65) return '↗ Tu te rééquilibres progressivement';
    if (avg <= 75) return '⚠️ Déséquilibre modéré à corriger';
    return '🔴 Déséquilibre important — à discuter en foyer';
  }, [categoryRows, allMembers]);

  const firstName = profile?.display_name?.split(' ')[0] ?? 'toi';

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div className="pb-24" style={{ background: '#f2f2f7', minHeight: '100vh' }}>

      {/* ─── Back + titre ─── */}
      <div className="pt-2 pb-1">
        <button onClick={() => router.back()}
          className="flex items-center gap-1 px-4 py-2 text-[14px] font-semibold"
          style={{ color: '#007aff' }}>
          <svg width="8" height="13" fill="none" stroke="#007aff" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 8 13">
            <path d="M7 1L1 6.5l6 5.5" />
          </svg>
          Score
        </button>
      </div>

      <h1 className="text-[22px] font-black text-[#1c1c1e] px-4 leading-tight">Répartition</h1>
      <p className="text-[12px] text-[#8e8e93] px-4 mb-3">Qui fait quoi chez vous</p>

      {/* ─── Segment Semaine / Mois / 3 mois ─── */}
      <div className="mx-4 mb-4 flex rounded-[9px] p-0.5" style={{ background: 'rgba(0,0,0,0.06)' }}>
        {(['week', 'month', '3months'] as Period[]).map((p) => {
          const label = p === 'week' ? 'Semaine' : p === 'month' ? 'Mois' : '3 mois';
          return (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="flex-1 text-center py-[5px] rounded-[7px] text-[11px] font-semibold transition-all"
              style={period === p
                ? { background: '#fff', color: '#1c1c1e', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }
                : { color: '#8e8e93' }}>
              {label}
            </button>
          );
        })}
      </div>

      {/* ─── Score global (big card dark) ─── */}
      {globalScores.length > 0 && (
        <div className="mx-4 mb-3 rounded-[22px] p-5 relative overflow-hidden"
          style={{ background: 'linear-gradient(148deg, #16163a 0%, #2b1e72 55%, #163260 100%)' }}>
          {/* Orbe déco */}
          <div className="absolute rounded-full pointer-events-none"
            style={{ width: 160, height: 160, background: 'rgba(255,255,255,0.035)', top: -50, right: -40 }} />

          <p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-4"
            style={{ color: 'rgba(255,255,255,0.4)' }}>
            Score global
          </p>

          {globalScores.map((gs) => (
            <div key={gs.member.id} className="mb-3 last:mb-0">
              <div className="flex justify-between mb-1.5">
                <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                  {gs.member.display_name}
                </span>
                <span className="text-[13px] font-black text-white">{gs.pct}%</span>
              </div>
              <div className="h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="h-full rounded-full"
                  style={{ width: `${gs.pct}%`, background: gs.color === '#ff4444'
                    ? 'linear-gradient(90deg, #ff6b6b, #ff3030)'
                    : 'linear-gradient(90deg, #4ecdc4, #26b5ab)' }} />
              </div>
            </div>
          ))}

          {/* Badge déséquilibre */}
          {globalScores.length >= 2 && Math.max(...globalScores.map((g) => g.pct)) > 65 && (
            <div className="inline-flex items-center gap-1 mt-3 rounded-[9px] px-3 py-1 text-[11px] font-bold"
              style={{ background: 'rgba(255,100,100,0.18)', border: '1px solid rgba(255,100,100,0.28)', color: '#ff8c8c' }}>
              ⚠️ Déséquilibre détecté
            </div>
          )}
        </div>
      )}

      {/* ─── Carte catégories ─── */}
      {categoryRows.length === 0 ? (
        <div className="mx-4 rounded-[16px] bg-white py-14 text-center"
          style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
          <p className="text-[32px] mb-2">📊</p>
          <p className="text-[15px] font-bold text-[#1c1c1e]">Pas encore de données</p>
          <p className="text-[13px] text-[#8e8e93] mt-1 px-6">Assigne des tâches aux membres pour voir la répartition.</p>
        </div>
      ) : (
        <div className="mx-4 rounded-[16px] bg-white overflow-hidden mb-3"
          style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
          {categoryRows.map((row, i) => {
            if (!row) return null;
            const statusIcon = row.status === 'ok' ? '✅' : row.status === 'warn' ? '⚠️' : '🔴';

            return (
              <div key={row.key}
                className="flex items-center gap-[9px] px-[14px] py-[10px]"
                style={{ borderBottom: i < categoryRows.length - 1 ? '0.5px solid #f0f0f5' : undefined }}>

                {/* Emoji catégorie */}
                <span className="text-[17px] w-6 text-center flex-shrink-0">{row.emoji}</span>

                {/* Nom + barres */}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-bold text-[#1c1c1e] mb-1">{row.label}</p>

                  <div className="flex items-center gap-1 flex-wrap">
                    {row.memberLoads.filter((m) => m.pct > 0).map((ml) => (
                      <div key={ml.member.id} className="flex items-center gap-1">
                        {/* Barre proportionnelle (max 60px = 100%) */}
                        <div className="h-1 rounded-sm"
                          style={{
                            width: Math.max(4, Math.round((ml.pct / 100) * 60)),
                            background: ml.color,
                          }} />
                        <span className="text-[9px]" style={{ color: '#8e8e93' }}>
                          {ml.initial} {ml.pct}%
                        </span>
                      </div>
                    ))}
                    {row.unassignedPct > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="h-1 rounded-sm"
                          style={{ width: Math.max(4, Math.round((row.unassignedPct / 100) * 60)), background: '#e5e5ea' }} />
                        <span className="text-[9px]" style={{ color: '#c7c7cc' }}>? {row.unassignedPct}%</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status */}
                <span className="text-[15px] flex-shrink-0">{statusIcon}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Trend card ─── */}
      <div className="mx-4 mb-3 rounded-[16px] bg-white px-[14px] py-[12px]"
        style={{ boxShadow: '0 1px 0 rgba(0,0,0,0.06)' }}>
        <p className="text-[11px] font-bold text-[#1c1c1e] mb-3">
          Tendance 4 semaines — {firstName}
        </p>

        {weekBars.length > 0 ? (
          <>
            <div className="flex items-end gap-[5px] h-[44px] mb-1">
              {weekBars.map((bar) => (
                <div key={bar.label} className="flex flex-col items-center gap-[3px] flex-1">
                  <div className="w-full rounded-t-sm"
                    style={{
                      height: Math.max(4, bar.height),
                      background: `rgba(255, 68, 68, ${bar.opacity})`,
                    }} />
                </div>
              ))}
            </div>
            <div className="flex gap-[5px]">
              {weekBars.map((bar) => (
                <div key={bar.label} className="flex-1 text-center">
                  <span className="text-[9px]" style={{ color: '#8e8e93' }}>{bar.label}</span>
                </div>
              ))}
            </div>
            {trendNote && (
              <p className="text-[11px] font-semibold mt-2" style={{ color: '#8e8e93' }}>{trendNote}</p>
            )}
          </>
        ) : (
          <div className="py-3 text-center">
            <p className="text-[12px]" style={{ color: '#8e8e93' }}>
              Disponible après 4 semaines d&apos;utilisation
            </p>
            <div className="flex items-end gap-[5px] h-[44px] mt-3 opacity-20">
              {[20, 28, 24, 36].map((h, i) => (
                <div key={i} className="flex-col items-center flex-1 flex">
                  <div className="w-full rounded-t-sm" style={{ height: h, background: '#ff4444' }} />
                </div>
              ))}
            </div>
            <div className="flex gap-[5px] mt-1 opacity-20">
              {['S1', 'S2', 'S3', 'S4'].map((s) => (
                <div key={s} className="flex-1 text-center">
                  <span className="text-[9px]" style={{ color: '#8e8e93' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Note de bas de page ─── */}
      <p className="px-5 text-[10px] leading-relaxed" style={{ color: '#c7c7cc' }}>
        Basé sur les tâches actives assignées. Les tâches non assignées (?) sont exclues du calcul d&apos;équilibre.
      </p>
    </div>
  );
}
