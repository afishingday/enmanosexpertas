import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ASSETS_DIR = path.resolve(__dirname, '..', 'assets')
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i

function listImages(subfolder) {
  const dir = path.join(ASSETS_DIR, subfolder)
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir)
    .filter(f => IMAGE_EXT.test(f))
    .sort()
    .map(f => path.join(dir, f))
}

// Todas las fotos disponibles para armar el registro fotográfico del informe.
export const listReportPhotos = () => listImages('reporte')
