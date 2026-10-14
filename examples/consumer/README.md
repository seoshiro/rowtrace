# Independent consumer

This example uses only public package exports. It is deliberately outside the root workspaces list.

Copy this directory to a new directory outside the ROWTRACE checkout, then install both release tarballs and TypeScript:

```sh
npm install /absolute/path/seoshiro-rowtrace-core-0.1.0.tgz /absolute/path/seoshiro-rowtrace-cli-0.1.0.tgz
npm install --save-dev typescript
npm run build
npm start
npx --no -- rowtrace --help
```

From the repository, `npm run test:packed` builds the same isolated consumer in the OS temporary directory, compiles its TypeScript against installed declarations, invokes the installed `rowtrace` bin, and checks report contents and exit codes. It creates release tarballs in `artifacts/packages`. The npm registry packages are not claimed to be published.

The same script is the executable CI catalogue example: it writes `artifacts/packages/catalogue-report.json` from two concrete synthetic catalogue versions, asserts the `--fail-on-change` policy exits 1, and appends counts plus the bounded report to `GITHUB_STEP_SUMMARY` when running in Actions. The example expects that exit 1 because its change is intentional; a real gate should propagate it until the reviewed baseline is updated. Only synthetic data is included, with no bot or PR comments.
