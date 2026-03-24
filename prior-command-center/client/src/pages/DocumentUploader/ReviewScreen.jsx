import { useEffect, useMemo, useState } from 'react';
import AuthorSearch from './AuthorSearch';
import CategoryPicker from './CategoryPicker';
import MarkdownEditor from './MarkdownEditor';
import ImageMatcher from './ImageMatcher';
import { extractFigures, replaceFigureSrcs } from '../../utils/figureParser';
import { getBodySlotKey, normalizeImages, parseBodySlotKey, suggestAssignments } from '../../utils/imageNaming';

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
    heroCaption: data.heroCaption || '',
    datePublished: '',
    updatedAt: '',
    hideFromLatestArticles: false,
    isFreeContent: false,
  });
  const [author, setAuthor] = useState(null);
  const [categories, setCategories] = useState([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [confirmedAssignments, setConfirmedAssignments] = useState({});
  const [dismissedSuggestions, setDismissedSuggestions] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [error, setError] = useState(null);

  const figures = useMemo(() => extractFigures(fields.articleBody), [fields.articleBody]);
  const images = useMemo(() => normalizeImages(imageFiles), [imageFiles]);

  const rawSuggestions = useMemo(
    () => suggestAssignments(images, figures),
    [images, figures]
  );

  const suggestions = useMemo(() => {
    const filtered = {};
    for (const [slotKey, suggestion] of Object.entries(rawSuggestions)) {
      if (confirmedAssignments[slotKey]) continue;
      if (dismissedSuggestions[slotKey] === suggestion.imageId) continue;
      filtered[slotKey] = suggestion;
    }
    return filtered;
  }, [confirmedAssignments, dismissedSuggestions, rawSuggestions]);

  useEffect(() => {
    const validSlotKeys = new Set(['hero', 'index', ...figures.map((figure) => getBodySlotKey(figure.index))]);
    const validImageIds = new Set(images.map((image) => image.id));

    setConfirmedAssignments((prev) => {
      const next = {};
      let changed = false;

      for (const [slotKey, imageId] of Object.entries(prev)) {
        if (validSlotKeys.has(slotKey) && validImageIds.has(imageId)) {
          next[slotKey] = imageId;
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });

    setDismissedSuggestions((prev) => {
      const next = {};
      let changed = false;

      for (const [slotKey, imageId] of Object.entries(prev)) {
        if (validSlotKeys.has(slotKey) && validImageIds.has(imageId)) {
          next[slotKey] = imageId;
        } else {
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [figures, images]);

  const imageMap = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images]
  );

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

  function assignImageToSlot(slotKey, imageId) {
    setConfirmedAssignments((prev) => {
      const next = { ...prev };
      for (const [existingSlotKey, existingImageId] of Object.entries(next)) {
        if (existingImageId === imageId) {
          delete next[existingSlotKey];
        }
      }
      next[slotKey] = imageId;
      return next;
    });
    setDismissedSuggestions((prev) => {
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }

  function acceptSuggestion(slotKey) {
    const suggestion = suggestions[slotKey];
    if (!suggestion) return;
    assignImageToSlot(slotKey, suggestion.imageId);
  }

  function acceptAllSuggestions() {
    for (const slotKey of Object.keys(suggestions)) {
      acceptSuggestion(slotKey);
    }
  }

  function clearSlot(slotKey) {
    setConfirmedAssignments((prev) => {
      if (!prev[slotKey]) return prev;
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
    setDismissedSuggestions((prev) => {
      const suggestion = rawSuggestions[slotKey];
      if (!suggestion) return prev;
      return { ...prev, [slotKey]: suggestion.imageId };
    });
  }

  function removeAssignment(slotKey) {
    setConfirmedAssignments((prev) => {
      if (!prev[slotKey]) return prev;
      const next = { ...prev };
      delete next[slotKey];
      return next;
    });
  }

  function buildPreSaveWarnings() {
    const warnings = [];
    const confirmedImageIds = new Set(Object.values(confirmedAssignments));
    const unassignedImages = images.filter((image) => !confirmedImageIds.has(image.id));

    if (!confirmedAssignments.hero) {
      warnings.push('Hero image is not assigned.');
    }

    if (!confirmedAssignments.index) {
      warnings.push('Index image is not assigned.');
    }

    const missingFigures = figures
      .filter((figure) => !confirmedAssignments[getBodySlotKey(figure.index)])
      .map((figure) => figure.index + 1);

    if (missingFigures.length > 0) {
      warnings.push(`Unassigned figure slots: ${missingFigures.join(', ')}.`);
    }

    if (unassignedImages.length > 0) {
      warnings.push(`${unassignedImages.length} uploaded image${unassignedImages.length !== 1 ? 's are' : ' is'} still unused.`);
    }

    return warnings;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaveStatus('');

    try {
      const warnings = buildPreSaveWarnings();
      if (warnings.length > 0) {
        const shouldContinue = window.confirm(
          `Some images are still unmatched:\n\n- ${warnings.join('\n- ')}\n\nSave anyway?`
        );
        if (!shouldContinue) {
          setSaving(false);
          return;
        }
      }

      let finalArticleBody = fields.articleBody;
      let heroImageAssetId = null;
      let indexImageAssetId = null;
      const allFiles = [];
      const allMeta = [];

      const confirmedHero = confirmedAssignments.hero ? imageMap.get(confirmedAssignments.hero) : null;
      const confirmedIndex = confirmedAssignments.index ? imageMap.get(confirmedAssignments.index) : null;

      if (confirmedHero) {
        allFiles.push(confirmedHero.file);
        allMeta.push({
          figureIndex: -1,
          fileName: confirmedHero.name,
          title: fields.title ? `${fields.title} - Hero` : confirmedHero.name,
        });
      }

      if (confirmedIndex) {
        allFiles.push(confirmedIndex.file);
        allMeta.push({
          figureIndex: -2,
          fileName: confirmedIndex.name,
          title: fields.title ? `${fields.title} - Index` : confirmedIndex.name,
        });
      }

      for (const [slotKey, imageId] of Object.entries(confirmedAssignments)) {
        const figureIndex = parseBodySlotKey(slotKey);
        if (figureIndex === null) continue;

        const image = imageMap.get(imageId);
        const figure = figures.find((entry) => entry.index === figureIndex);
        if (!image || !figure) continue;

        allFiles.push(image.file);
        allMeta.push({
          figureIndex,
          fileName: image.name,
          title: figure.caption || figure.alt || image.name,
        });
      }

      if (allFiles.length > 0) {
        setSaveStatus(`Uploading ${allFiles.length} image${allFiles.length !== 1 ? 's' : ''}...`);

        const formData = new FormData();
        for (const file of allFiles) {
          formData.append('images', file);
        }
        formData.append('meta', JSON.stringify(allMeta));

        const uploadRes = await fetch('/api/contentful/upload-images', {
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
          if (asset.figureIndex === -1) {
            heroImageAssetId = asset.assetId;
          } else if (asset.figureIndex === -2) {
            indexImageAssetId = asset.assetId;
          } else {
            figureUrlMap.set(asset.figureIndex, asset.url);
          }
        }

        if (figureUrlMap.size > 0) {
          finalArticleBody = replaceFigureSrcs(finalArticleBody, figureUrlMap);
        }
      }

      setSaveStatus('Creating draft...');
      const payload = {
        ...fields,
        articleBody: finalArticleBody,
        authorId: author?.id || null,
        categoryIds: categories.map((c) => c.id),
        heroImageAssetId,
        indexImageAssetId,
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

  const liveWarnings = buildPreSaveWarnings();

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

        <div className="form-group">
          <label htmlFor="heroCaption">Hero Caption</label>
          <input
            id="heroCaption"
            value={fields.heroCaption}
            onChange={(e) => updateField('heroCaption', e.target.value)}
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

      {imageFiles.length > 0 && (
        <section className="form-section">
          <h2>Images</h2>
          <ImageMatcher
            images={images}
            figures={figures}
            suggestions={suggestions}
            confirmedAssignments={confirmedAssignments}
            onAcceptSuggestion={acceptSuggestion}
            onAcceptAllSuggestions={acceptAllSuggestions}
            onClearSlot={clearSlot}
            onAssignSelectedImage={assignImageToSlot}
            onRemoveAssignment={removeAssignment}
          />
          {liveWarnings.length > 0 && (
            <div className="warning-banner image-warning-summary">
              Save will still work, but these items are currently incomplete:
              <ul>
                {liveWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {figures.length > 0 && imageFiles.length === 0 && (
        <section className="form-section">
          <h2>Images</h2>
          <div className="warning-banner">
            This article has {figures.length} figure block{figures.length !== 1 ? 's' : ''} but no images were uploaded.
            Image placeholders will remain as &ldquo;XXXX&rdquo; in the article body.
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
