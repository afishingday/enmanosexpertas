# Informes de Supervisión — En Manos Expertas (por Ágora)

Plataforma web (React + Vite + Firebase) para crear informes de supervisión, con
autenticación por roles, gestión de clientes/empleados, historial por copropiedad
y generación de PDF paginado no editable.

## 1. Requisitos
- Node.js 18+ y npm
- Un proyecto de Firebase ya creado (ver la *Guía de instalación de Firebase*), con
  Authentication (correo/contraseña), Firestore y Storage activados.

## 2. Configurar
```bash
npm install
cp .env.example .env      # en Windows:  copy .env.example .env
```
Abre `.env` y pega los valores del bloque **firebaseConfig**
(Firebase Console → Configuración del proyecto → General → Tus apps → app web).

## 3. Correr en local
```bash
npm run dev
```
Abre la URL que muestra la terminal (normalmente http://localhost:5173).

## 4. Primer uso
1. Regístrate con tu correo (quedarás como *colaborador*).
2. Conviértete en **admin**: en Firebase Console → Firestore → colección `usuarios`
   → tu documento → cambia `rol` a `admin`. Recarga la app.
3. Entra a **Admin → Cargar datos iniciales** para subir los 50 clientes, 47
   empleados y el catálogo (solo la primera vez).
4. Crea un informe desde **Nuevo**.

## 5. Publicar (deploy) en Firebase Hosting
```bash
npm install -g firebase-tools    # una sola vez
firebase login
# edita .firebaserc y pon tu PROJECT_ID en "default"
npm run deploy                   # hace build + firebase deploy
```
Las reglas de seguridad (`firestore.rules`, `storage.rules`) también se publican con
`firebase deploy`. Índices en `firestore.indexes.json`.

## 6. Estructura
```
src/
  firebase.js            inicialización de Firebase (lee .env)
  auth/AuthContext.jsx   sesión y rol del usuario
  lib/
    datos.js             acceso a Firestore + Storage
    calc.js              cálculo de efectividad
    imagen.js            compresión y recorte de fotos
    pdf.js               PDF paginado (no editable)
    logo.js / seed.json  logo y datos iniciales
  components/
    Login, TopBar, FooterAgora
    ReporteForm          crear informe (formulario + fotos + PDF + guardado)
    CropModal            editor de recorte
    Historial            historial por copropiedad / propios
    AdminPanel           CRUD de clientes, empleados y catálogo
```

## 7. Modelo de datos (Firestore)
`usuarios`, `clientes`, `empleados`, `catalogo`, `informes` (el historial).
Las fotos y los PDF viven en Storage; el informe guarda sus URLs.

## Notas
- El PDF se genera como imagen (no editable) con permisos de solo impresión.
- Las fotos se comprimen (Media ≈ 1150 px, ~200 KB) antes de subir, para no llenar el
  almacenamiento.
- Desarrollado por **Ágora** — *Donde tu comunidad se encuentra*.
