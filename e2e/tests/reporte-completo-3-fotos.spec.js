import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../fixtures/test.js'
import { LoginPage } from '../pages/LoginPage.js'
import { ReporteFormPage } from '../pages/ReporteFormPage.js'
import { listReportPhotos } from '../utils/assets.js'
import { pickRandom } from '../utils/random.js'
import { PDFS_DIR } from '../utils/paths.js'

// Escenario 2: TODO lleno (ninguna zona/concepto queda sin calificar), pero
// liviano — solo 3 fotos y 2 colaboradores, para tener una corrida rápida
// del camino feliz completo. A la primera foto sí se le hace un recorte
// real (arrastrando el marco), el resto se aceptan completas.
const COLABORADORES = 2
const CANTIDAD_FOTOS = 3

test(`informe COMPLETO con ${COLABORADORES} colaboradores y ${CANTIDAD_FOTOS} fotos`, async ({ page }) => {
  const fotos = pickRandom(listReportPhotos(), CANTIDAD_FOTOS)
  console.log(`[assets] fotos: ${fotos.map(f => path.basename(f)).join(', ')}`)

  await test.step('login', async () => {
    const login = new LoginPage(page)
    await login.goto()
    await login.login(process.env.E2E_USERNAME, process.env.E2E_PASSWORD)
  })

  const reporte = new ReporteFormPage(page)
  await test.step('esperar a que cargue el formulario', () => reporte.esperarCargado())

  await test.step('datos de la copropiedad', async () => {
    await reporte.seleccionarCopropiedadAleatoria()
    await reporte.establecerHoraAleatoria()
  })

  await test.step(`agregar ${COLABORADORES} colaboradores a evaluar`, async () => {
    await reporte.agregarColaboradores(COLABORADORES)
    const elegidos = await reporte.seleccionarColaboradoresAleatorios()
    expect(elegidos.length).toBe(COLABORADORES)
  })

  await test.step('llenar el 100% de zonas y conceptos', async () => {
    await reporte.rellenarZonas()
    await reporte.rellenarConceptos()
  })

  await test.step('observaciones y responsable', async () => {
    await reporte.escribirObservaciones(
      `Visita de prueba automatizada (Playwright) — informe completo con ${COLABORADORES} colaboradores y ${CANTIDAD_FOTOS} fotos.`
    )
    await reporte.establecerResponsable('QA Playwright')
  })

  await test.step('agregar fotos (la primera con recorte real)', async () => {
    await reporte.agregarFotos(fotos)
    await reporte.resolverColaDeFotos({ recortarPrimera: true })
    await reporte.rellenarDescripcionesFotos()
  })

  const descarga = await test.step('guardar y generar PDF', () =>
    reporte.guardarYGenerarPDF({ timeout: 90_000 })
  )

  await test.step('verificar el PDF descargado', async () => {
    const destino = path.join(PDFS_DIR, `informe-completo-${COLABORADORES}-colaboradores-${fotos.length}-fotos-${Date.now()}.pdf`)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    await descarga.saveAs(destino)
    expect(fs.statSync(destino).size).toBeGreaterThan(1000)
  })
})
