import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:5173', viewport: { width: 1200, height: 800 } },
  webServer: { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: true },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
