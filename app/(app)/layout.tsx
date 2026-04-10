'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';

const NAV_ITEMS = [
  { href: '/tasks', label: 'Tâches', icon: '✓', activeColor: 'text-indigo-600' },
  { href: '/distribution', label: 'Répartition', icon: '⚖', activeColor: 'text-violet-600' },
  { href: '/profile', label: 'Profil', icon: '●', activeColor: 'text-emerald-600' },
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, isInitialized, initialize } = useAuthStore();
  const { fetchHousehold, household } = useHouseholdStore();

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (profile?.household_id && !household) {
      fetchHousehold(profile.household_id);
    }
  }, [profile?.household_id, household, fetchHousehold]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-white">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-indigo-50/30">
      {/* Header avec gradient */}
      <header className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 shadow-lg">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">WID</h1>
            {household && (
              <p className="text-xs text-indigo-200">{household.name}</p>
            )}
          </div>
          <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white">
            {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>

      {/* Navigation bottom tabs */}
      <nav className="sticky bottom-0 border-t border-slate-200 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-3xl">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold transition-colors ${
                  isActive
                    ? item.activeColor
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-current" />
                )}
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
