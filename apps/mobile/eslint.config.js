const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['node_modules/**', 'supabase/functions/**', 'scripts/**'],
  },
  {
    rules: {
      'no-unused-vars': 'off',
    },
  },
]);
