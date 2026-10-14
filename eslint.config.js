import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '.tools/**', '.library-transfer/**', 'artifacts/**', 'test-results/**', 'playwright-report/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: { globals: { console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly', TextEncoder: 'readonly', TextDecoder: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly', setImmediate: 'readonly', structuredClone: 'readonly', performance: 'readonly', globalThis: 'readonly', fetch: 'readonly', document: 'readonly', window: 'readonly', navigator: 'readonly', Worker: 'readonly', File: 'readonly', Blob: 'readonly', self: 'readonly', postMessage: 'readonly', localStorage: 'readonly', requestAnimationFrame: 'readonly', AbortController: 'readonly' } },
    rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] }
  }
);
