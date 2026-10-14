# ROWTRACE 0.1.0 release record

Version0.1.0: implementation, automated integration CI, Pages deployment and two independent live automation passes completed. Manual exploratory remains blocked as recorded below. No npm publication is claimed.

## Distribution

- Repository: https://github.com/seoshiro/rowtrace
- Verified Pages URL: https://seoshiro.github.io/rowtrace/
- Release and installable archives: https://github.com/seoshiro/rowtrace/releases/tag/v0.1.0
- Core: `@seoshiro/rowtrace-core@0.1.0`, ESM + declarations.
- CLI: `@seoshiro/rowtrace-cli@0.1.0`, executable `rowtrace`, matching core dependency.
- Canonical report schema: string `"1"`, independent of package version.

`npm run test:packed` creates both archives in `artifacts/packages`, checks their allowlisted files, installs them in an OS temporary directory outside the workspace, compiles the consumer and exercises its installed executable. `packed-validation.json` records actual status, source identity and archive hashes. The synthetic `catalogue-report.json` is bounded to8KiB; CI appends it to the job summary with the explicit expected change-policy exit1. There is no bot or PR comment integration.

## npm boundary

The configured machine has no npm login (`npm whoami` returned ENEEDAUTH). Names were checked for existing public packages; this does not establish ownership of an npm scope. No token was sought and no npm account/security configuration was changed. The owner can later authenticate or configure an authorized trusted publisher for the scope and publish the already-verified immutable version. Do not claim registry installation until publication has succeeded.

## Release procedure

Pre-publication evidence: Windows Node24.18.0, core20 tests, CLI10 tests, independent packed consumer and production browser40/40 (30 Chromium156.0.8078.4,5 Firefox157.0,5 WebKit27.2), with no browser retries/skips. `evidence/browser-validation.json` fingerprints the frozen source/build; measured core/browser evidence is in PERFORMANCE.md. Clean-checkout, CI SHA, deployment and live results follow below.

Integration commit `9543ba55d2a4ecc22d4de75e388e53dda83c4a73` passed `npm run verify:clean` in an independent temporary Git clone: npm ci, lint, build, typecheck, core/CLI tests, external packed consumer and scoped secret scan. The source checkout was not used as the consumer dependency. See `evidence/clean-check.json`.

That exact SHA passed [GitHub CI run38586401958](https://github.com/seoshiro/rowtrace/actions/runs/38586401958): Windows verification5m40s, Ubuntu verification2m8s, deployment1m20s. Both platforms ran the full40-case browser suite after the final accessibility markup fix. `evidence/ci-integration.json` retains the API result. Live `version.json` returned HTTP200 with that SHA; `evidence/live/audit.json` records two fresh browser processes/contexts with successful actual imports, exports, privacy/error/cancellation checks and responsive layout. These are automation, not the blocked manual pass.

The final release commit additionally records these results and includes upstream static-bundle license notices. Its immutable identity is the `v0.1.0` tag. **`release-validation.json` attached to the release is the authoritative final full SHA, exact CI run, matching live version and clean packed-consumer result.** It is generated only after that commit's CI and live checks succeed. The final live audit is attached separately as `live-audit-final.json`; `SHA256SUMS.txt` covers the downloadable files. This avoids putting a commit's own hash inside its content or mislabeling earlier evidence as a later run.

Provider annotations on the integration run: Ubuntu's latest-runner label has an announced future image migration; pinned Pages actions declaring Node20 ran successfully under the provider's enforced Node24 compatibility. These are retained CI warnings, not hidden failures. Final CI remains the release gate.

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
