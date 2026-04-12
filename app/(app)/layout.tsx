'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useTaskNotifications } from '@/utils/useTaskNotifications';
import { initRealtime, stopRealtime } from '@/stores/realtimeStore';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Accueil', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
      <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
    </svg>
  )},
  { href: '/tasks', label: 'Tâches', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
      <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  )},
  { href: '/boost', label: 'Boost', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  )},
  { href: '/profile', label: 'Profil', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )},
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

  // Planifier les notifications pour les tâches du jour
  useTaskNotifications();

  // Activer Supabase Realtime pour le foyer
  useEffect(() => {
    if (profile?.household_id) {
      initRealtime(profile.household_id);
    }
    return () => stopRealtime();
  }, [profile?.household_id]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#f6f8ff' }}>
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col" style={{ background: '#f6f8ff' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b" style={{ borderColor: 'rgba(60,60,67,0.12)' }}>
        <div className="mx-auto max-w-lg px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-[17px] font-semibold text-[#1c1c1e]">FairShare</h1>
            {household && (
              <p className="text-[13px] text-[#8e8e93]">{household.name}</p>
            )}
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-white"
            style={{ background: '#007aff' }}
            role="img"
            aria-label={`Avatar de ${profile?.display_name ?? 'utilisateur'}`}
          >
            {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="flex-1 px-4 pt-2 pb-28">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>

      {/* Floating tab bar */}
      <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-lg rounded-[22px] bg-white/92 backdrop-blur-xl" style={{
        boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
      }}>
        <div className="flex">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-all"
                style={{ color: isActive ? '#007aff' : '#b0b0b8' }}
              >
                <div style={{ transform: isActive ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.2s' }}>
                  {item.icon}
                </div>
                <span>{item.label}</span>
                {isActive && <span className="h-1 w-1 rounded-full" style={{ background: '#007aff' }} />}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
