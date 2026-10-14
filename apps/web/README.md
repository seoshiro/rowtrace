# ROWTRACE web

React + TypeScript + Vite static workbench. The public path is `/rowtrace/`.

From the repository root, after installing the locked dependencies and building core:

```sh
npm run build -w @seoshiro/rowtrace-web
npm run preview -w @seoshiro/rowtrace-web -- --port 4173
```

Open `http://127.0.0.1:4173/rowtrace/`. Set `ROWTRACE_COMMIT` when building a release; its value is emitted in `version.json` and the footer. This stamp is provenance supplied by the build, not an independent signature.

## Data lifecycle

- React holds selected `File` handles, settings, three-row previews, one page of at most 50 record summaries, and at most one full record detail.
- The dedicated worker reads UTF-8, calls the public core parser and comparison API, and owns complete datasets and reports. UI filtering, ordering and pagination query that retained report without parsing again.
- List projections contain a 500-character key preview and up to three shortened field names with the full field count. Record details and exports retain original values.
- New input and Reset terminate the old worker. Cancel also terminates it, increments the generation, and clears result state. Preview is required again because cancellation deliberately discards the worker's datasets.
- Replies need both a matching job generation and a valid discriminated payload. Page and detail replies additionally use request IDs; a late detail cannot reopen after changing a filter.
- Fatal worker failures clear the now-unavailable preview/result and permit a new import. A failed export retains the existing valid result when the worker remains usable.
- Blob download URLs are revoked after handoff, on failure, and on component cleanup. Export completion means the browser received a download request; it does not prove that a person saved the file.

## Privacy and delivery

The only application fetches are same-origin static demo files, requested after a demo click, plus browser-loaded assets. Files, filenames, keys and reports are not sent over the network. The only persisted preference is `rowtrace.language`; storage failure does not block analysis. No analytics, backend, authentication, service worker or paid service is used.

The small HTML renderer is included in the worker bundle because dynamic import within a module worker failed in the tested WebKit runtime. The worker is loaded on first processing, outside the initial main bundle. Reports remain in that worker instead of being copied to the UI for rendering. The downloaded report is self-contained. First entry while offline and creating a new worker while offline are not promised; existing completed reports can be exported without the network. Static hosting can observe requests for application assets and IP addresses.

The production HTML has a meta CSP for its real assets and worker. Meta CSP does not provide HTTP-only controls such as `frame-ancestors`. User values are rendered as React text, never HTML. Fonts use the installed system stack; no font binaries or remote font requests are shipped.

EN, RU and KK catalogs cover the workbench. Kazakh copy has not had professional native-language review. The workbench uses semantic tables, native inputs and buttons, visible keyboard focus, a live status region, and a sequential detail view below 760 CSS px. Test evidence and actual browser/device limitations belong in the root `docs/VALIDATION.md`.
