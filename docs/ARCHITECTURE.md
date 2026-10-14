# Architecture

This document describes the implemented source layout. Test/release status belongs in `VALIDATION.md` and `RELEASE.md`; design intent alone is not evidence of a passing deployment.

## One semantic engine

`packages/core` is the reusable ESM TypeScript library. `parse.ts` parses CSV with Papa Parse and visits strict JSON with jsonc-parser; `validation.ts` enforces scalar, object, configuration, and resource contracts; `compare.ts` indexes explicit typed keys with Maps; `serialize.ts` writes canonical versioned JSON. `html.ts`, exported as `@seoshiro/rowtrace-core/html`, is an optional inert HTML renderer. Core imports no React, filesystem, or networking API. Browser and CLI call the same parser, comparator, and report serializers.

CSV values remain strings. JSON accepts an array of flat objects whose values are strings, finite safe integers or finite fractional numbers, booleans, or null. Missing properties remain missing. Nested values, duplicate JSON properties, unsafe integers, duplicate headers, inconsistent CSV row width, and malformed inputs fail. A present cell is represented separately from an absent cell; null and empty string remain distinct. Typed tuples encode composite keys without separator collisions. Missing/null/empty key components and duplicates after optional normalization block the entire comparison.

Reports use `schemaVersion: "1"`, deterministic row/key and serialization ordering, explicit resolved settings, schema differences, summary counts, full rows and cell changes. No locale or timestamp enters canonical JSON. Parsed datasets and issued reports are immutable. Serializers accept only reports issued by this runtime, not arbitrary deserialized JSON. This prevents a caller bypassing report validation by asserting a TypeScript type. The exported public types are not runtime trust boundaries by themselves.

## Browser ownership and messages

`apps/web/src/App.tsx` renders bounded projections and interaction state. `worker.ts` owns decoded source text while parsing, complete datasets, comparison indexes and full reports. File objects are sent to the worker; full source text and report objects are not copied into React state. The worker returns a three-row preview, a 50-row page, a summary, or one selected record. Search/filter/sort scans the report in the worker. HTML is dynamically imported only for HTML export. The resulting bounded Blob is downloaded through a temporary object URL that is revoked.

`protocol.ts` checks request/response shapes at runtime. Job generations invalidate messages from a replaced worker; page/detail request counters reject older responses. A new input/reset/cancel terminates the worker, releases its heavy data, and invalidates the generation. Termination is necessary because a synchronous parser cannot receive a cooperative cancel message until it yields. Cancellation of a worker is distinct from hiding a spinner.

Demo fixtures are fixed same-origin static assets. No selected file is uploaded. Only the language preference is stored in localStorage. Data and reports stay in memory until reset, navigation, or explicit local download. Browser extensions, a compromised browser/device, or modified site code are outside this architecture's isolation boundary.

## CLI process and output

`packages/cli` supplies the `rowtrace` executable. Argument/config parsing is strict. The I/O layer bounds bytes while reading streams, checks fatal UTF-8 decoding, then holds the bounded decoded inputs in memory. This is bounded file reading, not a fully streaming comparison algorithm. A Node worker runs the same core and can be terminated on SIGINT while synchronous parsing/comparison/export is busy.

An explicit output path is checked against source and config paths, symlinks, and hard-link aliases. Output is first written to an exclusive temporary file in the destination directory, synchronized and closed, then committed by no-clobber link or explicit-force rename. Failure/cancellation cleans the temporary file. Standard output cannot be rolled back after bytes have been written; it is not transactional. Exit codes are 0 success, 1 changes with fail-on-change enabled, 2 validation/I/O failure, and 130 interruption.

## Resource and distribution boundaries

Default limits: 16 MiB UTF-8 input per file, 20,000 rows per side, 100 columns per side, 1,000,000 cells per side, 64 KiB per value, 1 KiB per header, 4 KiB encoded key, 16 KiB config, and 32 MiB serialized report/export. Callers may lower limits, not raise them. A schema union can contain up to 200 columns. Report construction and export enforce separate budgets; a valid JSON report may still be too large as HTML. Failure is explicit rather than a silently truncated report. Input limits are rejection bounds, not peak-memory guarantees; strings, indexes, report references, export buffers and serializer token arrays coexist. See measured performance evidence for actual tested shapes.

Core and CLI are independently packable MIT packages with declarations and runtime dependencies. They are ESM packages; no CommonJS build is advertised. CLI installs the matching core version. `npm pack` plus an isolated consumer is the release proof; a workspace import is insufficient. Registry publication requires independent access and is not implied by a successful tarball.

The production app consists only of generated static assets. GitHub Pages serves them; CI uses public standard runners, lockfile installation, least-privilege job permissions, and pinned action commits. The deployment is tied to the verified source commit. Hosting cost assumptions and policy limits are documented separately in `COSTS.md`.
