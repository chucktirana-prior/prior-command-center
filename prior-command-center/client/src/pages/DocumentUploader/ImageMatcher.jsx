import { useState, useEffect, useRef } from 'react';

export default function ImageMatcher({ figures, imageFiles, assignments, onAssignmentsChange }) {
  const [selectedImageIdx, setSelectedImageIdx] = useState(null);
  const objectUrlsRef = useRef(new Map());

  function getObjectUrl(file) {
    if (!objectUrlsRef.current.has(file)) {
      objectUrlsRef.current.set(file, URL.createObjectURL(file));
    }
    return objectUrlsRef.current.get(file);
  }

  useEffect(() => {
    return () => {
      for (const url of objectUrlsRef.current.values()) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current.clear();
    };
  }, []);

  function getAssignedFigureIndex(file) {
    for (const [figIdx, assignedFile] of assignments) {
      if (assignedFile === file) return figIdx;
    }
    return null;
  }

  function handleImageClick(imageIdx) {
    setSelectedImageIdx(imageIdx === selectedImageIdx ? null : imageIdx);
  }

  function handleFigureSlotClick(figureIndex) {
    if (selectedImageIdx === null) return;

    const file = imageFiles[selectedImageIdx];
    const next = new Map(assignments);

    for (const [figIdx, assignedFile] of next) {
      if (assignedFile === file) {
        next.delete(figIdx);
      }
    }

    next.set(figureIndex, file);
    onAssignmentsChange(next);
    setSelectedImageIdx(null);
  }

  function handleClearAssignment(figureIndex) {
    const next = new Map(assignments);
    next.delete(figureIndex);
    onAssignmentsChange(next);
  }

  const matchedCount = assignments.size;
  const totalFigures = figures.length;

  return (
    <div className="image-matcher">
      <p className="image-matcher-status muted">
        {matchedCount} of {totalFigures} figure{totalFigures !== 1 ? 's' : ''} matched
      </p>

      <div className="image-matcher-layout">
        <div className="image-matcher-column">
          <h3>Uploaded Images</h3>
          <div className="image-thumbnails">
            {imageFiles.map((file, idx) => {
              const assignedFig = getAssignedFigureIndex(file);
              const isSelected = selectedImageIdx === idx;
              return (
                <div
                  key={idx}
                  className={
                    'image-thumb' +
                    (isSelected ? ' selected' : '') +
                    (assignedFig !== null ? ' assigned' : '')
                  }
                  onClick={() => handleImageClick(idx)}
                >
                  <img src={getObjectUrl(file)} alt={file.name} />
                  {assignedFig !== null && (
                    <span className="image-thumb-badge">{assignedFig + 1}</span>
                  )}
                  <span className="image-thumb-name">{file.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="image-matcher-column">
          <h3>Figure Blocks</h3>
          <div className="figure-cards">
            {figures.map((fig) => {
              const assignedFile = assignments.get(fig.index);
              return (
                <div key={fig.index} className="figure-card">
                  <div
                    className={'figure-card-preview' + (assignedFile ? ' has-image' : '')}
                    onClick={() => handleFigureSlotClick(fig.index)}
                  >
                    {assignedFile ? (
                      <img src={getObjectUrl(assignedFile)} alt="Assigned" />
                    ) : (
                      <span className="figure-card-placeholder">
                        {selectedImageIdx !== null ? 'Click to assign' : 'Select an image'}
                      </span>
                    )}
                  </div>
                  <div className="figure-card-info">
                    <span className="figure-card-number">Figure {fig.index + 1}</span>
                    <p className="figure-card-caption">{fig.caption}</p>
                    <p className="figure-card-alt">{fig.alt.length > 80 ? fig.alt.slice(0, 80) + '...' : fig.alt}</p>
                    {assignedFile && (
                      <button
                        type="button"
                        className="btn-clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearAssignment(fig.index);
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
