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

  useEffect(() => { if (!isInitialized) initialize(); }, [isInitialized, initialize]);
  useEffect(() => { if (profile?.household_id) router.push('/dashboard'); }, [profile?.household_id, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault(); clearError();
    if (!householdName.trim()) return;
    const result = await createHousehold(householdName.trim());
    if (result.ok) router.push('/dashboard');
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault(); clearError();
    if (!inviteCode.trim()) return;
    const result = await joinHousehold(inviteCode.trim());
    if (result.ok) router.push('/dashboard');
  };

  return (
    <>
      <div className="text-center pt-8">
        <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] text-[32px] font-bold text-white mb-3" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
          FS
        </div>
        <h1 className="text-[22px] font-bold text-[#1c1c1e]">
          Bienvenue{profile?.display_name ? `, ${profile.display_name}` : ''} !
        </h1>
        <p className="text-[15px] text-[#8e8e93]">Créez un foyer ou rejoignez-en un existant</p>
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-[14px]" style={{ background: '#fff2f2', color: '#ff3b30' }}>{error}</div>
      )}

      {mode === 'choose' && (
        <div className="space-y-3">
          <button onClick={() => setMode('create')}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white" style={{ background: '#007aff' }}>
            Créer un foyer
          </button>
          <button onClick={() => setMode('join')}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold"
            style={{ background: 'white', color: '#007aff', boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            Rejoindre un foyer
          </button>
        </div>
      )}

      {mode === 'create' && (
        <form onSubmit={handleCreate}>
          <div className="rounded-xl bg-white overflow-hidden mb-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-3">
              <label className="text-[13px] text-[#8e8e93] block mb-1">Nom du foyer</label>
              <input type="text" required value={householdName} onChange={(e) => setHouseholdName(e.target.value)}
                className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
                placeholder="Maison Sia" autoFocus />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50" style={{ background: '#007aff' }}>
            {loading ? 'Création...' : 'Créer le foyer'}
          </button>
          <button type="button" onClick={() => { setMode('choose'); clearError(); }}
            className="w-full mt-3 text-[15px] font-medium" style={{ color: '#007aff' }}>
            ← Retour
          </button>
        </form>
      )}

      {mode === 'join' && (
        <form onSubmit={handleJoin}>
          <div className="rounded-xl bg-white overflow-hidden mb-4" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
            <div className="px-4 py-4">
              <label className="text-[13px] text-[#8e8e93] block mb-2">Code d&apos;invitation</label>
              <input type="text" required maxLength={6} value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                className="w-full text-center text-[28px] font-mono font-bold tracking-[0.4em] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
                placeholder="XK3P9M" autoFocus />
            </div>
          </div>
          <button type="submit" disabled={loading}
            className="w-full rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50" style={{ background: '#007aff' }}>
            {loading ? 'Rejoindre...' : 'Rejoindre le foyer'}
          </button>
          <button type="button" onClick={() => { setMode('choose'); clearError(); }}
            className="w-full mt-3 text-[15px] font-medium" style={{ color: '#007aff' }}>
            ← Retour
          </button>
        </form>
      )}
    </>
  );
}
