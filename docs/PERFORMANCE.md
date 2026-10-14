# Performance evidence — ROWTRACE 0.1.0

Measurements are synthetic laboratory results, not a promise for every device or dataset. The supported maximum is a combination of limits, not permission to multiply every maximum together. No field Web Vitals dataset exists; p75 LCP/INP/CLS compliance is **not established**.

## Reproduction and identity

```sh
npm ci
npm run build
node scripts/benchmark.mjs
node scripts/bundle-sizes.mjs
# Start the production preview separately, then:
node scripts/browser-performance.mjs
```

The Node benchmark uses the built public core and HTML entry. Source data comes from `fixtures/qa/generate.mjs::largePair`, deterministic seed 82741. Only synthetic data is used. `evidence/performance-baseline.json`, `performance-optimization.json`, and `performance-core.json` retain every warmup and measured run, input/output sizes, actual outcome, memory samples and code fingerprint. Initial measurement preceded the first Git commit (`commit: null`); that is not represented as an exact release-SHA run. The final stable benchmark hashes its executable source before and after and records `sourceStableDuringRun: true`, hash `30dbd89a87043c8d2da4950a762107cb3b9ddd38d728fe9543e6ea18e66369ec`. Release/CI SHA is recorded separately in RELEASE.md.

Host: Windows x64 build 10.0.26200, AMD Ryzen 5 7535HS, 12 logical CPUs, 16,438,312,960 bytes physical RAM (15.31 GiB), Node v24.18.0. Other host applications were uncontrolled. Benchmarks run one child process at a time, with one warmup followed by five measured runs per scenario. Explicit GC runs before each iteration. Filesystem reads are sequential, with uncontrolled and likely warm OS cache. There is no cold-disk claim.

## Core stages and results

Each pair has 3 columns and 1,000, 10,000 or 20,000 rows per side. Modes are identical (0% changed), sparse (10%), mass (100%), long (100%, one 500-character value per row), and duplicate (last after-key repeats the first, comparison must reject). The latter has no valid change fraction or export. Exact file bytes are recorded per case in raw evidence; 20k long is about 10.3 MB per side and its canonical JSON report is 25,811,488 bytes.

All durations below are median milliseconds from the stable run. Export timings render strings in memory, not filesystem writes. Total includes read, parse, compare and both exports; its median is computed independently, so it need not equal the sum of stage medians.

| Rows | Mode | Read | Parse + structural validation | Key validation + index + diff | JSON | HTML | Total |
|---:|---|---:|---:|---:|---:|---:|---:|
| 1,000 | identical | 1.50 | 6.03 | 10.30 | 10.78 | 14.08 | 39.12 |
| 1,000 | sparse | 1.52 | 5.59 | 12.49 | 10.93 | 14.80 | 47.59 |
| 1,000 | mass | 1.38 | 6.58 | 12.10 | 17.71 | 13.90 | 55.98 |
| 1,000 | long | 2.15 | 46.68 | 40.39 | 29.66 | 32.89 | 153.60 |
| 1,000 | duplicate | 1.15 | 3.85 | 3.86 | — | — | 9.44 |
| 10,000 | identical | 1.87 | 32.95 | 84.53 | 69.64 | 101.95 | 295.31 |
| 10,000 | sparse | 2.32 | 33.56 | 81.76 | 79.75 | 103.63 | 308.76 |
| 10,000 | mass | 2.13 | 29.75 | 77.22 | 103.66 | 90.12 | 300.93 |
| 10,000 | long | 11.21 | 432.71 | 394.25 | 349.23 | 277.00 | 1,458.22 |
| 10,000 | duplicate | 1.87 | 30.43 | 39.07 | — | — | 71.62 |
| 20,000 | identical | 2.61 | 75.40 | 177.04 | 172.38 | 242.08 | 680.54 |
| 20,000 | sparse | 2.76 | 77.56 | 186.35 | 167.83 | 254.00 | 690.46 |
| 20,000 | mass | 2.97 | 75.81 | 213.05 | 241.59 | 248.35 | 779.69 |
| 20,000 | long | 15.96 | 875.34 | 661.05 | 505.38 | 460.93 | 2,530.07 |
| 20,000 | duplicate | 2.64 | 46.81 | 55.77 | — | — | 104.15 |

The public API combines parsing with structural validation, and comparison with key validation/indexing/diff. There are **no independently measured timings for these internal stages**. Splitting combined values into invented measurements would be misleading. Raw evidence retains an empirical nearest-rank p95 for each stage; with five measurements this is merely the observed maximum, not a reliable tail estimate or a field percentile. For example, 20k long total has median 2,530.07 ms, empirical p95/maximum 2,821.46 ms, and observed range 2,458.87–2,821.46 ms (n=5).

## Measured optimization and memory

The initial JSON serializer retained an array of every tiny punctuation/token fragment until joining. A measured change accumulates canonical row-sized chunks instead. Deterministic serialization tests remained passing. On the same host/fixtures, 20k mass JSON median changed from 358.11 ms initially to 241.59 ms in the final run; 20k long JSON changed from 581.16 to 505.38 ms. Maximum **sampled** process heap across long-case iterations changed from 447.04 MiB to about 388 MiB. These samples include other stages and retained data, not isolated serializer allocation or peak heap.

The final long-case total was 2.53 s versus 2.39 s initially; the final parser includes an additional CSV correctness guard, and uncontrolled host scheduling/GC also affects timings. We do not claim an overall improvement for every case. `performance-optimization.json` preserves the intermediate export experiment; a correctness build may have overlapped that run, so the final fingerprint-checked run is authoritative.

Memory instruments: `process.memoryUsage()` at stage boundaries (heapUsed, heapTotal, RSS, external, arrayBuffers), plus `process.resourceUsage().maxRSS` high-water KiB. Stage snapshots miss transient peaks, and RSS includes V8/runtime/allocator pages and cannot identify a single object leak. A child process is fresh per scenario; warmup and subsequent iterations deliberately share that process. Explicit GC and a final post-case GC sample are recorded. This is not a browser worker memory measurement.

## Limits and practical consequences

Default per-input limits: 16 MiB UTF-8, 20,000 rows, 100 columns, 1,000,000 row×column cells; 64 KiB per string, 1 KiB header, 4 KiB canonical key, 16 KiB configuration; report/export 32 MiB. Input bytes alone do not predict memory: typed objects, indices, before/after records, report data, JSON and HTML all add overhead. A 20k three-column benchmark does not validate 20k×100 cells (which exceeds the cell budget), every legal long-string combination, or a phone's capacity. Some valid input combinations can exceed the report budget and must fail explicitly. No million-row claim is made. See VALIDATION.md for exact/plus-one rejection fixtures.

## Bundle and browser laboratory

Bundle evidence is generated from production files by `scripts/bundle-sizes.mjs`: each asset has bytes, gzip level-9 estimate and SHA-256; main/worker static import closures, lazy HTML, CSS and fonts are counted separately. Core+runtime dependencies are independently bundled/minified using the installed Rolldown. Gzip estimates are local and are not a claim about hosting response compression. Browser request evidence is required to confirm lazy fetching, separately from artifact inventory.

Browser laboratory results will be appended after the production build passes its first risk-based QA run. Until then, cancellation latency, CPU-throttled responsiveness, memory reset behavior and lab Web Vitals are **not claimed verified**. The initial budgets remain: main ≤200 KiB gzip, core+runtime ≤50 KiB gzip, visible cancellation around 200 ms in the tested scenario. Worker code is counted separately. No physical mobile device or field p75 claim is made.
