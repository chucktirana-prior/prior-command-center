import fs from 'fs';
import os from 'os';
import path from 'path';
import PDFDocument from 'pdfkit';
import { uploaderFixtures } from './fixtures.js';
import { parseFromPdf } from '../../server/services/uploader/pdfParser.js';
import { convertToMarkdown, scrubLeadingMetadata } from '../../server/services/uploader/markdownConverter.js';

function createPdfBuffer(lines) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    for (const line of lines) {
      if (line.blank) {
        doc.moveDown(line.height ?? 0.6);
        continue;
      }

      if (line.segments?.length) {
        line.segments.forEach((segment, index) => {
          doc.font(segment.bold ? 'Helvetica-Bold' : 'Helvetica');
          doc.fontSize(segment.size ?? line.size ?? 11);
          doc.text(segment.text, {
            width: 460,
            lineGap: 2,
            continued: index < line.segments.length - 1,
          });
        });
      } else {
        doc.font(line.bold ? 'Helvetica-Bold' : 'Helvetica');
        doc.fontSize(line.size ?? 11);
        doc.text(line.text, {
          width: 460,
          lineGap: 2,
        });
      }
      doc.moveDown(line.after ?? 0.35);
    }

    doc.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSlug(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
}

async function runFixture(fixture, outputDir) {
  const pdfBuffer = await createPdfBuffer(fixture.lines);
  const parsed = await parseFromPdf(pdfBuffer);
  const rawBody = convertToMarkdown(parsed.bodyLines, parsed.bodyFontSize);
  const { markdown: articleBody, recovered } = scrubLeadingMetadata(rawBody, parsed);
  const result = {
    ...parsed,
    slug: parsed.slug || recovered.slug || '',
    articleBody,
    recovered,
  };

  if (outputDir) {
    fs.writeFileSync(path.join(outputDir, `${fixture.id}.pdf`), pdfBuffer);
    fs.writeFileSync(
      path.join(outputDir, `${fixture.id}.json`),
      JSON.stringify(
        {
          title: result.title,
          slug: result.slug,
          emailSl: result.emailSl || recovered.emailSl || '',
          emailPt: result.emailPt || recovered.emailPt || '',
          social: result.social || recovered.social || '',
          keywords: result.keywords?.length ? result.keywords : (recovered.keywords || []),
          heroCaption: result.heroCaption || recovered.heroCaption || '',
          articleBody: result.articleBody,
        },
        null,
        2
      )
    );
  }

  if (fixture.expected.title) {
    assert(normalizeText(result.title) === fixture.expected.title, `[${fixture.id}] expected title "${fixture.expected.title}", got "${result.title}"`);
  }

  if (fixture.expected.slug) {
    assert(normalizeSlug(result.slug) === fixture.expected.slug, `[${fixture.id}] expected slug "${fixture.expected.slug}", got "${result.slug}"`);
  }

  if (fixture.expected.emailSl) {
    const emailSl = result.emailSl || recovered.emailSl || '';
    assert(normalizeText(emailSl) === fixture.expected.emailSl, `[${fixture.id}] expected emailSl to match`);
  }

  if (fixture.expected.emailPt) {
    const emailPt = result.emailPt || recovered.emailPt || '';
    assert(normalizeText(emailPt) === fixture.expected.emailPt, `[${fixture.id}] expected emailPt to match`);
  }

  if (fixture.expected.social) {
    const social = result.social || recovered.social || '';
    assert(normalizeText(social) === fixture.expected.social, `[${fixture.id}] expected social to match`);
  }

  if (fixture.expected.heroCaption) {
    const heroCaption = result.heroCaption || recovered.heroCaption || '';
    assert(normalizeText(heroCaption) === fixture.expected.heroCaption, `[${fixture.id}] expected heroCaption to match`);
  }

  if (fixture.expected.keywords) {
    const keywords = result.keywords?.length ? result.keywords : (recovered.keywords || []);
    assert(
      JSON.stringify(keywords.map((item) => normalizeText(item))) === JSON.stringify(fixture.expected.keywords),
      `[${fixture.id}] expected keywords ${JSON.stringify(fixture.expected.keywords)}, got ${JSON.stringify(keywords)}`
    );
  }

  assert(
    normalizeText(articleBody).startsWith(fixture.expected.bodyStartsWith),
    `[${fixture.id}] body should start with "${fixture.expected.bodyStartsWith}", got "${articleBody.slice(0, 180)}"`
  );

  for (const forbidden of fixture.expected.bodyMustNotInclude || []) {
    assert(!articleBody.includes(forbidden), `[${fixture.id}] body should not include "${forbidden}"`);
  }

  return {
    id: fixture.id,
    title: result.title,
    bodyPreview: articleBody.slice(0, 120),
  };
}

async function main() {
  const writeFixtures = process.argv.includes('--write-fixtures');
  const outputDir = writeFixtures
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'prior-uploader-fixtures-'))
    : null;

  const summaries = [];
  for (const fixture of uploaderFixtures) {
    summaries.push(await runFixture(fixture, outputDir));
  }

  console.log(`Parsed ${summaries.length} uploader fixtures successfully.`);
  for (const summary of summaries) {
    console.log(`- ${summary.id}: ${summary.bodyPreview}`);
  }

  if (outputDir) {
    console.log(`Fixture PDFs and snapshots written to ${outputDir}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
