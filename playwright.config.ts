import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'junit.xml' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3001/mediavault',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 30000,
    navigationTimeout: 30000
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] }
    },

    // Mobile devices - iOS
    {
      name: 'iphone-se',
      use: { ...devices['iPhone SE'] }
    },
    {
      name: 'iphone-12-pro',
      use: { ...devices['iPhone 12 Pro'] }
    },
    {
      name: 'iphone-12-pro-max',
      use: { ...devices['iPhone 12 Pro Max'] }
    },

    // Mobile devices - Android
    {
      name: 'pixel-5',
      use: { ...devices['Pixel 5'] }
    },
    {
      name: 'galaxy-s21',
      use: {
        ...devices['Galaxy S9+'],
        viewport: { width: 360, height: 800 }
      }
    },

    // Tablets
    {
      name: 'ipad-portrait',
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 768, height: 1024 }
      }
    },
    {
      name: 'ipad-landscape',
      use: {
        ...devices['iPad (gen 7) landscape'],
        viewport: { width: 1024, height: 768 }
      }
    }
  ],

  webServer: {
    command: 'npm run start:dev',
    url: 'http://localhost:3001/mediavault/health',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
});