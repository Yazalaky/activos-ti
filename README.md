# Inventario TI - MVP Colombia

Sistema de gestión de inventario TI, actividades y costos.

## 1. Diagrama de Entidades y Colecciones Firestore

**Colecciones:**

*   **users**: Usuarios del sistema (Admin, Técnico, Auditor).
    *   `{ uid, email, role, name }`
*   **sites** (Sedes):
    *   `{ id, name, address, city, department }`
*   **assets** (Activos):
    *   `{ id, type, brand, model, serial, internalPlate, status, siteId, purchaseDate, cost, specifications, assignedTo: { name, docId, position }, audit: { createdBy, createdAt, ... } }`
*   **activities** (Bitácora):
    *   `{ id, date, type, description, priority, assetId, siteId, techId, evidenceUrl }`
*   **maintenances** (Mantenimientos):
    *   `{ id, assetId, type, date, description, supplierId, cost, evidenceUrl }`
*   **suppliers** (Proveedores):
    *   `{ id, name, nit, contactName, phone, email, category }`
*   **invoices** (Facturas):
    *   `{ id, supplierId, number, date, subtotal, tax, total, siteId, pdfUrl }`

## 2. Instrucciones de Instalación

1.  **Requisitos:** Node.js v18+.
2.  **Instalar dependencias:**
    ```bash
    npm install
    ```
3.  **Configuración Firebase (Producción):**
    *   Crea un proyecto en Firebase Console.
    *   Habilita **Authentication** (Email/Password).
    *   Habilita **Firestore Database**.
    *   (Opcional) Habilita **Storage** si vas a subir evidencias (fotos/PDF).
    *   Crea un archivo `.env.local` (no se versiona) basado en `.env.example` y completa:
        - `VITE_FIREBASE_API_KEY`
        - `VITE_FIREBASE_AUTH_DOMAIN`
        - `VITE_FIREBASE_PROJECT_ID`
        - `VITE_FIREBASE_STORAGE_BUCKET`
        - `VITE_FIREBASE_MESSAGING_SENDER_ID`
        - `VITE_FIREBASE_APP_ID`

4.  **Ejecutar:**
    ```bash
    npm run dev
    ```

## 3. Reglas de Seguridad (Firestore/Storage)

Este repo incluye reglas listas para usar:

- Firestore: `firestore.rules`
- Storage: `storage.rules`

### Bootstrap de roles
Las reglas usan `users/{uid}.role` con valores `admin | tech | auditor`.

1) Crea un usuario en Auth (Email/Password).
2) En Firestore, crea el documento `users/{uid}` con:
   - `email`: igual al email del usuario
   - `name`: nombre visible
   - `role`: `admin` (para el primer administrador)

> Nota: la app permite que un usuario cree su propio perfil solo como `tech`/`auditor` (no puede auto-asignarse `admin`).
