import { parentPort, workerData } from 'node:worker_threads';
import { compareDatasets, parseDataset, serializeReport } from '@seoshiro/rowtrace-core';
import { renderHtmlReport } from '@seoshiro/rowtrace-core/html';
import { readBounded, inputFormat } from './io.js';
import type { CliOptions } from './args.js';
import { DEFAULT_LIMITS } from '@seoshiro/rowtrace-core';

// workerData is constructed exclusively by the validated CLI entry point.
const options = workerData as CliOptions;
try {
  const signal = new AbortController().signal;
  const parseOptions = (path: string) => {
    const format = inputFormat(path, options.inputFormat);
    return { format, ...(format === 'csv' ? { delimiter: options.delimiter } : {}), ...(options.limits === undefined ? {} : { limits: options.limits }) };
  };
  const beforeText = await readBounded(options.inputs[0], options.limits?.maxBytes ?? DEFAULT_LIMITS.maxBytes, signal);
  const before = parseDataset(beforeText, parseOptions(options.inputs[0]));
  const afterText = await readBounded(options.inputs[1], options.limits?.maxBytes ?? DEFAULT_LIMITS.maxBytes, signal);
  const after = parseDataset(afterText, parseOptions(options.inputs[1]));
  const report = compareDatasets(before, after, {
    keyColumns: options.keyColumns,
    ...(options.ignoreColumns === undefined ? {} : { ignoreColumns: options.ignoreColumns }),
    ...(options.trimStrings === undefined ? {} : { trimStrings: options.trimStrings }),
    ...(options.ignoreCase === undefined ? {} : { ignoreCase: options.ignoreCase }),
    ...(options.limits === undefined ? {} : { limits: options.limits }),
  });
  const summary = report.summary;
  const text = options.format === 'json' ? serializeReport(report)
    : options.format === 'html' ? renderHtmlReport(report)
      : `Added ${summary.added} | Removed ${summary.removed} | Changed ${summary.changed} | Unchanged ${summary.unchanged}\nColumns added ${report.columns.added.length} | removed ${report.columns.removed.length}\n`;
  parentPort?.postMessage({ type: 'complete', text, hasChanges: report.hasChanges });
} catch (error) {
  const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'IO_ERROR';
  parentPort?.postMessage({ type: 'error', code, message: error instanceof Error ? error.message : 'Comparison failed.' });
}
