import { useState, useRef } from 'react';

export default function StartScreen({ onParsed }) {
  const [file, setFile] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (selected && selected.type === 'application/pdf') {
      setFile(selected);
      setError(null);
    } else if (selected) {
      setError('Please select a PDF file');
      setFile(null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === 'application/pdf') {
      setFile(dropped);
      setError(null);
    } else if (dropped) {
      setError('Please drop a PDF file');
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleImageChange(e) {
    const selected = Array.from(e.target.files).filter((f) => f.type.startsWith('image/'));
    if (selected.length > 0) {
      setImageFiles(selected);
    }
  }

  function handleImageDrop(e) {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (dropped.length > 0) {
      setImageFiles(dropped);
    }
  }

  function clearImages() {
    setImageFiles([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('pdfFile', file);

      const res = await fetch('/api/parse', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to parse document');
      }
      const data = await res.json();
      onParsed(data, imageFiles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="start-screen">
      <div className="start-card">
        <h1 className="app-title">PRIOR</h1>
        <p className="app-subtitle">Article Uploader</p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="pdfFile">Article PDF</label>
          <div
            className="drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              id="pdfFile"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              disabled={loading}
              style={{ display: 'none' }}
            />
            {file ? (
              <p className="drop-zone-filename">{file.name}</p>
            ) : (
              <p className="drop-zone-prompt">
                Drop a PDF here or click to browse
              </p>
            )}
          </div>

          <label htmlFor="imageFiles" style={{ marginTop: '1rem' }}>Article Images (optional)</label>
          <div
            className="drop-zone"
            onDrop={handleImageDrop}
            onDragOver={handleDragOver}
            onClick={() => imageInputRef.current?.click()}
          >
            <input
              ref={imageInputRef}
              id="imageFiles"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={loading}
              style={{ display: 'none' }}
            />
            {imageFiles.length > 0 ? (
              <div className="image-file-list">
                <p>{imageFiles.length} image{imageFiles.length !== 1 ? 's' : ''} selected</p>
                <span className="image-file-names">
                  {imageFiles.map((f) => f.name).join(', ')}
                </span>
              </div>
            ) : (
              <p className="drop-zone-prompt">
                Drop images here or click to browse
              </p>
            )}
          </div>
          {imageFiles.length > 0 && (
            <button type="button" className="btn-clear" onClick={clearImages} style={{ marginTop: '0.25rem' }}>
              Clear images
            </button>
          )}

          <button type="submit" className="btn-primary" disabled={loading || !file}>
            {loading ? 'Parsing...' : 'Parse Document'}
          </button>
        </form>

        {error && <div className="error-banner">{error}</div>}
      </div>
    </div>
  );
}
