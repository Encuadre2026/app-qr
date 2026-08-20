// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: ['dist/', 'dev-dist/', 'node_modules/'],
  },
  {
    // El código de la aplicación corre en el navegador; `scripts/` y los
    // ficheros de configuración, en Node. Sin declarar los dos entornos,
    // `no-undef` marca `document` en un lado o `process` en el otro.
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },
);
