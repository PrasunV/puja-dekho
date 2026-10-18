import { defineConfig } from '@playwright/test';

/**
 * e2e runs against the production build served by the real Express server (npm run build first).
 * Set PLAYWRIGHT_CHROMIUM_PATH to use a Chromium you already have instead of downloading one.
 */
const PORT = 3111;
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
    geolocation: { latitude: 22.5186, longitude: 88.3467 },
    permissions: ['geolocation'],
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
      args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    },
  },
  webServer: {
    command: 'rm -rf .e2e-data && node server/index.js',
    port: PORT,
    env: { PORT: String(PORT), DATA_DIR: '.e2e-data', SECRET: 'e2e-secret' },
    reuseExistingServer: !process.env.CI,
  },
});
