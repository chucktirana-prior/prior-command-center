export default function KpiCard({ label, value, subtitle, trendText, trendTone = 'neutral' }) {
  const trendClassName = trendTone === 'up'
    ? 'text-green-800 bg-green-50 border-green-200'
    : trendTone === 'down'
      ? 'text-red-800 bg-red-50 border-red-200'
      : 'text-prior-muted bg-prior-offwhite border-prior-border';

  const trendPrefix = trendTone === 'up' ? '↑' : trendTone === 'down' ? '↓' : '•';

  return (
    <div className="bg-white rounded-2xl border border-prior-border p-5 shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-3xl md:text-[2rem] leading-none font-bold text-prior-black font-serif">{value}</div>
      </div>
      {subtitle && <div className="mt-2 text-sm text-prior-body">{subtitle}</div>}
      {trendText && (
        <div className={`mt-3 inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium leading-none ${trendClassName}`}>
          <span className="font-semibold">{trendPrefix}</span>
          <span className="truncate">{trendText}</span>
        </div>
      )}
    </div>
  );
}
