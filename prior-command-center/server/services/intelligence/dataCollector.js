import {
  buildAnalyticsComparison,
  buildAnalyticsSnapshot,
  buildComparativeMetrics,
} from '../analytics/model.js';

export function collectMetrics(startDate, endDate) {
  return buildAnalyticsSnapshot(startDate, endDate);
}

export function collectMetricsWithComparison(startDate, endDate) {
  return buildAnalyticsComparison(startDate, endDate);
}

export function collectComparativeMetrics(currentDays = 7, baselineDays = 28) {
  return buildComparativeMetrics(currentDays, baselineDays);
}
