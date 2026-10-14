import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { rolldown } from 'rolldown';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'apps/web/dist');
const html = await readFile(join(dist, 'index.html'), 'utf8');
const files = [];
async function walk(path, prefix = '') {
  for (const item of await readdir(path, { withFileTypes: true })) {
    const name = `${prefix}${item.name}`;
    if (item.isDirectory()) await walk(join(path, item.name), `${name}/`);
    else {
      const data = await readFile(join(path, item.name));
      let category = 'other';
      if (name.endsWith('.js')) category = /worker/i.test(name) ? 'worker' : html.includes(name) ? 'main' : 'lazy';
      else if (name.endsWith('.css')) category = 'css';
      else if (/\.(woff2?|ttf|otf)$/.test(name)) category = 'fonts';
      else if (name.startsWith('demo/') && /\.(csv|json)$/.test(name)) category = 'fixtures';
      const staticImports = name.endsWith('.js') ? [...data.toString().matchAll(/\b(?:import|export)\s*(?:[^'";]*?\sfrom\s*)?['"]([^'"]+)['"]/g)].map(match => match[1]).filter(value => value.startsWith('.')).map(value => posix.normalize(posix.join(posix.dirname(name), value))) : [];
      files.push({ path: name, category, staticImports, bytes: data.byteLength, gzipBytes: gzipSync(data, { level: 9 }).byteLength, sha256: createHash('sha256').update(data).digest('hex') });
    }
  }
}
await walk(dist);
const graph = new Map(files.map(file => [file.path, file]));
function closure(entries) { const result = new Set(); function visit(path) { if (result.has(path)) return; result.add(path); for (const dependency of graph.get(path)?.staticImports ?? []) visit(dependency); } entries.forEach(visit); return result; }
const main = closure(files.filter(file => file.category === 'main').map(file => file.path));
const worker = closure(files.filter(file => file.category === 'worker').map(file => file.path));
for (const file of files) if (file.path.endsWith('.js')) file.category = main.has(file.path) ? worker.has(file.path) ? 'main+worker' : 'main' : worker.has(file.path) ? 'worker' : 'lazy';
// Bundle the public core entry with all runtime dependencies, independently of web tree shaking.
const bundler = await rolldown({ input: join(root, 'packages/core/dist/index.js'), platform: 'browser' });
const bundle = await bundler.generate({ format: 'esm', minify: true });
await bundler.close();
const data = Buffer.from(bundle.output.filter(item => item.type === 'chunk').map(item => item.code).join('\n'));
const totals = Object.fromEntries(['main', 'worker', 'lazy', 'css', 'fonts', 'fixtures', 'other'].map(category => [category, files.filter(file => file.category.split('+').includes(category)).reduce((sum, file) => ({ bytes: sum.bytes + file.bytes, gzipBytes: sum.gzipBytes + file.gzipBytes }), { bytes: 0, gzipBytes: 0 })]));
const result = { generatedAt: new Date().toISOString(), gzip: 'Node zlib level 9, local estimate; actual HTTP compression depends on host', classification: 'Main = scripts/preloads referenced by generated index.html plus static-import closure; worker = named worker entry plus static-import closure; other JS = lazy chunks. Shared chunks appear in both main and worker totals, so categories are not additive. Static import extraction uses built-output syntax; runtime request audit separately confirms lazy behavior.', files, totals, coreWithRuntimeDependencies: { bytes: data.byteLength, gzipBytes: gzipSync(data, { level: 9 }).byteLength }, budgets: { initialJsGzipBytes: 200 * 1024, coreGzipBytes: 50 * 1024, mainPass: totals.main.gzipBytes <= 200 * 1024, corePass: gzipSync(data, { level: 9 }).byteLength <= 50 * 1024 } };
await mkdir(join(root, 'evidence'), { recursive: true }); await writeFile(join(root, 'evidence/performance-bundles.json'), JSON.stringify(result, null, 2) + '\n');
process.stdout.write(JSON.stringify(result, null, 2) + '\n');
