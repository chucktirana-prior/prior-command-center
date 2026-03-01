export default function InsightCard({ title, items, type }) {
  if (!items?.length) return null;

  const icons = {
    highlights: (
      <svg className="w-4 h-4 text-prior-green-dark flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    ),
    concerns: (
      <svg className="w-4 h-4 text-prior-yellow-warm flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3l9.66 16.5H2.34L12 3z" />
      </svg>
    ),
    recommendations: (
      <svg className="w-4 h-4 text-prior-black flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
    ),
  };

  return (
    <div className="bg-white rounded-xl border border-prior-border p-5">
      <h3 className="text-xs uppercase tracking-wider text-prior-muted font-serif mb-3">{title}</h3>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm text-prior-body leading-relaxed">
            {icons[type]}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
