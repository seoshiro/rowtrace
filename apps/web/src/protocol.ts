import type { DataRow, DiffRow, DiffReport, Summary } from '@seoshiro/rowtrace-core';
export type Status = 'all' | 'added' | 'removed' | 'changed' | 'unchanged';
export interface Preview { columns: string[]; count: number; rows: DataRow[] }
export interface ListRow { id: number; key: string; status: Exclude<Status,'all'>; fields: string[]; fieldCount: number }
export interface Page { rows: ListRow[]; total: number; page: number }
export type Request = { job: number; request: number } & (
  { type: 'load'; before: File; after: File; delimiter: ',' | ';' } |
  { type: 'demo'; duplicate: boolean } |
  { type: 'compare'; keys: string[]; ignored: string[] } |
  { type: 'page'; status: Status; search: string; descending: boolean; page: number } |
  { type: 'detail'; id: number } |
  { type: 'export'; format: 'json' | 'html' });
export type Response = { job: number; request: number } & (
  { type: 'preview'; before: Preview; after: Preview; demo: boolean } |
  { type: 'complete'; summary: Summary; columns: DiffReport['columns']; page: Page; elapsed: number } |
  { type: 'page'; page: Page } |
  { type: 'detail'; row: DiffRow } |
  { type: 'export'; blob: Blob; format: 'json' | 'html' } |
  { type: 'error'; code: string; message: string; details: string });
const object = (v: unknown): v is Record<string,unknown> => typeof v === 'object' && v !== null;
const integer = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const strings = (v: unknown, max = 100): v is string[] => Array.isArray(v) && v.length <= max && v.every(x => typeof x === 'string' && x.length <= 1024);
const scalar = (v: unknown) => v === null || typeof v === 'string' || typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v));
const dataRow = (v: unknown) => object(v) && Object.keys(v).length <= 100 && Object.entries(v).every(([k,val]) => k.length <= 1024 && scalar(val) && (typeof val !== 'string' || val.length <= 65536));
const cell = (v: unknown) => object(v) && (v.kind === 'missing' || (v.kind === 'value' && scalar(v.value) && (typeof v.value !== 'string' || v.value.length <= 65536)));
const statuses: unknown[] = ['added','removed','changed','unchanged'];
const page = (v: unknown) => object(v) && integer(v.total) && integer(v.page) && Array.isArray(v.rows) && v.rows.length <= 50 && v.rows.every(r => object(r) && integer(r.id) && typeof r.key === 'string' && r.key.length <= 500 && statuses.includes(r.status) && strings(r.fields,3) && integer(r.fieldCount) && r.fieldCount <= 200);
const preview = (v: unknown) => object(v) && strings(v.columns) && integer(v.count) && Array.isArray(v.rows) && v.rows.length <= 3 && v.rows.every(dataRow);
export function isRequest(v: unknown): v is Request {
  if (!object(v) || !integer(v.job) || !integer(v.request)) return false;
  switch(v.type) {
    case 'load': return v.before instanceof File && v.after instanceof File && [',',';'].includes(String(v.delimiter));
    case 'demo': return typeof v.duplicate === 'boolean';
    case 'compare': return strings(v.keys) && v.keys.length > 0 && strings(v.ignored);
    case 'page': return ['all',...statuses].includes(v.status) && typeof v.search === 'string' && v.search.length <= 1024 && typeof v.descending === 'boolean' && integer(v.page);
    case 'detail': return integer(v.id);
    case 'export': return v.format === 'json' || v.format === 'html';
    default: return false;
  }
}
export function isResponse(v: unknown): v is Response {
  if (!object(v) || !integer(v.job) || !integer(v.request)) return false;
  switch(v.type) {
    case 'preview': return preview(v.before) && preview(v.after) && typeof v.demo === 'boolean';
    case 'complete': return object(v.summary) && ['before','after','added','removed','changed','unchanged','changedCells'].every(k => integer(v.summary && (v.summary as Record<string,unknown>)[k])) && object(v.columns) && ['before','after','added','removed','compared'].every(k => strings(v.columns && (v.columns as Record<string,unknown>)[k],k==='compared'?200:100)) && page(v.page) && typeof v.elapsed === 'number' && Number.isFinite(v.elapsed) && v.elapsed >= 0;
    case 'page': return page(v.page);
    case 'detail': return object(v.row) && typeof v.row.keyId === 'string' && v.row.keyId.length <= 16384 && Array.isArray(v.row.key) && v.row.key.length <= 100 && v.row.key.every(scalar) && statuses.includes(v.row.status) && (v.row.before === null || dataRow(v.row.before)) && (v.row.after === null || dataRow(v.row.after)) && Array.isArray(v.row.changes) && v.row.changes.length <= 200 && v.row.changes.every(c => object(c) && typeof c.column === 'string' && c.column.length <= 1024 && cell(c.before) && cell(c.after));
    case 'export': return v.blob instanceof Blob && v.blob.size <= 32*1024*1024 && (v.format === 'json' || v.format === 'html');
    case 'error': return typeof v.code === 'string' && typeof v.message === 'string' && typeof v.details === 'string';
    default: return false;
  }
}
