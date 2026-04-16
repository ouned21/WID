'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, loading, error, clearError, initialize, isInitialized } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [failCount, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    clearError();
    const result = await signIn(email, password);
    if (result.ok) {
      setFailCount(0);
      router.push('/dashboard');
    } else {
      const newCount = failCount + 1;
      setFailCount(newCount);
      if (newCount >= 5) {
        setLockedUntil(Date.now() + 30000); // Bloquer 30 secondes
        setTimeout(() => setLockedUntil(null), 30000);
      }
    }
  };

  return (
    <>
      <div className="text-center pt-8">
        <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] text-[32px] font-bold text-white mb-3" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
          A
        </div>
        <h1 className="text-[28px] font-bold text-[#1c1c1e]">Yova</h1>
        <p className="text-[15px] text-[#8e8e93]">L&apos;agent qui planifie ton foyer</p>
      </div>

      <form onSubmit={handleSubmit}>
        {isLocked && (
          <div className="rounded-xl px-4 py-3 text-[14px] mb-4" style={{ background: '#fff8e1', color: '#ff9500' }}>
            Trop de tentatives. Réessayez dans 30 secondes.
          </div>
        )}
        {error && !isLocked && (
          <div className="rounded-xl px-4 py-3 text-[14px] mb-4" style={{ background: '#fff2f2', color: '#ff3b30' }}>
            {error}
          </div>
        )}

        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="votre@email.com"
            />
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] text-[#8e8e93]">Mot de passe</label>
              <button type="button" onClick={() => setShowPw(!showPw)} className="text-[12px] font-medium" style={{ color: '#007aff' }}>
                {showPw ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || isLocked}
          className="w-full mt-4 rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#007aff' }}
        >
          {loading ? 'Connexion...' : 'Se connecter'}
        </button>
      </form>

      <p className="text-center text-[15px] text-[#8e8e93]">
        Pas encore de compte ?{' '}
        <a href="/register" className="font-semibold" style={{ color: '#007aff' }}>
          Créer un compte
        </a>
      </p>
    </>
  );
}
