import { useState } from 'react';
import DateRangePicker from '../Analytics/components/DateRangePicker';

function computeInitialRange() {
  const end = new Date().toISOString().split('T')[0];
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return { preset: '30d', start: start.toISOString().split('T')[0], end };
}

const SECTIONS = [
  { key: 'klaviyo', label: 'Email Performance', description: 'Klaviyo campaign metrics' },
  { key: 'ga', label: 'Web Performance', description: 'Google Analytics pages & traffic' },
  { key: 'instagram', label: 'Social Performance', description: 'Instagram posts & engagement' },
];

export default function ReportGenerator() {
  const [screen, setScreen] = useState('config');
  const [dateRange, setDateRange] = useState(computeInitialRange);
  const [sections, setSections] = useState({ klaviyo: true, ga: true, instagram: true });
  const [includeInsights, setIncludeInsights] = useState(true);
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [error, setError] = useState(null);

  function toggleSection(key) {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleGenerate() {
    setScreen('generating');
    setError(null);

    try {
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: dateRange.start,
          end: dateRange.end,
          sections: Object.entries(sections).filter(([, v]) => v).map(([k]) => k),
          includeInsights,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Report generation failed' }));
        throw new Error(err.error || 'Report generation failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);

      // Auto-trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `prior-report-${dateRange.start}-to-${dateRange.end}.pdf`;
      a.click();

      setScreen('complete');
    } catch (err) {
      setError(err.message);
      setScreen('error');
    }
  }

  function handleReset() {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setError(null);
    setScreen('config');
  }

  const selectedCount = Object.values(sections).filter(Boolean).length;

  // Config screen
  if (screen === 'config') {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold font-serif text-prior-black">Report Generator</h1>
          <p className="text-sm text-prior-muted mt-1 font-serif">Generate branded PDF performance reports</p>
        </div>

        <div className="bg-white rounded-xl border border-prior-border p-6 max-w-2xl">
          {/* Date Range */}
          <div className="mb-6">
            <label className="text-xs uppercase tracking-wider text-prior-muted font-serif block mb-3">
              Report Period
            </label>
            <DateRangePicker dateRange={dateRange} onChange={setDateRange} />
          </div>

          {/* Section Toggles */}
          <div className="mb-6">
            <label className="text-xs uppercase tracking-wider text-prior-muted font-serif block mb-3">
              Include Sections
            </label>
            <div className="space-y-2">
              {SECTIONS.map(s => (
                <label key={s.key} className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={sections[s.key]}
                    onChange={() => toggleSection(s.key)}
                    className="w-4 h-4 rounded border-prior-border text-prior-black focus:ring-prior-black"
                  />
                  <div>
                    <span className="text-sm font-serif text-prior-black group-hover:underline">{s.label}</span>
                    <span className="text-xs text-prior-muted ml-2">{s.description}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* AI Insights Toggle */}
          <div className="mb-8">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={includeInsights}
                onChange={() => setIncludeInsights(!includeInsights)}
                className="w-4 h-4 rounded border-prior-border text-prior-black focus:ring-prior-black"
              />
              <div>
                <span className="text-sm font-serif text-prior-black group-hover:underline">Include AI Insights</span>
                <p className="text-xs text-prior-muted mt-0.5">
                  Adds highlights, concerns, and recommendations from the latest analysis
                </p>
              </div>
            </label>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={selectedCount === 0}
            className="bg-prior-black text-white px-6 py-3 rounded-lg text-sm font-serif hover:bg-prior-black/90 transition-colors w-full disabled:opacity-40"
          >
            Generate Report
          </button>

          {selectedCount === 0 && (
            <p className="text-xs text-red-500 mt-2 text-center">Select at least one section</p>
          )}
        </div>
      </div>
    );
  }

  // Generating screen
  if (screen === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <svg className="w-8 h-8 animate-spin text-prior-black mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-lg font-serif text-prior-black">Generating your report...</p>
        <p className="text-sm text-prior-muted mt-1">This may take a few seconds</p>
      </div>
    );
  }

  // Complete screen
  if (screen === 'complete') {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <div className="w-12 h-12 rounded-full bg-prior-green-light/30 flex items-center justify-center mb-4">
          <svg className="w-6 h-6 text-prior-green-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-lg font-serif text-prior-black mb-1">Report Generated</p>
        <p className="text-sm text-prior-muted mb-6">Your PDF has been downloaded</p>

        <div className="flex gap-3">
          {downloadUrl && (
            <a
              href={downloadUrl}
              download={`prior-report-${dateRange.start}-to-${dateRange.end}.pdf`}
              className="bg-prior-black text-white px-5 py-2.5 rounded-lg text-sm font-serif hover:bg-prior-black/90 transition-colors"
            >
              Download Again
            </a>
          )}
          <button
            onClick={handleReset}
            className="border border-prior-border text-prior-black px-5 py-2.5 rounded-lg text-sm font-serif hover:bg-prior-border/20 transition-colors"
          >
            Generate Another Report
          </button>
        </div>
      </div>
    );
  }

  // Error screen
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
      <p className="text-lg font-serif text-prior-black mb-1">Generation Failed</p>
      <p className="text-sm text-red-500 mb-6">{error}</p>
      <button
        onClick={handleReset}
        className="border border-prior-border text-prior-black px-5 py-2.5 rounded-lg text-sm font-serif hover:bg-prior-border/20 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
