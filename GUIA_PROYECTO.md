# Guia del Proyecto

## Plantilla Ideal (Recomendada)

Usa esta estructura minima para cualquier proyecto que migres a Windows 11:

````md
# Nombre del proyecto

## 1. Descripcion
Breve explicacion de que hace el proyecto.

## 2. Requisitos del entorno
- Sistema operativo: Windows 11
- Node.js vXX
- Python vX.X (si aplica)
- Firebase CLI (si aplica)
- Docker Desktop (si aplica)

## 3. Variables de entorno
Archivo .env requerido:
- VAR_1=
- VAR_2=

## 4. Instalacion
```bash
npm install
# o
pip install -r requirements.txt
```

## 5. Ejecucion
```bash
npm run dev
# o
python app.py
```

## 6. Build / Deploy
```bash
npm run build
firebase deploy
```

## 7. Notas importantes
- Rutas usadas
- Puertos
- Advertencias
````

## Guia Aplicada a Este Proyecto (activos-ti)

### 1. Descripcion
Aplicacion web para gestion de inventario TI, bitacora de actividades, proveedores, facturas, cotizaciones y actas, con autenticacion y permisos por rol usando Firebase.

### 2. Requisitos del entorno
- Sistema operativo: Windows 11 (PowerShell recomendado).
- Node.js: v20 LTS recomendado (el frontend soporta v18+, pero `functions` declara Node 20).
- npm: incluido con Node.js.
- Firebase CLI: `npm install -g firebase-tools`.
- Git: para clonar/actualizar el repositorio.

### 3. Variables de entorno
Crear `/.env.local` a partir de `/.env.example`.

Variables requeridas:
- `VITE_FIREBASE_API_KEY=`
- `VITE_FIREBASE_AUTH_DOMAIN=`
- `VITE_FIREBASE_PROJECT_ID=`
- `VITE_FIREBASE_STORAGE_BUCKET=`
- `VITE_FIREBASE_MESSAGING_SENDER_ID=`
- `VITE_FIREBASE_APP_ID=`

Opcional:
- `VITE_FIREBASE_MEASUREMENT_ID=`

En PowerShell:

```powershell
Copy-Item .env.example .env.local
```

### 4. Instalacion

Instalar dependencias del frontend (raiz del repo):

```bash
npm install
```

Instalar dependencias de Cloud Functions (si vas a desplegar funciones):

```bash
cd functions
npm install
cd ..
```

### 5. Ejecucion

Servidor de desarrollo:

```bash
npm run dev
```

Preview local del build:

```bash
npm run preview
```

### 6. Build / Deploy

Build de produccion:

```bash
npm run build
```

Autenticacion y seleccion de proyecto Firebase:

```bash
firebase login
firebase use gestion-ti-d18d1
```

Despliegues habituales:

```bash
# Hosting (UI)
firebase deploy --only hosting

# Reglas de Firestore y Storage
firebase deploy --only firestore:rules,storage

# Functions (si hubo cambios en /functions)
firebase deploy --only functions
```

### 7. Notas importantes

Rutas clave:
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`
- `docs/ROADMAP.md`
- `firestore.rules`
- `storage.rules`
- `firebase.json`
- `functions/index.js`

Puertos:
- `5173`: `npm run dev` (Vite dev server por defecto).
- `4173`: `npm run preview` (Vite preview por defecto).

Advertencias:
- `/.env.local` no debe versionarse.
- Solo se exponen variables que empiezan por `VITE_`.
- Reinicia `npm run dev` despues de cambiar variables de entorno.
- Ejecuta `npm run build` antes de desplegar hosting.
- La configuracion de chunks en `vite.config.ts` ya contempla separadores de ruta de Windows (`\\`) y Linux (`/`).
