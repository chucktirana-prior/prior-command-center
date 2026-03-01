import { useState, useMemo } from 'react';
import AuthorSearch from './AuthorSearch';
import CategoryPicker from './CategoryPicker';
import MarkdownEditor from './MarkdownEditor';
import ImageMatcher from './ImageMatcher';
import { extractFigures, replaceFigureSrcs } from '../../utils/figureParser';

export default function ReviewScreen({ data, imageFiles, onSaved, onCancel }) {
  const [fields, setFields] = useState({
    title: data.title || '',
    subtitle: data.subtitle || '',
    slug: data.slug || '',
    homepageExcerpt: data.homepageExcerpt || '',
    metaTitle: data.metaTitle || '',
    metaDescription: data.metaDescription || '',
    keywords: data.keywords || [],
    articleBody: data.articleBody || '',
    datePublished: '',
    updatedAt: '',
    hideFromLatestArticles: false,
    isFreeContent: false,
  });

  const [author, setAuthor] = useState(null);
  const [categories, setCategories] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [assignments, setAssignments] = useState(new Map());
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState(null);

  const figures = useMemo(() => extractFigures(fields.articleBody), [fields.articleBody]);

  function updateField(name, value) {
    setFields((prev) => ({ ...prev, [name]: value }));
  }

  function handleAddKeyword(e) {
    if (e.key === 'Enter' && keywordInput.trim()) {
      e.preventDefault();
      const kw = keywordInput.trim();
      if (!fields.keywords.includes(kw)) {
        updateField('keywords', [...fields.keywords, kw]);
      }
      setKeywordInput('');
    }
  }

  function removeKeyword(kw) {
    updateField('keywords', fields.keywords.filter((k) => k !== kw));
  }

  function handleDatePublishedChange(val) {
    updateField('datePublished', val);
    if (!fields.updatedAt) {
      updateField('updatedAt', val);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveStatus('');

    try {
      let finalArticleBody = fields.articleBody;

      if (assignments.size > 0) {
        setSaveStatus(`Uploading ${assignments.size} image${assignments.size !== 1 ? 's' : ''}...`);

        const formData = new FormData();
        const assignmentMeta = [];

        for (const [figureIndex, file] of assignments) {
          const figure = figures.find((f) => f.index === figureIndex);
          formData.append('images', file);
          assignmentMeta.push({
            figureIndex,
            fileName: file.name,
            title: figure?.caption || figure?.alt || file.name,
          });
        }
        formData.append('meta', JSON.stringify(assignmentMeta));

        const uploadRes = await fetch('/api/upload-images', {
          method: 'POST',
          body: formData,
        });

        if (!uploadRes.ok) {
          const errData = await uploadRes.json();
          throw new Error(errData.error || 'Failed to upload images');
        }

        const uploadResult = await uploadRes.json();
        const figureUrlMap = new Map();
        for (const asset of uploadResult.assets) {
          figureUrlMap.set(asset.figureIndex, asset.url);
        }

        finalArticleBody = replaceFigureSrcs(finalArticleBody, figureUrlMap);
      }

      setSaveStatus('Creating draft...');
      const payload = {
        ...fields,
        articleBody: finalArticleBody,
        authorId: author?.id || null,
        categoryIds: categories.map((c) => c.id),
      };

      const res = await fetch('/api/contentful/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to create draft');
      }

      const result = await res.json();
      onSaved(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
      setSaveStatus('');
    }
  }

  return (
    <div className="review-screen">
      <h1>Review & Edit</h1>

      {error && <div className="error-banner">{error}</div>}

      <section className="form-section">
        <h2>Article Metadata</h2>

        <div className="form-group">
          <label htmlFor="title">Title</label>
          <input id="title" value={fields.title} onChange={(e) => updateField('title', e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="subtitle">Subtitle</label>
          <input id="subtitle" value={fields.subtitle} onChange={(e) => updateField('subtitle', e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="slug">Slug</label>
          <input id="slug" value={fields.slug} onChange={(e) => updateField('slug', e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="homepageExcerpt">Homepage Excerpt</label>
          <textarea
            id="homepageExcerpt"
            rows={3}
            value={fields.homepageExcerpt}
            onChange={(e) => updateField('homepageExcerpt', e.target.value)}
          />
        </div>
      </section>

      <section className="form-section">
        <h2>Author</h2>
        <AuthorSearch initialName={data.authorName} onSelect={setAuthor} />
      </section>

      <section className="form-section">
        <h2>Dates</h2>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="datePublished">Date Published</label>
            <input
              id="datePublished"
              type="date"
              value={fields.datePublished}
              onChange={(e) => handleDatePublishedChange(e.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="updatedAt">Updated At</label>
            <input
              id="updatedAt"
              type="date"
              value={fields.updatedAt}
              onChange={(e) => updateField('updatedAt', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="form-section">
        <h2>Categories</h2>
        <CategoryPicker selected={categories} onChange={setCategories} />
      </section>

      <section className="form-section">
        <h2>SEO</h2>

        <div className="form-group">
          <label htmlFor="metaTitle">Meta Title</label>
          <input id="metaTitle" value={fields.metaTitle} onChange={(e) => updateField('metaTitle', e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="metaDescription">Meta Description</label>
          <textarea
            id="metaDescription"
            rows={2}
            value={fields.metaDescription}
            onChange={(e) => updateField('metaDescription', e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Keywords</label>
          <div className="keyword-tags">
            {fields.keywords.map((kw) => (
              <span key={kw} className="tag tag-active">
                {kw}
                <button type="button" className="tag-remove" onClick={() => removeKeyword(kw)}>
                  &times;
                </button>
              </span>
            ))}
          </div>
          <input
            placeholder="Type a keyword and press Enter"
            value={keywordInput}
            onChange={(e) => setKeywordInput(e.target.value)}
            onKeyDown={handleAddKeyword}
          />
        </div>
      </section>

      {figures.length > 0 && imageFiles.length > 0 && (
        <section className="form-section">
          <h2>Image Matching</h2>
          <ImageMatcher
            figures={figures}
            imageFiles={imageFiles}
            assignments={assignments}
            onAssignmentsChange={setAssignments}
          />
        </section>
      )}

      {figures.length > 0 && imageFiles.length === 0 && (
        <section className="form-section">
          <h2>Image Matching</h2>
          <div className="warning-banner">
            This article has {figures.length} figure block{figures.length !== 1 ? 's' : ''} but no images were uploaded.
            Image placeholders will remain as "XXXX" in the article body.
          </div>
        </section>
      )}

      <section className="form-section">
        <h2>Article Body</h2>
        <MarkdownEditor value={fields.articleBody} onChange={(val) => updateField('articleBody', val)} />
      </section>

      <section className="form-section">
        <h2>Defaults</h2>
        <div className="form-row">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={fields.hideFromLatestArticles}
              onChange={(e) => updateField('hideFromLatestArticles', e.target.checked)}
            />
            Hide from Latest Articles
          </label>
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={fields.isFreeContent}
              onChange={(e) => updateField('isFreeContent', e.target.checked)}
            />
            Is Free Content
          </label>
        </div>
      </section>

      <div className="action-bar">
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? (saveStatus || 'Saving...') : 'Save as Draft'}
        </button>
      </div>
    </div>
  );
}
