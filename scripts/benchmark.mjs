import { readFile, writeFile, mkdir, readdir, mkdtemp, unlink, rmdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cpus, totalmem, platform, release, arch, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const runs = Number(option('--runs', '5'));
const warmups = Number(option('--warmups', '1'));
if (!Number.isInteger(runs) || runs < 3 || runs > 20 || !Number.isInteger(warmups) || warmups < 1 || warmups > 3) throw new Error('Use 3..20 measured runs and 1..3 warmups.');
const memory = () => ({ ...process.memoryUsage(), maxRssKiB: process.resourceUsage().maxRSS });
const round = value => Math.round(value * 1000) / 1000;
const quantile = (values, p) => [...values].sort((a, b) => a - b)[Math.max(0, Math.ceil(values.length * p) - 1)];

async function runCase(count, mode) {
  const { largePair } = await import('../fixtures/qa/generate.mjs');
  const { parseDataset, compareDatasets, serializeReport, DEFAULT_LIMITS } = await import('../packages/core/dist/index.js');
  const { renderHtmlReport } = await import('../packages/core/dist/html.js');
  const pair = largePair(count, mode);
  const directory = await mkdtemp(join(tmpdir(), 'rowtrace-benchmark-'));
  const paths = [join(directory, 'before.csv'), join(directory, 'after.csv')];
  await Promise.all(paths.map((path, index) => writeFile(path, index ? pair.after : pair.before)));
  const bytes = { before: Buffer.byteLength(pair.before), after: Buffer.byteLength(pair.after) };
  const raw = [];
  try {
    for (let iteration = 0; iteration < warmups + runs; iteration++) {
      globalThis.gc?.();
      const entry = { iteration, warmup: iteration < warmups, memory: { before: memory() }, ms: {} };
      const start = performance.now();
      const texts = [await readFile(paths[0], 'utf8'), await readFile(paths[1], 'utf8')];
      entry.ms.read = round(performance.now() - start); entry.memory.afterRead = memory();
      let time = performance.now();
      const datasets = texts.map(text => parseDataset(text, { format: 'csv' }));
      entry.ms.parseAndInputValidation = round(performance.now() - time); entry.memory.afterParse = memory();
      time = performance.now();
      let report;
      try { report = compareDatasets(datasets[0], datasets[1], { keyColumns: ['sku'] }); }
      catch (error) { entry.error = { code: error.code, details: error.details }; }
      entry.ms.keyValidationIndexAndDiff = round(performance.now() - time); entry.memory.afterCompare = memory();
      if (mode === 'duplicate') {
        if (entry.error?.code !== 'DUPLICATE_KEY') throw new Error(`Expected duplicate rejection: ${JSON.stringify(entry.error)}`);
      } else {
        if (!report) throw new Error(`Unexpected compare rejection: ${JSON.stringify(entry.error)}`);
        const expectedChanged = mode === 'identical' ? 0 : mode === 'sparse' ? count / 10 : count;
        if (report.summary.changed !== expectedChanged || report.summary.unchanged !== count - expectedChanged || report.summary.added || report.summary.removed) throw new Error('Benchmark fixture correctness failed.');
        entry.summary = report.summary;
        time = performance.now();
        const json = serializeReport(report);
        entry.ms.jsonExport = round(performance.now() - time); entry.memory.afterJson = memory();
        entry.jsonBytes = Buffer.byteLength(json);
        time = performance.now();
        try { const html = renderHtmlReport(report); entry.htmlBytes = Buffer.byteLength(html); }
        catch (error) { entry.htmlError = { code: error.code, details: error.details }; }
        entry.ms.htmlExport = round(performance.now() - time); entry.memory.afterHtml = memory();
      }
      entry.ms.total = round(performance.now() - start);
      raw.push(entry);
    }
  } finally { for (const path of paths) await unlink(path); await rmdir(directory); }
  globalThis.gc?.();
  const measured = raw.filter(value => !value.warmup);
  const statistics = Object.fromEntries(Object.keys(measured[0].ms).map(stage => {
    const samples = measured.map(entry => entry.ms[stage]);
    return [stage, { medianMs: quantile(samples, .5), empiricalP95Ms: quantile(samples, .95), minMs: Math.min(...samples), maxMs: Math.max(...samples) }];
  }));
  return { count, columns: 3, mode, seed: 82741, bytes, changedFraction: mode === 'duplicate' ? null : mode === 'identical' ? 0 : mode === 'sparse' ? .1 : 1, valueLength: mode === 'long' ? 500 : 'Synthetic <index>', limits: DEFAULT_LIMITS, raw, statistics, memoryAfterCaseGc: memory() };
}

if (args.includes('--case')) {
  const [count, mode] = option('--case').split(':');
  process.stdout.write(JSON.stringify(await runCase(Number(count), mode)));
} else {
  const output = resolve(root, option('--output', 'evidence/performance-core.json'));
  const counts = option('--counts', '1000,10000,20000').split(',').map(Number);
  const modes = option('--modes', 'identical,sparse,mass,long,duplicate').split(',');
  if (counts.some(value => ![1000, 10000, 20000].includes(value)) || modes.some(value => !['identical', 'sparse', 'mass', 'long', 'duplicate'].includes(value))) throw new Error('Only bounded F15 scenarios supported.');
  let commit = null; try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { /* Initial baseline may precede the first commit. */ }
  const sources = ['fixtures/qa/generate.mjs', 'scripts/benchmark.mjs', ...(await readdir(join(root, 'packages/core/dist'))).filter(name => name.endsWith('.js')).sort().map(name => `packages/core/dist/${name}`)];
  async function sourceHash() { const hash = createHash('sha256'); for (const path of sources) { hash.update(path); hash.update(await readFile(join(root, path))); } return hash.digest('hex'); }
  const result = { generatedAt: new Date().toISOString(), commit, sourceSha256: await sourceHash(), sourceFiles: sources, environment: { os: platform(), release: release(), arch: arch(), cpu: cpus()[0]?.model, logicalCpus: cpus().length, ramBytes: totalmem(), node: process.version }, methodology: { runs, warmups, processIsolation: 'fresh Node child per scenario', gc: 'explicit before each iteration; default V8 heap', fileRead: 'sequential filesystem UTF-8 reads; OS cache uncontrolled and likely warm', timing: 'perf_hooks performance.now; milliseconds; synchronous stage boundaries', validation: 'parse includes structural validation; compare includes key validation, indexing and diff; internal stages cannot be measured independently without intrusive instrumentation', memory: 'process.memoryUsage snapshots at stage boundaries, not peak heap or isolated stage allocations; resourceUsage.maxRSS process high-water KiB; V8/GC and retained inputs/exports included', p95: 'nearest-rank empirical quantile; with five runs this is the observed maximum, NOT a statistically robust tail estimate', export: 'JSON serialization and HTML rendering timed separately; no disk output timing in export', concurrency: 'one benchmark child at a time; other host applications uncontrolled' }, cases: [] };
  for (const count of counts) for (const mode of modes) {
    process.stderr.write(`Benchmark ${count} ${mode}\n`);
    const childResult = await new Promise((resolveResult, reject) => {
      const child = spawn(process.execPath, ['--expose-gc', fileURLToPath(import.meta.url), '--case', `${count}:${mode}`, '--runs', String(runs), '--warmups', String(warmups)], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'] });
      let buffer = ''; child.stdout.on('data', part => { buffer += part; }); child.on('error', reject);
      child.on('close', code => { if (code !== 0) reject(new Error(`Benchmark child exited ${code}`)); else { try { resolveResult(JSON.parse(buffer)); } catch (error) { reject(error); } } });
    });
    result.cases.push(childResult);
  }
  result.sourceSha256After = await sourceHash(); result.sourceStableDuringRun = result.sourceSha256After === result.sourceSha256;
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(result, null, 2) + '\n');
  if (!result.sourceStableDuringRun) throw new Error('Measured files changed during run. Evidence retained but not a stable-build result.');
  process.stdout.write(`${output}\n`);
}
