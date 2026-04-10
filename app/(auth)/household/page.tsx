'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useHouseholdStore } from '@/stores/householdStore';

export default function HouseholdPage() {
  const router = useRouter();
  const { profile, initialize, isInitialized } = useAuthStore();
  const { createHousehold, joinHousehold, loading, error, clearError } = useHouseholdStore();

  const [mode, setMode] = useState<'choose' | 'create' | 'join'>('choose');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  useEffect(() => {
    if (profile?.household_id) router.push('/tasks');
  }, [profile?.household_id, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!householdName.trim()) return;
    const result = await createHousehold(householdName.trim());
    if (result.ok) router.push('/tasks');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!inviteCode.trim()) return;
    const result = await joinHousehold(inviteCode.trim());
    if (result.ok) router.push('/tasks');
  };

  return (
    <>
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-lg mb-4">
          W
        </div>
        <h1 className="text-2xl font-bold text-slate-900">
          Bienvenue, {profile?.display_name} !
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Créez un foyer ou rejoignez-en un existant
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {mode === 'choose' && (
        <div className="space-y-3">
          <button
            onClick={() => setMode('create')}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-3.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 shadow-sm transition-all"
          >
            Créer un foyer
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full rounded-xl border-2 border-indigo-200 bg-white py-3.5 text-sm font-semibold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
          >
            Rejoindre un foyer
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div>
            <label htmlFor="householdName" className="block text-sm font-semibold text-slate-700">
              Nom du foyer
            </label>
            <input
              id="householdName"
              type="text"
              required
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Maison Sia"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Création...' : 'Créer le foyer'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('choose'); clearError(); }}
            className="w-full text-sm text-slate-500 hover:text-indigo-600 font-medium"
          >
            ← Retour
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form onSubmit={handleJoin} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-semibold text-slate-700">
              Code d&apos;invitation
            </label>
            <input
              id="inviteCode"
              type="text"
              required
              maxLength={6}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-3 text-center text-xl font-mono font-bold tracking-[0.3em] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="XK3P9M"
              autoFocus
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 shadow-sm"
          >
            {loading ? 'Rejoindre...' : 'Rejoindre le foyer'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('choose'); clearError(); }}
            className="w-full text-sm text-slate-500 hover:text-indigo-600 font-medium"
          >
            ← Retour
          </button>
        </form>
      )}
    </>
  );
}
