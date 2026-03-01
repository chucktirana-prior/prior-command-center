import { useState, useEffect } from 'react';

export default function InsightsSummary({ onNavigateToInsights }) {
  const [insight, setInsight] = useState(null);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/insights/latest').then(r => r.json()),
      fetch('/api/insights/anomalies').then(r => r.json()),
    ])
      .then(([insightRes, anomalyRes]) => {
        if (insightRes.data) setInsight(insightRes.data);
        if (anomalyRes.data) setAnomalyCount(anomalyRes.data.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="h-32 bg-prior-border/20 rounded-xl animate-pulse" />;
  }

  if (!insight) {
    return (
      <div className="bg-white rounded-xl border border-prior-border p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs uppercase tracking-wider text-prior-muted font-serif">Intelligence</h3>
        </div>
        <p className="text-sm text-prior-muted">No insights generated yet.</p>
        {onNavigateToInsights && (
          <button
            onClick={onNavigateToInsights}
            className="text-sm text-prior-black underline mt-2 font-serif hover:no-underline"
          >
            Generate your first analysis
          </button>
        )}
      </div>
    );
  }

  const highlights = insight.highlights || [];

  return (
    <div className="bg-white rounded-xl border border-prior-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs uppercase tracking-wider text-prior-muted font-serif">Intelligence</h3>
        <div className="flex items-center gap-2">
          {anomalyCount > 0 && (
            <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded">
              {anomalyCount} alert{anomalyCount !== 1 ? 's' : ''}
            </span>
          )}
          {onNavigateToInsights && (
            <button
              onClick={onNavigateToInsights}
              className="text-xs text-prior-muted hover:text-prior-black transition-colors font-serif"
            >
              View all &rarr;
            </button>
          )}
        </div>
      </div>

      <p className="text-lg font-serif font-bold text-prior-black leading-snug mb-3">{insight.headline}</p>

      {highlights.slice(0, 2).map((h, i) => (
        <div key={i} className="flex gap-2 text-sm text-prior-body mb-1.5">
          <svg className="w-3.5 h-3.5 text-prior-green-dark flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          <span>{h}</span>
        </div>
      ))}
    </div>
  );
}
