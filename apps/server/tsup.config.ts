import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/migrate.ts', 'scripts/grant-admin.ts'],
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // @soon/shared ships TypeScript source, so bundle it into the server build.
  noExternal: ['@soon/shared'],
});
