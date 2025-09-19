import typescriptEslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

export default [
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

      // Formatting rules (comprehensive and consistent)
      semi: ['warn', 'always'],
      quotes: ['warn', 'single', { avoidEscape: true }],
      curly: ['warn', 'all'], // Always require braces
      'brace-style': ['warn', '1tbs', { allowSingleLine: false }],
      'comma-dangle': ['warn', 'always-multiline'],
      indent: ['warn', 2, { SwitchCase: 1 }],
      'no-trailing-spaces': 'warn',
      'eol-last': ['warn', 'always'],
      'object-curly-spacing': ['warn', 'always'],
      'array-bracket-spacing': ['warn', 'never'],
      'comma-spacing': ['warn', { before: false, after: true }],
      'key-spacing': ['warn', { beforeColon: false, afterColon: true }],
      'space-before-blocks': ['warn', 'always'],
      'space-before-function-paren': ['warn', 'never'],
      'space-in-parens': ['warn', 'never'],
      'space-infix-ops': 'warn',
      'keyword-spacing': ['warn', { before: true, after: true }],

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
