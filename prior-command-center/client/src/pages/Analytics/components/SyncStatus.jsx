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
  const [syncing, setSyncing] = useState(false);

  async function fetchStatus() {
    try {
      const res = await fetch('/api/sync/status');
      const json = await res.json();
      if (json.ok) setStatus(json.status);
    } catch { /* ignore */ }
  }

  useEffect(() => { fetchStatus(); }, []);

  async function handleRefresh() {
    setSyncing(true);
    try {
      await fetch('/api/sync', { method: 'POST' });
      await fetchStatus();
    } catch { /* ignore */ }
    setSyncing(false);
  }

  // Find the most recent completed_at across all sources
  const lastSynced = SOURCES
    .map(s => status[s]?.completed_at)
    .filter(Boolean)
    .sort()
    .pop();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5">
        {SOURCES.map(source => {
          const s = status[source];
          const color = !s ? 'bg-prior-border'
            : s.status === 'success' ? 'bg-prior-green-mid'
            : 'bg-red-400';
          return (
            <div key={source} className={`w-2 h-2 rounded-full ${color}`} title={`${source}: ${s?.status || 'unknown'}`} />
          );
        })}
      </div>
      <span className="text-xs text-prior-muted font-serif">
        {lastSynced ? `Synced ${timeAgo(lastSynced)}` : 'Not synced'}
      </span>
      <button
        onClick={handleRefresh}
        disabled={syncing}
        className="p-1.5 rounded-lg border border-prior-border hover:border-prior-mid transition-colors disabled:opacity-50"
        title="Refresh data"
      >
        <svg className={`w-3.5 h-3.5 text-prior-body ${syncing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>
  );
}
