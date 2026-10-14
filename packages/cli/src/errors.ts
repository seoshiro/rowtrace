export class CliError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'CliError';
  }
}

/** Escaping is only for terminal diagnostics; canonical JSON keeps data intact. */
export function terminalSafe(value: string): string {
  // eslint-disable-next-line no-control-regex -- The boundary explicitly finds terminal control bytes to escape them.
  return value.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/gu,
    character => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
}

export function diagnostic(error: unknown): string {
  if (error instanceof CliError) return `${error.code}: ${terminalSafe(error.message)}`;
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') return `${terminalSafe(error.code)}: ${terminalSafe(error.message)}`;
  if (error instanceof Error) return `IO_ERROR: ${terminalSafe(error.message)}`;
  return 'IO_ERROR: Operation failed.';
}
