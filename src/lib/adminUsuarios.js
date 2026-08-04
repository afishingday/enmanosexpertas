import {
  collection, doc, getDoc, getDocs, updateDoc, orderBy, query, writeBatch,
} from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import {
  getAuth, createUserWithEmailAndPassword, signOut, sendPasswordResetEmail,
} from 'firebase/auth'
import { auth, db, firebaseConfig, callFunction } from '../firebase'

const USERNAME_RE = /^[a-z0-9._-]{3,20}$/

function errorAuth(code, message) {
  const err = new Error(message)
  err.code = code
  return err
}

function normalizarUsername(valor) {
  return String(valor || '').trim().toLowerCase()
}

function functionsUnavailable(err) {
  const code = String(err?.code || '')
  const msg = String(err?.message || '')
  return code.includes('not-found')
    || code.includes('unavailable')
    || /not-found|NOT_FOUND|Billing|INTERNAL/i.test(msg)
}

/** Lista perfiles de acceso (colección usuarios). */
export async function listarUsuariosApp() {
  const q = query(collection(db, 'usuarios'), orderBy('nombre'))
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }))
}

/**
 * Crea usuario de acceso (Auth + Firestore + username).
 * Prefiere Cloud Function; si no está, usa Auth secundaria (Spark).
 */
export async function crearUsuarioApp({ nombre, email, username, password, rol = 'colaborador' }) {
  const user = normalizarUsername(username)
  const emailNorm = String(email || '').trim().toLowerCase()
  const nombreNorm = String(nombre || '').trim()
  const rolNorm = rol === 'admin' ? 'admin' : 'colaborador'

  if (!nombreNorm) throw errorAuth('invalid-argument', 'El nombre es obligatorio.')
  if (!USERNAME_RE.test(user)) {
    throw errorAuth('auth/invalid-username', 'Usuario inválido (3–20: letras, números, . _ -).')
  }
  if (String(password || '').length < 6) {
    throw errorAuth('auth/weak-password', 'La contraseña debe tener al menos 6 caracteres.')
  }

  try {
    const res = await callFunction('crearUsuarioApp', {
      nombre: nombreNorm, email: emailNorm, username: user, password, rol: rolNorm,
    })
    return res.data
  } catch (e) {
    if (!functionsUnavailable(e)) {
      const msg = String(e.message || '')
        .replace(/^Firebase:\s*/i, '')
        .replace(/\s*\(.*\)$/, '')
      if (/already-exists|ya está/i.test(msg) || e.code?.includes('already-exists')) {
        throw errorAuth('auth/username-taken', msg || 'Usuario o correo ya registrado.')
      }
      throw errorAuth(e.code || 'internal', msg || 'No se pudo crear el usuario.')
    }
  }

  const unameRef = doc(db, 'usernames', user)
  if ((await getDoc(unameRef)).exists()) {
    throw errorAuth('auth/username-taken', 'Ese nombre de usuario ya está en uso.')
  }

  const secondary = initializeApp(firebaseConfig, 'Secondary-' + Date.now())
  const auth2 = getAuth(secondary)
  let uid
  try {
    const cred = await createUserWithEmailAndPassword(auth2, emailNorm, password)
    uid = cred.user.uid
  } catch (err) {
    await deleteApp(secondary).catch(() => {})
    if (err.code === 'auth/email-already-in-use') {
      throw errorAuth('auth/email-already-in-use', 'Ese correo ya está registrado.')
    }
    throw err
  }
  await signOut(auth2).catch(() => {})
  await deleteApp(secondary).catch(() => {})

  const batch = writeBatch(db)
  batch.set(doc(db, 'usuarios', uid), {
    nombre: nombreNorm,
    username: user,
    email: emailNorm,
    rol: rolNorm,
    activo: true,
  })
  batch.set(unameRef, { email: emailNorm, uid })
  await batch.commit()
  return { uid }
}

/** Asigna nueva contraseña (Cloud Function: plan Blaze). */
export async function cambiarClaveUsuario(uid, password) {
  if (String(password || '').length < 6) {
    throw errorAuth('auth/weak-password', 'La contraseña debe tener al menos 6 caracteres.')
  }
  try {
    await callFunction('cambiarClaveUsuario', { uid, password })
  } catch (e) {
    if (functionsUnavailable(e)) {
      throw errorAuth(
        'functions/unavailable',
        'Para asignar la clave desde el admin hace falta Cloud Functions (plan Blaze). Usa “Enviar restablecimiento”.',
      )
    }
    const msg = String(e.message || '').replace(/^Firebase:\s*/i, '').replace(/\s*\(.*\)$/, '')
    throw errorAuth(e.code || 'internal', msg || 'No se pudo cambiar la contraseña.')
  }
}

/** Correo de restablecimiento (funciona en Spark). */
export function enviarRestablecimiento(email) {
  return sendPasswordResetEmail(auth, email)
}

export async function actualizarUsuarioApp(uid, data) {
  return updateDoc(doc(db, 'usuarios', uid), data)
}
