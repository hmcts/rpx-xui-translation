import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export default [
  { ignores: ['dist/**', 'out-tsc/**', '.angular/**', 'coverage/**'] },
  {
    files: ['projects/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: dirname(fileURLToPath(import.meta.url))
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@stylistic': stylistic
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs['eslint-recommended'].overrides[0].rules,
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-inferrable-types': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'array-bracket-spacing': 'error',
      'arrow-parens': ['error', 'always'],
      'arrow-spacing': 'error',
      'block-spacing': 'error',
      'brace-style': ['error', '1tbs'],
      'comma-dangle': ['error', 'never'],
      'comma-spacing': 'error',
      'comma-style': 'error',
      'computed-property-spacing': 'error',
      'curly': ['error', 'all'],
      'dot-notation': 'error',
      'eol-last': 'error',
      'eqeqeq': 'error',
      'func-call-spacing': ['error', 'never'],
      // 'func-style': ['error', 'expression'],
      'getter-return': 'error',
      'grouped-accessor-pairs': ['error', 'getBeforeSet'],
      'key-spacing': 'error',
      'keyword-spacing': 'error',
      'indent': ['error', 2, {
        'SwitchCase': 1
      }],
      'linebreak-style': 'error',
      'lines-between-class-members': ['error', 'always', {
        'exceptAfterSingleLine': true
      }],
      'new-parens': ['error', 'always'],
      'no-case-declarations': 'off',
      'no-else-return': 'error',
      'no-empty': 'error',
      // 'no-empty-function': ['error', {
      //   'allow': ['constructors']
      // }],
      'no-extra-boolean-cast': 'off',
      '@stylistic/no-extra-semi': 'error',
      'no-mixed-spaces-and-tabs': 'error',
      'no-multi-spaces': 'error',
      'no-multiple-empty-lines': ['error', {
        'max': 1,
        'maxEOF': 1
      }],
      'no-prototype-builtins': 'off',
      'no-tabs': 'error',
      'no-trailing-spaces': 'error',
      'no-whitespace-before-property': 'error',
      'no-unreachable': 'error',
      'no-unused-expressions': ['error', {
        'allowTernary': true
      }],
      'no-var': 'error',
      // 'object-curly-newline': ['error', { 'multiline': true }],
      'object-curly-spacing': ['error', 'always'],
      // 'object-property-newline': 'error',
      'padded-blocks': ['error', 'never'],
      'prefer-const': 'error',
      'quotes': ['error', 'single'],
      'semi': ['error', 'always', {
        'omitLastInOneLineBlock': false
      }],
      'semi-spacing': 'error',
      'semi-style': ['error', 'last'],
      'space-in-parens': ['error', 'never'],
      'switch-colon-spacing': 'error'
    }
  }
];
