import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  listarClientes, crearCliente, actualizarCliente, eliminarCliente,
  listarEmpleados, crearEmpleado, eliminarEmpleado,
  listarCatalogo, crearItemCatalogo, actualizarItemCatalogo, eliminarItemCatalogo,
  cargarDatosIniciales, estadoCargaInicial,
  obtenerCalificaciones, guardarCalificaciones,
  obtenerUsoStorage, CUOTA_STORAGE_BYTES, listarInformesConPDF, eliminarPDFInforme,
} from '../lib/datos'
import {
  listarUsuariosApp, crearUsuarioApp, cambiarClaveUsuario,
  enviarRestablecimiento, actualizarUsuarioApp,
} from '../lib/adminUsuarios'
import { IconEdit, IconTrash, IconCheck, IconX, IconKey, IconMail } from './Icons'

const TABS = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'empleados', label: 'Personal' },
  { id: 'catalogo', label: 'Áreas / Conceptos' },
  { id: 'calificacion', label: 'Calificación' },
  { id: 'almacenamiento', label: 'Almacenamiento' },
]

export default function AdminPanel() {
  const { user } = useAuth()
  const [tab, setTab] = useState('usuarios')
  const [msg, setMsg] = useState('')
  const [falta, setFalta] = useState(null) // null = aún no se sabe

  const revisarEstado = () => estadoCargaInicial().then(
    e => setFalta(!e.clientes || !e.empleados || !e.catalogo)
  )
  useEffect(() => { revisarEstado() }, [])

  const seed = async () => {
    if (!confirm('¿Cargar los datos iniciales que falten (clientes, personal, catálogo)? Las colecciones que ya tengan datos no se tocan.')) return
    try {
      const r = await cargarDatosIniciales(user.uid)
      const partes = []
      if (r.clientes) partes.push(`${r.clientes} clientes`)
      if (r.empleados) partes.push(`${r.empleados} personal`)
      if (r.catalogo) partes.push(`${r.catalogo} ítems de catálogo`)
      setMsg(`✓ Cargado: ${partes.join(', ')}.`)
      await revisarEstado()
    } catch (e) {
      setMsg('⚠ ' + e.message)
    }
  }

  return (
    <div className="form-wrap">
      <section className="card">
        <h2>Administración</h2>
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={tab === t.id ? 'tab on' : 'tab'} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {falta && (
          <>
            <p className="muted">Faltan datos base (clientes, personal o catálogo) por cargar. Este es un paso único: una vez cargados, no se vuelve a pedir.</p>
            <button className="btn btn-ghost" onClick={seed} style={{ marginBottom: 8 }}>⤓ Cargar datos iniciales</button>
          </>
        )}
        {msg && <p className="muted">{msg}</p>}
      </section>
      {tab === 'usuarios' && <Usuarios />}
      {tab === 'clientes' && <Clientes uid={user.uid} />}
      {tab === 'empleados' && <Empleados />}
      {tab === 'catalogo' && <Catalogo />}
      {tab === 'calificacion' && <Calificacion />}
      {tab === 'almacenamiento' && <Almacenamiento />}
    </div>
  )
}

/* ---------- Usuarios de acceso a la app ---------- */
function Usuarios() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [f, setF] = useState({
    nombre: '', username: '', email: '', password: '', rol: 'colaborador',
  })
  const [claveUid, setClaveUid] = useState(null)
  const [nuevaClave, setNuevaClave] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const cargar = () => listarUsuariosApp().then(setItems).catch(e => setErr(e.message))
  useEffect(() => { cargar() }, [])

  const agregar = async () => {
    setErr(''); setMsg(''); setBusy(true)
    try {
      await crearUsuarioApp(f)
      setF({ nombre: '', username: '', email: '', password: '', rol: 'colaborador' })
      setMsg('✓ Usuario creado. Ya puede iniciar sesión.')
      await cargar()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const guardarClave = async (uid) => {
    setErr(''); setMsg(''); setBusy(true)
    try {
      await cambiarClaveUsuario(uid, nuevaClave)
      setClaveUid(null)
      setNuevaClave('')
      setMsg('✓ Contraseña actualizada.')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const restablecer = async (email) => {
    if (!email) return setErr('Ese usuario no tiene correo.')
    setErr(''); setMsg(''); setBusy(true)
    try {
      await enviarRestablecimiento(email)
      setMsg('✓ Correo de restablecimiento enviado a ' + email)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  const setRol = async (id, rol) => {
    await actualizarUsuarioApp(id, { rol })
    cargar()
  }

  const setActivo = async (id, activo) => {
    await actualizarUsuarioApp(id, { activo })
    cargar()
  }

  return (
    <section className="card">
      <h2>Usuarios de acceso ({items.length})</h2>
      <p className="muted">Cuentas para entrar a la app (usuario o correo + contraseña).</p>
      <div className="grid g-auto">
        <input placeholder="Nombre completo *" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
        <input placeholder="Usuario *" value={f.username} onChange={e => setF({ ...f, username: e.target.value })} autoComplete="off" />
        <input type="email" placeholder="Correo *" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
        <input type="password" placeholder="Contraseña *" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
        <select value={f.rol} onChange={e => setF({ ...f, rol: e.target.value })}>
          <option value="colaborador">Colaborador</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <button className="addbtn" disabled={busy} onClick={agregar}>+ Crear usuario</button>
      {msg && <p className="muted">{msg}</p>}
      {err && <div className="error">{err}</div>}

      <table className="lista">
        <colgroup>
          <col style={{ width: '20%' }} /><col style={{ width: '14%' }} /><col style={{ width: '20%' }} />
          <col style={{ width: '12%' }} /><col style={{ width: '16%' }} /><col style={{ width: '18%' }} />
        </colgroup>
        <thead>
          <tr>
            <th>Nombre</th><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Clave</th>
          </tr>
        </thead>
        <tbody>
          {items.map(u => (
            <tr key={u.id}>
              <td data-label="Nombre">{u.nombre}</td>
              <td data-label="Usuario">{u.username || '—'}</td>
              <td data-label="Correo">{u.email || '—'}</td>
              <td data-label="Rol">
                <select
                  value={u.rol || 'colaborador'}
                  disabled={u.id === user.uid}
                  onChange={e => setRol(u.id, e.target.value)}
                >
                  <option value="colaborador">Colaborador</option>
                  <option value="admin">Admin</option>
                </select>
              </td>
              <td data-label="Estado">
                <button
                  className="btn btn-ghost"
                  disabled={u.id === user.uid}
                  onClick={() => setActivo(u.id, u.activo === false)}
                >
                  {u.activo === false ? 'Activar' : 'Desactivar'}
                </button>
              </td>
              <td data-label="Clave" className="cell-acciones">
                {claveUid === u.id ? (
                  <div className="add-inline">
                    <input
                      type="password"
                      placeholder="Nueva clave"
                      value={nuevaClave}
                      onChange={e => setNuevaClave(e.target.value)}
                    />
                    <button className="icon-btn amarillo" disabled={busy} title="Guardar" aria-label="Guardar" onClick={() => guardarClave(u.id)}><IconCheck /></button>
                    <button className="icon-btn ghost" title="Cancelar" aria-label="Cancelar" onClick={() => { setClaveUid(null); setNuevaClave('') }}><IconX /></button>
                  </div>
                ) : (
                  <div className="row-actions">
                    <button className="icon-btn ghost" title="Cambiar contraseña" aria-label="Cambiar contraseña" onClick={() => { setClaveUid(u.id); setNuevaClave('') }}><IconKey /></button>
                    <button className="icon-btn ghost" title="Enviar correo de restablecimiento" aria-label="Enviar correo de restablecimiento" onClick={() => restablecer(u.email)}><IconMail /></button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/* ---------- Clientes / copropiedades ---------- */
function Clientes({ uid }) {
  const vacio = { nombre: '', nit: '', direccion: '', administrador: '', email_administrador: '' }
  const [items, setItems] = useState([])
  const [f, setF] = useState(vacio)
  const [editId, setEditId] = useState(null)
  const [edit, setEdit] = useState(vacio)
  const [busqueda, setBusqueda] = useState('')

  const cargar = () => listarClientes().then(setItems)
  useEffect(() => { cargar() }, [])

  const q = busqueda.trim().toLowerCase()
  const filtrados = !q ? items : items.filter(c =>
    [c.nombre, c.nit, c.direccion, c.administrador, c.email_administrador]
      .some(v => String(v || '').toLowerCase().includes(q))
  )

  const agregar = async () => {
    if (!f.nombre.trim()) return
    await crearCliente(f, uid)
    setF(vacio)
    cargar()
  }

  const borrar = async (id) => {
    if (confirm('¿Eliminar esta copropiedad?')) {
      await eliminarCliente(id)
      cargar()
    }
  }

  const empezarEdit = (c) => {
    setEditId(c.id)
    setEdit({
      nombre: c.nombre || '',
      nit: c.nit || '',
      direccion: c.direccion || '',
      administrador: c.administrador || '',
      email_administrador: c.email_administrador || '',
    })
  }

  const guardarEdit = async () => {
    await actualizarCliente(editId, edit)
    setEditId(null)
    cargar()
  }

  return (
    <section className="card">
      <h2>Clientes / Copropiedades ({filtrados.length}{q ? ` / ${items.length}` : ''})</h2>
      <p className="muted">Datos que usa el formulario de informe (nombre, NIT, dirección, administrador).</p>
      <input
        placeholder="Buscar por nombre, NIT, dirección, administrador…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <div className="grid g-auto">
        <input placeholder="Nombre *" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
        <input placeholder="NIT" value={f.nit} onChange={e => setF({ ...f, nit: e.target.value })} />
        <input placeholder="Dirección" value={f.direccion} onChange={e => setF({ ...f, direccion: e.target.value })} />
        <input placeholder="Administrador" value={f.administrador} onChange={e => setF({ ...f, administrador: e.target.value })} />
        <input placeholder="Correo del administrador" value={f.email_administrador} onChange={e => setF({ ...f, email_administrador: e.target.value })} />
      </div>
      <button className="addbtn" onClick={agregar}>+ Agregar cliente</button>
      <table className="lista">
        <colgroup>
          <col style={{ width: '24%' }} /><col style={{ width: '11%' }} /><col style={{ width: '20%' }} />
          <col style={{ width: '19%' }} /><col style={{ width: '17%' }} /><col style={{ width: '9%' }} />
        </colgroup>
        <thead>
          <tr><th>Nombre</th><th>NIT</th><th>Dirección</th><th>Administrador</th><th>Correo</th><th></th></tr>
        </thead>
        <tbody>
          {filtrados.map(c => (
            <tr key={c.id}>
              {editId === c.id ? (
                <>
                  <td data-label="Nombre"><input value={edit.nombre} onChange={e => setEdit({ ...edit, nombre: e.target.value })} /></td>
                  <td data-label="NIT"><input value={edit.nit} onChange={e => setEdit({ ...edit, nit: e.target.value })} /></td>
                  <td data-label="Dirección"><input value={edit.direccion} onChange={e => setEdit({ ...edit, direccion: e.target.value })} /></td>
                  <td data-label="Administrador"><input value={edit.administrador} onChange={e => setEdit({ ...edit, administrador: e.target.value })} /></td>
                  <td data-label="Correo"><input value={edit.email_administrador} onChange={e => setEdit({ ...edit, email_administrador: e.target.value })} /></td>
                  <td data-label="Acciones" className="cell-acciones">
                    <div className="row-actions">
                      <button className="icon-btn amarillo" title="Guardar" aria-label="Guardar" onClick={guardarEdit}><IconCheck /></button>
                      <button className="icon-btn ghost" title="Cancelar" aria-label="Cancelar" onClick={() => setEditId(null)}><IconX /></button>
                    </div>
                  </td>
                </>
              ) : (
                <>
                  <td data-label="Nombre">{c.nombre}</td>
                  <td data-label="NIT">{c.nit || '—'}</td>
                  <td data-label="Dirección">{c.direccion || '—'}</td>
                  <td data-label="Administrador">{c.administrador || '—'}</td>
                  <td data-label="Correo">{c.email_administrador || '—'}</td>
                  <td data-label="Acciones" className="cell-acciones">
                    <div className="row-actions">
                      <button className="icon-btn ghost" title="Editar" aria-label="Editar" onClick={() => empezarEdit(c)}><IconEdit /></button>
                      <button className="icon-btn danger" title="Eliminar" aria-label="Eliminar" onClick={() => borrar(c.id)}><IconTrash /></button>
                    </div>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/* ---------- Personal que aparece en el informe ---------- */
function Empleados() {
  const [items, setItems] = useState([])
  const [f, setF] = useState({ cedula: '', nombre: '', eps: '', arl: '' })
  const cargar = () => listarEmpleados().then(setItems)
  useEffect(() => { cargar() }, [])
  const agregar = async () => {
    if (!f.nombre.trim()) return
    await crearEmpleado(f)
    setF({ cedula: '', nombre: '', eps: '', arl: '' })
    cargar()
  }
  const borrar = async (id) => {
    if (confirm('¿Eliminar este registro de personal?')) {
      await eliminarEmpleado(id)
      cargar()
    }
  }
  return (
    <section className="card">
      <h2>Personal de informe ({items.length})</h2>
      <p className="muted">Personas que se seleccionan en el formulario (cédula, EPS, ARL). No son cuentas de acceso.</p>
      <div className="grid g-auto">
        <input placeholder="Nombre *" value={f.nombre} onChange={e => setF({ ...f, nombre: e.target.value })} />
        <input placeholder="Cédula" value={f.cedula} onChange={e => setF({ ...f, cedula: e.target.value })} />
        <input placeholder="EPS" value={f.eps} onChange={e => setF({ ...f, eps: e.target.value })} />
        <input placeholder="ARL" value={f.arl} onChange={e => setF({ ...f, arl: e.target.value })} />
      </div>
      <button className="addbtn" onClick={agregar}>+ Agregar personal</button>
      <table className="lista">
        <colgroup>
          <col style={{ width: '36%' }} /><col style={{ width: '18%' }} /><col style={{ width: '16%' }} />
          <col style={{ width: '18%' }} /><col style={{ width: '12%' }} />
        </colgroup>
        <thead><tr><th>Nombre</th><th>Cédula</th><th>EPS</th><th>ARL</th><th></th></tr></thead>
        <tbody>{items.map(e => (
          <tr key={e.id}>
            <td data-label="Nombre">{e.nombre}</td>
            <td data-label="Cédula">{e.cedula || '—'}</td>
            <td data-label="EPS">{e.eps || '—'}</td>
            <td data-label="ARL">{e.arl || '—'}</td>
            <td data-label="Acciones" className="cell-acciones">
              <div className="row-actions">
                <button className="icon-btn danger" title="Eliminar" aria-label="Eliminar" onClick={() => borrar(e.id)}><IconTrash /></button>
              </div>
            </td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  )
}

/* ---------- Catálogo: áreas (zonas) y conceptos ---------- */
function Catalogo() {
  const [items, setItems] = useState([])
  const [zona, setZona] = useState('')
  const [concepto, setConcepto] = useState('')
  const cargar = () => listarCatalogo().then(setItems)
  useEffect(() => { cargar() }, [])
  const add = async (tipo, nombre, reset) => {
    if (!nombre.trim()) return
    const orden = items.filter(i => i.tipo === tipo).length
    await crearItemCatalogo({ tipo, nombre: nombre.trim(), orden })
    reset('')
    cargar()
  }
  const borrar = async (id) => {
    if (!confirm('¿Quitar este ítem del formulario?')) return
    await eliminarItemCatalogo(id)
    cargar()
  }
  const toggleActivo = async (i) => {
    await actualizarItemCatalogo(i.id, { activo: i.activo === false })
    cargar()
  }
  const lista = (tipo) => items.filter(i => i.tipo === tipo)
  return (
    <div className="grid g2">
      <section className="card">
        <h2>Áreas / Zonas ({lista('zona').length})</h2>
        <p className="muted">Aparecen en “Información general — zonas” del informe. Desactiva las que no apliquen a todas las copropiedades para que no salgan por defecto en un reporte nuevo.</p>
        <div className="add-inline">
          <input placeholder="Nueva área o zona" value={zona} onChange={e => setZona(e.target.value)} />
          <button className="btn btn-amarillo" onClick={() => add('zona', zona, setZona)}>+</button>
        </div>
        {lista('zona').map(i => (
          <div className={'admrow' + (i.activo === false ? ' inactivo' : '')} key={i.id}>
            <span>{i.nombre}</span>
            <div className="row-actions">
              <label className="switch" title={i.activo === false ? 'Activar' : 'Desactivar'}>
                <input type="checkbox" checked={i.activo !== false} onChange={() => toggleActivo(i)} />
                <span className="track"><span className="thumb" /></span>
              </label>
              <button className="icon-btn danger" title="Quitar" aria-label="Quitar" onClick={() => borrar(i.id)}><IconTrash /></button>
            </div>
          </div>
        ))}
      </section>
      <section className="card">
        <h2>Conceptos ({lista('concepto').length})</h2>
        <p className="muted">Aparecen en “Conceptos evaluados” del informe. Desactiva los que no apliquen a todas las copropiedades para que no salgan por defecto en un reporte nuevo.</p>
        <div className="add-inline">
          <input placeholder="Nuevo concepto" value={concepto} onChange={e => setConcepto(e.target.value)} />
          <button className="btn btn-amarillo" onClick={() => add('concepto', concepto, setConcepto)}>+</button>
        </div>
        {lista('concepto').map(i => (
          <div className={'admrow' + (i.activo === false ? ' inactivo' : '')} key={i.id}>
            <span>{i.nombre}</span>
            <div className="row-actions">
              <label className="switch" title={i.activo === false ? 'Activar' : 'Desactivar'}>
                <input type="checkbox" checked={i.activo !== false} onChange={() => toggleActivo(i)} />
                <span className="track"><span className="thumb" /></span>
              </label>
              <button className="icon-btn danger" title="Quitar" aria-label="Quitar" onClick={() => borrar(i.id)}><IconTrash /></button>
            </div>
          </div>
        ))}
      </section>
    </div>
  )
}

/* ---------- Calificación: escala de valor (1-5) usada en zonas y conceptos ---------- */
function Calificacion() {
  const [textos, setTextos] = useState(null)
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { obtenerCalificaciones().then(setTextos) }, [])

  const setValor = (v, texto) => setTextos(prev => ({ ...prev, [v]: texto }))

  const guardar = async () => {
    setBusy(true); setMsg('')
    try {
      await guardarCalificaciones(textos)
      setMsg('✓ Escala de calificación actualizada.')
    } catch (e) {
      setMsg('⚠ ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!textos) return <section className="card"><p className="muted">Cargando…</p></section>

  return (
    <section className="card">
      <h2>Escala de calificación</h2>
      <p className="muted">Texto que se muestra según el valor (1 a 5) que se le da a cada zona o concepto, tanto en el formulario como en el PDF.</p>
      <div className="grid g-auto">
        {[5, 4, 3, 2, 1].map(v => (
          <label key={v}>{v} {v === 5 ? '(máximo)' : v === 1 ? '(mínimo)' : ''}
            <input value={textos[v] ?? ''} onChange={e => setValor(v, e.target.value)} />
          </label>
        ))}
      </div>
      <button className="btn btn-amarillo" disabled={busy} onClick={guardar} style={{ marginTop: 12 }}>Guardar escala</button>
      {msg && <p className="muted">{msg}</p>}
    </section>
  )
}

/* ---------- Almacenamiento: cuota de Storage + backup/limpieza de PDFs ---------- */
const formatearBytes = (b) => {
  if (!b) return '0 B'
  if (b < 1024) return `${b} B`
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`
  return `${(b / 1024 ** 3).toFixed(2)} GB`
}
const fmtFechaCorta = (f) => {
  if (!f) return '—'
  const p = f.split('-')
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f
}

function Almacenamiento() {
  const [bytes, setBytes] = useState(null)
  const [informes, setInformes] = useState(null)
  const [seleccion, setSeleccion] = useState(new Set())
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const cargar = async () => {
    const [b, inf] = await Promise.all([obtenerUsoStorage(), listarInformesConPDF()])
    setBytes(b); setInformes(inf)
  }
  useEffect(() => { cargar() }, [])

  const pct = bytes != null ? Math.min(100, Math.round((bytes / CUOTA_STORAGE_BYTES) * 100)) : 0
  const hace3Meses = new Date()
  hace3Meses.setMonth(hace3Meses.getMonth() - 3)
  const antiguos = (informes || []).filter(i => i.fecha && new Date(i.fecha) < hace3Meses)

  const toggle = (id) => setSeleccion(prev => {
    const n = new Set(prev)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })
  const seleccionarAntiguos = () => setSeleccion(new Set(antiguos.map(i => i.id)))
  const limpiarSeleccion = () => setSeleccion(new Set())

  const eliminarSeleccionados = async () => {
    const items = (informes || []).filter(i => seleccion.has(i.id))
    if (!items.length) return
    if (!confirm(
      `¿Eliminar ${items.length} PDF(s) de Storage?\n\nEl informe y sus fotos NO se borran, solo el archivo PDF (se puede volver a generar desde el historial si algún día hace falta). Asegúrate de haberlos descargado si los necesitas. Esta acción no se puede deshacer.`
    )) return
    setBusy(true); setMsg('')
    try {
      for (const it of items) await eliminarPDFInforme(it)
      setMsg(`✓ Se eliminaron ${items.length} PDF(s) de Storage.`)
      setSeleccion(new Set())
      await cargar()
    } catch (e) {
      setMsg('⚠ ' + e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h2>Almacenamiento</h2>
      <p className="muted">Uso estimado de Firebase Storage (fotos + PDF de todos los informes) frente al plan gratuito.</p>
      {bytes == null ? <p className="muted">Cargando…</p> : (
        <>
          <div className="storage-bar"><div className="storage-fill" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--rojo)' : 'var(--amarillo)' }} /></div>
          <p className="muted">{formatearBytes(bytes)} usados de {formatearBytes(CUOTA_STORAGE_BYTES)} ({pct}%)</p>
          {pct >= 80 && (
            <div className="error">⚠ Te estás acercando al límite del plan gratuito de Storage ({pct}% usado). Es buen momento para descargar y limpiar PDFs antiguos.</div>
          )}
        </>
      )}

      <h2 style={{ marginTop: 22 }}>Backup y limpieza de PDFs {informes ? `(${informes.length})` : ''}</h2>
      <p className="muted">Descarga (respaldo) los PDF que necesites y luego elimina de Storage los de más de 3 meses — el informe y sus fotos se conservan, solo se borra el PDF.</p>

      {informes == null ? <p className="muted">Cargando…</p> : informes.length === 0 ? (
        <p className="muted">Todavía no hay PDFs generados.</p>
      ) : (
        <>
          <div className="row-actions" style={{ marginBottom: 10 }}>
            {antiguos.length > 0 && (
              <button className="btn btn-ghost" onClick={seleccionarAntiguos}>Seleccionar los {antiguos.length} de más de 3 meses</button>
            )}
            {seleccion.size > 0 && <button className="btn btn-ghost" onClick={limpiarSeleccion}>Quitar selección</button>}
          </div>
          <table className="lista">
            <colgroup>
              <col style={{ width: '6%' }} /><col style={{ width: '13%' }} /><col style={{ width: '38%' }} />
              <col style={{ width: '13%' }} /><col style={{ width: '30%' }} />
            </colgroup>
            <thead><tr><th></th><th>Fecha</th><th>Copropiedad</th><th>Peso</th><th>Acciones</th></tr></thead>
            <tbody>
              {informes.map(i => (
                <tr key={i.id}>
                  <td data-label="">
                    <input type="checkbox" checked={seleccion.has(i.id)} onChange={() => toggle(i.id)} />
                  </td>
                  <td data-label="Fecha">{fmtFechaCorta(i.fecha)}</td>
                  <td data-label="Copropiedad">{i.cliente_nombre || '—'}</td>
                  <td data-label="Peso">{i.pdf_bytes ? formatearBytes(i.pdf_bytes) : '—'}</td>
                  <td data-label="Acciones" className="cell-acciones">
                    <a className="btn btn-ghost" href={i.pdf_url} target="_blank" rel="noreferrer" download>Descargar</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn btn-ghost" disabled={busy || !seleccion.size} onClick={eliminarSeleccionados} style={{ marginTop: 12 }}>
            {busy ? 'Eliminando…' : `Eliminar ${seleccion.size || ''} PDF(s) seleccionados`}
          </button>
        </>
      )}
      {msg && <p className="muted">{msg}</p>}
    </section>
  )
}
