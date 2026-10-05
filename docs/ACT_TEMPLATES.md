# Plantillas de actas

Las plantillas generales se administran desde `Administración → Plantillas de actas`.

Cada empresa debe tener:

- El DOCX original como archivo fuente.
- Un PDF operativo rellenable. Este es el archivo que utiliza el sistema para generar el acta.
- El NIT configurado en la plantilla.

El PDF operativo debe tener campos AcroForm con estos nombres:

| Campo | Valor |
| --- | --- |
| `recipient_full_name` | Nombre completo |
| `recipient_position` | Cargo |
| `recipient_email` | Correo |
| `recipient_document` | Documento |
| `recipient_area` | Área |
| `recipient_phone` | Teléfono |
| `recipient_extension` | Extensión |
| `recipient_network_user` | Usuario de red |
| `act_date` | Fecha de generación |
| `site_name` | Sede |
| `company_nit` | NIT configurado |
| `asset_type` | Tipo de equipo |
| `asset_fixed_id` | Activo fijo |
| `asset_brand` | Marca |
| `asset_model` | Modelo |
| `asset_serial` | Serial |
| `asset_processor` | Procesador |
| `asset_ram` | RAM |
| `asset_storage` | Disco/almacenamiento |
| `asset_os` | Sistema operativo |
| `observations` | Observaciones |

Opcionalmente puede existir un checkbox con el nombre `asset_type_laptop`, `asset_type_desktop`, `asset_type_monitor`, etc. El sistema marcará el tipo correspondiente.

La firma electrónica simple se inserta usando la posición configurada en la pantalla de plantillas. Las coordenadas usan puntos PDF, con origen en la esquina inferior izquierda de la página.

Los DOCX que todavía no se hayan convertido a PDF rellenable se conservarán como fuente, pero no podrán generar automáticamente un acta hasta que exista el PDF operativo.
