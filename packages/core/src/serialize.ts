import type { DiffReport } from './types.js';
import { issuedReports, reportBudgets } from './compare.js';
import { check, DEFAULT_LIMITS, fail, keys, order, plain, utf8Length } from './validation.js';

export function assertReport(report: DiffReport): void { if (!report || !issuedReports.has(report)) fail('INVALID_REPORT', 'Expected an immutable report returned by compareDatasets in this runtime.'); }
export function reportLimit(report: DiffReport, requested?: number): number {
  const maximum = reportBudgets.get(report) ?? DEFAULT_LIMITS.maxReportBytes;
  if (requested !== undefined && (!Number.isSafeInteger(requested) || requested < 1 || requested > maximum)) fail('INVALID_CONFIG', 'Export limit must be a positive integer within the comparison report budget.');
  return requested ?? maximum;
}
/** Canonical keys, stable row order, no timestamps or localized strings. */
export function serializeReport(report: DiffReport, options: { maxBytes?: number } = {}): string {
  assertReport(report); plain(options); keys(options, ['maxBytes']); const max = reportLimit(report, options.maxBytes);
  const parts: string[] = []; let size = 0;
  function append(text: string) { size += utf8Length(text); check(size, max, 'maxReportBytes'); parts.push(text); }
  function canonical(value: unknown): string {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value !== null && typeof value === 'object') return '{' + Object.keys(value).sort(order).map(name => JSON.stringify(name) + ':' + canonical((value as Record<string, unknown>)[name])).join(',') + '}';
    return JSON.stringify(value);
  }
  // A measured 20k-row export retained millions of tiny punctuation fragments.
  // Keep bounded row-sized chunks instead; canonical key order is unchanged.
  append('{');
  Object.keys(report).sort(order).forEach((name, i) => {
    if (i) append(','); append(JSON.stringify(name)); append(':');
    if (name === 'rows') { append('['); report.rows.forEach((row, index) => { if (index) append(','); append(canonical(row)); }); append(']'); }
    else append(canonical(report[name as keyof DiffReport]));
  });
  append('}\n'); return parts.join('');
}
