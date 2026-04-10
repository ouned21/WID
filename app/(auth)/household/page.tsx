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

  // Redirect si l'utilisateur a deja un foyer
  useEffect(() => {
    if (profile?.household_id) {
      router.push('/tasks');
    }
  }, [profile?.household_id, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!householdName.trim()) return;

    const result = await createHousehold(householdName.trim());
    if (result.ok) {
      router.push('/tasks');
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!inviteCode.trim()) return;

    const result = await joinHousehold(inviteCode.trim());
    if (result.ok) {
      router.push('/tasks');
    }
  };

  return (
    <>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900">Bienvenue, {profile?.display_name}</h1>
        <p className="mt-2 text-sm text-slate-500">
          Créez un foyer ou rejoignez-en un existant
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {mode === 'choose' && (
        <div className="space-y-3">
          <button
            onClick={() => setMode('create')}
            className="w-full rounded-lg bg-slate-900 py-3 text-sm font-medium text-white hover:bg-slate-800"
          >
            Créer un foyer
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full rounded-lg border border-slate-300 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Rejoindre un foyer
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="householdName" className="block text-sm font-medium text-slate-700">
              Nom du foyer
            </label>
            <input
              id="householdName"
              type="text"
              required
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="Maison Sia"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Création...' : 'Créer le foyer'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('choose'); clearError(); }}
            className="w-full text-sm text-slate-500 hover:text-slate-700"
          >
            Retour
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form onSubmit={handleJoin} className="space-y-4">
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-slate-700">
              Code d&apos;invitation
            </label>
            <input
              id="inviteCode"
              type="text"
              required
              maxLength={6}
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-center text-lg font-mono tracking-widest shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              placeholder="XK3P9M"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {loading ? 'Rejoindre...' : 'Rejoindre le foyer'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('choose'); clearError(); }}
            className="w-full text-sm text-slate-500 hover:text-slate-700"
          >
            Retour
          </button>
        </form>
      )}
    </>
  );
}
