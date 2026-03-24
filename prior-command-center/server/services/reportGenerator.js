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

function signedPct(n) {
  if (n == null) return '--';
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function signedPoints(n) {
  if (n == null) return '--';
  return `${n > 0 ? '+' : ''}${(n * 100).toFixed(1)}%`;
}

function percentChange(current, previous) {
  if (current == null || previous == null || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

function pointChange(current, previous) {
  if (current == null || previous == null) return null;
  return current - previous;
}

function shiftDate(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getComparisonRange(start, end) {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const days = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
  const previousEnd = shiftDate(start, -1);
  const previousStart = shiftDate(previousEnd, -(days - 1));
  return { start: previousStart, end: previousEnd };
}

function formatDateRange(start, end) {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const opts = { year: 'numeric', month: 'long', day: 'numeric' };
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}`;
}

function formatPageLabel(pathValue) {
  if (!pathValue) return '--';
  if (pathValue === '/') return 'Homepage';
  return pathValue;
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

function drawStatGrid(doc, stats, columns, pageCounter) {
  const cards = stats.map(([label, value]) => ({
    label,
    lines: [value],
  }));
  drawCardGrid(doc, cards, columns, pageCounter);
}

function drawTable(doc, headers, rows, colWidths, pageCounter) {
  const startX = MARGIN;

  ensureSpace(doc, 58, pageCounter); // Ensure room for header + a few rows

  let y = doc.y;

  // Header row
  doc.font('Prior-Bold').fontSize(7).fillColor(COLORS.muted);
  let x = startX;
  const headerHeight = 20;
  for (let i = 0; i < headers.length; i++) {
    doc.text(headers[i].toUpperCase(), x + 3, y, { width: colWidths[i] - 12, characterSpacing: 0.5 });
    x += colWidths[i];
  }
  y += headerHeight;
  doc.moveTo(startX, y).lineTo(PAGE_WIDTH - MARGIN, y).lineWidth(0.25).strokeColor(COLORS.border).stroke();
  y += 12;

  // Data rows
  doc.font('Prior').fontSize(9).fillColor(COLORS.body);
  for (const row of rows) {
    const rowHeight = Math.max(
      32,
      ...row.map((cell, index) => {
        const value = String(cell ?? '--');
        return doc.heightOfString(value, { width: colWidths[index] - 16, lineGap: 1 }) + 16;
      })
    );
    ensureSpace(doc, rowHeight + 8, pageCounter);
    y = doc.y; // Sync after potential page break
    x = startX;
    for (let i = 0; i < row.length; i++) {
      doc.text(String(row[i] ?? '--'), x + 4, y + 4, { width: colWidths[i] - 16, lineGap: 1 });
      x += colWidths[i];
    }
    doc.moveTo(startX, y + rowHeight).lineTo(PAGE_WIDTH - MARGIN, y + rowHeight).lineWidth(0.2).strokeColor(COLORS.border).stroke();
    y += rowHeight;
    doc.y = y;
  }

  doc.y = y + 12;
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
  doc.font('Prior').fontSize(9);
  const textHeights = lines.map((line) =>
    doc.heightOfString(line, { width: CONTENT_WIDTH - 20 })
  );
  const bodyHeight = textHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, lines.length - 1) * 6;
  const boxH = 34 + bodyHeight;
  ensureSpace(doc, boxH + 8, pageCounter);
  const boxY = doc.y;
  doc.rect(MARGIN, boxY, CONTENT_WIDTH, boxH).fill('#F5F5F0');

  doc.font('Prior-Bold').fontSize(7).fillColor(COLORS.muted)
    .text(label.toUpperCase(), MARGIN + 10, boxY + 8, { characterSpacing: 0.5 });

  doc.font('Prior').fontSize(9).fillColor(COLORS.body);
  let lineY = boxY + 22;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const height = textHeights[i];
    doc.text(line, MARGIN + 10, lineY, { width: CONTENT_WIDTH - 20 });
    lineY += height + 6;
  }

  doc.y = boxY + boxH + 12;
}

function drawCardGrid(doc, cards, columns, pageCounter) {
  if (!cards?.length) return;

  const gap = 14;
  const cardWidth = (CONTENT_WIDTH - gap * (columns - 1)) / columns;
  const rows = [];

  for (let i = 0; i < cards.length; i += columns) {
    rows.push(cards.slice(i, i + columns));
  }

  for (const rowCards of rows) {
    doc.font('Prior').fontSize(9);
    const heights = rowCards.map((card) => {
      const titleHeight = 16;
      const lineHeights = (card.lines || []).map((line) =>
        doc.heightOfString(line, { width: cardWidth - 20 })
      );
      return 24 + titleHeight + lineHeights.reduce((sum, height) => sum + height, 0) + Math.max(0, lineHeights.length - 1) * 6;
    });

    const cardHeight = Math.max(...heights, 86);
    ensureSpace(doc, cardHeight + 14, pageCounter);
    const y = doc.y;

    rowCards.forEach((card, index) => {
      const x = MARGIN + index * (cardWidth + gap);
      doc.rect(x, y, cardWidth, cardHeight).fill('#F8F8F3');
      doc.font('Prior-Bold').fontSize(7).fillColor(COLORS.muted)
        .text(card.label.toUpperCase(), x + 10, y + 10, { width: cardWidth - 20, characterSpacing: 0.5 });

      let lineY = y + 28;
      doc.font('Prior').fontSize(9).fillColor(COLORS.body);
      for (const line of card.lines || []) {
        const height = doc.heightOfString(line, { width: cardWidth - 20 });
        doc.text(line, x + 10, lineY, { width: cardWidth - 20 });
        lineY += height + 6;
      }
    });

    doc.y = y + cardHeight + 14;
  }
}

function formatShortDateTime(value) {
  if (!value) return '--';
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getSectionInsightNotes(insight, section) {
  if (!insight) return [];

  const keywordsBySection = {
    klaviyo: ['email', 'newsletter', 'open', 'click', 'subscriber', 'campaign', 'klaviyo', 'inbox'],
    ga: ['page', 'traffic', 'search', 'session', 'site', 'web', 'google analytics', 'reader', 'views'],
    instagram: ['instagram', 'social', 'followers', 'reach', 'engagement', 'post', 'reel'],
  };

  const keywords = keywordsBySection[section] || [];
  const pool = [
    ...(insight.highlights || []),
    ...(insight.concerns || []),
    ...(insight.recommendations || []),
  ].filter(Boolean);

  return pool
    .filter((item) => {
      const lower = item.toLowerCase();
      return keywords.some((keyword) => lower.includes(keyword));
    })
    .slice(0, 2);
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

function drawExecutiveSummary(doc, metrics, previousMetrics, insight, pageCounter) {
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
  doc.y += 58;

  const summaryNotes = [];
  if (metrics.klaviyo.best_campaign?.name) {
    summaryNotes.push(`Top email send: ${metrics.klaviyo.best_campaign.name} at ${pct(metrics.klaviyo.best_campaign.open_rate)} open rate.`);
  }
  if (metrics.googleAnalytics.top_pages?.[0]) {
    const leadPage = metrics.googleAnalytics.top_feature_page || metrics.googleAnalytics.top_pages[0];
    summaryNotes.push(`Most-read page: ${formatPageLabel(leadPage.path)} with ${fmt(leadPage.views)} views.`);
  }
  if (metrics.instagram.best_post?.caption) {
    summaryNotes.push(`Top social post reached ${fmt(metrics.instagram.best_post.reach)} readers.`);
  }
  if (insight?.highlights?.length) {
    summaryNotes.push(insight.highlights[0]);
  }

  drawCardGrid(doc, [
    {
      label: 'At a Glance',
      lines: summaryNotes.length ? summaryNotes.slice(0, 2) : ['No summary notes available for this period.'],
    },
    {
      label: 'Top Insight',
      lines: insight?.highlights?.length ? [insight.highlights[0]] : ['Generate a fresh analysis to add AI guidance here.'],
    },
  ], 2, pageCounter);

  const platformCards = [
    {
      label: 'Email Snapshot',
      lines: [
        `Campaigns with imported metrics: ${fmt(metrics.klaviyo.metric_campaigns_count || 0)}`,
        `Recipients reached: ${fmt(metrics.klaviyo.total_recipients)}`,
        `Change: ${signedPct(percentChange(metrics.klaviyo.total_recipients, previousMetrics?.klaviyo?.total_recipients))} vs prior period`,
      ],
    },
    {
      label: 'Web Snapshot',
      lines: [
        `Page views: ${fmt(metrics.googleAnalytics.total_page_views)}`,
        `Top page: ${formatPageLabel(metrics.googleAnalytics.top_feature_page?.path || metrics.googleAnalytics.top_pages?.[0]?.path)}`,
        `Change: ${signedPct(percentChange(metrics.googleAnalytics.total_page_views, previousMetrics?.googleAnalytics?.total_page_views))} vs prior period`,
      ],
    },
    {
      label: 'Social Snapshot',
      lines: [
        `Posts published: ${fmt(metrics.instagram.posts_count || 0)}`,
        `Current followers: ${fmt(metrics.instagram.current_followers)}`,
        `Change: ${signedPct(percentChange(metrics.instagram.current_followers, previousMetrics?.instagram?.current_followers))} vs prior period`,
      ],
    },
  ];
  drawCardGrid(doc, platformCards, 3, pageCounter);
}

function drawKlaviyoSection(doc, klaviyo, previousKlaviyo, insight, pageCounter) {
  ensureSpace(doc, 200, pageCounter);
  drawSectionHeader(doc, 'Email Performance — Klaviyo');

  if (klaviyo.campaigns_count === 0) {
    doc.font('Prior-Italic').fontSize(10).fillColor(COLORS.muted)
      .text('No email campaigns in this period.', MARGIN);
    doc.moveDown(1);
    return;
  }

  const stats = [
    ['Campaigns Sent', `${String(klaviyo.campaigns_count)}\n${signedPct(percentChange(klaviyo.campaigns_count, previousKlaviyo?.campaigns_count))} vs prior period`],
    ['Avg Open Rate', `${pct(klaviyo.avg_open_rate)}\n${signedPoints(pointChange(klaviyo.avg_open_rate, previousKlaviyo?.avg_open_rate))} vs prior period`],
    ['Avg Click Rate', `${pct(klaviyo.avg_click_rate)}\n${signedPoints(pointChange(klaviyo.avg_click_rate, previousKlaviyo?.avg_click_rate))} vs prior period`],
    ['Total Recipients', `${fmt(klaviyo.total_recipients)}\n${signedPct(percentChange(klaviyo.total_recipients, previousKlaviyo?.total_recipients))} vs prior period`],
  ];
  drawStatGrid(doc, stats, 2, pageCounter);

  // Best campaign callout
  if (klaviyo.best_campaign) {
    const bc = klaviyo.best_campaign;
    drawCallout(doc, 'Top Performing Campaign', [
      bc.name,
      `Open Rate: ${pct(bc.open_rate)}  •  Click Rate: ${pct(bc.click_rate)}`,
    ], pageCounter);
  }

  const emailNotes = getSectionInsightNotes(insight, 'klaviyo');
  if (emailNotes.length) {
    drawCallout(doc, 'Editorial Notes', emailNotes, pageCounter);
  }

  if (klaviyo.recent_campaigns?.length) {
    ensureSpace(doc, 140, pageCounter);
    doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.black).text('Campaign Detail', MARGIN);
    doc.moveDown(0.4);
    drawTable(doc,
      ['Campaign', 'Sent', 'Recipients', 'Open', 'Click'],
      klaviyo.recent_campaigns.map((campaign) => [
        campaign.name || campaign.subject || 'Untitled campaign',
        formatShortDateTime(campaign.send_time),
        fmt(campaign.recipients),
        pct(campaign.open_rate),
        pct(campaign.click_rate),
      ]),
      [CONTENT_WIDTH * 0.42, CONTENT_WIDTH * 0.13, CONTENT_WIDTH * 0.17, CONTENT_WIDTH * 0.14, CONTENT_WIDTH * 0.14],
      pageCounter,
    );
  }
}

function drawGASection(doc, ga, previousGa, insight, pageCounter) {
  ensureSpace(doc, 200, pageCounter);
  drawSectionHeader(doc, 'Web Performance — Google Analytics');

  const stats = [
    ['Total Page Views', `${fmt(ga.total_page_views)}\n${signedPct(percentChange(ga.total_page_views, previousGa?.total_page_views))} vs prior period`],
    ['Total Sessions', `${fmt(ga.total_sessions)}\n${signedPct(percentChange(ga.total_sessions, previousGa?.total_sessions))} vs prior period`],
    ['Avg Engagement Rate', `${pct(ga.avg_engagement_rate)}\n${signedPoints(pointChange(ga.avg_engagement_rate, previousGa?.avg_engagement_rate))} vs prior period`],
    ['Avg Bounce Rate', `${pct(ga.avg_bounce_rate)}\n${signedPoints(pointChange(ga.avg_bounce_rate, previousGa?.avg_bounce_rate))} vs prior period`],
  ];
  drawStatGrid(doc, stats, 2, pageCounter);

  const topPage = ga.top_pages?.[0];
  const leadPage = ga.top_feature_page || topPage;
  const topSource = ga.traffic_sources?.[0];
  if (topPage || topSource) {
    const lines = [];
    if (leadPage) {
      lines.push(`Top page: ${formatPageLabel(leadPage.path)} with ${fmt(leadPage.views)} views.`);
    }
    if (topSource) {
      lines.push(`Top traffic source: ${topSource.source} with ${fmt(topSource.sessions)} sessions.`);
    }
    drawCallout(doc, 'Reader Snapshot', lines, pageCounter);
  }

  const gaNotes = getSectionInsightNotes(insight, 'ga');
  if (gaNotes.length) {
    drawCallout(doc, 'Editorial Notes', gaNotes, pageCounter);
  }

  // Top pages table
  if (ga.top_pages?.length) {
    doc.moveDown(0.5);
    doc.font('Prior-Bold').fontSize(9).fillColor(COLORS.black).text('Top Pages', MARGIN);
    doc.moveDown(0.4);
    drawTable(doc,
      ['Page', 'Views'],
      ga.top_pages.map(p => [formatPageLabel(p.path), fmt(p.views)]),
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

function drawInstagramSection(doc, instagram, previousInstagram, insight, pageCounter) {
  ensureSpace(doc, 200, pageCounter);
  drawSectionHeader(doc, 'Social Performance — Instagram');

  if (instagram.posts_count === 0) {
    doc.font('Prior-Italic').fontSize(10).fillColor(COLORS.muted)
      .text('No Instagram posts in this period.', MARGIN);
    doc.moveDown(1);
    return;
  }

  const stats = [
    ['Posts Published', `${String(instagram.posts_count)}\n${signedPct(percentChange(instagram.posts_count, previousInstagram?.posts_count))} vs prior period`],
    ['Total Reach', `${fmt(instagram.total_reach)}\n${signedPct(percentChange(instagram.total_reach, previousInstagram?.total_reach))} vs prior period`],
    ['Total Engagement', `${fmt(instagram.total_engagement)}\n${signedPct(percentChange(instagram.total_engagement, previousInstagram?.total_engagement))} vs prior period`],
    ['Avg Engagement Rate', `${pct(instagram.avg_engagement_rate)}\n${signedPoints(pointChange(instagram.avg_engagement_rate, previousInstagram?.avg_engagement_rate))} vs prior period`],
    ['Follower Growth', `${instagram.follower_growth != null ? (instagram.follower_growth >= 0 ? '+' : '') + fmt(instagram.follower_growth) : '--'}\n${signedPct(percentChange(instagram.follower_growth, previousInstagram?.follower_growth))} vs prior period`],
    ['Current Followers', `${fmt(instagram.current_followers)}\n${signedPct(percentChange(instagram.current_followers, previousInstagram?.current_followers))} vs prior period`],
  ];
  drawStatGrid(doc, stats, 3, pageCounter);

  // Best post callout
  if (instagram.best_post) {
    const bp = instagram.best_post;
    drawCallout(doc, 'Top Performing Post', [
      `${bp.type || 'post'} — ${bp.caption || 'No caption'}`,
      `Reach: ${fmt(bp.reach)}  •  Likes: ${fmt(bp.likes)}  •  Saves: ${fmt(bp.saves)}`,
    ], pageCounter);
  }

  const instagramNotes = getSectionInsightNotes(insight, 'instagram');
  if (instagramNotes.length) {
    drawCallout(doc, 'Editorial Notes', instagramNotes, pageCounter);
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
  const comparisonRange = getComparisonRange(start, end);
  const previousMetrics = collectMetrics(comparisonRange.start, comparisonRange.end);
  const insight = includeInsights ? parseInsight(getLatestInsight()) : null;

  const pageCounter = { count: 1 };

  // Page 1: Cover
  drawCover(doc, start, end);

  // Page 2: Executive Summary
  doc.addPage();
  pageCounter.count++;
  drawExecutiveSummary(doc, metrics, previousMetrics, insight, pageCounter);

  // Platform sections
  if (sections.includes('klaviyo')) {
    doc.addPage();
    pageCounter.count++;
    drawKlaviyoSection(doc, metrics.klaviyo, previousMetrics.klaviyo, insight, pageCounter);
  }

  if (sections.includes('ga')) {
    doc.addPage();
    pageCounter.count++;
    drawGASection(doc, metrics.googleAnalytics, previousMetrics.googleAnalytics, insight, pageCounter);
  }

  if (sections.includes('instagram')) {
    doc.addPage();
    pageCounter.count++;
    drawInstagramSection(doc, metrics.instagram, previousMetrics.instagram, insight, pageCounter);
  }

  // Stamp footers on all pages except cover
  const totalPages = doc.bufferedPageRange().count;
  for (let i = 1; i < totalPages; i++) {
    doc.switchToPage(i);
    drawPageFooter(doc, i);
  }

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
