# Arquitectura - Gestion Activos TI

## 1. Resumen
- Frontend: `React 19 + TypeScript + Vite + MUI`.
- Router: `HashRouter`.
- Backend: Firebase (`Auth`, `Firestore`, `Storage`, `Functions`).
- Roles:
- `admin`: escritura total + administracion de usuarios.
- `tech`: escritura funcional (inventario, bitacora, finanzas, cotizaciones, actas).
- `management` y `auditor`: solo lectura.

## 2. Modulos principales
- `Dashboard`: KPIs y actividad.
- `Inventario`: activos, asignacion, retorno a bodega, cambio de sede, adjuntos de foto.
- `Bitacora`: registro y edicion de actividades.
- `Actas`: actas por activo (borrador + carga PDF).
- `Cotizaciones`: cotizaciones por sede/proveedor, estado y PDF.
- `Proveedores y Costos`: proveedores, facturas, reporte basico.
- `Sedes`: administracion de sedes/prefijos/companyId.
- `Usuarios` (admin): alta de usuarios y roles.

## 3. Firestore (colecciones)
- `users`: perfil/rol.
- `sites`: datos sede, `prefix`, `assetSeq`, `releasedAssetSeqs`, `companyId`.
- `assets`: inventario de equipos.
- `activities`: bitacora.
- `suppliers`: proveedores.
- `invoices`: facturas + adjunto.
- `acts`: actas + adjunto PDF.
- `quotes`: cotizaciones + adjunto PDF.

## 4. Storage (rutas)
- `assets/{assetId}/photos/{file}` fotos de activos.
- `invoices/{invoiceId}/attachments/{file}` PDF/imagen factura.
- `acts/{actId}/pdf/{file}` PDF de acta.
- `quotes/{quoteId}/attachments/{file}` PDF de cotizacion.

## 5. Generacion de codigo activo fijo
- Formato: `{PREFIX}-{NNN}` (ej: `MNAC-001`).
- Secuencia normal: `sites.assetSeq`.
- Reutilizacion: `sites.releasedAssetSeqs`.
- Cuando se eliminan activos en bodega por sede, se liberan secuencias y se reutilizan en nuevas altas.

## 6. Seguridad
- Reglas principales en:
- `firestore.rules`
- `storage.rules`
- Todas las operaciones relevantes se validan por rol (`canWrite`, `isAdmin`).

## 7. Estructura de codigo
- `pages/`: pantallas por modulo.
- `components/`: layout/comunes.
- `services/api.ts`: CRUD Firestore y operaciones de dominio.
- `services/storageUpload.ts` y `services/storageFiles.ts`: subida/eliminacion en Storage.
- `types.ts`: tipos de dominio.

## 8. Flujo local
1. Configurar `.env.local` desde `.env.example`.
2. `npm install`
3. `npm run dev`
4. `npm run build` antes de publicar.

