import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/draw/',
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
        en: 'en/index.html',
        fr: 'fr/index.html',
        diagnostic: 'diagnostic.html',
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        navigateFallback: null,
      },
      // One hand-written manifest per language folder (public/en, public/fr).
      manifest: false,
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Threshold on pure modules only: the DOM is confined to these files (spec/SPEC-mvp.md).
      exclude: [
        'src/**/*.test.ts',
        'src/**/main.ts',
        'src/redirect.ts',
        'src/i18n/apply.ts',
        'src/app-version.ts',
        'src/diagnostic/app-update.ts',
        'src/vite-env.d.ts',
        'src/diagnostic/environment.ts',
        'src/diagnostic/stroke-renderer.ts',
        'src/diagnostic/gesture-protections.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
