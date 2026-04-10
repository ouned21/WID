'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

type Period = 7 | 30 | 90;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 jours' },
  { value: 30, label: '30 jours' },
  { value: 90, label: '90 jours' },
];

export default function DistributionPage() {
  const { profile } = useAuthStore();
  const {
    period,
    memberAnalytics,
    categoryBreakdown,
    loading,
    setPeriod,
    fetchAnalytics,
  } = useAnalyticsStore();

  useEffect(() => {
    if (profile?.household_id) {
      fetchAnalytics(profile.household_id);
    }
  }, [profile?.household_id, fetchAnalytics]);

  // Badge desequilibre
  const percentages = memberAnalytics.map((m) => m.taskPercentage);
  const maxPct = Math.max(...percentages, 0);
  const minPct = Math.min(...percentages, 0);
  const imbalance = maxPct - minPct;

  const badgeColor =
    imbalance <= 10 ? 'bg-green-100 text-green-700' :
    imbalance <= 25 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';

  const badgeLabel =
    imbalance <= 10 ? 'Équilibré' :
    imbalance <= 25 ? 'Léger déséquilibre' :
    'Déséquilibre important';

  const totalCompletions = memberAnalytics.reduce((s, m) => s + m.taskCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Répartition</h2>
        {totalCompletions > 0 && (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeColor}`}>
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Selecteur de periode */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              period === p.value
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Chargement...</p>
      ) : totalCompletions === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          Aucune tâche complétée sur cette période.
          <br />
          Complétez des tâches pour voir la répartition.
        </div>
      ) : (
        <>
          {/* Barres par membre */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
              Par membre
            </h3>
            {memberAnalytics.map((m) => (
              <div key={m.memberId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">{m.displayName}</span>
                  <span className="text-slate-500">
                    {m.taskCount} tache{m.taskCount > 1 ? 's' : ''} — {m.taskPercentage}%
                  </span>
                </div>
                <div className="h-3 w-full rounded-full bg-slate-100">
                  <div
                    className="h-3 rounded-full bg-slate-900 transition-all duration-500"
                    style={{ width: `${m.taskPercentage}%` }}
                  />
                </div>
              </div>
            ))}
          </section>

          {/* Breakdown par categorie */}
          {categoryBreakdown.length > 0 && (
            <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
                Par categorie
              </h3>
              {categoryBreakdown.map((cat) => (
                <div key={cat.categoryId} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.colorHex }}
                    />
                    <span className="text-slate-900">{cat.categoryName}</span>
                  </div>
                  <span className="text-slate-500">{cat.count}</span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
