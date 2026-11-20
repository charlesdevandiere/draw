import { defineConfig } from '@playwright/test';

const PORT = 4173;

/** Reference layouts: iPad 11 landscape and Pixel 9a portrait, both with touch. */
const TABLET = { viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true };
const PHONE = { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, hasTouch: true };

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/draw/`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium-tablet', use: { browserName: 'chromium', ...TABLET } },
    { name: 'webkit-tablet', use: { browserName: 'webkit', ...TABLET } },
    { name: 'chromium-phone', use: { browserName: 'chromium', ...PHONE } },
    { name: 'webkit-phone', use: { browserName: 'webkit', ...PHONE } },
  ],
  // The production build, as deployed (service worker included).
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/draw/`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
