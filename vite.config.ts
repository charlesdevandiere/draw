import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: '/draw/',
  css: {
    preprocessorOptions: {
      // Lets Sass resolve `bootstrap/scss/...` partials from node_modules.
      scss: { loadPaths: ['node_modules'] },
    },
  },
  build: {
    rolldownOptions: {
      input: {
        main: 'index.html',
        en: 'en/index.html',
        fr: 'fr/index.html',
        diagnostic: 'diagnostic.html',
        'en-diagnostic': 'en/diagnostic.html',
        'fr-diagnostic': 'fr/diagnostic.html',
        'en-parent': 'en/parent.html',
        'fr-parent': 'fr/parent.html',
      },
    },
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,txt}'],
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
        'src/app/gesture-protections.ts',
        'src/app/screens.ts',
        'src/app/draw-screen.ts',
        'src/app/mode-button.ts',
        'src/app/tools.ts',
        'src/app/dom.ts',
        'src/store/db.ts',
        'src/app/raster.ts',
        'src/app/gallery-screen.ts',
        'src/app/share.ts',
        'src/app/replay-screen.ts',
        'src/app/padlock.ts',
        'src/parent/drawings.ts',
        'src/parent/transfer.ts',
        'src/parent/input-settings.ts',
        'src/app/magic-image.ts',
        'src/app-version.ts',
        'src/pwa/app-update.ts',
        'src/vite-env.d.ts',
        'src/diagnostic/environment.ts',
        'src/diagnostic/stroke-renderer.ts',
        'src/diagnostic/gesture-protections.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 90, statements: 90 },
    },
  },
});
