import { useEffect, useMemo, useState } from 'react';
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

const TABLE_COLUMNS = [
  { key: 'name', label: 'Campaign', align: 'left' },
  { key: 'subject', label: 'Subject', align: 'left', format: (v) => v && v.length > 40 ? `${v.slice(0, 40)}...` : v },
  { key: 'send_time', label: 'Sent', align: 'left', format: formatDate },
  { key: 'recipients', label: 'Recipients', align: 'right', format: (v) => v?.toLocaleString() || '—' },
  { key: 'open_rate', label: 'Open Rate', align: 'right', format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—' },
  { key: 'click_rate', label: 'Click Rate', align: 'right', format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—' },
  { key: 'bounce_rate', label: 'Bounce', align: 'right', format: (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—' },
  { key: 'csv_imported_at', label: 'CSV Imported', align: 'left', format: formatDateTime },
];

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getComparisonRange(dateRange) {
  if (!dateRange.start || !dateRange.end) return null;

  const start = new Date(`${dateRange.start}T00:00:00Z`);
  const end = new Date(`${dateRange.end}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const previousEnd = shiftDate(dateRange.start, -1);
  const previousStart = shiftDate(previousEnd, -(days - 1));

  return { start: previousStart, end: previousEnd };
}

function formatRangeLabel(range) {
  if (!range?.start || !range?.end) return 'previous period';
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
  const endText = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startText} to ${endText}`;
}

function formatSignedPercent(value) {
  if (value == null) return null;
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function formatSignedPoints(value) {
  if (value == null) return null;
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(1)} pt`;
}

function getPercentChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function getPointChange(current, previous) {
  if (current == null || previous == null) return null;
  return current - previous;
}

function getTrendTone(value) {
  if (value == null || value === 0) return 'neutral';
  return value > 0 ? 'up' : 'down';
}

function statusSummary(metricsStatus) {
  const lastCsvImport = metricsStatus?.last_csv_import_at;
  const lastMetadataSync = metricsStatus?.last_metadata_sync_at;

  if (!lastMetadataSync && !lastCsvImport) {
    return {
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
      title: 'Klaviyo setup needed',
      body: 'Start by refreshing the campaign list, then upload your Klaviyo export to bring in newsletter performance.',
    };
  }

  if (lastMetadataSync && !lastCsvImport) {
    return {
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
      title: 'Upload this week’s export',
      body: `Your campaign list is up to date as of ${formatDateTime(lastMetadataSync)}. Upload the latest Klaviyo CSV to add opens, clicks, bounces, and recipients.`,
    };
  }

  return {
    tone: 'border-prior-border bg-white text-prior-body',
    title: 'Newsletter data is current',
    body: `Campaign list last refreshed ${formatDateTime(lastMetadataSync)}. Metrics last imported from CSV ${formatDateTime(lastCsvImport)}.`,
  };
}

function parsePreviewRows(preview) {
  return preview?.rows || [];
}

export default function KlaviyoTab({ dateRange, syncStatus }) {
  const [data, setData] = useState([]);
  const [previousData, setPreviousData] = useState([]);
  const [metricsStatus, setMetricsStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [reviewRows, setReviewRows] = useState([]);
  const [importMessage, setImportMessage] = useState('');
  const [error, setError] = useState('');
  const comparisonRange = getComparisonRange(dateRange);
  const comparisonLabel = formatRangeLabel(comparisonRange);

  async function loadData() {
    setLoading(true);
    const params = new URLSearchParams();
    if (dateRange.start) params.set('start', dateRange.start);
    if (dateRange.end) params.set('end', dateRange.end);
    const comparisonParams = new URLSearchParams();
    if (comparisonRange?.start) comparisonParams.set('start', comparisonRange.start);
    if (comparisonRange?.end) comparisonParams.set('end', comparisonRange.end);

    try {
      const [currentJson, previousJson, reviewJson] = await Promise.all([
        fetch(`/api/analytics/klaviyo?${params}`).then((r) => r.json()),
        comparisonRange
          ? fetch(`/api/analytics/klaviyo?${comparisonParams}`).then((r) => r.json())
          : Promise.resolve({ ok: true, data: [] }),
        fetch('/api/klaviyo-import/review').then((r) => r.json()),
      ]);

      if (currentJson.ok) {
        setData(currentJson.data);
        setMetricsStatus(currentJson.metrics_status || null);
      }
      if (previousJson.ok) setPreviousData(previousJson.data);
      if (reviewJson.ok) setReviewRows(reviewJson.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [dateRange.start, dateRange.end]);

  const metricCampaigns = useMemo(
    () => data.filter((campaign) =>
      campaign.csv_imported_at != null && (
        campaign.recipients != null || campaign.open_rate != null || campaign.click_rate != null || campaign.bounce_rate != null
      )
    ),
    [data]
  );
  const previousMetricCampaigns = useMemo(
    () => previousData.filter((campaign) =>
      campaign.csv_imported_at != null && (
        campaign.recipients != null || campaign.open_rate != null || campaign.click_rate != null || campaign.bounce_rate != null
      )
    ),
    [previousData]
  );

  const totalRecipients = metricCampaigns.reduce((sum, campaign) => sum + (campaign.recipients || 0), 0);
  const avgOpen = metricCampaigns.length
    ? metricCampaigns.reduce((sum, campaign) => sum + (campaign.open_rate || 0), 0) / metricCampaigns.length
    : null;
  const avgClick = metricCampaigns.length
    ? metricCampaigns.reduce((sum, campaign) => sum + (campaign.click_rate || 0), 0) / metricCampaigns.length
    : null;
  const avgBounce = metricCampaigns.length
    ? metricCampaigns.reduce((sum, campaign) => sum + (campaign.bounce_rate || 0), 0) / metricCampaigns.length
    : null;

  const previousRecipients = previousMetricCampaigns.reduce((sum, campaign) => sum + (campaign.recipients || 0), 0);
  const previousAvgOpen = previousMetricCampaigns.length
    ? previousMetricCampaigns.reduce((sum, campaign) => sum + (campaign.open_rate || 0), 0) / previousMetricCampaigns.length
    : null;
  const previousAvgClick = previousMetricCampaigns.length
    ? previousMetricCampaigns.reduce((sum, campaign) => sum + (campaign.click_rate || 0), 0) / previousMetricCampaigns.length
    : null;
  const previousAvgBounce = previousMetricCampaigns.length
    ? previousMetricCampaigns.reduce((sum, campaign) => sum + (campaign.bounce_rate || 0), 0) / previousMetricCampaigns.length
    : null;

  const recipientsChange = getPercentChange(totalRecipients, previousRecipients);
  const openChange = getPointChange(avgOpen, previousAvgOpen);
  const clickChange = getPointChange(avgClick, previousAvgClick);
  const bounceChange = getPointChange(avgBounce, previousAvgBounce);

  const chartData = [...metricCampaigns]
    .sort((a, b) => new Date(a.send_time) - new Date(b.send_time))
    .map((campaign) => ({
      name: campaign.name,
      date: campaign.send_time,
      openRate: campaign.open_rate ? +(campaign.open_rate * 100).toFixed(1) : 0,
      clickRate: campaign.click_rate ? +(campaign.click_rate * 100).toFixed(1) : 0,
      recipients: campaign.recipients || 0,
    }));

  async function handleCsvSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    setImportMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/klaviyo-import/parse', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to parse CSV');
      }
      setPreview(json.preview);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(true);
    setError('');
    setImportMessage('');
    try {
      const res = await fetch('/api/klaviyo-import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preview }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to import CSV');
      }
      setImportMessage(`Imported ${json.imported} matched campaigns. ${json.reviewCount} row${json.reviewCount === 1 ? '' : 's'} moved to review.`);
      setPreview(null);
      await loadData();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  const banner = statusSummary(metricsStatus);
  const previewRows = parsePreviewRows(preview);
  const previewMatches = previewRows.filter((row) => row.status === 'matched');
  const previewReview = previewRows.filter((row) => row.status !== 'matched');

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

  return (
    <div className="space-y-6">
      <div className={`rounded-xl border p-4 ${banner.tone}`}>
        <p className="text-xs uppercase tracking-[0.18em] font-sans opacity-70">{banner.title}</p>
        <p className="mt-1 text-sm font-serif">{banner.body}</p>
        <p className="mt-2 text-xs font-serif opacity-75">
          CSV-backed campaigns: {metricsStatus?.csv_backed_campaigns || 0} of {metricsStatus?.total_campaigns || 0}.
        </p>
        {syncStatus?.status === 'failed' && (
          <p className="mt-2 text-xs font-serif opacity-75">
            The last metadata refresh ran into an API issue, but your CSV import workflow is still available here.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-prior-border bg-white p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-lg font-serif text-prior-black">Weekly Metrics Import</h3>
            <p className="mt-1 text-sm font-serif text-prior-body">
              Upload the CSV you export directly from Klaviyo. We’ll match each row to the right campaign and pull in recipients, opens, clicks, and bounces.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center rounded-xl border border-prior-border bg-white px-4 py-2.5 text-sm font-serif text-prior-black hover:border-prior-mid">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvSelect} />
            {uploading ? 'Parsing CSV…' : 'Upload Weekly CSV'}
          </label>
        </div>

        {importMessage && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 font-serif">
            {importMessage}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 font-serif">
            {error}
          </div>
        )}

        {preview && (
          <div className="mt-5 rounded-xl border border-prior-border bg-prior-cream/40 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="text-sm font-serif text-prior-body">
                We found <strong>{preview.summary.total}</strong> rows in <strong>{preview.fileName}</strong>. <strong>{preview.summary.matched}</strong> are ready to import and <strong>{preview.summary.review}</strong> need review.
              </div>
              <button
                onClick={handleConfirmImport}
                disabled={importing}
                className="rounded-xl bg-prior-black px-4 py-2 text-sm font-serif text-white hover:bg-prior-black/90 disabled:opacity-50"
              >
                {importing ? 'Importing…' : 'Confirm Import'}
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <h4 className="text-sm font-serif text-prior-black">Ready to Import</h4>
                <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-prior-border bg-white">
                  {previewMatches.length === 0 ? (
                    <div className="px-4 py-3 text-sm font-serif text-prior-muted">No rows are ready yet.</div>
                  ) : (
                    <table className="min-w-full text-left text-sm">
                      <tbody>
                        {previewMatches.slice(0, 12).map((row) => (
                          <tr key={`${row.rowIndex}-${row.matchedCampaignId}`} className="border-b border-prior-border/70 last:border-b-0">
                            <td className="px-4 py-3 font-serif text-prior-black">{row.campaign_name}</td>
                            <td className="px-4 py-3 text-xs text-prior-muted">{row.matchType}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-serif text-prior-black">Needs Review</h4>
                <div className="mt-2 max-h-64 overflow-auto rounded-lg border border-prior-border bg-white">
                  {previewReview.length === 0 ? (
                    <div className="px-4 py-3 text-sm font-serif text-prior-muted">Everything matched cleanly.</div>
                  ) : (
                    <table className="min-w-full text-left text-sm">
                      <tbody>
                        {previewReview.slice(0, 12).map((row) => (
                          <tr key={`${row.rowIndex}-${row.campaign_name}`} className="border-b border-prior-border/70 last:border-b-0">
                            <td className="px-4 py-3 font-serif text-prior-black">{row.campaign_name || 'Unnamed campaign'}</td>
                            <td className="px-4 py-3 text-xs text-red-700">{row.reviewReason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-prior-border bg-white px-4 py-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.2em] text-prior-muted font-serif">Reporting window</div>
          <div className="mt-1 text-sm font-serif text-prior-body">
            Comparing this range with {comparisonLabel}
          </div>
        </div>
        <div className="text-xs text-prior-muted font-serif">
          {data.length} campaigns in view, {metricCampaigns.length} with imported metrics
        </div>
      </div>

      {!metricCampaigns.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 font-serif">
          No imported newsletter metrics are available for this range yet. Refresh the campaign list if needed, then upload the latest Klaviyo CSV.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <KpiCard
              label="Total Recipients"
              value={totalRecipients.toLocaleString()}
              subtitle={`${metricCampaigns.length} campaigns with metrics`}
              trendText={recipientsChange != null ? `${formatSignedPercent(recipientsChange)} vs ${comparisonLabel}` : null}
              trendTone={getTrendTone(recipientsChange)}
            />
            <KpiCard
              label="Avg Open Rate"
              value={avgOpen != null ? `${(avgOpen * 100).toFixed(1)}%` : '—'}
              trendText={openChange != null ? `${formatSignedPoints(openChange)} vs ${comparisonLabel}` : null}
              trendTone={getTrendTone(openChange)}
            />
            <KpiCard
              label="Avg Click Rate"
              value={avgClick != null ? `${(avgClick * 100).toFixed(1)}%` : '—'}
              trendText={clickChange != null ? `${formatSignedPoints(clickChange)} vs ${comparisonLabel}` : null}
              trendTone={getTrendTone(clickChange)}
            />
            <KpiCard
              label="Avg Bounce Rate"
              value={avgBounce != null ? `${(avgBounce * 100).toFixed(1)}%` : '—'}
              trendText={bounceChange != null ? `${formatSignedPoints(bounceChange)} vs ${comparisonLabel}` : null}
              trendTone={bounceChange == null ? 'neutral' : bounceChange < 0 ? 'up' : 'down'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ChartWrapper title="Open & Click Rate Trend" subtitle="CSV-backed campaign metrics over time">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" />
                    <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={{ stroke: '#D9D9D9' }} />
                    <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 11, fill: '#999' }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} labelFormatter={formatDate} formatter={(v, name) => [`${v}%`, name]} />
                    <Legend wrapperStyle={{ fontFamily: '"Libre Baskerville"', fontSize: 12 }} />
                    <Line type="monotone" dataKey="openRate" name="Open Rate" stroke="#000000" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="clickRate" name="Click Rate" stroke="#93C47D" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartWrapper>
            </div>
            <ChartWrapper title="Recipients by Campaign" subtitle="Newsletter reach from imported metrics">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#D9D9D9" horizontal={false} />
                  <XAxis type="number" tickFormatter={(v) => v.toLocaleString()} tick={{ fontFamily: '"Libre Baskerville"', fontSize: 10, fill: '#999' }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontFamily: '"Libre Baskerville"', fontSize: 10, fill: '#666' }} tickLine={false} axisLine={false} width={120} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [v.toLocaleString(), 'Recipients']} />
                  <Bar dataKey="recipients" fill="#666666" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartWrapper>
          </div>
        </>
      )}

      <div className="bg-white rounded-xl border border-prior-border p-6">
        <h3 className="text-sm font-serif font-bold text-prior-black mb-4">All Campaigns</h3>
        <SortableTable columns={TABLE_COLUMNS} data={data} defaultSort="send_time" />
      </div>

      {reviewRows.length > 0 && (
        <div className="bg-white rounded-xl border border-prior-border p-6">
          <h3 className="text-sm font-serif font-bold text-prior-black mb-4">Import Review Bucket</h3>
          <div className="space-y-3">
            {reviewRows.slice(0, 10).map((row) => (
              <div key={row.id} className="rounded-lg border border-prior-border px-4 py-3">
                <div className="font-serif text-prior-black">{row.campaign_name || 'Unnamed campaign'}</div>
                <div className="mt-1 text-xs text-prior-muted">{row.reason} • {formatDateTime(row.imported_at)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
