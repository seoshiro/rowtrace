import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { mkdtemp, writeFile, readFile, readdir, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runCli } from '../../packages/cli/dist/run.js';
import { writeReport } from '../../packages/cli/dist/io.js';

const executable = fileURLToPath(new URL('../../packages/cli/dist/bin.js', import.meta.url));
const before = 'sku,price,name\nA17,14900,Сөмке\nB04,900,Bag\nU03,100,Same\n';
const after = 'sku,price,name\nU03,100,Same\nA17,16900,Сөмке\nC09,400,New\n';

async function fixture(t) {
  const folder = await mkdtemp(join(tmpdir(), 'rowtrace CLI Қазақ '));
  t.after(() => rm(folder, { recursive: true, force: true }));
  await writeFile(join(folder, 'до.csv'), before);
  await writeFile(join(folder, 'после.csv'), after);
  return { folder, args: [join(folder, 'до.csv'), join(folder, 'после.csv'), '--key', 'sku'] };
}
function cli(args, cwd) { return spawnSync(process.execPath, [executable, ...args], { cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' }, timeout: 15000 }); }

test('built executable: demo golden, pure JSON, deterministic core parity, exit policy', async t => {
  const { args } = await fixture(t);
  const result = cli(args);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  const report = JSON.parse(result.stdout);
  assert.equal(report.schemaVersion, '1');
  assert.deepEqual(report.summary, { before: 3, after: 3, added: 1, removed: 1, changed: 1, unchanged: 1, changedCells: 1 });
  const { parseDataset, compareDatasets, serializeReport } = await import('@seoshiro/rowtrace-core');
  assert.equal(result.stdout, serializeReport(compareDatasets(parseDataset(before, { format: 'csv' }), parseDataset(after, { format: 'csv' }), { keyColumns: ['sku'] })));
  assert.equal(cli([...args, '--fail-on-change']).status, 1);
  assert.equal(cli([args[0], args[0], '--key', 'sku', '--fail-on-change']).status, 0);
});

test('help/version/unknown/repeated flags and malformed config are explicit', async t => {
  const { args, folder } = await fixture(t);
  assert.match(cli(['--help']).stdout, /Usage: rowtrace/);
  assert.equal(cli(['--version']).stdout.trim(), '0.1.0');
  for (const extra of [['--unknown'], ['--key', 'other'], ['--force=yes'], ['--format', 'csv'], ['--delimiter', 'tab']]) {
    const result = cli([...args, ...extra]);
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
  }
  await writeFile(join(folder, 'bad.json'), '{"keyColumns":["sku"],"trimStrings":"yes"}');
  assert.equal(cli([...args.slice(0, 2), '--config', join(folder, 'bad.json')]).status, 2);
  await writeFile(join(folder, 'bad.json'), '{"keyColumns":["sku"],"__proto__":{}}');
  assert.equal(cli([...args.slice(0, 2), '--config', join(folder, 'bad.json')]).status, 2);
  await writeFile(join(folder, 'settings.json'), '{"keyColumns":["sku"]}');
  assert.equal(cli([...args.slice(0, 2), '--config', join(folder, 'settings.json')]).status, 0);
  await writeFile(join(folder, 'bad.json'), '{"keyColumns":["sku"],"keyColumns":["price"]}');
  assert.equal(cli([...args.slice(0, 2), '--config', join(folder, 'bad.json')]).status, 2);
});

test('invalid data/UTF8/URLs/missing files fail without stdout', async t => {
  const { args, folder } = await fixture(t);
  const variants = [
    ['duplicate.csv', 'sku,v\nA17,1\nA17,2', 'DUPLICATE_KEY'],
    ['missing.csv', 'sku,v\n,1', 'KEY_MISSING'],
    ['broken.csv', 'sku,v\n"abc,1', 'CSV_PARSE_ERROR'],
    ['invalid.json', '[{"sku":"a","x":{}}]', 'UNSUPPORTED_VALUE'],
    ['invalid-utf8.csv', Buffer.from([0xc3, 0x28]), 'INVALID_UTF8'],
  ];
  for (const [name, contents, code] of variants) {
    await writeFile(join(folder, name), contents);
    const result = cli([join(folder, name), args[1], '--key', 'sku']);
    assert.equal(result.status, 2, name);
    assert.equal(result.stdout, '', name);
    assert.match(result.stderr, new RegExp(code));
  }
  assert.equal(cli(['https://example.com/data.csv', args[1], '--key', 'sku']).status, 2);
  assert.equal(cli([join(folder, 'absent.csv'), args[1], '--key', 'sku']).status, 2);
});

test('atomic output refuses replacement and input aliases; force only replaces reports', async t => {
  const { args, folder } = await fixture(t);
  const report = join(folder, 'отчёт with spaces.json');
  const saved = cli([...args, '--output', report]);
  assert.equal(saved.status, 0, saved.stderr);
  assert.equal(JSON.parse(await readFile(report, 'utf8')).summary.changed, 1);
  assert.equal(cli([...args, '--output', report]).status, 2);
  assert.equal(cli([...args, '--output', report, '--force']).status, 0);
  assert.equal(cli([...args, '--output', args[0], '--force']).status, 2);
  assert.equal(cli([...args, '--output', join(folder, '.', 'до.csv'), '--force']).status, 2);
  const alias = join(folder, 'input-hardlink.csv');
  await link(args[0], alias);
  assert.equal(cli([...args, '--output', alias, '--force']).status, 2);
  assert.equal(await readFile(args[0], 'utf8'), before);
  assert.equal((await readdir(folder)).filter(name => name.startsWith('.rowtrace-')).length, 0);
  assert.equal(cli([...args, '--output', join(folder, 'report.html'), '--format', 'html']).status, 0);
  assert.match(await readFile(join(folder, 'report.html'), 'utf8'), /14900/);
});

test('Windows Unicode/spaces and -- separator preserve filenames that resemble flags', async t => {
  const { folder } = await fixture(t);
  await writeFile(join(folder, '--before.csv'), before);
  await writeFile(join(folder, '--after.csv'), after);
  const result = cli(['--key', 'sku', '--', '--before.csv', '--after.csv'], folder);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).summary.changed, 1);
});

test('terminal diagnostics escape control sequences; JSON retains original value', async t => {
  const { folder } = await fixture(t);
  const payload = '\u001b]0;TITLE\u0007\nforged';
  const data = JSON.stringify([{ sku: 'A', value: payload }]);
  await writeFile(join(folder, 'data.json'), data);
  const good = cli([join(folder, 'data.json'), join(folder, 'data.json'), '--key', 'sku']);
  assert.equal(good.status, 0, good.stderr);
  assert.equal(JSON.parse(good.stdout).rows[0].before.value, payload);
  assert.equal(good.stdout.includes('\u001b'), false);
  const bad = cli(['--unknown\u001b]0;TITLE\u0007']);
  assert.equal(bad.status, 2);
  // eslint-disable-next-line no-control-regex -- Regression checks that raw terminal escape bytes never reach diagnostics.
  assert.equal(/[\u001b\u0007]/u.test(bad.stderr), false);
});

test('bounded reader rejects oversized input before parse', async t => {
  const { args, folder } = await fixture(t);
  const large = join(folder, 'large.csv');
  await writeFile(large, Buffer.alloc(16 * 1024 * 1024 + 1, 65));
  const result = cli([large, args[1], '--key', 'sku']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /LIMIT_EXCEEDED/);
  assert.equal(result.stdout, '');
});

test('cancellation terminates a running worker and allows a new operation', async t => {
  const { args, folder } = await fixture(t);
  const controller = new AbortController();
  let stdout = '', stderr = '';
  // Without output preflight the worker is constructed synchronously before runCli returns.
  const pending = runCli(args, { stdout: async text => { stdout += text; }, stderr: text => { stderr += text; } }, controller.signal);
  controller.abort();
  assert.equal(await pending, 130, stderr);
  assert.equal(stdout, '');
  assert.match(stderr, /CANCELLED/);
  assert.equal((await readdir(folder)).includes('cancelled.json'), false);
  assert.equal((await readdir(folder)).some(name => name.startsWith('.rowtrace-')), false);
  assert.equal(cli(args).status, 0);
});

test('cancellation during atomic write removes temporary output', async t => {
  const { args, folder } = await fixture(t);
  const controller = new AbortController();
  const originalCheck = controller.signal.throwIfAborted.bind(controller.signal);
  let checks = 0;
  controller.signal.throwIfAborted = () => {
    // Deterministic interruption after two write chunks; no timing race with disk speed.
    if (++checks === 4) controller.abort();
    originalCheck();
  };
  const pending = writeReport(join(folder, 'cancel-write.json'), args.slice(0, 2), 'a'.repeat(8 * 1024 * 1024), false, controller.signal);
  await assert.rejects(pending);
  assert.equal(checks, 4);
  assert.equal((await readdir(folder)).some(name => name.startsWith('.rowtrace-') || name === 'cancel-write.json'), false);
});

test('actual executable SIGINT exit contract (POSIX signal; Windows Node signal event)', async t => {
  const { args, folder } = await fixture(t);
  const hook = join(folder, 'signal-hook.mjs');
  // Windows kill(SIGINT) forcibly kills a child; emitting the native Node event validates
  // our installed handler without claiming a physical console Ctrl+C test.
  await writeFile(hook, "const timer=setInterval(()=>{if(process.listenerCount('SIGINT')>0){clearInterval(timer);if(process.platform==='win32')process.emit('SIGINT');else process.send('ready');}},1);timer.unref();");
  const child = spawn(process.execPath, ['--import', pathToFileURL(hook).href, executable, ...args], { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  if (process.platform !== 'win32') child.once('message', () => child.kill('SIGINT'));
  let out = '', err = '';
  child.stdout.on('data', chunk => { out += chunk; });
  child.stderr.on('data', chunk => { err += chunk; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  assert.equal(code, 130, err);
  assert.equal(out, '');
  assert.match(err, /CANCELLED/);
});
