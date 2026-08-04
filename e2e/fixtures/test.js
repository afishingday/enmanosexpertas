import { test as base, expect } from '@playwright/test'
import { CLICK_HIGHLIGHT_SCRIPT } from '../utils/clickHighlight.js'

// Extiende el test base para que, en TODAS las páginas usadas por el test,
// cada click quede marcado visualmente (útil en el video grabado).
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(CLICK_HIGHLIGHT_SCRIPT)
    await use(page)
  },
})

export { expect }
