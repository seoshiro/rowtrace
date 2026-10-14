import { cellAt } from './compare.js';
import type { Cell, DiffReport } from './types.js';
import { assertReport, reportLimit } from './serialize.js';
import { check, fail, keys, plain, utf8Length } from './validation.js';

const labels = {
  en: { title: 'Snapshot comparison', before: 'Before', after: 'After', key: 'Key', field: 'Field', status: 'Status', added: 'Added', removed: 'Removed', changed: 'Changed', unchanged: 'Unchanged', missing: 'missing', value: 'Value', settings: 'Comparison settings', schema: 'Column changes', privacy: 'This report contains the compared data. Share it carefully.' },
  ru: { title: 'Сравнение снимков', before: 'До', after: 'После', key: 'Ключ', field: 'Поле', status: 'Статус', added: 'Добавлено', removed: 'Удалено', changed: 'Изменено', unchanged: 'Без изменений', missing: 'отсутствует', value: 'Значение', settings: 'Настройки сравнения', schema: 'Изменения колонок', privacy: 'Отчёт содержит сравниваемые данные. Делитесь им осмотрительно.' },
  kk: { title: 'Деректер нұсқаларын салыстыру', before: 'Бұрын', after: 'Кейін', key: 'Кілт', field: 'Өріс', status: 'Күй', added: 'Қосылды', removed: 'Жойылды', changed: 'Өзгерді', unchanged: 'Өзгеріссіз', missing: 'жоқ', value: 'Мән', settings: 'Салыстыру параметрлері', schema: 'Баған өзгерістері', privacy: 'Есеп салыстырылған деректерді қамтиды. Оны сақтықпен бөлісіңіз.' }
};
function escape(text: string): string { return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c); }
export function renderHtmlReport(report: DiffReport, options: { locale?: 'en' | 'ru' | 'kk'; maxBytes?: number } = {}): string {
  assertReport(report); plain(options); keys(options, ['locale','maxBytes']); const locale = options.locale ?? 'en';
  if (locale !== 'en' && locale !== 'ru' && locale !== 'kk') fail('INVALID_CONFIG', 'Unsupported report locale.');
  const t = labels[locale], max = reportLimit(report, options.maxBytes), parts: string[] = []; let size = 0;
  const add = (text: string) => { size += utf8Length(text); check(size, max, 'maxReportBytes'); parts.push(text); };
  const display = (cell: Cell): string => cell.kind === 'missing' ? `<em>${t.missing}</em>` : `<code>${escape(JSON.stringify(cell.value))}</code>`;
  add(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>ROWTRACE — ${t.title}</title><style>body{font:16px/1.6 system-ui,sans-serif;background:#11151b;color:#eef1f5;max-width:1100px;margin:0 auto;padding:24px}h1,h2{line-height:1.2}h1{font-size:2rem}h2{font-size:1.2rem}table{border-collapse:collapse;width:100%;margin:16px 0}th,td{text-align:left;vertical-align:top;padding:10px;border:1px solid #566170;overflow-wrap:anywhere}th{background:#242c38}code,pre{font-family:ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}section{margin:32px 0;border-top:2px solid #7dd3ac;padding-top:12px}em{color:#b8c1cf}summary{cursor:pointer}a{color:inherit}</style></head><body><h1>ROWTRACE</h1><p>${t.title} · schemaVersion 1</p><p>${t.privacy}</p><table><thead><tr><th>${t.before}</th><th>${t.after}</th><th>${t.added}</th><th>${t.removed}</th><th>${t.changed}</th><th>${t.unchanged}</th></tr></thead><tbody><tr><td>${report.summary.before}</td><td>${report.summary.after}</td><td>${report.summary.added}</td><td>${report.summary.removed}</td><td>${report.summary.changed}</td><td>${report.summary.unchanged}</td></tr></tbody></table><details><summary>${t.settings}</summary><pre>${escape(JSON.stringify(report.config,null,2))}</pre></details><details><summary>${t.schema}</summary><pre>${escape(JSON.stringify(report.columns,null,2))}</pre></details>`);
  for (const row of report.rows) {
    add(`<section><h2>${t.key}: <code>${escape(JSON.stringify(row.key))}</code> · ${t[row.status]}</h2><table><thead><tr><th scope="col">${t.field}</th><th scope="col">${t.before}</th><th scope="col">${t.after}</th></tr></thead><tbody>`);
    for (const col of [...new Set([...report.columns.before,...report.columns.after])]) add(`<tr><th scope="row">${escape(col)}</th><td>${display(cellAt(row.before,col))}</td><td>${display(cellAt(row.after,col))}</td></tr>`);
    add('</tbody></table></section>');
  }
  add('</body></html>\n'); return parts.join('');
}
