'use client';

type Props = {
  onDelete: () => void;
  size?: number;
};

export default function DeleteButton({ onDelete, size = 32 }: Props) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(); }}
      className="flex-shrink-0 flex items-center justify-center rounded-full transition-opacity active:opacity-50"
      style={{ width: size, height: size, background: 'rgba(255,59,48,0.1)' }}
      aria-label="Supprimer"
    >
      <svg width={size * 0.47} height={size * 0.47} viewBox="0 0 24 24" fill="none"
        stroke="#ff3b30" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
        <path d="M10 11v6M14 11v6" />
        <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
      </svg>
    </button>
  );
}
