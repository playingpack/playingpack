import { defineConfig } from 'tsup';
import { resolve } from 'path';

export default defineConfig({
  entry: ['src/index.ts', 'src/config-helper.ts'],
  format: ['esm'],
  clean: true,
  minify: true,
  dts: true,
  noExternal: ['@playingpack/shared'],
  esbuildOptions(options) {
    options.alias = {
      '@playingpack/shared': resolve(__dirname, '../shared/dist/index.js'),
    };
  },
});
