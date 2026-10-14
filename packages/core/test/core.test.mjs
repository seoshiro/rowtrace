import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDataset, compareDatasets, parseConfig, serializeReport, DEFAULT_LIMITS, RowtraceError, utf8Length } from '../dist/index.js';
import { renderHtmlReport } from '../dist/html.js';

const json = (rows, limits) => parseDataset(typeof rows === 'string' ? rows : JSON.stringify(rows), { format: 'json', ...(limits ? { limits } : {}) });
const csv = (text, extras = {}) => parseDataset(text, { format: 'csv', ...extras });
const diff = (a,b,extras={}) => compareDatasets(json(a),json(b),{keyColumns:['id'],...extras});
const error = (fn, code) => assert.throws(fn, e => e instanceof RowtraceError && e.code === code);

test('manual golden: A17 price, B04 removed, C09 added, U03 unchanged', () => {
  const before = csv('sku,price\nA17,14900\nB04,300\nU03,800\n');
  const after = csv('price,sku\n16900,A17\n500,C09\n800,U03\n');
  const report = compareDatasets(before,after,{keyColumns:['sku']});
  assert.deepEqual(report.summary,{before:3,after:3,added:1,removed:1,changed:1,unchanged:1,changedCells:1});
  assert.deepEqual(report.rows.map(r=>[r.key[0],r.status]),[['A17','changed'],['B04','removed'],['C09','added'],['U03','unchanged']]);
  assert.deepEqual(report.rows[0].changes,[{column:'price',before:{kind:'value',value:'14900'},after:{kind:'value',value:'16900'}}]);
});
test('row and property order do not change canonical JSON bytes', () => {
  const a=[{id:'a',x:1},{id:'b',x:2}], b=[{x:3,id:'a'},{x:2,id:'b'}];
  assert.equal(serializeReport(diff(a,b)),serializeReport(diff([...a].reverse(),[...b].reverse())));
  assert.equal(diff(a,[...a].reverse()).hasChanges,false);
});
test('all scalar types and missing/null/empty remain distinct', () => {
  const report=diff([{id:1},{id:2,x:null},{id:3,x:''},{id:4,x:1},{id:5,x:false}], [{id:1,x:null},{id:2,x:''},{id:3,x:'1'},{id:4,x:'1'},{id:5,x:'false'}]);
  assert.equal(report.summary.changed,5); assert.deepEqual(report.rows[0].changes[0].before,{kind:'missing'});
  assert.equal(csv('id,x\n001,1').rows[0].id,'001');
  assert.equal(diff([{id:1}],[{id:'1'}]).summary.added,1);
});
test('typed composite tuples resist delimiter and type collisions', () => {
  const rows=[{a:'a|b',b:'c'},{a:'a',b:'b|c'},{a:1,b:'1'},{a:'1',b:1}];
  assert.equal(compareDatasets(json(rows),json([...rows].reverse()),{keyColumns:['a','b']}).summary.unchanged,4);
});
test('duplicate and missing key components block the whole comparison', () => {
  error(()=>diff([{id:1},{id:1}],[]),'DUPLICATE_KEY');
  for (const row of [{},{id:null},{id:''}]) error(()=>diff([row],[]),'KEY_MISSING');
  assert.equal(diff([{id:false},{id:0},{id:' '}],[{id:false},{id:0},{id:' '}]).summary.unchanged,3);
});
test('normalization is opt-in, locale independent, preserves raw values and rechecks keys', () => {
  const a=[{id:' X ',v:'A'}],b=[{id:'x',v:'a'}];
  assert.equal(diff(a,b).summary.added,1);
  const r=diff(a,b,{trimStrings:true,ignoreCase:true}); assert.equal(r.summary.unchanged,1); assert.equal(r.rows[0].before.id,' X ');
  error(()=>diff([{id:'A'},{id:'a'}],[],{ignoreCase:true}),'DUPLICATE_KEY');
  error(()=>diff([{id:'  '}],[],{trimStrings:true}),'KEY_MISSING');
});
test('schema changes separate from row changes; ignored fields remain explicit', () => {
  const r=diff([{id:1,old:'x'}],[{id:1,new:'y'}]); assert.deepEqual(r.columns.added,['new']); assert.deepEqual(r.columns.removed,['old']); assert.equal(r.summary.changedCells,2);
  const ignored=diff([{id:1}],[{id:1,new:'y'}],{ignoreColumns:['new']}); assert.equal(ignored.hasChanges,false); assert.deepEqual(ignored.config.ignoreColumns,['new']); assert.deepEqual(ignored.columns.added,['new']);
  error(()=>diff([{id:1}],[{id:1}],{ignoreColumns:['typo']}),'INVALID_CONFIG');
  error(()=>diff([{id:1}],[{id:1}],{ignoreColumns:['id']}),'INVALID_CONFIG');
});
test('empty JSON and header-only CSV have well-defined counts', () => {
  assert.equal(diff([],[]).hasChanges,false); assert.equal(diff([],[{id:1}]).summary.added,1);
  assert.equal(compareDatasets(csv('id,x\n'),csv('id,x'),{keyColumns:['id']}).summary.before,0);
  const r=compareDatasets(csv('id,x'),csv('id,y'),{keyColumns:['id']}); assert.equal(r.hasChanges,true); assert.equal(r.summary.changed,0);
  error(()=>csv(''),'CSV_PARSE_ERROR');
});
test('CSV BOM, multiline, escaped quotes, CRLF, semicolon, blank physical records', () => {
  const r=csv('\uFEFFid;note\r\n\r\nА17;"Қазақ, русский\r\n""text"""\r\n',{delimiter:';'});
  assert.equal(r.rows.length,1); assert.equal(r.rows[0].note,'Қазақ, русский\r\n"text"');
  assert.equal(csv('id\n""\n').rows.length,1);
  error(()=>csv('id,x\n1'),'CSV_PARSE_ERROR'); error(()=>csv('id,x\n1,2,3'),'CSV_PARSE_ERROR');
  error(()=>csv('id,x\n1,"oops'),'CSV_PARSE_ERROR');
  error(()=>csv('id,x\n1,a"b'),'CSV_PARSE_ERROR');
  error(()=>csv('id,x\n1,"a" x'),'CSV_PARSE_ERROR');
  error(()=>csv('id,id\n1,2'),'DUPLICATE_HEADER');
});
test('strict JSON rejects duplicate escaped properties, comments, nested data, trailing syntax', () => {
  error(()=>json('[{"id":1,"\\u0069d":2}]'),'DUPLICATE_PROPERTY');
  for (const source of ['[{"id":1},]','[/*x*/{"id":1}]','[{"id":1}] []','[{"id":1}']) error(()=>json(source),'JSON_PARSE_ERROR');
  for (const source of ['{"id":1}','[1]','[[1]]','[{"id":1,"v":{}}]','[{"id":1,"v":[]}]']) error(()=>json(source),'UNSUPPORTED_VALUE');
});
test('numbers reject unsafe integers and overflow; -0 canonicalizes to zero', () => {
  for (const source of ['[{"id":9007199254740992}]','[{"id":1e309}]','[{"id":-9007199254740992}]']) error(()=>json(source),'UNSAFE_NUMBER');
  assert.equal(json('[{"id":9007199254740991}]').rows[0].id,Number.MAX_SAFE_INTEGER);
  assert.equal(diff('[{"id":-0}]','[{"id":0}]').hasChanges,false);
});
test('Unicode is exact, without implicit canonical normalization', () => {
  assert.equal(diff([{id:'é'}],[{id:'e\u0301'}]).summary.added,1);
  for(const text of ['abc','界','😀','\ud800']) assert.equal(utf8Length(text),Buffer.byteLength(text));
});
test('all public configuration and dataset boundaries reject malformed inputs', () => {
  for(const config of [null,[],{keyColumns:[]},{keyColumns:['id'],typo:true},{keyColumns:['id'],ignoreCase:'yes'},{keyColumns:['id','id']},{keyColumns:['id'],limits:{maxBytes:Infinity}},{keyColumns:['id'],limits:{maxRows:20001}}]) error(()=>compareDatasets(json([]),json([]),config),'INVALID_CONFIG');
  error(()=>parseConfig('{"keyColumns":["id"],"keyColumns":["x"]}'),'INVALID_CONFIG');
  error(()=>parseConfig('{"keyColumns":["id"],"limits":{"maxRows":1,"maxRows":2}}'),'INVALID_CONFIG');
  error(()=>csv('id\n1',{delimiter:'|'}),'INVALID_CONFIG');
  error(()=>compareDatasets({format:'json',columns:['id'],rows:[{id:1,x:2}]},json([]),{keyColumns:['id']}),'INVALID_DATASET');
  error(()=>compareDatasets({format:'json',columns:['id'],rows:[{get id(){throw Error('getter invoked');}}]},json([]),{keyColumns:['id']}),'INVALID_DATASET');
  error(()=>serializeReport({schemaVersion:'1'}),'INVALID_REPORT');
  error(()=>parseDataset('[]',{format:'json'},{get isCancelled(){throw Error('getter invoked');}}),'INVALID_CONFIG');
});
test('UTF8, rows, columns, rectangular cells, values and headers enforce exact boundaries', () => {
  const source='[{"id":"界"}]'; assert.equal(json(source,{maxBytes:Buffer.byteLength(source)}).rows.length,1); error(()=>json(source,{maxBytes:Buffer.byteLength(source)-1}),'LIMIT_EXCEEDED');
  assert.equal(json([{id:1},{id:2}],{maxRows:2}).rows.length,2); error(()=>json([{id:1},{id:2}],{maxRows:1}),'LIMIT_EXCEEDED');
  assert.equal(json([{id:1,x:2}],{maxColumns:2,maxCells:2}).rows.length,1); error(()=>json([{id:1,x:2}],{maxColumns:1}),'LIMIT_EXCEEDED');
  error(()=>json([{id:1},{id:2,x:2}],{maxCells:3}),'LIMIT_EXCEEDED');
  assert.equal(json([{id:1,x:'界'}],{maxValueBytes:3}).rows[0].x,'界'); error(()=>json([{id:1,x:'界'}],{maxValueBytes:2}),'LIMIT_EXCEEDED');
  assert.equal(csv('id\n1',{limits:{maxHeaderBytes:2}}).rows.length,1); error(()=>csv('id\n1',{limits:{maxHeaderBytes:1}}),'LIMIT_EXCEEDED');
});
test('hard full value/header limits and external dataset UTF8 regression', () => {
  assert.equal(json([{id:1,x:'a'.repeat(DEFAULT_LIMITS.maxValueBytes)}]).rows.length,1);
  error(()=>json([{id:1,x:'a'.repeat(DEFAULT_LIMITS.maxValueBytes+1)}]),'LIMIT_EXCEEDED');
  assert.equal(csv('h'.repeat(1024)+'\n1').columns.length,1); error(()=>csv('h'.repeat(1025)+'\n1'),'LIMIT_EXCEEDED');
  const data={format:'json',columns:['id','value'],rows:[{id:'x',value:'界'.repeat(30)}]}; error(()=>compareDatasets(data,data,{keyColumns:['id'],limits:{maxBytes:64}}),'LIMIT_EXCEEDED');
  const parsed=json([{id:'x',value:'界'.repeat(30)}]); error(()=>compareDatasets(parsed,parsed,{keyColumns:['id'],limits:{maxBytes:64}}),'LIMIT_EXCEEDED');
});
test('key, config and JSON/HTML report bounds reject overflow transactionally', () => {
  const row=[{id:'x'}], keyBytes=Buffer.byteLength('[["string","x"]]');
  assert.equal(diff(row,row,{limits:{maxKeyBytes:keyBytes}}).summary.unchanged,1); error(()=>diff(row,row,{limits:{maxKeyBytes:keyBytes-1}}),'LIMIT_EXCEEDED');
  error(()=>parseConfig(' '.repeat(DEFAULT_LIMITS.maxConfigBytes+1)),'LIMIT_EXCEEDED');
  const report=diff(row,row), bytes=Buffer.byteLength(serializeReport(report));
  assert.equal(Buffer.byteLength(serializeReport(diff(row,row,{limits:{maxReportBytes:bytes}}))),bytes);
  error(()=>diff(row,row,{limits:{maxReportBytes:bytes-1}}),'LIMIT_EXCEEDED');
  error(()=>renderHtmlReport(report,{maxBytes:100}),'LIMIT_EXCEEDED');
});
test('prototype keys, markup, formula strings and controls are inert data', () => {
  const a=json('[{"id":"__proto__","__proto__":"<img src=x onerror=alert(1)>","constructor":"=1+1","prototype":"\\u001b]0;title\\u0007"}]');
  const report=compareDatasets(a,a,{keyColumns:['id']}); const encoded=serializeReport(report); const html=renderHtmlReport(report);
  assert.equal({}.polluted,undefined); assert.equal(JSON.parse(encoded).rows[0].before.__proto__,'<img src=x onerror=alert(1)>');
  assert.ok(!html.includes('<img')); assert.ok(html.includes('&lt;img')); assert.ok(!html.includes('<script')); assert.ok(!html.includes('href=')); assert.ok(encoded.includes('\\u001b'));
  for(const locale of ['en','ru','kk']) assert.ok(renderHtmlReport(report,{locale}).includes(`lang="${locale}"`));
});
test('cancel is checked during parsing and indexing, never returns partial success', () => {
  let n=0; error(()=>parseDataset(JSON.stringify(Array.from({length:100},(_,id)=>({id}))),{format:'json'},{isCancelled:()=>++n>10}),'CANCELLED');
  const data=json(Array.from({length:100},(_,id)=>({id}))); n=0; error(()=>compareDatasets(data,data,{keyColumns:['id']},{isCancelled:()=>++n>25}),'CANCELLED');
  assert.equal(diff([{id:1}],[{id:1}]).summary.unchanged,1);
});
test('independent small quadratic oracle and conservation invariants across 80 fixed seeds', () => {
  for(let seed=1;seed<=80;seed++) {
    const a=[],b=[];
    for(let id=0;id<12;id++) { if((id*7+seed)%4!==0)a.push({id,x:(id+seed)%5}); if((id*11+seed)%5!==0)b.push({id,x:(id+seed+(id%3===0?1:0))%5}); }
    const expected={added:0,removed:0,changed:0,unchanged:0};
    for(const row of a){const other=b.find(v=>v.id===row.id); if(!other)expected.removed++;else if(other.x!==row.x)expected.changed++;else expected.unchanged++;}
    for(const row of b)if(!a.some(v=>v.id===row.id))expected.added++;
    const r=diff(a,b);
    for(const k of Object.keys(expected))assert.equal(r.summary[k],expected[k]);
    assert.equal(a.length,r.summary.unchanged+r.summary.changed+r.summary.removed); assert.equal(b.length,r.summary.unchanged+r.summary.changed+r.summary.added);
    assert.equal(serializeReport(r),serializeReport(diff(a.reverse(),b.reverse())));
  }
});
test('package source remains free of platform I/O imports', () => {
  for(const file of ['index','parse','compare','serialize','html','validation']) assert.ok(!/from ['"](?:node:|react|react-dom)/.test(readFileSync(new URL(`../src/${file}.ts`,import.meta.url),'utf8')));
});
