import type { MetricDefinition, MetricQuery, MetricResult, ReportPeriod } from '@workspace/api-client-react';

export const TIMEZONE = 'America/New_York';
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export function validatePeriod(period: ReportPeriod): string | null {
  for (const value of [period.startDate, period.endDate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Choose both reporting dates.';
    const parsed = new Date(`${value}T12:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return 'Choose real calendar dates.';
  }
  return period.startDate > period.endDate ? 'Start date must not be after end date.' : null;
}

export function formatValue(value: number | null, unit: MetricDefinition['unit']): string {
  if (value === null) return 'Unavailable';
  if (!Number.isSafeInteger(value)) return 'Invalid numeric response';
  if (unit === 'count') return value.toLocaleString('en-US');
  const cents = BigInt(value);
  const absolute = cents < 0n ? -cents : cents;
  return `${cents < 0n ? '-' : ''}$${(absolute / 100n).toLocaleString('en-US')}.${String(absolute % 100n).padStart(2, '0')}`;
}

export function formatTimestamp(value: string | Date | null): string {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? `${date.toLocaleString('en-US', { timeZone: TIMEZONE })} Eastern`
    : String(value);
}

export function errorMessage(error: unknown): string {
  const e = error as { status?: number; message?: string; data?: { error?: string; message?: string; code?: string } } | null;
  if (e?.status === 401 || e?.status === 403) return 'Access denied. An authorized session is required; persona labels do not grant access.';
  if (e?.status === 404) return 'The reporting API is not mounted or this record is unavailable. No fixture data has been substituted.';
  const detail = e?.data?.message ?? e?.data?.error;
  return detail ? `${detail}${e?.data?.code ? ` (${e.data.code})` : ''}` : e?.message ?? 'The service is unavailable. No fixture data has been substituted.';
}

export function queryKey(query: MetricQuery) {
  return ['goodwill-reporting', 'metric', query] as const;
}

export function canPin(result: MetricResult): result is MetricResult & { publicationId: string } {
  return Boolean(result.publicationId) && result.value !== null;
}

export async function checksum(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename.replace(/[\/\\\r\n]/g, '_');
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Keep the capability alive long enough for the browser to start the download.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Multi-day daily-customer results intentionally have a null aggregate, but their
// server-provided daily points still support revision-pinned evidence and exports.
export function hasEvidence(result: MetricResult): boolean {
  return Boolean(result.publicationId) && (result.value !== null || result.points.some(point => point.value !== null));
}