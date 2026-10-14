# Security boundaries and review

Reviewed 2026-10-14 against the implementation in this repository. This is a scoped engineering review, not a penetration-test certification or a claim that compromise is impossible. All test payloads are synthetic. Release-wide test results and exact commit evidence belong in `VALIDATION.md` and `RELEASE.md`.

## Assets, attackers, and trust boundaries

The main assets are selected local files, accurate comparison results, report contents, local CLI files, and the integrity of published code. Treat CSV/JSON, headers, keys, configuration, filenames, and worker messages as untrusted. Threats include malicious cell text, malformed or oversized input, ambiguous keys, prototype-property names, interrupted output, and altered dependencies/workflows.

There is no application server, upload endpoint, account, authentication secret, database, paid API, telemetry, remote report storage, or deployment credential in the browser bundle. The browser loads its own static assets and explicitly requested synthetic demo fixtures. It does not send selected file contents to a service. The CLI accepts local file paths and rejects URLs, stdin and UNC forms. A mapped network drive or filesystem mount is an operating-system concern; lexical path checks do not prove physical disk locality.

This design reduces exposure but does not protect against a compromised OS/browser, malicious extension, compromised repository maintainer, modified dependency, or attacker controlling the user's output directory. Reports intentionally contain compared values; downloaded files are sensitive if the user's source data is sensitive. Language preference is the only localStorage item.

## Controls in the implementation

| Boundary | Control | Practical limit |
| --- | --- | --- |
| Parsing | Explicit CSV delimiter, no dynamic CSV typing, strict flat JSON visitor, duplicate property/header rejection, fatal UTF-8 decoding in browser/CLI | Core receives JavaScript strings; it cannot attest the encoding of bytes a caller already decoded |
| Resource use | Lower-only byte/row/column/cell/value/key/config/report limits, early file-size rejection, incremental parsing checks | Limits bound accepted data, not total RAM; a bounded input can allocate several copies/indexes; see performance measurements |
| Object properties | Own-property checks, null-prototype parsed records, plain data-object validation, Map indexes | No generic merge of arbitrary input into application configuration |
| Key identity | Typed tuple keys, explicit selection, missing/null/empty rejection, duplicate rejection after normalization | A blocked comparison has no successful partial diff |
| Export input | Serializers accept only immutable reports issued by the core in the current runtime | Arbitrary imported report JSON is unsupported; this is intentional |
| UI text | React text rendering, no raw-HTML insertion of file content | A compromised build can defeat client controls; deploy integrity remains necessary |
| HTML export | Escape data in every text context; no scripts, links, images, forms or input-derived attributes; restrictive CSP | Report CSS is fixed inline style. CSP is defense in depth, not an alternative to escaping |
| CLI output | Canonical path checks, symlink rejection, hard-link alias detection, exclusive random temp file, recheck before commit, no-clobber by default | Concurrent hostile filesystem mutation is not fully prevented; stdout cannot be rolled back |
| Cancellation | Node/browser worker termination, AbortSignal for CLI I/O, generation/request checks in UI | Synchronous core callers must supply appropriate execution isolation themselves |
| Hosting | Static assets only, no tokens/client API keys, same-origin CSP, no paid resources | Meta CSP cannot enforce all HTTP-only directives such as frame-ancestors; no claim of complete anti-framing protection |

Spreadsheet formula prefixes (`=`, `+`, `-`, `@`) remain literal source data. ROWTRACE exports JSON and inert HTML, not CSV for spreadsheet execution. JSON preserves these strings; consumers who subsequently convert output to a spreadsheet must apply their own spreadsheet-safe export policy.

## Independent audit checks actually executed

The review used source inspection and targeted Node scripts on Windows with Node 24.18.0. An automated report test used Playwright 1.64.0 driving an existing Chromium headless 153.0.8010.12 binary. This was browser automation, not manual exploratory testing, and not a physical mobile device.

- Malicious header and value included an external image URL, an `onerror` handler and a script tag. The generated report was opened in an offline browser context. Literal attack text remained visible; DOM contained zero scripts, images, links or event attributes; the execution marker was absent; zero network requests were observed.
- HTML export budgets of 1, 100 and 2,000 bytes rejected the synthetic 3,063-byte report with `LIMIT_EXCEEDED`, rather than emitting truncated output.
- A JSON record with `__proto__` and `constructor` fields survived comparison/serialization as ordinary data, and the global object prototype remained unmodified.
- A direct external Dataset containing multibyte text that exceeded a lowered 64-byte limit now rejects with `LIMIT_EXCEEDED`. This reran a concrete audit failure after the core owner fixed UTF-8 accounting.
- Strict core configuration parsing rejected duplicate `keyColumns` properties.
- The final web protocol accepted a genuine core result with 199 union columns and 198 changed fields, accepted its selected record, rejected a malformed Cell discriminant, and rejected a 32 MiB + 1 byte export Blob. This targeted check transpiled and imported the actual `protocol.ts` with the installed TypeScript compiler.

These checks supplement the test suite; they do not establish every browser, payload size, race, or platform behavior. No production attack traffic, real user data, credential extraction, or account configuration changes were used.

## Findings and follow-up

Audit findings sent to implementation owners included UTF-8 byte accounting for external Datasets, lowered-byte-limit enforcement on already-parsed datasets, complete report-envelope accounting, CSV delimiter options incorrectly forwarded to JSON, duplicate CLI config properties, UNC paths, nontransactional stdout wording, incomplete worker response validation, and cancellation/stale-response behavior during export. Core and CLI owners reported fixes; the targeted UTF-8 and HTML checks above were rerun independently. Remaining implementation/test status must be recorded in release validation, not inferred from this list.

The final web source review confirmed Cell discriminant checks, the export Blob cap, finite nonnegative elapsed time, and separate 100-column per-side / 200-column union bounds. Export is included in the busy state, offers Cancel, and disables configuration/file controls. Reset/drop terminate and replace the worker generation. Filter/query and configuration invalidation invalidate outstanding detail requests. The protocol checks above were executed independently; full cancellation timing and live-browser coverage remain the responsibility of release validation. No unresolved critical/high finding was identified in this scoped review; that does not imply exhaustive vulnerability coverage.

## Supply chain and maintenance

Core's runtime parsing dependencies are Papa Parse 5.7.0 and jsonc-parser 3.3.1; CLI depends on core; React/React DOM 19.3.0 support the UI. Their installed metadata declares MIT. Both package-local MIT licenses are present. Inspection of lockfile version 3 found no installed registry package entry missing its resolved location or integrity hash. TypeScript 6.0.3 and Playwright 1.64.0 are development tools with Apache-2.0 metadata. This is an inventory, not a claim that dependencies have no vulnerabilities. The release owner reported zero findings from runtime and full npm audit and from a scoped heuristic secret scan of 99 files; record the final rerun and actual scope separately in validation rather than treating the heuristic as proof that no secret can exist.

Workflows use full action commit IDs, standard hosted runners, read-only default permissions, and Pages write/OIDC only in the deployment job. Fork pull requests do not receive deployment permission. No npm publish token is added when registry publication is unavailable. Prefer reviewed lockfile/action updates and rerun parsing, inert-report, packed-consumer and browser checks when these boundaries change. See `COSTS.md` for free-hosting conditions and the distinction between this project and unrelated account billing.
