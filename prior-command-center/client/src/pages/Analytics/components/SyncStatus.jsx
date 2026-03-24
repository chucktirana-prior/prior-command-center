import { useState, useEffect } from 'react';

const SOURCES = ['klaviyo', 'google_analytics', 'instagram'];

function timeAgo(isoString) {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SyncStatus() {
  const [status, setStatus] = useState({});
  const [activeSync, setActiveSync] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMode, setSyncMode] = useState(null);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/sync/status');
      const json = await res.json();
      if (json.ok) {
        setStatus(json.status);
        setActiveSync(json.activeSync || null);
        if (!json.activeSync?.running) {
          setSyncing(false);
          setSyncMode(null);
        }
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchStatus(); }, []);

  useEffect(() => {
    if (!syncing) return undefined;

    const interval = setInterval(() => {
      fetchStatus();
    }, 1500);

    return () => clearInterval(interval);
  }, [syncing]);

  async function handleRefresh(mode = 'recent') {
    setSyncing(true);
    setSyncMode(mode);
    try {
      fetchStatus();
      await fetch(`/api/sync?mode=${mode}`, { method: 'POST' });
      await fetchStatus();
    } catch { /* ignore */ }
    setSyncing(false);
    setSyncMode(null);
  }

  // Find the most recent completed_at across all sources
  const lastSynced = SOURCES
    .map(s => status[s]?.completed_at)
    .filter(Boolean)
    .sort()
    .pop();

  const progressPct = activeSync?.running ? Math.max(5, activeSync.progress_pct || 0) : null;
  const currentSource = activeSync?.running
    ? Object.entries(activeSync.sources || {}).find(([, value]) => value.status === 'running')?.[0] || null
    : null;
  const currentSourceLabel = currentSource ? currentSource.replace(/_/g, ' ') : null;
  const currentSourceState = currentSource ? activeSync?.sources?.[currentSource] : null;
  const detailText = activeSync?.running
    ? currentSourceState?.detail || (currentSourceLabel ? `Working on ${currentSourceLabel}` : 'Sync in progress')
    : null;
  const subdetailText = activeSync?.running && currentSourceState?.total
    ? `${currentSourceState.processed || 0} of ${currentSourceState.total} items`
    : null;

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      <div className="flex items-center gap-1.5 rounded-full border border-prior-border bg-white px-2.5 py-2">
        {SOURCES.map(source => {
          const s = status[source];
          const color = !s ? 'bg-prior-border'
            : s.status === 'success' ? 'bg-prior-green-mid'
            : s.status === 'skipped' ? 'bg-prior-yellow-light'
            : 'bg-red-400';
          return (
            <div key={source} className={`w-2 h-2 rounded-full ${color}`} title={`${source}: ${s?.status || 'unknown'}`} />
          );
        })}
      </div>
      <div className="min-w-[170px]">
        <div className="text-xs text-prior-muted font-serif whitespace-nowrap">
          {activeSync?.running
            ? `${progressPct}% complete${currentSourceLabel ? `, working on ${currentSourceLabel}` : ''}`
            : lastSynced ? `Synced ${timeAgo(lastSynced)}` : 'Not synced'}
        </div>
        {detailText && (
          <div className="mt-1 text-[11px] text-prior-body font-serif">
            {detailText}{subdetailText ? ` • ${subdetailText}` : ''}
          </div>
        )}
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-prior-border/60">
          <div
            className={`h-full rounded-full transition-all duration-500 ${activeSync?.running ? 'bg-prior-black' : 'bg-prior-green-mid'}`}
            style={{ width: `${activeSync?.running ? progressPct : 100}%` }}
          />
        </div>
      </div>
      <button
        onClick={() => handleRefresh('recent')}
        disabled={syncing}
        className="inline-flex items-center gap-2 rounded-full border border-prior-border bg-white px-3 py-1.5 text-xs font-serif text-prior-body transition-colors hover:border-prior-mid disabled:opacity-50"
        title="Refresh recent data"
      >
        <svg className={`w-3.5 h-3.5 text-prior-body ${syncing && syncMode === 'recent' ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>{syncing && syncMode === 'recent' ? 'Syncing' : 'Refresh'}</span>
      </button>
      <button
        onClick={() => handleRefresh('full')}
        disabled={syncing}
        className="px-3 py-1.5 rounded-full border border-prior-border text-xs text-prior-body font-serif hover:border-prior-mid transition-colors disabled:opacity-50"
        title="Refresh the full Klaviyo campaign library metadata"
      >
        {syncing && syncMode === 'full' ? 'Syncing...' : 'Full sync'}
      </button>
    </div>
  );
}
