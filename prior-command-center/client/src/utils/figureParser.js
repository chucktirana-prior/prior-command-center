/**
 * Extract figure blocks from article body markdown.
 *
 * Figures look like:
 *   <figure><img src="XXXX" alt="description"/><figcaption>caption</figcaption></figure>
 *
 * Returns an array of { index, fullMatch, src, alt, caption }.
 */
export function extractFigures(markdown) {
  if (!markdown) return [];

  const FIGURE_RE =
    /<figure>\s*<img\s+src="([^"]*)"\s+alt="([^"]*)"\s*\/?\s*>\s*<figcaption>(.*?)<\/figcaption>\s*<\/figure>/gi;

  const figures = [];
  let match;
  let index = 0;

  while ((match = FIGURE_RE.exec(markdown)) !== null) {
    figures.push({
      index,
      fullMatch: match[0],
      src: match[1],
      alt: match[2],
      caption: match[3],
    });
    index++;
  }

  return figures;
}

/**
 * Replace figure src placeholders in markdown with actual Contentful URLs.
 *
 * @param {string} markdown - The original markdown
 * @param {Map<number, string>} figureUrlMap - Maps figure index to Contentful asset URL
 * @returns {string} Updated markdown with real URLs
 */
export function replaceFigureSrcs(markdown, figureUrlMap) {
  if (!markdown || figureUrlMap.size === 0) return markdown;

  let index = 0;
  return markdown.replace(
    /<figure>\s*<img\s+src="([^"]*)"\s+alt="([^"]*)"\s*\/?\s*>\s*<figcaption>(.*?)<\/figcaption>\s*<\/figure>/gi,
    (fullMatch, src, alt, caption) => {
      const currentIndex = index++;
      const newUrl = figureUrlMap.get(currentIndex);
      if (newUrl) {
        return fullMatch.replace(`src="${src}"`, `src="${newUrl}"`);
      }
      return fullMatch;
    }
  );
}
