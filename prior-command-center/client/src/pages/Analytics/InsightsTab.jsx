import { useState, useEffect, useCallback } from 'react';
import InsightCard from './components/InsightCard';
import AnomalyAlert from './components/AnomalyAlert';

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function InsightsTab({ dateRange }) {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/insights/latest').then(r => r.json()),
      fetch('/api/insights/history?limit=5').then(r => r.json()),
      fetch('/api/insights/anomalies').then(r => r.json()),
    ])
      .then(([latestRes, historyRes, anomalyRes]) => {
        if (latestRes.data) setLatest(latestRes.data);
        if (historyRes.data) setHistory(historyRes.data);
        if (anomalyRes.data) setAnomalies(anomalyRes.data);
      })
      .catch(() => setError('Failed to load insights'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: dateRange.start,
          end: dateRange.end,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Generation failed');
      fetchData();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleDismiss(id) {
    try {
      await fetch(`/api/insights/anomalies/${id}/dismiss`, { method: 'POST' });
      setAnomalies(prev => prev.filter(a => a.id !== id));
    } catch {
      // ignore
    }
  }

  async function handleDetectAnomalies() {
    try {
      await fetch('/api/insights/anomalies/detect', { method: 'POST' });
      fetchData();
    } catch {
      // ignore
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-10 bg-prior-border/20 rounded-xl w-1/3" />
        <div className="h-32 bg-prior-border/20 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-48 bg-prior-border/20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold font-serif text-prior-black">Intelligence Engine</h2>
          <p className="text-sm text-prior-muted mt-0.5">AI-powered analysis of your marketing data</p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-prior-black text-white px-5 py-2.5 rounded-lg text-sm font-serif hover:bg-prior-black/90 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {generating && (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {generating ? 'Analyzing...' : 'Generate Analysis'}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}

      {/* Anomaly Alerts */}
      {anomalies.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs uppercase tracking-wider text-prior-muted font-serif">Active Alerts</h3>
            <button
              onClick={handleDetectAnomalies}
              className="text-xs text-prior-muted hover:text-prior-black transition-colors font-serif"
            >
              Re-scan
            </button>
          </div>
          {anomalies.map(a => (
            <AnomalyAlert key={a.id} anomaly={a} onDismiss={handleDismiss} />
          ))}
        </div>
      )}

      {/* Latest Insight */}
      {latest ? (
        <div className="space-y-4">
          {/* Headline */}
          <div className="bg-white rounded-xl border border-prior-border p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-prior-muted font-serif">
                  {latest.type === 'digest' ? 'Weekly Digest' : latest.type === 'anomaly' ? 'Anomaly Analysis' : 'On-Demand Analysis'}
                </span>
                <h2 className="text-xl font-bold font-serif text-prior-black mt-1 leading-snug">{latest.headline}</h2>
              </div>
              <span className="text-xs text-prior-muted whitespace-nowrap">
                {formatTimestamp(latest.generated_at)}
              </span>
            </div>
          </div>

          {/* Three-column cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InsightCard title="Highlights" items={latest.highlights} type="highlights" />
            <InsightCard title="Concerns" items={latest.concerns} type="concerns" />
            <InsightCard title="Recommendations" items={latest.recommendations} type="recommendations" />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-prior-border p-12 text-center">
          <p className="text-prior-muted font-serif mb-3">No insights generated yet</p>
          <p className="text-sm text-prior-muted">Click "Generate Analysis" to create your first AI-powered insight.</p>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-prior-muted font-serif mb-3">Previous Analyses</h3>
          <div className="space-y-2">
            {history.slice(1).map(item => (
              <div key={item.id} className="bg-white rounded-lg border border-prior-border p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-prior-muted mr-2">
                    {item.type === 'digest' ? 'Digest' : item.type === 'anomaly' ? 'Anomaly' : 'Analysis'}
                  </span>
                  <span className="text-sm font-serif text-prior-black">{item.headline}</span>
                </div>
                <span className="text-xs text-prior-muted">{formatTimestamp(item.generated_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
