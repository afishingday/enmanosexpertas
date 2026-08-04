# e2e — automatización de pruebas (Playwright)

Automatización end-to-end del flujo de creación de un informe en
**En Manos Expertas**. Vive en `enmanosexpertas/e2e/` como proyecto Node
aparte (`package.json`, dependencias y `node_modules` propios) para no mezclar
las dependencias de Playwright con las de la app — pero es parte de este
repositorio.

Cubre el flujo completo tal como lo usa un colaborador real:
login → elegir copropiedad → agregar uno o más colaboradores a evaluar →
calificar zonas y conceptos (completo o dejando algunas sin llenar, según el
escenario) → observaciones y responsable → agregar y recortar fotos →
**Guardar y generar PDF**. Cada corrida usa datos al azar (copropiedad,
colaboradores, calificaciones, fotos) para no repetir siempre lo mismo.

## Estructura (Page Object Model)

```
pages/       LoginPage, ReporteFormPage — la única fuente de selectores
tests/       specs, uno por escenario
fixtures/    test.js — inyecta el resaltado de clicks en cada página
utils/       random.js (sorteo sin repetir), assets.js (listar fotos),
             clickHighlight.js (script que dibuja el click en el video)
assets/      fotos de prueba (no se versionan, ver abajo)
```

## Requisitos previos

1. **Instalar dependencias**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Credenciales de prueba** — copia `.env.example` a `.env` y completa
   `E2E_USERNAME` / `E2E_PASSWORD` con una cuenta real de la app.
   **Usa una cuenta de prueba (colaborador), no tu admin personal**: cada
   corrida crea un informe real en Firestore y sube fotos/PDF reales a
   Storage — no es un ambiente aislado ni un emulador.

3. **Assets de fotos** — ya se copiaron desde
   `C:\Users\usuario\Downloads\playwrightassets\reporte` a `assets/reporte/`.

   Están en `.gitignore` (son binarios pesados y contenido personal). Si
   clonas este proyecto en otro lado o quieres renovar el set de fotos,
   vuelve a copiarlas ahí manualmente.

4. **El dev server de la app** — `playwright.config.js` ya sabe levantar
   `npm run dev` en la carpeta padre (`enmanosexpertas/`) si no está
   corriendo, y reutiliza el que ya esté arriba en `http://localhost:5173`.

## Correr las pruebas

Desde `enmanosexpertas/e2e/`:

```bash
npm run test:smoke              # chequeo rápido: la app carga, hay fotos (sin login)
npm test                        # los 3 escenarios, en modo headless
npm run test:headed             # con navegador visible
npm run test:ui                 # modo interactivo de Playwright
npm run test:completo-19-fotos  # solo el escenario 1
npm run test:completo-3-fotos   # solo el escenario 2
npm run test:incompleto         # solo el escenario 3
npm run report                  # abre el último reporte HTML
```

O desde la raíz de `enmanosexpertas/`, sin cambiar de carpeta:

```bash
npm run test:e2e            # las dos pruebas
npm run test:e2e:headed     # con navegador visible
npm run test:e2e:smoke      # chequeo rápido, sin login
```

Los videos (siempre se graban, a 1920×1080) y el reporte quedan en
`test-results/` y `playwright-report/` — **Playwright borra el contenido de
`test-results/` al empezar cada corrida**, así que los PDFs generados se
guardan aparte, en `pdfs-generados/`, para que no se pierdan de una corrida
a otra.

## Escenarios

- **`reporte-completo-19-fotos.spec.js`** — carga máxima, datos 100%
  completos: **6 colaboradores** evaluados (el tope que pidió cubrir el
  negocio), cada zona y cada concepto de cada colaborador con su
  calificación (ninguna fila queda sin evaluar) + **todas** las fotos que
  haya en `assets/reporte/` (hoy 19; se ajusta sola a lo que encuentre). Las
  fotos se aceptan completas (sin recorte individual) para que la corrida no
  sea eterna. Timeout extendido (10 min).
- **`reporte-completo-3-fotos.spec.js`** — el mismo "todo lleno", pero
  liviano: **2 colaboradores**, **3 fotos** (a la primera se le hace un
  recorte real, arrastrando el marco). Pensado para correr rápido en cada
  cambio.
- **`reporte-incompleto-3-fotos.spec.js`** — a propósito deja **algunas
  zonas y conceptos sin tocar** (ni siquiera se les asigna "Sí"/"No", quedan
  tal cual llegan del catálogo) — ejercita que esas filas **no aparezcan**
  en el PDF generado. La prueba falla si por mala suerte del azar terminó
  llenando el 100%, para garantizar que de verdad quedó algo sin evaluar.
  2 colaboradores, 3 fotos.

En los tres, las fotos usadas nunca se repiten dentro del mismo informe, y
cada colaborador agregado es distinto (nunca se evalúa al mismo dos veces en
un mismo informe).

## Resaltado de clicks en el video

`fixtures/test.js` inyecta un script (`utils/clickHighlight.js`) en cada
página del test: dibuja un punto + un anillo animado en cada `mousedown`
(mouse o touch), sin interferir con la interacción real. Así en el video se
ve exactamente dónde se hizo cada click, incluido el arrastre de la esquina
del recorte.

## Notas

- Las pruebas corren en serie (`workers: 1`), no en paralelo — comparten
  la misma cuenta y evita videos confusos con varios navegadores a la vez.
- Si cambian los textos/labels del formulario en `enmanosexpertas`, los
  selectores viven solo en `pages/*.js` — no hay que tocar los specs.
