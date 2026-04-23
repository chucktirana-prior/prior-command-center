#!/usr/bin/env node
/**
 * Prior Command Center — Health Check
 *
 * 1. Parser smoke test — creates a tiny in-memory PDF and runs it through
 *    the full parse → markdown pipeline. No server required.
 *
 * 2. Server health — hits /api/health and pretty-prints the response.
 *    Reports "not running" (not a failure) if the server is offline.
 *
 * Usage:
 *   npm run health
 */

import 'dotenv/config';
import PDFDocument from 'pdfkit';
import { parseFromPdf } from '../server/services/uploader/pdfParser.js';
import { convertToMarkdown, scrubLeadingMetadata } from '../server/services/uploader/markdownConverter.js';

const PORT = process.env.PORT || 3002;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const green  = s => `\x1b[32m${s}\x1b[0m`;
const red    = s => `\x1b[31m${s}\x1b[0m`;
const yellow = s => `\x1b[33m${s}\x1b[0m`;
const bold   = s => `\x1b[1m${s}\x1b[0m`;

const pass = msg => console.log(`  ${green('✓')} ${msg}`);
const fail = msg => console.log(`  ${red('✗')} ${msg}`);
const skip = msg => console.log(`  ${yellow('–')} ${msg}`);
const section = title => console.log(`\n${bold(title)}`);

// ─── Tiny synthetic PDF ───────────────────────────────────────────────────────

function makeSmokePdf() {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 72 });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.font('Helvetica-Bold').fontSize(13)
       .text('Hed: Health Check Article', { width: 460 });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(12)
       .text('Slug: /health-check-smoke-test', { width: 460 });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(12)
       .text('Email SL: The parser is alive and well.', { width: 460 });
    doc.moveDown(0.35);
    doc.font('Helvetica-Bold').fontSize(12)
       .text('Keep reading', { width: 460 });
    doc.moveDown(0.35);
    doc.font('Helvetica').fontSize(11)
       .text('This sentence confirms the parser pipeline is working correctly.', { width: 460 });

    doc.end();
  });
}

// ─── Parser smoke test ────────────────────────────────────────────────────────

async function checkParser() {
  section('Parser smoke test');
  let allOk = true;

  try {
    const pdfBuffer = await makeSmokePdf();
    const parsed = await parseFromPdf(pdfBuffer);
    const rawBody = convertToMarkdown(parsed.bodyLines, parsed.bodyFontSize);
    const { markdown: articleBody, recovered } = scrubLeadingMetadata(rawBody, parsed);

    // Title
    if (parsed.title === 'Health Check Article') {
      pass(`title parsed: "${parsed.title}"`);
    } else {
      fail(`title mismatch — expected "Health Check Article", got "${parsed.title}"`);
      allOk = false;
    }

    // Slug (may land in recovered if scrubbed from body)
    const slug = parsed.slug || recovered?.slug || '';
    if (slug.includes('health-check-smoke-test')) {
      pass(`slug parsed: "${slug}"`);
    } else {
      fail(`slug missing — got "${slug}"`);
      allOk = false;
    }

    // Email subject line
    const emailSl = parsed.emailSl || recovered?.emailSl || '';
    if (emailSl.includes('parser is alive')) {
      pass(`emailSl parsed: "${emailSl}"`);
    } else {
      fail(`emailSl missing — got "${emailSl}"`);
      allOk = false;
    }

    // Article body
    if (articleBody.includes('parser pipeline is working correctly')) {
      pass('article body parsed correctly');
    } else {
      fail(`article body unexpected — got: "${articleBody.slice(0, 100)}"`);
      allOk = false;
    }

    // Body must not leak metadata
    const leaks = ['Slug:', 'Email SL:', 'Keep reading'];
    for (const token of leaks) {
      if (articleBody.includes(token)) {
        fail(`article body leaks metadata token: "${token}"`);
        allOk = false;
      }
    }
    if (allOk) pass('no metadata leaked into article body');

  } catch (err) {
    fail(`Parser threw an error: ${err.message}`);
    allOk = false;
  }

  return allOk;
}

// ─── Server health ────────────────────────────────────────────────────────────

async function checkServer() {
  section('Server health  (http://localhost:' + PORT + ')');

  let data;
  try {
    const res = await fetch(`http://localhost:${PORT}/api/health`, {
      signal: AbortSignal.timeout(4000),
    });
    data = await res.json();
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.name === 'TimeoutError' || err.cause?.code === 'ECONNREFUSED') {
      skip(`server not running on port ${PORT}  →  start it with: npm run dev`);
    } else {
      fail(`request failed: ${err.message}`);
    }
    return null; // not a failure — server may just be offline
  }

  // Core status
  data.status === 'ok'
    ? pass(`status: ${data.status}`)
    : fail(`status: ${data.status}`);

  // Database
  data.database === 'connected'
    ? pass(`database: ${data.database}`)
    : fail(`database: ${data.database}${data.db_error ? ` — ${data.db_error}` : ''}`);

  // Contentful
  data.contentful?.configured
    ? pass('contentful: configured')
    : skip('contentful: not configured  (set CONTENTFUL_* env vars to enable the uploader)');

  // Token rotation
  const rot = data.contentful?.tokenRotation;
  if (rot?.configured && rot?.daysSinceRotation != null) {
    const days = rot.daysSinceRotation;
    days > 60
      ? fail(`contentful token age: ${days} days  (consider rotating)`)
      : pass(`contentful token age: ${days} days`);
  }

  // Last syncs
  const syncs = data.last_syncs ?? {};
  const syncEntries = Object.entries(syncs);
  if (syncEntries.length > 0) {
    section('Last syncs');
    for (const [source, info] of syncEntries) {
      const label = `${source}: ${info.status}${info.completed_at ? `  (${info.completed_at})` : ''}`;
      info.status === 'success' ? pass(label) : fail(label);
    }
  } else {
    skip('no syncs recorded yet');
  }

  return data.status === 'ok' && data.database === 'connected';
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(bold('\nPrior Command Center — Health Check'));
  console.log('─'.repeat(44));

  const parserOk = await checkParser();
  const serverOk = await checkServer();

  console.log('\n' + '─'.repeat(44));

  // serverOk === null means it wasn't running — that's not a failure
  const allOk = parserOk && (serverOk === null || serverOk === true);

  if (allOk) {
    console.log(green('All checks passed.') + '\n');
    process.exit(0);
  } else {
    console.log(red('One or more checks failed.') + '\n');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(red('Unexpected error:'), err.message);
  process.exit(1);
});
