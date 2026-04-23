import { useState, useEffect } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import KpiCard from './components/KpiCard';
import ChartWrapper from './components/ChartWrapper';
import SortableTable from './components/SortableTable';
import DataFreshnessBanner from './components/DataFreshnessBanner';

const TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: '8px',
  fontFamily: '"Libre Baskerville", Georgia, serif',
  fontSize: '12px',
};

const PIE_COLORS = ['#000000', '#666666', '#93C47D', '#6AA84F', '#F9CB9C', '#999999', '#38761D', '#FFE599'];
const TRAFFIC_SOURCE_LIMIT = 6;
const TRAFFIC_SOURCE_COLLAPSED_LIST_LIMIT = 5;
const TRAFFIC_SOURCE_GROUPS = [
  {
    key: 'direct',
    label: 'Direct / Unknown',
    matches: [
      'direct',
      '(direct)',
      'none',
      '(none)',
      '(not set)',
      'not set',
      'unassigned',
      'unknown',
    ],
  },
  {
    key: 'search',
    label: 'Search',
    patterns: [
      /^google$/,
      /^bing$/,
      /^yahoo$/,
      /^duckduckgo$/,
      /^baidu$/,
      /^yandex$/,
      /^ecosia$/,
      /(?:^|[\s.])search(?:$|[\s.])/,
      /(?:^|[\s.])bing\.com$/,
      /(?:^|[\s.])google\.com$/,
      /(?:^|[\s.])yahoo\.com$/,
      /(?:^|[\s.])duckduckgo\.com$/,
    ],
  },
  {
    key: 'social',
    label: 'Social',
    matches: [
      'facebook',
      'instagram',
      'linkedin',
      'twitter',
      'x.com',
      't.co',
      'threads',
      'reddit',
      'pinterest',
      'youtube',
      'tiktok',
      'snapchat',
      'mastodon',
      'bluesky',
    ],
  },
  {
    key: 'email',
    label: 'Email / Newsletter',
    matches: [
      'email',
      'newsletter',
      'mailchimp',
      'klaviyo',
      'substack',
      'campaign',
      'sendgrid',
      'mailerlite',
      'beehiiv',
      'convertkit',
    ],
  },
  {
    key: 'internal',
    label: 'Internal / tools',
    matches: [
      'master',
      'navbar',
      'gating',
      'activemembers',
      'contact list',
      'repeat client',
      'one time purchase',
      'never purchased',
      'stripe',
      'formstack',
      'salesforce',
      'lightning.force.com',
      'workfront',
      'docs.google.com',
      'mail.google.com',
      'teams.cdn.office.net',
      'officeapps.live.com',
      'zoom.us',
    ],
  },
  {
    key: 'ai',
    label: 'AI Tools',
    matches: [
      'chatgpt',
      'openai',
      'perplexity',
      'claude',
      'anthropic',
      'gemini',
      'copilot',
      'poe',
      'you.com',
    ],
  },
];

const KNOWN_DOMAIN_LABELS = {
  'substack.com': 'Substack',
  'beehiiv.com': 'Beehiiv',
  'facebook.com': 'Facebook',
  'instagram.com': 'Instagram',
  'pinterest.com': 'Pinterest',
  'google.com': 'Google',
  'linkedin.com': 'LinkedIn',
  'yahoo.com': 'Yahoo',
  'bing.com': 'Bing',
  'duckduckgo.com': 'DuckDuckGo',
  'ecosia.org': 'Ecosia',
  'openai.com': 'OpenAI',
  'anthropic.com': 'Anthropic',
  'perplexity.ai': 'Perplexity',
  'capitalone.com': 'Capital One',
  'salesforce.com': 'Salesforce',
  'zoom.us': 'Zoom',
  'microsoft.com': 'Microsoft',
  'apple.com': 'Apple',
  'canva.com': 'Canva',
  'adobe.com': 'Adobe',
};

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDate(d) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDuration(secs) {
  if (!secs) return '0s';
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function normalizeTrafficSourceName(source) {
  const raw = String(source || '').trim();
  if (!raw) return 'Unknown';
  const lowered = raw.toLowerCase();
  if (lowered.startsWith('http://') || lowered.startsWith('https://')) {
    try {
      const host = new URL(raw).hostname.replace(/^www\./, '');
      return host || raw;
    } catch {
      return raw;
    }
  }
  return raw.replace(/^www\./, '');
}

function getHostnameFromSource(source) {
  const raw = String(source || '').trim();
  if (!raw) return '';
  const normalized = normalizeTrafficSourceName(raw);

  if (normalized.includes('://')) {
    try {
      return new URL(normalized).hostname.toLowerCase();
    } catch {
      return normalized.toLowerCase();
    }
  }

  return normalized.toLowerCase();
}

function getRootDomain(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^www\./, '');
  if (!host.includes('.')) return host;

  const parts = host.split('.');
  if (parts.length <= 2) return host;

  const suffix = parts.slice(-2).join('.');
  const multiLevelSuffixes = new Set([
    'co.uk', 'org.uk', 'ac.uk',
    'com.au', 'net.au', 'org.au',
    'co.nz', 'org.nz',
    'co.jp', 'ne.jp',
    'com.br', 'com.mx', 'com.ar',
    'co.in', 'co.za', 'co.kr',
    'com.sg', 'com.tr',
  ]);

  if (multiLevelSuffixes.has(suffix) && parts.length >= 3) {
    return parts.slice(-3).join('.');
  }

  return parts.slice(-2).join('.');
}

function formatDomainLabel(domain) {
  const normalized = String(domain || '').toLowerCase();
  if (!normalized) return 'Referral sites';
  return KNOWN_DOMAIN_LABELS[normalized] || normalized;
}

function matchesAnyPattern(value, patterns = []) {
  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) return pattern.test(value);
    return value.includes(pattern);
  });
}

function classifyTrafficSource(source) {
  const normalized = normalizeTrafficSourceName(source).toLowerCase();
  const hostname = getHostnameFromSource(source);

  for (const group of TRAFFIC_SOURCE_GROUPS) {
    if (group.matches && group.matches.some((match) => normalized.includes(match))) {
      return { key: group.key, label: group.label };
    }
    if (group.patterns && matchesAnyPattern(normalized, group.patterns)) {
      return { key: group.key, label: group.label };
    }
  }

  if (hostname.includes('.') || hostname.includes('/')) {
    const domain = getRootDomain(hostname);
    return {
      key: `referral:${domain}`,
      label: formatDomainLabel(domain),
    };
  }

  return { key: 'other', label: 'Other sources' };
}

function buildTrafficSourceBuckets(sourceBreakdown) {
  const topSources = sourceBreakdown.slice(0, TRAFFIC_SOURCE_LIMIT);
  const tailSources = sourceBreakdown.slice(TRAFFIC_SOURCE_LIMIT);

  const groupedTailMap = new Map();
  for (const source of tailSources) {
    const bucket = classifyTrafficSource(source.name);
    const existing = groupedTailMap.get(bucket.key) || {
      key: bucket.key,
      label: bucket.label,
      value: 0,
      sourceCount: 0,
      sources: [],
    };

    existing.value += source.value;
    existing.sourceCount += 1;
    existing.sources.push(source);
    groupedTailMap.set(bucket.key, existing);
  }

  const groupedTail = [...groupedTailMap.values()]
    .sort((a, b) => b.value - a.value)
    .map((group) => ({
      ...group,
      name: `${group.label} (${group.sourceCount} sources)`,
      isGroup: true,
      previewSources: group.sources
        .slice(0, 3)
        .map((source) => source.name)
        .join(', '),
    }));

  return { topSources, groupedTail, tailSources };
}

function buildTrafficSourceExportText({ sourceBreakdown, topSources, groupedTail, totalSessions }) {
  const lines = [
    'Google Analytics traffic sources',
    `Total sessions: ${fmt(totalSessions)}`,
    '',
    'Top sources',
  ];

  topSources.forEach((source, index) => {
    lines.push(`${index + 1}. ${normalizeTrafficSourceName(source.name)}\t${source.value}`);
  });

  if (groupedTail.length > 0) {
    lines.push('');
    lines.push('Grouped long-tail sources');
    groupedTail.forEach((group) => {
      const preview = group.previewSources ? ` - ${group.previewSources}` : '';
      lines.push(`${group.label} (${group.sourceCount} sources)\t${group.value}${preview}`);
    });
  }

  lines.push('');
  lines.push('Full source list');
  lines.push('Source\tSessions');
  sourceBreakdown.forEach((source) => {
    lines.push(`${normalizeTrafficSourceName(source.name)}\t${source.value}`);
  });

  return lines.join('\n');
}

async function copyOrExportTrafficSources(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return 'Copied to clipboard';
    } catch {
      // Fall through to the file download fallback.
    }
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `google-analytics-traffic-sources-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
    return 'Downloaded CSV';
  }

  return 'Unable to export';
}

const TABLE_COLUMNS = [
  { key: 'page_path', label: 'Page', align: 'left' },
  { key: 'total_views', label: 'Views', align: 'right', format: v => v?.toLocaleString() },
  { key: 'total_sessions', label: 'Sessions', align: 'right', format: v => v?.toLocaleString() },
  { key: 'landing_page_sessions', label: 'Landing Sessions', align: 'right', format: v => v?.toLocaleString() || '—' },
  { key: 'engaged_sessions', label: 'Engaged', align: 'right', format: v => v?.toLocaleString() || '—' },
  { key: 'key_events', label: 'Key Events', align: 'right', format: v => v != null ? Number(v).toLocaleString() : '—' },
  { key: 'avg_duration', label: 'Avg Duration', align: 'right', format: formatDuration },
  { key: 'avg_engagement', label: 'Engagement', align: 'right', format: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
  { key: 'avg_bounce', label: 'Bounce Rate', align: 'right', format: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
];

export default function GoogleAnalyticsTab({ dateRange, syncStatus }) {
  const [gaData, setGaData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAllSources, setShowAllSources] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange.start) params.set('start', dateRange.start);
    if (dateRange.end) params.set('end', dateRange.end);

    fetch(`/api/analytics/ga?${params}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setGaData(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange.start, dateRange.end]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-prior-border/20 rounded-xl" />)}
        </div>
        <div className="h-80 bg-prior-border/20 rounded-xl" />
      </div>
    );
  }

  if (!gaData) {
    return <div className="text-prior-muted font-serif text-center py-12">No analytics data for this period</div>;
  }

  const { pages, traffic, summary, page_performance: pagePerformance = [] } = gaData;
  const totalRecords = pages.length + traffic.length;

  // Aggregate pages by date for time series
  const viewsByDate = {};
  for (const p of pages) {
    viewsByDate[p.date] = (viewsByDate[p.date] || 0) + p.page_views;
  }
  const timeSeriesData = Object.entries(viewsByDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, views]) => ({ date, pageViews: views }));

  // Aggregate traffic by source for donut
  const sessionsBySource = {};
  for (const t of traffic) {
    sessionsBySource[t.source] = (sessionsBySource[t.source] || 0) + t.sessions;
  }
  const sourceBreakdown = Object.entries(sessionsBySource)
    .sort(([, a], [, b]) => b - a)
    .map(([source, sessions]) => ({ name: source, value: sessions }));
  const { topSources, groupedTail, tailSources } = buildTrafficSourceBuckets(sourceBreakdown);
  const remainingSources = tailSources;
  const otherSessions = remainingSources.reduce((sum, source) => sum + source.value, 0);
  const donutData = otherSessions > 0
    ? [...topSources, { name: 'Other', value: otherSessions }]
    : topSources;
  const visibleSourceList = showAllSources
    ? sourceBreakdown
    : [...topSources, ...groupedTail].slice(0, TRAFFIC_SOURCE_COLLAPSED_LIST_LIMIT);

  // Aggregate pages by path for table
  const pageAgg = {};
  for (const p of pages) {
    if (!pageAgg[p.page_path]) {
      pageAgg[p.page_path] = {
        page_path: p.page_path,
        total_views: 0,
        total_sessions: 0,
        landing_page_sessions: 0,
        engaged_sessions: 0,
        key_events: 0,
        durations: [],
        engagements: [],
        bounces: [],
      };
    }
    const agg = pageAgg[p.page_path];
    agg.total_views += p.page_views || 0;
    agg.total_sessions += p.sessions || 0;
    agg.landing_page_sessions += p.landing_page_sessions || 0;
    agg.engaged_sessions += p.engaged_sessions || 0;
    agg.key_events += p.key_events || 0;
    agg.durations.push(p.avg_session_duration || 0);
    agg.engagements.push(p.engagement_rate || 0);
    agg.bounces.push(p.bounce_rate || 0);
  }
  const topPages = Object.values(pageAgg)
    .map(a => ({
      ...a,
      avg_duration: a.durations.reduce((s, v) => s + v, 0) / a.durations.length,
      avg_engagement: a.engagements.reduce((s, v) => s + v, 0) / a.engagements.length,
      avg_bounce: a.bounces.reduce((s, v) => s + v, 0) / a.bounces.length,
    }))
    .sort((a, b) => b.total_views - a.total_views)
    .slice(0, 10);

  // KPI aggregates
  const totalViews = pages.reduce((s, p) => s + (p.page_views || 0), 0);
  const totalSessions = pages.reduce((s, p) => s + (p.sessions || 0), 0);
  const avgEngagement = pages.length ? pages.reduce((s, p) => s + (p.engagement_rate || 0), 0) / pages.length : null;
  const topLandingPage = [...pagePerformance]
    .sort((a, b) => (b.landing_page_sessions || 0) - (a.landing_page_sessions || 0))[0] || null;
  const totalLandingSessions = pages.reduce((s, p) => s + (p.landing_page_sessions || 0), 0);
  const totalEngagedSessions = summary?.engaged_sessions ?? pages.reduce((s, p) => s + (p.engaged_sessions || 0), 0);
  const totalNewUsers = summary?.new_users ?? 0;
  const totalKeyEvents = summary?.total_key_events ?? pages.reduce((s, p) => s + (p.key_events || 0), 0);
  const exportText = buildTrafficSourceExportText({
    sourceBreakdown,
    topSources,
    groupedTail,
    totalSessions,
  });

  const handleCopySources = async () => {
    const status = await copyOrExportTrafficSources(exportText);
    setCopyStatus(status);
    window.setTimeout(() => setCopyStatus(''), 2500);
  };

  return (
    <div className="space-y-6">
      <DataFreshnessBanner source="Google Analytics" status={syncStatus} dataCount={totalRecords} />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
        <KpiCard label="Total Page Views" value={fmt(totalViews)} />
        <KpiCard label="Total Sessions" value={fmt(totalSessions)} />
        <KpiCard label="Avg Engagement Rate" value={avgEngagement != null ? (avgEngagement * 100).toFixed(1) + '%' : '—'} />
        <KpiCard label="Engaged Sessions" value={fmt(totalEngagedSessions)} />
        <KpiCard label="New Users" value={fmt(totalNewUsers)} />
        <KpiCard label="Key Events" value={fmt(totalKeyEvents)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-prior-border bg-white p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">Landing Page Snapshot</div>
          <div className="mt-3 text-sm font-serif text-prior-body">
            Top landing page: <span className="text-prior-black">{topLandingPage?.path || '—'}</span>
          </div>
          <div className="mt-2 text-sm font-serif text-prior-body">
            Landing sessions in range: <span className="text-prior-black">{fmt(totalLandingSessions)}</span>
          </div>
          <div className="mt-2 text-sm font-serif text-prior-body">
            Top landing-page sessions: <span className="text-prior-black">{fmt(topLandingPage?.landing_page_sessions)}</span>
          </div>
        </div>
        <div className="rounded-xl border border-prior-border bg-white p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">Traffic Quality Snapshot</div>
          <div className="mt-3 text-sm font-serif text-prior-body">
            Best quality source: <span className="text-prior-black">{summary?.top_traffic_source_by_quality?.source || '—'}</span>
          </div>
          <div className="mt-2 text-sm font-serif text-prior-body">
            Engagement rate: <span className="text-prior-black">{summary?.top_traffic_source_by_quality?.engagement_rate != null ? `${(summary.top_traffic_source_by_quality.engagement_rate * 100).toFixed(1)}%` : '—'}</span>
          </div>
          <div className="mt-2 text-sm font-serif text-prior-body">
            Conversion proxy: <span className="text-prior-black">{summary?.top_traffic_source_by_quality?.conversion_rate != null ? `${(summary.top_traffic_source_by_quality.conversion_rate * 100).toFixed(1)}%` : '—'}</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartWrapper title="Page Views Over Time">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={{ stroke: '#D9D9D9' }} />
                <YAxis tickFormatter={fmt} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} />
                <Area type="monotone" dataKey="pageViews" name="Page Views" stroke="#000000" fill="#000000" fillOpacity={0.06} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </div>
        <ChartWrapper title="Traffic Sources">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-serif text-prior-muted">
                Showing the top sources first, with the long tail grouped into readable buckets.
              </p>
              <button
                type="button"
                onClick={handleCopySources}
                className="shrink-0 rounded-full border border-prior-border px-3 py-1 text-xs font-serif text-prior-body hover:border-prior-black hover:text-prior-black"
              >
                Copy / export source list
              </button>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name">
                  {donutData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v.toLocaleString() + ' sessions', '']} />
              </PieChart>
            </ResponsiveContainer>

            {copyStatus && (
              <div className="text-xs font-serif text-prior-body">
                {copyStatus}
              </div>
            )}

            <div className="space-y-2">
              {visibleSourceList.map((source, index) => (
                <div key={source.name} className="flex items-start justify-between gap-3 rounded-lg border border-transparent py-1 text-sm">
                  <div className="flex items-start gap-2 min-w-0">
                    <span
                      className="mt-1 h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-prior-body font-serif">
                        {normalizeTrafficSourceName(source.name)}
                      </div>
                      {source.isGroup && (
                        <div className="text-[11px] font-serif text-prior-muted">
                          {source.name.startsWith('Referral sites')
                            ? source.previewSources
                              ? `Top sites: ${source.previewSources}`
                              : 'Long-tail website referrals grouped together'
                            : source.previewSources
                              ? `Top sources: ${source.previewSources}`
                              : 'Grouped long-tail traffic'}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-prior-black font-serif flex-shrink-0">{fmt(source.value)}</span>
                </div>
              ))}

              {!showAllSources && sourceBreakdown.length > TRAFFIC_SOURCE_COLLAPSED_LIST_LIMIT && (
                <div className="text-[11px] font-serif text-prior-muted">
                  {sourceBreakdown.length - TRAFFIC_SOURCE_COLLAPSED_LIST_LIMIT} more sources hidden until expanded.
                </div>
              )}

              {sourceBreakdown.length > TRAFFIC_SOURCE_COLLAPSED_LIST_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAllSources((prev) => !prev)}
                  className="pt-1 text-xs font-serif text-prior-body underline underline-offset-4 hover:text-prior-black"
                >
                  {showAllSources
                    ? 'Collapse traffic sources'
                    : `Show all ${sourceBreakdown.length} traffic sources`}
                </button>
              )}
            </div>
          </div>
        </ChartWrapper>
      </div>

      {/* Top Pages Table */}
      <div className="bg-white rounded-xl border border-prior-border p-6">
        <h3 className="text-sm font-serif font-bold text-prior-black mb-4">Top Pages</h3>
        <SortableTable columns={TABLE_COLUMNS} data={topPages} defaultSort="total_views" />
      </div>
    </div>
  );
}
