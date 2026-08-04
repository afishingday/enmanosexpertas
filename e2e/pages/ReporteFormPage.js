import { randomInt, pickRandom } from '../utils/random.js'

const TITULO_ZONAS = 'Información general — zonas'
const TITULO_CONCEPTOS = 'Conceptos evaluados'

export class ReporteFormPage {
  constructor(page) {
    this.page = page

    this.copropiedad = page.getByLabel('Copropiedad')
    this.fecha = page.getByLabel('Fecha')
    this.hora = page.getByLabel('Hora')
    this.observaciones = page.getByPlaceholder('Observaciones de la visita…')
    this.responsable = page.getByLabel('Responsable de la visita')
    this.fotosInput = page.locator('.dropzone input[type="file"]')
    this.modalRecorte = page.locator('.modal.on')
    this.btnUsarCompleta = page.getByRole('button', { name: 'Usar completa' })
    this.btnAplicarRecorte = page.getByRole('button', { name: '✓ Aplicar' })
    this.btnAgregarColaborador = page.getByRole('button', { name: '+ Agregar colaborador a evaluar' })
    this.btnSoloPDF = page.getByRole('button', { name: /Solo PDF/ })
    this.btnGuardar = page.getByRole('button', { name: /Guardar y generar PDF/ })
    this.mensaje = page.locator('.acciones .msg')
  }

  // Una tarjeta "Evaluación del auxiliar operativo[ #N]" por cada colaborador agregado.
  seccionesEvaluacion() {
    return this.page.locator('section.card', {
      has: this.page.getByRole('heading', { name: /^Evaluación del auxiliar operativo/ }),
    })
  }

  async esperarCargado() {
    await this.page.getByRole('heading', { name: 'Datos de la copropiedad' }).waitFor({ state: 'visible' })
    // Espera a que el <select> de copropiedad tenga algo más que el placeholder
    // (confirma que ya llegaron los clientes desde Firestore).
    await this.page.waitForFunction(() => {
      const sel = [...document.querySelectorAll('select')].find(s =>
        s.closest('label')?.textContent?.startsWith('Copropiedad')
      )
      return sel && sel.options.length > 1
    })
  }

  async seleccionarOpcionAleatoria(select) {
    const valores = await select.locator('option').evaluateAll(
      opts => opts.map(o => o.value).filter(v => v)
    )
    if (!valores.length) throw new Error('El selector no tiene opciones para elegir.')
    const elegido = valores[randomInt(0, valores.length - 1)]
    await select.selectOption(elegido)
    return elegido
  }

  async seleccionarCopropiedadAleatoria() {
    return this.seleccionarOpcionAleatoria(this.copropiedad)
  }

  // Agrega (n - 1) colaboradores extra a evaluar (por defecto ya hay 1 al cargar el formulario).
  async agregarColaboradores(n = 1) {
    for (let i = 1; i < n; i++) await this.btnAgregarColaborador.click()
  }

  // Elige un colaborador distinto para cada tarjeta "Evaluación del auxiliar operativo" presente.
  async seleccionarColaboradoresAleatorios() {
    const secciones = this.seccionesEvaluacion()
    const total = await secciones.count()
    if (!total) return []
    const opciones = await secciones.nth(0).locator('select').locator('option').evaluateAll(
      opts => opts.map(o => o.value).filter(v => v)
    )
    const elegidos = pickRandom(opciones, Math.min(total, opciones.length))
    for (let i = 0; i < elegidos.length; i++) {
      await secciones.nth(i).locator('select').selectOption(elegidos[i])
    }
    return elegidos
  }

  filasDeTabla(titulo) {
    const seccion = this.page.locator('section.card', {
      has: this.page.getByRole('heading', { name: titulo, exact: true }),
    })
    return seccion.locator('.zrow')
  }

  // Llena el 100% de las filas: "Sí" + una calificación 1-5 al azar. Ninguna
  // queda sin evaluar.
  async rellenarTablaCompleta(titulo) {
    const filas = this.filasDeTabla(titulo)
    const total = await filas.count()
    for (let i = 0; i < total; i++) {
      await filas.nth(i).locator('select.val').selectOption(String(randomInt(1, 5)))
    }
    return total
  }

  // Llena solo una parte de las filas (con "Sí" + calificación); el resto se
  // deja tal cual llegó del catálogo, sin tocar — para probar que esas no
  // salgan en el PDF. Devuelve cuántas quedaron llenas y cuántas sin llenar.
  async rellenarTablaParcial(titulo, { probabilidadLlenar = 0.5 } = {}) {
    const filas = this.filasDeTabla(titulo)
    const total = await filas.count()
    let llenadas = 0
    for (let i = 0; i < total; i++) {
      if (Math.random() < probabilidadLlenar) {
        await filas.nth(i).locator('select.val').selectOption(String(randomInt(1, 5)))
        llenadas++
      }
    }
    return { total, llenadas, sinLlenar: total - llenadas }
  }

  async rellenarZonas() {
    return this.rellenarTablaCompleta(TITULO_ZONAS)
  }

  async rellenarConceptos() {
    return this.rellenarTablaCompleta(TITULO_CONCEPTOS)
  }

  async rellenarZonasParcial(opciones) {
    return this.rellenarTablaParcial(TITULO_ZONAS, opciones)
  }

  async rellenarConceptosParcial(opciones) {
    return this.rellenarTablaParcial(TITULO_CONCEPTOS, opciones)
  }

  async establecerHoraAleatoria() {
    const h = String(randomInt(6, 20)).padStart(2, '0')
    const m = String(randomInt(0, 59)).padStart(2, '0')
    await this.hora.fill(`${h}:${m}`)
  }

  async escribirObservaciones(texto) {
    await this.observaciones.fill(texto)
  }

  async establecerResponsable(texto) {
    await this.responsable.fill(texto)
  }

  // Selecciona N fotos (mismo diálogo de archivos, selección múltiple).
  async agregarFotos(rutas) {
    await this.fotosInput.setInputFiles(rutas)
  }

  // Arrastra la esquina inferior derecha del marco de recorte para achicarlo
  // (ejercita el recorte real, no solo "usar completa").
  async arrastrarEsquinaRecorte() {
    const esquina = this.page.locator('.cropbox .br')
    const caja = await esquina.boundingBox()
    if (!caja) return
    const x = caja.x + caja.width / 2
    const y = caja.y + caja.height / 2
    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    await this.page.mouse.move(x - 130, y - 110, { steps: 15 })
    await this.page.mouse.up()
  }

  // Resuelve la cola de edición de fotos que se abre tras `agregarFotos`.
  // `recortarPrimera`: si hay fotos, a la primera le hace un recorte real
  // (arrastrando una esquina) antes de aplicar; el resto se aceptan completas
  // (más rápido y realista para lotes grandes).
  async resolverColaDeFotos({ recortarPrimera = false, esperaInicial = 120_000 } = {}) {
    await this.modalRecorte.waitFor({ state: 'visible', timeout: esperaInicial })
    let esLaPrimera = true
    while (await this.modalRecorte.isVisible().catch(() => false)) {
      if (esLaPrimera && recortarPrimera) {
        await this.arrastrarEsquinaRecorte()
        await this.btnAplicarRecorte.click()
      } else if (await this.btnUsarCompleta.isVisible().catch(() => false)) {
        await this.btnUsarCompleta.click()
      } else {
        await this.btnAplicarRecorte.click()
      }
      esLaPrimera = false
      // deja que React re-renderice la siguiente foto de la cola (o cierre el modal)
      await this.page.waitForTimeout(250)
    }
  }

  async rellenarDescripcionesFotos(prefijo = 'Foto de prueba automatizada') {
    const areas = this.page.locator('.foto textarea')
    const total = await areas.count()
    for (let i = 0; i < total; i++) {
      await areas.nth(i).fill(`${prefijo} #${i + 1}`)
    }
    return total
  }

  async generarSoloPDF({ timeout = 60_000 } = {}) {
    const [descarga] = await Promise.all([
      this.page.waitForEvent('download', { timeout }),
      this.btnSoloPDF.click(),
    ])
    return descarga
  }

  // Flujo completo: guarda el informe en Firestore/Storage y descarga el PDF.
  async guardarYGenerarPDF({ timeout = 90_000 } = {}) {
    const [descarga] = await Promise.all([
      this.page.waitForEvent('download', { timeout }),
      this.btnGuardar.click(),
    ])
    await this.mensaje
      .filter({ hasText: 'Informe guardado en la nube y PDF descargado' })
      .waitFor({ timeout })
    return descarga
  }
}
