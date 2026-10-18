import js from '@eslint/js';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

const shared = {
  'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
  'no-shadow': 'error',
  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-var': 'error',
  'prefer-const': 'error',
  'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'data/**',
      'docs/v2-parked/**',
      'public/sw.js',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } },
    settings: { react: { version: '18' } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      ...shared,
      'react/prop-types': 'off', // types come from JSDoc, checked by tsc
      'react/no-unescaped-entities': 'off',
      'react/jsx-no-target-blank': 'error',
    },
  },
  {
    files: ['server/**/*.js', 'api/**/*.js', 'test/**/*.js', 'e2e/**/*.js', '*.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: globals.node },
    rules: shared,
  },
  {
    // Playwright's page.evaluate() callbacks run in the browser.
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  { files: ['public/sw.js'], languageOptions: { globals: globals.serviceworker } },
  prettier,
];
