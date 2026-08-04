import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Fuera de "test-results": Playwright limpia ese directorio al empezar cada
// corrida, así que los PDFs de corridas anteriores se perderían si vivieran ahí.
export const PDFS_DIR = path.resolve(__dirname, '..', 'pdfs-generados')
