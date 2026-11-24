import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'node_modules',
      'public/mockServiceWorker.js',
      'src/routeTree.gen.ts',
      'playwright-report',
      'test-results',
      'lighthouse/reports',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': 'off',
    },
  },
  // Regras de fronteira da arquitetura (eliminatórios ELIM-05 e MOCK-01):
  // o código de aplicação não pode importar a camada de mocks nem usar fetch direto.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/mocks/**', 'src/main.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@/mocks/*', '**/mocks/*'], message: 'A UI não pode depender da camada de mocks (MSW).' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Todas as chamadas REST devem passar pelo cliente Axios (src/api/http.ts).' },
      ],
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    extends: [js.configs.recommended],
    languageOptions: { globals: { ...globals.node } },
  },
)
