const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp()
const db = getFirestore()
const auth = getAuth()

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.')
  const snap = await db.collection('usuarios').doc(uid).get()
  if (!snap.exists || snap.data().rol !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede hacer esto.')
  }
}

/** Crea cuenta Auth + perfil Firestore + username (sin cerrar sesión del admin). */
exports.crearUsuarioApp = onCall({ region: 'us-central1' }, async (request) => {
  await assertAdmin(request.auth?.uid)

  const nombre = String(request.data?.nombre || '').trim()
  const email = String(request.data?.email || '').trim().toLowerCase()
  const username = String(request.data?.username || '').trim().toLowerCase()
  const password = String(request.data?.password || '')
  const rol = request.data?.rol === 'admin' ? 'admin' : 'colaborador'

  if (!nombre || !email || !username || password.length < 6) {
    throw new HttpsError('invalid-argument', 'Nombre, usuario, correo y contraseña (mín. 6) son obligatorios.')
  }
  if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
    throw new HttpsError('invalid-argument', 'Usuario inválido (3–20: letras, números, . _ -).')
  }

  const unameRef = db.collection('usernames').doc(username)
  if ((await unameRef.get()).exists) {
    throw new HttpsError('already-exists', 'Ese nombre de usuario ya está en uso.')
  }

  let user
  try {
    user = await auth.createUser({ email, password, displayName: nombre })
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      throw new HttpsError('already-exists', 'Ese correo ya está registrado.')
    }
    throw new HttpsError('internal', e.message || 'No se pudo crear el usuario.')
  }

  try {
    const batch = db.batch()
    batch.set(db.collection('usuarios').doc(user.uid), {
      nombre,
      username,
      email,
      rol,
      activo: true,
    })
    batch.set(unameRef, { email, uid: user.uid })
    await batch.commit()
  } catch (e) {
    await auth.deleteUser(user.uid).catch(() => {})
    throw new HttpsError('internal', e.message || 'No se pudo guardar el perfil.')
  }

  return { uid: user.uid }
})

/** Asigna una nueva contraseña a un usuario (solo admin). */
exports.cambiarClaveUsuario = onCall({ region: 'us-central1' }, async (request) => {
  await assertAdmin(request.auth?.uid)

  const uid = String(request.data?.uid || '').trim()
  const password = String(request.data?.password || '')
  if (!uid || password.length < 6) {
    throw new HttpsError('invalid-argument', 'UID y contraseña (mín. 6) son obligatorios.')
  }

  try {
    await auth.updateUser(uid, { password })
  } catch (e) {
    throw new HttpsError('internal', e.message || 'No se pudo cambiar la contraseña.')
  }
  return { ok: true }
})
