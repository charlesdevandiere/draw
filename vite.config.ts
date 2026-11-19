import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

const THEME_COLOR = '#fff4d6';

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
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      // Les icônes du manifest et le manifest lui-même sont déjà couverts par globPatterns.
      includeManifestIcons: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg}'],
        navigateFallback: null,
      },
      manifest: {
        name: 'Carnet magique',
        short_name: 'Carnet',
        description: 'Carnet de dessin pour enfants, hors ligne.',
        lang: 'fr',
        start_url: '/draw/',
        scope: '/draw/',
        display: 'standalone',
        orientation: 'any',
        background_color: THEME_COLOR,
        theme_color: THEME_COLOR,
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
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
