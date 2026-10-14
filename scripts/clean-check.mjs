import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir, platform, release } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(join(tmpdir(), 'rowtrace-clean-'));
const absolute = resolve(temporary);
if (!absolute.startsWith(resolve(tmpdir()) + sep) || !absolute.includes('rowtrace-clean-')) throw new Error('Refusing cleanup outside the created temporary checkout');
const npm = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const steps = [];
function run(binary, args, cwd) {
  const start = Date.now();
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', timeout: 300000, env: { ...process.env, NO_COLOR: '1' } });
  const entry = { command: [binary === process.execPath ? 'node' : binary, ...args.map(a => a === npm ? 'npm' : a === root ? '<source>' : a === temporary ? '<clean-checkout>' : a)].join(' '), exit: result.status, milliseconds: Date.now() - start };
  steps.push(entry); console.log(JSON.stringify(entry));
  if (result.status !== 0) throw new Error(`${entry.command}\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
try {
  run('git', ['clone', '--quiet', '--no-hardlinks', root, temporary], root);
  const commit = run('git', ['rev-parse', 'HEAD'], temporary).trim();
  run(process.execPath, [npm, 'ci', '--no-fund'], temporary);
  for (const task of ['lint', 'build', 'typecheck', 'test', 'test:packed', 'scan:secrets']) run(process.execPath, [npm, 'run', task], temporary);
  await mkdir(join(root, 'evidence'), { recursive: true });
  await writeFile(join(root, 'evidence/clean-check.json'), JSON.stringify({ status: 'PASS', commit, node: process.version, platform: `${platform()} ${release()}`, checkedAt: new Date().toISOString(), steps }, null, 2) + '\n');
} finally {
  await rm(absolute, { recursive: true, force: true });
}
