import { useEffect, useRef, useState } from 'react';
import type { DataRow, DiffRow, DiffReport, Summary } from '@seoshiro/rowtrace-core';
import { isResponse, type Request, type Response, type Page, type Preview, type Status } from './protocol';
import { messages, type Language, type Messages } from './i18n';

type Result = { summary: Summary; columns: DiffReport['columns']; elapsed: number };
type Issue = {code:string;details:string};
const statusSymbols = {changed:'~',added:'+',removed:'−',unchanged:'='};
const statusList = ['changed','added','removed','unchanged'] as const;
type RequestBody = Request extends infer R ? R extends Request ? Omit<R,'job'|'request'> : never : never;
function initialLanguage(): Language { try { const value = localStorage.getItem('rowtrace.language'); if (value === 'ru' || value === 'kk') return value; } catch { /* Preference storage is optional. */ } return 'en'; }
function cell(row: DataRow | null, column: string, t: Messages) {
  if (!row || !Object.hasOwn(row,column)) return <span className="value-special">∅ {t.missing}</span>;
  const value = row[column];
  if (value === null) return <span className="value-special">null <small>{t.null}</small></span>;
  if (value === '') return <span className="value-special">“” <small>{t.empty}</small></span>;
  return <><span className="value-text">{String(value)}</span><small className="value-type">{typeof value === 'number' ? t.number : typeof value === 'boolean' ? t.boolean : t.string}</small></>;
}
export function App() {
  const [language,setLanguage] = useState<Language>(initialLanguage);
  const t = messages[language];
  const locale = useRef(t); locale.current = t;
  const [files,setFiles] = useState<[File|null,File|null]>([null,null]);
  const [delimiter,setDelimiter] = useState<','|';'>(',');
  const [previews,setPreviews] = useState<[Preview,Preview]|null>(null);
  const [keys,setKeys] = useState<string[]>([]);
  const [ignored,setIgnored] = useState<string[]>([]);
  const [demo,setDemo] = useState(false);
  const [busy,setBusy] = useState<'load'|'compare'|'export'|null>(null);
  const [phase,setPhase] = useState<'empty'|'ready'|'complete'|'cancelled'>('empty');
  const [issue,setIssue] = useState<Issue|null>(null);
  const [notice,setNotice] = useState('');
  const [result,setResult] = useState<Result|null>(null);
  const [page,setPage] = useState<Page>({rows:[],total:0,page:0});
  const [status,setStatus] = useState<Status>('all');
  const [search,setSearch] = useState('');
  const [descending,setDescending] = useState(false);
  const [selected,setSelected] = useState<DiffRow|null>(null);
  const worker = useRef<Worker|null>(null);
  const job = useRef(0);
  const serial = useRef(0);
  const latestPage = useRef(0);
  const latestDetail = useRef(0);
  const active = useRef<'load'|'compare'|'export'|null>(null);
  const urls = useRef(new Set<string>());
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const selectedButton = useRef<HTMLButtonElement|null>(null);
  useEffect(() => { document.documentElement.lang = language; try {localStorage.setItem('rowtrace.language',language);} catch { /* RAM-only analysis works without storage. */ } },[language]);
  useEffect(() => () => { worker.current?.terminate(); urls.current.forEach(url => URL.revokeObjectURL(url)); urls.current.clear(); },[]);

  function download(data: Extract<Response,{type:'export'}>) {
    let url: string | undefined;
    try {
      url = URL.createObjectURL(data.blob); urls.current.add(url);
      const link = document.createElement('a'); link.href = url; link.download = `rowtrace-report.${data.format}`;
      document.body.append(link);
      try { link.click(); } finally { link.remove(); }
      // Keep the URL alive until the browser has consumed the download, then release it.
      const downloadUrl = url;
      setTimeout(() => { URL.revokeObjectURL(downloadUrl); urls.current.delete(downloadUrl); },1000);
      setNotice(locale.current.download);
    } catch { if (url) {URL.revokeObjectURL(url);urls.current.delete(url);} setIssue({code:'EXPORT_ERROR',details:''}); }
    setBusy(null); active.current = null;
  }
  function createWorker() {
    try {
      const current = new Worker(new URL('./worker.ts',import.meta.url),{type:'module'});
      const generation = job.current;
      current.onmessage = (event: MessageEvent<unknown>) => {
        if (generation !== job.current) return;
        if (!isResponse(event.data)) { workerFailed(current); return; }
        const data = event.data;
        if (data.job !== job.current) return;
        if (data.type === 'preview') {
          setPreviews([data.before,data.after]); setDemo(data.demo); setPhase('ready');
          if (data.demo) { setKeys(['sku']); setIgnored([]); }
          else { setBusy(null); active.current = null; }
        } else if (data.type === 'complete') {
          setResult({summary:data.summary,columns:data.columns,elapsed:data.elapsed}); setPage(data.page); setPhase('complete'); setBusy(null); active.current = null;
        } else if (data.type === 'page' && data.request === latestPage.current) setPage(data.page);
        else if (data.type === 'detail' && data.request === latestDetail.current) { setSelected(data.row); requestAnimationFrame(() => detailHeading.current?.focus()); }
        else if (data.type === 'export') download(data);
        else if (data.type === 'error') { setIssue({code:data.code,details:data.details}); setBusy(null); active.current = null; }
      };
      current.onerror = event => { event.preventDefault(); if (generation === job.current) workerFailed(current); };
      current.onmessageerror = () => { if (generation === job.current) workerFailed(current); };
      worker.current = current;
      return current;
    } catch { workerFailed(); return null; }
  }
  function workerFailed(current?: Worker) {
    current?.terminate(); worker.current=null;job.current++;
    setPreviews(null);setResult(null);setSelected(null);setPhase('empty');setIssue({code:'WORKER_ERROR',details:''});setBusy(null);active.current=null;
  }
  function send(body: RequestBody) {
    const current = worker.current ?? createWorker();
    const request = ++serial.current;
    current?.postMessage({...body,job:job.current,request});
    return request;
  }
  function invalidate(keepPreview = false) {
    latestDetail.current = ++serial.current;
    setResult(null); setSelected(null); setPage({rows:[],total:0,page:0}); setIssue(null); setNotice('');
    setStatus('all');setSearch('');setDescending(false);
    if (!keepPreview) { worker.current?.terminate();worker.current=null;job.current++;setPreviews(null);setPhase('empty');setBusy(null);active.current=null; }
    else setPhase('ready');
  }
  function acceptFile(index:0|1,file:File|undefined) {
    if (!file) return;
    invalidate();setDemo(false);setKeys([]);setIgnored([]);
    setFiles(current => index === 0 ? [file,current[1]] : [current[0],file]);
    if (!/\.(csv|json)$/i.test(file.name) || file.size > 16*1024*1024) setIssue({code:'FILE_ERROR',details:''});
  }
  function loadDemo(duplicate=false) {
    invalidate();setFiles([null,null]);setDemo(true);setBusy('load');active.current='load';
    send({type:'demo',duplicate});
  }
  function loadFiles() {
    if (!files[0] || !files[1]) return;
    invalidate();setBusy('load');active.current='load';
    send({type:'load',before:files[0],after:files[1],delimiter});
  }
  function compare() {
    if (!keys.length || !previews) return;
    invalidate(true);setBusy('compare');active.current='compare';
    send({type:'compare',keys,ignored});
  }
  function cancel() { invalidate();setPhase('cancelled'); }
  function query(nextStatus: Status,nextSearch:string,nextDescending:boolean,nextPage:number) {
    latestDetail.current = ++serial.current;
    setStatus(nextStatus);setSearch(nextSearch);setDescending(nextDescending);setSelected(null);
    latestPage.current = send({type:'page',status:nextStatus,search:nextSearch,descending:nextDescending,page:nextPage});
  }
  function exportReport(format:'json'|'html') {setIssue(null);setNotice('');setBusy('export');active.current='export';send({type:'export',format});}
  const allColumns = previews ? [...new Set([...previews[0].columns,...previews[1].columns])] : [];
  const errorText = issue ? issue.code === 'FILE_ERROR' ? t.fileError : issue.code === 'WORKER_ERROR' ? t.workerError : issue.code === 'EXPORT_ERROR' ? t.exportError : t[issue.code as keyof Messages] ?? t.PROCESSING_ERROR : '';
  const selectedColumns = selected ? [...new Set([...Object.keys(selected.before ?? {}),...Object.keys(selected.after ?? {})])].sort() : [];
  const pending = busy !== null;
  return <div className="app-shell">
    <a className="skip-link" href="#workspace">Skip to workspace</a>
    <header className="app-header"><a className="brand" href="./" aria-label="ROWTRACE home"><span className="brand-mark" aria-hidden="true"><i/><i/><i/></span>ROWTRACE<span className="brand-period">.</span></a><div className="header-right"><span className="local-badge"><span/>{t.local}</span><label className="sr-only" htmlFor="language">{t.language}</label><select id="language" value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="en">EN</option><option value="ru">RU</option><option value="kk">KK</option></select><a className="source-link" href="https://github.com/seoshiro/rowtrace" target="_blank" rel="noreferrer">{t.source} ↗</a></div></header>
    <main id="workspace"><div className="intro"><div><p className="eyebrow">DATA DIFF / CSV + JSON</p><h1>{t.tagline}</h1><p>{t.intro}</p></div><div className="intro-actions"><button className="button accent" onClick={()=>loadDemo()} disabled={pending}>{t.demo}<span aria-hidden="true">↗</span></button><button className="text-button" onClick={()=>loadDemo(true)} disabled={pending}>{t.duplicateDemo}</button></div></div>
      <section className="input-section" aria-labelledby="snapshots-title"><div className="section-heading"><h2 id="snapshots-title">{t.inputs}</h2><span className="quiet mono">CSV / JSON</span></div>
        <div className="file-grid">{([0,1] as const).map(index=><div key={index} className={`file-card ${files[index] || (demo && previews) ? 'has-file' : ''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();acceptFile(index,e.dataTransfer.files[0]);}}>
          <div className="file-top"><span className="file-step">0{index+1}</span><h3>{index===0?t.before:t.after}</h3><span className="file-icon" aria-hidden="true">{index===0?'↥':'↧'}</span></div>
          <p className="file-name mono">{files[index]?.name ?? (demo && previews ? index===0?'catalogue-before.csv':'catalogue-after.csv':t.emptyFile)}</p>
          <div className="file-bottom"><label className="file-label"><span>{t.choose} <span aria-hidden="true">+</span></span><input type="file" aria-label={index===0?t.beforeFile:t.afterFile} accept=".csv,.json,text/csv,application/json" disabled={pending} onChange={e=>{acceptFile(index,e.target.files?.[0]);e.target.value='';}}/></label><span className="quiet file-help">{previews ? `${previews[index].count} ${t.rows} / ${previews[index].columns.length} ${t.columns}` : t.drop}</span></div>
        </div>)}</div>
        <div className="input-toolbar"><label className="delimiter-label">{t.delimiter}<select value={delimiter} disabled={pending} onChange={e=>{setDelimiter(e.target.value as ','|';');invalidate();setDemo(false);}}><option value=",">{t.comma}</option><option value=";">{t.semicolon}</option></select></label><p className="limits">{t.limits}</p><button className="button" onClick={loadFiles} disabled={!files[0] || !files[1] || pending}>{t.preview}</button><button className="text-button reset-button" onClick={()=>{invalidate();setFiles([null,null]);setKeys([]);setIgnored([]);setDemo(false);}}>{t.reset}</button></div>
        <p className="privacy"><span aria-hidden="true">◈</span>{t.privacy}</p>
      </section>
      {demo && previews && <div className="demo-notice"><strong>{t.demoTag}</strong><span>{t.demoText}</span></div>}
      {previews && <section className="configuration" aria-labelledby="config-title"><div className="section-heading"><h2 id="config-title">{t.configure}</h2><span className="quiet mono">EXACT / TYPED</span></div><div className="config-grid"><fieldset><legend>{t.keys}</legend><p className="help">{t.keyHint}</p><div className="column-options">{allColumns.map(column=><label key={column} className="column-choice"><input type="checkbox" checked={keys.includes(column)} disabled={pending} onChange={e=>{setKeys(e.target.checked?[...keys,column]:keys.filter(k=>k!==column));setIgnored(ignored.filter(k=>k!==column));invalidate(true);}}/><span>{column}</span></label>)}</div></fieldset><fieldset><legend>{t.ignored}</legend><p className="help">{t.ignoreHint}</p><div className="column-options">{allColumns.map(column=><label key={column} className="column-choice"><input type="checkbox" checked={ignored.includes(column)} disabled={pending||keys.includes(column)} onChange={e=>{setIgnored(e.target.checked?[...ignored,column]:ignored.filter(k=>k!==column));invalidate(true);}}/><span>{column}</span></label>)}</div></fieldset></div><details className="preview-details"><summary>{t.sample}</summary><div className="preview-grid">{previews.map((p,index)=><div key={index}><h3>{index===0?t.before:t.after}</h3><div className="table-scroll"><table><thead><tr>{p.columns.map(c=><th key={c} scope="col">{c}</th>)}</tr></thead><tbody>{p.rows.map((r,i)=><tr key={i}>{p.columns.map(c=><td key={c}>{cell(r,c,t)}</td>)}</tr>)}</tbody></table></div></div>)}</div></details><div className="compare-bar"><span className="quiet">{keys.length ? keys.join(' + ') : t.selectKey}</span><button className="button accent" disabled={!keys.length||pending} onClick={compare}>{t.compare}<span aria-hidden="true">→</span></button></div></section>}
      <div className="live-status" role="status" aria-live="polite">{pending ? t.processing : busy==='export'?t.exporting : phase==='cancelled'?t.cancelled : notice || (phase==='complete' ? t.complete : '')}{pending && <button className="button" onClick={cancel}>{t.cancel}</button>}</div>
      {issue && <section className="error-panel" role="alert"><div className="error-symbol" aria-hidden="true">!</div><div><p className="eyebrow">{issue.code}</p><h2>{['DUPLICATE_KEY','KEY_MISSING'].includes(issue.code)?t.blocked:t.error}</h2><p>{errorText}</p>{issue.details && issue.details!=='{}' && <pre>{issue.details}</pre>}<p className="quiet">{t.errorHint}</p></div></section>}
      {result && <section className="results" aria-labelledby="results-title"><div className="section-heading"><h2 id="results-title">{t.results}</h2><span className="quiet mono">{result.summary.before} → {result.summary.after} {t.rows}</span></div><div className="summary-grid">{statusList.map(s=><button key={s} className={`summary-card status-${s} ${status===s?'is-active':''}`} aria-pressed={status===s} onClick={()=>query(status===s?'all':s,search,descending,0)}><span className="summary-name"><span aria-hidden="true">{statusSymbols[s]}</span>{t[s]}</span><strong>{result.summary[s].toLocaleString(language)}</strong><span className="summary-line"/></button>)}</div>
        {!result.summary.changed && !result.summary.added && !result.summary.removed && !result.columns.added.length && !result.columns.removed.length && <p className="unchanged-notice">✓ {t.unchangedHint}</p>}
        <div className="results-toolbar"><div className="filter-group" aria-label={t.status}>{(['all',...statusList] as const).map(s=><button key={s} className={status===s?'filter active':'filter'} aria-pressed={status===s} onClick={()=>query(s,search,descending,0)}>{t[s]}</button>)}</div><label className="search-box"><span aria-hidden="true">⌕</span><input aria-label={t.search} maxLength={1024} value={search} placeholder={t.searchPlaceholder} onChange={e=>query(status,e.target.value,descending,0)}/></label><select aria-label={t.sort} value={descending?'desc':'asc'} onChange={e=>query(status,search,e.target.value==='desc',0)}><option value="asc">{t.ascending}</option><option value="desc">{t.descending}</option></select></div>
        <div className={`result-layout ${selected?'has-selection':''}`}><div className="record-list"><div className="table-scroll"><table className="record-table"><thead><tr><th scope="col">{t.key}</th><th scope="col">{t.status}</th><th scope="col">{t.fields}</th></tr></thead><tbody>{page.rows.map(row=><tr key={row.id} className={selected?.keyId && selected.key.map(v=>typeof v==='string'?v:JSON.stringify(v)).join(' / ')===row.key?'selected-row':''}><th scope="row"><button className="row-button mono" onClick={e=>{selectedButton.current=e.currentTarget;latestDetail.current=send({type:'detail',id:row.id});}}>{row.key}<span aria-hidden="true">↗</span></button></th><td><span className={`status-tag status-${row.status}`}><b aria-hidden="true">{statusSymbols[row.status]}</b>{t[row.status]}</span></td><td className="changed-fields mono">{row.fields.length?row.fields.join(', '):'—'}{row.fieldCount>row.fields.length? ' +' + (row.fieldCount-row.fields.length):''}</td></tr>)}</tbody></table></div>{!page.rows.length&&<div className="no-results"><p>{t.noResults}</p><button className="text-button" onClick={()=>query('all','',false,0)}>{t.resetFilters}</button></div>}<div className="pagination"><span>{page.total} {t.rows} · {t.page} {page.page+1} {t.of} {Math.max(1,Math.ceil(page.total/50))}</span><div><button className="icon-button" aria-label={t.previous} disabled={page.page===0} onClick={()=>query(status,search,descending,page.page-1)}>←</button><button className="icon-button" aria-label={t.next} disabled={(page.page+1)*50>=page.total} onClick={()=>query(status,search,descending,page.page+1)}>→</button></div></div></div>
          <aside className="detail-panel" aria-label={t.detail}>{selected ? <><div className="detail-header"><button className="text-button" onClick={()=>{setSelected(null);requestAnimationFrame(()=>selectedButton.current?.focus());}}>← {t.back}</button><span className={`status-tag status-${selected.status}`}>{statusSymbols[selected.status]} {t[selected.status]}</span></div><h3 ref={detailHeading} tabIndex={-1} className="detail-key mono">{selected.key.map(String).join(' / ')}</h3><div className="detail-column-head"><span>{t.field}</span><span>{t.before} → {t.after}</span></div><div className="field-list">{selectedColumns.map(column=><div key={column} className={`field ${selected.changes.some(c=>c.column===column)?'field-changed':''}`}><h4 className="mono">{column}{selected.changes.some(c=>c.column===column)&&<span aria-label={t.changed}> ~</span>}</h4><div className="field-values"><div><span className="side-label">{t.before}</span>{cell(selected.before,column,t)}</div><span className="field-arrow" aria-hidden="true">→</span><div><span className="side-label">{t.after}</span>{cell(selected.after,column,t)}</div></div></div>)}</div></>:<div className="detail-empty"><span className="trace-glyph" aria-hidden="true">↳</span><h3>{t.noSelection}</h3><p>{t.selectRecord}</p></div>}</aside>
        </div><details className="schema-panel"><summary>{t.schema}<span className="mono">+{result.columns.added.length} / −{result.columns.removed.length}</span></summary><p>{t.diagnosticsOk}</p><dl><div><dt>{t.schemaAdded}</dt><dd>{result.columns.added.join(', ')||t.none}</dd></div><div><dt>{t.schemaRemoved}</dt><dd>{result.columns.removed.join(', ')||t.none}</dd></div><div><dt>{t.ignoredColumns}</dt><dd>{ignored.join(', ')||t.none}</dd></div></dl></details><div className="export-bar"><p><span aria-hidden="true">↓</span>{t.exportHint}</p><div><button className="button" disabled={busy!==null} onClick={()=>exportReport('json')}>{t.exportJson}<span aria-hidden="true">↓</span></button><button className="button" disabled={busy!==null} onClick={()=>exportReport('html')}>{t.exportHtml}<span aria-hidden="true">↓</span></button></div></div>
      </section>}
      {!previews&&!result&&!issue&&!pending&&phase!=='cancelled'&&<section className="empty-state"><div className="empty-heading"><span className="trace-glyph" aria-hidden="true">[ ≠ ]</span><div><h2>{t.initialTitle}</h2><p>{t.initialText}</p></div></div><div className="principles">{[['01',t.initialA,t.initialAText],['02',t.initialB,t.initialBText],['03',t.initialC,t.initialCText]].map(([n,title,body])=><div key={n}><span className="mono">{n}</span><h3>{title}</h3><p>{body}</p></div>)}</div></section>}
    </main><footer><span>{t.foot}</span><span className="mono">{t.notStored} · v0.1.0 · {__ROWTRACE_COMMIT__.slice(0,8)}</span></footer>
  </div>;
}
