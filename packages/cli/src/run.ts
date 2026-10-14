import { Worker } from 'node:worker_threads';
import { DEFAULT_LIMITS, parseConfig } from '@seoshiro/rowtrace-core';
import { parseArguments, resolveOptions, HELP, type CliOptions } from './args.js';
import { CliError, diagnostic } from './errors.js';
import { assertOutputSafe, readBounded, writeReport } from './io.js';

export interface CliStreams { stdout: (text: string) => Promise<void>; stderr: (text: string) => void }
export const VERSION = '0.1.0';

function compute(options: CliOptions, signal: AbortSignal): Promise<{ text: string; hasChanges: boolean }> {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { workerData: options });
    let settled = false;
    const finish = (error?: Error, result?: { text: string; hasChanges: boolean }): void => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', cancel);
      void worker.terminate().then(() => {
        if (error) reject(error);
        else if (result) resolve(result);
      }, reject);
    };
    const cancel = (): void => finish(new CliError('CANCELLED', 'Interrupted.'));
    signal.addEventListener('abort', cancel, { once: true });
    worker.once('error', error => finish(error));
    worker.once('exit', () => { if (!settled) finish(new CliError('IO_ERROR', 'Worker exited without a complete report.')); });
    worker.once('message', (message: unknown) => {
      if (message === null || typeof message !== 'object' || !('type' in message)) return finish(new CliError('IO_ERROR', 'Invalid worker response.'));
      if (message.type === 'complete' && 'text' in message && typeof message.text === 'string' && 'hasChanges' in message && typeof message.hasChanges === 'boolean') finish(undefined, { text: message.text, hasChanges: message.hasChanges });
      else if (message.type === 'error' && 'code' in message && typeof message.code === 'string' && 'message' in message && typeof message.message === 'string') finish(new CliError(message.code, message.message));
      else finish(new CliError('IO_ERROR', 'Invalid worker response.'));
    });
  });
}

export async function runCli(argv: string[], streams: CliStreams, signal: AbortSignal): Promise<number> {
  try {
    const parsed = parseArguments(argv);
    if (parsed.action) {
      await streams.stdout(parsed.action === 'help' ? HELP : `${VERSION}\n`);
      return 0;
    }
    let config: Record<string, unknown> = {};
    if (typeof parsed.raw['config'] === 'string') {
      const contents = await readBounded(parsed.raw['config'], DEFAULT_LIMITS.maxConfigBytes, signal);
      config = { ...parseConfig(contents) };
    }
    const options = resolveOptions(parsed.raw, parsed.positional, config);
    // The config is also protected because it is input to this operation.
    const inputs = [...options.inputs, ...(typeof parsed.raw['config'] === 'string' ? [parsed.raw['config']] : [])];
    if (options.output) await assertOutputSafe(options.output, inputs, options.force);
    const result = await compute(options, signal);
    signal.throwIfAborted();
    if (options.output) await writeReport(options.output, inputs, result.text, options.force, signal);
    else await streams.stdout(`${result.text}${result.text.endsWith('\n') ? '' : '\n'}`);
    signal.throwIfAborted();
    return options.failOnChange && result.hasChanges ? 1 : 0;
  } catch (error) {
    if (signal.aborted) { streams.stderr('CANCELLED: Interrupted.\n'); return 130; }
    streams.stderr(`${diagnostic(error)}\n`);
    return 2;
  }
}
