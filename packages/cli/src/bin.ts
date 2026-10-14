#!/usr/bin/env node
import { runCli } from './run.js';

const controller = new AbortController();
const interrupt = (): void => controller.abort();
process.on('SIGINT', interrupt);
// A broken pipe is an I/O error, not an unhandled exception.
process.stdout.on('error', () => { process.exitCode = 2; });
process.exitCode = await runCli(process.argv.slice(2), {
  stdout: text => new Promise((resolve, reject) => process.stdout.write(text, error => error ? reject(error) : resolve())),
  stderr: text => { process.stderr.write(text); },
}, controller.signal);
process.removeListener('SIGINT', interrupt);
