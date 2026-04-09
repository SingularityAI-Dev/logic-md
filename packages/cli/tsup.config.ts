import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  shims: true,
  banner: { js: '#!/usr/bin/env node' },
  noExternal: ['@logic-md/core'],
  external: ['yaml', 'gray-matter', 'ajv', 'ajv-formats'],
})
