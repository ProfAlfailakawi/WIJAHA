/** Capital coordinates (degrees) for the countries the occasions radar covers. Bundled; no map service. */
export const CAPITALS: Record<string, { lat: number; lon: number }> = {
  KW: { lat: 29.37, lon: 47.98 },
  SA: { lat: 24.71, lon: 46.68 },
  AE: { lat: 24.45, lon: 54.38 },
  QA: { lat: 25.29, lon: 51.53 },
  BH: { lat: 26.23, lon: 50.59 },
  OM: { lat: 23.59, lon: 58.41 },
  EG: { lat: 30.04, lon: 31.24 },
  JO: { lat: 31.95, lon: 35.93 },
  LB: { lat: 33.89, lon: 35.5 },
  MA: { lat: 34.02, lon: -6.84 },
  TN: { lat: 36.81, lon: 10.18 },
  DZ: { lat: 36.75, lon: 3.06 },
};

/** 0 (far away or none within the window) .. 1 (today). */
export function glowFor(daysUntil: number | undefined, windowDays = 120): number {
  if (daysUntil === undefined || daysUntil < 0) return 0;
  return Math.max(0, 1 - daysUntil / windowDays);
}
