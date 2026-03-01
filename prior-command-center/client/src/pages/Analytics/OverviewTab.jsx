import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiCard from './components/KpiCard';
import ChartWrapper from './components/ChartWrapper';
import InsightsSummary from './components/InsightsSummary';

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

const TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: '8px',
  fontFamily: '"Libre Baskerville", Georgia, serif',
  fontSize: '12px',
};

export default function OverviewTab({ dateRange, onNavigateToInsights }) {
  const [overview, setOverview] = useState(null);
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiCard label="Total Reach" value={fmt(overview.instagram.total_reach)} subtitle="Instagram" />
        <KpiCard label="Avg Engagement" value={fmt(Math.round(overview.instagram.avg_engagement || 0))} subtitle="Per post" />
        <KpiCard label="Email Open Rate" value={pct(overview.klaviyo.avg_open_rate)} subtitle={`${overview.klaviyo.campaigns_count} campaigns`} />
        <KpiCard label="Page Views" value={fmt(overview.google_analytics.total_page_views)} subtitle={`${fmt(overview.google_analytics.total_sessions)} sessions`} />
        <KpiCard label="Followers" value={fmt(overview.instagram.followers)} subtitle="Instagram" />
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
