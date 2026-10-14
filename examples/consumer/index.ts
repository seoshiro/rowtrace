import { compareDatasets, parseDataset, serializeReport, type DiffReport } from '@seoshiro/rowtrace-core';

const before = parseDataset('sku,price\nA17,14900\nB04,900\nU03,100\n', { format: 'csv' });
const after = parseDataset('sku,price\nU03,100\nA17,16900\nC09,400\n', { format: 'csv' });
const report: DiffReport = compareDatasets(before, after, { keyColumns: ['sku'] });
if (report.summary.added !== 1 || report.summary.removed !== 1 || report.summary.changed !== 1 || report.summary.unchanged !== 1) {
  throw new Error('Consumer golden contract failed');
}
console.log(serializeReport(report));
