import { useEffect, useMemo, useRef, useState } from 'react';
import { getBodySlotKey } from '../../utils/imageNaming';

function slotBadge(slotKey) {
  if (slotKey === 'hero') return 'Hero';
  if (slotKey === 'index') return 'Index';
  const figureIndex = Number.parseInt(slotKey.replace('body:', ''), 10);
  return Number.isNaN(figureIndex) ? 'Body' : `Figure ${figureIndex + 1}`;
}

function suggestionLabel(source) {
  return source === 'filename' ? 'Filename suggestion' : 'Upload-order suggestion';
}

export default function ImageMatcher({
  images,
  figures,
  suggestions,
  confirmedAssignments,
  onAcceptSuggestion,
  onAcceptAllSuggestions,
  onClearSlot,
  onAssignSelectedImage,
  onRemoveAssignment,
}) {
  const [selectedImageId, setSelectedImageId] = useState(null);
  const objectUrlsRef = useRef(new Map());

  const imageMap = useMemo(
    () => new Map(images.map((image) => [image.id, image])),
    [images]
  );

  function getObjectUrl(file) {
    if (!file) return null;
    if (!objectUrlsRef.current.has(file)) {
      objectUrlsRef.current.set(file, URL.createObjectURL(file));
    }
    return objectUrlsRef.current.get(file);
  }

  useEffect(() => () => {
    for (const url of objectUrlsRef.current.values()) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    if (selectedImageId && !imageMap.has(selectedImageId)) {
      setSelectedImageId(null);
    }
  }, [selectedImageId, imageMap]);

  const confirmedImageIds = new Set(Object.values(confirmedAssignments));
  const suggestionImageIds = new Set(Object.values(suggestions).map((entry) => entry.imageId));
  const unassignedImages = images.filter((image) => !confirmedImageIds.has(image.id));

  const slotModels = [
    {
      key: 'hero',
      title: 'Hero Image',
      note: 'Used for the hero asset in Contentful.',
      caption: null,
      alt: null,
    },
    {
      key: 'index',
      title: 'Index Image',
      note: 'Used for cards and index placements.',
      caption: null,
      alt: null,
    },
    ...figures.map((figure) => ({
      key: getBodySlotKey(figure.index),
      title: `Figure ${figure.index + 1}`,
      note: null,
      caption: figure.caption,
      alt: figure.alt,
    })),
  ];

  function getSlotState(slotKey) {
    const confirmedImageId = confirmedAssignments[slotKey];
    if (confirmedImageId) {
      return {
        kind: 'confirmed',
        image: imageMap.get(confirmedImageId) || null,
        source: null,
      };
    }

    const suggested = suggestions[slotKey];
    if (suggested) {
      return {
        kind: 'suggested',
        image: imageMap.get(suggested.imageId) || null,
        source: suggested.source,
      };
    }

    return { kind: 'empty', image: null, source: null };
  }

  function handleSlotClick(slotKey) {
    if (!selectedImageId) return;
    onAssignSelectedImage(slotKey, selectedImageId);
    setSelectedImageId(null);
  }

  return (
    <div className="image-matcher">
      <div className="image-matcher-toolbar">
        <p className="image-matcher-status muted">
          {Object.keys(confirmedAssignments).length} confirmed assignment{Object.keys(confirmedAssignments).length !== 1 ? 's' : ''}
          {Object.keys(suggestions).length > 0 && ` • ${Object.keys(suggestions).length} suggestion${Object.keys(suggestions).length !== 1 ? 's' : ''}`}
        </p>
        <button
          type="button"
          className="btn-secondary"
          onClick={onAcceptAllSuggestions}
          disabled={Object.keys(suggestions).length === 0}
        >
          Accept All Suggestions
        </button>
      </div>

      <div className="image-matcher-board">
        <div className="image-panel">
          <h3>Unassigned Images</h3>
          {unassignedImages.length === 0 ? (
            <p className="muted">All uploaded images are currently assigned.</p>
          ) : (
            <div className="image-tray">
              {unassignedImages.map((image) => {
                const isSelected = image.id === selectedImageId;
                const suggestedSlots = Object.entries(suggestions)
                  .filter(([, entry]) => entry.imageId === image.id)
                  .map(([slotKey, entry]) => ({ slotKey, source: entry.source }));

                return (
                  <button
                    key={image.id}
                    type="button"
                    className={`tray-image ${isSelected ? 'is-selected' : ''}`}
                    onClick={() => setSelectedImageId(isSelected ? null : image.id)}
                  >
                    <div className="tray-image-thumb">
                      <img src={getObjectUrl(image.file)} alt={image.name} />
                    </div>
                    <div className="tray-image-info">
                      <span className="tray-image-name">{image.name}</span>
                      {suggestedSlots.length > 0 && (
                        <div className="tray-image-suggestions">
                          {suggestedSlots.map(({ slotKey, source }) => (
                            <span key={`${image.id}-${slotKey}`} className="tray-suggestion-pill">
                              {slotBadge(slotKey)} • {source === 'filename' ? 'filename' : 'order'}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="slot-panel">
          <h3>Slots</h3>
          <div className="slot-list">
            {slotModels.map((slot) => {
              const state = getSlotState(slot.key);
              const preview = state.image ? getObjectUrl(state.image.file) : null;

              return (
                <div
                  key={slot.key}
                  className={`slot-card slot-${state.kind} ${selectedImageId ? 'slot-clickable' : ''}`}
                  onClick={() => handleSlotClick(slot.key)}
                >
                  <div className="slot-thumb">
                    {preview ? (
                      <img src={preview} alt={state.image.name} />
                    ) : (
                      <span className="slot-placeholder">
                        {selectedImageId ? 'Click to assign selected image' : 'No image assigned'}
                      </span>
                    )}
                  </div>

                  <div className="slot-info">
                    <div className="slot-heading">
                      <div>
                        <span className="slot-title">{slot.title}</span>
                        {slot.note && <p className="slot-note">{slot.note}</p>}
                      </div>
                      <span className={`slot-state-badge badge-${state.kind}`}>
                        {state.kind === 'confirmed' ? 'Confirmed' : state.kind === 'suggested' ? 'Suggested' : 'Empty'}
                      </span>
                    </div>

                    {slot.caption !== null && (
                      <p className="slot-caption">
                        <strong>Caption:</strong> {slot.caption || 'None'}
                      </p>
                    )}

                    {slot.alt !== null && (
                      <p className="slot-alt">
                        <strong>Alt:</strong> {slot.alt || 'None'}
                      </p>
                    )}

                    {state.image && (
                      <p className="slot-image-name">{state.image.name}</p>
                    )}

                    {state.kind === 'suggested' && state.image && (
                      <div className="slot-actions">
                        <span className="slot-suggestion-copy">{suggestionLabel(state.source)}</span>
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={(event) => {
                            event.stopPropagation();
                            onAcceptSuggestion(slot.key);
                          }}
                        >
                          Confirm Suggestion
                        </button>
                        <button
                          type="button"
                          className="btn-clear-assignment"
                          onClick={(event) => {
                            event.stopPropagation();
                            onClearSlot(slot.key);
                          }}
                        >
                          Dismiss Suggestion
                        </button>
                      </div>
                    )}

                    {state.kind === 'confirmed' && (
                      <div className="slot-actions">
                        <button
                          type="button"
                          className="btn-clear-assignment"
                          onClick={(event) => {
                            event.stopPropagation();
                            onRemoveAssignment(slot.key);
                          }}
                        >
                          Clear Assignment
                        </button>
                        {selectedImageId && (
                          <span className="slot-suggestion-copy">Click this card to replace with the selected image.</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedImageId && (
        <p className="image-matcher-help muted">
          Image selected. Click any slot card to assign or replace it.
        </p>
      )}

      {unassignedImages.length > 0 && (
        <div className="warning-banner">
          {unassignedImages.length} uploaded image{unassignedImages.length !== 1 ? 's are' : ' is'} currently unassigned and will not be uploaded unless confirmed into a hero, index, or figure slot.
        </div>
      )}
    </div>
  );
}
