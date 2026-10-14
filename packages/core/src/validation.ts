import { RowtraceError, type Control, type Limits, type Scalar } from './types.js';

export const DEFAULT_LIMITS: Readonly<Limits> = Object.freeze({ maxBytes: 16 * 1024 * 1024, maxRows: 20_000, maxColumns: 100, maxCells: 1_000_000, maxValueBytes: 64 * 1024, maxHeaderBytes: 1024, maxKeyBytes: 4096, maxConfigBytes: 16 * 1024, maxReportBytes: 32 * 1024 * 1024 });
export function fail(code: ConstructorParameters<typeof RowtraceError>[0], message: string, details: ConstructorParameters<typeof RowtraceError>[2] = {}): never { throw new RowtraceError(code, message, details); }
export function plain(value: unknown, code: 'INVALID_CONFIG' | 'INVALID_DATASET' = 'INVALID_CONFIG'): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail(code, 'Expected a plain object.');
  if (Reflect.ownKeys(value).some(k => typeof k !== 'string' || !Object.getOwnPropertyDescriptor(value, k)?.enumerable || !('value' in (Object.getOwnPropertyDescriptor(value, k) ?? {})))) fail(code, 'Only enumerable data properties are supported.');
}
export function keys(value: Record<string, unknown>, allowed: readonly string[]): void { for (const key of Object.keys(value)) if (!allowed.includes(key)) fail('INVALID_CONFIG', 'Unknown option.', { option: key }); }
export function limitsFor(value?: unknown): Limits {
  const result = { ...DEFAULT_LIMITS };
  if (value === undefined) return result;
  plain(value); keys(value, Object.keys(DEFAULT_LIMITS));
  for (const name of Object.keys(value) as (keyof Limits)[]) {
    const n = value[name];
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 1 || n > DEFAULT_LIMITS[name]) fail('INVALID_CONFIG', 'Limits must be positive integers no greater than the supported maximum.', { limit: name, maximum: DEFAULT_LIMITS[name] });
    result[name] = n;
  }
  return result;
}
export function check(value: number, max: number, limit: string): void { if (value > max) fail('LIMIT_EXCEEDED', 'Supported limit exceeded.', { limit, maximum: max, actual: value }); }
/** UTF-8 byte size without allocating a second full input buffer. Lone surrogates count as replacement bytes. */
export function utf8Length(text: string): number {
  let size = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 128) size++; else if (c < 2048) size += 2;
    else if (c >= 0xd800 && c <= 0xdbff && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) { size += 4; i++; } else size += 3;
  }
  return size;
}
export function byteCheck(text: string, max: number, name: string): void { check(text.length, max, name); check(utf8Length(text), max, name); }
export function header(value: unknown, limits: Limits): asserts value is string {
  if (typeof value !== 'string' || value.length === 0) fail('INVALID_DATASET', 'Column names must be nonempty strings.');
  byteCheck(value, limits.maxHeaderBytes, 'maxHeaderBytes');
}
export function scalar(value: unknown, limits: Limits): asserts value is Scalar {
  if (typeof value === 'string') { byteCheck(value, limits.maxValueBytes, 'maxValueBytes'); return; }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) fail('UNSAFE_NUMBER', 'Unsafe JSON number. Encode large identifiers and exact decimals as strings.');
    return;
  }
  if (value !== null && typeof value !== 'boolean') fail('UNSUPPORTED_VALUE', 'Only string, finite safe-number, boolean and null cells are supported.');
}
export function cancellation(control?: Control): () => void {
  let callback: (() => boolean) | undefined;
  if (control !== undefined) { plain(control); keys(control as Record<string, unknown>, ['isCancelled']); const value = control.isCancelled; if (value !== undefined && typeof value !== 'function') fail('INVALID_CONFIG', 'isCancelled must be a function.'); if (typeof value === 'function') callback = () => value() === true; }
  return () => { if (callback?.()) fail('CANCELLED', 'Operation cancelled.'); };
}
export const order = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
