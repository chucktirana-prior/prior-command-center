import {
  getKlaviyoCampaignById,
  getKlaviyoCampaignsForMatching,
  insertKlaviyoImportReview,
  upsertKlaviyoCampaign,
} from '../../db/index.js';

const REQUIRED_HEADER_REQUIREMENTS = [
  { label: 'campaign_name', fields: ['campaign_name'] },
  { label: 'send_time', fields: ['send_time', 'send_date'] },
  { label: 'recipients', fields: ['recipients'] },
  { label: 'open metrics', fields: ['open_rate', 'opens'] },
  { label: 'click metrics', fields: ['click_rate', 'clicks'] },
  { label: 'bounce metrics', fields: ['bounce_rate', 'bounces'] },
];

const HEADER_ALIASES = {
  campaign_id: ['campaign id', 'campaign_id', 'campaign message id', 'message id', 'message_id', 'id'],
  campaign_name: ['campaign name', 'campaign_name', 'campaign message name', 'campaign', 'name'],
  subject: ['subject', 'email subject', 'subject line', 'subject_line'],
  send_time: ['send time', 'send_time', 'sent at', 'sent_at', 'scheduled at', 'scheduled_at'],
  send_date: ['send date', 'send_date', 'sent date', 'scheduled date'],
  recipients: ['recipients', 'recipient', 'total recipients', 'unique recipients', 'delivered', 'received'],
  opens: ['opens', 'unique opens', 'opened'],
  open_rate: ['open rate', 'open_rate', 'unique open rate', 'open rate percent', 'unique open rate percent'],
  clicks: ['clicks', 'unique clicks', 'clicked'],
  click_rate: ['click rate', 'click_rate', 'unique click rate', 'ctr', 'click rate percent', 'ctr percent'],
  bounces: ['bounces', 'bounce count'],
  bounce_rate: ['bounce rate', 'bounce_rate', 'bounce rate percent'],
  revenue: ['revenue', 'conversion value'],
};

function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, '')
    .replace(/[%]/g, ' percent ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function splitCsvLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(csvText) {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((line) => line.trim());

  if (lines.length < 2) {
    throw new Error('CSV must include a header row and at least one data row');
  }

  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line) => splitCsvLine(line));
  return { headers, rows };
}

function buildHeaderMap(headers) {
  const normalizedHeaders = headers.map(normalizeHeader);
  const mapped = {};

  for (const [logicalField, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = normalizedHeaders.findIndex((header) => aliases.includes(header));
    if (idx >= 0) {
      mapped[logicalField] = idx;
    }
  }

  return mapped;
}

function parseNumeric(value) {
  if (value == null || value === '') return null;
  const normalized = String(value).replace(/[$,%\s,]/g, '');
  const num = Number.parseFloat(normalized);
  return Number.isFinite(num) ? num : null;
}

function parseInteger(value) {
  const num = parseNumeric(value);
  return num == null ? null : Math.round(num);
}

function parseRate(value) {
  const raw = String(value ?? '').trim();
  const num = parseNumeric(raw);
  if (num == null) return null;
  if (raw.includes('%')) {
    return num / 100;
  }
  return num > 1 ? num / 100 : num;
}

function parseSendTime(value) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function parseCombinedSendTime(dateValue, timeValue) {
  const dateText = String(dateValue || '').trim();
  const timeText = String(timeValue || '').trim();
  if (!dateText && !timeText) return null;
  if (!dateText) return parseSendTime(timeText);
  if (!timeText) return parseSendTime(dateText);

  const combined = `${dateText} ${timeText}`;
  const direct = parseSendTime(combined);
  if (direct) return direct;

  const dateMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = timeText.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!dateMatch || !timeMatch) return null;

  const [, year, month, day] = dateMatch;
  let [, hours, minutes, seconds = '00', meridiem] = timeMatch;
  let hour = Number.parseInt(hours, 10);
  if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
  if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;

  const parsed = new Date(
    Number.parseInt(year, 10),
    Number.parseInt(month, 10) - 1,
    Number.parseInt(day, 10),
    hour,
    Number.parseInt(minutes, 10),
    Number.parseInt(seconds, 10)
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function dayKey(isoString) {
  if (!isoString) return null;
  return isoString.slice(0, 10);
}

function buildMatchKey(name, sendTime) {
  if (!name || !sendTime) return null;
  return `${normalizeText(name)}::${dayKey(sendTime)}`;
}

function buildIndexes(campaigns) {
  const byId = new Map();
  const byNameDay = new Map();
  const bySubjectDay = new Map();

  for (const campaign of campaigns) {
    if (campaign.id) {
      byId.set(campaign.id, campaign);
    }

    const nameKey = buildMatchKey(campaign.name, campaign.send_time);
    if (nameKey) {
      const existing = byNameDay.get(nameKey) || [];
      existing.push(campaign);
      byNameDay.set(nameKey, existing);
    }

    const subjectKey = buildMatchKey(campaign.subject, campaign.send_time);
    if (subjectKey) {
      const existing = bySubjectDay.get(subjectKey) || [];
      existing.push(campaign);
      bySubjectDay.set(subjectKey, existing);
    }
  }

  return { byId, byNameDay, bySubjectDay };
}

function deriveRates(row) {
  const recipients = parseInteger(row.recipients);
  const opens = parseInteger(row.opens);
  const clicks = parseInteger(row.clicks);
  const bounces = parseInteger(row.bounces);

  return {
    recipients,
    opens,
    open_rate: parseRate(row.open_rate) ?? (recipients && opens != null ? opens / recipients : null),
    clicks,
    click_rate: parseRate(row.click_rate) ?? (recipients && clicks != null ? clicks / recipients : null),
    bounces,
    bounce_rate: parseRate(row.bounce_rate) ?? (recipients && bounces != null ? bounces / recipients : null),
    revenue: parseNumeric(row.revenue),
  };
}

function mapCsvRow(values, headers, headerMap, rowIndex) {
  const raw = Object.fromEntries(headers.map((header, idx) => [header, values[idx] ?? '']));
  const logical = {};
  for (const [logicalField, idx] of Object.entries(headerMap)) {
    logical[logicalField] = values[idx] ?? '';
  }

  const sendTime = parseCombinedSendTime(logical.send_date, logical.send_time);
  const metrics = deriveRates(logical);
  const issues = [];

  if (!logical.campaign_name?.trim()) issues.push('Missing campaign name');
  if (!sendTime) issues.push('Missing or invalid send time');
  if (metrics.recipients == null) issues.push('Missing recipients');
  if (metrics.open_rate == null) issues.push('Missing open rate or opens');
  if (metrics.click_rate == null) issues.push('Missing click rate or clicks');
  if (metrics.bounce_rate == null) issues.push('Missing bounce rate or bounces');

  return {
    rowIndex,
    raw,
    campaign_id: logical.campaign_id?.trim() || null,
    campaign_name: logical.campaign_name?.trim() || null,
    subject: logical.subject?.trim() || null,
    send_time: sendTime,
    ...metrics,
    issues,
  };
}

function findSingleMatch(index, key) {
  if (!key) return null;
  const matches = index.get(key) || [];
  return matches.length === 1 ? matches[0] : matches.length > 1 ? 'ambiguous' : null;
}

function matchRow(row, indexes) {
  if (row.campaign_id) {
    const exact = indexes.byId.get(row.campaign_id);
    if (exact) {
      return { status: 'matched', matchType: 'campaign_id', campaign: exact };
    }

    return {
      status: 'matched',
      matchType: 'campaign_id_new',
      campaign: {
        id: row.campaign_id,
        name: row.campaign_name,
        subject: row.subject,
        send_time: row.send_time,
      },
    };
  }

  const nameKey = buildMatchKey(row.campaign_name, row.send_time);
  const nameMatch = findSingleMatch(indexes.byNameDay, nameKey);
  if (nameMatch === 'ambiguous') {
    return { status: 'review', reason: 'Ambiguous name/date match' };
  }
  if (nameMatch) {
    return { status: 'matched', matchType: 'name_date', campaign: nameMatch };
  }

  const subjectKey = buildMatchKey(row.subject, row.send_time);
  const subjectMatch = findSingleMatch(indexes.bySubjectDay, subjectKey);
  if (subjectMatch === 'ambiguous') {
    return { status: 'review', reason: 'Ambiguous subject/date match' };
  }
  if (subjectMatch) {
    return { status: 'matched', matchType: 'subject_date', campaign: subjectMatch };
  }

  return { status: 'review', reason: 'No confident campaign match found' };
}

export function parseAndPreviewKlaviyoCsv(csvText, fileName = null) {
  const { headers, rows } = parseCsv(csvText);
  const headerMap = buildHeaderMap(headers);
  const missingFields = REQUIRED_HEADER_REQUIREMENTS
    .filter((requirement) => !requirement.fields.some((field) => headerMap[field] != null))
    .map((requirement) => requirement.label);
  if (missingFields.length > 0) {
    throw new Error(`CSV is missing required columns: ${missingFields.join(', ')}`);
  }

  const existingCampaigns = getKlaviyoCampaignsForMatching();
  const indexes = buildIndexes(existingCampaigns);
  const parsedRows = [];
  const reviewRows = [];
  const matchedRows = [];

  rows.forEach((values, idx) => {
    const row = mapCsvRow(values, headers, headerMap, idx + 2);
    if (row.issues.length > 0) {
      reviewRows.push({ ...row, reviewReason: row.issues.join('; ') });
      parsedRows.push({ ...row, status: 'review', matchType: null, matchedCampaignId: null, reviewReason: row.issues.join('; ') });
      return;
    }

    const match = matchRow(row, indexes);
    const enriched = {
      ...row,
      status: match.status,
      matchType: match.matchType || null,
      matchedCampaignId: match.campaign?.id || null,
      matchedCampaignName: match.campaign?.name || null,
      reviewReason: match.reason || null,
      sourceFile: fileName,
    };

    parsedRows.push(enriched);
    if (match.status === 'matched') {
      matchedRows.push(enriched);
    } else {
      reviewRows.push(enriched);
    }
  });

  return {
    fileName,
    headers,
    rows: parsedRows,
    summary: {
      total: parsedRows.length,
      matched: matchedRows.length,
      review: reviewRows.length,
    },
  };
}

export function confirmKlaviyoCsvImport(preview, fileName = null) {
  const now = new Date().toISOString();
  const rows = Array.isArray(preview?.rows) ? preview.rows : [];
  let imported = 0;
  let reviewCount = 0;

  for (const row of rows) {
    if (row.status === 'matched' && row.matchedCampaignId) {
      const existing = getKlaviyoCampaignById(row.matchedCampaignId);
      upsertKlaviyoCampaign({
        id: row.matchedCampaignId,
        name: row.matchedCampaignName || row.campaign_name || existing?.name || null,
        subject: row.subject || existing?.subject || null,
        send_time: row.send_time || existing?.send_time || null,
        opens: row.opens ?? existing?.opens ?? null,
        open_rate: row.open_rate ?? existing?.open_rate ?? null,
        clicks: row.clicks ?? existing?.clicks ?? null,
        click_rate: row.click_rate ?? existing?.click_rate ?? null,
        bounces: row.bounces ?? existing?.bounces ?? null,
        bounce_rate: row.bounce_rate ?? existing?.bounce_rate ?? null,
        revenue: row.revenue ?? existing?.revenue ?? null,
        recipients: row.recipients ?? existing?.recipients ?? null,
        synced_at: now,
        metadata_synced_at: existing?.metadata_synced_at ?? null,
        csv_imported_at: now,
        metrics_source: existing?.metadata_synced_at ? 'mixed' : 'csv',
        match_key: buildMatchKey(row.campaign_name || row.matchedCampaignName, row.send_time),
      });
      imported++;
      continue;
    }

    insertKlaviyoImportReview({
      imported_at: now,
      source_file: fileName || preview?.fileName || null,
      campaign_id: row.campaign_id || null,
      campaign_name: row.campaign_name || null,
      subject: row.subject || null,
      send_time: row.send_time || null,
      reason: row.reviewReason || 'No confident campaign match found',
      row_data: JSON.stringify(row.raw || row),
    });
    reviewCount++;
  }

  return {
    imported,
    reviewCount,
    total: rows.length,
  };
}
