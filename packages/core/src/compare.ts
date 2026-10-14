import { visit } from 'jsonc-parser';
import { type Cell, type CompareConfig, type Control, type DataRow, type Dataset, type DiffReport, type DiffRow, type ResolvedConfig, type Scalar } from './types.js';
import { validateDataset } from './parse.js';
import { byteCheck, cancellation, check, DEFAULT_LIMITS, fail, header, keys, limitsFor, order, plain, utf8Length } from './validation.js';

export const issuedReports = new WeakSet<object>();
export const reportBudgets = new WeakMap<object, number>();
function names(value: unknown, field: string, nonempty: boolean): string[] {
  if (!Array.isArray(value) || (nonempty && value.length === 0)) fail('INVALID_CONFIG', `${field} must be an array of column names.`);
  check(value.length, DEFAULT_LIMITS.maxColumns, 'maxColumns');
  const result: string[] = [];
  for (const name of value) { if (typeof name !== 'string' || name.length === 0) fail('INVALID_CONFIG', `${field} requires nonempty strings.`); header(name, DEFAULT_LIMITS); if (result.includes(name)) fail('INVALID_CONFIG', 'Repeated configuration column.', { option: field, column: name }); result.push(name); }
  return result;
}
export function validateConfig(input: CompareConfig): ResolvedConfig {
  plain(input); keys(input as unknown as Record<string, unknown>, ['keyColumns','ignoreColumns','trimStrings','ignoreCase','limits']);
  for (const field of ['trimStrings','ignoreCase'] as const) if (input[field] !== undefined && typeof input[field] !== 'boolean') fail('INVALID_CONFIG', `${field} must be boolean.`);
  const limits = limitsFor(input.limits);
  const result = { keyColumns: names(input.keyColumns, 'keyColumns', true), ignoreColumns: names(input.ignoreColumns ?? [], 'ignoreColumns', false).sort(order), trimStrings: input.trimStrings ?? false, ignoreCase: input.ignoreCase ?? false };
  for (const col of result.keyColumns) if (result.ignoreColumns.includes(col)) fail('INVALID_CONFIG', 'A key column cannot be ignored.', { column: col });
  byteCheck(JSON.stringify(input), limits.maxConfigBytes, 'maxConfigBytes');
  return result;
}
export function parseConfig(text: string): CompareConfig {
  if (typeof text !== 'string') fail('INVALID_CONFIG', 'Configuration must be JSON text.');
  byteCheck(text, DEFAULT_LIMITS.maxConfigBytes, 'maxConfigBytes');
  const stack: Set<string>[] = [];
  visit(text, {
    onObjectBegin() { if (stack.length >= 4) fail('INVALID_CONFIG', 'Configuration is too deeply nested.'); stack.push(new Set()); },
    onObjectProperty(name) { const seen = stack.at(-1); if (!seen || seen.has(name)) fail('INVALID_CONFIG', 'Duplicate configuration property.', { column: name }); seen.add(name); },
    onObjectEnd() { stack.pop(); },
    onArrayBegin(_a, _b, _c, _d, path) { if (path().length > 2) fail('INVALID_CONFIG', 'Configuration is too deeply nested.'); },
    onError(_e, offset) { fail('INVALID_CONFIG', 'Invalid JSON configuration.', { offset }); }
  }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
  const value: unknown = JSON.parse(text); validateConfig(value as CompareConfig); return value as CompareConfig;
}
function normalized(value: Scalar, config: ResolvedConfig): Scalar {
  if (typeof value !== 'string') return value;
  let result = config.trimStrings ? value.trim() : value;
  if (config.ignoreCase) result = result.toLowerCase();
  return result;
}
export function cellAt(row: DataRow | null, column: string): Cell { return row !== null && Object.hasOwn(row, column) ? { kind: 'value', value: row[column] as Scalar } : { kind: 'missing' }; }
function equal(a: Cell, b: Cell, config: ResolvedConfig): boolean { return a.kind === 'missing' ? b.kind === 'missing' : b.kind === 'value' && normalized(a.value, config) === normalized(b.value, config); }
function keyFor(row: DataRow, config: ResolvedConfig, maxBytes: number, side: string, rowNumber: number): { key: Scalar[]; keyId: string } {
  const key: Scalar[] = [];
  for (const col of config.keyColumns) {
    const value = cellAt(row, col);
    const component = value.kind === 'value' ? normalized(value.value, config) : null;
    if (component === null || component === '') fail('KEY_MISSING', 'Key component is missing, null or empty.', { side, row: rowNumber, column: col });
    key.push(component);
  }
  const keyId = JSON.stringify(key.map(v => [typeof v, v])); byteCheck(keyId, maxBytes, 'maxKeyBytes');
  return { key, keyId };
}
export function compareDatasets(beforeInput: Dataset, afterInput: Dataset, input: CompareConfig, control?: Control): DiffReport {
  const config = validateConfig(input), limits = limitsFor(input.limits), cancel = cancellation(control); cancel();
  const before = validateDataset(beforeInput, limits, cancel), after = validateDataset(afterInput, limits, cancel);
  const all = [...new Set([...before.columns,...after.columns])].sort(order);
  for (const col of config.keyColumns) for (const [side, dataset] of [['before',before],['after',after]] as const) if (!dataset.columns.includes(col) && (dataset.rows.length > 0 || dataset.columns.length > 0)) fail('KEY_MISSING', 'Key column is absent.', { side, column: col });
  for (const col of config.ignoreColumns) if (!all.includes(col)) fail('INVALID_CONFIG', 'Ignored column is absent from both datasets.', { column: col });
  const compared = all.filter(c => !config.ignoreColumns.includes(c));
  function index(data: Dataset, side: string) {
    const map = new Map<string, { row: DataRow; key: Scalar[]; rowNumber: number }>();
    for (let i = 0; i < data.rows.length; i++) { cancel(); const row = data.rows[i]; if (!row) fail('INVALID_DATASET', 'Sparse row arrays are unsupported.'); const { key, keyId } = keyFor(row, config, limits.maxKeyBytes, side, i + 1); const prior = map.get(keyId); if (prior) fail('DUPLICATE_KEY', 'Duplicate key blocks comparison.', { side, rows: [prior.rowNumber, i + 1] }); map.set(keyId, { row, key, rowNumber: i + 1 }); }
    return map;
  }
  const left = index(before, 'before'), right = index(after, 'after');
  const summary = { before: before.rows.length, after: after.rows.length, added: 0, removed: 0, changed: 0, unchanged: 0, changedCells: 0 };
  const columns = { before: [...before.columns], after: [...after.columns], added: after.columns.filter(c => !before.columns.includes(c)), removed: before.columns.filter(c => !after.columns.includes(c)), compared };
  const rows: DiffRow[] = []; let reportBytes = 0;
  for (const keyId of [...new Set([...left.keys(),...right.keys()])].sort(order)) {
    cancel(); const l = left.get(keyId), r = right.get(keyId); const changes = [];
    if (l && r) for (const col of compared) { const a = cellAt(l.row, col), b = cellAt(r.row, col); if (!equal(a, b, config)) changes.push({ column: col, before: Object.freeze(a), after: Object.freeze(b) }); }
    const status = !l ? 'added' : !r ? 'removed' : changes.length ? 'changed' : 'unchanged';
    summary[status]++; summary.changedCells += changes.length;
    const row: DiffRow = { key: (l ?? r)!.key, keyId, status, before: l?.row ?? null, after: r?.row ?? null, changes };
    // Bound accumulated report data while constructing it, not after all rows are retained.
    reportBytes += utf8Length(JSON.stringify(row)) + 1; check(reportBytes, limits.maxReportBytes, 'maxReportBytes');
    Object.freeze(row.key); changes.forEach(Object.freeze); Object.freeze(changes); rows.push(Object.freeze(row));
  }
  const hasChanges = summary.added + summary.removed + summary.changed > 0 || [...columns.added,...columns.removed].some(c => !config.ignoreColumns.includes(c));
  const report: DiffReport = { schemaVersion: '1', status: 'complete', config, columns, summary, hasChanges, rows };
  check(reportBytes + utf8Length(JSON.stringify({ ...report, rows: [] })) + (rows.length ? 0 : 1), limits.maxReportBytes, 'maxReportBytes');
  for (const list of Object.values(columns)) Object.freeze(list); Object.freeze(columns); Object.freeze(config.keyColumns); Object.freeze(config.ignoreColumns); Object.freeze(config); Object.freeze(summary); Object.freeze(rows); Object.freeze(report);
  issuedReports.add(report); reportBudgets.set(report, limits.maxReportBytes); cancel(); return report;
}
