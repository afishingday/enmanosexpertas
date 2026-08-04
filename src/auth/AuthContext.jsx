import { createContext, useContext, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

const AuthCtx = createContext(null)
export const useAuth = () => useContext(AuthCtx)

function errorAuth(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

function esEmail(valor) {
  return String(valor || '').includes('@')
}

async function resolverEmail(identificador) {
  const id = String(identificador || '').trim()
  if (!id) throw errorAuth('auth/invalid-credential', 'Usuario o correo requerido.')
  if (esEmail(id)) return id.toLowerCase()

  const username = id.toLowerCase()
  const snap = await getDoc(doc(db, 'usernames', username))
  if (!snap.exists()) {
    throw errorAuth('auth/user-not-found', 'No existe una cuenta con ese usuario.')
  }
  return snap.data().email
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const ref = doc(db, 'usuarios', u.uid)
        let snap = await getDoc(ref)
        if (!snap.exists()) {
          await setDoc(ref, {
            nombre: u.displayName || u.email,
            email: u.email || '',
            rol: 'colaborador',
            activo: true,
          })
          snap = await getDoc(ref)
        }
        const data = snap.data()
        if (data.activo === false) {
          await signOut(auth)
          setUser(null)
          setPerfil(null)
          setCargando(false)
          return
        }
        setPerfil({ id: u.uid, ...data })
      } else {
        setPerfil(null)
      }
      setCargando(false)
    })
  }, [])

  const login = async (identificador, pass) => {
    const email = await resolverEmail(identificador)
    return signInWithEmailAndPassword(auth, email, pass)
  }

  const salir = () => signOut(auth)
  const esAdmin = perfil?.rol === 'admin'

  return (
    <AuthCtx.Provider value={{ user, perfil, esAdmin, cargando, login, salir }}>
      {children}
    </AuthCtx.Provider>
  )
}
