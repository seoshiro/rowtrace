# ROWTRACE CLI

Compare two local CSV or flat JSON snapshots by an explicit unique key. The CLI uses the same `@seoshiro/rowtrace-core` package as the browser.

This 0.1.0 release is ESM and requires Node.js 22.12 or newer. Until npm publication is confirmed, install the **two release tarballs together**:

```sh
npm install ./seoshiro-rowtrace-core-0.1.0.tgz ./seoshiro-rowtrace-cli-0.1.0.tgz
npx --no -- rowtrace before.csv after.csv --key sku --format json
npx --no -- rowtrace before.csv after.csv --key sku --fail-on-change
npx --no -- rowtrace before.csv after.csv --key sku --format html --output report.html
npx --no -- rowtrace --key sku -- --before.csv --after.csv
```

`--format` is the **report** format: `json` (default), `html`, or fixed numeric `text` summary. Input format is inferred independently from each extension, or explicitly set with `--input-format csv|json`. Comma CSV is default; use `--delimiter semicolon` for semicolon CSV. Fields remain strings in CSV. JSON scalar types and missing/null/empty remain distinct. Duplicated or missing keys block the report.

Use `--config settings.json` for declarative comparison settings, for example `{"keyColumns":["sku"],"ignoreColumns":["updated_at"]}`. `--key`, `--ignore`, `--trim`, and `--ignore-case` override corresponding settings. Config may lower the documented limits; it cannot raise them. Repeated JSON properties and unknown settings are rejected. No JS configuration or expressions execute. See `--help` for the exact options. URLs, UNC paths and stdin are intentionally unsupported.

Exit codes: **0** successful comparison (even with changes), **1** differences with `--fail-on-change`, **2** invalid input/configuration, duplicate/missing key, or I/O error, **130** SIGINT interruption. Schema changes count for `--fail-on-change`. JSON stdout has only JSON; diagnostics use stderr and escape terminal control characters. All output is uncoloured, so `NO_COLOR` is supported without special behavior.

Reads enforce the 16 MiB limit before and during incremental UTF-8 decoding; invalid UTF-8 is rejected. Parsing/comparison/export execute in a worker thread. SIGINT terminates that worker, including synchronous parsing. The bounded input and result are held in memory; this is not an O(1)-memory streaming diff.

Reports contain source values. Treat them as sensitive when using non-demo inputs. File output is written to an exclusive temporary file, synced, then committed atomically. Existing reports require `--force`. Input paths, canonical aliases and hardlink aliases cannot be overwritten, even with `--force`; symbolic link output is rejected. Temporary files are removed on handled errors/cancellation. Forced replacement uses filesystem rename; protections do not defend against a malicious concurrent local actor controlling the output directory or abrupt process/power loss.

Windows paths with spaces, Unicode and flag-like basenames are tested. Windows `child.kill('SIGINT')` forcibly terminates a child and does not simulate console Ctrl+C; the Windows automated signal test dispatches Node's SIGINT event to the actual executable. POSIX CI tests a real SIGINT after the handler is ready. A physical Windows console Ctrl+C test is not claimed.

Project, semantics and security: [github.com/seoshiro/rowtrace](https://github.com/seoshiro/rowtrace).
