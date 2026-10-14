import Papa from 'papaparse';
import { visit } from 'jsonc-parser';
import { type Dataset, type DataRow, type ParseOptions, type Control, type Limits, type Scalar } from './types.js';
import { byteCheck, cancellation, check, fail, header, keys, limitsFor, order, plain, scalar, utf8Length } from './validation.js';

const trusted = new WeakSet<object>();
const sourceSizes = new WeakMap<object, number>();
/** Papa intentionally accepts quotes inside bare fields; our documented dialect does not. */
function strictQuotes(record: string, delimiter: string): void {
  let state: 'start' | 'plain' | 'quoted' | 'closed' = 'start';
  for (let i = 0; i < record.length; i++) {
    const c = record[i];
    if (state === 'quoted') { if (c === '"') { if (record[i + 1] === '"') i++; else state = 'closed'; } continue; }
    if (c === delimiter || c === '\r' || c === '\n') { state = 'start'; continue; }
    if (c === '"' && state === 'start') { state = 'quoted'; continue; }
    if (c === '"' || state === 'closed') fail('CSV_PARSE_ERROR', 'Quotes must enclose the entire CSV field.');
    state = 'plain';
  }
}
function finish(format: 'csv' | 'json', columns: string[], rows: DataRow[], bytes: number): Dataset {
  const data = Object.freeze({ format, columns: Object.freeze(columns.sort(order)), rows: Object.freeze(rows) }); trusted.add(data); sourceSizes.set(data, bytes); return data;
}
function boundedRow(row: Record<string, Scalar>, rows: DataRow[], columns: Set<string>, limits: Limits): void {
  check(rows.length + 1, limits.maxRows, 'maxRows');
  for (const col of Object.keys(row)) columns.add(col);
  check(columns.size, limits.maxColumns, 'maxColumns');
  check((rows.length + 1) * columns.size, limits.maxCells, 'maxCells');
  rows.push(Object.freeze(row));
}
export function parseDataset(text: string, options: ParseOptions, control?: Control): Dataset {
  plain(options); keys(options as unknown as Record<string, unknown>, ['format', 'delimiter', 'limits']);
  if (options.format !== 'csv' && options.format !== 'json') fail('INVALID_CONFIG', 'format must be csv or json.');
  if (options.delimiter !== undefined && options.delimiter !== ',' && options.delimiter !== ';') fail('INVALID_CONFIG', 'CSV delimiter must be comma or semicolon.');
  if (options.format === 'json' && options.delimiter !== undefined) fail('INVALID_CONFIG', 'delimiter applies only to CSV.');
  if (typeof text !== 'string') fail('INVALID_DATASET', 'Input must be a decoded UTF-8 string.');
  const limits = limitsFor(options.limits), cancel = cancellation(control); cancel(); byteCheck(text, limits.maxBytes, 'maxBytes');
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  const rows: DataRow[] = [], columns = new Set<string>();
  if (options.format === 'csv') {
    if (source.length === 0) fail('CSV_PARSE_ERROR', 'CSV requires a header record.');
    let headers: string[] | undefined, previous = 0;
    Papa.parse<string[]>(source, { delimiter: options.delimiter ?? ',', header: false, dynamicTyping: false, skipEmptyLines: false, fastMode: false,
      step(result) {
        cancel();
        if (result.errors.length) fail('CSV_PARSE_ERROR', 'Invalid CSV quoting or field syntax.', { row: rows.length + 1, parserCode: result.errors[0]?.code });
        const rawRecord = source.slice(previous, result.meta.cursor); previous = result.meta.cursor;
        strictQuotes(rawRecord, options.delimiter ?? ',');
        // Ignore truly blank physical records, never quoted empty cells or whitespace-only data.
        if (rawRecord === '' || rawRecord === '\n' || rawRecord === '\r' || rawRecord === '\r\n') return;
        if (!headers) {
          headers = result.data;
          check(headers.length, limits.maxColumns, 'maxColumns');
          for (const col of headers) { header(col, limits); if (columns.has(col)) fail('DUPLICATE_HEADER', 'Duplicate CSV header.', { column: col }); columns.add(col); }
          return;
        }
        if (result.data.length !== headers.length) fail('CSV_PARSE_ERROR', 'CSV record field count differs from its header.', { row: rows.length + 1, expected: headers.length, actual: result.data.length });
        const row: Record<string, Scalar> = Object.create(null);
        for (let i = 0; i < headers.length; i++) { const col = headers[i], value = result.data[i]; if (col === undefined || value === undefined) fail('CSV_PARSE_ERROR', 'Missing CSV field.'); scalar(value, limits); row[col] = value; }
        boundedRow(row, rows, columns, limits);
      }
    });
    if (!headers) fail('CSV_PARSE_ERROR', 'CSV requires a header record.');
  } else {
    let row: Record<string, Scalar> | undefined, property = '', arrayOpen = false, arrayClosed = false;
    visit(source, {
      onArrayBegin(_o, _l, _line, _c, path) { cancel(); if (path().length !== 0 || arrayOpen || arrayClosed) fail('UNSUPPORTED_VALUE', 'JSON must be one array of flat objects.'); arrayOpen = true; },
      onArrayEnd() { arrayOpen = false; arrayClosed = true; },
      onObjectBegin(_o, _l, _line, _c, path) { cancel(); if (!arrayOpen || path().length !== 1 || row) fail('UNSUPPORTED_VALUE', 'JSON rows must be flat objects.'); check(rows.length + 1, limits.maxRows, 'maxRows'); row = Object.create(null) as Record<string, Scalar>; },
      onObjectProperty(name) { if (!row) fail('UNSUPPORTED_VALUE', 'Expected a row object.'); header(name, limits); if (Object.hasOwn(row, name)) fail('DUPLICATE_PROPERTY', 'Duplicate JSON property.', { row: rows.length + 1, column: name }); property = name; row[name] = null; columns.add(name); check(columns.size, limits.maxColumns, 'maxColumns'); check((rows.length + 1) * columns.size, limits.maxCells, 'maxCells'); },
      onLiteralValue(value: unknown, _o, _l, _line, _c, path) { cancel(); if (!row || path().length !== 2) fail('UNSUPPORTED_VALUE', 'JSON rows must be flat objects with scalar cells.'); scalar(value, limits); row[property] = typeof value === 'number' && Object.is(value, -0) ? 0 : value; },
      onObjectEnd() { if (!row) fail('UNSUPPORTED_VALUE', 'Expected a row object.'); boundedRow(row, rows, columns, limits); row = undefined; },
      onError(error, offset, _length, line, column) { fail('JSON_PARSE_ERROR', 'Invalid JSON syntax.', { parserCode: error, offset, line: line + 1, column: column + 1 }); }
    }, { disallowComments: true, allowTrailingComma: false, allowEmptyContent: false });
    if (!arrayClosed) fail('JSON_PARSE_ERROR', 'JSON requires an array of flat objects.');
  }
  cancel(); return finish(options.format, [...columns], rows, utf8Length(text));
}

/** Validate hand-built datasets too; immutable results from parseDataset avoid repeated copying. */
export function validateDataset(input: Dataset, limits: Limits, cancel: () => void): Dataset {
  if (trusted.has(input)) {
    check(sourceSizes.get(input) ?? 0, limits.maxBytes, 'maxBytes');
    check(input.rows.length, limits.maxRows, 'maxRows'); check(input.columns.length, limits.maxColumns, 'maxColumns'); check(input.rows.length * input.columns.length, limits.maxCells, 'maxCells');
    // Custom lowered byte limits still apply when comparing previously parsed data.
    for (const col of input.columns) header(col, limits);
    for (const row of input.rows) { cancel(); for (const value of Object.values(row)) scalar(value, limits); }
    return input;
  }
  plain(input, 'INVALID_DATASET');
  if (!Array.isArray(input.columns) || !Array.isArray(input.rows) || (input.format !== 'csv' && input.format !== 'json') || Object.keys(input).some(k => !['format','columns','rows'].includes(k))) fail('INVALID_DATASET', 'Invalid Dataset shape.');
  const cols = new Set<string>();
  for (const col of input.columns) { header(col, limits); if (cols.has(col)) fail('DUPLICATE_HEADER', 'Duplicate dataset column.', { column: col }); cols.add(col); }
  check(cols.size, limits.maxColumns, 'maxColumns'); check(input.rows.length, limits.maxRows, 'maxRows'); check(input.rows.length * cols.size, limits.maxCells, 'maxCells');
  const rows: DataRow[] = []; let bytes = 0;
  for (const original of input.rows) { cancel(); plain(original, 'INVALID_DATASET'); const row: Record<string, Scalar> = Object.create(null); for (const col of Object.keys(original)) { if (!cols.has(col)) fail('INVALID_DATASET', 'Row contains undeclared column.', { column: col }); const value = original[col]; scalar(value, limits); row[col] = value === 0 ? 0 : value; } bytes += utf8Length(JSON.stringify(row)); check(bytes, limits.maxBytes, 'maxBytes'); rows.push(Object.freeze(row)); }
  return finish(input.format, [...cols], rows, bytes);
}
