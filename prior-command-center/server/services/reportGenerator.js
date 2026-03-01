import PDFDocument from 'pdfkit';
import path from 'path';
import { fileURLToPath } from 'url';
import { collectMetrics } from './intelligence/dataCollector.js';
import { getLatestInsight } from '../db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 60;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLORS = {
  black: '#000000',
  body: '#454545',
  muted: '#999999',
  border: '#D9D9D9',
  cream: '#FDFDF4',
  green: '#38761D',
  yellow: '#B45309',
};

function fmt(n) {
  if (n == null) return '--';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

function pct(n) {
  if (n == null) return '--';
  return (n * 100).toFixed(1) + '%';
}

function money(n) {
  if (n == null) return '--';
  return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts = { year: 'numeric', month: 'long', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

function registerFonts(doc) {
  try {
    doc.registerFont('Prior', path.join(FONTS_DIR, 'LibreBaskerville-Regular.ttf'));
    doc.registerFont('Prior-Bold', path.join(FONTS_DIR, 'LibreBaskerville-Bold.ttf'));
    doc.registerFont('Prior-Italic', path.join(FONTS_DIR, 'LibreBaskerville-Italic.ttf'));
  } catch (err) {
    console.warn('Custom fonts not found, using Helvetica fallback:', err.message);
    doc.registerFont('Prior', 'Helvetica');
    doc.registerFont('Prior-Bold', 'Helvetica-Bold');
    doc.registerFont('Prior-Italic', 'Helvetica-Oblique');
  }
}

function drawPageFooter(doc, pageNum) {
  const y = PAGE_HEIGHT - 40;
  // Temporarily disable bottom margin to prevent auto-pagination near page bottom
  const origBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font('Prior').fontSize(7).fillColor(COLORS.muted);
  doc.text('Prior Command Center', MARGIN, y, { width: CONTENT_WIDTH / 2, lineBreak: false });
  doc.text(`Page ${pageNum}`, MARGIN + CONTENT_WIDTH / 2, y, { width: CONTENT_WIDTH / 2, align: 'right', lineBreak: false });
  doc.page.margins.bottom = origBottom;
}

function ensureSpace(doc, needed, pageCounter) {
  if (doc.y + needed > PAGE_HEIGHT - 60) {
    drawPageFooter(doc, pageCounter.count);
    doc.addPage();
    pageCounter.count++;
    doc.y = MARGIN;
  }
}

function drawSectionHeader(doc, title) {
  doc.font('Prior-Bold').fontSize(14).fillColor(COLORS.black).text(title, MARGIN);
  doc.moveDown(0.3);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_WIDTH - MARGIN, doc.y).lineWidth(0.5).strokeColor(COLORS.border).stroke();
  doc.moveDown(0.8);
}

function drawMetricBlock(doc, x, y, label, value, w) {
  doc.font('Prior').fontSize(7).fillColor(COLORS.muted)
    .text(label.toUpperCase(), x, y, { width: w, characterSpacing: 1 });
  doc.font('Prior-Bold').fontSize(20).fillColor(COLORS.black)
    .text(value, x, y + 12, { width: w });
}

function drawTable(doc, headers, rows, colWidths, pageCounter) {
  const startX = MARGIN;

  ensureSpace(doc, 50, pageCounter); // Ensure room for header + a few rows

  let y = doc.y;

  // Header row
  doc.font('Prior-Bold').fontSize(7).fillColor(COLORS.muted);
  let x = startX;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i].toUpperCase(), x, y, { width: colWidths[i], characterSpacing: 0.5 });
    x += colWidths[i];
  }
  y += 14;
  doc.moveTo(startX, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.25).strokeColor(COLORS.border).stroke();
  y += 6;

  // Data rows
  doc.font('Prior').fontSize(9).fillColor(COLORS.body);
  for (const row of rows) {
    ensureSpace(doc, 18, pageCounter);
    y = doc.y; // Sync after potential page break
    x = startX;
    for (let i = 0; i < row.length; i++) {
      doc.text(String(row[i] ?? '--'), x, y, { width: colWidths[i] });
      x += colWidths[i];
    }
    y += 18;
    doc.y = y;
  }

  doc.y = y + 4;
}

function drawBulletList(doc, items, bulletColor, pageCounter) {
  doc.font('Prior').fontSize(9).fillColor(COLORS.body);
  for (const item of items) {
    ensureSpace(doc, 30, pageCounter);
    const y = doc.y;
    // Bullet
    doc.circle(MARGIN + 4, y + 5, 2.5).fill(bulletColor);
    // Text
    doc.fillColor(COLORS.body).text(item, MARGIN + 14, y, { width: CONTENT_WIDTH - 14 });
    doc.moveDown(0.4);
  }
}

function drawCallout(doc, label, lines, pageCounter) {
  ensureSpace(doc, 16 + lines.length * 14, pageCounter);
  const boxY = doc.y;
  const boxH = 12 + lines.length * 14 + 8;
  doc.rect(MARGIN, boxY, CONTENT_WIDTH, boxH).fill('#F5F5F0');

  doc.font('Prior-Bold').fontSize(7).fillColor(COLORS.muted)
    .text(label.toUpperCase(), MARGIN + 10, boxY + 8, { characterSpacing: 0.5 });

  doc.font('Prior').fontSize(9).fillColor(COLORS.body);
  let lineY = boxY + 22;
  for (const line of lines) {
    doc.text(line, MARGIN + 10, lineY, { width: CONTENT_WIDTH - 20 });
    lineY += 14;
  }

  doc.y = boxY + boxH + 8;
}

// --- Page Builders ---

function drawCover(doc, start, end) {
  // Cream background
  doc.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT).fill(COLORS.cream);

  // "PRIOR" masthead
  doc.font('Prior-Bold').fontSize(48).fillColor(COLORS.black);
  const priorWidth = doc.widthOfString('PRIOR');
  doc.text('PRIOR', (PAGE_WIDTH - priorWidth) / 2, 260);

  // Subtitle
  doc.font('Prior').fontSize(18).fillColor(COLORS.body);
  doc.text('Performance Report', MARGIN, 330, { width: CONTENT_WIDTH, align: 'center' });

  // Date range
  doc.font('Prior-Italic').fontSize(12).fillColor(COLORS.muted);
  doc.text(formatDateRange(start, end), MARGIN, 365, { width: CONTENT_WIDTH, align: 'center' });

  // Bottom rule + footer
  const ruleY = PAGE_HEIGHT - 60;
  doc.moveTo(MARGIN, ruleY).lineTo(PAGE_WIDTH - MARGIN, ruleY).lineWidth(0.5).strokeColor(COLORS.border).stroke();
  const origBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;
  doc.font('Prior').fontSize(8).fillColor(COLORS.muted);
  doc.text('Generated by Prior Command Center', MARGIN, ruleY + 10, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
  doc.font('Prior').fontSize(7).fillColor(COLORS.muted);
  doc.text(new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }),
    MARGIN, ruleY + 24, { width: CONTENT_WIDTH, align: 'center', lineBreak: false });
  doc.page.margins.bottom = origBottom;
}

function drawExecutiveSummary(doc, metrics, insight, pageCounter) {
  drawSectionHeader(doc, 'Executive Summary');

  // AI headline as pull-quote
  if (insight?.headline) {
    doc.font('Prior-Italic').fontSize(13).fillColor(COLORS.black);
    doc.text(`"${insight.headline}"`, MARGIN, doc.y, { width: CONTENT_WIDTH });
    doc.moveDown(1);
  }

  // KPI metrics row
  const kpis = [
    { label: 'Total Reach', value: fmt(metrics.instagram.total_reach) },
    { label: 'Engagement Rate', value: pct(metrics.instagram.avg_engagement_rate) },
    { label: 'Email Open Rate', value: pct(metrics.klaviyo.avg_open_rate) },
    { label: 'Page Views', value: fmt(metrics.googleAnalytics.total_page_views) },
    { label: 'Followers', value: fmt(metrics.instagram.current_followers) },
  ];

  const kpiWidth = CONTENT_WIDTH / 3;
  const kpiY = doc.y;

  // First row of 3
  for (let i = 0; i < 3; i++) {
    drawMetricBlock(doc, MARGIN + i * kpiWidth, kpiY, kpis[i].label, kpis[i].value, kpiWidth);
  }
  doc.y = kpiY + 50;

  // Second row of 2
  for (let i = 3; i < 5; i++) {
    drawMetricBlock(doc, MARGIN + (i - 3) * kpiWidth, doc.y, kpis[i].label, kpis[i].value, kpiWidth);
  }
  doc.y += 50;
}

function drawKlaviyoSection(doc, klaviyo, pageCounter) {
  ensureSpace(doc, 200, pageCounter);
  drawSectionHeader(doc, 'Email Performance — Klaviyo');

  if (klaviyo.campaigns_count === 0) {
    doc.font('Prior-Italic').fontSize(10).fillColor(COLORS.muted)
      .text('No email campaigns in this period.', MARGIN);
    doc.moveDown(1);
    return;
  }

  // Summary stats
  const stats = [
    ['Campaigns Sent', String(klaviyo.campaigns_count)],
    ['Avg Open Rate', pct(klaviyo.avg_open_rate)],
    ['Avg Click Rate', pct(klaviyo.avg_click_rate)],
    ['Total Revenue', money(klaviyo.total_revenue)],
    ['Total Recipients', fmt(klaviyo.total_recipients)],
  ];

  const y = doc.y;
  doc.font('Prior').fontSize(9);
  for (let i = 0; i < stats.length; i++) {
    const row = i < 3 ? 0 : 1;
    const col = i < 3 ? i : i - 3;
    const sx = MARGIN + col * (CONTENT_WIDTH / 3);
    const sy = y + row * 28;
    doc.fillColor(COLORS.muted).text(stats[i][0], sx, sy);
    doc.font('Prior-Bold').fontSize(12).fillColor(COLORS.black).text(stats[i][1], sx, sy + 12);
    doc.font('Prior').fontSize(9);
  }
  doc.y = y + 65;

  // Best campaign callout
  if (klaviyo.best_campaign) {
    const bc = klaviyo.best_campaign;
    drawCallout(doc, 'Top Performing Campaign', [
      bc.name,
      `Open Rate: ${pct(bc.open_rate)}  •  Click Rate: ${pct(bc.click_rate)}`,
    ], pageCounter);
  }
}

function drawGASection(doc, ga, pageCounter) {
  ensureSpace(doc, 200, pageCounter);
  drawSectionHeader(doc, 'Web Performance — Google Analytics');

  // Summary stats
  const stats = [
    ['Total Page Views', fmt(ga.total_page_views)],
    ['Total Sessions', fmt(ga.total_sessions)],
    ['Avg Engagement Rate', pct(ga.avg_engagement_rate)],
    ['Avg Bounce Rate', pct(ga.avg_bounce_rate)],
  ];

  const y = doc.y;
  doc.font('Prior').fontSize(9);
  for (let i = 0; i < stats.length; i++) {
    const sx = MARGIN + (i % 3) * (CONTENT_WIDTH / 3);
    const sy = y + Math.floor(i / 3) * 28;
    doc.fillColor(COLORS.muted).text(stats[i][0], sx, sy);
    doc.font('Prior-Bold').fontSize(12).fillColor(COLORS.black).text(stats[i][1], sx, sy + 12);
    doc.font('Prior').fontSize(9);
  }
  doc.y = y + 50;

  // Top pages table
  if (ga.top_pages?.length) {
    doc.moveDown(0.5);
    doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.black).text('Top Pages', MARGIN);
    doc.moveDown(0.4);
    drawTable(doc,
      ['Page', 'Views'],
      ga.top_pages.map(p => [p.path, fmt(p.views)]),
      [CONTENT_WIDTH - 80, 80],
      pageCounter,
    );
  }

  // Traffic sources table
  if (ga.traffic_sources?.length) {
    doc.moveDown(0.5);
    ensureSpace(doc, 100, pageCounter);
    doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.black).text('Traffic Sources', MARGIN);
    doc.moveDown(0.4);
    drawTable(doc,
      ['Source', 'Sessions'],
      ga.traffic_sources.map(s => [s.source, fmt(s.sessions)]),
      [CONTENT_WIDTH - 80, 80],
      pageCounter,
    );
  }
}

function drawInstagramSection(doc, instagram, pageCounter) {
  ensureSpace(doc, 200, pageCounter);
  drawSectionHeader(doc, 'Social Performance — Instagram');

  if (instagram.posts_count === 0) {
    doc.font('Prior-Italic').fontSize(10).fillColor(COLORS.muted)
      .text('No Instagram posts in this period.', MARGIN);
    doc.moveDown(1);
    return;
  }

  // Summary stats
  const stats = [
    ['Posts Published', String(instagram.posts_count)],
    ['Total Reach', fmt(instagram.total_reach)],
    ['Total Engagement', fmt(instagram.total_engagement)],
    ['Avg Engagement Rate', pct(instagram.avg_engagement_rate)],
    ['Follower Growth', instagram.follower_growth != null ? (instagram.follower_growth >= 0 ? '+' : '') + fmt(instagram.follower_growth) : '--'],
    ['Current Followers', fmt(instagram.current_followers)],
  ];

  const y = doc.y;
  doc.font('Prior').fontSize(9);
  for (let i = 0; i < stats.length; i++) {
    const sx = MARGIN + (i % 3) * (CONTENT_WIDTH / 3);
    const sy = y + Math.floor(i / 3) * 28;
    doc.fillColor(COLORS.muted).text(stats[i][0], sx, sy);
    doc.font('Prior-Bold').fontSize(12).fillColor(COLORS.black).text(stats[i][1], sx, sy + 12);
    doc.font('Prior').fontSize(9);
  }
  doc.y = y + 65;

  // Best post callout
  if (instagram.best_post) {
    const bp = instagram.best_post;
    drawCallout(doc, 'Top Performing Post', [
      `${bp.type || 'post'} — ${bp.caption || 'No caption'}`,
      `Reach: ${fmt(bp.reach)}  •  Likes: ${fmt(bp.likes)}  •  Saves: ${fmt(bp.saves)}`,
    ], pageCounter);
  }

  // Content type breakdown
  if (instagram.content_type_performance) {
    const types = Object.entries(instagram.content_type_performance);
    if (types.length > 0) {
      doc.moveDown(0.3);
      ensureSpace(doc, 80, pageCounter);
      doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.black).text('Content Type Breakdown', MARGIN);
      doc.moveDown(0.4);
      drawTable(doc,
        ['Type', 'Posts', 'Total Reach', 'Total Engagement'],
        types.map(([type, data]) => [type, data.count, fmt(data.totalReach), fmt(data.totalEng)]),
        [CONTENT_WIDTH * 0.35, CONTENT_WIDTH * 0.15, CONTENT_WIDTH * 0.25, CONTENT_WIDTH * 0.25],
        pageCounter,
      );
    }
  }
}

function drawInsightsSection(doc, insight, pageCounter) {
  ensureSpace(doc, 150, pageCounter);
  drawSectionHeader(doc, 'AI-Powered Insights');

  if (!insight) {
    doc.font('Prior-Italic').fontSize(10).fillColor(COLORS.muted)
      .text('No AI insights available for this period.', MARGIN);
    doc.moveDown(1);
    return;
  }

  // Headline
  doc.font('Prior-Bold').fontSize(13).fillColor(COLORS.black)
    .text(insight.headline, MARGIN, doc.y, { width: CONTENT_WIDTH });
  doc.moveDown(1);

  // Highlights
  if (insight.highlights?.length) {
    doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.green).text('Highlights', MARGIN);
    doc.moveDown(0.3);
    drawBulletList(doc, insight.highlights, COLORS.green, pageCounter);
    doc.moveDown(0.5);
  }

  // Concerns
  if (insight.concerns?.length) {
    ensureSpace(doc, 60, pageCounter);
    doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.yellow).text('Concerns', MARGIN);
    doc.moveDown(0.3);
    drawBulletList(doc, insight.concerns, COLORS.yellow, pageCounter);
    doc.moveDown(0.5);
  }

  // Recommendations
  if (insight.recommendations?.length) {
    ensureSpace(doc, 60, pageCounter);
    doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.black).text('Recommendations', MARGIN);
    doc.moveDown(0.3);
    drawBulletList(doc, insight.recommendations, COLORS.black, pageCounter);
  }
}

// --- Main Export ---

export function generateReport({ start, end, sections = ['klaviyo', 'ga', 'instagram'], includeInsights = true }) {
  const doc = new PDFDocument({ size: 'letter', margin: MARGIN, bufferPages: true });

  registerFonts(doc);

  const metrics = collectMetrics(start, end);
  const insight = includeInsights ? parseInsight(getLatestInsight()) : null;

  const pageCounter = { count: 1 };

  // Page 1: Cover
  drawCover(doc, start, end);

  // Page 2: Executive Summary
  doc.addPage();
  pageCounter.count++;
  drawExecutiveSummary(doc, metrics, insight, pageCounter);

  // Platform sections
  if (sections.includes('klaviyo')) {
    doc.addPage();
    pageCounter.count++;
    drawKlaviyoSection(doc, metrics.klaviyo, pageCounter);
  }

  if (sections.includes('ga')) {
    doc.addPage();
    pageCounter.count++;
    drawGASection(doc, metrics.googleAnalytics, pageCounter);
  }

  if (sections.includes('instagram')) {
    doc.addPage();
    pageCounter.count++;
    drawInstagramSection(doc, metrics.instagram, pageCounter);
  }

  // AI Insights section
  if (includeInsights && insight) {
    doc.addPage();
    pageCounter.count++;
    drawInsightsSection(doc, insight, pageCounter);
  }

  // Stamp footers on all pages except cover
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(i);
    drawPageFooter(doc, i);
  }

  doc.end();
  return doc;
}

function parseInsight(raw) {
  if (!raw) return null;
  return {
    headline: raw.headline,
    highlights: typeof raw.highlights === 'string' ? JSON.parse(raw.highlights) : raw.highlights,
    concerns: typeof raw.concerns === 'string' ? JSON.parse(raw.concerns) : raw.concerns,
    recommendations: typeof raw.recommendations === 'string' ? JSON.parse(raw.recommendations) : raw.recommendations,
  };
}
