import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';

// A scoped heuristic scan, not a claim that all secret formats can be detected.
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b/],
  ['aws-access-key', /\bAKIA[0-9A-Z]{16}\b/],
  ['npm-token', /\bnpm_[A-Za-z0-9]{30,}\b/],
  ['assigned-secret', /(?:api[_-]?key|access[_-]?token|password|secret)\s*[:=]\s*["'][A-Za-z0-9/+_=.-]{24,}["']/i]
];
const findings = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && !file.endsWith('.example')) findings.push({ file, rule: 'environment-file' });
  if (statSync(file).size > 2_000_000) continue;
  const source = readFileSync(file, 'utf8');
  for (const [name, pattern] of rules) if (pattern.test(source)) findings.push({ file, rule: name });
}
console.log(JSON.stringify({ scanner: 'ROWTRACE scoped heuristic v1', scannedFiles: files.length, findings, limitation: 'No history or account audit; heuristic patterns cannot detect every secret.' }, null, 2));
process.exitCode = findings.length ? 1 : 0;
