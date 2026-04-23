import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiCard from './components/KpiCard';
import ChartWrapper from './components/ChartWrapper';
import InsightsSummary from './components/InsightsSummary';
import DataFreshnessBanner from './components/DataFreshnessBanner';

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function pct(n) {
  if (n == null) return '—';
  return (n * 100).toFixed(1) + '%';
}

function formatDate(d) {
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatRangeLabel(range) {
  if (!range?.startDate || !range?.endDate) return 'previous period';

  const start = new Date(`${range.startDate}T00:00:00`);
  const end = new Date(`${range.endDate}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const endText = end.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${startText} to ${endText}`;
}

function formatSignedPercent(value) {
  if (value == null) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1)}%`;
}

function formatSignedPoints(value) {
  if (value == null) return null;
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${(value * 100).toFixed(1)} pt`;
}

function getPercentChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function getPointChange(current, previous) {
  if (current == null || previous == null) return null;
  return current - previous;
}

function buildTrendText(label, formattedChange) {
  if (!formattedChange) return null;
  return `${formattedChange} vs ${label}`;
}

function getTrendTone(value, positiveDirection = 'up') {
  if (value == null || value === 0) return 'neutral';
  if (positiveDirection === 'down') {
    return value < 0 ? 'up' : 'down';
  }
  return value > 0 ? 'up' : 'down';
}

const TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: '8px',
  fontFamily: '"Libre Baskerville", Georgia, serif',
  fontSize: '12px',
};

export default function OverviewTab({ dateRange, syncStatus, onNavigateToInsights }) {
  const [overview, setOverview] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const primaryStatus = syncStatus?.google_analytics?.status === 'failed'
    ? syncStatus.google_analytics
    : syncStatus?.instagram?.status === 'failed'
        ? syncStatus.instagram
        : syncStatus?.google_analytics?.status === 'skipped'
          ? syncStatus.google_analytics
          : syncStatus?.instagram?.status === 'skipped'
              ? syncStatus.instagram
              : null;

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange.start) params.set('start', dateRange.start);
    if (dateRange.end) params.set('end', dateRange.end);
    const qs = params.toString();

    Promise.all([
      fetch(`/api/analytics/overview?${qs}`).then(r => r.json()),
      fetch(`/api/analytics/ga?${qs}`).then(r => r.json()),
      fetch(`/api/analytics/instagram?${qs}`).then(r => r.json()),
    ])
      .then(([ov, ga, ig]) => {
        setOverview(ov.data);

        // Aggregate GA pages by date
        const pagesByDate = {};
        for (const p of (ga.data?.pages || [])) {
          pagesByDate[p.date] = (pagesByDate[p.date] || 0) + p.page_views;
        }

        // IG profile by date
        const followersByDate = {};
        for (const p of (ig.data?.profile || [])) {
          followersByDate[p.date] = p.followers;
        }

        // Merge into trend
        const allDates = [...new Set([...Object.keys(pagesByDate), ...Object.keys(followersByDate)])].sort();
        const trend = allDates.map(date => ({
          date,
          pageViews: pagesByDate[date] || 0,
          followers: followersByDate[date] || null,
        }));
        setTrendData(trend);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange.start, dateRange.end]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-prior-border/20 rounded-xl" />)}
        </div>
        <div className="h-80 bg-prior-border/20 rounded-xl" />
      </div>
    );
  }

  if (!overview) return <div className="text-prior-muted font-serif text-center py-12">Failed to load data</div>;

  const previous = overview.previous_period || {};
  const comparisonLabel = formatRangeLabel(overview.comparison_range);
  const klaviyoMetricsStatus = overview.klaviyo.metrics_status || {};
  const recipientChange = getPercentChange(overview.klaviyo.total_recipients, previous.klaviyo?.total_recipients);
  const openRateChange = getPointChange(overview.klaviyo.avg_open_rate, previous.klaviyo?.avg_open_rate);
  const clickRateChange = getPointChange(overview.klaviyo.avg_click_rate, previous.klaviyo?.avg_click_rate);
  const pageViewsChange = getPercentChange(overview.google_analytics.total_page_views, previous.google_analytics?.total_page_views);
  const sessionsChange = getPercentChange(overview.google_analytics.total_sessions, previous.google_analytics?.total_sessions);
  const engagedSessionsChange = getPercentChange(overview.google_analytics.engaged_sessions, previous.google_analytics?.engaged_sessions);
  const followersChange = getPercentChange(overview.instagram.followers, previous.instagram?.followers);

  return (
    <div className="space-y-6">
      <DataFreshnessBanner
        source="Analytics sources"
        status={primaryStatus}
        dataCount={null}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-prior-border bg-white px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">Comparison window</div>
          <div className="mt-1 text-sm font-serif text-prior-body">
            Current selection compared with {comparisonLabel}
          </div>
        </div>
        <div className="text-xs text-prior-muted font-serif">
          Newsletter, search, and audience signals in one view
        </div>
      </div>

      {klaviyoMetricsStatus.last_metadata_sync_at && !klaviyoMetricsStatus.last_csv_import_at && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-serif">
          Klaviyo campaign metadata is synced, but newsletter performance metrics are waiting on the weekly CSV import.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Newsletter Reach"
          value={fmt(overview.klaviyo.total_recipients)}
          subtitle={`${overview.klaviyo.campaigns_count} campaigns`}
          trendText={buildTrendText(comparisonLabel, formatSignedPercent(recipientChange))}
          trendTone={getTrendTone(recipientChange)}
        />
        <KpiCard
          label="Email Open Rate"
          value={pct(overview.klaviyo.avg_open_rate)}
          subtitle="Average across sends"
          trendText={buildTrendText(comparisonLabel, formatSignedPoints(openRateChange))}
          trendTone={getTrendTone(openRateChange)}
        />
        <KpiCard
          label="Email Click Rate"
          value={pct(overview.klaviyo.avg_click_rate)}
          subtitle="Average across sends"
          trendText={buildTrendText(comparisonLabel, formatSignedPoints(clickRateChange))}
          trendTone={getTrendTone(clickRateChange)}
        />
        <KpiCard
          label="Page Views"
          value={fmt(overview.google_analytics.total_page_views)}
          subtitle={`${fmt(overview.google_analytics.total_sessions)} sessions`}
          trendText={buildTrendText(comparisonLabel, formatSignedPercent(pageViewsChange))}
          trendTone={getTrendTone(pageViewsChange)}
        />
        <KpiCard
          label="Engaged Sessions"
          value={fmt(overview.google_analytics.engaged_sessions)}
          subtitle={`${pct(overview.google_analytics.engagement_rate)} engagement rate`}
          trendText={buildTrendText(comparisonLabel, formatSignedPercent(engagedSessionsChange))}
          trendTone={getTrendTone(engagedSessionsChange)}
        />
        <KpiCard
          label="Followers"
          value={fmt(overview.instagram.followers)}
          subtitle="Instagram"
          trendText={buildTrendText(comparisonLabel, formatSignedPercent(followersChange))}
          trendTone={getTrendTone(followersChange)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-prior-border bg-white px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">Top Landing Page</div>
          <div className="mt-2 text-sm font-serif text-prior-black">
            {overview.google_analytics.top_feature_page?.path || '—'}
          </div>
          <div className="mt-1 text-xs font-serif text-prior-muted">
            {fmt(overview.google_analytics.top_feature_page?.landing_page_sessions)} landing sessions
          </div>
        </div>
        <div className="rounded-xl border border-prior-border bg-white px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">Top Traffic Source</div>
          <div className="mt-2 text-sm font-serif text-prior-black">
            {overview.google_analytics.top_traffic_source_by_quality?.source || '—'}
          </div>
          <div className="mt-1 text-xs font-serif text-prior-muted">
            {overview.google_analytics.top_traffic_source_by_quality?.engagement_rate != null
              ? `${(overview.google_analytics.top_traffic_source_by_quality.engagement_rate * 100).toFixed(1)}% engagement`
              : 'Quality metrics unavailable'}
          </div>
        </div>
        <div className="rounded-xl border border-prior-border bg-white px-4 py-4">
          <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">Audience Mix</div>
          <div className="mt-2 text-sm font-serif text-prior-black">
            {pct(overview.google_analytics.new_users_pct)} new / {pct(overview.google_analytics.returning_users_pct)} returning
          </div>
          <div className="mt-1 text-xs font-serif text-prior-muted">
            {buildTrendText(comparisonLabel, formatSignedPercent(sessionsChange)) || 'No comparison yet'}
          </div>
        </div>
      </div>

      {/* Intelligence Summary */}
      <InsightsSummary onNavigateToInsights={onNavigateToInsights} />

      {/* Combined Trend Chart */}
      <ChartWrapper title="Engagement Trend" subtitle="Daily page views & follower growth">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trendData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }}
              tickLine={false}
              axisLine={{ stroke: '#D9D9D9' }}
            />
            <YAxis
              yAxisId="left"
              tickFormatter={fmt}
              tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickFormatter={fmt}
              tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} />
            <Legend wrapperStyle={{ fontFamily: '"Libre Baskerville"', fontSize: 12 }} />
            <Line yAxisId="left" type="monotone" dataKey="pageViews" name="Page Views" stroke="#000000" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="followers" name="Followers" stroke="#93C47D" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </ChartWrapper>
    </div>
  );
}
