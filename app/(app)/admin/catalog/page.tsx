'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { SCORING_CATEGORY_OPTIONS, DURATION_OPTIONS } from '@/utils/taskScoring';

type Stats = {
  total_templates: number;
  user_promoted_templates: number;
  total_promotions: number;
  pending_unprocessed: number;
  last_promotion: string | null;
};

type Template = {
  id: string;
  name: string;
  scoring_category: string;
  default_duration: string;
  default_frequency: string;
  description: string;
};

type Promotion = {
  id: string;
  name: string;
  promoted_at: string;
  household_count: number;
  ai_enriched: boolean;
  inferred_category: string;
  note: string | null;
  template: Template | null;
};

type Approaching = {
  name: string;
  household_count: number;
  latest: string;
};

type AdminData = {
  stats: Stats;
  promotions: Promotion[];
  approaching: Approaching[];
};

const CATEGORY_EMOJI: Record<string, string> = {
  cleaning: '🧹', tidying: '📦', shopping: '🛒', laundry: '👕',
  meals: '🍳', children: '👶', admin: '📋', transport: '🚗',
  household_management: '🏠', outdoor: '🌿', hygiene: '🚿',
  pets: '🐾', vehicle: '🚗', misc: '📌',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'aujourd\'hui';
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days}j`;
  if (days < 30) return `il y a ${Math.floor(days / 7)}sem`;
  return `il y a ${Math.floor(days / 30)}mois`;
}

export default function AdminCatalogPage() {
  const router = useRouter();
  const { user, isInitialized } = useAuthStore();
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/catalog');
    if (res.status === 403) { setError('accès_refusé'); setLoading(false); return; }
    if (!res.ok) { setError('erreur serveur'); setLoading(false); return; }
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    if (!user) { router.push('/dashboard'); return; }
    fetchData();
  }, [isInitialized, user, router, fetchData]);

  const handleDelete = async (promotionId: string, name: string) => {
    if (!confirm(`Rejeter "${name}" du catalogue ? Le template sera supprimé.`)) return;
    setDeletingId(promotionId);
    const res = await fetch(`/api/admin/catalog?id=${promotionId}`, { method: 'DELETE' });
    setDeletingId(null);
    if (res.ok) {
      showToast(`"${name}" rejeté`);
      fetchData();
    } else {
      showToast('Erreur lors de la suppression', false);
    }
  };

  const handleAction = async (action: 'promote' | 'enrich') => {
    setActionLoading(action);
    const res = await fetch(`/api/admin/catalog?action=${action}`, { method: 'POST' });
    const json = await res.json();
    setActionLoading(null);
    if (res.ok) {
      const msg = action === 'promote'
        ? `Promotion terminée — ${(json.results ?? []).filter((r: { action: string }) => r.action === 'promoted').length} nouveaux templates`
        : `Enrichissement terminé — ${json.enriched ?? 0} templates enrichis`;
      showToast(msg);
      fetchData();
    } else {
      showToast(json.error ?? 'Erreur', false);
    }
  };

  // ─── Accès refusé ─────────────────────────────────────────────────────────
  if (error === 'accès_refusé') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
        <div className="text-[48px] mb-4">🔒</div>
        <p className="text-[17px] font-semibold text-[#1c1c1e]">Accès réservé</p>
        <p className="text-[13px] text-[#8e8e93] mt-1">Configure ADMIN_EMAIL dans .env.local</p>
        <button onClick={() => router.back()} className="mt-6 text-[15px]" style={{ color: '#007aff' }}>← Retour</button>
      </div>
    );
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 rounded-full border-2 border-[#007aff] border-t-transparent animate-spin" />
      </div>
    );
  }

  const { stats, promotions, approaching } = data;
  const enrichedCount = promotions.filter(p => p.ai_enriched).length;
  const pendingEnrich = promotions.filter(p => !p.ai_enriched && p.template).length;

  return (
    <div className="pb-24">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-white text-[14px] font-medium shadow-lg"
          style={{ background: toast.ok ? '#34c759' : '#ff3b30', maxWidth: '80vw' }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-3">
        <button onClick={() => router.back()} style={{ color: '#007aff' }} className="text-[17px]">←</button>
        <div>
          <h1 className="text-[22px] font-bold text-[#1c1c1e]">Catalogue</h1>
          <p className="text-[12px] text-[#8e8e93]">Vue admin · accès privé</p>
        </div>
        <span className="ml-auto text-[20px]">🔧</span>
      </div>

      {/* Stats banner */}
      <div className="mx-4 mt-3 mb-4 grid grid-cols-2 gap-2">
        {[
          { label: 'Templates total', value: stats.total_templates, color: '#007aff' },
          { label: 'Promus utilisateurs', value: stats.user_promoted_templates, color: '#5856d6' },
          { label: 'Suggestions en attente', value: stats.pending_unprocessed, color: stats.pending_unprocessed > 50 ? '#ff9500' : '#34c759' },
          { label: 'Dernière promotion', value: stats.last_promotion ? timeAgo(stats.last_promotion) : 'jamais', color: '#8e8e93', small: true },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white px-4 py-3" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-[11px] text-[#8e8e93] uppercase tracking-wide mb-0.5">{s.label}</p>
            <p className={`font-bold ${s.small ? 'text-[15px]' : 'text-[22px]'}`} style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Actions manuelles */}
      <div className="mx-4 mb-5 flex gap-2">
        <button
          onClick={() => handleAction('promote')}
          disabled={!!actionLoading}
          className="flex-1 rounded-xl py-3 text-[14px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#007aff' }}
        >
          {actionLoading === 'promote' ? 'Promotion…' : '⚡ Promouvoir maintenant'}
        </button>
        <button
          onClick={() => handleAction('enrich')}
          disabled={!!actionLoading || pendingEnrich === 0}
          className="flex-1 rounded-xl py-3 text-[14px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#5856d6' }}
        >
          {actionLoading === 'enrich' ? 'IA en cours…' : `🤖 Enrichir IA (${pendingEnrich})`}
        </button>
      </div>

      {/* Suggestions en approche du seuil */}
      {approaching.length > 0 && (
        <div className="mx-4 mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#ff9500] mb-2 px-1">
            🔜 En approche — 1 foyer de plus = promotion
          </p>
          <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}>
            {approaching.map((a, i) => (
              <div
                key={i}
                className="px-4 py-3 flex items-center gap-3"
                style={i < approaching.length - 1 ? { borderBottom: '0.5px solid var(--ios-separator)' } : {}}
              >
                <span className="text-[18px]">📊</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-[#1c1c1e] font-medium truncate">{a.name}</p>
                  <p className="text-[11px] text-[#8e8e93]">{a.household_count} foyer · {timeAgo(a.latest)}</p>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ background: '#ff9500', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Promotions */}
      <div className="mx-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e8e93] mb-2 px-1">
          Promotions ({promotions.length})
          {enrichedCount > 0 && (
            <span className="ml-2 text-[#34c759]">· {enrichedCount} enrichis IA</span>
          )}
        </p>

        {promotions.length === 0 && (
          <div className="rounded-2xl bg-white px-4 py-8 text-center" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}>
            <p className="text-[15px] text-[#8e8e93]">Aucune promotion pour l'instant.</p>
            <p className="text-[12px] text-[#c7c7cc] mt-1">Le catalogue s'enrichira automatiquement chaque lundi.</p>
          </div>
        )}

        <div className="rounded-2xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.06)' }}>
          {promotions.map((p, i) => {
            const catOpt = SCORING_CATEGORY_OPTIONS.find(o => o.value === (p.template?.scoring_category ?? p.inferred_category));
            const durOpt = DURATION_OPTIONS.find(o => o.value === p.template?.default_duration);
            const isDeleting = deletingId === p.id;
            const isRejected = p.note?.includes('Rejeté');

            return (
              <div
                key={p.id}
                className="px-4 py-3 flex items-start gap-3"
                style={{
                  borderBottom: i < promotions.length - 1 ? '0.5px solid var(--ios-separator)' : 'none',
                  opacity: isRejected ? 0.45 : 1,
                }}
              >
                {/* Emoji catégorie */}
                <span className="text-[22px] flex-shrink-0 mt-0.5">
                  {catOpt?.emoji ?? CATEGORY_EMOJI[p.inferred_category] ?? '📌'}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Nom */}
                  <p className="text-[15px] font-semibold text-[#1c1c1e] truncate">
                    {p.template?.name ?? p.name}
                    {isRejected && <span className="ml-1 text-[11px] text-[#ff3b30]">rejeté</span>}
                  </p>

                  {/* Méta */}
                  <p className="text-[11px] text-[#8e8e93] mt-0.5">
                    {catOpt?.label ?? p.inferred_category}
                    {durOpt && ` · ${durOpt.label}`}
                    {p.template?.default_frequency && ` · ${p.template.default_frequency}`}
                  </p>

                  {/* Badges */}
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: '#EEF4FF', color: '#007aff' }}>
                      👥 {p.household_count} foyer{p.household_count > 1 ? 's' : ''}
                    </span>
                    {p.ai_enriched ? (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#e8fff0', color: '#34c759' }}>
                        ✓ IA enrichi
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: '#fff8e6', color: '#ff9500' }}>
                        ⏳ Enrichissement en attente
                      </span>
                    )}
                    <span className="text-[10px] text-[#c7c7cc]">{timeAgo(p.promoted_at)}</span>
                  </div>

                  {/* Description si dispo */}
                  {p.template?.description && !p.template.description.includes('en attente') && (
                    <p className="text-[11px] text-[#8e8e93] mt-1 italic">{p.template.description}</p>
                  )}
                </div>

                {/* Bouton rejeter */}
                {!isRejected && (
                  <button
                    onClick={() => handleDelete(p.id, p.template?.name ?? p.name)}
                    disabled={isDeleting}
                    className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full disabled:opacity-40"
                    style={{ background: '#fff2f2' }}
                  >
                    {isDeleting
                      ? <div className="w-3 h-3 border border-[#ff3b30] border-t-transparent rounded-full animate-spin" />
                      : <span className="text-[12px] text-[#ff3b30]">✕</span>
                    }
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Note de bas de page */}
      <p className="mx-4 mt-6 text-[11px] text-center text-[#c7c7cc]">
        Cron automatique · chaque lundi 3h00 (promotion) + 3h10 (enrichissement IA)
      </p>
    </div>
  );
}
