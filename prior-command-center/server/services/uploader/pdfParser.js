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
];

function isKnownLabel(label) {
  if (KNOWN_LABELS.includes(label)) return true;
  if (/^caption\s+\d+$/.test(label)) return true;
  return false;
}

const MULTI_LINE_LABELS = [
  'dek', 'bio', 'keywords', 'meta description', 'social',
  'keep reading', 'hero caption', 'email sl', 'email pt',
];

function isMultiLineLabel(label) {
  if (MULTI_LINE_LABELS.includes(label)) return true;
  if (/^caption\s+\d+$/.test(label)) return true;
  return false;
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
    const plainText = line.runs.map((r) => r.str || '').join('').trim();
    const labelMatch = plainText.match(/^([A-Za-z0-9\s]+?):\s*/);
    if (labelMatch && isKnownLabel(labelMatch[1].trim().toLowerCase())) {
      for (const run of line.runs) {
        if (run.str && run.str.trim() && run.fontSize) return run.fontSize;
      }
    }
  }
  return null;
}

function parseLabeledFields(lines) {
  const labeledFields = {};
  let bodyStartIndex = 0;
  let lastLabel = null;
  let continuationCount = 0;
  const labelFontSize = getLabelFontSize(lines);

  for (let i = 0; i < lines.length; i++) {
    const plainText = lines[i].runs.map((r) => r.str || '').join('').trim();

    if (!plainText) {
      if (lastLabel) {
        bodyStartIndex = i + 1;
        break;
      }
      continue;
    }

    const labelMatch = plainText.match(/^([A-Za-z0-9\s]+?):\s*(.*)$/s);
    if (labelMatch) {
      const label = labelMatch[1].trim().toLowerCase();
      if (isKnownLabel(label)) {
        labeledFields[label] = labelMatch[2].trim();
        lastLabel = label;
        continuationCount = 0;
        bodyStartIndex = i + 1;
        continue;
      }
    }

    if (lastLabel) {
      const nonEmptyRuns = lines[i].runs.filter((r) => r.str && r.str.trim());
      if (nonEmptyRuns.length === 0) continue;
      const avgFontSize = nonEmptyRuns.reduce((sum, r) => sum + r.fontSize, 0) / nonEmptyRuns.length;

      if (labelFontSize && avgFontSize > labelFontSize + 0.5) {
        bodyStartIndex = i;
        break;
      }

      if (/^</.test(plainText)) {
        bodyStartIndex = i;
        break;
      }

      const lastLabelValue = labeledFields[lastLabel];
      if (!lastLabelValue && continuationCount === 0) {
        bodyStartIndex = i;
        break;
      }

      const looksLikeLabel = /^[A-Za-z0-9\s]+?:\s*/.test(plainText);
      if (looksLikeLabel && labelFontSize && Math.abs(avgFontSize - labelFontSize) < 0.5) {
        bodyStartIndex = i + 1;
        continue;
      }

      if (!isMultiLineLabel(lastLabel)) {
        const hasMoreLabels = lines.slice(i + 1, Math.min(i + 8, lines.length)).some((futureLine) => {
          const futureText = futureLine.runs.map((r) => r.str || '').join('').trim();
          const futureMatch = futureText.match(/^([A-Za-z0-9\s]+?):\s*/);
          return futureMatch && isKnownLabel(futureMatch[1].trim().toLowerCase());
        });

        if (hasMoreLabels) {
          labeledFields[lastLabel] = `${labeledFields[lastLabel]} ${plainText}`.trim();
          bodyStartIndex = i + 1;
          continue;
        }

        bodyStartIndex = i;
        break;
      }

      continuationCount++;
      if (continuationCount > 10) {
        const hasMoreLabels = lines.slice(i + 1, Math.min(i + 8, lines.length)).some((futureLine) => {
          const futureText = futureLine.runs.map((r) => r.str || '').join('').trim();
          const futureMatch = futureText.match(/^([A-Za-z0-9\s]+?):\s*/);
          return futureMatch && isKnownLabel(futureMatch[1].trim().toLowerCase());
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

  return { labeledFields, bodyStartIndex };
}

export async function parseFromPdf(pdfBuffer) {
  const { allItems, allLinks } = await extractTextAndLinks(pdfBuffer);

  const filtered = allItems.filter((item) => !isPageChrome(item));
  const articleLinks = allLinks.filter((link) => !isGoogleDriveLink(link));

  assignLinks(filtered, articleLinks);

  const lines = groupIntoLines(filtered);
  const bodyFontSize = getBodyFontSize(filtered);
  const { labeledFields, bodyStartIndex } = parseLabeledFields(lines);

  const bodyLines = lines.slice(bodyStartIndex).map((line) => ({
    runs: toRuns(line.runs),
    y: line.y,
    page: line.page,
  }));

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
    slug: (labeledFields.slug || '').replace(/^\//, ''),
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
  };
}
