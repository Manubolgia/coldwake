import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 150_000,
  fullyParallel: true,
  workers: 2,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173/coldwake/',
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 840 },
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM }
      : {},
  },
  webServer: {
    // Bind the loopback address explicitly. Left to itself Vite listens on
    // "localhost", and on a runner whose hosts file has an IPv6 loopback that
    // resolves to ::1 first — so the server comes up on [::1] while Playwright
    // waits on 127.0.0.1 until it gives up.
    command: 'npm run preview -- --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173/coldwake/',
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
