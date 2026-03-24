import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import KpiCard from './components/KpiCard';
import ChartWrapper from './components/ChartWrapper';
import DataFreshnessBanner from './components/DataFreshnessBanner';

const TOOLTIP_STYLE = {
  backgroundColor: '#fff',
  border: '1px solid #D9D9D9',
  borderRadius: '8px',
  fontFamily: '"Libre Baskerville", Georgia, serif',
  fontSize: '12px',
};

function fmt(n) {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function formatDate(d) {
  if (!d) return '';
  const date = new Date(d);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const TYPE_LABELS = {
  carousel_album: 'Carousel',
  video: 'Reel',
  image: 'Image',
};

const TYPE_BADGE_COLORS = {
  carousel_album: 'bg-prior-yellow-light text-prior-dark',
  video: 'bg-prior-green-light/30 text-prior-green-dark',
  image: 'bg-prior-border/50 text-prior-body',
};

export default function InstagramTab({ dateRange, syncStatus }) {
  const [igData, setIgData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange.start) params.set('start', dateRange.start);
    if (dateRange.end) params.set('end', dateRange.end);

    fetch(`/api/analytics/instagram?${params}`)
      .then(r => r.json())
      .then(json => { if (json.ok) setIgData(json.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dateRange.start, dateRange.end]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-prior-border/20 rounded-xl" />)}
        </div>
        <div className="h-80 bg-prior-border/20 rounded-xl" />
      </div>
    );
  }

  if (!igData) {
    return <div className="text-prior-muted font-serif text-center py-12">No Instagram data for this period</div>;
  }

  const { posts, profile } = igData;
  const totalRecords = posts.length + profile.length;

  // KPIs
  const totalReach = posts.reduce((s, p) => s + (p.reach || 0), 0);
  const totalSaves = posts.reduce((s, p) => s + (p.saves || 0), 0);
  const avgEngRate = posts.length ? posts.reduce((s, p) => {
    const eng = (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0);
    return s + (p.reach ? eng / p.reach : 0);
  }, 0) / posts.length : null;
  const latestFollowers = profile[0]?.followers || null;

  // Engagement trend per post (chronological)
  const engTrend = [...posts].sort((a, b) => new Date(a.posted_at) - new Date(b.posted_at)).map(p => {
    const eng = (p.likes || 0) + (p.comments || 0) + (p.saves || 0) + (p.shares || 0);
    return {
      date: p.posted_at,
      engRate: p.reach ? +((eng / p.reach) * 100).toFixed(1) : 0,
      caption: p.caption?.slice(0, 30) + '...',
    };
  });

  // Content type comparison
  const typeAgg = {};
  for (const p of posts) {
    const t = p.type || 'unknown';
    if (!typeAgg[t]) typeAgg[t] = { type: TYPE_LABELS[t] || t, likes: 0, comments: 0, saves: 0, shares: 0, count: 0 };
    typeAgg[t].likes += p.likes || 0;
    typeAgg[t].comments += p.comments || 0;
    typeAgg[t].saves += p.saves || 0;
    typeAgg[t].shares += p.shares || 0;
    typeAgg[t].count++;
  }
  const typeData = Object.values(typeAgg).map(t => ({
    type: t.type,
    Likes: Math.round(t.likes / t.count),
    Comments: Math.round(t.comments / t.count),
    Saves: Math.round(t.saves / t.count),
    Shares: Math.round(t.shares / t.count),
  }));

  // Follower growth
  const followerData = [...profile].sort((a, b) => a.date.localeCompare(b.date)).map(p => ({
    date: p.date,
    followers: p.followers,
  }));

  return (
    <div className="space-y-6">
      <DataFreshnessBanner source="Instagram" status={syncStatus} dataCount={totalRecords} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Reach" value={fmt(totalReach)} subtitle={`${posts.length} posts`} />
        <KpiCard label="Avg Engagement Rate" value={avgEngRate != null ? (avgEngRate * 100).toFixed(1) + '%' : '—'} />
        <KpiCard label="Total Saves" value={fmt(totalSaves)} />
        <KpiCard label="Followers" value={fmt(latestFollowers)} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWrapper title="Engagement Rate Trend" subtitle="Per post over time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={engTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
              <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={{ stroke: '#D9D9D9' }} />
              <YAxis tickFormatter={v => v + '%'} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} formatter={(v, name) => [v + '%', 'Engagement Rate']} />
              <Line type="monotone" dataKey="engRate" stroke="#000000" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
        <ChartWrapper title="Content Type Comparison" subtitle="Avg engagement per type">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
              <XAxis dataKey="type" tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#666' }} tickLine={false} axisLine={{ stroke: '#D9D9D9' }} />
              <YAxis tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontFamily: '"Libre Baskerville"', fontSize: 11 }} />
              <Bar dataKey="Likes" fill="#000000" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Comments" fill="#666666" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saves" fill="#93C47D" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Shares" fill="#999999" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </div>

      {/* Follower Growth */}
      <ChartWrapper title="Follower Growth">
        <ResponsiveContainer width="100%" height={250}>
          <AreaChart data={followerData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
            <XAxis dataKey="date" tickFormatter={d => formatDate(d + 'T00:00:00')} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={{ stroke: '#D9D9D9' }} />
            <YAxis tickFormatter={fmt} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} domain={['dataMin - 500', 'dataMax + 500']} />
            <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={d => formatDate(d + 'T00:00:00')} formatter={v => [v.toLocaleString(), 'Followers']} />
            <Area type="monotone" dataKey="followers" stroke="#6AA84F" fill="#93C47D" fillOpacity={0.1} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartWrapper>

      {/* Post Grid */}
      <div>
        <h3 className="text-sm font-serif font-bold text-prior-black mb-4">Recent Posts</h3>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {posts.map(post => (
            <div key={post.id} className="bg-white rounded-xl border border-prior-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-serif ${TYPE_BADGE_COLORS[post.type] || 'bg-prior-border/50 text-prior-body'}`}>
                  {TYPE_LABELS[post.type] || post.type}
                </span>
                <span className="text-[10px] text-prior-muted">{formatDate(post.posted_at)}</span>
              </div>
              <p className="text-xs text-prior-body font-serif leading-relaxed mb-3 line-clamp-3">
                {post.caption || 'No caption'}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <span className="text-[10px] bg-prior-cream px-1.5 py-0.5 rounded text-prior-body">{fmt(post.likes)} likes</span>
                <span className="text-[10px] bg-prior-cream px-1.5 py-0.5 rounded text-prior-body">{fmt(post.comments)} comments</span>
                <span className="text-[10px] bg-prior-cream px-1.5 py-0.5 rounded text-prior-body">{fmt(post.saves)} saves</span>
              </div>
              <div className="text-[10px] text-prior-muted mt-2">{fmt(post.reach)} reach</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
