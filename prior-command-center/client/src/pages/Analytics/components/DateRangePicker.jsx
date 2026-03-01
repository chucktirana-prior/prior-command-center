const PRESETS = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
];

export default function DateRangePicker({ dateRange, onChange }) {
  const isCustom = dateRange.preset === 'custom';

  function handlePreset(key) {
    const end = new Date().toISOString().split('T')[0];
    const days = parseInt(key);
    const start = new Date();
    start.setDate(start.getDate() - days);
    onChange({ preset: key, start: start.toISOString().split('T')[0], end });
  }

  function handleCustomDate(field, value) {
    onChange({ ...dateRange, preset: 'custom', [field]: value });
  }

  return (
    <div className="flex items-center gap-2">
      {PRESETS.map(p => (
        <button
          key={p.key}
          onClick={() => handlePreset(p.key)}
          className={`px-3 py-1.5 text-xs font-serif rounded-full border transition-colors ${
            dateRange.preset === p.key
              ? 'bg-prior-black text-prior-cream border-prior-black'
              : 'bg-white border-prior-border text-prior-body hover:border-prior-mid'
          }`}
        >
          {p.label}
        </button>
      ))}
      <button
        onClick={() => handleCustomDate('start', dateRange.start)}
        className={`px-3 py-1.5 text-xs font-serif rounded-full border transition-colors ${
          isCustom
            ? 'bg-prior-black text-prior-cream border-prior-black'
            : 'bg-white border-prior-border text-prior-body hover:border-prior-mid'
        }`}
      >
        Custom
      </button>
      {isCustom && (
        <div className="flex items-center gap-1.5 ml-1">
          <input
            type="date"
            value={dateRange.start}
            onChange={e => handleCustomDate('start', e.target.value)}
            className="px-2 py-1 text-xs border border-prior-border rounded font-serif text-prior-body"
          />
          <span className="text-xs text-prior-muted">to</span>
          <input
            type="date"
            value={dateRange.end}
            onChange={e => handleCustomDate('end', e.target.value)}
            className="px-2 py-1 text-xs border border-prior-border rounded font-serif text-prior-body"
          />
        </div>
      )}
    </div>
  );
}
