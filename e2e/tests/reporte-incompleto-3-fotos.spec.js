import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '../fixtures/test.js'
import { LoginPage } from '../pages/LoginPage.js'
import { ReporteFormPage } from '../pages/ReporteFormPage.js'
import { listReportPhotos } from '../utils/assets.js'
import { pickRandom } from '../utils/random.js'
import { PDFS_DIR } from '../utils/paths.js'

// Escenario 3: a propósito se dejan ALGUNAS zonas/conceptos sin llenar (ni
// siquiera se tocan, quedan tal cual llegan del catálogo) + 3 fotos. Ejercita
// que esas filas sin evaluar no salgan en el PDF generado.
const COLABORADORES = 2
const CANTIDAD_FOTOS = 3
const PROBABILIDAD_LLENAR = 0.5 // ~mitad de las filas quedan sin tocar

test(`informe INCOMPLETO (con zonas/conceptos sin llenar) y ${CANTIDAD_FOTOS} fotos`, async ({ page }) => {
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

  await test.step('dejar zonas y conceptos parcialmente sin llenar', async () => {
    const zonas = await reporte.rellenarZonasParcial({ probabilidadLlenar: PROBABILIDAD_LLENAR })
    const conceptos = await reporte.rellenarConceptosParcial({ probabilidadLlenar: PROBABILIDAD_LLENAR })
    console.log(`[zonas] ${zonas.llenadas} llenas / ${zonas.sinLlenar} sin llenar (de ${zonas.total})`)
    console.log(`[conceptos] ${conceptos.llenadas} llenas / ${conceptos.sinLlenar} sin llenar (de ${conceptos.total})`)
    // que de verdad haya quedado al menos una fila sin llenar, si no la prueba no prueba nada
    expect(zonas.sinLlenar + conceptos.sinLlenar).toBeGreaterThan(0)
  })

  await test.step('observaciones y responsable', async () => {
    await reporte.escribirObservaciones(
      `Visita de prueba automatizada (Playwright) — informe con zonas/conceptos sin llenar a propósito y ${CANTIDAD_FOTOS} fotos.`
    )
    await reporte.establecerResponsable('QA Playwright')
  })

  await test.step('agregar fotos (se aceptan completas)', async () => {
    await reporte.agregarFotos(fotos)
    await reporte.resolverColaDeFotos({ recortarPrimera: false })
    await reporte.rellenarDescripcionesFotos()
  })

  const descarga = await test.step('guardar y generar PDF', () =>
    reporte.guardarYGenerarPDF({ timeout: 90_000 })
  )

  await test.step('verificar el PDF descargado', async () => {
    const destino = path.join(PDFS_DIR, `informe-incompleto-${fotos.length}-fotos-${Date.now()}.pdf`)
    fs.mkdirSync(path.dirname(destino), { recursive: true })
    await descarga.saveAs(destino)
    expect(fs.statSync(destino).size).toBeGreaterThan(1000)
  })
})
