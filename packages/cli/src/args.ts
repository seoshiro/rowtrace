import { CliError } from './errors.js';
import type { Limits } from '@seoshiro/rowtrace-core';

export interface CliOptions {
  inputs: [string, string];
  keyColumns: string[];
  ignoreColumns?: string[];
  trimStrings?: boolean;
  ignoreCase?: boolean;
  limits?: Partial<Limits>;
  delimiter: ',' | ';';
  inputFormat?: 'csv' | 'json';
  format: 'json' | 'html' | 'text';
  output?: string;
  force: boolean;
  failOnChange: boolean;
}
type Raw = Record<string, string | boolean>;
const values = new Set(['key', 'ignore', 'delimiter', 'input-format', 'format', 'output', 'config']);
const switches = new Set(['trim', 'ignore-case', 'force', 'fail-on-change']);

export const HELP = `ROWTRACE — compare two local CSV or flat JSON snapshots

Usage: rowtrace <before> <after> --key sku [options]
       rowtrace --key sku -- --before.csv --after.csv

  --key sku,region       Explicit unique or composite key
  --ignore updated_at    Comma-separated ignored columns
  --trim                Trim string values on both sides
  --ignore-case         Compare string values case-insensitively
  --delimiter comma     comma (default), semicolon, or literal separator
  --input-format csv    csv or json; otherwise inferred from each file extension
  --format json         json (default), html, or text
  --output report.json  Write a complete report atomically; default stdout
  --force               Replace an existing report, never an input file
  --fail-on-change      Exit 1 when records or columns differ
  --config settings.json  JSON keyColumns/ignoreColumns/trimStrings/ignoreCase
  --help                Show this help
  --version             Show package version

Exit codes: 0 success; 1 changes with policy enabled; 2 invalid input/I/O; 130 SIGINT.
Files stay local. URLs, stdin, executable configuration and CSV export are unsupported.
Output is uncoloured (including with NO_COLOR). JSON stdout contains JSON only.
`;

export function parseArguments(argv: string[]): { raw: Raw; positional: string[]; action?: 'help' | 'version' } {
  const raw: Raw = Object.create(null) as Raw;
  const positional: string[] = [];
  let ended = false;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]!;
    if (!ended && arg === '--') { ended = true; continue; }
    if (!ended && arg.startsWith('-')) {
      if (arg === '--help' || arg === '--version') {
        if (argv.length !== 1) throw new CliError('INVALID_CONFIG', `${arg} must be used alone.`);
        return { raw, positional, action: arg === '--help' ? 'help' : 'version' };
      }
      const equal = arg.indexOf('=');
      const key = arg.slice(2, equal < 0 ? undefined : equal);
      if (!arg.startsWith('--') || (!values.has(key) && !switches.has(key))) throw new CliError('INVALID_CONFIG', `Unknown option ${arg}.`);
      if (Object.hasOwn(raw, key)) throw new CliError('INVALID_CONFIG', `Repeated option --${key}.`);
      if (switches.has(key)) {
        if (equal >= 0) throw new CliError('INVALID_CONFIG', `--${key} does not accept a value.`);
        raw[key] = true;
      } else {
        const value = equal >= 0 ? arg.slice(equal + 1) : argv[++index];
        if (!value || (equal < 0 && value.startsWith('--'))) throw new CliError('INVALID_CONFIG', `Missing value for --${key}.`);
        raw[key] = value;
      }
    } else positional.push(arg);
  }
  return { raw, positional };
}

export function validateConfig(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new CliError('INVALID_CONFIG', 'Config must be a JSON object.');
  const config = value as Record<string, unknown>;
  const allowed = new Set(['keyColumns', 'ignoreColumns', 'trimStrings', 'ignoreCase', 'delimiter', 'inputFormat', 'format', 'failOnChange']);
  for (const key of Object.keys(config)) if (!allowed.has(key)) throw new CliError('INVALID_CONFIG', `Unknown config property ${key}.`);
  for (const key of ['keyColumns', 'ignoreColumns']) {
    const item = config[key];
    if (item !== undefined && (!Array.isArray(item) || item.some(column => typeof column !== 'string' || column.length === 0) || new Set(item).size !== item.length)) throw new CliError('INVALID_CONFIG', `${key} must contain distinct nonempty strings.`);
  }
  for (const key of ['trimStrings', 'ignoreCase', 'failOnChange']) if (config[key] !== undefined && typeof config[key] !== 'boolean') throw new CliError('INVALID_CONFIG', `${key} must be boolean.`);
  if (config['delimiter'] !== undefined && ![',', ';'].includes(String(config['delimiter']))) throw new CliError('INVALID_CONFIG', 'Unsupported delimiter.');
  if (config['inputFormat'] !== undefined && !['csv', 'json'].includes(String(config['inputFormat']))) throw new CliError('INVALID_CONFIG', 'inputFormat must be csv or json.');
  if (config['format'] !== undefined && !['json', 'html', 'text'].includes(String(config['format']))) throw new CliError('INVALID_CONFIG', 'format must be json, html or text.');
  return config;
}

export function resolveOptions(raw: Raw, positional: string[], config: Record<string, unknown>): CliOptions {
  if (positional.length !== 2) throw new CliError('INVALID_CONFIG', 'Provide exactly two input files. See --help.');
  const list = (name: string, fallback: unknown): string[] | undefined => {
    const rawValue = raw[name];
    if (typeof rawValue === 'string') {
      const result = rawValue.split(',');
      if (result.some(item => item.length === 0) || new Set(result).size !== result.length) throw new CliError('INVALID_CONFIG', `--${name} requires distinct nonempty columns.`);
      return result;
    }
    return fallback as string[] | undefined;
  };
  const keys = list('key', config['keyColumns']);
  if (!keys?.length) throw new CliError('INVALID_CONFIG', 'Choose an explicit --key or config keyColumns.');
  const delimiterValue = raw['delimiter'] ?? config['delimiter'] ?? ',';
  const aliases: Record<string, string> = { comma: ',', semicolon: ';' };
  const delimiter = Object.hasOwn(aliases, String(delimiterValue)) ? aliases[String(delimiterValue)] : delimiterValue;
  const format = raw['format'] ?? config['format'] ?? 'json';
  const inputFormat = raw['input-format'] ?? config['inputFormat'];
  validateConfig({ delimiter, format, ...(inputFormat === undefined ? {} : { inputFormat }) });
  const ignored = list('ignore', config['ignoreColumns']);
  return {
    inputs: [positional[0]!, positional[1]!], keyColumns: keys,
    ...(ignored === undefined ? {} : { ignoreColumns: ignored }),
    trimStrings: Boolean(raw['trim'] ?? config['trimStrings'] ?? false),
    ignoreCase: Boolean(raw['ignore-case'] ?? config['ignoreCase'] ?? false),
    ...(config['limits'] === undefined ? {} : { limits: config['limits'] as Partial<Limits> }),
    delimiter: delimiter as CliOptions['delimiter'], format: format as CliOptions['format'],
    ...(inputFormat === undefined ? {} : { inputFormat: inputFormat as 'csv' | 'json' }),
    ...(typeof raw['output'] === 'string' ? { output: raw['output'] } : {}),
    force: raw['force'] === true,
    failOnChange: Boolean(raw['fail-on-change'] ?? config['failOnChange'] ?? false),
  };
}
