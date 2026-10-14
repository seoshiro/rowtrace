import { createReadStream } from 'node:fs';
import { open, realpath, stat, lstat, link, rename, unlink } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CliError } from './errors.js';

export function localPath(path: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//iu.test(path) || /^(?:data|file):/iu.test(path) || /^[\\/]{2}/u.test(path) || path === '-') throw new CliError('INVALID_CONFIG', 'Only local file paths are supported; URLs, UNC paths and stdin are not accepted.');
  return resolve(path);
}

export function inputFormat(path: string, explicit?: 'csv' | 'json'): 'csv' | 'json' {
  if (explicit) return explicit;
  const extension = extname(path).toLowerCase();
  if (extension === '.csv') return 'csv';
  if (extension === '.json') return 'json';
  throw new CliError('UNSUPPORTED_FORMAT', 'Expected a .csv or .json file, or an explicit --input-format csv|json.');
}

/** The stat is an early rejection; the incremental counter also handles files growing during reading. */
export async function readBounded(path: string, maxBytes: number, signal: AbortSignal): Promise<string> {
  const resolved = localPath(path);
  const metadata = await stat(resolved);
  if (!metadata.isFile()) throw new CliError('IO_ERROR', 'Input must be a regular file.');
  if (metadata.size > maxBytes) throw new CliError('LIMIT_EXCEEDED', `File exceeds ${maxBytes} bytes.`);
  signal.throwIfAborted();
  const stream = createReadStream(resolved, { highWaterMark: 64 * 1024, signal });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];
  let bytes = 0;
  try {
    for await (const chunk of stream) {
      const buffer = chunk as Buffer;
      bytes += buffer.byteLength;
      if (bytes > maxBytes) throw new CliError('LIMIT_EXCEEDED', `File exceeds ${maxBytes} bytes.`);
      chunks.push(decoder.decode(buffer, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } catch (error) {
    if (error instanceof TypeError && !signal.aborted) throw new CliError('INVALID_UTF8', 'File is not valid UTF-8.');
    throw error;
  } finally { stream.destroy(); }
}

function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export async function assertOutputSafe(output: string, inputs: string[], force: boolean): Promise<string> {
  const target = localPath(output);
  const parent = await realpath(dirname(target));
  const canonicalTarget = join(parent, basename(target));
  const inputPaths = await Promise.all(inputs.map(path => realpath(localPath(path))));
  const normalize = (path: string): string => process.platform === 'win32' ? path.toLowerCase() : path;
  if (inputPaths.some(path => normalize(path) === normalize(canonicalTarget))) throw new CliError('INPUT_OVERWRITE', 'Output must never replace an input file.');
  try {
    const outputLink = await lstat(target);
    if (outputLink.isSymbolicLink()) throw new CliError('OUTPUT_LINK', 'Output must not be a symbolic link. Choose a regular report path.');
    const outputStat = await stat(target);
    if (!outputStat.isFile()) throw new CliError('IO_ERROR', 'Output must be a regular file.');
    const inputStats = await Promise.all(inputPaths.map(path => stat(path)));
    if (inputStats.some(input => input.dev === outputStat.dev && input.ino === outputStat.ino)) throw new CliError('INPUT_OVERWRITE', 'Output aliases an input file.');
    if (!force) throw new CliError('OUTPUT_EXISTS', 'Output exists. Use --force to replace a report.');
  } catch (error) { if (!isMissing(error)) throw error; }
  return target;
}

/** A complete temp file is committed using no-clobber link, or atomic rename for explicit replacement. */
export async function writeReport(output: string, inputs: string[], contents: string, force: boolean, signal: AbortSignal): Promise<void> {
  const target = await assertOutputSafe(output, inputs, force);
  signal.throwIfAborted();
  const temporary = join(dirname(target), `.rowtrace-${randomUUID()}.tmp`);
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      const bytes = Buffer.from(contents, 'utf8');
      for (let offset = 0; offset < bytes.length;) {
        signal.throwIfAborted();
        const result = await file.write(bytes, offset, Math.min(64 * 1024, bytes.length - offset));
        offset += result.bytesWritten;
      }
      await file.sync();
    } finally { await file.close(); }
    signal.throwIfAborted();
    await assertOutputSafe(target, inputs, force);
    signal.throwIfAborted();
    if (force) await rename(temporary, target);
    else await link(temporary, target);
  } finally {
    await unlink(temporary).catch(error => { if (!isMissing(error)) throw error; });
  }
}
