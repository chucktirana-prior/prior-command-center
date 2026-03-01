import { getDb, insertAnomaly } from '../../db/index.js';

const METRIC_CONFIG = {
  klaviyo: [
    { metric: 'open_rate', query: 'SELECT AVG(open_rate) as val FROM klaviyo_campaigns WHERE send_time BETWEEN ? AND ?', warningPct: 20, criticalPct: 35 },
    { metric: 'click_rate', query: 'SELECT AVG(click_rate) as val FROM klaviyo_campaigns WHERE send_time BETWEEN ? AND ?', warningPct: 25, criticalPct: 40 },
  ],
  google_analytics: [
    { metric: 'daily_page_views', query: 'SELECT AVG(daily_total) as val FROM (SELECT date, SUM(page_views) as daily_total FROM ga_pages WHERE date BETWEEN ? AND ? GROUP BY date)', warningPct: 30, criticalPct: 50 },
    { metric: 'avg_engagement_rate', query: 'SELECT AVG(engagement_rate) as val FROM ga_pages WHERE date BETWEEN ? AND ?', warningPct: 20, criticalPct: 35 },
  ],
  instagram: [
    { metric: 'avg_reach', query: 'SELECT AVG(reach) as val FROM instagram_posts WHERE posted_at BETWEEN ? AND ?', warningPct: 30, criticalPct: 50 },
    { metric: 'avg_engagement', query: 'SELECT AVG(likes + comments + saves + shares) as val FROM instagram_posts WHERE posted_at BETWEEN ? AND ?', warningPct: 25, criticalPct: 40 },
  ],
};

function dateString(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().split('T')[0];
}

export function runAnomalyDetection() {
  const db = getDb();
  const now = new Date().toISOString();
  const recentStart = dateString(7);
  const recentEnd = dateString(0);
  const baselineStart = dateString(35);
  const baselineEnd = dateString(7);
  const anomalies = [];

  for (const [source, metrics] of Object.entries(METRIC_CONFIG)) {
    for (const mc of metrics) {
      try {
        const recent = db.prepare(mc.query).get(recentStart, recentEnd);
        const baseline = db.prepare(mc.query).get(baselineStart, baselineEnd);

        if (recent?.val == null || baseline?.val == null || baseline.val === 0) continue;

        const deviationPct = ((recent.val - baseline.val) / Math.abs(baseline.val)) * 100;
        const absDeviation = Math.abs(deviationPct);

        if (absDeviation >= mc.warningPct) {
          const severity = absDeviation >= mc.criticalPct ? 'critical' : 'warning';
          const direction = deviationPct > 0 ? 'increased' : 'decreased';
          const message = `${mc.metric.replace(/_/g, ' ')} has ${direction} by ${absDeviation.toFixed(1)}% compared to the prior 4-week baseline`;

          const anomaly = {
            detected_at: now,
            source,
            metric: mc.metric,
            current_value: recent.val,
            baseline_value: baseline.val,
            deviation_pct: deviationPct,
            severity,
            message,
          };

          insertAnomaly(anomaly);
          anomalies.push(anomaly);
        }
      } catch (err) {
        console.error(`Anomaly detection error for ${source}/${mc.metric}:`, err.message);
      }
    }
  }

  // Custom: follower growth rate
  try {
    const recentProfile = db.prepare(
      'SELECT MIN(followers) as start_f, MAX(followers) as end_f FROM instagram_profile WHERE date BETWEEN ? AND ?'
    ).get(recentStart, recentEnd);
    const baselineProfile = db.prepare(
      'SELECT MIN(followers) as start_f, MAX(followers) as end_f FROM instagram_profile WHERE date BETWEEN ? AND ?'
    ).get(baselineStart, baselineEnd);

    if (recentProfile?.start_f && baselineProfile?.start_f) {
      const recentGrowth = (recentProfile.end_f - recentProfile.start_f) / 7;
      const baselineGrowth = (baselineProfile.end_f - baselineProfile.start_f) / 28;
      if (baselineGrowth > 0) {
        const deviationPct = ((recentGrowth - baselineGrowth) / baselineGrowth) * 100;
        if (Math.abs(deviationPct) >= 50) {
          const severity = Math.abs(deviationPct) >= 80 ? 'critical' : 'warning';
          const anomaly = {
            detected_at: now, source: 'instagram', metric: 'follower_growth_rate',
            current_value: recentGrowth, baseline_value: baselineGrowth,
            deviation_pct: deviationPct, severity,
            message: `Daily follower growth has ${deviationPct > 0 ? 'accelerated' : 'slowed'} by ${Math.abs(deviationPct).toFixed(1)}% vs the 4-week baseline`,
          };
          insertAnomaly(anomaly);
          anomalies.push(anomaly);
        }
      }
    }
  } catch (err) {
    console.error('Follower growth anomaly detection error:', err.message);
  }

  return anomalies;
}
