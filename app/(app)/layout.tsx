'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';
import { useTaskNotifications } from '@/utils/useTaskNotifications';
import { initRealtime, stopRealtime } from '@/stores/realtimeStore';
import { requestNotificationPermission, scheduleEveningRecap, scheduleDraftReminders } from '@/utils/pushNotifications';

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
  { href: '/planning', label: 'Planning', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )},
  { href: '/profile', label: 'Profil', icon: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" viewBox="0 0 24 24">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  )},
] as const;

const DRAFT_KEY = 'fairshare_task_draft';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile, isInitialized, initialize } = useAuthStore();
  const { fetchHousehold, household } = useHouseholdStore();

  // FAB + : création rapide avec brouillon
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickName, setQuickName] = useState('');

  // Charger un brouillon existant au montage
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) setQuickName(draft);
  }, []);

  const handleQuickSubmit = useCallback(() => {
    if (quickName.trim()) {
      // Sauvegarder comme brouillon et ouvrir le formulaire complet
      localStorage.setItem(DRAFT_KEY, quickName.trim());
      setShowQuickAdd(false);
      router.push(`/tasks/new?draft=${encodeURIComponent(quickName.trim())}`);
    }
  }, [quickName, router]);

  const handleQuickClose = useCallback(() => {
    if (quickName.trim()) {
      // Sauvegarder le brouillon
      localStorage.setItem(DRAFT_KEY, quickName.trim());
    }
    setShowQuickAdd(false);
    setQuickName('');
  }, [quickName]);

  // Ne pas afficher le FAB sur la page de création
  const showFab = !pathname.startsWith('/tasks/new');

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

  // Service Worker + Notifications push
  useEffect(() => {
    // Enregistrer le service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('[sw] Registration failed:', err);
      });
    }

    // Notifications push (récap 21h + rappels brouillons)
    requestNotificationPermission().then((granted) => {
      if (granted) {
        scheduleEveningRecap();
        scheduleDraftReminders();
      }
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
      {/* Avatar flottant (remplace le header complet) */}
      <Link
        href="/profile"
        className="fixed top-3 right-3 z-40 flex h-10 w-10 items-center justify-center rounded-full text-[15px] font-semibold text-white"
        style={{ background: '#007aff', boxShadow: '0 2px 8px rgba(0,122,255,0.3)' }}
        aria-label={`Profil de ${profile?.display_name ?? 'utilisateur'}`}
      >
        {profile?.display_name?.charAt(0)?.toUpperCase() ?? '?'}
      </Link>

      {/* Contenu */}
      <main className="flex-1 px-4 pt-6 pb-28">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>

      {/* Quick Add overlay */}
      {showQuickAdd && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center" onClick={handleQuickClose}>
          <div className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-lg mx-4 mb-24 rounded-2xl bg-white p-4" onClick={(e) => e.stopPropagation()}
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <p className="text-[13px] font-semibold text-[#8e8e93] uppercase tracking-wide mb-2">Nouvelle tâche</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleQuickSubmit(); }}
                autoFocus
                className="flex-1 rounded-xl px-4 py-3 text-[17px] text-[#1c1c1e] outline-none"
                style={{ background: '#f0f2f8' }}
                placeholder="Ex : Préparer le dîner"
              />
              <button onClick={handleQuickSubmit}
                disabled={!quickName.trim()}
                className="rounded-xl px-4 py-3 text-[15px] font-bold text-white disabled:opacity-40"
                style={{ background: '#007aff' }}>
                →
              </button>
            </div>
            <p className="text-[11px] text-[#c7c7cc] mt-2">Tape le nom, on complète le reste ensuite</p>
          </div>
        </div>
      )}

      {/* FAB + */}
      {showFab && !showQuickAdd && (
        <button
          onClick={() => setShowQuickAdd(true)}
          className="fixed z-[55] flex items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-90"
          style={{
            width: 56, height: 56,
            bottom: 100, right: 20,
            background: '#007aff',
            boxShadow: '0 4px 16px rgba(0,122,255,0.4)',
          }}
          aria-label="Ajouter une tâche"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" viewBox="0 0 24 24">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

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
