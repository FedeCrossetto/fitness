const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', 'supabase/functions/**', 'scripts/**', 'src/generated/**'],
  },
  {
    rules: {
      'no-unused-vars': 'off',
    },
  },
]);
