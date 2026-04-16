'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: '#f6f8ff' }}>
      <p className="text-[48px]">⚠️</p>
      <h2 className="text-[22px] font-bold text-[#1c1c1e]">Quelque chose s&apos;est mal passé</h2>
      <p className="text-[15px] text-[#8e8e93] max-w-sm">
        Une erreur inattendue s&apos;est produite. Tu peux réessayer ou revenir à l&apos;accueil.
      </p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={reset}
          className="rounded-xl px-5 py-3 text-[15px] font-semibold text-white"
          style={{ background: '#007aff' }}
        >
          Réessayer
        </button>
        <a
          href="/dashboard"
          className="rounded-xl px-5 py-3 text-[15px] font-semibold text-[#007aff]"
          style={{ background: '#e5f0ff' }}
        >
          Accueil
        </a>
      </div>
      {error.digest && (
        <p className="text-[11px] text-[#c7c7cc] mt-2">Code : {error.digest}</p>
      )}
    </div>
  );
}
