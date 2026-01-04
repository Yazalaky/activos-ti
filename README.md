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
    npm install react react-dom react-router-dom firebase lucide-react date-fns recharts clsx tailwind-merge
    npm install -D typescript vite @vitejs/plugin-react tailwindcss postcss autoprefixer
    ```
3.  **Configuración Firebase:**
    *   Crea un proyecto en [Firebase Console](https://console.firebase.google.com/).
    *   Habilita **Authentication** (Email/Password).
    *   Habilita **Firestore Database** (Modo producción).
    *   Habilita **Storage**.
    *   Copia las credenciales de tu proyecto.
    *   Edita el archivo `firebase.ts` y reemplaza el objeto `firebaseConfig` con tus credenciales.

4.  **Ejecutar:**
    ```bash
    npm run dev
    ```

## 3. Reglas de Seguridad (Firestore - Ejemplo Básico)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null; // En prod, restringir por request.auth.token.role == 'admin'
    }
  }
}
```
