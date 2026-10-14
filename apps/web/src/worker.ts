/// <reference lib="webworker" />
import { parseDataset, compareDatasets, serializeReport, RowtraceError } from '@seoshiro/rowtrace-core';
import { renderHtmlReport } from '@seoshiro/rowtrace-core/html';
import type { Dataset, DiffReport, DataRow } from '@seoshiro/rowtrace-core';
import { isRequest, type Request, type Response, type Page, type Preview } from './protocol';
const ctx = self as unknown as DedicatedWorkerGlobalScope;
let before: Dataset | undefined;
let after: Dataset | undefined;
let report: DiffReport | undefined;
let job = -1;
const MAX_BYTES = 16 * 1024 * 1024;
function boundedRow(row: DataRow): DataRow { return Object.fromEntries(Object.entries(row).map(([k,v]) => [k, typeof v === 'string' && v.length > 400 ? v.slice(0,400) + '…' : v])); }
function preview(data: Dataset): Preview { return { columns: [...data.columns], count: data.rows.length, rows: data.rows.slice(0,3).map(boundedRow) }; }
async function read(file: File, delimiter: ',' | ';'): Promise<Dataset> {
  if (file.size > MAX_BYTES) throw new RowtraceError('LIMIT_EXCEEDED','Maximum file size: 16 MiB.');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext !== 'csv' && ext !== 'json') throw new RowtraceError('INVALID_CONFIG','Use a UTF-8 .csv or .json file.');
  const bytes = await file.arrayBuffer();
  let text: string;
  try { text = new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
  catch { throw new RowtraceError('UNSUPPORTED_VALUE','The file is not valid UTF-8.'); }
  return parseDataset(text,ext === 'csv' ? {format:ext,delimiter} : {format:ext});
}
function getPage(status = 'all', search = '', descending = false, index = 0): Page {
  if (!report) throw new RowtraceError('INVALID_CONFIG','Compare snapshots first.');
  const needle = search.toLowerCase();
  const entries: number[] = [];
  for (let i = 0; i < report.rows.length; i++) {
    const row = report.rows[i];
    if (row && (status === 'all' || row.status === status) && (!needle || row.key.map(String).join(' / ').toLowerCase().includes(needle))) entries.push(i);
  }
  if (descending) entries.reverse();
  const actualPage = Math.min(index,Math.max(0,Math.ceil(entries.length / 50)-1));
  return {total:entries.length,page:actualPage,rows:entries.slice(actualPage*50,actualPage*50+50).map(id => {
    const row = report!.rows[id]!;
    return { id, key:row.key.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' / ').slice(0,500),status:row.status,fields:row.changes.slice(0,3).map(c => c.column.length>80?c.column.slice(0,80)+'…':c.column),fieldCount:row.changes.length };
  })};
}
type ResponseBody = Response extends infer R ? R extends Response ? Omit<R,'job'|'request'> : never : never;
function send(request: Request, payload: ResponseBody) { ctx.postMessage({...payload,job:request.job,request:request.request}); }
// The worker owns datasets and the complete report. Only bounded projections cross to React.
ctx.onmessage = async (event: MessageEvent<unknown>) => {
  if (!isRequest(event.data)) {
    const value: unknown = event.data;
    if (typeof value === 'object' && value !== null && 'job' in value && 'request' in value && Number.isSafeInteger(value.job) && Number(value.job) >= 0 && Number.isSafeInteger(value.request) && Number(value.request) >= 0) {
      ctx.postMessage({job:value.job,request:value.request,type:'error',code:'INVALID_CONFIG',message:'Invalid worker request.',details:''});
    }
    return;
  }
  const request = event.data;
  try {
    if (request.type === 'load' || request.type === 'demo') {
      job = request.job; report = undefined; before = undefined; after = undefined;
      if (request.type === 'demo') {
        const urls = [request.duplicate ? 'duplicate-before.csv' : 'before.csv','after.csv'];
        const files: File[] = [];
        for (const name of urls) {
          const response = await fetch(`${import.meta.env.BASE_URL}demo/${name}`);
          if (!response.ok) throw new Error('DEMO_LOAD_FAILED');
          files.push(new File([await response.blob()],name));
        }
        before = await read(files[0]!,','); after = await read(files[1]!,',');
      } else { before = await read(request.before,request.delimiter); after = await read(request.after,request.delimiter); }
      send(request,{type:'preview',before:preview(before),after:preview(after),demo:request.type === 'demo'});
      if (request.type === 'load') return;
    } else if (request.job !== job) return;
    if (request.type === 'compare' || request.type === 'demo') {
      if (!before || !after) throw new RowtraceError('INVALID_CONFIG','Preview files first.');
      report = undefined;
      const start = performance.now();
      report = compareDatasets(before,after,{keyColumns:request.type === 'demo' ? ['sku'] : request.keys,ignoreColumns:request.type === 'demo' ? [] : request.ignored});
      send(request,{type:'complete',summary:report.summary,columns:report.columns,page:getPage(),elapsed:performance.now()-start});
    } else if (request.type === 'page') send(request,{type:'page',page:getPage(request.status,request.search,request.descending,request.page)});
    else if (request.type === 'detail') {
      const row = report?.rows[request.id];
      if (row) send(request,{type:'detail',row});
    } else if (request.type === 'export') {
      if (!report) throw new RowtraceError('INVALID_CONFIG','No complete report to export.');
      // Static worker import supports WebKit's module-worker implementation and avoids copying the report to the UI.
      const text = request.format === 'json' ? serializeReport(report) : renderHtmlReport(report);
      send(request,{type:'export',format:request.format,blob:new Blob([text],{type:request.format === 'json' ? 'application/json' : 'text/html'})});
    }
  } catch(error) {
    const known = error instanceof RowtraceError;
    send(request,{type:'error',code:known ? error.code : 'PROCESSING_ERROR',message:known ? error.message : 'Unable to process this operation.',details:known ? JSON.stringify(error.details) : ''});
  }
};
