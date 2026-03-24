import { useState, useEffect } from 'react';

export default function CategoryPicker({ selected, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/contentful/categories')
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load categories');
        }
        return data;
      })
      .then((data) => {
        setCategories(Array.isArray(data) ? data : []);
        setError('');
        setLoading(false);
      })
      .catch((err) => {
        setCategories([]);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  function toggleCategory(cat) {
    const isSelected = selected.some((s) => s.id === cat.id);
    if (isSelected) {
      onChange(selected.filter((s) => s.id !== cat.id));
    } else {
      onChange([...selected, cat]);
    }
  }

  if (loading) return <p className="muted">Loading categories...</p>;

  return (
    <div className="category-picker">
      <label>Categories</label>
      {error && (
        <div className="warning-banner">
          Categories unavailable: {error}
        </div>
      )}
      <div className="category-tags">
        {categories.map((cat) => {
          const isActive = selected.some((s) => s.id === cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              className={`tag ${isActive ? 'tag-active' : ''}`}
              onClick={() => toggleCategory(cat)}
            >
              {cat.name}
            </button>
          );
        })}
      </div>
      {!error && categories.length === 0 && <p className="muted">No categories found.</p>}
    </div>
  );
}
