// filas: [{ nombre, revisado:'SI'|'NO', valor:'1'..'5'|'' }]
// Una fila "SI" sin valor es un ítem que el usuario nunca llenó: no cuenta
// ni a favor ni en contra (no suma al máximo posible).
export function sumar(filas) {
  let max = 0, alc = 0
  filas.forEach(r => {
    if ((r.nombre || '').trim() && r.revisado === 'SI' && r.valor) {
      max += 5
      alc += parseInt(r.valor) || 0
    }
  })
  const ef = max ? Math.round((alc / max) * 100) : 0
  return { max, alc, ef, efectividad: ef }
}
