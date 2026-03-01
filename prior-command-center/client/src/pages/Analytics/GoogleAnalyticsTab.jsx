import { useState, useEffect } from 'react';
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiCard from './components/KpiCard';
import ChartWrapper from './components/ChartWrapper';
import SortableTable from './components/SortableTable';

const TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: '8px',
  fontFamily: '"Libre Baskerville", Georgia, serif',
  fontSize: '12px',
};

const PIE_COLORS = ['#000000', '#666666', '#93C47D', '#6AA84F', '#F9CB9C', '#999999', '#38761D', '#FFE599'];

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

const TABLE_COLUMNS = [
  { key: 'page_path', label: 'Page', align: 'left' },
  { key: 'total_views', label: 'Views', align: 'right', format: v => v?.toLocaleString() },
  { key: 'total_sessions', label: 'Sessions', align: 'right', format: v => v?.toLocaleString() },
  { key: 'avg_duration', label: 'Avg Duration', align: 'right', format: formatDuration },
  { key: 'avg_engagement', label: 'Engagement', align: 'right', format: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
  { key: 'avg_bounce', label: 'Bounce Rate', align: 'right', format: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
];

export default function GoogleAnalyticsTab({ dateRange }) {
  const [gaData, setGaData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const { pages, traffic } = gaData;

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
  const donutData = Object.entries(sessionsBySource)
    .sort(([, a], [, b]) => b - a)
    .map(([source, sessions]) => ({ name: source, value: sessions }));

  // Aggregate pages by path for table
  const pageAgg = {};
  for (const p of pages) {
    if (!pageAgg[p.page_path]) {
      pageAgg[p.page_path] = { page_path: p.page_path, total_views: 0, total_sessions: 0, durations: [], engagements: [], bounces: [] };
    }
    const agg = pageAgg[p.page_path];
    agg.total_views += p.page_views || 0;
    agg.total_sessions += p.sessions || 0;
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Page Views" value={fmt(totalViews)} />
        <KpiCard label="Total Sessions" value={fmt(totalSessions)} />
        <KpiCard label="Avg Engagement Rate" value={avgEngagement != null ? (avgEngagement * 100).toFixed(1) + '%' : '—'} />
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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={donutData} cx="50%" cy="45%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="value" nameKey="name">
                {donutData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [v.toLocaleString() + ' sessions', '']} />
              <Legend wrapperStyle={{ fontFamily: '"Libre Baskerville"', fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
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
