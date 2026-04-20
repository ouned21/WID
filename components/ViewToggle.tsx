'use client';

/**
 * Toggle entre la vue Liste (/tasks) et la vue Planning (/planning).
 * Utilisé en haut des deux pages pour leur faire partager un onglet
 * unique "À faire" dans la nav principale.
 */

import Link from 'next/link';

type Mode = 'list' | 'planning';

export default function ViewToggle({ mode }: { mode: Mode }) {
  return (
    <div
      className="mx-4 mb-3 flex rounded-xl p-0.5"
      style={{ background: '#e5e5ea' }}
      role="tablist"
      aria-label="Vue"
    >
      <Link
        href="/tasks"
        className="flex-1 rounded-lg py-[6px] text-center text-[13px] font-semibold transition-all"
        style={mode === 'list'
          ? { background: 'white', color: '#1c1c1e', boxShadow: '0 0.5px 2px rgba(0,0,0,0.08)' }
          : { color: '#8e8e93' }}
        role="tab"
        aria-selected={mode === 'list'}
      >
        📋 Liste
      </Link>
      <Link
        href="/planning"
        className="flex-1 rounded-lg py-[6px] text-center text-[13px] font-semibold transition-all"
        style={mode === 'planning'
          ? { background: 'white', color: '#1c1c1e', boxShadow: '0 0.5px 2px rgba(0,0,0,0.08)' }
          : { color: '#8e8e93' }}
        role="tab"
        aria-selected={mode === 'planning'}
      >
        📅 Planning
      </Link>
    </div>
  );
}
