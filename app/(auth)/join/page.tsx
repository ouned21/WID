'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

// ── Inner component (uses useSearchParams) ─────────────────────────────────

function JoinPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get('code')?.trim().toUpperCase() ?? '';

  const { signUp, signIn, refreshProfile, loading, error, clearError } = useAuthStore();

  // Infos du foyer
  const [preview, setPreview] = useState<{ householdName: string; inviterName: string } | null>(null);
  const [previewError, setPreviewError] = useState('');

  // Formulaire
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [step, setStep] = useState<'form' | 'joining' | 'done'>('form');
  const [joinError, setJoinError] = useState('');

  const isPasswordStrong = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);

  // ── Charger le preview du foyer ──
  useEffect(() => {
    if (!code) {
      setPreviewError('Lien d\'invitation invalide.');
      return;
    }
    fetch(`/api/household/join?code=${code}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setPreview(data);
        else setPreviewError(data.error ?? 'Invitation introuvable.');
      })
      .catch(() => setPreviewError('Impossible de vérifier l\'invitation.'));
  }, [code]);

  // ── Soumettre ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setJoinError('');
    if (!displayName.trim() || !isPasswordStrong) return;

    setStep('joining');

    // 1. Créer le compte
    const signUpResult = await signUp(email.trim().toLowerCase(), password, displayName.trim());
    if (!signUpResult.ok) {
      setStep('form');
      return; // L'erreur est dans le store
    }

    // 2. Se connecter pour établir la session
    const signInResult = await signIn(email.trim().toLowerCase(), password);
    if (!signInResult.ok) {
      setStep('form');
      setJoinError('Compte créé mais connexion échouée. Essaie de te connecter manuellement.');
      return;
    }

    // 3. Rafraîchir le profil (s'assure que le trigger a bien créé le profil)
    await refreshProfile();

    // 4. Accepter l'invitation
    const joinRes = await fetch('/api/household/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const joinData = await joinRes.json();

    if (!joinRes.ok || !joinData.ok) {
      setStep('form');
      setJoinError(joinData.error ?? 'Erreur lors de la rejoindre le foyer.');
      return;
    }

    // 5. Rafraîchir le profil avec le nouveau household_id
    await refreshProfile();

    setStep('done');
    // → Onboarding pour voir/ajuster ce que Jonathan a déjà configuré
    setTimeout(() => router.push('/onboarding'), 1200);
  };

  // ── États ──

  if (previewError) {
    return (
      <>
        <div className="text-center pt-8">
          <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] text-[32px] mb-3" style={{ background: '#fff2f2' }}>
            ⚠️
          </div>
          <h1 className="text-[24px] font-bold text-[#1c1c1e]">Invitation invalide</h1>
          <p className="mt-2 text-[15px] text-[#8e8e93]">{previewError}</p>
        </div>
        <a href="/login" className="block w-full rounded-xl py-[14px] text-center text-[17px] font-semibold text-white" style={{ background: '#007aff' }}>
          Se connecter
        </a>
      </>
    );
  }

  if (step === 'done') {
    return (
      <div className="text-center pt-12">
        <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] text-[32px] text-white mb-3" style={{ background: '#34c759' }}>
          ✓
        </div>
        <h1 className="text-[28px] font-bold text-[#1c1c1e]">Bienvenue !</h1>
        <p className="mt-2 text-[15px] text-[#8e8e93]">Tu rejoins le foyer de {preview?.inviterName} — configuration en cours…</p>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    );
  }

  return (
    <>
      {/* En-tête invitation */}
      <div className="text-center pt-8">
        <div className="inline-flex h-[72px] w-[72px] items-center justify-center rounded-[20px] text-[32px] mb-3"
          style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' }}>
          <span className="text-[28px] font-bold text-white">Y</span>
        </div>
        <p className="text-[15px] text-[#8e8e93]">
          <strong className="text-[#1c1c1e]">{preview.inviterName}</strong> t&apos;invite à rejoindre
        </p>
        <h1 className="text-[26px] font-bold text-[#1c1c1e] mt-1">{preview.householdName}</h1>
        <p className="text-[13px] text-[#8e8e93] mt-1">sur Yova — l&apos;assistant de votre foyer</p>
      </div>

      {/* Formulaire */}
      <form onSubmit={handleSubmit}>
        {(error || joinError) && (
          <div className="rounded-xl px-4 py-3 text-[14px] mb-4" style={{ background: '#fff2f2', color: '#ff3b30' }}>
            {error || joinError}
          </div>
        )}

        <div className="rounded-xl bg-white overflow-hidden" style={{ boxShadow: '0 0.5px 3px rgba(0,0,0,0.04)' }}>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid #e5e5ea' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Ton prénom</label>
            <input
              type="text" required minLength={2}
              value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="Barbara"
            />
          </div>
          <div className="px-4 py-3" style={{ borderBottom: '0.5px solid #e5e5ea' }}>
            <label className="text-[13px] text-[#8e8e93] block mb-1">Email</label>
            <input
              type="email" required
              autoCapitalize="none" autoCorrect="off" spellCheck={false}
              value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc] lowercase"
              placeholder="ton@email.com"
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
              required minLength={8}
              autoComplete="new-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full text-[17px] text-[#1c1c1e] bg-transparent outline-none placeholder:text-[#c7c7cc]"
              placeholder="8 caractères min, 1 majuscule, 1 chiffre"
            />
            {password.length > 0 && (
              <div className="flex gap-1 mt-2">
                {[password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password)].map((ok, i) => (
                  <div key={i} className="flex-1 h-1 rounded-full" style={{ background: ok ? '#34c759' : '#e5e5ea' }} />
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || step === 'joining' || !displayName.trim() || !isPasswordStrong}
          className="w-full mt-4 rounded-xl py-[14px] text-[17px] font-semibold text-white disabled:opacity-50"
          style={{ background: '#007aff' }}
        >
          {step === 'joining' ? 'Connexion en cours…' : 'Rejoindre le foyer'}
        </button>
      </form>

      <p className="text-center text-[14px] text-[#8e8e93]">
        Déjà un compte ?{' '}
        <a href={`/login?redirect=/join?code=${code}`} className="font-semibold" style={{ color: '#007aff' }}>
          Se connecter
        </a>
      </p>
    </>
  );
}

// ── Export avec Suspense (requis pour useSearchParams) ─────────────────────

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-[50vh]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#e5e5ea] border-t-[#007aff]" />
      </div>
    }>
      <JoinPageInner />
    </Suspense>
  );
}
