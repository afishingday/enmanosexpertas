import { test, expect } from '../fixtures/test.js'
import { LoginPage } from '../pages/LoginPage.js'
import { listReportPhotos } from '../utils/assets.js'

test('smoke: la app carga y el login es visible (sin credenciales)', async ({ page }) => {
  expect(listReportPhotos().length).toBeGreaterThan(0)

  const login = new LoginPage(page)
  await login.goto()
  await expect(login.usuario).toBeVisible()
  await expect(login.clave).toBeVisible()
  await expect(login.entrar).toBeVisible()
})
