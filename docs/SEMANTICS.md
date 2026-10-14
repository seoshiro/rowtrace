# ROWTRACE semantics — report schema 1

This is the contract implemented by `@seoshiro/rowtrace-core` 0.1.0. The browser and CLI call the same parser and comparison functions. An error throws `RowtraceError`; it never returns a partially successful report. Blocking key errors are not empty successful comparisons.

## Inputs and values

CSV uses Papa Parse 5.7.0 with an explicit comma (default) or semicolon delimiter, double-quoted fields, doubled quote escapes, and consistent LF/CRLF/CR line endings. Quoted newlines are cell content. A small dialect guard rejects bare-field quotes and nonseparator content after a closing quote, which Papa otherwise accepts permissively; Papa still performs all record parsing. CSV always preserves strings, including leading zeros. Field counts must match the header. Empty and duplicate headers are rejected; names are not trimmed. An initial UTF-8 BOM is stripped. Truly blank physical records are skipped; quoted empty values and whitespace-only records are retained. An empty CSV is invalid; a header-only CSV is an empty dataset with declared columns. No delimiter guessing or dynamic typing occurs.

JSON uses Microsoft jsonc-parser 3.3.1's SAX visitor with comments and trailing commas disabled. Its top level must be an array of flat objects. The visitor rejects nested arrays/objects and duplicate decoded property names (including escaped aliases) before overwriting values. A JSON column set is the union of row properties. Empty JSON `[]` is valid and has no declared columns. Empty property names are rejected.

JSON cells preserve string, number, boolean and null. A missing own property, `null`, and `""` differ. Reports use `{ "kind": "missing" }` and `{ "kind": "value", "value": ... }` in field changes. Raw row objects omit missing properties. Keys such as `__proto__`, `constructor` and `prototype` remain ordinary data, stored in null-prototype records and Map indexes.

Numbers use JavaScript IEEE-754 binary64. Nonfinite numbers and unsafe integer results are rejected with `UNSAFE_NUMBER`. Negative zero canonicalizes to zero. Decimal rounding follows JavaScript Number, not arbitrary decimal arithmetic; supply exact money and large identifiers as strings. Unicode compares exact code units without NFC/NFKC normalization. A UTF-8 adapter must reject invalid byte sequences before calling the string API; adapters use fatal decoding.

## Keys and comparison

The caller explicitly chooses one or more ordered `keyColumns`. Every row must have every key component; missing, null and empty-string components block comparison. Boolean false, numeric zero and whitespace strings are valid exact keys. A missing key column blocks a declared/nonempty dataset. A truly empty `[]` has no key columns to validate and may be compared to a populated dataset or another `[]`.

Keys encode arrays of `[typeof value, value]` tuples as JSON. Types, component boundaries and escaped delimiters cannot collide. A duplicate after the selected normalization blocks the whole comparison, reporting side and the first conflicting 1-based data-row positions. The engine never guesses a pairing or selects an arbitrary duplicate.

`trimStrings` and `ignoreCase` default to false. When enabled, normalization applies to keys and all compared string cells on both sides. Case conversion is JavaScript's locale-independent `toLowerCase`; it is not linguistic case folding. Raw source values remain in report rows. Normalization can make distinct raw keys collide, which still blocks comparison. String normalization never changes column names or scalar types.

`ignoreColumns` names must exist on at least one side, cannot duplicate, and cannot contain key columns. Ignored fields stay in raw report records, configuration and schema information. They do not contribute to changed cells, changed row status or `hasChanges`. A schema-only change to an ignored field therefore has `hasChanges:false`, while remaining explicitly visible under `columns`.

Matched rows compare the union of nonignored columns by both presence and normalized typed value. One or more differing fields produce one changed row. Added/removed rows have no matched-field `changes`; their complete available side is retained. `changedCells` counts changes only in matched rows. Added/removed column names are separately reported. Column order and row order are not changes. A nonignored schema change counts in `hasChanges` even for two header-only datasets with zero rows.

Successful counts satisfy `before = unchanged + changed + removed` and `after = unchanged + changed + added`. A change is a fact, not a business failure. CLI `--fail-on-change` supplies policy.

## Determinism and reports

`schemaVersion` is the string `"1"`, distinct from package version. No timestamp, filename, source row number, locale or elapsed time enters a successful machine report. Columns and object keys sort by JavaScript code-unit order, without locale collation. Rows sort by their encoded typed key. Key component order follows the explicit config. Ignores sort canonically. The serializer emits compact JSON followed by one LF. The same data/config produce identical bytes despite input row/property order or UI language.

Datasets and reports returned by core are immutable. Serializers accept only reports returned by this module instance's `compareDatasets`; arbitrary JSON objects and structured clones are not an import API. The browser exports inside the worker that owns the report. Consumers can inspect or parse canonical JSON independently. HTML uses the same report, escapes every untrusted text value, creates no cell URLs, uses no scripts/network resources, and is readable offline. HTML labels may use EN/RU/KK; the machine schema never changes with locale. KK has no professional language review.

## Resource contract

| Limit | Hard maximum |
| --- | ---: |
| Each decoded UTF-8 source | 16 MiB |
| Rows per dataset | 20,000 |
| Union columns per dataset | 100 |
| Rows × union columns per dataset, including missing cells | 1,000,000 |
| One decoded string cell | 64 KiB UTF-8 |
| One column name | 1,024 UTF-8 bytes |
| Encoded typed composite key | 4,096 UTF-8 bytes |
| Configuration JSON | 16 KiB UTF-8 |
| Canonical JSON or generated HTML report | 32 MiB UTF-8 |

Limits can be lowered through API/config, never increased beyond hard caps. Values are positive safe integers. Source byte caps apply before parsing; row/cell/column caps apply during parser callbacks. Token decoding can allocate one token before its value/header check, but it is bounded by the source cap. File adapters additionally bound raw reads before decoding. Direct hand-built datasets are validated and copied; their maxBytes budget counts UTF-8 JSON bytes of rows. Parsed datasets retain their original source byte count for later lower-budget comparisons.

Report row data is budgeted as it is built and the envelope is checked before completion. Serialization checks cumulative UTF-8 output before retaining each fragment. HTML may exceed its output budget even when the smaller JSON report fits; this is an explicit export error and never a truncated success. Pagination changes presentation, not processed counts. The actual measurements and supported environment are recorded separately in PERFORMANCE.md; these caps do not promise equal speed on all devices.

## Execution and complexity

Parsing, validation and matching are synchronous. `Control.isCancelled` is checked between parsed values/rows and index/diff steps. A cancellation callback can read an already-set or shared flag; an event-loop callback cannot interrupt a synchronous call. Browser and CLI workers terminate to implement real responsive cancellation. A new job gets a new worker/job identity, and stale replies must be rejected by adapters.

For N total rows and C columns, validation/matching costs O(NC), with O(N log N) key sorting and column sorting. Indexes hold references to immutable input rows; report rows retain those references and changed-cell objects. Memory is O(input + keys + differences + bounded output), not streaming/O(1). No network, filesystem, storage, React or DOM integration is implemented in core.
