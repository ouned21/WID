'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';

const NAV_ITEMS = [
  { href: '/tasks', label: 'Tâches', icon: '✓' },
  { href: '/distribution', label: 'Répartition', icon: '⚖' },
  { href: '/profile', label: 'Profil', icon: '●' },
] as const;

/**
 * Layout pour les pages authentifiees.
 * - Initialise l'auth store et charge le foyer
 * - Affiche la navigation en bas (mobile) / sidebar (desktop)
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile, isInitialized, initialize } = useAuthStore();
  const { fetchHousehold, household } = useHouseholdStore();

  // Initialiser l'auth au montage
  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  // Charger le foyer quand le profil est pret
  useEffect(() => {
    if (profile?.household_id && !household) {
      fetchHousehold(profile.household_id);
    }
  }, [profile?.household_id, household, fetchHousehold]);

  // Ecran de chargement pendant l'initialisation
  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-slate-900">WID</h1>
            {household && (
              <p className="text-xs text-slate-500">{household.name}</p>
            )}
          </div>
        </div>
      </header>

      {/* Contenu principal */}
      <main className="flex-1 px-4 py-6">
        <div className="mx-auto max-w-3xl">{children}</div>
      </main>

      {/* Navigation bottom tabs */}
      <nav className="sticky bottom-0 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-slate-900'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
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
