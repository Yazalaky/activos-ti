# Roadmap Inicial

## Estado actual
- Inventario con roles, asignacion, retorno a bodega, cambio de sede, carga de foto.
- Reutilizacion de codigos activo fijo al eliminar activos en bodega por sede.
- Bitacora con creacion y edicion.
- Finanzas con facturas/proveedores, validaciones anti-duplicado y filtros.
- Actas con borrador + subida PDF.
- Cotizaciones con estados (`pending/approved/rejected`) + PDF.

## Prioridad alta (siguiente iteracion)
1. Reportes exportables (CSV/Excel/PDF) para:
- Inventario por sede/estado/tipo.
- Facturas por periodo.
- Bitacora por periodo/sede.
2. Mejorar observabilidad UX/performance:
- Virtualizacion de tablas largas.
- `useDeferredValue`/debounce para filtros de texto.
3. Hardening adicional:
- Validaciones de esquema mas estrictas en Firestore para `quotes` y `acts`.
- Audit trail simple (`updatedAt`, `updatedByUid`) en colecciones clave.

## Prioridad media
1. Actas:
- Generacion automatica de PDF desde plantilla por `companyId`.
2. Inventario:
- Historial de cambios por activo (mini log).
3. Dashboard:
- KPIs por sede y tendencia mensual.

## Prioridad baja
1. Mejoras visuales micro-UX en dialogs largos.
2. Tests de regresion en flujos criticos.
3. Limpieza de deuda tecnica en formularios.

## Criterio de despliegue
- Siempre ejecutar:
- `npm run build`
- `firebase deploy --only firestore:rules,storage` cuando cambien reglas
- `firebase deploy --only hosting` cuando cambie UI

