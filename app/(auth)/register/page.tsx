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
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [consentCgu, setConsentCgu] = useState(false);

  useEffect(() => {
    if (!isInitialized) initialize();
  }, [isInitialized, initialize]);

  const isPasswordStrong = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === passwordConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (displayName.trim().length < 2) return;
    if (!isPasswordStrong) return;
    if (!passwordsMatch) return;
    if (!consentCgu) return;
    const result = await signUp(email.trim().toLowerCase(), password, displayName.trim());
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
            Bienvenue ! Tu peux te connecter directement avec <strong className="text-[#1c1c1e]">{email.toLowerCase()}</strong>.
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
        <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] mb-3" style={{ background: 'linear-gradient(135deg, #007aff, #5856d6)' }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
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
            <input
              type="email" required
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc] lowercase"
              placeholder="votre@email.com"
            />
          </div>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid var(--ios-separator)' }}>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[13px] text-[#8e8e93]">Mot de passe</label>
              <button type="button" onClick={() => setShowPw(!showPw)} className="text-[12px] font-medium" style={{ color: '#007aff' }}>
                {showPw ? 'Masquer' : 'Afficher'}
              </button>
            </div>
            <input type={showPw ? 'text' : 'password'} required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]" placeholder="8 caractères minimum" />
            {password.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="flex gap-1">
                  {[
                    password.length >= 8,
                    /[A-Z]/.test(password),
                    /[0-9]/.test(password),
                    /[^A-Za-z0-9]/.test(password),
                  ].map((ok, i) => (
                    <div key={i} className="flex-1 h-1 rounded-full" style={{ background: ok ? '#34c759' : '#e5e5ea' }} />
                  ))}
                </div>
                <div className="text-[11px] text-[#8e8e93] space-y-0.5">
                  <p style={{ color: password.length >= 8 ? '#34c759' : '#8e8e93' }}>
                    {password.length >= 8 ? '✓' : '○'} 8 caractères minimum
                  </p>
                  <p style={{ color: /[A-Z]/.test(password) ? '#34c759' : '#8e8e93' }}>
                    {/[A-Z]/.test(password) ? '✓' : '○'} Une majuscule
                  </p>
                  <p style={{ color: /[0-9]/.test(password) ? '#34c759' : '#8e8e93' }}>
                    {/[0-9]/.test(password) ? '✓' : '○'} Un chiffre
                  </p>
                  <p style={{ color: /[^A-Za-z0-9]/.test(password) ? '#34c759' : '#8e8e93' }}>
                    {/[^A-Za-z0-9]/.test(password) ? '✓' : '○'} Un caractère spécial
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="px-4 py-3">
            <label className="text-[13px] text-[#8e8e93] block mb-1">Confirmer le mot de passe</label>
            <input
              type={showPw ? 'text' : 'password'}
              required
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="Retape le mot de passe"
            />
            {passwordConfirm.length > 0 && !passwordsMatch && (
              <p className="text-[11px] mt-1" style={{ color: '#ff3b30' }}>
                ✗ Les mots de passe ne correspondent pas
              </p>
            )}
            {passwordConfirm.length > 0 && passwordsMatch && (
              <p className="text-[11px] mt-1" style={{ color: '#34c759' }}>
                ✓ Les mots de passe correspondent
              </p>
            )}
          </div>
        </div>

        {/* Case consentement CGU */}
        <label className="flex items-center gap-3 mt-4 px-1 cursor-pointer">
          <input
            type="checkbox"
            checked={consentCgu}
            onChange={(e) => setConsentCgu(e.target.checked)}
            className="flex-shrink-0"
            style={{ width: 18, height: 18, accentColor: '#007aff' }}
          />
          <span className="text-[12px] text-[#8e8e93]">
            J&apos;accepte les{' '}
            <a href="/legal/cgu" target="_blank" className="font-semibold" style={{ color: '#007aff' }}>CGU</a>
            {' '}et la{' '}
            <a href="/legal/privacy" target="_blank" className="font-semibold" style={{ color: '#007aff' }}>confidentialité</a>
          </span>
        </label>

        <button type="submit" disabled={loading || !isPasswordStrong || !passwordsMatch || !consentCgu}
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
