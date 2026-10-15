"""Private HTTP entry point for original-template act PDF rendering."""

from __future__ import annotations

import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path

from render_act import ActDocumentError, generate_act_pdf


TEMPLATES_DIR = Path(__file__).parent / "templates"
MAX_REQUEST_BYTES = 1024 * 1024


class RendererHandler(BaseHTTPRequestHandler):
    server_version = "ActTemplateRenderer/1.0"

    def _json(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path == "/healthz":
            self._json(200, {"status": "ok"})
            return
        self._json(404, {"error": "No encontrado."})

    def do_POST(self) -> None:
        if self.path != "/render":
            self._json(404, {"error": "No encontrado."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._json(400, {"error": "Solicitud inválida."})
            return
        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self._json(413, {"error": "El contenido de la solicitud supera el límite permitido."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
            if not isinstance(payload, dict):
                raise ValueError("El cuerpo debe ser un objeto JSON.")
            pdf_bytes, filename = generate_act_pdf(
                TEMPLATES_DIR,
                payload.get("act") or {},
                payload.get("template") or {},
                str(payload.get("delivererName") or ""),
                str(payload.get("issueDate") or "") or None,
            )
            self._json(200, {"fileName": filename, "pdfBase64": base64.b64encode(pdf_bytes).decode("ascii")})
        except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
            self._json(400, {"error": str(error)[:240]})
        except ActDocumentError as error:
            self._json(422, {"error": str(error)[:300]})
        except Exception as error:
            print(f"Internal renderer failure: {type(error).__name__}", flush=True)
            self._json(500, {"error": "No se pudo generar el PDF del acta."})

    def log_message(self, format: str, *args: object) -> None:
        # No loguear cuerpos de solicitud: contienen datos personales.
        super().log_message(format, *args)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    ThreadingHTTPServer(("0.0.0.0", port), RendererHandler).serve_forever()
