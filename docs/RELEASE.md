# ROWTRACE 0.1.0 release record

Status: integration and release validation in progress. No npm publication is claimed.

## Distribution

- Repository: https://github.com/seoshiro/rowtrace
- Intended Pages URL: https://seoshiro.github.io/rowtrace/ — verify live before treating as released.
- Core: `@seoshiro/rowtrace-core@0.1.0`, ESM + declarations.
- CLI: `@seoshiro/rowtrace-cli@0.1.0`, executable `rowtrace`, matching core dependency.
- Canonical report schema: string `"1"`, independent of package version.

`npm run test:packed` creates both archives in `artifacts/packages`, checks their allowlisted files, installs them in an OS temporary directory outside the workspace, compiles the consumer and exercises its installed executable. `packed-validation.json` records actual status, source identity and archive hashes. The synthetic `catalogue-report.json` is bounded to8KiB; CI appends it to the job summary with the explicit expected change-policy exit1. There is no bot or PR comment integration.

## npm boundary

The configured machine has no npm login (`npm whoami` returned ENEEDAUTH). Names were checked for existing public packages; this does not establish ownership of an npm scope. No token was sought and no npm account/security configuration was changed. The owner can later authenticate or configure an authorized trusted publisher for the scope and publish the already-verified immutable version. Do not claim registry installation until publication has succeeded.

## Release procedure

Pre-publication evidence: Windows Node24.18.0, core20 tests, CLI10 tests, independent packed consumer and production browser40/40 (30 Chromium156.0.8078.4,5 Firefox157.0,5 WebKit27.2), with no browser retries/skips. `evidence/browser-validation.json` fingerprints the frozen source/build; measured core/browser evidence is in PERFORMANCE.md. Final clean-checkout, CI SHA, deployment and live results will be recorded below when executed.

1. Inspect source diff, dependency audit, secret scan and package contents.
2. Run lint, build, strict typechecks, semantic tests, CLI tests, packed consumer and production browser tests.
3. Commit and push to the existing public repository. CI repeats checks from clean checkouts on standard Ubuntu and Windows runners.
4. Enable the repository's Pages Actions source. Only a successful main-branch verification permits the deployment job.
5. Check the run's exact head SHA, deployment result and live `version.json`. Open fresh browser contexts for independent live passes; distinguish automation from manual exploration.
6. Create the immutable release tag and upload the checked tarballs, checksums and synthetic catalogue report. Do not publish a build differing from the tested code.

Action references were resolved through GitHub before inclusion and pinned to complete commit IDs. Default token access is read-only; only deployment receives Pages write and OIDC. No `pull_request_target`, secrets for PR code, scheduled jobs, paid runners, cache increases or billing configuration exist. See [COSTS](COSTS.md).

## Rollback and reproduction

This is the first release; no earlier deployed ROWTRACE version exists. Retain the release tag and its exact SHA. To reproduce, check out that tag, use Node24, run `npm ci` and `npm run build`. Set `ROWTRACE_COMMIT` to the checked-out SHA for production metadata. A future rollback should redeploy a previously verified tag through the same checks, retaining immutable package versions. Do not overwrite an existing npm version or force-push the source history.

## Evidence boundaries

Manual exploratory browser control is currently blocked by the local tool's missing Windows platform directory (HRESULT0x80070003), before any browser opens. Playwright automation, screenshots, accessibility scans and viewport emulation remain separate evidence. No physical phone, native Safari/iPhone, true desktop200% zoom, real screen-reader session or physical Windows Ctrl+C claim is made. Validation and performance documents record actual runs and remaining gaps.

The main portfolio and its publisher are unchanged. A draft card is in PORTFOLIO-CARD.md.
