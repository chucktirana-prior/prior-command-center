/**
 * Parse image files by their naming convention to determine placement hints.
 *
 * Supported suffixes:
 *   _hero      -> hero image
 *   _index     -> index image
 *   _body_N    -> Nth body image
 */
export function parseImageFilename(filename) {
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');

  const heroMatch = nameWithoutExt.match(/^(.+)_hero$/i);
  if (heroMatch) {
    return { type: 'hero', number: null, prefix: heroMatch[1].trim() };
  }

  const indexMatch = nameWithoutExt.match(/^(.+)_index$/i);
  if (indexMatch) {
    return { type: 'index', number: null, prefix: indexMatch[1].trim() };
  }

  const bodyMatch = nameWithoutExt.match(/^(.+)_body_(\d+)$/i);
  if (bodyMatch) {
    return { type: 'body', number: parseInt(bodyMatch[2], 10), prefix: bodyMatch[1].trim() };
  }

  return { type: 'unknown', number: null, prefix: nameWithoutExt.trim() };
}

export function normalizeImages(imageFiles) {
  return imageFiles.map((file, index) => {
    const parsed = parseImageFilename(file.name);
    return {
      id: `img-${index}`,
      file,
      index,
      name: file.name,
      hintType: parsed.type,
      hintNumber: parsed.number,
    };
  });
}

export function getBodySlotKey(figureIndex) {
  return `body:${figureIndex}`;
}

export function parseBodySlotKey(slotKey) {
  if (!slotKey.startsWith('body:')) return null;
  const figureIndex = Number.parseInt(slotKey.slice(5), 10);
  return Number.isNaN(figureIndex) ? null : figureIndex;
}

export function suggestAssignments(images, figures) {
  const suggestions = {};
  const usedImageIds = new Set();
  const remainingBodySlots = new Set(figures.map((figure) => getBodySlotKey(figure.index)));

  function assign(slotKey, image, source) {
    if (!slotKey || !image || usedImageIds.has(image.id) || suggestions[slotKey]) return;
    suggestions[slotKey] = { imageId: image.id, source };
    usedImageIds.add(image.id);
    if (slotKey.startsWith('body:')) {
      remainingBodySlots.delete(slotKey);
    }
  }

  assign('hero', images.find((image) => image.hintType === 'hero'), 'filename');
  assign('index', images.find((image) => image.hintType === 'index' && !usedImageIds.has(image.id)), 'filename');

  for (const figure of figures) {
    const slotKey = getBodySlotKey(figure.index);
    const hinted = images.find(
      (image) => image.hintType === 'body' && image.hintNumber === figure.index + 1 && !usedImageIds.has(image.id)
    );
    assign(slotKey, hinted, 'filename');
  }

  const remainingImages = images
    .filter((image) => !usedImageIds.has(image.id))
    .filter((image) => image.hintType !== 'hero' && image.hintType !== 'index')
    .sort((a, b) => a.index - b.index);

  const remainingSlots = Array.from(remainingBodySlots)
    .map((slotKey) => ({ slotKey, figureIndex: parseBodySlotKey(slotKey) }))
    .filter((entry) => entry.figureIndex !== null)
    .sort((a, b) => a.figureIndex - b.figureIndex);

  for (let i = 0; i < Math.min(remainingImages.length, remainingSlots.length); i++) {
    assign(remainingSlots[i].slotKey, remainingImages[i], 'order');
  }

  return suggestions;
}
