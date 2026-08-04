import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { listarClientes, listarInformesPorCliente, listarMisInformes } from '../lib/datos'

export default function Historial() {
  const { user, esAdmin } = useAuth()
  const [clientes, setClientes] = useState([])
  const [clienteId, setClienteId] = useState('')
  const [informes, setInformes] = useState([])
  const [cargando, setCargando] = useState(false)
  const [vista, setVista] = useState(esAdmin ? 'cliente' : 'mios')

  useEffect(() => { listarClientes().then(setClientes) }, [])

  useEffect(() => {
    (async () => {
      setCargando(true)
      try {
        if (vista === 'mios') setInformes(await listarMisInformes(user.uid))
        else if (clienteId) setInformes(await listarInformesPorCliente(clienteId))
        else setInformes([])
      } finally { setCargando(false) }
    })()
  }, [vista, clienteId, user.uid])

  return (
    <div className="form-wrap">
      <section className="card">
        <h2>Historial de informes</h2>
        <div className="tabs">
          {esAdmin && <button className={vista === 'cliente' ? 'tab on' : 'tab'} onClick={() => setVista('cliente')}>Por copropiedad</button>}
          <button className={vista === 'mios' ? 'tab on' : 'tab'} onClick={() => setVista('mios')}>Mis informes</button>
        </div>
        {vista === 'cliente' && (
          <label>Copropiedad
            <select value={clienteId} onChange={e => setClienteId(e.target.value)}>
              <option value="">— Selecciona —</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </label>
        )}
        {cargando && <p className="muted">Cargando…</p>}
        {!cargando && informes.length === 0 && <p className="muted">Sin informes para mostrar.</p>}
        {informes.length > 0 && (
          <table className="lista">
            <colgroup>
              <col style={{ width: '13%' }} /><col style={{ width: '30%' }} /><col style={{ width: '26%' }} />
              <col style={{ width: '12%' }} /><col style={{ width: '19%' }} />
            </colgroup>
            <thead><tr><th>Fecha</th><th>Copropiedad</th><th>Colaborador</th><th>Efect.</th><th>PDF</th></tr></thead>
            <tbody>
              {informes.map(inf => (
                <tr key={inf.id}>
                  <td data-label="Fecha">{fmt(inf.fecha)}</td>
                  <td data-label="Copropiedad">{inf.cliente_nombre}</td>
                  <td data-label="Colaborador">{inf.colaborador_nombre}</td>
                  <td data-label="Efect."><b>{inf.efectividad_cliente ?? '—'}%</b></td>
                  <td data-label="PDF">{inf.pdf_url ? <a href={inf.pdf_url} target="_blank" rel="noreferrer">Ver</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
const fmt = f => { if (!f) return ''; const p = f.split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : f }
