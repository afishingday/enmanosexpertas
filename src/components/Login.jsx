import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { LOGO } from '../lib/logo'

export default function Login() {
  const { login } = useAuth()
  const [identificador, setIdentificador] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)

  const enviar = async (e) => {
    e.preventDefault()
    setError('')
    setCargando(true)
    try {
      await login(identificador, pass)
    } catch (err) {
      setError(traducir(err.code) || err.message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={enviar}>
        <img src={LOGO} alt="En Manos Expertas" className="login-logo" />
        <h2>Informes de Supervisión</h2>
        <p className="muted">Ingresa con tu usuario o correo</p>
        <input
          placeholder="Usuario o correo"
          value={identificador}
          onChange={e => setIdentificador(e.target.value)}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={pass}
          onChange={e => setPass(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="btn btn-amarillo" disabled={cargando}>
          {cargando ? 'Un momento…' : 'Entrar'}
        </button>
        <p className="muted" style={{ fontSize: 12, margin: 0 }}>
          Las cuentas las crea un administrador.
        </p>
      </form>
    </div>
  )
}

function traducir(code) {
  const m = {
    'auth/invalid-credential': 'Usuario/correo o contraseña incorrectos.',
    'auth/invalid-email': 'El correo no es válido.',
    'auth/user-not-found': 'No existe una cuenta con ese usuario o correo.',
    'auth/wrong-password': 'Contraseña incorrecta.',
    'auth/too-many-requests': 'Demasiados intentos. Espera un momento.',
  }
  return m[code]
}
