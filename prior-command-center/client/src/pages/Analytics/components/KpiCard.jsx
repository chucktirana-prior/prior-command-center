export default function KpiCard({ label, value, subtitle }) {
  return (
    <div className="bg-white rounded-xl border border-prior-border p-5">
      <div className="text-xs uppercase tracking-wider text-prior-muted font-serif">{label}</div>
      <div className="text-3xl font-bold text-prior-black font-serif mt-1">{value}</div>
      {subtitle && <div className="text-sm text-prior-body mt-1">{subtitle}</div>}
    </div>
  );
}
