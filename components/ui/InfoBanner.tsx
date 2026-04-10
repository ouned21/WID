type InfoBannerProps = {
  tone: 'neutral' | 'warning' | 'critical';
  text: string;
};

export default function InfoBanner({ tone, text }: InfoBannerProps) {
  const toneClass =
    tone === 'critical'
      ? 'bg-red-50 text-red-700 border-red-200'
      : tone === 'warning'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : 'bg-slate-50 text-slate-700 border-slate-200';

  return (
    <div className={`rounded-2xl border px-4 py-3 text-sm ${toneClass}`}>
      {text}
    </div>
  );
}