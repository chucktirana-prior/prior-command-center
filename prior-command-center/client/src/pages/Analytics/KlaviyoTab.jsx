import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
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

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TABLE_COLUMNS = [
  { key: 'name', label: 'Campaign', align: 'left' },
  { key: 'subject', label: 'Subject', align: 'left', format: v => v && v.length > 40 ? v.slice(0, 40) + '...' : v },
  { key: 'send_time', label: 'Sent', align: 'left', format: formatDate },
  { key: 'recipients', label: 'Recipients', align: 'right', format: v => v?.toLocaleString() },
  { key: 'open_rate', label: 'Open Rate', align: 'right', format: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
  { key: 'click_rate', label: 'Click Rate', align: 'right', format: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
  { key: 'bounce_rate', label: 'Bounce', align: 'right', format: v => v != null ? (v * 100).toFixed(1) + '%' : '—' },
  { key: 'revenue', label: 'Revenue', align: 'right', format: v => v != null ? '$' + v.toLocaleString() : '—' },
];

export default function KlaviyoTab({ dateRange }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange.start) params.set('start', dateRange.start);
    if (dateRange.end) params.set('end', dateRange.end);

    fetch(`/api/analytics/klaviyo?${params}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setData(json.data); })
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

  if (!data.length) {
    return <div className="text-prior-muted font-serif text-center py-12">No campaign data for this period</div>;
  }

  const totalRevenue = data.reduce((s, c) => s + (c.revenue || 0), 0);
  const avgOpen = data.reduce((s, c) => s + (c.open_rate || 0), 0) / data.length;
  const avgClick = data.reduce((s, c) => s + (c.click_rate || 0), 0) / data.length;

  // Chart data sorted chronologically
  const chartData = [...data].sort((a, b) => new Date(a.send_time) - new Date(b.send_time)).map(c => ({
    name: c.name,
    date: c.send_time,
    openRate: c.open_rate ? +(c.open_rate * 100).toFixed(1) : 0,
    clickRate: c.click_rate ? +(c.click_rate * 100).toFixed(1) : 0,
    revenue: c.revenue || 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Total Revenue" value={'$' + totalRevenue.toLocaleString()} subtitle={`${data.length} campaigns`} />
        <KpiCard label="Avg Open Rate" value={(avgOpen * 100).toFixed(1) + '%'} />
        <KpiCard label="Avg Click Rate" value={(avgClick * 100).toFixed(1) + '%'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartWrapper title="Open & Click Rate Trend" subtitle="Per campaign over time">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={{ stroke: '#D9D9D9' }} />
                <YAxis tickFormatter={v => v + '%'} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} formatter={(v, name) => [v + '%', name]} />
                <Legend wrapperStyle={{ fontFamily: '"Libre Baskerville"', fontSize: 12 }} />
                <Line type="monotone" dataKey="openRate" name="Open Rate" stroke="#000000" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="clickRate" name="Click Rate" stroke="#93C47D" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartWrapper>
        </div>
        <ChartWrapper title="Revenue by Campaign">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" horizontal={false} />
              <XAxis type="number" tickFormatter={v => '$' + v.toLocaleString()} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" tick={{ fontFamily: '"Libre Baskerville"', fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={120} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => ['$' + v.toLocaleString(), 'Revenue']} />
              <Bar dataKey="revenue" fill="#666666" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </div>

      {/* Campaign Table */}
      <div className="bg-white rounded-xl border border-prior-border p-6">
        <h3 className="text-sm font-serif font-bold text-prior-black mb-4">All Campaigns</h3>
        <SortableTable columns={TABLE_COLUMNS} data={data} defaultSort="send_time" />
      </div>
    </div>
  );
}
