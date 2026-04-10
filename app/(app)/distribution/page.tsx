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

  const percentages = memberAnalytics.map((m) => m.taskPercentage);
  const maxPct = Math.max(...percentages, 0);
  const minPct = Math.min(...percentages, 0);
  const imbalance = maxPct - minPct;

  const badgeColor =
    imbalance <= 10 ? 'bg-emerald-100 text-emerald-700' :
    imbalance <= 25 ? 'bg-amber-100 text-amber-700' :
    'bg-red-100 text-red-700';

  const badgeLabel =
    imbalance <= 10 ? 'Équilibré' :
    imbalance <= 25 ? 'Léger déséquilibre' :
    'Déséquilibre important';

  const totalCompletions = memberAnalytics.reduce((s, m) => s + m.taskCount, 0);

  // Couleurs pour les membres
  const memberColors = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">Répartition</h2>
        {totalCompletions > 0 && (
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeColor}`}>
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Sélecteur de période */}
      <div className="flex gap-2">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${
              period === p.value
                ? 'bg-violet-600 text-white shadow-sm'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
        </div>
      ) : totalCompletions === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-lg font-semibold text-slate-400">Aucune donnée</p>
          <p className="mt-1 text-sm text-slate-400">
            Complétez des tâches pour voir la répartition
          </p>
        </div>
      ) : (
        <>
          {/* Score global */}
          <section className="rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 p-5 text-white shadow-md">
            <p className="text-sm text-violet-200 font-medium">
              Tâches complétées sur {period} jours
            </p>
            <p className="text-4xl font-bold mt-1">{totalCompletions}</p>
          </section>

          {/* Barres par membre */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
              Par membre
            </h3>
            {memberAnalytics.map((m, i) => {
              const color = memberColors[i % memberColors.length];
              return (
                <div key={m.memberId} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold text-white"
                        style={{ backgroundColor: color }}
                      >
                        {m.displayName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-slate-900">{m.displayName}</span>
                    </div>
                    <span className="font-bold" style={{ color }}>
                      {m.taskCount} — {m.taskPercentage}%
                    </span>
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-100">
                    <div
                      className="h-3 rounded-full transition-all duration-700"
                      style={{ width: `${m.taskPercentage}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </section>

          {/* Breakdown par catégorie */}
          {categoryBreakdown.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">
                Par catégorie
              </h3>
              {categoryBreakdown.map((cat) => (
                <div key={cat.categoryId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: cat.colorHex }}
                    />
                    <span className="text-sm font-medium text-slate-900">{cat.categoryName}</span>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                    style={{ backgroundColor: cat.colorHex }}
                  >
                    {cat.count}
                  </span>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
