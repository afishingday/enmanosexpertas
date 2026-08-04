import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { recortar, rotar90 } from '../lib/imagen'

// Editor de recorte. Props:
//  fullSrc, fromQueue, progreso ({i,total})
//  onDone(result|null)  -> result = {full, src} (recortada) | null = usar completa
//  onCancel()           -> solo en re-edición (no en cola)
export default function CropModal({ fullSrc, fromQueue, progreso, onDone, onCancel }) {
  const [src, setSrc] = useState(fullSrc)
  const [box, setBox] = useState(null)
  const [disp, setDisp] = useState({ w: 0, h: 0 })
  const [ocupado, setOcupado] = useState(false)
  const imgRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => { setSrc(fullSrc) }, [fullSrc])

  const onImgLoad = () => {
    const r = imgRef.current.getBoundingClientRect()
    setDisp({ w: r.width, h: r.height })
    setBox({ x: 0, y: 0, w: r.width, h: r.height })
  }

  const pt = (e) => {
    const r = imgRef.current.getBoundingClientRect()
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return { x: cx - r.left, y: cy - r.top }
  }
  const clamp = (b) => {
    b.w = Math.max(24, Math.min(b.w, disp.w)); b.h = Math.max(24, Math.min(b.h, disp.h))
    b.x = Math.max(0, Math.min(b.x, disp.w - b.w)); b.y = Math.max(0, Math.min(b.y, disp.h - b.h))
    return b
  }
  const start = (mode, corner) => (e) => {
    e.preventDefault(); e.stopPropagation()
    drag.current = { mode, corner, start: pt(e), box: { ...box } }
  }
  const move = (e) => {
    if (!drag.current) return
    e.preventDefault()
    const p = pt(e), d = drag.current, dx = p.x - d.start.x, dy = p.y - d.start.y, o = d.box
    let nb
    if (d.mode === 'move') nb = { x: o.x + dx, y: o.y + dy, w: o.w, h: o.h }
    else {
      let x = o.x, y = o.y, w = o.w, h = o.h
      if (d.corner.includes('l')) { x = o.x + dx; w = o.w - dx }
      if (d.corner.includes('r')) { w = o.w + dx }
      if (d.corner.includes('t')) { y = o.y + dy; h = o.h - dy }
      if (d.corner.includes('b')) { h = o.h + dy }
      nb = { x, y, w, h }
    }
    setBox(clamp(nb))
  }
  const end = () => { drag.current = null }

  useEffect(() => {
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', end)
    window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', end)
    return () => {
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', end)
      window.removeEventListener('touchmove', move); window.removeEventListener('touchend', end)
    }
  })

  const aplicar = async () => {
    setOcupado(true)
    const res = await recortar(src, box, disp.w)
    setOcupado(false); onDone(res)
  }
  const rotar = async () => { setOcupado(true); const s = await rotar90(src); setSrc(s); setOcupado(false) }

  const titulo = fromQueue && progreso?.total > 1
    ? `Ajusta la imagen (${progreso.i} de ${progreso.total})`
    : 'Ajusta la imagen — arrastra el marco'

  return createPortal(
    <div className="modal on">
      <h3>{titulo}</h3>
      <div className="cropstage">
        <img ref={imgRef} src={src} onLoad={onImgLoad} alt="" draggable="false" />
        {box && (
          <div className="cropbox" style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
               onMouseDown={start('move')} onTouchStart={start('move')}>
            {['tl','tr','bl','br'].map(c => (
              <span key={c} className={'h ' + c} onMouseDown={start('resize', c)} onTouchStart={start('resize', c)} />
            ))}
          </div>
        )}
      </div>
      <div className="modal-acts">
        <button className="btn btn-blanco" onClick={rotar} disabled={ocupado}>↻ Rotar</button>
        {fromQueue
          ? <button className="btn btn-blanco" onClick={() => onDone(null)} disabled={ocupado}>Usar completa</button>
          : <button className="btn btn-ghost" onClick={onCancel} disabled={ocupado}>Cancelar</button>}
        <button className="btn btn-amarillo" onClick={aplicar} disabled={ocupado}>{ocupado ? '…' : '✓ Aplicar'}</button>
      </div>
    </div>,
    document.body
  )
}
