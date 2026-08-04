import 'dotenv/config'
import { defineConfig, devices } from '@playwright/test'

// Viewport grande y video sin reescalar -> mejor calidad posible de grabación.
const VIEWPORT = { width: 1920, height: 1080 }

export default defineConfig({
  testDir: './tests',
  timeout: 3 * 60 * 1000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  outputDir: 'test-results',

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:5173',
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    video: { mode: 'on', size: VIEWPORT },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    actionTimeout: 20_000,
    navigationTimeout: 30_000,
    launchOptions: {
      // Deja cada acción "visible" un instante -> mejores videos de demo.
      slowMo: 150,
    },
  },

  // Si ya tienes `npm run dev` corriendo (carpeta padre), lo reutiliza tal cual.
  webServer: {
    command: 'npm run dev',
    cwd: '..',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
