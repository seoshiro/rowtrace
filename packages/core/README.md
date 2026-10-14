# @seoshiro/rowtrace-core

Compare CSV or flat JSON snapshots by explicit typed keys. ESM, Node >=22, no filesystem/network/UI dependencies. This experimental 0.1.0 package is distributed as a tested tarball; do not assume npm publication.

```js
import { parseDataset, compareDatasets, serializeReport } from '@seoshiro/rowtrace-core';
const before = parseDataset('id,price\nA17,14900', { format: 'csv' });
const after = parseDataset('id,price\nA17,16900', { format: 'csv' });
const report = compareDatasets(before, after, { keyColumns: ['id'] });
console.log(serializeReport(report));
```

Optional inert HTML: `const {renderHtmlReport} = await import('@seoshiro/rowtrace-core/html')`. Export the original report in the same module instance; cloned/persisted reports are not an accepted import format.

CSV values remain strings. JSON preserves scalar types and missing/null/empty distinctions. Duplicate/missing/null/empty keys block comparison. `trimStrings`, `ignoreCase` and `ignoreColumns` are explicit options; defaults are exact. Upper bounds: 16 MiB per source, 20,000 rows, 100 columns, 1,000,000 rectangular cells, 64 KiB per value, 1,024-byte headers, 4,096-byte encoded keys, 16 KiB configuration, 32 MiB report. All bounds are UTF-8 bytes where relevant; overrides only lower them.

Synchronous `control.isCancelled` checkpoints are available. Use a dedicated worker and terminate it for responsive asynchronous cancellation. No report is returned after cancellation or a blocking validation error. Error codes are available on `RowtraceError`.

Full contracts and release instructions: [ROWTRACE repository](https://github.com/seoshiro/rowtrace), `docs/CORE-API.md`, `docs/SEMANTICS.md`.
