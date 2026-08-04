// Compresión y recorte de imágenes (portado de la herramienta original)
export const EDIT_MAX = 1800
export const MAX_FOTO_KB = 300

export function pesoBytes(dataUrl) {
  return dataUrl ? Math.round(dataUrl.length * 0.75) : 0
}
export function pesoKB(dataUrl) {
  return Math.round(pesoBytes(dataUrl) / 1024)
}

// Redimensiona a un máximo de píxeles y devuelve un JPEG (dataURL)
export function reencode(src, maxDim, q) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let { width: w, height: h } = img
      if (w > maxDim || h > maxDim) {
        const s = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * s); h = Math.round(h * s)
      }
      const cv = document.createElement('canvas')
      cv.width = w; cv.height = h
      const cx = cv.getContext('2d')
      cx.fillStyle = '#fff'; cx.fillRect(0, 0, w, h)
      cx.drawImage(img, 0, 0, w, h)
      resolve(cv.toDataURL('image/jpeg', q))
    }
    img.src = src
  })
}

// Comprime reduciendo calidad y, si no alcanza, tamaño, hasta quedar bajo maxKB
// (o hasta agotar los intentos, devolviendo el mejor resultado logrado).
export function comprimir(src, maxKB = MAX_FOTO_KB) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      let w = img.width, h = img.height
      const maxDim = 1280
      if (w > maxDim || h > maxDim) {
        const s = maxDim / Math.max(w, h)
        w = Math.round(w * s); h = Math.round(h * s)
      }
      const cv = document.createElement('canvas')
      const cx = cv.getContext('2d')
      const minDim = 480, minQ = 0.4
      let q = 0.75, out = ''
      for (let i = 0; i < 20; i++) {
        cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h))
        cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height)
        cx.drawImage(img, 0, 0, cv.width, cv.height)
        out = cv.toDataURL('image/jpeg', q)
        if (pesoKB(out) <= maxKB) break
        if (q > minQ) { q -= 0.06; continue }
        if (w > minDim && h > minDim) { w = Math.round(w * 0.86); h = Math.round(h * 0.86); q = 0.75; continue }
        break // ya al mínimo de tamaño y calidad: se entrega el mejor esfuerzo
      }
      resolve(out)
    }
    img.src = src
  })
}

// Lee un File y devuelve { full, src } (full = base de edición, src = comprimido para guardar)
export async function procesarArchivo(file) {
  const dataUrl = await new Promise((res) => {
    const r = new FileReader(); r.onload = e => res(e.target.result); r.readAsDataURL(file)
  })
  const full = await reencode(dataUrl, EDIT_MAX, 0.92)
  const src = await comprimir(full)
  return { full, src }
}

// Recorta una región (en coordenadas de la imagen mostrada) y recomprime
export async function recortar(fullSrc, box, dispW) {
  const img = await new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = fullSrc })
  const sc = img.naturalWidth / dispW
  let sw = Math.round(box.w * sc), sh = Math.round(box.h * sc)
  const sx = Math.round(box.x * sc), sy = Math.round(box.y * sc)
  let dw = sw, dh = sh
  if (dw > EDIT_MAX || dh > EDIT_MAX) { const s = Math.min(EDIT_MAX / dw, EDIT_MAX / dh); dw = Math.round(dw * s); dh = Math.round(dh * s) }
  const cv = document.createElement('canvas'); cv.width = dw; cv.height = dh
  cv.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh)
  const full = cv.toDataURL('image/jpeg', 0.92)
  const src = await comprimir(full)
  return { full, src }
}

// Rota 90° una imagen (dataURL) y la devuelve
export function rotar90(src) {
  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas'); cv.width = img.height; cv.height = img.width
      const cx = cv.getContext('2d')
      cx.translate(cv.width / 2, cv.height / 2); cx.rotate(Math.PI / 2)
      cx.drawImage(img, -img.width / 2, -img.height / 2)
      res(cv.toDataURL('image/jpeg', 0.92))
    }
    img.src = src
  })
}
