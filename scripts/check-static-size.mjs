import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

async function size(directory) {
  let bytes = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Static output must not contain symlinks');
    bytes += entry.isDirectory() ? await size(file) : (await stat(file)).size;
  }
  return bytes;
}
const bytes = await size('apps/web/dist');
if (bytes > 2 * 1024 * 1024) throw new Error(`Static output exceeds the 2 MiB release cap: ${bytes}`);
console.log(`Static release size: ${bytes} bytes (2 MiB maximum)`);
