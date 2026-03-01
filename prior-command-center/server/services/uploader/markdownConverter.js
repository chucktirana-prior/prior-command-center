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

  return paragraphs.join('\n\n').trim();
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

export { convertToMarkdown };
