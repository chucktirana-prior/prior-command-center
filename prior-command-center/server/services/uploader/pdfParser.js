import path from 'path';
import { createRequire } from 'module';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const require = createRequire(import.meta.url);
const standardFontDataUrl = `${path.join(
  path.dirname(require.resolve('pdfjs-dist/package.json')),
  'standard_fonts'
)}/`;

const KNOWN_LABELS = [
  'hed',
  'dek',
  'slug',
  'by',
  'meta title',
  'meta description',
  'keywords',
  'email sl',
  'email pt',
  'social',
  'bio',
  'category',
  'location',
  'hero caption',
  'keep reading',
  'article body',
];

const LABEL_ALIASES = {
  'email intro text': 'email sl',
  'email intro': 'email sl',
  'email subject line': 'email sl',
  'email preview text': 'email pt',
  'email preheader': 'email pt',
  'email preheader text': 'email pt',
  'social copy': 'social',
  'social text': 'social',
  'social caption': 'social',
  'social post': 'social',
  'article copy': 'article body',
  'body': 'article body',
};

const LABEL_PATTERN = [...new Set([...KNOWN_LABELS, ...Object.keys(LABEL_ALIASES)])]
  .sort((a, b) => b.length - a.length)
  .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function canonicalizeLabel(label) {
  const normalized = String(label || '').trim().toLowerCase();
  return LABEL_ALIASES[normalized] || normalized;
}

function isKnownLabel(label) {
  const canonical = canonicalizeLabel(label);
  if (KNOWN_LABELS.includes(canonical)) return true;
  if (/^caption\s+\d+$/.test(label)) return true;
  return false;
}

const MULTI_LINE_LABELS = [
  'dek', 'bio', 'keywords', 'meta description', 'social',
  'keep reading', 'hero caption', 'email sl', 'email pt',
];

function isMultiLineLabel(label) {
  const canonical = canonicalizeLabel(label);
  if (MULTI_LINE_LABELS.includes(canonical)) return true;
  if (/^caption\s+\d+$/.test(label)) return true;
  return false;
}

function extractKnownLabelSegments(text) {
  const source = String(text || '').trim();
  if (!source) return [];

  const regex = new RegExp(`(^|\\s)(${LABEL_PATTERN}):\\s*`, 'gi');
  const matches = [...source.matchAll(regex)];
  if (!matches.length) return [];

  const segments = [];
  for (let i = 0; i < matches.length; i++) {
    const rawLabel = matches[i][2].trim();
    const label = canonicalizeLabel(rawLabel);
    if (!isKnownLabel(label)) continue;

    const start = matches[i].index + matches[i][1].length;
    const valueStart = matches[i].index + matches[i][0].length;
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const value = source.slice(valueStart, valueEnd).trim();
    segments.push({ label, value, start });
  }

  return segments;
}

function extractStyledLeadingLabelSegment(line) {
  const runs = line?.runs || [];
  if (!runs.length) return [];

  const textRuns = runs.filter((run) => run.str && run.str.trim());
  if (!textRuns.length) return [];

  const labelRuns = [];
  let encounteredNonBold = false;

  for (const run of runs) {
    const text = run.str || '';
    if (!text.trim()) {
      if (!encounteredNonBold && labelRuns.length > 0) {
        labelRuns.push(run);
      }
      continue;
    }

    if (!encounteredNonBold && run.bold) {
      labelRuns.push(run);
      continue;
    }

    encounteredNonBold = true;
    break;
  }

  if (!labelRuns.length) return [];

  const labelText = labelRuns.map((run) => run.str || '').join('').trim();
  const normalizedLabel = canonicalizeLabel(labelText.replace(/:\s*$/, ''));
  if (!isKnownLabel(normalizedLabel)) return [];

  const consumedLength = labelRuns.map((run) => run.str || '').join('').length;
  const fullText = runs.map((run) => run.str || '').join('');
  const rawRemainder = fullText.slice(consumedLength);
  const value = rawRemainder.replace(/^:\s*/, '').trim();
  return [{ label: normalizedLabel, value, start: 0 }];
}

function extractLineLabelSegments(line) {
  const plainText = line.runs.map((r) => r.str || '').join('').trim();
  const inlineSegments = extractKnownLabelSegments(plainText);
  if (inlineSegments.length > 0) return inlineSegments;
  return extractStyledLeadingLabelSegment(line);
}

async function extractTextAndLinks(pdfBuffer) {
  const uint8 = new Uint8Array(pdfBuffer);
  const doc = await getDocument({
    data: uint8,
    standardFontDataUrl,
  }).promise;

  const allItems = [];
  const allLinks = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const viewport = page.getViewport({ scale: 1.0 });

    await page.getOperatorList();

    const content = await page.getTextContent();

    const fontMap = {};
    for (const item of content.items) {
      if (item.fontName && !fontMap[item.fontName]) {
        try {
          const fontObj = page.commonObjs.get(item.fontName);
          fontMap[item.fontName] = fontObj ? fontObj.name : '';
        } catch {
          fontMap[item.fontName] = '';
        }
      }
    }

    for (const item of content.items) {
      if (item.str == null) continue;

      const psName = fontMap[item.fontName] || '';
      const bold = /Bold/i.test(psName);
      const italic = /Italic/i.test(psName);
      const fontSize = Math.abs(item.transform[3]) || Math.abs(item.transform[0]);
      const x = item.transform[4];
      const y = item.transform[5];

      allItems.push({
        str: item.str,
        fontName: item.fontName,
        psName,
        bold,
        italic,
        fontSize,
        x,
        y,
        width: item.width || 0,
        hasEOL: item.hasEOL || false,
        page: p - 1,
        pageHeight: viewport.height,
      });
    }

    const annotations = await page.getAnnotations();
    for (const annot of annotations) {
      if (annot.subtype === 'Link' && annot.url) {
        allLinks.push({
          url: annot.url,
          rect: annot.rect,
          page: p - 1,
        });
      }
    }
  }

  return { allItems, allLinks };
}

function isPageChrome(item) {
  const psName = item.psName;
  if (/GoogleSans/i.test(psName)) return true;
  if (/Times/i.test(psName) && item.fontSize < 9) return true;
  if (/docs\.google\.com|drive\.google\.com/i.test(item.str)) return true;
  return false;
}

function isGoogleDriveLink(link) {
  return /drive\.google\.com|docs\.google\.com/i.test(link.url);
}

function groupIntoLines(items) {
  if (items.length === 0) return [];

  const lines = [];
  let currentRuns = [items[0]];
  let currentY = items[0].y;
  let currentPage = items[0].page;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    const sameY = Math.abs(item.y - currentY) < 2.0;
    const samePage = item.page === currentPage;

    if (sameY && samePage) {
      currentRuns.push(item);
    } else {
      lines.push({ runs: currentRuns, y: currentY, page: currentPage });
      currentRuns = [item];
      currentY = item.y;
      currentPage = item.page;
    }
  }
  lines.push({ runs: currentRuns, y: currentY, page: currentPage });

  lines.sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    return b.y - a.y;
  });

  for (const line of lines) {
    line.runs.sort((a, b) => a.x - b.x);
  }

  const gaps = [];
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].page === lines[i - 1].page) {
      const gap = lines[i - 1].y - lines[i].y;
      if (gap > 0) gaps.push(gap);
    }
  }

  if (gaps.length > 0) {
    gaps.sort((a, b) => a - b);
    const medianGap = gaps[Math.floor(gaps.length / 2)];
    const threshold = medianGap * 1.7;

    for (let i = lines.length - 1; i > 0; i--) {
      if (lines[i].page === lines[i - 1].page) {
        const gap = lines[i - 1].y - lines[i].y;
        if (gap > threshold) {
          lines.splice(i, 0, { runs: [], y: 0, page: lines[i].page });
        }
      } else if (lines[i].page !== lines[i - 1].page) {
        const prevText = lines[i - 1].runs.map((r) => r.str || '').join('').trim();
        const nextText = lines[i].runs.map((r) => r.str || '').join('').trim();
        if (/[.!?]$/.test(prevText) && /^[A-Z]/.test(nextText)) {
          lines.splice(i, 0, { runs: [], y: 0, page: lines[i].page });
        }
      }
    }
  }

  return lines;
}

function assignLinks(items, links) {
  if (links.length === 0) return;

  for (const item of items) {
    if (!item.str.trim()) continue;

    for (const link of links) {
      if (item.page !== link.page) continue;

      const [lx1, ly1, lx2, ly2] = link.rect;
      const tolerance = 1;
      const itemEnd = item.x + (item.width || 0);
      const linkWidth = lx2 - lx1;
      const overlapStart = Math.max(item.x, lx1);
      const overlapEnd = Math.min(itemEnd, lx2);
      const overlap = Math.max(0, overlapEnd - overlapStart);

      if (
        overlap > Math.min(item.width, linkWidth) * 0.5 &&
        item.y >= ly1 - tolerance &&
        item.y <= ly2 + tolerance
      ) {
        item.link = link.url;
        break;
      }
    }
  }
}

function unwrapGoogleUrl(url) {
  if (!url) return url;
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'www.google.com' && parsed.pathname === '/url') {
      const actual = parsed.searchParams.get('q');
      if (actual) return actual;
    }
  } catch {
    // Not a valid URL
  }
  return url;
}

function toRuns(items) {
  return items
    .filter((item) => {
      if (!item.str.trim()) {
        if (item.str === ' ' && !item.link) return true;
        return false;
      }
      return true;
    })
    .map((item) => ({
      text: item.str,
      bold: item.bold,
      italic: item.italic,
      fontSize: item.fontSize,
      link: item.link ? unwrapGoogleUrl(item.link) : undefined,
    }));
}

function getBodyFontSize(items) {
  const sizeCounts = {};
  for (const item of items) {
    if (!item.str.trim()) continue;
    const key = item.fontSize.toFixed(1);
    sizeCounts[key] = (sizeCounts[key] || 0) + item.str.length;
  }
  const sorted = Object.entries(sizeCounts).sort((a, b) => b[1] - a[1]);
  return sorted.length > 0 ? parseFloat(sorted[0][0]) : 12;
}

function getLabelFontSize(lines) {
  for (const line of lines) {
    if (extractLineLabelSegments(line).length > 0) {
      for (const run of line.runs) {
        if (run.str && run.str.trim() && run.fontSize) return run.fontSize;
      }
    }
  }
  return null;
}

// Lines that are template instructions or Y/N checkbox fields — never article body.
// e.g. "[Do not use separate lines, separate by a comma followed by a space]"
// e.g. "Apple mAPS[Y/N]: N"
function isMetadataOnlyLine(text) {
  const t = String(text || '').trim();
  if (!t) return false;
  // Standalone bracket instruction: starts and ends with [ ]
  if (/^\[.{4,}\]$/.test(t)) return true;
  // Y/N checkbox field anywhere in the line (catches "[...] Apple mAPS[Y/N]: N")
  if (/\[Y\/N\]\s*:\s*[YN]$/i.test(t)) return true;
  return false;
}

function isKeepReadingBoundary(text) {
  const normalized = String(text || '').trim().toLowerCase();
  return normalized === 'keep reading' || normalized === 'keep reading:';
}

function isArticleBodyBoundary(text) {
  const normalized = String(text || '').trim().toLowerCase();
  return normalized === 'article body' || normalized === 'article body:';
}

function collectLineLinks(line) {
  return line.runs
    .filter((r) => r.link)
    .map((r) => unwrapGoogleUrl(r.link))
    .filter(Boolean);
}

function parseLabeledFields(lines) {
  const labeledFields = {};
  const keepReadingLinks = []; // hyperlinks found on "keep reading" lines
  let bodyStartIndex = 0;
  let lastLabel = null;
  let continuationCount = 0;
  const labelFontSize = getLabelFontSize(lines);
  const hasArticleBodyLabel = lines.some((line) => {
    const plainText = line.runs.map((r) => r.str || '').join('').trim();
    if (isArticleBodyBoundary(plainText)) return true;
    return extractLineLabelSegments(line).some((segment) => segment.label === 'article body');
  });

  for (let i = 0; i < lines.length; i++) {
    const plainText = lines[i].runs.map((r) => r.str || '').join('').trim();

    if (!plainText) {
      // When Article body: is present, blank lines don't end the metadata section.
      if (lastLabel && !hasArticleBodyLabel) {
        bodyStartIndex = i + 1;
        break;
      }
      continue;
    }

    if (isArticleBodyBoundary(plainText)) {
      bodyStartIndex = i + 1;
      break;
    }

    if (!hasArticleBodyLabel && isKeepReadingBoundary(plainText)) {
      labeledFields['keep reading'] = labeledFields['keep reading'] || '';
      bodyStartIndex = i + 1;
      break;
    }

    if (isMetadataOnlyLine(plainText)) {
      bodyStartIndex = i + 1;
      continue;
    }

    const labelSegments = extractLineLabelSegments(lines[i]);
    if (labelSegments.length > 0) {
      const leadingText = plainText.slice(0, labelSegments[0].start).trim();
      if (leadingText && lastLabel && isMultiLineLabel(lastLabel)) {
        labeledFields[lastLabel] = `${labeledFields[lastLabel] || ''} ${leadingText}`.trim();
      }

      for (const segment of labelSegments) {
        labeledFields[segment.label] = segment.value;
      }

      lastLabel = labelSegments[labelSegments.length - 1].label;
      continuationCount = 0;
      bodyStartIndex = i + 1;

      // Collect any hyperlinks on the keep reading label line itself.
      if (lastLabel === 'keep reading') {
        keepReadingLinks.push(...collectLineLinks(lines[i]));
      }

      if (lastLabel === 'article body') {
        break;
      }
      continue;
    }

    if (lastLabel) {
      const nonEmptyRuns = lines[i].runs.filter((r) => r.str && r.str.trim());
      if (nonEmptyRuns.length === 0) continue;
      const avgFontSize = nonEmptyRuns.reduce((sum, r) => sum + r.fontSize, 0) / nonEmptyRuns.length;

      // When Article body: is present we know exactly where the body starts, so
      // none of the early-exit heuristics below should fire — keep consuming.
      if (!hasArticleBodyLabel) {
        if (labelFontSize && avgFontSize > labelFontSize + 0.5) {
          bodyStartIndex = i;
          break;
        }

        if (/^</.test(plainText)) {
          bodyStartIndex = i;
          break;
        }

        const lastLabelValue = labeledFields[lastLabel];
        if (!lastLabelValue && continuationCount === 0 && !isMultiLineLabel(lastLabel)) {
          bodyStartIndex = i;
          break;
        }
      }

      const looksLikeLabel = extractLineLabelSegments(lines[i]).length > 0;
      if (looksLikeLabel && labelFontSize && Math.abs(avgFontSize - labelFontSize) < 0.5) {
        bodyStartIndex = i + 1;
        continue;
      }

      if (!isMultiLineLabel(lastLabel)) {
        if (hasArticleBodyLabel) {
          // Article body: is coming — treat everything as metadata continuation.
          labeledFields[lastLabel] = `${labeledFields[lastLabel] || ''} ${plainText}`.trim();
          bodyStartIndex = i + 1;
          continue;
        }

        const hasMoreLabels = lines.slice(i + 1, Math.min(i + 8, lines.length)).some((futureLine) => {
          return extractLineLabelSegments(futureLine).length > 0;
        });

        if (hasMoreLabels) {
          labeledFields[lastLabel] = `${labeledFields[lastLabel]} ${plainText}`.trim();
          bodyStartIndex = i + 1;
          continue;
        }

        bodyStartIndex = i;
        break;
      }

      // Collect hyperlinks from keep reading continuation lines.
      if (lastLabel === 'keep reading') {
        keepReadingLinks.push(...collectLineLinks(lines[i]));
      }

      continuationCount++;
      if (continuationCount > 10) {
        if (hasArticleBodyLabel) {
          // Never give up early when Article body: is present.
          labeledFields[lastLabel] = `${labeledFields[lastLabel]} ${plainText}`.trim();
          bodyStartIndex = i + 1;
          continue;
        }

        const hasMoreLabels = lines.slice(i + 1, Math.min(i + 8, lines.length)).some((futureLine) => {
          return extractLineLabelSegments(futureLine).length > 0;
        });

        if (hasMoreLabels) {
          labeledFields[lastLabel] = `${labeledFields[lastLabel]} ${plainText}`.trim();
          bodyStartIndex = i + 1;
          continue;
        }

        bodyStartIndex = i;
        break;
      }

      labeledFields[lastLabel] = `${labeledFields[lastLabel]} ${plainText}`.trim();
      bodyStartIndex = i + 1;
    }
  }

  return { labeledFields, keepReadingLinks, bodyStartIndex };
}

function getAverageLineFontSize(runs) {
  const nonEmptyRuns = runs.filter((run) => run.str && run.str.trim());
  if (nonEmptyRuns.length === 0) return 0;
  return nonEmptyRuns.reduce((sum, run) => sum + run.fontSize, 0) / nonEmptyRuns.length;
}

function stripLeadingMetadataLines(lines, bodyFontSize) {
  let startIndex = 0;
  let activeLabel = null;
  let continuationCount = 0;

  while (startIndex < lines.length) {
    const line = lines[startIndex];
    const plainText = line.runs.map((r) => r.str || '').join('').trim();

    if (!plainText) {
      startIndex++;
      continue;
    }

    if (isArticleBodyBoundary(plainText)) {
      startIndex++;
      break;
    }

    if (isMetadataOnlyLine(plainText)) {
      startIndex++;
      continue;
    }

    const labelSegments = extractLineLabelSegments(line);
    if (labelSegments.length > 0) {
      activeLabel = labelSegments[labelSegments.length - 1].label;
      continuationCount = 0;
      startIndex++;
      if (activeLabel === 'article body') {
        break;
      }
      continue;
    }

    if (activeLabel && isMultiLineLabel(activeLabel)) {
      const avgFontSize = getAverageLineFontSize(line.runs);
      const looksLikeBody = (
        /^</.test(plainText) ||
        /^(#{1,6}\s+)?[A-Z]/.test(plainText) ||
        avgFontSize > bodyFontSize * 1.12
      );
      const looksLikeAnotherLabel = /^[A-Za-z0-9\s]+:\s*/.test(plainText);

      if (!looksLikeBody && !looksLikeAnotherLabel && continuationCount < 6) {
        continuationCount++;
        startIndex++;
        continue;
      }
    }

    break;
  }

  return lines.slice(startIndex);
}

function looksLikeBodyIntro(text) {
  const normalized = String(text || '').trim();
  if (!normalized) return false;
  if (normalized.length < 40) return false;
  if (/^(https?:\/\/|\/)/i.test(normalized)) return false;
  return /\s/.test(normalized);
}

function linePlainText(line) {
  return (line?.runs || []).map((run) => run.text || '').join('').trim();
}

function findExplicitArticleBodyStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    const plainText = lines[i].runs.map((r) => r.str || '').join('').trim();
    if (isArticleBodyBoundary(plainText)) {
      return { index: i + 1, value: '' };
    }

    const segments = extractLineLabelSegments(lines[i]);
    const articleBodySegment = segments.find((segment) => segment.label === 'article body');
    if (articleBodySegment) {
      return { index: i + 1, value: articleBodySegment.value || '' };
    }
  }

  return null;
}

function normalizeSlugValue(value) {
  return String(value || '')
    .trim()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '')
    .replace(/^\//, '');
}

export async function parseFromPdf(pdfBuffer) {
  const { allItems, allLinks } = await extractTextAndLinks(pdfBuffer);

  const filtered = allItems.filter((item) => !isPageChrome(item));
  const articleLinks = allLinks.filter((link) => !isGoogleDriveLink(link));

  assignLinks(filtered, articleLinks);

  const lines = groupIntoLines(filtered);
  const bodyFontSize = getBodyFontSize(filtered);
  const parsedFields = parseLabeledFields(lines);
  const { labeledFields, keepReadingLinks } = parsedFields;
  let bodyStartIndex = parsedFields.bodyStartIndex;
  const explicitArticleBody = findExplicitArticleBodyStart(lines);
  if (explicitArticleBody) {
    bodyStartIndex = explicitArticleBody.index;
    if (!Object.prototype.hasOwnProperty.call(labeledFields, 'article body')) {
      labeledFields['article body'] = explicitArticleBody.value;
    }
  }

  const sanitizedBodyLines = stripLeadingMetadataLines(lines.slice(bodyStartIndex), bodyFontSize);
  const bodyLines = sanitizedBodyLines.map((line) => ({
    runs: toRuns(line.runs),
    y: line.y,
    page: line.page,
  }));

  const articleBodyInline = labeledFields['article body'] || '';
  const keepReadingInline = labeledFields['keep reading'] || '';
  const hasExplicitArticleBody = Object.prototype.hasOwnProperty.call(labeledFields, 'article body');
  const inlineBodyIntro = looksLikeBodyIntro(articleBodyInline)
    ? articleBodyInline
    : !hasExplicitArticleBody && looksLikeBodyIntro(keepReadingInline)
      ? keepReadingInline
      : '';

  if (inlineBodyIntro) {
    bodyLines.unshift({
      runs: [{
        text: inlineBodyIntro,
        bold: false,
        italic: false,
        fontSize: bodyFontSize,
        link: null,
      }],
      y: bodyLines[0]?.y ?? 0,
      page: bodyLines[0]?.page ?? 0,
    });

    const continuation = bodyLines[1];
    const continuationText = linePlainText(continuation);
    if (/^[a-z]/.test(continuationText)) {
      bodyLines[0].runs[0].text = `${bodyLines[0].runs[0].text} ${continuationText}`.trim();
      bodyLines.splice(1, 1);
    }
  }

  const captions = [];
  for (const [key, value] of Object.entries(labeledFields)) {
    const captionMatch = key.match(/^caption\s+(\d+)$/);
    if (captionMatch) {
      captions.push({ number: parseInt(captionMatch[1], 10), text: value });
    }
  }
  captions.sort((a, b) => a.number - b.number);

  return {
    title: labeledFields.hed || '',
    subtitle: labeledFields.dek || '',
    slug: normalizeSlugValue(labeledFields.slug || ''),
    authorName: labeledFields.by || '',
    metaTitle: labeledFields['meta title'] || '',
    metaDescription: labeledFields['meta description'] || '',
    keywords: labeledFields.keywords
      ? labeledFields.keywords.split(',').map((k) => k.trim()).filter(Boolean)
      : [],
    bio: labeledFields.bio || '',
    social: labeledFields.social || '',
    category: labeledFields.category || '',
    location: labeledFields.location || '',
    heroCaption: labeledFields['hero caption'] || '',
    keepReading: labeledFields['keep reading'] || '',
    emailSl: labeledFields['email sl'] || '',
    emailPt: labeledFields['email pt'] || '',
    captions,
    bodyLines,
    bodyFontSize,
    keepReadingLinks: [...new Set(keepReadingLinks)], // deduplicated
  };
}
