import { useState } from 'react';

export default function SortableTable({ columns, data, defaultSort, defaultDirection = 'desc' }) {
  const [sortKey, setSortKey] = useState(defaultSort || columns[0]?.key);
  const [sortDir, setSortDir] = useState(defaultDirection);

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = [...data].sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`text-xs uppercase tracking-wider text-prior-muted font-serif font-normal border-b border-prior-border py-3 px-3 cursor-pointer hover:text-prior-body select-none ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={i} className="hover:bg-prior-cream/50">
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`py-3 px-3 text-prior-body font-serif border-b border-prior-border/50 ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.format ? col.format(row[col.key]) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
