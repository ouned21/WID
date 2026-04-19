'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useTaskStore } from '@/stores/taskStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { taskLoad, weeklyMinutes, formatWeeklyTime } from '@/utils/designSystem';
import { createClient } from '@/lib/supabase';

type MemberScore = {
  id: string;
  name: string;
  isPhantom: boolean;
  load: number;
  mins: number;
  pct: number;       // mental %
  timePct: number;   // temps %
  scoreFinal: number; // composite
};

type SwapSuggestion = {
  taskId: string;
  taskName: string;
  categoryName: string;
  fromId: string;
  toId: string;
  fromName: string;
  toName: string;
  impactPts: number; // points de scoreFinal gagnés sur l'équilibre
  newFromScore: number;
  newToScore: number;
  applied: boolean;
};

export default function RebalancePage() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { tasks, fetchTasks, updateTask } = useTaskStore();
  const { allMembers, fetchHousehold } = useHouseholdStore();
  const [applying, setApplying] = useState<Record<string, boolean>>({});
  const [applied, setApplied] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.household_id) {
      fetchTasks(profile.household_id);
      fetchHousehold(profile.household_id);
    }
  }, [profile?.household_id, fetchTasks, fetchHousehold]);

  // ── Calcul des scores membres ──────────────────────────────────────────────
  const memberScores = useMemo((): MemberScore[] => {
    const totalLoad = tasks.reduce((s, t) => s + taskLoad(t), 0);
    const totalMins = tasks.reduce((s, t) => s + weeklyMinutes(t), 0);
    if (totalLoad === 0) return [];

    return allMembers.map((m) => {
      const mt = tasks.filter((t) =>
        m.isPhantom ? t.assigned_to_phantom_id === m.id : t.assigned_to === m.id,
      );
      const load = mt.reduce((s, t) => s + taskLoad(t), 0);
      const mins = mt.reduce((s, t) => s + weeklyMinutes(t), 0);
      const pct = Math.round((load / totalLoad) * 100);
      const timePct = totalMins > 0 ? Math.round((mins / totalMins) * 100) : 0;
      const scoreFinal = Math.round((pct + timePct) / 2);
      return { id: m.id, name: m.display_name, isPhantom: m.isPhantom, load, mins, pct, timePct, scoreFinal };
    });
  }, [tasks, allMembers]);

  // ── Identifier surchargé / sous-chargé ────────────────────────────────────
  const sorted = [...memberScores].sort((a, b) => b.scoreFinal - a.scoreFinal);
  const overloaded = sorted[0];
  const underloaded = sorted[sorted.length - 1];
  const gap = overloaded && underloaded ? overloaded.scoreFinal - underloaded.scoreFinal : 0;
  const isBalanced = gap < 10;

  // ── Générer les suggestions de swap ───────────────────────────────────────
  const suggestions = useMemo((): SwapSuggestion[] => {
    if (!overloaded || !underloaded || overloaded.id === underloaded.id) return [];
    const totalLoad = tasks.reduce((s, t) => s + taskLoad(t), 0);
    const totalMins = tasks.reduce((s, t) => s + weeklyMinutes(t), 0);
    if (totalLoad === 0) return [];

    // Tâches assignées au surchargé, triées par impact décroissant
    const candidates = tasks
      .filter((t) =>
        overloaded.isPhantom
          ? t.assigned_to_phantom_id === overloaded.id
          : t.assigned_to === overloaded.id,
      )
      .map((t) => {
        const load = taskLoad(t);
        const mins = weeklyMinutes(t);
        // Score du surchargé après transfert
        const newFromLoad = overloaded.load - load;
        const newFromMins = overloaded.mins - mins;
        const newFromPct = Math.round((newFromLoad / totalLoad) * 100);
        const newFromTimePct = totalMins > 0 ? Math.round((newFromMins / totalMins) * 100) : 0;
        const newFromScore = Math.round((newFromPct + newFromTimePct) / 2);
        // Score du sous-chargé après réception
        const newToLoad = underloaded.load + load;
        const newToMins = underloaded.mins + mins;
        const newToTimePct = totalMins > 0 ? Math.round((newToMins / totalMins) * 100) : 0;
        const newToPct = Math.round((newToLoad / totalLoad) * 100);
        const newToScore = Math.round((newToPct + newToTimePct) / 2);
        // Impact = réduction de l'écart
        const currentGap = overloaded.scoreFinal - underloaded.scoreFinal;
        const newGap = Math.abs(newFromScore - newToScore);
        const impactPts = currentGap - newGap;

        return {
          taskId: t.id,
          taskName: t.name,
          categoryName: t.category?.name ?? '',
          fromId: overloaded.id,
          toId: underloaded.id,
          fromName: overloaded.name,
          toName: underloaded.name,
          impactPts,
          newFromScore,
          newToScore,
          applied: false,
        };
      })
      .filter((s) => s.impactPts > 0)
      .sort((a, b) => b.impactPts - a.impactPts)
      .slice(0, 3);

    return candidates;
  }, [tasks, overloaded, underloaded]);

  // ── Appliquer un swap ──────────────────────────────────────────────────────
  const applySwap = useCallback(async (s: SwapSuggestion) => {
    setApplying((p) => ({ ...p, [s.taskId]: true }));
    const supabase = createClient();
    await supabase.from('household_tasks').update({
      assigned_to: underloaded?.isPhantom ? null : underloaded?.id ?? null,
      assigned_to_phantom_id: underloaded?.isPhantom ? underloaded?.id ?? null : null,
    }).eq('id', s.taskId);
    if (profile?.household_id) await fetchTasks(profile.household_id);
    setApplied((p) => new Set([...p, s.taskId]));
    setApplying((p) => ({ ...p, [s.taskId]: false }));
  }, [underloaded, profile?.household_id, fetchTasks]);

  // ── Render ─────────────────────────────────────────────────────────────────
  const FILLS = [
    'linear-gradient(90deg,#ff6b6b,#ff3030)',
    'linear-gradient(90deg,#4ecdc4,#26b5ab)',
    'linear-gradient(90deg,#c084fc,#a855f7)',
  ];

  return (
    <div className="pt-4 pb-32">
      {/* Header */}
      <div className="px-4 mb-6">
        <button onClick={() => router.back()}
          className="text-[14px] font-semibold mb-4 block" style={{ color: '#007aff' }}>
          ← Retour
        </button>
        <h2 className="text-[26px] font-black text-[#1c1c1e] leading-tight">Rééquilibrer</h2>
        <p className="text-[14px] text-[#8e8e93] mt-1">
          Yova suggère les tâches à déplacer pour équilibrer la charge.
        </p>
      </div>

      {/* État actuel */}
      <div className="mx-4 rounded-[22px] p-5 mb-4"
        style={{ background: 'linear-gradient(148deg,#16163a 0%,#2b1e72 55%,#163260 100%)' }}>
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] mb-4"
          style={{ color: 'rgba(255,255,255,0.4)' }}>
          Répartition actuelle
        </p>

        {memberScores.map((ms, idx) => (
          <div key={ms.id} className="mb-4">
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                {ms.name}
                {ms.id === overloaded?.id && gap >= 10 && (
                  <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(255,59,48,0.2)', color: '#ff6b6b' }}>
                    surchargé·e
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  {formatWeeklyTime(ms.mins)}/sem
                </span>
                <span className="text-[14px] font-black text-white">{ms.scoreFinal}%</span>
              </div>
            </div>
            <div className="flex-1 h-[6px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${ms.scoreFinal}%`, background: FILLS[idx] ?? FILLS[0] }} />
            </div>
          </div>
        ))}

        {/* Écart */}
        {gap > 0 && (
          <div className="mt-2 pt-3" style={{ borderTop: '0.5px solid rgba(255,255,255,0.1)' }}>
            <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {isBalanced
                ? '✅ La répartition est déjà équilibrée'
                : `⚖️ Écart de ${gap} points — ${overloaded?.name} fait ${gap}% de plus`}
            </p>
          </div>
        )}
      </div>

      {/* Équilibré */}
      {isBalanced && (
        <div className="mx-4 rounded-2xl bg-white p-6 text-center"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p className="text-[40px] mb-3">⚖️</p>
          <p className="text-[17px] font-bold text-[#1c1c1e]">Déjà équilibré !</p>
          <p className="text-[13px] text-[#8e8e93] mt-1">
            L'écart entre les membres est inférieur à 10 points.
          </p>
        </div>
      )}

      {/* Suggestions */}
      {!isBalanced && suggestions.length === 0 && (
        <div className="mx-4 rounded-2xl bg-white p-6 text-center"
          style={{ boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <p className="text-[40px] mb-3">🤷</p>
          <p className="text-[17px] font-bold text-[#1c1c1e]">Aucune suggestion</p>
          <p className="text-[13px] text-[#8e8e93] mt-1">
            Assigne plus de tâches pour que Yova puisse analyser l'équilibre.
          </p>
        </div>
      )}

      {!isBalanced && suggestions.length > 0 && (
        <div className="px-4">
          <p className="text-[12px] font-bold text-[#8e8e93] uppercase tracking-wide mb-3 px-1">
            💡 Yova suggère ces transferts
          </p>
          <div className="space-y-3">
            {suggestions.map((s) => {
              const isApplied = applied.has(s.taskId);
              const isApplying = applying[s.taskId];
              return (
                <div key={s.taskId}
                  className="rounded-2xl bg-white overflow-hidden"
                  style={{
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    opacity: isApplied ? 0.6 : 1,
                  }}>

                  {/* Tâche */}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[15px] font-bold text-[#1c1c1e] leading-tight">{s.taskName}</p>
                        {s.categoryName && (
                          <p className="text-[12px] text-[#8e8e93] mt-0.5">{s.categoryName}</p>
                        )}
                      </div>
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full flex-shrink-0"
                        style={{ background: '#fff0f5', color: '#ff3b8a' }}>
                        -{s.impactPts} pts d'écart
                      </span>
                    </div>

                    {/* Flèche transfert */}
                    <div className="flex items-center gap-2 text-[13px]">
                      <span className="font-semibold px-2.5 py-1 rounded-xl"
                        style={{ background: '#fff2f2', color: '#ff3b30' }}>
                        {s.fromName}
                      </span>
                      <span className="text-[16px]" style={{ color: '#8e8e93' }}>→</span>
                      <span className="font-semibold px-2.5 py-1 rounded-xl"
                        style={{ background: '#f0fff4', color: '#34c759' }}>
                        {s.toName}
                      </span>
                    </div>
                  </div>

                  {/* Aperçu score après */}
                  <div className="px-4 py-3 flex items-center gap-4"
                    style={{ borderTop: '0.5px solid #f0f2f8', background: '#fafbff' }}>
                    <div className="flex-1 text-center">
                      <p className="text-[11px] text-[#8e8e93] mb-0.5">{s.fromName} après</p>
                      <p className="text-[18px] font-black" style={{ color: '#34c759' }}>{s.newFromScore}%</p>
                    </div>
                    <div className="text-[20px]">⚖️</div>
                    <div className="flex-1 text-center">
                      <p className="text-[11px] text-[#8e8e93] mb-0.5">{s.toName} après</p>
                      <p className="text-[18px] font-black" style={{ color: '#34c759' }}>{s.newToScore}%</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="px-4 pb-4 pt-2">
                    {isApplied ? (
                      <div className="w-full rounded-xl py-3 text-center text-[14px] font-bold"
                        style={{ background: '#f0fff4', color: '#34c759' }}>
                        ✓ Appliqué
                      </div>
                    ) : (
                      <button
                        onClick={() => applySwap(s)}
                        disabled={isApplying}
                        className="w-full rounded-xl py-3 text-[14px] font-bold text-white disabled:opacity-50"
                        style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
                        {isApplying ? 'Application…' : `Donner à ${s.toName} →`}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Note */}
          <p className="text-[11px] text-[#8e8e93] text-center mt-4 px-4 leading-relaxed">
            Ces suggestions ne modifient que l&apos;assignation — pas la fréquence ni la planification de la tâche.
          </p>
        </div>
      )}

      {/* Bouton retour dashboard */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3"
        style={{ background: 'linear-gradient(transparent, #f6f8ff 30%)' }}>
        <button
          onClick={() => router.push('/dashboard')}
          className="w-full rounded-2xl py-[16px] text-[17px] font-bold text-white"
          style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)', boxShadow: '0 8px 24px rgba(0,122,255,0.3)' }}>
          Voir le nouveau score →
        </button>
      </div>
    </div>
  );
}
