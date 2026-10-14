# Validation ledger

All inputs below are synthetic. Playwright is browser automation, not manual exploratory testing. Viewports are CSS pixel configurations on Windows, not physical phones or Safari/iPhone verification. PASS applies only to the recorded source state and command; later changes require relevant checks again.

## Completed production run

On 2026-10-14 at 14:56:14 UTC, `npx playwright test` passed **40/40** cases in **43.9 seconds** with **0 skipped, 0 unexpected, 0 flaky, 0 retries**: Chromium 30, Firefox 5, WebKit 5. Actual Windows engines: Chromium 156.0.8078.4, Firefox 157.0, WebKit 27.2. [Compact machine evidence](../evidence/browser-validation.json) records every case, durations, browser versions, and SHA-256 hashes for the exact core/web source, fixtures and production assets. This run preceded the integration commit; RELEASE.md maps the frozen source to its release SHA and subsequent CI result.

That full-run build was `index-CZItvzwB.js`, `worker-CLEdIp-8.js`, `index-Cw4W7sxe.css`. The full suite followed a targeted 6/6 pass for corrected WebKit HTML export, download focus, language retention, invalid worker request diagnosis and offline recovery. A later 2/2 layout-only run recaptured screenshots at scrollTop 0; it changed only screenshot capture, not application code. [Desktop initial](../evidence/ui/initial-1440.png), [desktop result](../evidence/ui/result-1440.png), [320px initial](../evidence/ui/initial-320.png), [320px result](../evidence/ui/result-320.png) contain synthetic data only.

Production tests also cover the 199-column union of two individually valid 100-column files, a value exactly 64 KiB versus one byte above, and malformed worker envelopes. All were checked through the actual production worker boundary. No production QA hook is shipped.

Review of axe's **incomplete** results found one semantic issue even with zero violations: a labeled generic filter div. It was changed only to `role="group"` (RT-08); targeted post-change axe + three-engine contract checks passed **4/4 in 8.9 seconds**, evidence [axe-validation.json](../evidence/axe-validation.json), updated main asset `index-BGjeNMHE.js`. The remaining incomplete contrast checks refer solely to decorative `aria-hidden` glyphs beside explicit text controls/statuses; they do not carry required information. No rule was excluded. Exact-release CI runs the full suite again after this semantic-only markup change; earlier performance figures retain their original artifact fingerprints.

## Baseline

- Host: Windows, local project workspace. Node/npm versions and exact release SHA are recorded in RELEASE.md.
- Playwright 1.64.0; local project browser binaries in `.tools/ms-playwright`.
- Engine projects: Chromium (full risk suite), Firefox and WebKit (cross-engine contract suite).
- Production preview: `http://127.0.0.1:4173/rowtrace/`. Build is required before tests; no development server is used.
- Synthetic fixture definitions: [fixtures/qa](../fixtures/qa/README.md). Expected results are manually specified independently of the core.
- Current evidence paths are generated locally under `test-results/` and `playwright-report/`. They are ignored by Git; concise final results are copied here only after execution.

## Automated checks

| ID | Environment | Input / action | Expected | Actual | Status | Source state | Evidence |
|---|---|---|---|---|---|---|---|
| Q00 | Windows / Node | Generate F01–F13 from fixed synthetic definitions | Small independent fixtures | Generator exit 0 | PASS | Initial worktree, before release commit | `node fixtures/qa/generate.mjs` |
| Q01 | Windows / ESLint | Lint QA files | No lint findings | Exit 0 | PASS | Initial worktree | `npx eslint fixtures/qa tests/e2e playwright.config.ts` |
| Q02 | Windows / TypeScript strict | Typecheck QA including config | No TS errors | Exit 0 | PASS | Initial worktree | `npx tsc -p tests/e2e/tsconfig.json` |
| Q03 | Production / three engines | F01 golden, details, filters, JSON/HTML | Correct counts and exact string prices | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/contract.spec.ts` |
| Q04 | Production / three engines | CSV import, duplicates, correction | Blocking diagnostic, successful recovery | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/contract.spec.ts` |
| Q05 | Production / three engines | F07/F08/F09/F10 | Unicode/quotes/composite keys/types preserved | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/contract.spec.ts` |
| Q06 | Production / Chromium | F13 XSS/prototype names, exported HTML offline | Inert text, no unexpected requests | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/security.spec.ts` |
| Q07 | Production / Chromium | Canary in input, inspect requests/storage/URL, refresh | No canary transmission/persistence; reset on refresh | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/security.spec.ts` |
| Q08 | Production / Chromium + axe | Initial/result/blocking diagnostics | Zero axe violations; incomplete checks separately reviewed | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/security.spec.ts` |
| Q09 | Production / Chromium | Storage denied, createObjectURL failure | Core flow continues; export can retry | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/security.spec.ts` |
| Q10 | Production / Chromium | Export already-loaded report offline; new worker failure then online recovery | Inert standalone HTML; explicit worker failure; recovery | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/security.spec.ts` |
| Q11 | Production / Chromium | F12 malformed input, file above 16 MiB | Concrete failure, no partial success, recovery | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/lifecycle.spec.ts` |
| Q12 | Production / Chromium | 125 rows, pages/sort then replace input | Correct page boundaries; stale report invalidated | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/lifecycle.spec.ts` |
| Q13 | Production / Chromium | Controlled first-job delay, cancel, injected stale completion | Worker terminated; newer result survives | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/lifecycle.spec.ts` |
| Q14 | Production / Chromium | Block worker asset, retry | Visible recoverable error | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/lifecycle.spec.ts` |
| Q15 | Production / Chromium | Repeated reset/download and separate context | Object URLs revoked; contexts isolated | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/lifecycle.spec.ts` |
| Q16 | Production / Chromium | 320,360,390,430,768,1280,1440,1920 widths + landscape | No page overflow; details/export/error accessible | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/layout.spec.ts` |
| Q17 | Production / Chromium | RU/EN/KK switch with search and selection | State/report retained | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/layout.spec.ts` |
| Q18 | Production / Chromium | Keyboard activation, reduced motion, long values | Usable controls, focus and full content | Passed production assertions; see recorded cases | PASS | Frozen release source; SHA-256 in evidence | `tests/e2e/layout.spec.ts` |

## Manual and environment boundaries

| ID | Environment | Input / action | Expected | Actual | Status | Source state | Evidence |
|---|---|---|---|---|---|---|---|
| M01–M20 / exploratory | CUA local browser control | Dedicated real browser operation and pixel review | Independent exploratory pass | Parent reports initialization error: MXC launcher required Windows platform directory missing, HRESULT 0x80070003; no browser opened by CUA | BLOCKED | Before release | Parent tool initialization evidence; retry only if supported environment becomes available |
| A04 | Native desktop browser zoom | True 200% browser zoom | Usable controls/text | Not executed; CSS/device scale emulation is not equivalent | NOT TESTED | Pending | None |
| A06 | Real screen reader | Spoken headings/errors/completion | Usable announced flow | No real screen reader session run | NOT TESTED | Pending | Axe/accessibility tree cannot substitute |
| M19 | Native OS file picker | Open picker then cancel | Current input retained | Playwright setInputFiles does not prove real dialog cancellation | NOT TESTED | Pending | None |
| Devices | Physical phone/tablet | Touch and native browser | Real device behavior | Physical device unavailable | NOT TESTED | Pending | Viewport tests only |
| Languages | Native language review | RU/KK text | Professional fluency | No native professional review claimed | NOT TESTED | Pending | Catalog completeness tests are separate |
| Offline entry | No prior shell cache | First visit offline | No offline-shell promise | PWA/offline shell intentionally absent | N/A | v0.1 scope | README |
| Modal / deep links | Application UI | Modal focus trap/history routing | Applicable only if shipped | Direct export buttons, no modal or application routes | N/A | v0.1 scope | UI inspection to confirm |
| CSV spreadsheet export | Export UI | Formula protection | Applicable only if shipped | Only JSON and inert HTML exported | N/A | v0.1 scope | Public export API |

No axe result constitutes WCAG certification, no laboratory timing proves field p75 Web Vitals, and zero observed canary requests does not prove absence of every possible leak.

New imports after going offline may need to fetch a newly created worker module and are not guaranteed. The checked Chromium context showed a clear WORKER_ERROR and recovered after reconnecting. Already loaded report export and the downloaded self-contained HTML were checked offline. This is a declared boundary, not a promise of an offline application shell.

## Reproduction

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.tools/ms-playwright'
npm run build
npm run test:e2e
```

For public URL verification set `ROWTRACE_URL` to the canonical deployment URL before running the suite; the config then omits local webServer startup. Tests contain no app-shipped QA hooks. Controlled browser API fault injection is confined to isolated test contexts.

Primary test guidance reviewed: [Playwright projects](https://playwright.dev/docs/test-projects), [best practices](https://playwright.dev/docs/best-practices), [accessibility testing](https://playwright.dev/docs/accessibility-testing).
