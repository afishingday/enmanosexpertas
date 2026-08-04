import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Login from './components/Login'
import TopBar from './components/TopBar'
import FooterAgora from './components/FooterAgora'
import ReporteForm from './components/ReporteForm'
import Historial from './components/Historial'
import AdminPanel from './components/AdminPanel'

export default function App() {
  const { user, cargando, esAdmin } = useAuth()
  const { pathname } = useLocation()

  if (cargando) return <div className="centro">Cargando…</div>
  if (!user) return <Login />

  const ancho = pathname.startsWith('/admin') || pathname.startsWith('/historial')

  return (
    <>
      <TopBar />
      <main className={ancho ? 'contenido ancho' : 'contenido'}>
        <Routes>
          <Route path="/" element={<ReporteForm />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/admin" element={esAdmin ? <AdminPanel /> : <Navigate to="/" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <FooterAgora />
    </>
  )
}
