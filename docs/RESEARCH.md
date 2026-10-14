# ROWTRACE research

Research date: 2026-10-14. This records source inspection and design decisions, not completed product validation. Release measurements, exact tested commits and live checks belong in PERFORMANCE, VALIDATION and RELEASE. Existing repositories were read only.

## Portfolio context

The current [catalogue source](https://github.com/seoshiro/portfolio-constellation/blob/main/src/data/projects.ts) lists SIDEREAL, ORBIT, ITER, AYQYN, FORME, PERCH, RESON, LUMEN, SELVEDGE, GuideCheck and ArchiveGuard. Its [README](https://github.com/seoshiro/portfolio-constellation/blob/main/README.md) describes a static multilingual portfolio with an independent HTML catalogue. Its publisher remains `seoshiro/seoshiro.github.io`; ROWTRACE must use a separate project site and prepare a card without publishing a portfolio change.

Relevant existing work inspected:

| Project | Evidence in current README | Consequence for ROWTRACE |
| --- | --- | --- |
| [ArchiveGuard](https://github.com/seoshiro/archiveguard/blob/main/README.md) | Browser file processing, worker cancellation, bounded inputs, audit reports, RU/EN/KK | Local processing alone is not a new portfolio capability. |
| [GuideCheck](https://github.com/seoshiro/guidecheck/blob/main/README.md) | Browser persistence, optional local SQLite edition, revision review and exports | A useful workflow already exists; ROWTRACE should establish independent package use. |
| [AituDesk](https://github.com/seoshiro/aitudesk/blob/master/README.md) | Express/Prisma/PostgreSQL, roles, monitoring, API tests | Do not claim the portfolio lacks a backend or tests. |
| [AssetControl](https://github.com/seoshiro/AssetControl/blob/main/README.md) | Equipment lifecycle, roles, financial/repair workflows, CSV/PDF reporting, backend/frontend tests | Adding unrelated authentication or an inventory server would duplicate demonstrated skills. |
| [Press AI Dashboard](https://github.com/seoshiro/Press-AI-Dashboard/blob/main/README.md) | Django REST, PostgreSQL/Redis, Celery, moderation roles and backend tests | Backend infrastructure is already represented outside the main catalogue. |

The proposed addition is a reusable developer tool: a documented TypeScript API, independently installable core and CLI, stable diagnostics, versioned output and a real outside consumer. This is a reading of the selected presentation, not a claim about everything the author has ever built. No adoption or demand has been measured.

## Existing alternatives

| Tool | Verified capabilities | Relevant differences and uncertainty |
| --- | --- | --- |
| [csv-diff](https://github.com/simonw/csv-diff) | Python library/CLI; CSV/TSV/JSON; explicit single column `--key`; human and JSON summaries; column changes | The inspected [loader source](https://github.com/simonw/csv-diff/blob/main/csv_diff/__init__.py) builds a dictionary keyed by the selected value, so repeated keys replace earlier entries. Missing JSON properties are filled with `None`; nested structures become JSON strings. These source observations differ from ROWTRACE's blocking duplicates and distinct missing/null contract. No performance or security superiority was tested. |
| [daff](https://github.com/paulfitz/daff) | Table alignment, diff/patch/merge; JavaScript and other language packages; CSV/TSV/JSON/SQLite; repeatable `--id` for composite keys; HTML output; ordered/unordered modes; `--fail-if-diff` codes 0/1/2 | Its broader alignment and patch workflow is useful for common-origin tables. ROWTRACE chooses explicit typed identity and a smaller read-only workflow. Duplicate-key ambiguity guarantees were not established by this README inspection; do not assert daff loses duplicates or is unsafe. |

ROWTRACE is not the first table comparison tool. Its intended value is one typed core shared by browser and CLI, explicit ambiguity diagnostics, local files and a clear field-level review. Implementation and packed-consumer tests must establish that value. Existing tools' stars are not evidence of ROWTRACE usage.

## Design references: principles, not copied interfaces

| Reference inspected | Transferable lesson | ROWTRACE decision |
| --- | --- | --- |
| [Bruno Simon folio-2025](https://github.com/brunosimon/folio-2025) | Its documented input/physics/view loop makes interaction part of the engineering. | Make actual changes explorable; no decorative 3D dependency. |
| [Brittany Chiang](https://brittanychiang.com/) and [historical v4](https://github.com/bchiang7/v4) | Concrete projects and direct work links; v4 explicitly identifies its historical Gatsby implementation. | Show the useful tool immediately and make source/API/demo evidence easy to find. Do not adopt the old stack. |
| [Paco Coursey](https://paco.me/), [cmdk](https://github.com/dip/cmdk), [architecture](https://github.com/dip/cmdk/blob/main/ARCHITECTURE.md) | A compact composable API has real tradeoffs: cmdk documents DOM authority and retained component memory. | Keep the core API small and explain memory/cancellation costs. Do not transfer a combobox's DOM model into the diff engine. |
| [Emil Kowalski](https://emilkowal.ski/) and [Sonner](https://github.com/emilkowalski/sonner) | Focused behavior and a short install-to-first-result path. | Short transitions, clear recovery and a real minimal consumer. Notifications must not hide persistent errors. |
| [Anthony Fu projects](https://antfu.me/projects) | Practical libraries, developer utilities and TypeScript tooling are presented as usable projects. | Treat package documentation and independent installation as deliverables equal to the demo. |

These are interpretive design lessons from the linked material. No code, assets, brand styling or commercial training content was copied.

## Dependency and naming preflight

Public npm registry metadata was read on 2026-10-14 using `https://registry.npmjs.org/<encoded-package>/latest`. Pin actual chosen versions and integrity in the lockfile; this table is the research snapshot, not a claim every candidate is installed.

The browser distribution carries [THIRD_PARTY_LICENSES.txt](../apps/web/public/THIRD_PARTY_LICENSES.txt), copied from installed React, React DOM, scheduler, Papa Parse and jsonc-parser licenses, plus Vite's complete core license and Rolldown notices for generated browser helpers. Package versions are recorded with each notice. This static file is included by Vite's public-directory copy; update it when those dependencies change.

| Candidate | Latest observed | License | Role / recommendation |
| --- | --- | --- | --- |
| [react](https://registry.npmjs.org/react/latest), react-dom | 19.3.0 | MIT | UI only, never core runtime. |
| [vite](https://registry.npmjs.org/vite/latest) | 8.3.4 | MIT | Static application and module-worker build. |
| [@vitejs/plugin-react](https://registry.npmjs.org/@vitejs%2Fplugin-react/latest) | 6.1.2 | MIT | React build integration if needed. |
| [typescript](https://registry.npmjs.org/typescript/latest) | 7.0.2 | Apache-2.0 | Strict declarations and independent consumer compilation. |
| [papaparse](https://registry.npmjs.org/papaparse/latest) | 5.7.0 | MIT | CSV candidate; explicit dialect and no dynamic typing. |
| [vitest](https://registry.npmjs.org/vitest/latest) | 5.0.4 | MIT | Semantic tests; requires Node 22.12+, 24.x or 26+. |
| [@playwright/test](https://registry.npmjs.org/@playwright%2Ftest/latest) | 1.64.0 | Apache-2.0 | Production browser assertions across engines. |
| [@axe-core/playwright](https://registry.npmjs.org/@axe-core%2Fplaywright/latest) | 4.13.0 | MPL-2.0 | Optional development-only accessibility scan; does not certify WCAG. |

Use [Node 24 LTS](https://nodejs.org/en/about/previous-releases) for development/CI compatibility (24.21.0 was the latest LTS shown at research time); Vite's [documented minimum](https://vite.dev/guide/) is Node 20.19+ or 22.12+. Do not select Node merely from the lower TypeScript minimum. Exact installed runtime belongs in PROGRESS.

Before creation, `GET https://api.github.com/repos/seoshiro/rowtrace` returned HTTP 404 and the authenticated owner's repository inventory contained no `rowtrace`. npm metadata returned HTTP 404 for `rowtrace`, `rowtrace-cli`, `@seoshiro/rowtrace`, `@seoshiro/rowtrace-core` and `@seoshiro/rowtrace-cli`. Selected package identifiers are `@seoshiro/rowtrace-core` and `@seoshiro/rowtrace-cli`. A missing public package does not reserve a name, establish ownership of an npm scope, or prove publication. Publication status must be verified separately.

## Engineering sources and concrete decisions

- [RFC 4180](https://www.rfc-editor.org/rfc/rfc4180) establishes quoting and multiline CSV conventions. Document ROWTRACE's narrower dialect explicitly. [Papa Parse](https://www.papaparse.com/docs) can preserve strings with `dynamicTyping: false`; its header mode renames duplicates, so duplicate headers need explicit detection rather than trusting a successful parse. A maintained JSON tokenizer or documented bounded token check is needed to reject duplicate JSON property names before native parsing overwrites them.
- [TypeScript strict](https://www.typescriptlang.org/tsconfig/#strict) and [noUncheckedIndexedAccess](https://www.typescriptlang.org/tsconfig/noUncheckedIndexedAccess.html) make absence visible to the compiler. Runtime validation still guards files, options and worker messages.
- [React effects guidance](https://react.dev/learn/you-might-not-need-an-effect) supports deriving presentation without copying state through effect chains. Language changes must not reparse files.
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers) separate computation from DOM work; messages have copying/transfer costs. Worker owns the dataset and result, UI requests bounded pages. [terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate) stops a busy worker immediately; combine it with job identity and new-worker recovery. A cancel message cannot interrupt uninterrupted synchronous work.
- [Node event loop](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop) and [backpressure](https://nodejs.org/en/learn/modules/backpressuring-in-streams) inform bounded reading and yielding for SIGINT. Streaming input does not eliminate the retained index/result. [Process documentation](https://nodejs.org/api/process.html#exit-codes) explains signal-related exit codes; test ROWTRACE's 130 contract on the stated OS.
- [OWASP input validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html): bound bytes before buffering, reject unsupported structure and validate semantic identity. [XSS prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html): render text and escape HTML contexts, keep reports inert. [Prototype pollution](https://cheatsheetseries.owasp.org/cheatsheets/Prototype_Pollution_Prevention_Cheat_Sheet.html): use Map/null-prototype indexes and avoid untrusted merges. [CSV injection](https://owasp.org/www-community/attacks/CSV_Injection): JSON/inert HTML avoid spreadsheet formula execution; quoting alone is not a universal CSV defense. [ASVS 5.0.0](https://owasp.org/www-project-application-security-verification-standard/) is the referenced version and a source of applicable checks, not an unearned compliance claim.
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) informs keyboard access, visible/unobscured focus, text contrast, status text and reflow. The approximately 44 CSS px product target is not presented as the universal AA minimum. [Playwright accessibility guidance](https://playwright.dev/docs/accessibility-testing) explicitly requires complementary manual assessment.
- [Playwright best practices](https://playwright.dev/docs/best-practices), [projects](https://playwright.dev/docs/test-projects), [context options](https://playwright.dev/docs/test-use-options) and [emulation](https://playwright.dev/docs/emulation): isolated contexts, roles/labels, real assertions and engine-specific coverage. Browser automation, exploratory browser operation and physical-device testing are distinct evidence.
- [Web Vitals](https://web.dev/articles/vitals) and [INP](https://web.dev/articles/optimize-inp): record laboratory conditions, long tasks and interaction latency; do not present a few local runs or Lighthouse TBT as field p75 INP.
- [Google review guidance](https://google.github.io/eng-practices/review/reviewer/looking-for.html) and [small changes](https://google.github.io/eng-practices/review/developer/small-cls.html): review the actual data path and risks; focused fixes and useful regression checks, no mechanical test-count goal.
- [npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/) and [SemVer](https://semver.org/): inspect the archive and install it outside the workspace; public API version and report schemaVersion are separate contracts. [Trusted publishing](https://docs.npmjs.com/trusted-publishers/) currently requires npm 11.5.1+ and Node 22.14+ with an authorized trust configuration. Do not expand account permissions simply to avoid delivering tarballs.

## Free release path

[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) allow public repositories on GitHub Free. This free portfolio demonstration fits the selected static architecture; Pages is not intended for commercial SaaS or sensitive transactions. Current limits: published site at most 1 GB, recommended source repository at most 1 GB, deployment timeout 10 minutes, soft bandwidth 100 GB/month. The soft 10 builds/hour limit does not apply to a custom Actions publication workflow. Rate limits can still apply. These are current conditions, not a permanent free-hosting guarantee.

[Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) confirms standard GitHub-hosted runners for public repositories are free. Use standard runners, small short-lived artifacts, no paid runner, billing activation, trial or card. [Secure use](https://docs.github.com/en/actions/reference/security/secure-use) recommends full verified action commit SHAs and minimum token permissions; do not execute untrusted PR code with privileged release credentials.

The final project cost boundary and official over-limit behavior are documented in [COSTS.md](COSTS.md). Optional diagnostic artifact uploads and package-manager caches were removed; only the size-capped Pages artifact with one-day retention remains. This does not assert anything about unrelated account billing.

[Vite Pages deployment](https://vite.dev/guide/static-deploy.html#github-pages) requires a repository base such as `/rowtrace/`. Build and upload only the static output; check cold main/chunk/worker/font/fixture requests and downloads at the final URL. Deploy after checks, record the exact SHA in build metadata and verify the successful run for that SHA. Two independent live contexts must verify the actual app. The existing root portfolio publisher and archive are outside this release.

If npm account/scope access is unavailable, publish verified GitHub release tarballs and the free demo independently; leave the single owner authentication/publication step explicit. No npm publication was performed by this research task.
