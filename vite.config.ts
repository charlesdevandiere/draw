import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/draw/',
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
        diagnostic: 'diagnostic.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Seuil sur les modules purs uniquement : le DOM est confiné à ces fichiers (SPEC.md).
      exclude: [
        'src/**/*.test.ts',
        'src/**/main.ts',
        'src/app-version.ts',
        'src/vite-env.d.ts',
        'src/diagnostic/environment.ts',
        'src/diagnostic/stroke-renderer.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
