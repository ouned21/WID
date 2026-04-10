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
        <div className="text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-2xl text-white shadow-lg mb-4">
            ✓
          </div>
          <h1 className="text-3xl font-bold text-slate-900">Compte créé</h1>
          <p className="mt-2 text-sm text-slate-600">
            Un email de confirmation a été envoyé à <strong>{email}</strong>.
            Vérifiez votre boîte mail puis connectez-vous.
          </p>
        </div>
        <a
          href="/login"
          className="block w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-center text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 shadow-sm"
        >
          Se connecter
        </a>
      </>
    );
  }

  return (
    <>
      <div className="text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white shadow-lg mb-4">
          W
        </div>
        <h1 className="text-3xl font-bold text-slate-900">WID</h1>
        <p className="mt-1 text-sm text-slate-500">Créer votre compte</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm border border-slate-100">
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700">
            Prénom
          </label>
          <input
            id="displayName"
            type="text"
            required
            minLength={2}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Jonathan"
          />
        </div>

        <div>
          <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="votre@email.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="6 caractères minimum"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 py-2.5 text-sm font-semibold text-white hover:from-indigo-700 hover:to-violet-700 disabled:opacity-50 transition-all shadow-sm"
        >
          {loading ? 'Création...' : 'Créer mon compte'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-500">
        Déjà un compte ?{' '}
        <a href="/login" className="font-semibold text-indigo-600 hover:underline">
          Se connecter
        </a>
      </p>
    </>
  );
}
