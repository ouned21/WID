'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function RegisterPage() {
  const router = useRouter();
  const { signUp, loading, error, clearError, initialize, isInitialized } = useAuthStore();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (displayName.trim().length < 2) return;
    const result = await signUp(email, password, displayName.trim());
    if (result.ok) setSuccess(true);
  };

  if (success) {
    return (
      <>
        <div className="text-center pt-8">
          <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] text-[32px] text-white mb-3" style={{ background: '#34c759' }}>
            ✓
          </div>
          <h1 className="text-[28px] font-bold text-[#1c1c1e]">Compte créé</h1>
          <p className="mt-2 text-[15px] text-[#8e8e93] max-w-[300px] mx-auto">
            Un email de confirmation a été envoyé à <strong className="text-[#1c1c1e]">{email}</strong>. Vérifiez votre boîte mail puis connectez-vous.
          </p>
        </div>
        <a
          href="/login"
          className="block w-full rounded-xl py-[14px] text-center text-[17px] font-semibold text-white"
          style={{ background: '#007aff' }}
        >
          Se connecter
        </a>
      </>
    );
  }

  return (
    <>
      <div className="text-center pt-8">
        <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] text-[32px] font-bold text-white mb-3" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
          TL
        </div>
        <h1 className="text-[28px] font-bold text-[#1c1c1e]">Créer un compte</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div className="rounded-xl px-4 py-3 text-[14px] mb-4" style={{ background: '#fff2f2', color: '#ff3b30' }}>
            {error}
          </div>
        )}

        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Prénom</label>
            <input type="text" required minLength={2} value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]" placeholder="Jonathan" />
          </div>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]" placeholder="votre@email.com" />
          </div>
          <div className="px-4 py-3">
            <label className="text-[13px] text-[#8e8e93] block mb-1">Mot de passe</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]" placeholder="6 caractères minimum" />
          </div>
        </div>

        <button type="submit" disabled={loading}
          className="w-full mt-4 rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50" style={{ background: '#007aff' }}>
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>

      <p className="text-center text-[15px] text-[#8e8e93]">
        Déjà un compte ?{' '}
        <a href="/login" className="font-semibold" style={{ color: '#007aff' }}>Se connecter</a>
      </p>
    </>
  );
}
