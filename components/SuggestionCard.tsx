'use client';

import { useState } from 'react';

export type Suggestion = {
  id: string | null;
  name: string;
  reason: string;
  scoring_category: string | null;
  template_id: string | null;
};

type SuggestionCardProps = {
  suggestion: Suggestion;
  onAccept: () => void;
  onDismiss: () => void;
};

const CATEGORY_EMOJI: Record<string, string> = {
  cleaning: '🧹',
  meals: '🍳',
  shopping: '🛒',
  laundry: '👕',
  children: '👧',
  admin: '📋',
  outdoor: '🌿',
  transport: '🚗',
  household_management: '🏠',
  hygiene: '🚿',
  pets: '🐾',
  misc: '✨',
};

export default function SuggestionCard({ suggestion, onAccept, onDismiss }: SuggestionCardProps) {
  const [loading, setLoading] = useState(false);

  const emoji = suggestion.scoring_category
    ? (CATEGORY_EMOJI[suggestion.scoring_category] ?? '✨')
    : '✨';

  const handleAccept = async () => {
    setLoading(true);
    onAccept(); // Masque la carte immédiatement (optimistic)
    if (suggestion.id) {
      fetch(`/api/suggestions/${suggestion.id}/accept`, { method: 'PATCH' })
        .then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            console.error('[SuggestionCard] accept failed:', body.error ?? r.status);
          }
        })
        .catch((e) => console.error('[SuggestionCard] accept network error:', e));
    }
  };

  const handleDismiss = async () => {
    setLoading(true);
    onDismiss(); // Masque la carte immédiatement (optimistic)
    if (suggestion.id) {
      fetch(`/api/suggestions/${suggestion.id}/dismiss`, { method: 'PATCH' })
        .then(async (r) => {
          if (!r.ok) {
            const body = await r.json().catch(() => ({}));
            console.error('[SuggestionCard] dismiss failed:', body.error ?? r.status);
          }
        })
        .catch((e) => console.error('[SuggestionCard] dismiss network error:', e));
    }
  };

  return (
    <div
      className="mx-4 rounded-2xl bg-white p-4"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
    >
      {/* En-tête */}
      <p className="text-[11px] font-bold text-[#8e8e93] uppercase tracking-[0.15em] mb-3">
        💡 Yova suggère
      </p>

      {/* Corps */}
      <div className="flex items-start gap-3 mb-4">
        <span className="text-[22px] flex-shrink-0 mt-0.5">{emoji}</span>
        <div>
          <p className="text-[17px] font-semibold text-[#1c1c1e] leading-snug">{suggestion.name}</p>
          <p className="text-[13px] mt-1 leading-relaxed" style={{ color: '#8e8e93' }}>
            {suggestion.reason}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="rounded-xl py-2.5 px-4 text-[15px] font-semibold text-white"
          style={{ background: '#007aff', opacity: loading ? 0.6 : 1 }}
        >
          + Ajouter
        </button>
        <button
          onClick={handleDismiss}
          disabled={loading}
          className="text-[14px]"
          style={{ color: '#8e8e93', opacity: loading ? 0.6 : 1 }}
        >
          Pas maintenant
        </button>
      </div>
    </div>
  );
}
