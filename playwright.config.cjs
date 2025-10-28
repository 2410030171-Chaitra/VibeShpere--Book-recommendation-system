const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    actionTimeout: 15_000,
    baseURL: 'http://127.0.0.1:3000',
    // Artifacts: screenshots on failure, video retained on failure, and trace on first retry
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry'
  },
  // Reporters: keep the concise list reporter and an HTML report for artifacts
  reporters: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  // webServer will start a preview server automatically in CI (or reuse an existing one locally)
  webServer: {
    command: 'npx vite preview --port 3000 --strictPort --host 127.0.0.1',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } }
  ]
});
