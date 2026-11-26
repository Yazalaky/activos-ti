"""Prueba el protocolo HTTP local del renderizador con una firma ficticia."""
from base64 import b64encode
from hashlib import sha256
from http.server import ThreadingHTTPServer
from pathlib import Path
import json
import runpy
import sys
import threading
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'act-renderer'))
from main import RendererHandler

fixture = runpy.run_path(str(ROOT / 'tests' / 'act-creator-signature-render.py'))


class RendererHttpTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), RendererHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.thread.join(timeout=5)
        cls.server.server_close()

    def test_real_signature_round_trip(self):
        image = fixture['fake_signature']()
        payload = {'act': fixture['act'](), 'template': fixture['TEMPLATE'], 'delivererName': 'Creador ficticio',
                   'delivererSignature': b64encode(image).decode(), 'issueDate': '20/11/2026'}
        request = urllib.request.Request(f'http://127.0.0.1:{self.server.server_port}/render',
            data=json.dumps(payload).encode(), headers={'Content-Type': 'application/json'}, method='POST')
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.load(response)
        self.assertTrue(result['delivererSignatureApplied'])
        self.assertTrue(result['directorSnapshotSupported'])
        self.assertEqual(result['delivererSignatureSha256'], sha256(image).hexdigest())
        self.assertTrue(result['pdfBase64'].startswith('JVBER'))

    def test_rejects_invalid_signature(self):
        request = urllib.request.Request(f'http://127.0.0.1:{self.server.server_port}/render',
            data=json.dumps({'act': fixture['act'](), 'template': fixture['TEMPLATE'], 'delivererSignature': '!'}).encode(),
            headers={'Content-Type': 'application/json'}, method='POST')
        with self.assertRaises(urllib.error.HTTPError) as response:
            urllib.request.urlopen(request, timeout=90)
        # ActDocumentError hereda de ValueError; el endpoint actual responde 400.
        self.assertEqual(response.exception.code, 400)


if __name__ == '__main__':
    unittest.main(verbosity=2)
