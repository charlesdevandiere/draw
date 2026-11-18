import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/draw/',
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
