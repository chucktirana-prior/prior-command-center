const SYSTEM_PROMPT = `You are the intelligence analyst for Prior, a luxury travel and lifestyle publication. Your role is to analyze marketing and audience data across email (Klaviyo), web (Google Analytics), and social (Instagram) channels.

Your analysis should be:
- Concise and actionable, written for an editorial/marketing team
- Focused on what matters: growth opportunities, content strategy, audience behavior
- Mindful of Prior's brand identity: sophisticated, understated luxury, editorial quality

Always respond with valid JSON matching this exact structure:
{
  "headline": "A single compelling sentence summarizing the key insight (max 15 words)",
  "highlights": ["Array of 2-4 positive findings, each 1-2 sentences"],
  "concerns": ["Array of 1-3 areas needing attention, each 1-2 sentences"],
  "recommendations": ["Array of 2-4 specific, actionable recommendations, each 1-2 sentences"]
}

Respond ONLY with the JSON object. No markdown, no explanation, no code fences.`;

export function buildDigestPrompt(metrics) {
  return {
    system: SYSTEM_PROMPT,
    user: `Analyze Prior's performance for the period ${metrics.period.start} to ${metrics.period.end}.

EMAIL (Klaviyo):
${JSON.stringify(metrics.klaviyo, null, 2)}

WEB (Google Analytics):
${JSON.stringify(metrics.googleAnalytics, null, 2)}

SOCIAL (Instagram):
${JSON.stringify(metrics.instagram, null, 2)}

Provide a weekly digest analysis. Focus on cross-channel trends, content performance patterns, and growth opportunities.`,
  };
}

export function buildOnDemandPrompt(metrics, userQuestion = null) {
  const base = buildDigestPrompt(metrics);
  if (userQuestion) {
    base.user += `\n\nThe editor specifically wants to understand: ${userQuestion}`;
  }
  base.user += '\n\nProvide a thorough analysis with specific, data-backed recommendations.';
  return base;
}

export function buildAnomalyPrompt(anomalies, metrics) {
  return {
    system: SYSTEM_PROMPT,
    user: `The following anomalies have been automatically detected in Prior's analytics data:

${anomalies.map(a => `- ${a.source}/${a.metric}: current ${a.current_value?.toFixed(2)} vs baseline ${a.baseline_value?.toFixed(2)} (${a.deviation_pct > 0 ? '+' : ''}${a.deviation_pct.toFixed(1)}% deviation, severity: ${a.severity})`).join('\n')}

Context data:
${JSON.stringify(metrics, null, 2)}

Analyze these anomalies. For each, explain the likely cause and recommend an action. Focus on which anomalies actually matter and which are noise.`,
  };
}
