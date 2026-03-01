import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import config from '../config.js';
import { collectComparativeMetrics } from '../services/intelligence/dataCollector.js';
import { getLatestInsight, getActiveAnomalies } from '../db/index.js';

const router = express.Router();
const SONNET_MODEL = 'claude-sonnet-4-6';

function buildSystemPrompt() {
  const metrics = collectComparativeMetrics();
  const latestInsight = getLatestInsight();
  const anomalies = getActiveAnomalies();

  // Format insight if available
  let insightBlock = 'No analysis available yet.';
  if (latestInsight) {
    const parse = (v) => (typeof v === 'string' ? JSON.parse(v) : v) || [];
    insightBlock = JSON.stringify({
      headline: latestInsight.headline,
      highlights: parse(latestInsight.highlights),
      concerns: parse(latestInsight.concerns),
      recommendations: parse(latestInsight.recommendations),
    }, null, 2);
  }

  // Format anomalies
  let anomalyBlock = 'No active anomalies.';
  if (anomalies.length > 0) {
    anomalyBlock = anomalies.map(a =>
      `- ${a.source}/${a.metric}: ${a.message || `${a.deviation_pct > 0 ? '+' : ''}${a.deviation_pct?.toFixed(1)}% deviation`} (severity: ${a.severity})`
    ).join('\n');
  }

  return `You are the AI assistant for Prior, a luxury travel and lifestyle publication. You help the editorial and marketing team understand their performance data across email (Klaviyo), web (Google Analytics), and social (Instagram) channels.

Your personality:
- Knowledgeable but approachable, like a trusted colleague
- Concise and direct — no filler, no hedging
- When you reference data, cite specific numbers
- If data is missing or unavailable, say so honestly
- Match Prior's editorial voice: sophisticated, clear, understated

You have access to the following current data:

## Current Period Metrics (last 7 days)
${JSON.stringify(metrics.current, null, 2)}

## Baseline Period Metrics (previous 28 days)
${JSON.stringify(metrics.baseline, null, 2)}

## Latest AI Analysis
${insightBlock}

## Active Anomalies
${anomalyBlock}

Answer questions using this data. When comparing periods, note the current period is 7 days and the baseline is 28 days — for fair comparison, normalize per-day where appropriate. Format numbers readably (e.g., "12,450 page views" not "12450"). Use markdown for structure when helpful (bold, bullet lists), but keep responses conversational, not report-like.`;
}

router.post('/chat', async (req, res) => {
  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: 'messages array is required' });
    }

    if (!config.anthropic.apiKey) {
      return res.status(503).json({ ok: false, error: 'ANTHROPIC_API_KEY not configured. Add it to your .env file.' });
    }

    const systemPrompt = buildSystemPrompt();

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const client = new Anthropic({ apiKey: config.anthropic.apiKey });

    const stream = client.messages.stream({
      model: SONNET_MODEL,
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    });

    stream.on('text', (text) => {
      res.write(`data: ${JSON.stringify({ type: 'text', text })}\n\n`);
    });

    stream.on('error', (error) => {
      console.error('[assistant] Stream error:', error.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    });

    stream.on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
      res.end();
    });

    // Handle client disconnect
    req.on('close', () => {
      stream.abort();
    });

  } catch (err) {
    console.error('[assistant] Error:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: err.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`);
      res.end();
    }
  }
});

export default router;
