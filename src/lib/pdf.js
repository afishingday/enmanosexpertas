// Generación del PDF paginado (sin cortes) y no editable.
// Portado de la herramienta original: arma bloques, los reparte en páginas A4
// y renderiza cada página como imagen -> el texto no se puede editar.
import { jsPDF } from 'jspdf'
import html2canvas from 'html2canvas'
import { LOGO } from './logo'

const A4W = 794, A4H = 1123, PADPX = 38, CONTENT_H = A4H - PADPX * 2
const FOTO_MAX_W = 714, FOTO_MAX_H = 400 // = ancho de contenido (A4W - 2*40) x alto del marco
const CALIF_FALLBACK = { 5: 'Excelente', 4: 'Bueno', 3: 'Regular', 2: 'Malo', 1: 'Deficiente' }

const esc = s => (s ?? '').toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmtFecha = f => { if (!f) return ''; const p = f.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f }

// jsPDF (al menos 2.5.x) corrompe el /Title del PDF cuando tiene tildes, "—"
// u otro caracter fuera de ASCII Y la encriptación está activa (se comprobó:
// con encriptación + texto 100% ASCII el título sale bien; con tildes/— sale
// con bytes basura). Mientras no se actualice/arregle jsPDF, el título que
// se guarda como metadato del PDF se deja en ASCII plano. Se exporta para
// que el nombre del archivo (calculado en ReporteForm) use exactamente el
// mismo texto que el título — así nunca quedan desalineados.
export function tituloAscii(s) {
  return (s ?? '').toString()
    .replace(/[—–]/g, '-') // guiones largos -> guion simple, antes de descomponer
    .normalize('NFD') // separa "ó" en "o" + tilde combinante...
    .replace(/[^\x00-\x7F]/g, '') // ...y aquí se descarta la tilde (y cualquier otro no-ASCII)
    .trim()
}

// Dimensión natural de una imagen (dataURL). html2canvas no soporta bien
// "object-fit" en todos los casos (sobre todo con relaciones de aspecto muy
// distintas a la del recuadro, p. ej. una foto vertical) y puede terminar
// ESTIRANDO la imagen en vez de ajustarla — por eso el tamaño final se
// calcula acá, a mano, y se aplica como width/height explícitos.
function medirImagen(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth || 4, h: img.naturalHeight || 3 })
    img.onerror = () => resolve({ w: 4, h: 3 })
    img.src = src
  })
}

// Tamaño que cabe dentro de maxW x maxH conservando la proporción (equivalente a object-fit:contain).
function ajustarContenido(w, h, maxW, maxH) {
  const s = Math.min(maxW / w, maxH / h)
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) }
}

function filasTabla(rows, calif) {
  return rows
    .filter(r => (r.nombre || '').trim())
    // solo lo que realmente se evaluó (tiene una calificación) sale en el reporte;
    // lo no revisado o dejado sin llenar simplemente no aparece.
    .filter(r => r.valor)
    .map(r => `<tr><td>${esc(r.nombre)}</td><td>Sí</td><td>${r.valor}</td><td class="cal-b">${calif[r.valor]}</td></tr>`)
    .join('')
}

function buildBlocks(d) {
  const calif = d.calif || CALIF_FALLBACK
  const B = []
  B.push(`<div class="r-head"><img src="${LOGO}">
    <div class="ht"><div class="emp">En Manos Expertas S.A.S.</div>
      <div class="nit">NIT 900.321.564 · Mantenimiento locativo</div>
      <div class="tit">INFORME DE SUPERVISIÓN</div></div></div>`)
  B.push(`<div class="r-sec"><h3>Datos de la copropiedad</h3><div class="r-info">
      <div class="k">Copropiedad: <span>${esc(d.cliente?.nombre)}</span></div>
      <div class="k">NIT: <span>${esc(d.cliente?.nit)}</span></div>
      <div class="k">Dirección: <span>${esc(d.cliente?.direccion)}</span></div>
      <div class="k">Administrador: <span>${esc(d.cliente?.administrador)}</span></div>
      <div class="k">Fecha: <span>${fmtFecha(d.fecha)}</span></div>
      <div class="k">Hora: <span>${esc(d.hora)}</span></div></div></div>`)
  B.push(`<div class="r-sec"><h3>Información general</h3>
      <table class="rt"><thead><tr><th>Zona</th><th>Revisado</th><th>Valor</th><th>Calificación</th></tr></thead>
      <tbody>${filasTabla(d.zonas || [], calif)}</tbody></table></div>`)
  const auxiliares = d.auxiliares?.length ? d.auxiliares : [{ conceptos: d.conceptos || [] }]
  auxiliares.forEach((aux, i) => {
    const sufijo = auxiliares.length > 1 ? ` #${i + 1}` : ''
    B.push(`<div class="r-sec"><h3>Evaluación del auxiliar operativo${sufijo}</h3><div class="r-info" style="margin-bottom:8px">
      <div class="k">Colaborador: <span>${esc(aux.nombre)}</span></div>
      <div class="k">Cédula: <span>${esc(aux.cedula)}</span></div>
      <div class="k">EPS: <span>${esc(aux.eps)}</span></div>
      <div class="k">ARL: <span>${esc(aux.arl)}</span></div></div>
      <table class="rt"><thead><tr><th>Concepto</th><th>Revisado</th><th>Valor</th><th>Calificación</th></tr></thead>
      <tbody>${filasTabla(aux.conceptos || [], calif)}</tbody></table></div>`)
  })
  if (d.observaciones?.trim())
    B.push(`<div class="r-sec"><h3>Observaciones</h3><div class="obs">${esc(d.observaciones)}</div></div>`)
  B.push(`<div class="r-sec"><h3>Resumen de efectividad</h3><div class="r-resumen">
      <div class="b"><div class="n">${d.efC?.ef ?? 0}%</div><div class="l">Efectividad copropiedad</div></div>
      <div class="b"><div class="n">${d.efC?.alc ?? 0}/${d.efC?.max ?? 0}</div><div class="l">Puntaje copropiedad</div></div>
      <div class="b"><div class="n">${d.efL?.ef ?? 0}%</div><div class="l">Efectividad colaborador</div></div></div></div>`)
  B.push(`<div class="firma-wrap">
      <div class="firma-box"><div class="ln">${esc(d.responsable)}<br><span class="sub">Responsable de la visita</span></div></div>
      <div class="firma-box"><div class="ln">&nbsp;<br><span class="sub">Firma administración</span></div></div></div>`)
  ;(d.fotos || []).forEach((f, i) => {
    const cap = f.cap?.trim() ? `<div class="cap">${esc(f.cap)}</div>` : ''
    const titulo = i === 0 ? `<h3 style="margin-top:18px">Registro fotográfico</h3>` : ''
    const { w, h } = ajustarContenido(f.w || 4, f.h || 3, FOTO_MAX_W, FOTO_MAX_H)
    B.push(`${titulo}<div class="r-foto"><div class="r-foto-marco"><img src="${f.src}" style="width:${w}px;height:${h}px"></div>${cap}</div>`)
  })
  B.push(`<div class="r-foot">Documento generado con la plataforma de informes de En Manos Expertas S.A.S. · ${new Date().toLocaleDateString('es-CO')}</div>`)
  return B
}

const CSS = `
.pg{width:794px;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif}
.r-head{display:flex;align-items:center;gap:16px;border-bottom:3px solid #F2A900;padding-bottom:14px;margin-bottom:6px}
.r-head img{height:74px}
.r-head .emp{font-size:20px;font-weight:800}.r-head .nit{font-size:12px;color:#555}
.r-head .tit{display:inline-block;margin-top:6px;background:#F2A900;color:#1a1a1a;font-weight:800;padding:4px 14px;border-radius:6px;font-size:14px}
.r-sec{margin-top:18px}
.r-sec h3{font-size:14px;margin:0 0 8px;background:#1a1a1a;color:#fff;padding:7px 12px;border-radius:6px 6px 0 0}
.r-info{display:grid;grid-template-columns:1fr 1fr;gap:6px 22px;font-size:13px;padding:2px 4px}
.r-info .k{color:#666;font-weight:600}.r-info span{color:#1a1a1a;font-weight:700}
table.rt{width:100%;border-collapse:collapse;font-size:12.5px}
table.rt th{background:#F2A900;color:#1a1a1a;text-align:left;padding:6px 9px;font-size:11.5px;text-transform:uppercase}
table.rt td{padding:6px 9px;border-bottom:1px solid #eee}
table.rt tr:nth-child(even) td{background:#fafafa}
.cal-b{font-weight:700}
.obs{font-size:13px;line-height:1.55;padding:8px 4px;white-space:pre-wrap}
.firma-wrap{display:flex;gap:40px;margin-top:50px}
.firma-box{flex:1;text-align:center}
.firma-box .ln{border-top:1.5px solid #1a1a1a;padding-top:6px;font-size:12.5px;font-weight:700}
.firma-box .sub{font-weight:400;color:#666}
.r-foto{margin-bottom:16px;border:1px solid #e4e4e7;border-radius:8px;overflow:hidden}
.r-foto-marco{width:100%;height:400px;display:flex;align-items:center;justify-content:center;background:#fafafa}
.r-foto img{display:block}
.r-foto .cap{padding:8px 12px;font-size:12.5px;color:#333;border-top:2px solid #F2A900}
.r-resumen{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;margin-top:6px}
.r-resumen .b{border:1px solid #e4e4e7;border-radius:8px;padding:12px}
.r-resumen .n{font-size:24px;font-weight:800}
.r-resumen .l{font-size:11px;color:#666;text-transform:uppercase;font-weight:700;margin-top:3px}
.r-foot{margin-top:24px;border-top:1px solid #ddd;padding-top:8px;font-size:10.5px;color:#999;text-align:center}
`

function paginar(blocks, meas) {
  const pages = [[]]; let curH = 0
  blocks.forEach(html => {
    meas.innerHTML = html
    const h = meas.getBoundingClientRect().height
    if (curH > 0 && curH + h > CONTENT_H - 16) { pages.push([]); curH = 0 }
    pages[pages.length - 1].push(html); curH += h
  })
  return pages
}

// Genera el PDF y lo descarga. Devuelve también el dataURL (para subir a Storage).
export async function generarPDF(datos, nombreArchivo) {
  const fotosConTamaño = await Promise.all(
    (datos.fotos || []).map(async f => ({ ...f, ...(await medirImagen(f.src)) }))
  )
  const datosConFotos = { ...datos, fotos: fotosConTamaño }

  const host = document.createElement('div')
  host.style.cssText = 'position:absolute;left:-10000px;top:0'
  host.innerHTML = `<style>${CSS}</style>
    <div id="meas" style="position:absolute;left:0;top:0;width:714px;visibility:hidden"></div>
    <div id="pages"></div>`
  document.body.appendChild(host)
  try {
    const meas = host.querySelector('#meas')
    const pagesData = paginar(buildBlocks(datosConFotos), meas)
    const cont = host.querySelector('#pages')
    pagesData.forEach(pg => {
      const d = document.createElement('div')
      d.style.cssText = `width:${A4W}px;height:${A4H}px;background:#fff;overflow:hidden`
      d.innerHTML = `<div class="pg" style="padding:${PADPX}px 40px">${pg.join('')}</div>`
      cont.appendChild(d)
    })
    await new Promise(r => setTimeout(r, 180)) // dejar cargar imágenes
    let pdf
    try { pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', encryption: { userPermissions: ['print'] } }) }
    catch { pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' }) }
    const els = cont.children
    for (let i = 0; i < els.length; i++) {
      const canvas = await html2canvas(els[i], { scale: 1.5, backgroundColor: '#ffffff', useCORS: true, windowWidth: A4W })
      const img = canvas.toDataURL('image/jpeg', 0.8)
      if (i > 0) pdf.addPage()
      pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST')
    }
    const titulo = tituloAscii((nombreArchivo || 'Informe de Supervision').replace(/\.pdf$/i, '')) || 'Informe de Supervision'
    pdf.setProperties({ title: titulo, creator: 'En Manos Expertas S.A.S.' })
    const dataUrl = pdf.output('datauristring')
    pdf.save(nombreArchivo || 'informe.pdf')
    return dataUrl
  } finally {
    document.body.removeChild(host)
  }
}
