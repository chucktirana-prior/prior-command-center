function convertToMarkdown(bodyLines, bodyFontSize) {
  const hasFontSizeHeadings = bodyLines.some((line) => {
    const plainText = line.runs.map((r) => r.text).join('').trim();
    if (!plainText) return false;
    const avgSize = getAverageRunFontSize(line.runs);
    return detectHeadingLevel(avgSize, bodyFontSize) !== null;
  });

  const classified = [];
  let insideHtmlBlock = false;

  for (const line of bodyLines) {
    const plainText = line.runs.map((r) => r.text).join('').trim();

    if (!plainText) {
      classified.push({ type: 'blank' });
      insideHtmlBlock = false;
      continue;
    }

    const hasFigureOpen = /<figure/i.test(plainText);
    const hasFigureClose = /<\/figure>/i.test(plainText);

    if (hasFigureOpen || insideHtmlBlock) {
      classified.push({ type: 'html', text: plainText });
      if (hasFigureOpen && !hasFigureClose) {
        insideHtmlBlock = true;
      } else if (hasFigureClose) {
        insideHtmlBlock = false;
      }
      continue;
    }

    const avgFontSize = getAverageRunFontSize(line.runs);
    const headingLevel = detectHeadingLevel(avgFontSize, bodyFontSize);

    if (headingLevel) {
      const headingText = buildFormattedLine(line.runs, { stripBold: true });
      const prefix = '#'.repeat(headingLevel) + ' ';
      classified.push({ type: 'heading', text: prefix + headingText });
    } else if (!hasFontSizeHeadings && isBoldHeading(line.runs)) {
      const headingText = buildFormattedLine(line.runs, { stripBold: true });
      classified.push({ type: 'heading', text: '## ' + headingText });
    } else if (isStyledLine(line.runs)) {
      const mdText = buildFormattedLine(line.runs);
      classified.push({ type: 'styled', text: mdText });
    } else {
      const mdText = buildFormattedLine(line.runs);
      classified.push({ type: 'body', text: mdText });
    }
  }

  const paragraphs = [];
  let currentParagraph = null;
  let currentHtml = null;

  for (const item of classified) {
    if (item.type === 'body') {
      if (currentHtml) {
        paragraphs.push(currentHtml.join(' '));
        currentHtml = null;
      }
      if (!currentParagraph) {
        currentParagraph = [item.text];
      } else {
        currentParagraph.push(item.text);
      }
    } else if (item.type === 'html') {
      if (currentParagraph) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = null;
      }
      if (!currentHtml) {
        currentHtml = [item.text];
      } else {
        currentHtml.push(item.text);
      }
    } else {
      if (currentParagraph) {
        paragraphs.push(currentParagraph.join(' '));
        currentParagraph = null;
      }
      if (currentHtml) {
        paragraphs.push(currentHtml.join(' '));
        currentHtml = null;
      }
      if (item.type === 'heading' || item.type === 'styled') {
        paragraphs.push(item.text);
      }
    }
  }
  if (currentParagraph) paragraphs.push(currentParagraph.join(' '));
  if (currentHtml) paragraphs.push(currentHtml.join(' '));

  const markdown = paragraphs.join('\n\n').trim();
  return normalizeGuideMarkdown(markdown);
}

function isBoldHeading(runs) {
  const textRuns = runs.filter((r) => r.text && r.text.trim());
  if (textRuns.length === 0) return false;
  const allBold = textRuns.every((r) => r.bold);
  const anyLinks = textRuns.some((r) => r.link);
  return allBold && !anyLinks;
}

function isStyledLine(runs) {
  const textRuns = runs.filter((r) => r.text && r.text.trim());
  if (textRuns.length === 0) return false;
  const allBold = textRuns.every((r) => r.bold);
  const allItalic = textRuns.every((r) => r.italic);
  return allBold || allItalic;
}

function getAverageRunFontSize(runs) {
  let totalSize = 0;
  let totalLength = 0;
  for (const run of runs) {
    const len = run.text.trim().length;
    if (len > 0) {
      totalSize += run.fontSize * len;
      totalLength += len;
    }
  }
  return totalLength > 0 ? totalSize / totalLength : 0;
}

function detectHeadingLevel(fontSize, bodyFontSize) {
  if (!bodyFontSize || !fontSize) return null;
  const ratio = fontSize / bodyFontSize;
  if (ratio >= 2.0) return 1;
  if (ratio >= 1.5) return 2;
  if (ratio >= 1.2) return 3;
  return null;
}

function buildFormattedLine(runs, options = {}) {
  const { stripBold = false } = options;

  const groups = [];
  let current = null;

  for (const run of runs) {
    if (!run.text) continue;
    const key = formatKey(run, stripBold);
    if (current && current.key === key) {
      current.text += run.text;
    } else {
      if (current) groups.push(current);
      current = {
        text: run.text,
        bold: stripBold ? false : run.bold,
        italic: run.italic,
        link: run.link || null,
        key,
      };
    }
  }
  if (current) groups.push(current);

  let result = '';
  for (const group of groups) {
    let text = group.text;
    text = text.replace(/\n$/, '');
    if (!text) continue;

    if (group.bold || group.italic) {
      const leading = text.match(/^\s*/)[0];
      const trailing = text.match(/\s*$/)[0];
      const inner = text.trim();
      if (inner) {
        const marker = group.bold && group.italic ? '***' : group.bold ? '**' : '*';
        text = `${leading}${marker}${inner}${marker}${trailing}`;
      }
    }

    if (group.link) {
      text = `[${text}](${group.link})`;
    }

    result += text;
  }

  return result.trim();
}

function formatKey(run, stripBold = false) {
  return `${!stripBold && run.bold ? 'b' : ''}${run.italic ? 'i' : ''}${run.link || ''}`;
}

function normalizeGuideMarkdown(markdown) {
  if (!markdown) return markdown;

  return normalizeFigureBlockWhitespace(
    normalizeGuideSectionHeadings(markdown)
  );
}

function normalizeGuideSectionHeadings(markdown) {
  return markdown.replace(/^(#{1,6})\s+(Stay|Eat|See|Shop)\s*$/gm, (_, hashes, section) => {
    return `${hashes} Where to ${section}`;
  });
}

function normalizeFigureBlockWhitespace(markdown) {
  return markdown.replace(
    /<figure>\s*<img\b([\s\S]*?)>\s*<figcaption>([\s\S]*?)<\/figcaption>\s*<\/figure>/gi,
    (_, attributes, caption) => {
      const normalizedCaption = caption.replace(/\s+/g, ' ').trim();
      return `<figure><img${attributes}><figcaption>${normalizedCaption}</figcaption></figure>`;
    }
  );
}

const METADATA_LABEL_ALIASES = {
  'email intro text': 'emailSl',
  'email intro': 'emailSl',
  'email subject line': 'emailSl',
  'email preview text': 'emailPt',
  'email preheader': 'emailPt',
  'email preheader text': 'emailPt',
  'social copy': 'social',
  'social text': 'social',
  'social caption': 'social',
  'social post': 'social',
  'keywords': 'keywords',
  'slug': 'slug',
  'hero caption': 'heroCaption',
  'keep reading': 'keepReading',
  'article body': 'articleBody',
  'article copy': 'articleBody',
  'body': 'articleBody',
  'category': 'category',
  'location': 'location',
};

const METADATA_LABEL_PATTERN = Object.keys(METADATA_LABEL_ALIASES)
  .sort((a, b) => b.length - a.length)
  .map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function canonicalMetadataKey(label) {
  const normalized = String(label || '').trim().toLowerCase();
  return METADATA_LABEL_ALIASES[normalized] || null;
}

function extractMetadataSegments(text) {
  const source = String(text || '').trim();
  if (!source) return [];

  const regex = new RegExp(`(^|\\s)(${METADATA_LABEL_PATTERN}):\\s*`, 'gi');
  const matches = [...source.matchAll(regex)];
  if (!matches.length) return [];

  const segments = [];
  for (let i = 0; i < matches.length; i++) {
    const key = canonicalMetadataKey(matches[i][2]);
    if (!key) continue;
    const valueStart = matches[i].index + matches[i][0].length;
    const valueEnd = i + 1 < matches.length ? matches[i + 1].index : source.length;
    const value = source.slice(valueStart, valueEnd).trim();
    segments.push({ key, value });
  }

  return segments;
}

function normalizeKeywords(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeParagraphLabel(text) {
  return String(text || '')
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\*+/, '')
    .replace(/\*+$/, '')
    .trim()
    .toLowerCase();
}

function extractKeepReadingStart(paragraph) {
  const raw = String(paragraph || '').trim();
  const normalized = normalizeParagraphLabel(raw);

  if (normalized === 'keep reading' || normalized === 'keep reading:') {
    return { type: 'boundary', body: '' };
  }

  const inlineMatch = raw.match(/^(?:#{1,6}\s+)?(?:\*{1,3})?\s*keep reading\s*:?\s*(?:\*{1,3})?\s*(.*)$/i);
  if (inlineMatch) {
    return { type: 'boundary', body: inlineMatch[1].trim() };
  }

  return null;
}

function scrubLeadingMetadata(markdown, existingFields = {}) {
  let cleaned = String(markdown || '').trim();
  const recovered = {};
  const paragraphs = cleaned.split(/\n{2,}/);
  const articleBodyIndex = paragraphs.findIndex((paragraph, index) => {
    if (index > 16) return false;
    const normalized = normalizeParagraphLabel(paragraph);
    return normalized === 'article body' || normalized === 'article body:';
  });

  if (articleBodyIndex >= 0) {
    const metadataPrefix = paragraphs.slice(0, articleBodyIndex).join('\n\n');
    for (const segment of extractMetadataSegments(metadataPrefix)) {
      if (!segment.value) continue;
      if (segment.key === 'keywords') {
        recovered.keywords = normalizeKeywords(segment.value);
      } else {
        recovered[segment.key] = segment.value;
      }
    }

    cleaned = paragraphs.slice(articleBodyIndex + 1).join('\n\n').trim();
    return { markdown: cleaned, recovered };
  }

  const keepReadingIndex = paragraphs.findIndex((paragraph, index) => {
    if (index > 12) return false;
    return Boolean(extractKeepReadingStart(paragraph));
  });

  if (keepReadingIndex >= 0) {
    const metadataPrefix = paragraphs.slice(0, keepReadingIndex).join('\n\n');
    for (const segment of extractMetadataSegments(metadataPrefix)) {
      if (!segment.value) continue;
      if (segment.key === 'keywords') {
        recovered.keywords = normalizeKeywords(segment.value);
      } else {
        recovered[segment.key] = segment.value;
      }
    }

    const boundary = extractKeepReadingStart(paragraphs[keepReadingIndex]);
    const bodyParagraphs = paragraphs.slice(keepReadingIndex + 1);
    if (boundary?.body) {
      bodyParagraphs.unshift(boundary.body);
    }
    cleaned = bodyParagraphs.join('\n\n').trim();
    return { markdown: cleaned, recovered };
  }

  let firstBodyIndex = 0;

  while (firstBodyIndex < paragraphs.length) {
    const paragraph = paragraphs[firstBodyIndex].trim();
    if (!paragraph) {
      firstBodyIndex++;
      continue;
    }

    const segments = extractMetadataSegments(paragraph);
    if (!segments.length) break;

    for (const segment of segments) {
      if (!segment.value) continue;
      if (segment.key === 'keywords') {
        recovered.keywords = normalizeKeywords(segment.value);
      } else {
        recovered[segment.key] = segment.value;
      }
    }

    firstBodyIndex++;
  }

  cleaned = paragraphs.slice(firstBodyIndex).join('\n\n').trim();
  return { markdown: cleaned, recovered };
}

export { convertToMarkdown, scrubLeadingMetadata };
