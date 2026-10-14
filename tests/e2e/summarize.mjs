import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const result = JSON.parse(await readFile('test-results/results.json', 'utf8'));
const cases = [];
const browsers = new Set();
const axe = [];
function visit(suite) {
  for (const spec of suite.specs ?? []) for (const test of spec.tests) {
    cases.push({ file: spec.file, title: spec.title, browser: test.projectName, status: test.status, runs: test.results.map(run => ({ status: run.status, durationMs: run.duration, retry: run.retry })) });
    for (const run of test.results) for (const attachment of run.attachments ?? []) {
      if (attachment.name === 'browser-version.txt' && attachment.body) browsers.add(Buffer.from(attachment.body, 'base64').toString());
      if (attachment.name.startsWith('axe-') && attachment.body) {
        const scan = JSON.parse(Buffer.from(attachment.body, 'base64').toString());
        axe.push({ state: attachment.name, violations: scan.violations.length, incomplete: scan.incomplete.length, passes: scan.passes.length, incompleteRules: scan.incomplete.map(rule => ({ id: rule.id, impact: rule.impact, description: rule.description, nodes: rule.nodes.map(node => ({ html: node.html, summary: node.failureSummary })) })) });
      }
    }
  }
  for (const child of suite.suites ?? []) visit(child);
}
for (const suite of result.suites) visit(suite);
const hashes = {};
async function fingerprint(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await fingerprint(path);
    else hashes[path.replaceAll('\\', '/')] = createHash('sha256').update(await readFile(path)).digest('hex');
  }
}
for (const folder of ['apps/web/src', 'apps/web/public', 'apps/web/dist', 'packages/core/src']) await fingerprint(folder);
await mkdir('evidence', { recursive: true });
const destination = process.argv[2] ?? 'evidence/browser-validation.json';
await writeFile(destination, JSON.stringify({ kind: 'automated-production-browser-validation', platform: process.platform, node: process.version, playwright: '1.64.0', sourceState: 'Frozen pre-release worktree; exact source and built artifact SHA-256 below. Integration commit recorded in RELEASE.md.', command: process.argv[3] ?? 'npx playwright test', stats: result.stats, browsers: [...browsers].sort(), axe, cases, sha256: hashes }, null, 2) + '\n');
console.log(destination, result.stats);
