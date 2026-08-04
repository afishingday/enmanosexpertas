// Capa de acceso a Firestore + Storage
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc, getDoc, getDocs,
  query, where, orderBy, limit, serverTimestamp, increment
} from 'firebase/firestore'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from '../firebase'
import seed from './seed.json'

/* ---------- Clientes ---------- */
export const listarClientes = async () => {
  const q = query(collection(db, 'clientes'), orderBy('nombre'))
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }))
}
export const crearCliente = (data, uid) =>
  addDoc(collection(db, 'clientes'), { ...data, activo: true, creado_por: uid, created_at: serverTimestamp() })
export const actualizarCliente = (id, data) => updateDoc(doc(db, 'clientes', id), data)
export const eliminarCliente = (id) => deleteDoc(doc(db, 'clientes', id))

/* ---------- Empleados ---------- */
export const listarEmpleados = async () => {
  const q = query(collection(db, 'empleados'), orderBy('nombre'))
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }))
}
export const crearEmpleado = (data) =>
  addDoc(collection(db, 'empleados'), { ...data, activo: true })
export const actualizarEmpleado = (id, data) => updateDoc(doc(db, 'empleados', id), data)
export const eliminarEmpleado = (id) => deleteDoc(doc(db, 'empleados', id))

/* ---------- Catálogo (zonas / conceptos) ---------- */
export const listarCatalogo = async () => {
  const q = query(collection(db, 'catalogo'), orderBy('orden'))
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }))
}
export const crearItemCatalogo = (data) => addDoc(collection(db, 'catalogo'), { ...data, activo: true })
export const actualizarItemCatalogo = (id, data) => updateDoc(doc(db, 'catalogo', id), data)
export const eliminarItemCatalogo = (id) => deleteDoc(doc(db, 'catalogo', id))

/* ---------- Calificación (escala de valor 1-5 -> texto), administrable ---------- */
export const CALIF_DEFAULT = { 1: 'Deficiente', 2: 'Malo', 3: 'Regular', 4: 'Bueno', 5: 'Excelente' }
export const obtenerCalificaciones = async () => {
  const s = await getDoc(doc(db, 'configuracion', 'calificaciones'))
  return s.exists() ? { ...CALIF_DEFAULT, ...s.data() } : CALIF_DEFAULT
}
export const guardarCalificaciones = (data) => setDoc(doc(db, 'configuracion', 'calificaciones'), data)

/* ---------- Informes (historial) ---------- */
export const crearInforme = (data) =>
  addDoc(collection(db, 'informes'), { ...data, created_at: serverTimestamp() })
export const actualizarInforme = (id, data) => updateDoc(doc(db, 'informes', id), data)
export const obtenerInforme = async (id) => {
  const s = await getDoc(doc(db, 'informes', id)); return s.exists() ? { id: s.id, ...s.data() } : null
}
export const listarInformesPorCliente = async (clienteId) => {
  const q = query(collection(db, 'informes'), where('cliente_id', '==', clienteId), orderBy('fecha', 'desc'))
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }))
}
export const listarMisInformes = async (uid) => {
  const q = query(collection(db, 'informes'), where('colaborador_id', '==', uid), orderBy('fecha', 'desc'))
  return (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }))
}

/* ---------- Storage: subir foto / PDF (dataURL) ---------- */
export const subirDataURL = async (ruta, dataURL) => {
  const r = ref(storage, ruta)
  await uploadString(r, dataURL, 'data_url')
  return await getDownloadURL(r)
}

/* ---------- Uso de Storage (estimado) + backup/limpieza de PDFs ----------
   Firebase no expone el uso real del bucket al SDK de cliente, así que se
   lleva la cuenta a mano: cada subida suma sus bytes a un contador; cada
   borrado los resta. Es una estimación (asume que nada más escribe en este
   bucket), pero alcanza para avisar antes de llegar a la cuota gratuita. */
export const CUOTA_STORAGE_BYTES = 5 * 1024 ** 3 // 5 GiB — plan gratuito de Firebase Storage

export const obtenerUsoStorage = async () => {
  const s = await getDoc(doc(db, 'configuracion', 'almacenamiento'))
  return s.exists() ? (s.data().bytes || 0) : 0
}
export const registrarUsoStorage = (deltaBytes) =>
  setDoc(doc(db, 'configuracion', 'almacenamiento'), { bytes: increment(deltaBytes) }, { merge: true })

// Informes que tienen un PDF en Storage (para respaldo/limpieza desde el Admin).
export const listarInformesConPDF = async () => {
  const q = query(collection(db, 'informes'), orderBy('fecha', 'desc'))
  const docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }))
  return docs.filter(i => i.pdf_url)
}

// Borra solo el archivo PDF de Storage (el informe y sus fotos quedan intactos).
export const eliminarPDFInforme = async (informe) => {
  if (informe.pdf_path) {
    try { await deleteObject(ref(storage, informe.pdf_path)) }
    catch (e) { if (e.code !== 'storage/object-not-found') throw e }
  }
  await updateDoc(doc(db, 'informes', informe.id), {
    pdf_url: null, pdf_path: null, pdf_eliminado: true, pdf_eliminado_en: serverTimestamp(),
  })
  if (informe.pdf_bytes) await registrarUsoStorage(-informe.pdf_bytes)
}

/* ---------- Carga inicial de datos (solo admin) ----------
   Cada colección se evalúa por separado: si ya tiene datos se omite,
   así se puede volver a usar para completar solo lo que falte
   (p. ej. clientes ya cargados pero catálogo vacío). */

// consulta liviana (1 doc por colección) para saber qué falta por cargar
export const estadoCargaInicial = async () => {
  const uno = (nombre) => getDocs(query(collection(db, nombre), limit(1)))
  const [cli, emp, cat] = await Promise.all([uno('clientes'), uno('empleados'), uno('catalogo')])
  return { clientes: !cli.empty, empleados: !emp.empty, catalogo: !cat.empty }
}

export const cargarDatosIniciales = async (uid) => {
  const [cliSnap, empSnap, catSnap] = await Promise.all([
    getDocs(collection(db, 'clientes')),
    getDocs(collection(db, 'empleados')),
    getDocs(collection(db, 'catalogo')),
  ])

  let clientes = 0, empleados = 0, catalogo = 0

  if (cliSnap.empty) {
    for (const c of seed.clientes) await addDoc(collection(db, 'clientes'), { ...c, creado_por: uid, created_at: serverTimestamp() })
    clientes = seed.clientes.length
  }
  if (empSnap.empty) {
    for (const e of seed.empleados) await addDoc(collection(db, 'empleados'), e)
    empleados = seed.empleados.length
  }
  if (catSnap.empty) {
    for (const it of seed.catalogo) await addDoc(collection(db, 'catalogo'), it)
    catalogo = seed.catalogo.length
  }

  if (!clientes && !empleados && !catalogo) {
    throw new Error('Clientes, personal y catálogo ya tienen datos; no hay nada que cargar.')
  }
  return { clientes, empleados, catalogo }
}
