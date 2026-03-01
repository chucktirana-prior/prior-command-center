const SEVERITY_STYLES = {
  critical: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-prior-yellow-light border-prior-yellow-warm text-yellow-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const SEVERITY_BADGE = {
  critical: 'bg-red-100 text-red-700',
  warning: 'bg-yellow-100 text-yellow-700',
  info: 'bg-blue-100 text-blue-700',
};

export default function AnomalyAlert({ anomaly, onDismiss }) {
  const style = SEVERITY_STYLES[anomaly.severity] || SEVERITY_STYLES.info;
  const badge = SEVERITY_BADGE[anomaly.severity] || SEVERITY_BADGE.info;

  return (
    <div className={`rounded-lg border p-4 flex items-start justify-between gap-3 ${style}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${badge}`}>
            {anomaly.severity}
          </span>
          <span className="text-xs text-prior-muted">
            {anomaly.source}/{anomaly.metric}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{anomaly.message}</p>
        {anomaly.deviation_pct != null && (
          <p className="text-xs mt-1 opacity-70">
            {anomaly.deviation_pct > 0 ? '+' : ''}{anomaly.deviation_pct.toFixed(1)}% deviation from baseline
          </p>
        )}
      </div>
      {onDismiss && (
        <button
          onClick={() => onDismiss(anomaly.id)}
          className="text-prior-muted hover:text-prior-black transition-colors p-1"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
