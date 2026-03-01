import Anthropic from '@anthropic-ai/sdk';
import config from '../../config.js';
import { insertInsight } from '../../db/index.js';
import { collectMetrics, collectComparativeMetrics } from './dataCollector.js';
import { buildDigestPrompt, buildOnDemandPrompt, buildAnomalyPrompt } from './promptBuilder.js';
import { runAnomalyDetection } from './anomalyDetector.js';

const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const SONNET_MODEL = 'claude-sonnet-4-6';

function getClient() {
  if (!config.anthropic.apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }
  return new Anthropic({ apiKey: config.anthropic.apiKey });
}

async function callClaude(model, system, userMessage) {
  const client = getClient();
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '';

  // Parse JSON — strip markdown fences if present
  let parsed;
  try {
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('Failed to parse Claude response as JSON: ' + text.slice(0, 200));
  }

  return { parsed, raw: text, usage: response.usage };
}

function storeInsight(parsed, type, dataPoints, rawResponse) {
  const now = new Date().toISOString();
  return insertInsight({
    generated_at: now,
    type,
    headline: parsed.headline || '',
    highlights: JSON.stringify(parsed.highlights || []),
    concerns: JSON.stringify(parsed.concerns || []),
    recommendations: JSON.stringify(parsed.recommendations || []),
    data_points: JSON.stringify(dataPoints),
    raw_response: rawResponse,
  });
}

/**
 * Generate a weekly digest using Haiku (cost-efficient for scheduled runs).
 */
export async function generateWeeklyDigest() {
  console.log('[intelligence] Generating weekly digest...');
  const now = new Date();
  const endDate = now.toISOString().split('T')[0];
  const startDate = new Date(now - 7 * 86400000).toISOString().split('T')[0];

  const metrics = collectMetrics(startDate, endDate);
  const { system, user } = buildDigestPrompt(metrics);
  const { parsed, raw, usage } = await callClaude(HAIKU_MODEL, system, user);
  console.log(`[intelligence] Haiku usage: ${usage.input_tokens} in / ${usage.output_tokens} out`);

  storeInsight(parsed, 'digest', metrics, raw);
  return parsed;
}

/**
 * On-demand deep analysis using Sonnet (higher quality for interactive use).
 */
export async function analyzeOnDemand(startDate, endDate, question = null) {
  console.log('[intelligence] Running on-demand analysis...');
  const metrics = collectMetrics(startDate, endDate);
  const { system, user } = buildOnDemandPrompt(metrics, question);
  const { parsed, raw, usage } = await callClaude(SONNET_MODEL, system, user);
  console.log(`[intelligence] Sonnet usage: ${usage.input_tokens} in / ${usage.output_tokens} out`);

  storeInsight(parsed, 'on_demand', metrics, raw);
  return parsed;
}

/**
 * Run anomaly detection, then optionally analyze anomalies with Claude.
 */
export async function detectAndAnalyzeAnomalies() {
  console.log('[intelligence] Running anomaly detection...');
  const anomalies = runAnomalyDetection();

  if (anomalies.length === 0) {
    console.log('[intelligence] No anomalies detected');
    return { anomalies: [], analysis: null };
  }

  console.log(`[intelligence] ${anomalies.length} anomalies detected, generating analysis...`);
  const { current } = collectComparativeMetrics();
  const { system, user } = buildAnomalyPrompt(anomalies, current);
  const { parsed, raw } = await callClaude(HAIKU_MODEL, system, user);

  storeInsight(parsed, 'anomaly', { anomalies }, raw);
  return { anomalies, analysis: parsed };
}
