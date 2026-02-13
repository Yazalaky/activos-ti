# Registro de Decisiones (Inicial)

## D-001: UI base con MUI
- Decision: migrar a MUI para consistencia visual y velocidad de desarrollo.
- Motivo: Tailwind en CDN no era apropiado para produccion y habia inconsistencias de estilo.

## D-002: Control de acceso por rol en Firestore/Storage
- Decision: centralizar autorizacion por rol (`admin`, `tech`, `management`, `auditor`) en reglas.
- Motivo: evitar depender solo de bloqueos UI.

## D-003: Activos con codigo fijo por sede
- Decision: generar `fixedAssetId` por `prefix + secuencia`.
- Motivo: identificacion operativa simple por sede.

## D-004: Reutilizacion de codigos liberados
- Decision: al eliminar activos en bodega, liberar secuencias en `sites.releasedAssetSeqs`.
- Motivo: reutilizar codigos para nuevos equipos sin romper el esquema actual.

## D-005: Adjuntos en Storage + metadata en Firestore
- Decision: guardar archivos en Storage y persistir `url/path/name/type/size` en Firestore.
- Motivo: consultas rapidas y control de validaciones por reglas.

## D-006: Cotizaciones como modulo independiente
- Decision: coleccion `quotes` separada de `invoices`.
- Motivo: ciclo funcional distinto (cotizacion previa vs factura final).

## D-007: Fechas `YYYY-MM-DD` y parseo local en bitacora
- Decision: parsear fechas manualmente para evitar desfase UTC en nombre del dia.
- Motivo: corregir inconsistencia de dias mostrados.

## D-008: Operaciones de escritura para admin/tech
- Decision: permitir creacion/edicion en modulos operativos para `admin` y `tech`.
- Motivo: reflejar operacion real del area de sistemas.

