// Metro config for monorepo: watch the repo root and resolve hoisted deps.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// NOTA: @reset-fitness/shared resuelve sus subpaths (ej. "shared/auth/...")
// vía package.json#exports, así que NO desactivar unstable_enablePackageExports
// acá — rompe esos imports en todo el monorepo. Si una librería de terceros
// trae un mapa de exports roto para Metro, mejor cambiarla que tocar esto.

module.exports = config;
