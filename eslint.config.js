import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Flat config for the browser React app. The rules-of-hooks + exhaustive-deps
// checks matter here beyond the usual: the spoiler rule leans on SealBox's
// lazy render function and InningViewer's `revealedThrough` memoization, so a
// mis-declared dependency array is exactly the kind of bug that could leak a
// sealed value. Keep those on.
export default [
  { ignores: ['dist/', 'dev-dist/', 'node_modules/'] },

  // App source — browser globals, JSX, hooks.
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.serviceworker },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    settings: { react: { version: '18.3' } },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat['jsx-runtime'].rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      // This app doesn't use PropTypes (no runtime type layer by design) —
      // component contracts are documented in comments. Turn off the noise.
      'react/prop-types': 'off',
      // The API layer intentionally uses empty catch blocks to degrade MiLB
      // feeds gracefully (see mlb.js) — allow a bare `catch {}`.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Allow deliberately-unused args prefixed with _ and caught errors.
      'no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },

  // Node build scripts (icon generation, etc.).
  {
    files: ['scripts/**/*.{js,mjs}', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },
]
