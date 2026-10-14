# Core API

ESM only, Node >=22 and modern browser bundlers. The independent tarball is the installable deliverable; npm registry publication is a separate release step and must not be assumed.

```ts
import { parseDataset, compareDatasets, serializeReport, RowtraceError } from '@seoshiro/rowtrace-core';

const before = parseDataset('sku,price\nA17,14900', { format: 'csv' });
const after = parseDataset('sku,price\nA17,16900', { format: 'csv' });
try {
  const report = compareDatasets(before, after, { keyColumns: ['sku'] });
  console.log(report.summary.changed); // 1
  const canonicalJson = serializeReport(report);
  const { renderHtmlReport } = await import('@seoshiro/rowtrace-core/html');
  const html = renderHtmlReport(report, { locale: 'en' });
  // The caller owns file/network I/O. Core only returns strings.
  void canonicalJson; void html;
} catch (error) {
  if (error instanceof RowtraceError) console.error(error.code);
  else throw error;
}
```

Public operations:

- `parseDataset(text, {format, delimiter?, limits?}, control?)`: parse a decoded UTF-8 string. `format` is mandatory; delimiter is comma/semicolon and CSV-only. Returns immutable `{format, columns, rows}`.
- `compareDatasets(before, after, {keyColumns, ignoreColumns?, trimStrings?, ignoreCase?, limits?}, control?)`: validate runtime config and both datasets, index explicit keys, return immutable `DiffReport` or throw. Hand-built plain data objects are validated too.
- `parseConfig(text)`: strictly parse bounded JSON config; reject duplicate properties, unknown keys and wrong values. It does not execute expressions or JS.
- `validateConfig(config)`: return normalized comparison settings after structural validation. Column existence is checked during comparison.
- `serializeReport(report, {maxBytes?}?)`: deterministic schema-1 JSON with one final LF. Requires the original immutable issued report in the same module instance.
- `renderHtmlReport(report, {locale?, maxBytes?}?)` from `/html`: bounded self-contained inert HTML. Locale EN/RU/KK, default EN. Export failures throw before the caller receives output.
- `cellAt(rowOrNull, column)`: return explicit presence/value state for a validated report row.
- `DEFAULT_LIMITS`, `utf8Length`, public TypeScript types, and `RowtraceError` are exported from the main entry.

`Control` is `{isCancelled?: () => boolean}`. Calls are synchronous; the callback does not magically allow a same-thread UI cancel event to run. Move the call into a dedicated worker and terminate that worker for asynchronous UI/SIGINT cancellation. No partial result is returned when `CANCELLED` is thrown.

Errors expose stable `.code`, `.message`, and `.details`. Messages are English developer diagnostics; adapters may translate by code. Details may contain source names/values and must be rendered as text or safely escaped for terminal output. Data row numbers are 1-based (CSV excludes header and skipped blank records); JSON syntax positions also include 1-based physical line/column.

| Code | Meaning |
| --- | --- |
| CSV_PARSE_ERROR / JSON_PARSE_ERROR | Invalid supported format syntax |
| DUPLICATE_HEADER / DUPLICATE_PROPERTY | Ambiguous field names |
| DUPLICATE_KEY / KEY_MISSING | Blocking matching ambiguity |
| UNSUPPORTED_VALUE / UNSAFE_NUMBER | Unsupported structure/type/number model |
| LIMIT_EXCEEDED | A named input/config/key/report cap was crossed |
| INVALID_CONFIG / INVALID_DATASET / INVALID_REPORT | Runtime API contract violation |
| CANCELLED | Operation stopped, no complete report |

The report includes `status:'complete'`, `schemaVersion:'1'`, resolved config, schema changes, counts, `hasChanges`, and key-sorted rows. Each row has typed `key`, opaque `keyId`, `status`, nullable `before`/`after` raw records, and matched-field changes. See [SEMANTICS.md](./SEMANTICS.md) for presence, normalization and ordering. Consumers should branch on schemaVersion before consuming persisted reports. Version 0.x allows documented minor-version API changes; a changed report contract requires a new schemaVersion.

Both runtime dependencies are MIT-licensed: [Papa Parse](https://www.papaparse.com/docs) handles CSV record parsing, and [Microsoft jsonc-parser](https://github.com/microsoft/node-jsonc-parser) supplies the strict-configured JSON visitor. Versions were checked against npm metadata on 2026-10-14. Their maintained parsing paths avoid ad hoc split-based CSV and silent duplicate-property overwrites.
