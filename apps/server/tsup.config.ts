import { defineConfig } from 'tsup';

export default defineConfig({
  // Named entries keep a flat dist/ (dist/index.js, dist/migrate.js, ...) even though
  // sources live in different folders — the Dockerfile CMD depends on these paths.
  entry: {
    index: 'src/index.ts',
    migrate: 'src/migrate.ts',
    'grant-admin': 'scripts/grant-admin.ts',
  },
  format: ['esm'],
  target: 'node22',
  platform: 'node',
  clean: true,
  sourcemap: true,
  // @soon/shared ships TypeScript source, so bundle it into the server build.
  noExternal: ['@soon/shared'],
});
