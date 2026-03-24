import { useEffect, useMemo, useState } from 'react';

function formatDateTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusTone(status) {
  switch (status) {
    case 'open':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'closed':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'not_found':
      return 'bg-amber-50 text-amber-900 border-amber-200';
    case 'error':
      return 'bg-orange-50 text-orange-900 border-orange-200';
    default:
      return 'bg-stone-100 text-stone-700 border-stone-200';
  }
}

function prettyStatus(status) {
  switch (status) {
    case 'not_found':
      return 'Not found';
    default:
      return status ? status.replace(/_/g, ' ') : 'Pending';
  }
}

function StatCard({ label, value, tone = 'default' }) {
  const className = tone === 'danger'
    ? 'border-red-200 bg-red-50'
    : tone === 'warn'
      ? 'border-amber-200 bg-amber-50'
      : 'border-prior-border bg-white';

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <p className="text-xs uppercase tracking-[0.18em] text-prior-muted">{label}</p>
      <p className="mt-2 text-3xl font-serif text-prior-black">{value}</p>
    </div>
  );
}

export default function LocationMonitor() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [error, setError] = useState('');
  const [busyAction, setBusyAction] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const res = await fetch('/api/location-monitor');
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to load location monitor');
      }
      setData(json);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function runAction(action, endpoint) {
    setBusyAction(action);
    setActionMessage('');
    setError('');

    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Action failed');
      }

      if (action === 'import') {
        setActionMessage(`Imported ${json.imported} linked businesses from ${json.scannedArticles} articles.`);
      } else if (action === 'check-all') {
        setActionMessage(`Checked ${json.checked} businesses. ${json.closed} closed, ${json.notFound} not found, ${json.errors} errors.`);
      }

      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyAction('');
    }
  }

  const places = data?.places || [];
  const summary = data?.summary || {};
  const recentChecks = data?.recentChecks || [];
  const configured = data?.configured || {};

  const atRiskCount = useMemo(
    () => places.filter((place) => ['closed', 'not_found', 'error'].includes(place.check_status)).length,
    [places]
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-prior-black font-serif">Location Monitor</h1>
          <p className="mt-2 max-w-3xl text-prior-body font-serif">
            Pull linked businesses from Prior guides, check them against Google Maps, and flag guides that may need an editorial refresh.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runAction('import', '/api/location-monitor/import-contentful')}
            disabled={busyAction !== ''}
            className="rounded-xl border border-prior-border bg-white px-4 py-2.5 text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
          >
            {busyAction === 'import' ? 'Importing…' : 'Import from Contentful'}
          </button>
          <button
            onClick={() => runAction('check-all', '/api/location-monitor/check-all')}
            disabled={busyAction !== '' || !configured.googleMaps}
            className="rounded-xl bg-prior-black px-4 py-2.5 text-sm font-serif text-white transition-colors hover:bg-prior-black/90 disabled:opacity-50"
          >
            {busyAction === 'check-all' ? 'Checking…' : 'Run Google Maps Check'}
          </button>
        </div>
      </div>

      {!configured.googleMaps && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 font-serif">
          Add <code>GOOGLE_MAPS_API_KEY</code> to <code>.env</code> to enable live location checks. Import still works without it.
        </div>
      )}

      {actionMessage && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-emerald-900 font-serif">
          {actionMessage}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-red-800 font-serif">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Tracked Businesses" value={summary.total || 0} />
        <StatCard label="At Risk" value={atRiskCount} tone={atRiskCount > 0 ? 'danger' : 'default'} />
        <StatCard label="Open" value={summary.open_count || 0} />
        <StatCard label="Pending" value={summary.pending_count || 0} tone={(summary.pending_count || 0) > 0 ? 'warn' : 'default'} />
        <StatCard label="Last Checked" value={summary.last_checked_at ? formatDateTime(summary.last_checked_at) : 'Never'} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.9fr_1fr]">
        <section className="rounded-3xl border border-prior-border bg-white shadow-sm">
          <div className="border-b border-prior-border px-6 py-5">
            <h2 className="text-xl font-serif text-prior-black">Tracked Businesses</h2>
            <p className="mt-1 text-sm text-prior-body font-serif">
              Imported from linked businesses inside article bodies. Focus first on anything marked closed, not found, or error.
            </p>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-prior-muted font-serif">Loading location data…</div>
          ) : places.length === 0 ? (
            <div className="px-6 py-10 text-prior-muted font-serif">
              No linked businesses tracked yet. Start with <strong>Import from Contentful</strong>.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="border-b border-prior-border bg-prior-cream/50 text-xs uppercase tracking-[0.16em] text-prior-muted">
                  <tr>
                    <th className="px-6 py-3">Business</th>
                    <th className="px-4 py-3">Guide</th>
                    <th className="px-4 py-3">Section</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Last Checked</th>
                  </tr>
                </thead>
                <tbody>
                  {places.map((place) => (
                    <tr key={place.id} className="border-b border-prior-border/70 align-top">
                      <td className="px-6 py-4">
                        <div className="font-serif text-prior-black">{place.business_name}</div>
                        <a href={place.website_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-prior-muted underline underline-offset-2">
                          {place.website_url}
                        </a>
                        {place.address && (
                          <div className="mt-2 text-xs text-prior-body">{place.address}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-prior-body font-serif">
                        <div>{place.article_title}</div>
                        {place.article_url && (
                          <a href={place.article_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline underline-offset-2">
                            Open article
                          </a>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-prior-body font-serif">{place.section || 'Unsorted'}</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-serif capitalize ${statusTone(place.check_status)}`}>
                          {prettyStatus(place.check_status)}
                        </span>
                        {place.business_status && (
                          <div className="mt-2 text-xs text-prior-muted">{place.business_status}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-prior-body font-serif">
                        {formatDateTime(place.last_checked_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-prior-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-serif text-prior-black">Current Read</h2>
            <ul className="mt-4 space-y-3 text-sm text-prior-body font-serif">
              <li>Closed: {summary.closed_count || 0}</li>
              <li>Not found: {summary.not_found_count || 0}</li>
              <li>Errors: {summary.error_count || 0}</li>
              <li>Last import: {summary.last_import_at ? formatDateTime(summary.last_import_at) : 'Never'}</li>
            </ul>
          </section>

          <section className="rounded-3xl border border-prior-border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-serif text-prior-black">Recent Checks</h2>
            {recentChecks.length === 0 ? (
              <p className="mt-4 text-sm text-prior-muted font-serif">No checks recorded yet.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {recentChecks.slice(0, 8).map((check) => (
                  <div key={check.id} className="border-b border-prior-border/70 pb-3 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-serif text-prior-black">{check.business_name}</p>
                        <p className="text-xs text-prior-muted">{check.article_title}</p>
                      </div>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-serif ${statusTone(check.check_status)}`}>
                        {prettyStatus(check.check_status)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-prior-body">{formatDateTime(check.checked_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
