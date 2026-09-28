import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 5_000 },
  fullyParallel: false,
  outputDir: 'test-results',
  reporter: 'list',
  testDir: './apps/demo/e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @atiraui/demo dev -- --host 127.0.0.1 --port 4173',
    env: { VITE_TEST_FIXTURES: 'true' },
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:4173/?fixture=workflow',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: 'chat-performance.spec.ts',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Measure the frame budget without competing workers or trace capture.
      name: 'performance',
      dependencies: ['chromium'],
      testMatch: 'chat-performance.spec.ts',
      use: { ...devices['Desktop Chrome'], trace: 'off' },
    },
  ],
})
