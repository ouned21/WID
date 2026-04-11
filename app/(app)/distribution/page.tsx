'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAnalyticsStore } from '@/stores/analyticsStore';

type Period = 7 | 30 | 90;
const PERIODS: { value: Period; label: string }[] = [
  { value: 7, label: '7 j' },
  { value: 30, label: '30 j' },
  { value: 90, label: '90 j' },
];

const MEMBER_COLORS = ['#007aff', '#af52de', '#ff9500', '#34c759', '#ff3b30', '#5856d6'];

export default function DistributionPage() {
  const { profile } = useAuthStore();
  const { period, memberAnalytics, categoryBreakdown, loading, setPeriod, fetchAnalytics } = useAnalyticsStore();

  useEffect(() => {
    if (profile?.household_id) fetchAnalytics(profile.household_id);
  }, [profile?.household_id, fetchAnalytics]);

  const percentages = memberAnalytics.map((m) => m.taskPercentage);
  const maxPct = Math.max(...percentages, 0);
  const minPct = Math.min(...percentages, 0);
  const imbalance = maxPct - minPct;

  const badgeColor = imbalance <= 10 ? '#34c759' : imbalance <= 25 ? '#ff9500' : '#ff3b30';
  const badgeLabel = imbalance <= 10 ? 'Équilibré' : imbalance <= 25 ? 'Léger déséquilibre' : 'Déséquilibre';
  const totalCompletions = memberAnalytics.reduce((s, m) => s + m.taskCount, 0);

  return (
    <div className="pt-4 space-y-5">
      <div className="flex items-end justify-between px-4">
        <h2 className="text-[28px] font-bold text-[#1c1c1e]">Répartition</h2>
        {totalCompletions > 0 && (
          <span className="rounded-full px-3 py-1 text-[12px] font-semibold text-white" style={{ background: badgeColor }}>
            {badgeLabel}
          </span>
        )}
      </div>

      {/* Période */}
      <div className="mx-4 rounded-lg p-0.5 flex" style={{ background: '#e5e5ea' }}>
        {PERIODS.map((p) => (
          <button key={p.value} onClick={() => setPeriod(p.value)}
            className={`flex-1 rounded-md py-[6px] text-[13px] font-semibold transition-all ${
              period === p.value ? 'bg-white text-[#1c1c1e] shadow-sm' : 'text-[#8e8e93]'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
        </div>
      ) : totalCompletions === 0 ? (
        <div className="mx-4 rounded-2xl bg-white p-10 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <p className="text-[40px] mb-2">📊</p>
          <p className="text-[17px] font-semibold text-[#1c1c1e]">Aucune donnée</p>
          <p className="text-[15px] text-[#8e8e93] mt-1">Complétez des tâches pour voir la répartition</p>
        </div>
      ) : (
        <>
          {/* Score global */}
          <div className="mx-4 rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
            <p className="text-[13px] opacity-80">Tâches complétées — {period} jours</p>
            <p className="text-[40px] font-bold mt-1">{totalCompletions}</p>
          </div>

          {/* Par membre */}
          <div className="mx-4">
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Par membre</p>
            <div className="rounded-xl bg-white p-4 space-y-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
              {memberAnalytics.map((m, i) => {
                const color = MEMBER_COLORS[i % MEMBER_COLORS.length];
                return (
                  <div key={m.memberId} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white" style={{ background: color }}>
                          {m.displayName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-[15px] font-medium text-[#1c1c1e]">{m.displayName}</span>
                      </div>
                      <span className="text-[15px] font-bold" style={{ color }}>{m.taskPercentage}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full" style={{ background: '#f2f2f7' }}>
                      <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${m.taskPercentage}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Par catégorie */}
          {categoryBreakdown.length > 0 && (
            <div className="mx-4">
              <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2 px-1">Par catégorie</p>
              <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
                {categoryBreakdown.map((cat, i) => (
                  <div key={cat.categoryId}
                    className="flex items-center justify-between px-4 py-3"
                    style={i < categoryBreakdown.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}>
                    <div className="flex items-center gap-2.5">
                      <span className="h-3 w-3 rounded-full" style={{ background: cat.colorHex }} />
                      <span className="text-[15px] text-[#1c1c1e]">{cat.categoryName}</span>
                    </div>
                    <span className="text-[15px] font-semibold text-[#8e8e93]">{cat.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
