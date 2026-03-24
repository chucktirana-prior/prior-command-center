function formatWhen(isoString) {
  if (!isoString) return 'Never synced';
  const date = new Date(isoString);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function DataFreshnessBanner({ source, status, dataCount = null }) {
  if (!status) {
    return (
      <div className="mb-6 rounded-xl border border-prior-border bg-white p-4">
        <p className="text-sm font-serif text-prior-body">
          No sync history yet for {source}. Data shown here may be empty until the first successful sync.
        </p>
      </div>
    );
  }

  let tone = 'border-prior-border bg-white text-prior-body';
  let title = 'Data availability';
  let body = `Last sync: ${formatWhen(status.completed_at)}.`;

  if (status.status === 'failed') {
    tone = 'border-red-200 bg-red-50 text-red-900';
    title = 'Sync failed';
    body = `Last attempted sync failed on ${formatWhen(status.completed_at)}. The charts below may be stale.`;
  } else if (status.status === 'skipped') {
    tone = 'border-amber-200 bg-amber-50 text-amber-900';
    title = 'Source not configured';
    body = `This source is not currently configured, so the charts below rely on previously synced data or may be empty.`;
  } else if (!status.completed_at) {
    tone = 'border-amber-200 bg-amber-50 text-amber-900';
    title = 'No completed sync yet';
    body = `This source has not completed a successful sync yet.`;
  }

  return (
    <div className={`mb-6 rounded-xl border p-4 ${tone}`}>
      <div className="flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.18em] font-sans opacity-70">{title}</p>
        <p className="text-sm font-serif">{body}</p>
        {status.error_message && status.status === 'failed' && (
          <p className="text-xs font-serif opacity-80">{status.error_message}</p>
        )}
        {dataCount != null && (
          <p className="text-xs font-serif opacity-75">
            Current dataset size in the selected date range: {dataCount.toLocaleString()} record{dataCount === 1 ? '' : 's'}.
          </p>
        )}
      </div>
    </div>
  );
}
