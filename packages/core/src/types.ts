export type Scalar = string | number | boolean | null;
export type DataRow = Readonly<Record<string, Scalar>>;
export type Cell = { readonly kind: 'missing' } | { readonly kind: 'value'; readonly value: Scalar };
export type InputFormat = 'csv' | 'json';
export interface Limits {
  maxBytes: number; maxRows: number; maxColumns: number; maxCells: number;
  maxValueBytes: number; maxHeaderBytes: number; maxKeyBytes: number;
  maxConfigBytes: number; maxReportBytes: number;
}
export interface ParseOptions { format: InputFormat; delimiter?: ',' | ';'; limits?: Partial<Limits> }
export interface Control { isCancelled?: () => boolean }
export interface Dataset { readonly format: InputFormat; readonly columns: readonly string[]; readonly rows: readonly DataRow[] }
export interface CompareConfig { keyColumns: string[]; ignoreColumns?: string[]; trimStrings?: boolean; ignoreCase?: boolean; limits?: Partial<Limits> }
export interface ResolvedConfig { keyColumns: string[]; ignoreColumns: string[]; trimStrings: boolean; ignoreCase: boolean }
export type RowStatus = 'added' | 'removed' | 'changed' | 'unchanged';
export interface FieldChange { column: string; before: Cell; after: Cell }
export interface DiffRow {
  key: Scalar[]; keyId: string; status: RowStatus;
  before: DataRow | null; after: DataRow | null; changes: FieldChange[];
}
export interface Summary { before: number; after: number; added: number; removed: number; changed: number; unchanged: number; changedCells: number }
export interface DiffReport {
  schemaVersion: '1'; status: 'complete'; config: ResolvedConfig;
  columns: { before: string[]; after: string[]; added: string[]; removed: string[]; compared: string[] };
  summary: Summary; hasChanges: boolean; rows: DiffRow[];
}
export type ErrorCode = 'CSV_PARSE_ERROR' | 'JSON_PARSE_ERROR' | 'DUPLICATE_HEADER' | 'DUPLICATE_PROPERTY' | 'DUPLICATE_KEY' | 'KEY_MISSING' | 'UNSUPPORTED_VALUE' | 'UNSAFE_NUMBER' | 'LIMIT_EXCEEDED' | 'INVALID_CONFIG' | 'INVALID_DATASET' | 'INVALID_REPORT' | 'CANCELLED';
export interface ErrorDetails { [key: string]: string | number | boolean | readonly number[] | undefined }
export class RowtraceError extends Error {
  readonly code: ErrorCode;
  readonly details: ErrorDetails;
  constructor(code: ErrorCode, message: string, details: ErrorDetails = {}) {
    super(message); this.name = 'RowtraceError'; this.code = code; this.details = details;
  }
}
