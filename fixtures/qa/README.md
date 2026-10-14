# Synthetic QA fixtures

Run `node fixtures/qa/generate.mjs` to reproduce the small input pairs. `--large` also writes F15 datasets (1,000 / 10,000 / 20,000 rows); `largePair(count, mode)` exports the fixed-seed generator for tests and benchmarks. It has no core dependency. Modes: sparse (10% changed), identical, mass (100%), long (500-character values, 100%), duplicate (last key repeats first).

F01/expected.json and expected.json are manually specified oracles, not output from the implementation. F01 is deliberately a compact semantic golden: it checks counts, keys, exact CSV string prices and changed fields independently of report serialization.

F01 regular changes; F02 row/column permutation; F03 multiple fields; F04 duplicate keys; F05 missing/empty keys; F06 empty; F07 BOM/UTF-8/CRLF; F08 multiline quoted CSV; F09 composite collision; F10 types/presence; F11 schema/duplicate header; F12 malformed/unsupported values; F13 inert hostile text/prototype-sensitive fields/ANSI/formula; F14 bounded generation in tests; F15 fixed-seed volume.

No fixture comes from a personal or production export. Formula-like strings are JSON data: ROWTRACE does not export CSV.
