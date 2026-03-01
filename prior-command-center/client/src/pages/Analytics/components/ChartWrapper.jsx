export default function ChartWrapper({ title, subtitle, loading, children }) {
  return (
    <div className="bg-white rounded-xl border border-prior-border p-6">
      <div className="mb-4">
        <h3 className="text-sm font-serif font-bold text-prior-black">{title}</h3>
        {subtitle && <p className="text-xs text-prior-muted mt-0.5">{subtitle}</p>}
      </div>
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-prior-border/30 rounded w-3/4" />
          <div className="h-48 bg-prior-border/20 rounded" />
        </div>
      ) : children}
    </div>
  );
}
