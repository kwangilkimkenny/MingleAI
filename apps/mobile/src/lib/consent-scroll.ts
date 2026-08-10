export type ConsentScrollMetrics = {
  layoutHeight: number;
  contentHeight: number;
  offsetY: number;
};

export function hasReachedConsentEnd(
  metrics: ConsentScrollMetrics,
  threshold = 16,
): boolean {
  if (metrics.layoutHeight <= 0 || metrics.contentHeight <= 0) return false;
  return metrics.layoutHeight + Math.max(0, metrics.offsetY) >= metrics.contentHeight - threshold;
}
