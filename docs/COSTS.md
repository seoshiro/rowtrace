# Hosting and cost boundary

Reviewed 2026-10-14. This is a free, public, static open-source demonstration. There is no backend, database, account system, paid API, payment integration, domain purchase, trial, or provisioned compute resource. File comparison runs on the visitor's device. Visitor file size and repeated comparisons cannot create server computation charges.

## Selected release configuration

The repository stays public. CI uses standard `ubuntu-latest` and `windows-latest` GitHub-hosted runners, not larger runners, self-hosted infrastructure, custom images, or paid services. Workflows have no schedule or public HTTP trigger. Fork pull requests have read-only verification; deployment requires a main-branch run after successful verification.

The workflow disables setup-node's package-manager cache, does not upload diagnostic artifacts, and uploads only the generated Pages site. The Pages artifact expires after one day. `scripts/check-static-size.mjs` enforces a 2 MiB static output ceiling. These restrictions keep storage small; they are not a substitute for the public-repository free-use rule.

No payment method, subscription, billing setting, paid runner, cache allowance increase, or account-wide budget was configured for this project. Existing account billing and other repositories are outside this statement.

## Official basis and over-limit behavior

GitHub's current billing documentation says: “GitHub Actions usage is free for self-hosted runners and for public repositories that use standard GitHub-hosted runners.” Its following paragraph scopes included quotas and overage billing to private repositories. The same document explicitly lists public repositories and Pages as free standard-runner uses, and warns that larger runners are charged even for public repositories. This project's configuration stays in the documented public standard-runner path. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

Pages is available for public repositories on GitHub Free. Its published site limit is 1 GB, deployment timeout is ten minutes, and soft bandwidth limit is 100 GB/month. Rate limiting can return HTTP 429. If a site exceeds quotas, GitHub describes inability to serve it or support contact requesting lower impact/migration; it does not describe automatic paid Pages overage or an automatic paid upgrade. Do not enable a paid replacement if this happens. Investigate, reduce traffic/output, or leave the demo unavailable. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

GitHub supports the required Pages upload artifact and gives it a one-day default retention. Branch publishing also ultimately uses a Pages Actions deployment; it is not a way to eliminate GitHub's deployment infrastructure. [Upload Pages artifact](https://github.com/actions/upload-pages-artifact), [Pages publishing sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

The generic Actions storage sections describe hourly accounting and shared artifact allowances. They must not be presented as evidence that *every* account resource is free. Where billing applies, an account without a valid payment method is blocked at its quota; an account with a payment method may pay overage unless a spending stop applies. Cache overage requires explicitly raising the repository cache limit above its included allowance. This project does neither. We did not inspect or change the owner's payment methods or account-wide budgets. Public-repository status and standard runner choice must remain release invariants. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

## Scope of the assurance

No metered service or automatic paid-upgrade configuration is introduced by ROWTRACE. This is a statement about the checked project configuration and the cited current provider policy, not a promise about unrelated account charges, future policy changes, or changes made later by someone with repository/account access. A visitor can consume static-host bandwidth and potentially make the demo unavailable; the app gives that visitor no token, billing API, write endpoint, or deployment capability.

Keep the repository public, use only standard runners, keep the size/retention checks, and recheck these official policies before changing the hosting or workflow. Do not add a CDN, paid monitoring, remote inference, a server, larger runners, or a raised cache limit as an automatic response to abuse.
