import { useEffect, useMemo, useState } from 'react';
import { downloadLocationReport } from './LocationMonitorReport';

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
    case 'active':
    case 'likely_active':
      return 'bg-emerald-50 text-emerald-800 border-emerald-200';
    case 'closed':
    case 'dead':
    case 'likely_closed':
      return 'bg-red-50 text-red-800 border-red-200';
    case 'not_found':
    case 'suspect':
    case 'likely_changed':
    case 'needs_review':
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
  const [triageFilter, setTriageFilter] = useState('needs_attention');
  const [query, setQuery] = useState('');
  const [batchSize, setBatchSize] = useState(25);
  const [selectedGuideId, setSelectedGuideId] = useState(null);
  const [guideQuery, setGuideQuery] = useState('');
  const [placesPage, setPlacesPage] = useState(0);
  const [exportBusy, setExportBusy] = useState(false);
  const [stoppingSlots, setStoppingSlots] = useState(new Set());
  const [guideCheckOpen, setGuideCheckOpen] = useState(false);
  const [guideCheckBusy, setGuideCheckBusy] = useState('');
  const PLACES_PER_PAGE = 20;

  // showLoading=false for background polling so the table doesn't flash/jump
  async function loadData(showLoading = true) {
    if (showLoading) setLoading(true);
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
      if (showLoading) setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function runAction(action, endpoint, options = {}) {
    setBusyAction(action);
    setActionMessage('');
    setError('');

    try {
      const requestInit = { method: 'POST' };
      if (options.body) {
        requestInit.headers = { 'Content-Type': 'application/json' };
        requestInit.body = JSON.stringify(options.body);
      }

      const res = await fetch(endpoint, requestInit);
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Action failed');
      }

      if (action === 'import') {
        const parts = [
          `Imported ${json.imported} linked businesses from ${json.scannedArticles} articles`,
          `${json.importedGuidePosts || 0} guide post locations`,
        ];
        if (json.skippedNonVenueLinks) parts.push(`skipped ${json.skippedNonVenueLinks} non-venue links`);
        if (json.prunedNonVenueLinks) parts.push(`pruned ${json.prunedNonVenueLinks} old junk links`);
        setActionMessage(parts.join(' · ') + '.');
      } else if (action === 'check-all') {
        const job = json.job || {};
        const prefix = job.mode === 'risky'
          ? 'Started risky Google Maps batch'
          : job.mode === 'unreviewed'
            ? 'Started unreviewed Google Maps batch'
            : 'Started Google Maps batch';
        setActionMessage(json.started === false
          ? 'A Google Maps batch is already running. The live queue below will keep updating.'
          : `${prefix}${job.limit ? ` for up to ${job.limit}` : ''} places. The live queue below will keep updating.`);
      } else if (action === 'website-check-all') {
        const job = json.job || {};
        const prefix = job.mode === 'risky'
          ? 'Started risky website batch'
          : job.mode === 'unreviewed'
            ? 'Started unreviewed website batch'
            : 'Started website batch';
        setActionMessage(json.started === false
          ? 'A website check batch is already running. The live queue below will keep updating.'
          : `${prefix}${job.limit ? ` for up to ${job.limit}` : ''} places. The live queue below will keep updating.`);
      } else if (action === 'review-all') {
        const job = json.job || {};
        const prefix = job.mode === 'risky'
          ? 'Started risky AI review batch'
          : job.mode === 'unreviewed'
            ? 'Started unreviewed AI review batch'
            : job.mode === 'website_checked'
              ? 'Started AI review on website-checked places'
              : 'Started AI review batch';
        setActionMessage(json.started === false
          ? 'An AI review batch is already running. The live queue below will keep updating.'
          : `${prefix}${job.limit ? ` for up to ${job.limit}` : ''} places. The live queue below will keep updating.`);
      } else if (action === 'full-review') {
        const job = json.job || {};
        const label = job.mode === 'unconfirmed' ? 'unconfirmed' : 'all';
        setActionMessage(json.started === false
          ? 'A full review is already running. Progress is shown below.'
          : `Started full review pipeline for ${label} places — website → Maps → AI in sequence.`);
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
  const articleRollups = data?.articleRollups || [];
  const recentChecks = data?.recentChecks || [];
  const recentWebsiteChecks = data?.recentWebsiteChecks || [];
  const recentAiReviews = data?.recentAiReviews || [];
  const activeJobs = data?.activeJobs || {};
  const configured = data?.configured || {};

  const atRiskCount = useMemo(
    () => places.filter((place) => ['closed', 'not_found', 'error'].includes(place.check_status)).length,
    [places]
  );

  const filterCounts = useMemo(() => ({
    needs_attention: places.filter((place) => (
      ['suspect', 'error'].includes(place.website_check_status)
      || ['needs_review', 'likely_changed', 'likely_closed'].includes(place.ai_review_status)
      || ['closed', 'not_found', 'error'].includes(place.check_status)
    )).length,
    website_suspect: places.filter((place) => ['suspect', 'error'].includes(place.website_check_status)).length,
    ai_review: places.filter((place) => ['needs_review', 'likely_changed', 'likely_closed'].includes(place.ai_review_status)).length,
    healthy: places.filter((place) => place.website_check_status === 'active' && (place.ai_review_status === 'likely_active' || place.ai_review_status === 'pending')).length,
    all: places.length,
  }), [places]);

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return places.filter((place) => {
      const matchesQuery = !normalizedQuery || [
        place.business_name,
        place.article_title,
        place.section,
        place.website_url,
        place.website_signal_summary,
        place.ai_review_summary,
      ].filter(Boolean).some((value) => value.toLowerCase().includes(normalizedQuery));

      if (!matchesQuery) return false;

      switch (triageFilter) {
        case 'needs_attention':
          return (
            ['suspect', 'error'].includes(place.website_check_status)
            || ['needs_review', 'likely_changed', 'likely_closed'].includes(place.ai_review_status)
            || ['closed', 'not_found', 'error'].includes(place.check_status)
          );
        case 'website_suspect':
          return ['suspect', 'error'].includes(place.website_check_status);
        case 'ai_review':
          return ['needs_review', 'likely_changed', 'likely_closed'].includes(place.ai_review_status);
        case 'healthy':
          return place.website_check_status === 'active' && (place.ai_review_status === 'likely_active' || place.ai_review_status === 'pending');
        case 'all':
        default:
          return true;
      }
    });
  }, [places, query, triageFilter]);

  // Build guide groups from guide_post places, excluding placeholder entries
  const guideGroups = useMemo(() => {
    const groups = new Map();
    for (const place of places) {
      if (place.source_type !== 'guide_post' || !place.article_slug) continue;
      if (!groups.has(place.article_id)) {
        groups.set(place.article_id, {
          article_id: place.article_id,
          article_title: place.article_title,
          article_slug: place.article_slug,
          article_url: place.article_url,
          places: [],
        });
      }
      groups.get(place.article_id).places.push(place);
    }
    return [...groups.values()].sort((a, b) => a.article_title.localeCompare(b.article_title));
  }, [places]);

  const selectedGuide = guideGroups.find((g) => g.article_id === selectedGuideId) || null;

  const guideFilteredPlaces = useMemo(() => {
    if (!selectedGuide) return [];
    const q = guideQuery.trim().toLowerCase();
    if (!q) return selectedGuide.places;
    return selectedGuide.places.filter((p) =>
      [p.business_name, p.section, p.address, p.website_url].filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [selectedGuide, guideQuery]);

  const triageOptions = [
    { id: 'needs_attention', label: 'Needs Attention', count: filterCounts.needs_attention },
    { id: 'website_suspect', label: 'Website Suspect', count: filterCounts.website_suspect },
    { id: 'ai_review', label: 'AI Review', count: filterCounts.ai_review },
    { id: 'healthy', label: 'Looks Stable', count: filterCounts.healthy },
    { id: 'all', label: 'All Places', count: filterCounts.all },
  ];

  const locationJobsRunning = Boolean(
    activeJobs.maps?.running
    || activeJobs.website?.running
    || activeJobs.aiReview?.running
    || activeJobs.fullReview?.running
  );

  const allJobs = [activeJobs.maps, activeJobs.website, activeJobs.aiReview, activeJobs.fullReview].filter(Boolean);

  useEffect(() => {
    if (!locationJobsRunning) return undefined;

    // Poll silently — no loading flash
    const interval = setInterval(() => {
      loadData(false);
    }, 2000);

    return () => clearInterval(interval);
  }, [locationJobsRunning]);

  // Clear "Stopping…" state for any job that is no longer running
  useEffect(() => {
    if (stoppingSlots.size === 0) return;
    setStoppingSlots((prev) => {
      const next = new Set(prev);
      for (const type of prev) {
        const job = allJobs.find((j) => j.type === type);
        if (!job || !job.running) next.delete(type);
      }
      return next.size !== prev.size ? next : prev;
    });
  }, [allJobs]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-prior-black font-serif">Location Monitor</h1>
          <p className="mt-2 max-w-3xl text-prior-body font-serif">
            Pull linked businesses from article bodies and locations from Prior guide posts, gather website evidence, and use AI review to flag venues that may need an editorial refresh.
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
          <button
            onClick={() => runAction('website-check-all', '/api/location-monitor/website-check-all')}
            disabled={busyAction !== ''}
            className="rounded-xl border border-prior-border bg-white px-4 py-2.5 text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
          >
            {busyAction === 'website-check-all' ? 'Checking websites…' : 'Run Website Check'}
          </button>
          <button
            onClick={() => runAction('review-all', '/api/location-monitor/review-all')}
            disabled={busyAction !== '' || !configured.anthropic}
            className="rounded-xl border border-prior-border bg-white px-4 py-2.5 text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
          >
            {busyAction === 'review-all' ? 'Reviewing…' : 'Run AI Review'}
          </button>
          <button
            onClick={async () => {
              if (!data) return;
              setExportBusy(true);
              try {
                const currentFilter = triageOptions.find((o) => o.id === triageFilter)?.label || 'Needs Attention';
                await downloadLocationReport(data, currentFilter);
              } finally {
                setExportBusy(false);
              }
            }}
            disabled={exportBusy || !data}
            className="rounded-xl border border-prior-border bg-white px-4 py-2.5 text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50 flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            {exportBusy ? 'Generating PDF…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {!configured.googleMaps && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 font-serif">
          Google Maps is optional. Add <code>GOOGLE_MAPS_API_KEY</code> to <code>.env</code> if you want place-enrichment checks on top of website evidence.
        </div>
      )}

      {!configured.anthropic && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 font-serif">
          Add <code>ANTHROPIC_API_KEY</code> to <code>.env</code> to enable AI venue review.
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Website Active" value={summary.website_active_count || 0} />
        <StatCard label="Website Suspect" value={summary.website_suspect_count || 0} tone={(summary.website_suspect_count || 0) > 0 ? 'warn' : 'default'} />
        <StatCard label="AI Needs Review" value={summary.ai_needs_review_count || 0} tone={(summary.ai_needs_review_count || 0) > 0 ? 'warn' : 'default'} />
      </div>

      <section className="rounded-3xl border border-prior-border bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-xl font-serif text-prior-black">Review Queue</h2>
            <p className="mt-1 text-sm text-prior-body font-serif">
              Run smaller operational batches instead of processing the full inventory every time.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs uppercase tracking-[0.16em] text-prior-muted">Batch size</label>
            <input
              type="number"
              min="1"
              max="500"
              step="1"
              value={batchSize}
              onChange={(event) => {
                const nextValue = Number(event.target.value);
                setBatchSize(Number.isFinite(nextValue) && nextValue > 0 ? nextValue : 25);
              }}
              className="w-28 rounded-xl border border-prior-border bg-white px-3 py-2 text-sm font-serif text-prior-black outline-none transition-colors focus:border-prior-mid"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => runAction('check-all', '/api/location-monitor/check-all', { body: { mode: 'unreviewed', limit: batchSize } })}
            disabled={busyAction !== '' || !configured.googleMaps}
            className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
          >
            Google Maps next batch
            <div className="mt-1 text-xs text-prior-muted">Targets places without a maps check yet</div>
          </button>
          <button
            onClick={() => runAction('website-check-all', '/api/location-monitor/website-check-all', { body: { mode: 'unreviewed', limit: batchSize } })}
            disabled={busyAction !== ''}
            className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
          >
            Website check next batch
            <div className="mt-1 text-xs text-prior-muted">Targets unchecked places first</div>
          </button>
          <button
            onClick={() => runAction('website-check-all', '/api/location-monitor/website-check-all', { body: { mode: 'risky', limit: batchSize } })}
            disabled={busyAction !== ''}
            className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
          >
            Re-check risky websites
            <div className="mt-1 text-xs text-prior-muted">Focuses on suspect and error cases</div>
          </button>
          <button
            onClick={() => runAction('review-all', '/api/location-monitor/review-all', { body: { mode: 'website_checked', limit: batchSize } })}
            disabled={busyAction !== '' || !configured.anthropic}
            className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
          >
            Review checked places
            <div className="mt-1 text-xs text-prior-muted">Uses Claude on places with website evidence</div>
          </button>
        </div>

        {/* Full Review pipeline buttons */}
        <div className="mt-3 space-y-3">
          <p className="text-xs uppercase tracking-[0.14em] text-prior-muted">Full pipeline — all content</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={() => runAction('full-review', '/api/location-monitor/full-review-all', { body: { mode: 'all' } })}
              disabled={busyAction !== '' || !configured.anthropic}
              className="rounded-2xl border border-prior-black bg-prior-black px-4 py-3 text-left text-sm font-serif text-white transition-colors hover:bg-prior-black/90 disabled:opacity-50"
            >
              {busyAction === 'full-review' ? 'Running full review…' : 'Full Review — All Places'}
              <div className="mt-1 text-xs text-white/70">Website → Maps → AI across every location</div>
            </button>
            <button
              onClick={() => runAction('full-review', '/api/location-monitor/full-review-all', { body: { mode: 'unconfirmed' } })}
              disabled={busyAction !== '' || !configured.anthropic}
              className="rounded-2xl border border-prior-black bg-prior-black px-4 py-3 text-left text-sm font-serif text-white transition-colors hover:bg-prior-black/90 disabled:opacity-50"
            >
              {busyAction === 'full-review' ? 'Running full review…' : 'Full Review — Unconfirmed Only'}
              <div className="mt-1 text-xs text-white/70">Targets places still pending on any check</div>
            </button>
          </div>

          <p className="text-xs uppercase tracking-[0.14em] text-prior-muted pt-1">Full pipeline — by source</p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <button
              onClick={() => runAction('full-review', '/api/location-monitor/full-review-all', { body: { mode: 'all', sourceType: 'article' } })}
              disabled={busyAction !== '' || !configured.anthropic}
              className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
            >
              Editorial — All
              <div className="mt-1 text-xs text-prior-muted">Full pipeline, article locations only</div>
            </button>
            <button
              onClick={() => runAction('full-review', '/api/location-monitor/full-review-all', { body: { mode: 'unconfirmed', sourceType: 'article' } })}
              disabled={busyAction !== '' || !configured.anthropic}
              className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
            >
              Editorial — Unconfirmed
              <div className="mt-1 text-xs text-prior-muted">Pending article locations only</div>
            </button>
            <button
              onClick={() => runAction('full-review', '/api/location-monitor/full-review-all', { body: { mode: 'all', sourceType: 'guide_post' } })}
              disabled={busyAction !== '' || !configured.anthropic}
              className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
            >
              Guides — All
              <div className="mt-1 text-xs text-prior-muted">Full pipeline, guide locations only</div>
            </button>
            <button
              onClick={() => runAction('full-review', '/api/location-monitor/full-review-all', { body: { mode: 'unconfirmed', sourceType: 'guide_post' } })}
              disabled={busyAction !== '' || !configured.anthropic}
              className="rounded-2xl border border-prior-border bg-white px-4 py-3 text-left text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
            >
              Guides — Unconfirmed
              <div className="mt-1 text-xs text-prior-muted">Pending guide locations only</div>
            </button>
          </div>
        </div>

        {allJobs.length > 0 && (
          <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {allJobs.map((job) => {
              const title = job.type === 'maps'
                ? 'Google Maps queue'
                : job.type === 'website'
                  ? 'Website queue'
                  : job.type === 'fullReview'
                    ? 'Full review pipeline'
                    : 'AI review queue';
              const isCancelled = job.status === 'cancelled';
              const tone = job.status === 'failed'
                ? 'border-red-200 bg-red-50'
                : isCancelled
                  ? 'border-amber-200 bg-amber-50'
                  : job.running
                    ? 'border-prior-border bg-prior-cream/40'
                    : 'border-emerald-200 bg-emerald-50';

              const slotMap = { maps: 'maps', website: 'website', aiReview: 'aiReview', fullReview: 'fullReview' };

              return (
                <div key={job.type} className={`rounded-2xl border p-4 ${tone}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-serif text-prior-black">{title}</p>
                      <p className="mt-1 text-xs text-prior-muted">
                        {job.running ? 'Running now' : isCancelled ? 'Cancelled' : job.status === 'failed' ? 'Last run failed' : 'Last run complete'}
                        {job.mode ? ` • ${job.mode.replace(/_/g, ' ')}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {job.running && (
                        <button
                          disabled={stoppingSlots.has(job.type)}
                          onClick={async () => {
                            const slot = slotMap[job.type];
                            // Mark as stopping immediately — cleared by useEffect when job stops
                            setStoppingSlots((prev) => new Set([...prev, job.type]));
                            await fetch(`/api/location-monitor/cancel-job/${slot}`, { method: 'POST' });
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-serif text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
                        >
                          {stoppingSlots.has(job.type) ? 'Stopping…' : 'Stop'}
                        </button>
                      )}
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-serif ${job.running ? statusTone('active') : isCancelled ? statusTone('needs_review') : job.status === 'failed' ? statusTone('error') : statusTone('likely_active')}`}>
                        {job.running ? `${job.progress_pct || 0}%` : isCancelled ? 'cancelled' : job.status}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-prior-border/60">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${job.running ? 'bg-prior-black' : isCancelled ? 'bg-amber-400' : job.status === 'failed' ? 'bg-red-400' : 'bg-prior-green-mid'}`}
                      style={{ width: `${job.running ? Math.max(4, job.progress_pct || 0) : 100}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-prior-body">
                    {stoppingSlots.has(job.type) ? 'Stop requested — finishing current item…' : (job.detail || 'Waiting for job detail')}
                    {typeof job.processed === 'number' && typeof job.total === 'number' ? ` • ${job.processed} of ${job.total}` : ''}
                  </p>
                  {job.error && (
                    <p className="mt-1 text-xs text-red-700">{job.error}</p>
                  )}
                  {!job.running && job.completed_at && (
                    <p className="mt-1 text-xs text-prior-muted">{isCancelled ? 'Stopped' : 'Completed'} {formatDateTime(job.completed_at)}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <section className="min-w-0 rounded-3xl border border-prior-border bg-white shadow-sm">
          <div className="border-b border-prior-border px-6 py-5">
            <h2 className="text-xl font-serif text-prior-black">Tracked Businesses</h2>
            <p className="mt-1 text-sm text-prior-body font-serif">
              Imported from article body links and Prior guide posts. Website evidence is the primary signal, AI review helps interpret ambiguous cases, and Google Maps remains optional enrichment.
            </p>
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {triageOptions.map((option) => {
                  const isActive = triageFilter === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => { setTriageFilter(option.id); setPlacesPage(0); }}
                      className={`rounded-full border px-3 py-1.5 text-xs font-serif transition-colors ${
                        isActive
                          ? 'border-prior-black bg-prior-black text-white'
                          : 'border-prior-border bg-white text-prior-body hover:border-prior-mid'
                      }`}
                    >
                      {option.label} ({option.count})
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <input
                  type="text"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); setPlacesPage(0); }}
                  placeholder="Search business, guide, section, or URL"
                  className="w-full rounded-xl border border-prior-border bg-white px-4 py-2.5 text-sm font-serif text-prior-black outline-none transition-colors placeholder:text-prior-muted focus:border-prior-mid md:max-w-md"
                />
                <p className="text-sm text-prior-muted font-serif shrink-0">
                  {filteredPlaces.length} of {places.length} places
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="px-6 py-10 text-prior-muted font-serif">Loading location data…</div>
          ) : places.length === 0 ? (
            <div className="px-6 py-10 text-prior-muted font-serif">
              No linked businesses tracked yet. Start with <strong>Import from Contentful</strong>.
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="px-6 py-10 text-prior-muted font-serif">
              No places match the current filter. Try another triage view or clear the search.
            </div>
          ) : (
            <div className="divide-y divide-prior-border/70">
              {filteredPlaces.slice(placesPage * PLACES_PER_PAGE, (placesPage + 1) * PLACES_PER_PAGE).map((place) => (
                <div key={place.id} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,1fr)] gap-4 px-6 py-4 items-start">

                  {/* Column 1: Business */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-prior-black truncate">{place.business_name}</span>
                      {place.source_type === 'guide_post' && (
                        <span className="shrink-0 inline-flex rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-serif text-blue-700">Guide</span>
                      )}
                    </div>
                    <a
                      href={place.website_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-0.5 block text-xs text-prior-muted underline underline-offset-2 truncate"
                      title={place.website_url}
                    >
                      {place.website_url}
                    </a>
                    {place.address && (
                      <div className="mt-1 text-xs text-prior-body truncate" title={place.address}>{place.address}</div>
                    )}
                    {place.website_signal_summary && (
                      <div className="mt-1 text-xs text-prior-muted line-clamp-2">{place.website_signal_summary}</div>
                    )}
                    {place.ai_review_summary && (
                      <div className="mt-1 text-xs text-prior-body line-clamp-2">AI: {place.ai_review_summary}</div>
                    )}
                  </div>

                  {/* Column 2: Guide + Section */}
                  <div className="min-w-0 text-sm font-serif">
                    <div className="truncate text-prior-black" title={place.article_title}>{place.article_title}</div>
                    {place.section && (
                      <div className="mt-0.5 truncate text-xs text-prior-muted" title={place.section}>{place.section}</div>
                    )}
                    {place.article_url && (
                      <a href={place.article_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs underline underline-offset-2 text-prior-muted">
                        Open guide
                      </a>
                    )}
                  </div>

                  {/* Column 3: Status + Dates */}
                  <div className="min-w-0">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-serif capitalize ${statusTone(place.website_check_status || place.check_status)}`}>
                      Web: {prettyStatus(place.website_check_status || 'pending')}
                    </span>
                    {place.ai_review_status && place.ai_review_status !== 'pending' && (
                      <div className="mt-1.5">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-serif capitalize ${statusTone(place.ai_review_status)}`}>
                          AI: {prettyStatus(place.ai_review_status)}
                        </span>
                      </div>
                    )}
                    {place.check_status && place.check_status !== 'pending' && (
                      <div className="mt-1 text-xs text-prior-muted">Maps: {prettyStatus(place.check_status)}</div>
                    )}
                    <div className="mt-2 text-xs text-prior-muted space-y-0.5">
                      <div>Web: {formatDateTime(place.website_checked_at)}</div>
                      <div>Maps: {formatDateTime(place.last_checked_at)}</div>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {filteredPlaces.length > PLACES_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-prior-border px-6 py-4">
              <p className="text-sm text-prior-muted font-serif">
                Page {placesPage + 1} of {Math.ceil(filteredPlaces.length / PLACES_PER_PAGE)}
                <span className="ml-2 text-prior-muted/60">({filteredPlaces.length} total)</span>
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPlacesPage((p) => Math.max(0, p - 1))}
                  disabled={placesPage === 0}
                  className="rounded-xl border border-prior-border bg-white px-4 py-2 text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-40"
                >
                  ← Previous
                </button>
                <button
                  onClick={() => setPlacesPage((p) => Math.min(Math.ceil(filteredPlaces.length / PLACES_PER_PAGE) - 1, p + 1))}
                  disabled={placesPage >= Math.ceil(filteredPlaces.length / PLACES_PER_PAGE) - 1}
                  className="rounded-xl border border-prior-border bg-white px-4 py-2 text-sm font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ── Right column: Guide Browser + sidebar sections ── */}
        <div className="space-y-4">
        <section className="rounded-3xl border border-prior-border bg-white shadow-sm">
          <div className="border-b border-prior-border px-6 py-5">
            <h2 className="text-xl font-serif text-prior-black">Guide Browser</h2>
            <p className="mt-1 text-sm text-prior-body font-serif">
              Select a guide to browse all its places.
            </p>
          </div>

          {/* Guide cards — 2 columns to fit the sidebar */}
          <div className="grid grid-cols-2 gap-3 p-4">
            {guideGroups.map((guide) => {
              const atRisk = guide.places.filter((p) =>
                ['suspect', 'error'].includes(p.website_check_status)
                || ['needs_review', 'likely_changed', 'likely_closed'].includes(p.ai_review_status)
                || ['closed', 'not_found', 'error'].includes(p.check_status)
              ).length;
              const isSelected = selectedGuideId === guide.article_id;
              return (
                <button
                  key={guide.article_id}
                  type="button"
                  onClick={() => {
                    setSelectedGuideId(isSelected ? null : guide.article_id);
                    setGuideQuery('');
                  }}
                  className={`rounded-2xl border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-prior-black bg-prior-black'
                      : 'border-prior-border bg-white hover:border-prior-mid'
                  }`}
                >
                  <p className={`truncate font-serif text-sm font-medium ${isSelected ? 'text-white' : 'text-prior-black'}`}>
                    {guide.article_title}
                  </p>
                  <p className={`mt-0.5 text-xs ${isSelected ? 'text-white/60' : 'text-prior-muted'}`}>
                    {guide.places.length} places
                  </p>
                  {atRisk > 0 && (
                    <span className="mt-1.5 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-serif text-amber-900">
                      {atRisk} at risk
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Places panel — scrollable so it never blows out the column */}
          {selectedGuide && (
            <div className="border-t border-prior-border">
              <div className="flex items-center justify-between gap-3 border-b border-prior-border px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate font-serif text-sm text-prior-black">{selectedGuide.article_title}</p>
                  <p className="text-xs text-prior-muted">
                    {selectedGuide.places.length} places{guideQuery ? ` · ${guideFilteredPlaces.length} matching` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <input
                    type="text"
                    value={guideQuery}
                    onChange={(e) => setGuideQuery(e.target.value)}
                    placeholder="Filter…"
                    className="w-28 rounded-xl border border-prior-border bg-white px-3 py-1.5 text-xs font-serif text-prior-black outline-none transition-colors placeholder:text-prior-muted focus:border-prior-mid"
                  />

                  {/* Per-guide check dropdown */}
                  <div className="relative">
                    <button
                      type="button"
                      disabled={guideCheckBusy !== '' || busyAction !== ''}
                      onClick={() => setGuideCheckOpen((o) => !o)}
                      className="flex items-center gap-1 rounded-xl border border-prior-border bg-white px-2.5 py-1.5 text-xs font-serif text-prior-black transition-colors hover:border-prior-mid disabled:opacity-50"
                    >
                      {guideCheckBusy ? 'Running…' : 'Check'}
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>

                    {guideCheckOpen && (
                      <>
                        {/* Click-away overlay */}
                        <div className="fixed inset-0 z-10" onClick={() => setGuideCheckOpen(false)} />
                        <div className="absolute right-0 top-full z-20 mt-1 w-52 rounded-2xl border border-prior-border bg-white py-1.5 shadow-lg">
                          {[
                            {
                              label: 'Full pipeline',
                              sub: 'Website → Maps → AI',
                              action: async () => {
                                setGuideCheckBusy('full');
                                setGuideCheckOpen(false);
                                const placeIds = selectedGuide.places.map((p) => p.id);
                                await fetch('/api/location-monitor/full-review-all', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ mode: 'all', placeIds }),
                                });
                                setGuideCheckBusy('');
                                loadData(false);
                              },
                            },
                            {
                              label: 'Website check',
                              sub: 'Check all venue websites',
                              action: async () => {
                                setGuideCheckBusy('website');
                                setGuideCheckOpen(false);
                                const placeIds = selectedGuide.places.map((p) => p.id);
                                await fetch('/api/location-monitor/website-check-all', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ placeIds }),
                                });
                                setGuideCheckBusy('');
                                loadData(false);
                              },
                            },
                            {
                              label: 'AI review',
                              sub: 'Claude reviews website evidence',
                              disabled: !configured.anthropic,
                              action: async () => {
                                setGuideCheckBusy('ai');
                                setGuideCheckOpen(false);
                                const placeIds = selectedGuide.places.map((p) => p.id);
                                await fetch('/api/location-monitor/review-all', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ placeIds }),
                                });
                                setGuideCheckBusy('');
                                loadData(false);
                              },
                            },
                            {
                              label: 'Google Maps check',
                              sub: 'Verify via Places API',
                              disabled: !configured.googleMaps,
                              action: async () => {
                                setGuideCheckBusy('maps');
                                setGuideCheckOpen(false);
                                const placeIds = selectedGuide.places.map((p) => p.id);
                                await fetch('/api/location-monitor/check-all', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ placeIds }),
                                });
                                setGuideCheckBusy('');
                                loadData(false);
                              },
                            },
                          ].map(({ label, sub, action, disabled }) => (
                            <button
                              key={label}
                              type="button"
                              disabled={disabled}
                              onClick={action}
                              className="w-full px-4 py-2.5 text-left transition-colors hover:bg-prior-cream/60 disabled:opacity-40"
                            >
                              <p className="text-xs font-serif font-medium text-prior-black">{label}</p>
                              <p className="text-[11px] text-prior-muted">{sub}</p>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {selectedGuide.article_url && (
                    <a href={selectedGuide.article_url} target="_blank" rel="noreferrer" className="text-xs text-prior-muted underline underline-offset-2 whitespace-nowrap">
                      Open →
                    </a>
                  )}
                </div>
              </div>

              <div className="max-h-[65vh] overflow-y-auto">
                {(() => {
                  const sections = new Map();
                  for (const place of guideFilteredPlaces) {
                    const s = place.section || 'General';
                    if (!sections.has(s)) sections.set(s, []);
                    sections.get(s).push(place);
                  }
                  if (sections.size === 0) {
                    return <div className="px-4 py-6 text-sm text-prior-muted font-serif">No places match.</div>;
                  }
                  return [...sections.entries()].map(([section, sectionPlaces]) => (
                    <div key={section}>
                      <div className="border-b border-prior-border bg-prior-cream/40 px-4 py-1.5">
                        <p className="text-xs uppercase tracking-[0.14em] text-prior-muted">{section}</p>
                      </div>
                      <div className="divide-y divide-prior-border/60">
                        {sectionPlaces.map((place) => (
                          <div key={place.id} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <div className="truncate font-serif text-sm text-prior-black">{place.business_name}</div>
                              {place.website_url && (
                                <a
                                  href={place.website_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-0.5 block truncate text-xs text-prior-muted underline underline-offset-2"
                                  title={place.website_url}
                                >
                                  {place.website_url}
                                </a>
                              )}
                              {place.address && (
                                <div className="mt-0.5 truncate text-xs text-prior-body" title={place.address}>
                                  {place.address}
                                </div>
                              )}
                            </div>
                            <div className="shrink-0 space-y-1">
                              <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-serif capitalize ${statusTone(place.website_check_status || place.check_status)}`}>
                                {prettyStatus(place.website_check_status || 'pending')}
                              </span>
                              {place.ai_review_status && place.ai_review_status !== 'pending' && (
                                <div>
                                  <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-serif capitalize ${statusTone(place.ai_review_status)}`}>
                                    {prettyStatus(place.ai_review_status)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}
        </section>

          <section className="rounded-3xl border border-prior-border bg-white p-4 shadow-sm">
            <h2 className="text-base font-serif font-medium text-prior-black">Guides Needing Attention</h2>
            {articleRollups.length === 0 ? (
              <p className="mt-3 text-sm text-prior-muted font-serif">No article-level rollups available yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {articleRollups.slice(0, 5).map((article) => {
                  const totalRisk = (article.website_at_risk_count || 0) + (article.ai_at_risk_count || 0);
                  return (
                    <div key={article.article_id || article.article_url || article.article_title} className="border-b border-prior-border/70 pb-2.5 last:border-b-0 last:pb-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-serif text-sm text-prior-black truncate">{article.article_title}</p>
                          <p className="text-xs text-prior-muted">
                            {article.total_places} place{article.total_places === 1 ? '' : 's'} · Web: {article.website_at_risk_count || 0} · AI: {article.ai_at_risk_count || 0}
                          </p>
                        </div>
                        <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-serif ${totalRisk > 0 ? statusTone('needs_review') : statusTone('active')}`}>
                          {totalRisk > 0 ? `${totalRisk} at risk` : 'Stable'}
                        </span>
                      </div>
                      {article.article_url && (
                        <a href={article.article_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-prior-muted underline underline-offset-2">
                          Open guide
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-prior-border bg-white p-4 shadow-sm">
            <h2 className="text-base font-serif font-medium text-prior-black">Current Read</h2>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm font-serif text-prior-body">
              <span>Closed by Maps</span><span className="text-right font-medium text-prior-black">{summary.closed_count || 0}</span>
              <span>Not found by Maps</span><span className="text-right font-medium text-prior-black">{summary.not_found_count || 0}</span>
              <span>Website suspect</span><span className="text-right font-medium text-prior-black">{summary.website_suspect_count || 0}</span>
              <span>Website errors</span><span className="text-right font-medium text-prior-black">{summary.website_error_count || 0}</span>
              <span>AI likely closed</span><span className="text-right font-medium text-prior-black">{summary.ai_closed_count || 0}</span>
              <span>AI likely changed</span><span className="text-right font-medium text-prior-black">{summary.ai_changed_count || 0}</span>
            </div>
            <div className="mt-3 space-y-1 text-xs text-prior-muted font-serif border-t border-prior-border/60 pt-3">
              <p>Last import: {summary.last_import_at ? formatDateTime(summary.last_import_at) : 'Never'}</p>
              <p>Last website check: {summary.website_checked_at ? formatDateTime(summary.website_checked_at) : 'Never'}</p>
              <p>Last AI review: {summary.ai_reviewed_at ? formatDateTime(summary.ai_reviewed_at) : 'Never'}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-prior-border bg-white p-4 shadow-sm">
            <h2 className="text-base font-serif font-medium text-prior-black">Recent Website Checks</h2>
            {recentWebsiteChecks.length === 0 ? (
              <p className="mt-3 text-sm text-prior-muted font-serif">No website checks recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {recentWebsiteChecks.slice(0, 5).map((check) => (
                  <div key={check.id} className="border-b border-prior-border/70 pb-2.5 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-serif text-sm text-prior-black truncate">{check.business_name}</p>
                        <p className="text-xs text-prior-muted truncate">{check.article_title}</p>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-serif ${statusTone(check.check_status)}`}>
                        {prettyStatus(check.check_status)}
                      </span>
                    </div>
                    {check.signal_summary && (
                      <p className="mt-1 text-xs text-prior-body line-clamp-1">{check.signal_summary}</p>
                    )}
                    <p className="mt-1 text-xs text-prior-muted">{formatDateTime(check.checked_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-prior-border bg-white p-4 shadow-sm">
            <h2 className="text-base font-serif font-medium text-prior-black">Recent AI Reviews</h2>
            {recentAiReviews.length === 0 ? (
              <p className="mt-3 text-sm text-prior-muted font-serif">No AI reviews recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {recentAiReviews.slice(0, 5).map((review) => (
                  <div key={review.id} className="border-b border-prior-border/70 pb-2.5 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-serif text-sm text-prior-black truncate">{review.business_name}</p>
                        <p className="text-xs text-prior-muted truncate">{review.article_title}</p>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-serif ${statusTone(review.review_status)}`}>
                        {prettyStatus(review.review_status)}
                      </span>
                    </div>
                    {review.summary && <p className="mt-1 text-xs text-prior-body line-clamp-1">{review.summary}</p>}
                    <p className="mt-1 text-xs text-prior-muted">{formatDateTime(review.reviewed_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-prior-border bg-white p-4 shadow-sm">
            <h2 className="text-base font-serif font-medium text-prior-black">Recent Google Maps Checks</h2>
            {recentChecks.length === 0 ? (
              <p className="mt-3 text-sm text-prior-muted font-serif">No Google Maps checks recorded yet.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {recentChecks.slice(0, 5).map((check) => (
                  <div key={check.id} className="border-b border-prior-border/70 pb-2.5 last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-serif text-sm text-prior-black truncate">{check.business_name}</p>
                        <p className="text-xs text-prior-muted truncate">{check.article_title}</p>
                      </div>
                      <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-serif ${statusTone(check.check_status)}`}>
                        {prettyStatus(check.check_status)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-prior-muted">{formatDateTime(check.checked_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Guide Browser moved to right column above */}
      {false && <section className="rounded-3xl border border-prior-border bg-white shadow-sm">
        <div className="border-b border-prior-border px-6 py-5">
          <h2 className="text-xl font-serif text-prior-black">Guide Browser</h2>
          <p className="mt-1 text-sm text-prior-body font-serif">
            Browse every location across your Prior guides. Select a guide to see all its places regardless of check status.
          </p>
        </div>

        {/* Guide cards grid */}
        <div className="grid grid-cols-2 gap-3 p-6 md:grid-cols-3 xl:grid-cols-4">
          {guideGroups.map((guide) => {
            const atRisk = guide.places.filter((p) =>
              ['suspect', 'error'].includes(p.website_check_status)
              || ['needs_review', 'likely_changed', 'likely_closed'].includes(p.ai_review_status)
              || ['closed', 'not_found', 'error'].includes(p.check_status)
            ).length;
            const isSelected = selectedGuideId === guide.article_id;
            return (
              <button
                key={guide.article_id}
                type="button"
                onClick={() => {
                  setSelectedGuideId(isSelected ? null : guide.article_id);
                  setGuideQuery('');
                }}
                className={`rounded-2xl border p-4 text-left transition-colors ${
                  isSelected
                    ? 'border-prior-black bg-prior-black'
                    : 'border-prior-border bg-white hover:border-prior-mid'
                }`}
              >
                <p className={`truncate font-serif text-sm font-medium ${isSelected ? 'text-white' : 'text-prior-black'}`}>
                  {guide.article_title}
                </p>
                <p className={`mt-1 text-xs ${isSelected ? 'text-white/60' : 'text-prior-muted'}`}>
                  {guide.places.length} place{guide.places.length !== 1 ? 's' : ''}
                </p>
                {atRisk > 0 && (
                  <span className="mt-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-serif text-amber-900">
                    {atRisk} at risk
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Places panel for selected guide */}
        {selectedGuide && (
          <div className="border-t border-prior-border">
            {/* Panel header */}
            <div className="flex flex-col gap-3 border-b border-prior-border px-6 py-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="font-serif text-prior-black">{selectedGuide.article_title}</h3>
                <p className="text-xs text-prior-muted">
                  {selectedGuide.places.length} places
                  {guideQuery && ` · ${guideFilteredPlaces.length} matching`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={guideQuery}
                  onChange={(e) => setGuideQuery(e.target.value)}
                  placeholder="Filter places…"
                  className="w-48 rounded-xl border border-prior-border bg-white px-3 py-2 text-sm font-serif text-prior-black outline-none transition-colors placeholder:text-prior-muted focus:border-prior-mid"
                />
                {selectedGuide.article_url && (
                  <a
                    href={selectedGuide.article_url}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs text-prior-muted underline underline-offset-2"
                  >
                    Open guide →
                  </a>
                )}
              </div>
            </div>

            {/* Places grouped by section */}
            {(() => {
              const sections = new Map();
              for (const place of guideFilteredPlaces) {
                const s = place.section || 'General';
                if (!sections.has(s)) sections.set(s, []);
                sections.get(s).push(place);
              }

              if (sections.size === 0) {
                return (
                  <div className="px-6 py-8 text-sm text-prior-muted font-serif">
                    No places match your filter.
                  </div>
                );
              }

              return [...sections.entries()].map(([section, sectionPlaces]) => (
                <div key={section}>
                  <div className="border-b border-prior-border bg-prior-cream/40 px-6 py-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-prior-muted">{section}</p>
                  </div>
                  <div className="divide-y divide-prior-border/60">
                    {sectionPlaces.map((place) => (
                      <div
                        key={place.id}
                        className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,auto)] gap-4 px-6 py-3 items-start"
                      >
                        {/* Name, URL, address */}
                        <div className="min-w-0">
                          <div className="truncate font-serif text-sm text-prior-black">{place.business_name}</div>
                          {place.website_url && (
                            <a
                              href={place.website_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-0.5 block truncate text-xs text-prior-muted underline underline-offset-2"
                              title={place.website_url}
                            >
                              {place.website_url}
                            </a>
                          )}
                          {place.address && (
                            <div className="mt-0.5 truncate text-xs text-prior-body" title={place.address}>
                              {place.address}
                            </div>
                          )}
                        </div>

                        {/* AI or website signal summary */}
                        <div className="min-w-0 text-xs text-prior-body">
                          {place.ai_review_summary
                            ? <p className="line-clamp-2">{place.ai_review_summary}</p>
                            : place.website_signal_summary
                              ? <p className="line-clamp-2 text-prior-muted">{place.website_signal_summary}</p>
                              : null}
                        </div>

                        {/* Status badges */}
                        <div className="shrink-0 space-y-1">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-serif capitalize ${statusTone(place.website_check_status || place.check_status)}`}>
                            Web: {prettyStatus(place.website_check_status || 'pending')}
                          </span>
                          {place.ai_review_status && place.ai_review_status !== 'pending' && (
                            <div>
                              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-serif capitalize ${statusTone(place.ai_review_status)}`}>
                                AI: {prettyStatus(place.ai_review_status)}
                              </span>
                            </div>
                          )}
                          {place.check_status && place.check_status !== 'pending' && (
                            <div className="text-xs text-prior-muted">Maps: {prettyStatus(place.check_status)}</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
      </section>}
    </div>
  );
}
