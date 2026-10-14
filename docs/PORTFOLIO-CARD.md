# Draft portfolio card — not published

**ROWTRACE** · Typed data comparison · 2026

RU: Сравнивает два снимка CSV/JSON по явному ключу и показывает добавленные, удалённые и изменённые записи. Один TypeScript-движок работает в браузере, отдельном пакете и CLI. Неоднозначные ключи блокируют сравнение; файлы обрабатываются локально.

EN: Compare two CSV/JSON snapshots by an explicit key, then inspect added, removed and changed records. One TypeScript engine powers the browser, standalone package and CLI. Ambiguous keys block comparison; selected files stay local.

Pipeline: two snapshots → validated typed keys → indexed comparison → field-level review → deterministic JSON or inert HTML.

Engineering: typed composite keys preserve identity; missing/null/empty remain different; a worker owns heavy state; packages are installed from tarballs outside the repository. Describe tested limits from PERFORMANCE.md, not a hypothetical scale claim.

Source: https://github.com/seoshiro/rowtrace. Demo: https://seoshiro.github.io/rowtrace/ (release verification recorded in RELEASE.md). Packages: https://github.com/seoshiro/rowtrace/releases/tag/v0.1.0.

Real synthetic screenshot: [desktop result](../evidence/ui/result-1440.png); [narrow viewport](../evidence/ui/result-320.png). These are actual browser screenshots, not device photographs.

Existing `portfolio-constellation` and `seoshiro.github.io` are unchanged. This card is prepared only; it has not been published to the portfolio.

Authorship: built with Codex assistance and the listed open-source dependencies. No adoption, user-research, security-certification or physical-device claim.
