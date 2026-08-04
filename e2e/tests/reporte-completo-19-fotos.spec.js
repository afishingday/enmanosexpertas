import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../fixtures/test.js'
import { LoginPage } from '../pages/LoginPage.js'
import { ReporteFormPage } from '../pages/ReporteFormPage.js'
import { listReportPhotos } from '../utils/assets.js'
import { pickRandom } from '../utils/random.js'
import { PDFS_DIR } from '../utils/paths.js'

// Escenario 1: TODO lleno (ninguna zona/concepto queda sin calificar) +
// TODAS las fotos que haya en assets/reporte (hoy 19; se ajusta sola a lo
// que encuentre) + el máximo de colaboradores a evaluar (6). Es el
// escenario de carga máxima con datos 100% completos.
const TODAS_LAS_FOTOS = listReportPhotos()
const COLABORADORES = 6

test(`informe COMPLETO con ${COLABORADORES} colaboradores y las ${TODAS_LAS_FOTOS.length} fotos disponibles`, async ({ page }) => {
  test.setTimeout(10 * 60 * 1000)

  const fotos = pickRandom(TODAS_LAS_FOTOS, TODAS_LAS_FOTOS.length)
  console.log(`[assets] ${fotos.length} fotos, orden: ${fotos.map(f => path.basename(f)).join(', ')}`)

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

  await test.step('llenar el 100% de zonas y conceptos (de los 6 colaboradores)', async () => {
    await reporte.rellenarZonas()
    await reporte.rellenarConceptos()
  })

  await test.step('observaciones y responsable', async () => {
    await reporte.escribirObservaciones(
      `Visita de prueba automatizada (Playwright) — informe completo con ${COLABORADORES} colaboradores y las ${fotos.length} fotos disponibles.`
    )
    await reporte.establecerResponsable('QA Playwright')
  })

  await test.step('agregar todas las fotos (se aceptan completas, sin recorte individual)', async () => {
    await reporte.agregarFotos(fotos)
    await reporte.resolverColaDeFotos({ recortarPrimera: false, esperaInicial: 3 * 60 * 1000 })
    await reporte.rellenarDescripcionesFotos()
  })

  const descarga = await test.step('guardar y generar PDF', () =>
    reporte.guardarYGenerarPDF({ timeout: 6 * 60 * 1000 })
  )

  await test.step('verificar el PDF descargado', async () => {
    const destino = path.join(PDFS_DIR, `informe-completo-${COLABORADORES}-colaboradores-${fotos.length}-fotos-${Date.now()}.pdf`)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    await descarga.saveAs(destino)
    expect(fs.statSync(destino).size).toBeGreaterThan(1000)
  })
})
