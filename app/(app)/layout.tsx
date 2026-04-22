'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useTaskNotifications } from '@/utils/useTaskNotifications';
import { initRealtime, stopRealtime } from '@/stores/realtimeStore';
import { requestNotificationPermission, scheduleEveningRecap } from '@/utils/pushNotifications';

// Nav 3 onglets V1 : Aujourd'hui · Parler à Yova (centre) · Foyer
// Ordre par fréquence d'usage : Aujourd'hui (1-3x/j) · Yova (3-8x/j, centre = pouce) · Foyer (hebdo)
const NAV_ITEMS = [
  { href: '/today', matches: ['/today', '/week'], label: "Aujourd'hui", icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )},
  { href: '/journal', matches: ['/journal'], label: 'Parler à Yova', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )},
  { href: '/family', matches: ['/family'], label: 'Foyer', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )},
] as const;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isInitialized, initialize } = useAuthStore();
  const { fetchHousehold, household } = useHouseholdStore();

  const isOnboarding = pathname.startsWith('/onboarding');

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (profile?.household_id && !household) {
      fetchHousehold(profile.household_id);
    }
  }, [profile?.household_id, household, fetchHousehold]);

  // Rediriger vers l'onboarding si le profil est chargé mais sans foyer
  useEffect(() => {
    if (!isInitialized) return;
    if (!profile) return;
    if (isOnboarding) return;
    if (!profile.household_id) {
      router.replace('/onboarding');
    }
  }, [isInitialized, profile, isOnboarding, router]);

  // Planifier les notifications pour les tâches du jour
  useTaskNotifications();

  // Service Worker + Notifications push
  useEffect(() => {
    // Enregistrer le service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[sw] Registration failed:', err);
      });
    }

    // Notifications push (récap 21h → /journal)
    requestNotificationPermission().then((granted) => {
      if (granted) scheduleEveningRecap();
    });
  }, []);

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
      {/* Avatar flottant — masqué pendant l'onboarding */}
      {!isOnboarding && (
        <Link
          href="/profile"
          className="fixed top-3 right-3 z-40 flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold text-white"
          style={{ background: '#007aff', boxShadow: '0 2px 8px rgba(0,122,255,0.3)' }}
          aria-label={`Profil de ${profile?.display_name ?? 'utilisateur'}`}
        >
          {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
        </Link>
      )}

      {/* Contenu */}
      <main className="flex-1 px-4 pt-6 pb-28">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>

      {/* Floating tab bar — masquée pendant l'onboarding */}
      {!isOnboarding && <nav className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-32px)] max-w-lg rounded-[22px] bg-white/92 backdrop-blur-xl" style={{
        boxShadow: '0 8px 32px rgba(15,23,42,0.12), 0 2px 8px rgba(15,23,42,0.06)',
      }}>
        <div className="flex items-end">
          {NAV_ITEMS.map((item, idx) => {
            const isActive = item.matches.some((m) => pathname.startsWith(m));
            const isCenter = idx === 1; // "Parler à Yova" — position centrale

            if (isCenter) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex flex-1 flex-col items-center gap-0.5 pb-2.5 -mt-4 transition-all"
                >
                  {/* Bulle surélevée */}
                  <div
                    className="flex items-center justify-center rounded-full text-white transition-transform active:scale-90"
                    style={{
                      width: 52, height: 52,
                      background: isActive
                        ? 'linear-gradient(135deg, #5856d6, #007aff)'
                        : 'linear-gradient(135deg, #667eea, #764ba2)',
                      boxShadow: '0 4px 14px rgba(102,126,234,0.45)',
                    }}
                  >
                    {item.icon}
                  </div>
                  <span
                    className="text-[10px] font-semibold"
                    style={{ color: isActive ? '#5856d6' : '#b0b0b8' }}
                  >
                    {item.label}
                  </span>
                  {isActive && <span className="h-1 w-1 rounded-full" style={{ background: '#5856d6' }} />}
                </Link>
              );
            }

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
      </nav>}
    </div>
  );
}
