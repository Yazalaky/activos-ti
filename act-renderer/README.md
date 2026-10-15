# Renderizador de actas originales

Este servicio rellena una copia temporal del DOCX original de cada empresa y lo convierte a PDF con LibreOffice. Los DOCX incluidos en `templates/` son los originales recibidos en `incoming/actas/`; cada uno conserva su logo y maquetación. El servicio no guarda documentos ni tiene acceso a Firestore o Storage.

La aplicación no llama directamente al servicio. La callable `generateActPdf` comprueba usuario, rol, sede y estado del acta; obtiene la plantilla/NIT desde Firestore; y llama a Cloud Run con un token de identidad. Cloud Run debe permanecer privado y solo la cuenta de servicio de esa callable recibe `roles/run.invoker`.

## Prueba local

Requiere LibreOffice y Python 3.12. En la raíz del proyecto:

```bash
python3 -m venv /tmp/act-renderer-venv
/tmp/act-renderer-venv/bin/pip install -r act-renderer/requirements.txt
cd act-renderer
PORT=8080 /tmp/act-renderer-venv/bin/python main.py
```

`GET http://localhost:8080/healthz` debe responder `{"status":"ok"}`. El endpoint `POST /render` está pensado para el tráfico interno autenticado de Cloud Run; no se debe hacer público.

## Preparación de Google Cloud

Proyecto y región usados por esta app: `gestion-ti-d18d1` y `us-central1`. Primero inicia sesión con `gcloud auth login`, luego ejecuta desde la raíz del repo:

```bash
gcloud config set project gestion-ti-d18d1
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project gestion-ti-d18d1
gcloud iam service-accounts create act-renderer-runtime --display-name="Runtime privado para imprimir actas" --project gestion-ti-d18d1
gcloud iam service-accounts create act-pdf-renderer-caller --display-name="Callable de impresión de actas" --project gestion-ti-d18d1
gcloud projects add-iam-policy-binding gestion-ti-d18d1 --member="serviceAccount:act-pdf-renderer-caller@gestion-ti-d18d1.iam.gserviceaccount.com" --role="roles/datastore.user"
gcloud run deploy act-template-renderer --source act-renderer --region us-central1 --project gestion-ti-d18d1 --service-account act-renderer-runtime@gestion-ti-d18d1.iam.gserviceaccount.com --no-allow-unauthenticated --memory 1Gi --cpu 1 --timeout 180 --concurrency 1 --max-instances 2
gcloud run services add-iam-policy-binding act-template-renderer --region us-central1 --project gestion-ti-d18d1 --member="serviceAccount:act-pdf-renderer-caller@gestion-ti-d18d1.iam.gserviceaccount.com" --role="roles/run.invoker"
gcloud run services describe act-template-renderer --region us-central1 --project gestion-ti-d18d1 --format="value(status.url)"
```

La última orden muestra la URL que Firebase CLI solicitará como `ACT_RENDERER_URL` al desplegar `generateActPdf`. La cuenta `act-pdf-renderer-caller` requiere lectura y actualización de los datos del acta, además del permiso de invocación al renderizador privado; la cuenta de ejecución de Cloud Run no recibe permisos de datos. Estos comandos crean recursos y asignan IAM en Google Cloud; ejecútalos solo al aprobar la publicación del renderizador privado.
