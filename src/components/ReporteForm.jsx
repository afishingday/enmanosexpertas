import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listarClientes, listarEmpleados, listarCatalogo, obtenerCalificaciones, CALIF_DEFAULT, crearInforme, actualizarInforme, subirDataURL, registrarUsoStorage } from '../lib/datos'
import { sumar } from '../lib/calc'
import { procesarArchivo, pesoKB, pesoBytes, MAX_FOTO_KB } from '../lib/imagen'
import { generarPDF, tituloAscii } from '../lib/pdf'
import { guardarBorrador, leerBorrador, borrarBorrador, borradorTieneContenido } from '../lib/borrador'
import CropModal from './CropModal'
import { IconTrash } from './Icons'

const AUTOGUARDADO_MS = 800

const nuevaFila = (nombre) => ({ nombre, revisado: 'SI', valor: '' })
const nuevaEvaluacion = (conceptosBase) => ({
  id: crypto.randomUUID(), colaboradorId: '', conceptos: conceptosBase.map(r => ({ ...r })),
})

export default function ReporteForm() {
  const { user, perfil, esAdmin } = useAuth()
  const [clientes, setClientes] = useState([])
  const [empleados, setEmpleados] = useState([])
  const [zonas, setZonas] = useState([])
  const [conceptosBase, setConceptosBase] = useState([]) // plantilla del catálogo para nuevos colaboradores
  const [evaluaciones, setEvaluaciones] = useState([])   // [{ id, colaboradorId, conceptos }]
  const [calif, setCalif] = useState(CALIF_DEFAULT)

  const [clienteId, setClienteId] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [hora, setHora] = useState(new Date().toTimeString().slice(0, 5))
  const [observaciones, setObservaciones] = useState('')
  const [responsable, setResponsable] = useState(perfil?.nombre || '')
  const [fotos, setFotos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [msg, setMsg] = useState('')

  // autoguardado / recuperación de borrador
  const [listo, setListo] = useState(false)       // ya cargaron los datos base -> se puede autoguardar
  const [borrador, setBorrador] = useState(null)   // borrador previo pendiente de aceptar/descartar

  // cola de recorte
  const [cola, setCola] = useState([])          // índices de fotos por editar
  const [colaTotal, setColaTotal] = useState(0)
  const [editando, setEditando] = useState(null) // índice actual en edición, o null

  useEffect(() => {
    (async () => {
      const [cs, es, cat, cf] = await Promise.all([listarClientes(), listarEmpleados(), listarCatalogo(), obtenerCalificaciones()])
      setClientes(cs); setEmpleados(es); setCalif(cf)
      const z = cat.filter(i => i.tipo === 'zona' && i.activo !== false).map(i => nuevaFila(i.nombre))
      const c = cat.filter(i => i.tipo === 'concepto' && i.activo !== false).map(i => nuevaFila(i.nombre))
      setZonas(z)
      setConceptosBase(c)
      setEvaluaciones([nuevaEvaluacion(c)])

      const b = leerBorrador(user.uid)
      if (borradorTieneContenido(b)) setBorrador(b)
    })().catch(e => setMsg('Error cargando datos: ' + e.message))
      .finally(() => setListo(true))
  }, [])

  // autoguardado (con espera corta para no escribir en cada tecla) — se detiene
  // mientras haya un borrador previo sin resolver, para no pisarlo antes de decidir.
  useEffect(() => {
    if (!listo || borrador) return
    const t = setTimeout(() => {
      guardarBorrador(user.uid, { clienteId, fecha, hora, zonas, evaluaciones, observaciones, responsable, fotos })
    }, AUTOGUARDADO_MS)
    return () => clearTimeout(t)
  }, [listo, borrador, clienteId, fecha, hora, zonas, evaluaciones, observaciones, responsable, fotos])

  const continuarBorrador = () => {
    if (!borrador) return
    if (borrador.clienteId) setClienteId(borrador.clienteId)
    if (borrador.fecha) setFecha(borrador.fecha)
    if (borrador.hora) setHora(borrador.hora)
    if (borrador.zonas?.length) setZonas(borrador.zonas)
    if (borrador.evaluaciones?.length) setEvaluaciones(borrador.evaluaciones)
    if (borrador.observaciones) setObservaciones(borrador.observaciones)
    if (borrador.responsable) setResponsable(borrador.responsable)
    if (borrador.fotos?.length) setFotos(borrador.fotos.map(f => ({ src: f.src, cap: f.cap || '' })))
    setBorrador(null)
  }
  const descartarBorrador = () => { borrarBorrador(user.uid); setBorrador(null) }

  const cliente = useMemo(() => clientes.find(c => c.id === clienteId), [clientes, clienteId])
  const colaboradorDe = (id) => empleados.find(e => e.id === id)
  const efC = useMemo(() => sumar(zonas), [zonas])
  const efL = useMemo(() => sumar(evaluaciones.flatMap(ev => ev.conceptos)), [evaluaciones])

  const setFila = (setter, i, campo, val) => setter(prev => prev.map((r, k) => k === i ? { ...r, [campo]: val } : r))
  const addFila = (setter) => setter(prev => [...prev, nuevaFila('')])

  /* ---------- evaluaciones (uno o más colaboradores a evaluar) ---------- */
  const agregarColaborador = () => setEvaluaciones(prev => [...prev, nuevaEvaluacion(conceptosBase)])
  const quitarColaborador = (id) => setEvaluaciones(prev => prev.length > 1 ? prev.filter(ev => ev.id !== id) : prev)
  const setColaboradorDeEval = (id, colaboradorId) =>
    setEvaluaciones(prev => prev.map(ev => ev.id === id ? { ...ev, colaboradorId } : ev))
  const setConceptoDeEval = (id, i, campo, val) => setEvaluaciones(prev => prev.map(ev =>
    ev.id === id ? { ...ev, conceptos: ev.conceptos.map((r, k) => k === i ? { ...r, [campo]: val } : r) } : ev
  ))
  const agregarConceptoDeEval = (id) => setEvaluaciones(prev => prev.map(ev =>
    ev.id === id ? { ...ev, conceptos: [...ev.conceptos, nuevaFila('')] } : ev
  ))

  /* ---------- fotos ---------- */
  const onFiles = async (fileList) => {
    const files = [...fileList].filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    const nuevas = []
    for (const f of files) nuevas.push({ ...(await procesarArchivo(f)), cap: '' })
    setFotos(prev => {
      const start = prev.length
      const arr = [...prev, ...nuevas]
      const q = nuevas.map((_, k) => start + k)
      setCola(q); setColaTotal(q.length); setEditando(q[0])
      return arr
    })
  }
  const terminarEdicion = (resultado) => {
    if (resultado && editando != null) {
      setFotos(prev => prev.map((f, k) => k === editando ? { ...f, full: resultado.full, src: resultado.src } : f))
    }
    setCola(prev => {
      const rest = prev.slice(1)
      setEditando(rest.length ? rest[0] : null)
      return rest
    })
  }
  const reEditar = (i) => { setColaTotal(1); setCola([i]); setEditando(i) }
  const cancelarEdicion = () => { setCola([]); setEditando(null) }
  const quitarFoto = (i) => setFotos(prev => prev.filter((_, k) => k !== i))
  const setCap = (i, cap) => setFotos(prev => prev.map((f, k) => k === i ? { ...f, cap } : f))
  const totalPeso = fotos.reduce((s, f) => s + pesoKB(f.src), 0)

  /* ---------- datos para PDF / guardado ---------- */
  const armarAuxiliares = () => evaluaciones.map(ev => {
    const c = colaboradorDe(ev.colaboradorId)
    return { nombre: c?.nombre, cedula: c?.cedula, eps: c?.eps, arl: c?.arl, conceptos: ev.conceptos }
  })
  const armarDatos = () => ({
    cliente: cliente ? { nombre: cliente.nombre, nit: cliente.nit, direccion: cliente.direccion, administrador: cliente.administrador } : {},
    fecha, hora,
    auxiliares: armarAuxiliares(),
    zonas, observaciones, responsable,
    fotos: fotos.map(f => ({ src: f.src, cap: f.cap })),
    efC, efL, calif,
  })
  // Nombre de archivo = título del documento: Copropiedad - Supervisor - Fecha.
  // Se calcula una sola vez con tituloAscii (la misma normalización que usa
  // el título interno del PDF, ver pdf.js) para que archivo y título nunca
  // queden desalineados; después solo se evitan los caracteres que Windows
  // no permite en un nombre de archivo.
  const paraNombreArchivo = (s) => (s || '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
  const nombreArchivo = () => {
    const copropiedad = cliente?.nombre || 'Informe'
    const supervisor = perfil?.nombre || 'Supervisor'
    const titulo = tituloAscii(`${copropiedad} - ${supervisor} - ${fecha}`) || 'Informe de Supervision'
    return `${paraNombreArchivo(titulo)}.pdf`
  }

  const soloPDF = async () => {
    if (!cliente) return setMsg('Selecciona la copropiedad primero.')
    setMsg('Generando PDF…')
    await generarPDF(armarDatos(), nombreArchivo())
    setMsg('')
  }

  const guardar = async () => {
    if (!cliente) return setMsg('Selecciona la copropiedad.')
    if (evaluaciones.some(ev => !ev.colaboradorId)) {
      return setMsg('Selecciona el colaborador en cada evaluación (o quita la que no necesites con la papelera).')
    }
    setGuardando(true); setMsg('Guardando…')
    try {
      // 1. crear el informe (sin urls todavía)
      const auxiliares = armarAuxiliares()
      const base = {
        cliente_id: cliente.id, cliente_nombre: cliente.nombre,
        colaborador_id: user.uid, colaborador_nombre: perfil?.nombre || '',
        fecha, hora,
        datos: { zonas, auxiliares, observaciones, responsable },
        efectividad_cliente: efC.ef, efectividad_colaborador: efL.ef,
        estado: 'finalizado',
      }
      const ref = await crearInforme(base)
      // 2. generar y subir el PDF
      setMsg('Generando y subiendo PDF…')
      const pdfDataUrl = await generarPDF(armarDatos(), nombreArchivo())
      const pdf_path = `pdfs/${ref.id}.pdf`
      const pdf_url = await subirDataURL(pdf_path, pdfDataUrl)
      const pdf_bytes = pesoBytes(pdfDataUrl)
      // 3. subir fotos
      const fotosSubidas = []
      let fotosBytes = 0
      for (let i = 0; i < fotos.length; i++) {
        setMsg(`Subiendo foto ${i + 1} de ${fotos.length}…`)
        const path = `fotos/${ref.id}/${i}.jpg`
        const url = await subirDataURL(path, fotos[i].src)
        const bytes = pesoBytes(fotos[i].src)
        fotosBytes += bytes
        fotosSubidas.push({ url, cap: fotos[i].cap, orden: i, bytes })
      }
      await actualizarInforme(ref.id, { pdf_path, pdf_url, pdf_bytes, fotos: fotosSubidas })
      // registrar el uso de Storage no debe tumbar el guardado si falla
      registrarUsoStorage(pdf_bytes + fotosBytes).catch(() => {})
      borrarBorrador(user.uid) // ya quedó a salvo en la nube, no hace falta el borrador local
      setMsg('✓ Informe guardado en la nube y PDF descargado.')
    } catch (e) {
      setMsg('Error al guardar: ' + e.message)
    } finally { setGuardando(false) }
  }

  const fotoEnEdicion = editando != null ? fotos[editando] : null

  return (
    <div className="form-wrap">
      {borrador && (
        <div className="borrador">
          <p>
            Encontramos un informe sin terminar de {new Date(borrador.guardadoEn).toLocaleString('es-CO')}.
            {borrador.fotosOmitidas && ' Las fotos no alcanzaron a guardarse en el borrador — tendrás que agregarlas de nuevo.'}
          </p>
          <div className="row-actions">
            <button className="btn btn-ghost" onClick={descartarBorrador}>Empezar de nuevo</button>
            <button className="btn btn-amarillo" onClick={continuarBorrador}>Continuar donde quedé</button>
          </div>
        </div>
      )}

      {/* Datos copropiedad */}
      <section className="card">
        <h2>Datos de la copropiedad</h2>
        <div className="grid g2">
          <label>Copropiedad
            <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
              <option value="">— Selecciona —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
          <label>Fecha<input type="date" value={fecha} onChange={e => setFecha(e.target.value)} /></label>
          <label>Hora<input type="time" value={hora} onChange={e => setHora(e.target.value)} /></label>
        </div>
        {cliente && <p className="muted">NIT {cliente.nit || '—'} · {cliente.direccion || 's/d'} · Adm: {cliente.administrador || '—'}</p>}
      </section>

      {/* Información general */}
      <TablaCalif titulo="Información general — zonas" colLabel="Zona" filas={zonas} calif={calif}
        onCampo={(i, c, v) => setFila(setZonas, i, c, v)}
        onAdd={esAdmin ? () => addFila(setZonas) : null} />

      {/* Colaboradores a evaluar (uno o más) */}
      {evaluaciones.map((ev, idx) => {
        const colab = colaboradorDe(ev.colaboradorId)
        return (
          <div key={ev.id}>
            <section className="card">
              <h2>Evaluación del auxiliar operativo{evaluaciones.length > 1 ? ` #${idx + 1}` : ''}</h2>
              <div className="grid g2">
                <label>Colaborador
                  <select value={ev.colaboradorId} onChange={e => setColaboradorDeEval(ev.id, e.target.value)}>
                    <option value="">— Selecciona —</option>
                    {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                  </select>
                </label>
                {evaluaciones.length > 1 && (
                  <div className="row-actions" style={{ alignSelf: 'end', marginBottom: 2 }}>
                    <button className="icon-btn danger" title="Quitar este colaborador" aria-label="Quitar este colaborador"
                      onClick={() => quitarColaborador(ev.id)}><IconTrash /></button>
                  </div>
                )}
              </div>
              {colab && <p className="muted">Cédula {colab.cedula || '—'} · EPS {colab.eps || '—'} · ARL {colab.arl || '—'}</p>}
            </section>
            <TablaCalif titulo="Conceptos evaluados" colLabel="Concepto" filas={ev.conceptos} calif={calif}
              onCampo={(i, c, v) => setConceptoDeEval(ev.id, i, c, v)}
              onAdd={esAdmin ? () => agregarConceptoDeEval(ev.id) : null} />
          </div>
        )
      })}
      <section className="card">
        <button className="addbtn" onClick={agregarColaborador}>+ Agregar colaborador a evaluar</button>
      </section>

      {/* Observaciones */}
      <section className="card">
        <h2>Observaciones</h2>
        <textarea value={observaciones} onChange={e => setObservaciones(e.target.value)} placeholder="Observaciones de la visita…" />
        <label style={{ marginTop: 12 }}>Responsable de la visita<input value={responsable} onChange={e => setResponsable(e.target.value)} /></label>
      </section>

      {/* Fotos */}
      <section className="card">
        <h2>Registro fotográfico <span className="pill">{fotos.length} · {totalPeso > 1024 ? (totalPeso / 1024).toFixed(1) + ' MB' : totalPeso + ' KB'}</span></h2>
        <p className="muted">Cada foto se comprime automáticamente a un máximo de ~{MAX_FOTO_KB} KB.</p>
        <label className="dropzone">
          📷 Toca para agregar fotos (se abre el recorte al subir)
          <input type="file" accept="image/*" multiple capture="environment" style={{ display: 'none' }}
            onChange={e => { onFiles(e.target.files); e.target.value = '' }} />
        </label>
        <div className="fotos">
          {fotos.map((f, i) => (
            <div className="foto" key={i}>
              <button className="rm" onClick={() => quitarFoto(i)}>✕</button>
              <button className="edit" onClick={() => reEditar(i)}>✂ Recortar</button>
              <span className="peso">{pesoKB(f.src)} KB</span>
              <img src={f.src} alt="" />
              <textarea placeholder="Descripción…" value={f.cap} onChange={e => setCap(i, e.target.value)} />
            </div>
          ))}
        </div>
      </section>

      {/* Resumen */}
      <section className="card">
        <h2>Resumen de efectividad</h2>
        <div className="resumen">
          <Box n={efC.max} l="Máx. copropiedad" /><Box n={efC.alc} l="Alcanzado" /><Box n={efC.ef + '%'} l="Efectividad" hl />
        </div>
        <div className="resumen" style={{ marginTop: 12 }}>
          <Box n={efL.max} l="Máx. colaborador" /><Box n={efL.alc} l="Alcanzado" /><Box n={efL.ef + '%'} l="Efectividad" hl />
        </div>
      </section>

      <div className="acciones">
        {msg && <span className="msg">{msg}</span>}
        <button className="btn btn-ghost" onClick={soloPDF} disabled={guardando}>⬇ Solo PDF</button>
        <button className="btn btn-amarillo" onClick={guardar} disabled={guardando}>☁ Guardar y generar PDF</button>
      </div>

      {fotoEnEdicion && (
        <CropModal fullSrc={fotoEnEdicion.full || fotoEnEdicion.src}
          fromQueue={colaTotal > 1 || cola.length > 0}
          progreso={{ i: colaTotal - cola.length + 1, total: colaTotal }}
          onDone={terminarEdicion} onCancel={cancelarEdicion} />
      )}
    </div>
  )
}

function TablaCalif({ titulo, colLabel = 'Nombre', filas, calif, onCampo, onAdd }) {
  return (
    <section className="card">
      <h2>{titulo}</h2>
      <div className="zonas">
        <div className="zrow-head">
          <span>{colLabel}</span><span>Revisado</span><span>Valor</span><span>Calificación</span>
        </div>
        {filas.map((r, i) => (
          <div className="zrow" key={i}>
            <input className="zn" value={r.nombre} placeholder="Nombre" onChange={e => onCampo(i, 'nombre', e.target.value)} />
            <select className="rev" value={r.revisado} onChange={e => onCampo(i, 'revisado', e.target.value)}>
              <option value="SI">Sí</option><option value="NO">No</option>
            </select>
            <select className="val" value={r.valor} disabled={r.revisado === 'NO'} onChange={e => onCampo(i, 'valor', e.target.value)}>
              <option value="">–</option>{[5,4,3,2,1].map(v => <option key={v} value={v}>{v}</option>)}
            </select>
            <div className="cal">{r.revisado === 'NO' ? 'No revisado' : (r.valor ? calif[r.valor] : '–')}</div>
          </div>
        ))}
      </div>
      {onAdd && <button className="addbtn" onClick={onAdd}>+ Agregar</button>}
    </section>
  )
}

const Box = ({ n, l, hl }) => (
  <div className="box"><div className={'num' + (hl ? ' hl' : '')}>{n}</div><div className="lbl">{l}</div></div>
)
