import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { LOGO } from '../lib/logo'

export default function TopBar() {
  const { perfil, esAdmin, salir } = useAuth()
  return (
    <header className="topbar">
      <img src={LOGO} alt="En Manos Expertas" className="topbar-logo" />
      <h1>Informes de Supervisión</h1>
      <nav className="topnav">
        <NavLink to="/" end>Nuevo</NavLink>
        <NavLink to="/historial">Historial</NavLink>
        {esAdmin && <NavLink to="/admin">Admin</NavLink>}
      </nav>
      <div className="topbar-user">
        <span className="tu-nombre">{perfil?.nombre} {esAdmin && <b>· admin</b>}</span>
        <button className="btn btn-ghost" onClick={salir}>Salir</button>
      </div>
    </header>
  )
}
