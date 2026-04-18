'use client';

import { useRouter } from 'next/navigation';

export default function BackButton({ label = 'Retour' }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[15px] font-semibold active:opacity-70 transition-opacity"
      style={{ background: 'rgba(0,122,255,0.10)', color: '#007aff' }}
    >
      <svg width="8" height="14" viewBox="0 0 8 14" fill="none">
        <path d="M7 1L1 7L7 13" stroke="#007aff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {label}
    </button>
  );
}
