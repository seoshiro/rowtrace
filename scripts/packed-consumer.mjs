import { mkdtemp, mkdir, readFile, writeFile, appendFile, cp, readdir, rm, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir, platform, release } from 'node:os';
import { spawnSync, spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactDirectory = join(root, 'artifacts', 'packages');
await mkdir(artifactDirectory, { recursive: true });
// Calling npm's JS entry with node avoids shell quoting and the Windows .cmd spawn limitation.
const npmEntry = process.env.npm_execpath || join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
await access(npmEntry);
function command(args, cwd = root, expected = 0) {
  const result = spawnSync(process.execPath, [npmEntry, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, timeout: 180000 });
  assert.equal(result.status, expected, `npm ${args.join(' ')}\n${result.stderr}\n${result.stdout}`);
  return result;
}
const packed = [];
for (const name of ['core', 'cli']) {
  const result = command(['pack', '--json', '--ignore-scripts', '--pack-destination', artifactDirectory], join(root, 'packages', name));
  const packing = JSON.parse(result.stdout);
  // npm 12 keys pack JSON by package name; npm 10/11 use an array.
  const metadata = Array.isArray(packing) ? packing[0] : Object.values(packing)[0];
  assert(metadata && Array.isArray(metadata.files), 'Unrecognized npm pack response');
  for (const entry of metadata.files) {
    assert.match(entry.path, /^(?:dist\/|package\.json$|README\.md$|LICENSE$)/, `Unexpected packed file ${entry.path}`);
    assert.doesNotMatch(entry.path, /(?:\.env|credential|token|fixture|test)/i);
  }
  assert(metadata.files.some(entry => entry.path.endsWith('.d.ts')), 'Package declarations missing');
  assert(metadata.files.some(entry => entry.path === 'LICENSE'), 'Package license missing');
  assert(metadata.files.some(entry => entry.path === 'README.md'), 'Package README missing');
  if (name === 'cli') assert(metadata.files.some(entry => entry.path === 'dist/bin.js'), 'Executable missing');
  packed.push({ name, path: join(artifactDirectory, metadata.filename), metadata });
}
const consumer = await mkdtemp(join(tmpdir(), 'rowtrace packed consumer Қазақ '));
assert(!consumer.startsWith(root), 'Consumer must be outside monorepo');
const checks = [];
try {
  await cp(join(root, 'examples', 'consumer'), consumer, { recursive: true });
  const typescript = JSON.parse(await readFile(join(root, 'node_modules', 'typescript', 'package.json'), 'utf8')).version;
  command(['install', '--ignore-scripts', '--no-audit', '--no-fund', ...packed.map(item => item.path), `typescript@${typescript}`], consumer);
  command(['run', 'build'], consumer);
  const api = spawnSync(process.execPath, ['dist/index.js'], { cwd: consumer, encoding: 'utf8' });
  assert.equal(api.status, 0, api.stderr);
  const apiReport = JSON.parse(api.stdout);
  assert.deepEqual(apiReport.summary, { before: 3, after: 3, added: 1, removed: 1, changed: 1, unchanged: 1, changedCells: 1 });
  checks.push('Installed public ESM API and TypeScript declarations compiled and ran outside workspace');
  const before = join(consumer, '--до snapshot.csv'), after = join(consumer, '--после snapshot.csv');
  await writeFile(before, 'sku,price\nA17,14900\nB04,900\nU03,100\n');
  await writeFile(after, 'sku,price\nU03,100\nA17,16900\nC09,400\n');
  const execute = (args, expected = 0) => command(['--silent', 'exec', '--no', '--', 'rowtrace', ...args], consumer, expected);
  const result = execute([before, after, '--key', 'sku']);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), apiReport);
  checks.push('Real installed bin invoked through npm exec, JSON stdout matches API golden');
  execute(['--help']); execute(['--version']); execute(['--unknown'], 2);
  execute([before, after, '--key', 'sku', '--fail-on-change'], 1);
  execute([before, before, '--key', 'sku', '--fail-on-change']);
  execute([before, after, '--key', 'absent'], 2);
  execute(['--key', 'sku', '--', '--до snapshot.csv', '--после snapshot.csv']);
  checks.push('Installed bin help/version/unknown/key errors, Unicode/spaces/-- filenames, exit 0/1/2');
  assert(Buffer.byteLength(result.stdout, 'utf8') < 8192, 'Synthetic CI catalogue report must remain below 8 KiB');
  await writeFile(join(artifactDirectory, 'catalogue-report.json'), result.stdout);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const counts = apiReport.summary;
    await appendFile(process.env.GITHUB_STEP_SUMMARY, `## ROWTRACE synthetic catalogue comparison\n\nInstalled tarballs compared two concrete synthetic catalogue versions. Added **${counts.added}**, removed **${counts.removed}**, changed **${counts.changed}**, unchanged **${counts.unchanged}**.\n\nThe ordinary command exited 0. The same comparison with \`--fail-on-change\` exited **1**, as explicitly expected by this demonstration. In a real catalogue gate, let that code fail the job; intentional changes require review and an updated baseline. No bot or PR comment is created.\n\nCanonical report (under 8 KiB; synthetic data only):\n\n\`\`\`json\n${result.stdout}\`\`\`\n`);
  }
  const output = join(consumer, 'report.html');
  execute([before, after, '--key', 'sku', '--format', 'html', '--output', output]);
  assert.match(await readFile(output, 'utf8'), /14900/);
  execute([before, after, '--key', 'sku', '--format', 'html', '--output', output], 2);
  execute([before, after, '--key', 'sku', '--output', before, '--force'], 2);
  assert.match(await readFile(before, 'utf8'), /14900/);
  checks.push('Installed bin HTML output, existing-file and input-overwrite protections');
  const installedCli = JSON.parse(await readFile(join(consumer, 'node_modules', '@seoshiro', 'rowtrace-cli', 'package.json'), 'utf8'));
  const installedCore = JSON.parse(await readFile(join(consumer, 'node_modules', '@seoshiro', 'rowtrace-core', 'package.json'), 'utf8'));
  const installedBin = join(consumer, 'node_modules', '@seoshiro', 'rowtrace-cli', installedCli.bin.rowtrace);
  const signalHook = join(consumer, 'signal-hook.mjs');
  await writeFile(signalHook, "const timer=setInterval(()=>{if(process.listenerCount('SIGINT')>0){clearInterval(timer);if(process.platform==='win32')process.emit('SIGINT');else process.send('ready');}},1);timer.unref();");
  const child = spawn(process.execPath, ['--import', pathToFileURL(signalHook).href, installedBin, before, after, '--key', 'sku', '--output', join(consumer, 'cancelled.json')], { cwd: consumer, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  if (process.platform !== 'win32') child.once('message', () => child.kill('SIGINT'));
  let cancelledOut = '', cancelledErr = '';
  child.stdout.on('data', chunk => { cancelledOut += chunk; });
  child.stderr.on('data', chunk => { cancelledErr += chunk; });
  const interruptedCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(interruptedCode, 130, cancelledErr);
  assert.equal(cancelledOut, '');
  assert(!(await readdir(consumer)).some(name => name === 'cancelled.json' || name.startsWith('.rowtrace-')));
  checks.push(`Installed executable exit 130 and output cleanup (${process.platform === 'win32' ? 'Node SIGINT event; no physical console claim' : 'real POSIX SIGINT'})`);
  for (const packageJson of [installedCli, installedCore]) assert(!packageJson.scripts?.install && !packageJson.scripts?.postinstall && !packageJson.scripts?.preinstall);
  assert(!(await readdir(join(consumer, 'node_modules', '@seoshiro', 'rowtrace-core'))).includes('src'));
  const revision = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
  const worktree = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' });
  const evidence = { status: 'PASS', checkedAt: new Date().toISOString(), sourceCommit: revision.status === 0 ? revision.stdout.trim() : null, sourceDirty: worktree.status === 0 ? worktree.stdout.length > 0 : null, os: `${platform()} ${release()}`, node: process.version, outsideWorkspace: true, checks, packages: packed.map(({ name, metadata }) => ({ name, filename: metadata.filename, integrity: metadata.integrity, shasum: metadata.shasum, files: metadata.files.map(file => file.path) })) };
  await writeFile(join(artifactDirectory, 'packed-validation.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  // Only this script's freshly created, verified OS-temporary consumer is removed.
  const absolute = resolve(consumer);
  assert(absolute.startsWith(resolve(tmpdir()) + (process.platform === 'win32' ? '\\' : '/')) && absolute.includes('rowtrace packed consumer'));
  await rm(absolute, { recursive: true, force: true });
}
