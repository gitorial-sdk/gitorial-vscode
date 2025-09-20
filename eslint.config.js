const tsParser = require('@typescript-eslint/parser');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');

module.exports = [
  {
    // Global ignores
    ignores: [
      'node_modules/**',
      'dist/**',
      'out/**',
      '*.vsix',
      '.vscode-test/**',
      '.eslintcache',
      '**/*.min.js',
      '**/*.map',
      'webview-ui/dist/**',
      'packages/*/dist/**',
      'packages/*/lib/**',
    ],
  },
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/naming-convention': [
        'warn',
        {
          selector: 'import',
          format: ['camelCase', 'PascalCase'],
        },
      ],

      // Code quality rules
      eqeqeq: 'warn',
      'no-throw-literal': 'warn',
      'no-unused-vars': 'off', // Use TypeScript's version instead
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        }
      ],

      // Code quality and logic rules (non-formatting)
      curly: ['warn', 'all'], // Always require braces

      // Forbid deep imports into workspace packages; enforce public entrypoints
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@gitorial/*/src/**',
                '@gitorial/*/dist/**',
              ],
              message:
                'Do not deep import from monorepo packages (src/dist). Use the package public subpaths (e.g. "@gitorial/shared-types/commit").',
            },
            {
              group: ['**/packages/**'],
              message:
                'Do not import workspace packages via relative paths. Use the package name instead (e.g. "@gitorial/shared-types").',
            },
          ],
        },
      ],
    },
  },
];
