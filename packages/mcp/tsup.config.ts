import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/server.ts'],
  format: ['esm'],
  clean: true,
  shims: true,
  platform: 'node',
  banner: { js: '#!/usr/bin/env node' },
  noExternal: ['@logic-md/core'],
  // gray-matter and yaml are CJS packages that rely on Node built-ins (require('process')).
  // Keeping them external preserves the createRequire path that @logic-md/core uses at runtime.
  external: ['gray-matter', 'yaml'],
  // SDK and Zod are NOT in noExternal — they are public npm packages
})
