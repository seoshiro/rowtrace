import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
// Fixed documented v0.1 limits, intentionally independent of implementation.
export const limits = { bytes: 16777216, rows: 20000, columns: 100, cells: 1000000, value: 65536, header: 1024, key: 4096, config: 16384, report: 33554432 };
export function boundaries() {
  const header = n => 'h'.repeat(n);
  const row = n => 'x'.repeat(n);
  return {
    'value-at.json': JSON.stringify([{ sku: 'A17', value: row(limits.value) }]),
    'value-over.json': JSON.stringify([{ sku: 'A17', value: row(limits.value + 1) }]),
    'header-at.json': JSON.stringify([{ sku: 'A17', [header(limits.header)]: 'value' }]),
    'header-over.json': JSON.stringify([{ sku: 'A17', [header(limits.header + 1)]: 'value' }]),
    // Key limit includes typed key encoding; exact encoding boundaries are covered by core API tests.
    'key-over.json': JSON.stringify([{ sku: row(limits.key + 1) }]),
    'columns-at.csv': Array.from({ length: limits.columns }, (_, i) => `c${i}`).join(',') + '\n',
    'columns-over.csv': Array.from({ length: limits.columns + 1 }, (_, i) => `c${i}`).join(',') + '\n',
    'rows-at.csv': 'sku\n' + Array.from({ length: limits.rows }, (_, i) => `S${i}\n`).join(''),
    'rows-over.csv': 'sku\n' + Array.from({ length: limits.rows + 1 }, (_, i) => `S${i}\n`).join(''),
  };
}
if (process.argv[1]?.endsWith('generate.mjs')) {
  const dest = process.argv[2];
  if (!dest) throw new Error('Pass a generated-fixture output directory');
  await mkdir(dest, { recursive: true });
  for (const [name, value] of Object.entries(boundaries())) await writeFile(join(dest, name), value);
}
