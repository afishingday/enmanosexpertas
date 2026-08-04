// Footer con la identidad de Ágora — reutilizable en todos los portales.
export default function FooterAgora() {
  const dots = [
    [59.1,16.2],[76.0,26.6],[84.6,44.5],[82.0,64.2],[69.1,79.4],[50.0,85.0],
    [30.9,79.4],[18.0,64.2],[15.4,44.5],[24.0,26.6],[40.9,16.2],
  ]
  return (
    <footer className="agora-foot">
      <div className="agora-brand">
        <svg className="agora-logo" viewBox="0 0 100 100" aria-hidden="true">
          {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="6" fill="#C75D3D" />)}
          <circle cx="50" cy="50" r="8" fill="#1E4D5C" />
        </svg>
        <div className="agora-txt">
          <div className="agora-name">Ágora</div>
          <div className="agora-tag">Donde tu comunidad se encuentra</div>
        </div>
      </div>
      <div className="agora-desc">Portales web a la medida para organizaciones y comunidades.</div>
      {/* Contacto opcional: descomenta y completa cuando lo tengas
      <div className="agora-contact">
        <a href="https://wa.me/57XXXXXXXXXX">WhatsApp</a> · <a href="mailto:hola@agora.com">hola@agora.com</a>
      </div> */}
      <div className="agora-legal">© {new Date().getFullYear()} Ágora · Desarrollado para En Manos Expertas S.A.S.</div>
    </footer>
  )
}
