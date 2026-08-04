// Autoguardado del formulario de reporte en localStorage, para no perder el
// trabajo si se va la conexión o se cierra la pestaña antes de guardar.
// Un borrador por usuario (uid), para no mezclar el de una cuenta con otra
// en un dispositivo compartido.
const clave = (uid) => `informe_borrador_${uid}`

export function guardarBorrador(uid, datos) {
  if (!uid) return
  const payload = { ...datos, guardadoEn: Date.now() }
  try {
    localStorage.setItem(clave(uid), JSON.stringify(payload))
  } catch {
    // cupo de localStorage excedido (normalmente por fotos pesadas):
    // reintenta sin fotos, que sí es liviano y vale la pena salvar igual.
    try {
      localStorage.setItem(clave(uid), JSON.stringify({ ...payload, fotos: [], fotosOmitidas: true }))
    } catch { /* si ni así cabe, no hay más por hacer */ }
  }
}

export function leerBorrador(uid) {
  if (!uid) return null
  try {
    const raw = localStorage.getItem(clave(uid))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function borrarBorrador(uid) {
  if (!uid) return
  try { localStorage.removeItem(clave(uid)) } catch { /* no crítico */ }
}

// ¿Vale la pena ofrecer restaurarlo, o está prácticamente vacío (recién cargó el formulario)?
export function borradorTieneContenido(b) {
  if (!b) return false
  return !!(
    b.clienteId ||
    b.observaciones?.trim() ||
    b.fotos?.length ||
    b.zonas?.some(z => z.valor) ||
    b.evaluaciones?.some(ev => ev.colaboradorId || ev.conceptos?.some(c => c.valor))
  )
}
