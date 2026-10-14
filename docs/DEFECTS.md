# Defect ledger

This ledger records reproduced product defects. Harness mistakes and unavailable environments are not counted as product defects. Status requires verification of the original reproduction and related behavior; a fix alone does not establish PASS.

Production browser execution exposed the WebKit export defect below. The earlier code review also found concrete state/validation failures that were corrected before the broad run. No finding here is a claim of an exploitable account compromise.

| ID | Priority | Environment / source | Reproduction | Expected / actual | Cause / fix | Regression evidence | Status |
|---|---|---|---|---|---|---|---|
| ENV-01 | Environment | Windows CUA startup | Initialize browser-control session | Expected browser control; launcher fails before opening browser with HRESULT 0x80070003 | Missing required Windows platform directory in tool launcher; app not implicated | Parent may retry after tool availability changes | BLOCKED |
| RT-01 | P1 | Initial worktree / reviewed data flow | Compare using sku, replace both files with first/second schema, choose composite key | Hidden old sku remained in config; new valid input could not compare | Clear keys and ignored columns when inputs change | Chromium, Firefox, WebKit F07→F08→F09 sequence PASS | FIXED |
| RT-02 | P1 | Initial worktree / protocol review | Valid inputs each have 100 columns, union199 | Worker response limit100 rejected valid comparison | Separate per-input and union projection limits; bounded row summaries | Chromium 199-column union, changedCells198 PASS | FIXED |
| RT-03 | P2 | Initial worktree / failure recovery | Worker fails after preview, then compare | Dead worker preview remained usable; new worker had no data | Fatal handler terminates worker, invalidates generation and clears preview/result | Chromium controlled malformed reply + fresh upload PASS | FIXED |
| RT-04 | P2 | Initial worktree / lifecycle review | Change config while asynchronous export is pending | Previous report could export after invalidation | Treat export as busy for configuration controls; generation/request guards | Storage/export failure recovery and cancellation suite PASS; source-reviewed guard | FIXED |
| RT-05 | P1 | Windows / Playwright WebKit27.2 / precommit production | Demo → Export HTML | PROCESSING_ERROR instead of HTML download; JSON succeeds | Static HTML renderer inside the lazy-created worker avoids WebKit dynamic-import incompatibility | Three-engine targeted contract PASS including actual HTML downloads | FIXED |
| RT-06 | P2 | Initial worktree / request validation review | Worker receives config with101 ignored columns and valid envelope | Invalid request silently ignored, UI remains processing | Return INVALID_CONFIG for invalid payload with usable envelope | Controlled invalid request yields INVALID_CONFIG, then demo recovers: PASS | FIXED |
| RT-07 | P2 | Windows / three browser engines | Export JSON after selecting a record | Export trigger did not regain focus after download | Restore focus to original export trigger after busy state clears | useLayoutEffect after enabled DOM commit restores trigger; Chromium/Firefox/WebKit downloads assert focus PASS | FIXED |
| RT-08 | P2 | Axe incomplete review / result | Inspect filter-group accessible semantics | aria-label on a generic div has no supported named role | Add semantic group role | Targeted axe + three-engine contract 4/4 PASS; only decorative glyph contrast remains incomplete | FIXED |

Harness corrections are not product defects: detail assertions originally matched hidden preview text as well; delimiter locator used label text including option text; language test selected a record before search intentionally cleared selection. They were corrected using semantic scopes and the actual state transition.

A full-page screenshot taken while scrolled included a deliberately offscreen fixed skip-link in the stitched document image. Recapturing at scrollTop 0 removes this capture artifact; that screenshot alone was not proof the link overlapped the live viewport. Download focus was separately verified with actual focus assertions.

Offline limitation observed: importing a new file recreates the worker, whose module may require a network fetch. In the isolated offline Chromium context this produced a visible WORKER_ERROR, not a stuck spinner. Existing loaded reports and already loaded HTML export can work offline; a first offline visit or new worker availability is not promised. No PWA/service worker is shipped.
