import { useState, useEffect } from 'react';

export default function CategoryPicker({ selected, onChange }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/contentful/categories')
      .then((res) => res.json())
      .then((data) => {
        setCategories(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
      {categories.length === 0 && <p className="muted">No categories found.</p>}
    </div>
  );
}
