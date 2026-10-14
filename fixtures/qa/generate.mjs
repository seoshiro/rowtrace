import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Synthetic data only. No core imports: expectations are specified by hand.
const root = dirname(fileURLToPath(import.meta.url));
async function put(name, content) {
  await mkdir(dirname(join(root, name)), { recursive: true });
  await writeFile(join(root, name), content, 'utf8');
}
async function json(name, value) { await put(name, JSON.stringify(value, null, 2) + '\n'); }
async function generateSmall() {
const before = 'sku,name,price\nA17,Desk lamp,14900\nB04,Notebook,2400\nU03,Pen,900\n';
const after = 'sku,name,price\nU03,Pen,900\nC09,Storage box,3200\nA17,Desk lamp,16900\n';
await put('F01/before.csv', before);
await put('F01/after.csv', after);
await json('F01/expected.json', { key: ['sku'], before: 3, after: 3, summary: { added: 1, removed: 1, changed: 1, unchanged: 1 }, changed: { A17: { price: { before: '14900', after: '16900' } } }, added: ['C09'], removed: ['B04'], unchanged: ['U03'] });
await put('F02/before.csv', before);
await put('F02/after.csv', 'price,sku,name\n900,U03,Pen\n14900,A17,Desk lamp\n2400,B04,Notebook\n');
await put('F03/before.csv', 'sku,name,price,active\nA17,Old,14900,true\n');
await put('F03/after.csv', 'sku,name,price,active\nA17,New,16900,false\n');
await put('F04/before.csv', before + 'A17,Duplicate,1\n');
await put('F04/after.csv', after);
await json('F05/before.json', [{ sku: 'A17', value: 1 }, { value: 2 }]);
await json('F05/after.json', [{ sku: '', value: 2 }]);
await put('F06/before.csv', 'sku,name\n');
await put('F06/after.csv', 'sku,name\n');
await json('F06/empty.json', []);
await put('F07/before.csv', '\ufeffsku,name\r\nA17,Қазақша әғқңөұүһі\r\nB04,Русский текст\r\n');
await put('F07/after.csv', 'sku,name\nB04,Русский текст\nA17,Қазақша әғқңөұүһі\n');
await put('F08/before.csv', 'sku,note\nA17,"comma, quote ""yes""\nsecond line"\n');
await put('F08/after.csv', 'sku,note\r\nA17,"comma, quote ""yes""\nsecond line"\r\n');
await json('F09/before.json', [{ first: 'a|b', second: 'c', value: 1 }, { first: 'a', second: 'b|c', value: 2 }]);
await json('F09/after.json', [{ first: 'a', second: 'b|c', value: 3 }, { first: 'a|b', second: 'c', value: 1 }]);
await json('F10/before.json', [{ sku: 'string', value: '1' }, { sku: 'number', value: 1 }, { sku: 'boolean', value: false }, { sku: 'null', value: null }, { sku: 'missing' }, { sku: 'empty', value: '' }]);
await json('F10/after.json', [{ sku: 'string', value: 1 }, { sku: 'number', value: '1' }, { sku: 'boolean', value: 'false' }, { sku: 'null' }, { sku: 'missing', value: '' }, { sku: 'empty', value: null }]);
await put('F11/before.csv', 'sku,removed,kept\nA17,old,same\n');
await put('F11/after.csv', 'kept,sku,added\nsame,A17,new\n');
await put('F11/duplicate-header.csv', 'sku,sku\nA17,A17\n');
await put('F12/broken.csv', 'sku,note\nA17,"unterminated');
await put('F12/width.csv', 'sku,note\nA17,one,two\n');
await put('F12/broken.json', '[{"sku":"A17",}]');
await put('F12/duplicate-property.json', '[{"sku":"A17","sku":"B04"}]');
await put('F12/unsafe-integer.json', '[{"sku":9007199254740993}]');
await put('F12/nested.json', '[{"sku":"A17","value":{"nested":true}}]');
await put('F12/array.json', '[{"sku":"A17","value":[]}]');
const payload = '<img src="https://example.invalid/ROWTRACE-XSS" onerror="globalThis.__rowtraceXss=1">';
const hostile = Object.fromEntries([['sku', 'ROWTRACE-CANARY-82741'], ['__proto__', 'prototype is data'], ['constructor', 'constructor is data'], ['prototype', 'prototype is data'], [payload, payload], ['formula', '=HYPERLINK("https://example.invalid")'], ['terminal', '\u001b]0;not-a-title\u0007\u001b[31mred\nnew line']]);
await json('F13/before.json', [hostile]);
await json('F13/after.json', [{ ...hostile, formula: '+SUM(1,2)' }]);
const expected = {
  F02: { added: 0, removed: 0, changed: 0, unchanged: 3 },
  F03: { added: 0, removed: 0, changed: 1, unchanged: 0, changedFields: ['active', 'name', 'price'] },
  F04: { blocked: 'DUPLICATE_KEY' }, F05: { blocked: 'KEY_MISSING' },
  F06: { added: 0, removed: 0, changed: 0, unchanged: 0 },
  F07: { added: 0, removed: 0, changed: 0, unchanged: 2 },
  F08: { added: 0, removed: 0, changed: 0, unchanged: 1 },
  F09: { key: ['first', 'second'], added: 0, removed: 0, changed: 1, unchanged: 1 },
  F10: { added: 0, removed: 0, changed: 6, unchanged: 0, changedFields: ['value'] },
  F11: { added: 0, removed: 0, changed: 1, unchanged: 0, addedColumns: ['added'], removedColumns: ['removed'], duplicateHeader: 'DUPLICATE_HEADER' },
  F12: { blocked: true, explanation: 'Every malformed case must fail, never return a partial complete result.' },
  F13: { added: 0, removed: 0, changed: 1, unchanged: 0, changedFields: ['formula'], inert: true },
  F14: { explanation: 'Boundary fixtures generated separately after limits are fixed. Exact limit succeeds; plus one fails.' },
  F15: { seed: 82741, explanation: 'Every tenth price changes; row count / 10 changed, remainder unchanged. Same keys on both sides.' },
};
await json('expected.json', expected);
}

// F15 is generated only on request, avoiding megabytes in source control.
export function largePair(count, mode = 'sparse') {
  let seed = 82741;
  const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  const left = ['sku,name,price']; const right = ['sku,name,price'];
  for (let i = 0; i < count; i++) {
    const key = `S${String(i).padStart(5, '0')}`;
    const price = next() % 100000;
    const name = mode === 'long' ? 'L'.repeat(500) : `Synthetic ${i}`;
    left.push(`${key},${name},${price}`);
    const changed = mode === 'identical' ? false : mode === 'mass' || mode === 'long' ? true : i % 10 === 0;
    right.push(`${mode === 'duplicate' && i === count - 1 ? 'S00000' : key},${name},${price + Number(changed)}`);
  }
  return { before: left.join('\n') + '\n', after: right.join('\n') + '\n' };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await generateSmall();
if (process.argv.includes('--large')) {
  for (const count of [1000, 10000, 20000]) {
    const pair = largePair(count);
    await put(`F15/${count}-before.csv`, pair.before); await put(`F15/${count}-after.csv`, pair.after);
  }
}
}
