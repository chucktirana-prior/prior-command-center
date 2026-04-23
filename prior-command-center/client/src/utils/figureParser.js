/**
 * Extract figure blocks from article body markdown.
 *
 * Figures look like:
 *   <figure><img src="XXXX" alt="description"/><figcaption>caption</figcaption></figure>
 *
 * Returns an array of { index, fullMatch, src, alt, caption }.
 */
const FIGURE_BLOCK_RE = /<figure\b[^>]*>\s*<img\b([^>]*)\/?>\s*(?:<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>)?\s*<\/figure>/gi;
const ATTRIBUTE_RE = /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|“([^”]*)”|‘([^’]*)’)/g;

function parseAttributes(attributeString) {
  const attributes = {};
  let match;

  while ((match = ATTRIBUTE_RE.exec(attributeString)) !== null) {
    const [, name, doubleQuoted, singleQuoted, smartDoubleQuoted, smartSingleQuoted] = match;
    attributes[name.toLowerCase()] = doubleQuoted ?? singleQuoted ?? smartDoubleQuoted ?? smartSingleQuoted ?? '';
  }

  return attributes;
}

export function extractFigures(markdown) {
  if (!markdown) return [];

  const figures = [];
  let match;
  let index = 0;

  while ((match = FIGURE_BLOCK_RE.exec(markdown)) !== null) {
    const attributes = parseAttributes(match[1] || '');

    figures.push({
      index,
      fullMatch: match[0],
      src: attributes.src || '',
      alt: attributes.alt || '',
      caption: (match[2] || '').trim(),
    });
    index++;
  }

  return figures;
}

/**
 * Replace figure src placeholders in markdown.
 *
 * @param {string} markdown - The original markdown
 * @param {Map<number, string>} figureUrlMap - Maps figure index to Contentful asset URL
 * @returns {string} Updated markdown with real URLs
 */
export function replaceFigureSrcs(markdown, figureUrlMap) {
  if (!markdown) return markdown;
  if (figureUrlMap.size === 0) return markdown;

  let index = 0;
  return markdown.replace(
    FIGURE_BLOCK_RE,
    (fullMatch, attributeString) => {
      const currentIndex = index++;
      const newUrl = figureUrlMap.get(currentIndex);
      if (!newUrl) return fullMatch;

      const updatedAttributes = (attributeString || '').replace(
        /(src\s*=\s*)(?:"([^"]*)"|'([^']*)'|“([^”]*)”|‘([^’]*)’)/i,
        (_, prefix) => `${prefix}"${newUrl}"`
      );

      return fullMatch.replace(attributeString, updatedAttributes);
    }
  );
}
