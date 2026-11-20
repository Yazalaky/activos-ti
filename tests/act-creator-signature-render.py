"""Pruebas locales con firma ficticia; no acceden a Firebase."""
from base64 import b64encode
from io import BytesIO
from pathlib import Path
import struct
import sys
import unittest
import zlib
import os

from docx import Document
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'act-renderer'))
from render_act import ActDocumentError, TEMPLATE_FILES, fill_act_docx, generate_act_pdf

TEMPLATES = ROOT / 'act-renderer' / 'templates'
TEMPLATE = {'companyName': 'Empresa ficticia', 'nit': '900000000-1'}


def fake_signature():
    def chunk(name, body):
        return struct.pack('>I', len(body)) + name + body + struct.pack('>I', zlib.crc32(name + body) & 0xffffffff)
    # Imagen sintética: patrón negro, no contiene la firma de ninguna persona.
    rows = b''.join(b'\x00' + b''.join(b'\x00\x00\x00' if abs(x - y * 4) < 4 else b'\xff\xff\xff'
                                        for x in range(500)) for y in range(100))
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', 500, 100, 8, 2, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


def act(company='redinsalud', count=1):
    return {'companyId': company, 'fixedAssetIdSnapshot': 'TEST-001', 'companyNitSnapshot': '900000000-1',
            'recipient': {'fullName': 'Receptora ficticia', 'position': 'Directora', 'documentNumber': '123456'},
            'assetSnapshot': {'type': 'laptop', 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST'},
            'documentDetails': {'blankDiscountSigners': True, 'discountSignatureCount': count}}


class CreatorSignatureRendererTests(unittest.TestCase):
    def test_image_is_in_deliverer_cell_for_all_companies(self):
        data = fake_signature()
        for company, filename in TEMPLATE_FILES.items():
            with self.subTest(company=company):
                doc = Document(BytesIO(fill_act_docx(TEMPLATES / filename, act(company), TEMPLATE,
                    'Creador ficticio', '20/11/2026', b64encode(data).decode())))
                deliverer = doc.tables[3].cell(5, 1)
                recipient = doc.tables[3].cell(5, 0)
                self.assertEqual(len(deliverer._element.xpath('.//w:drawing')), 1)
                self.assertEqual(len(recipient._element.xpath('.//w:drawing')), 0)
                self.assertTrue(any(part.blob == data for part in doc.part.related_parts.values()
                                    if hasattr(part, 'blob')))

    def test_without_signature_and_invalid_signatures(self):
        doc = Document(BytesIO(fill_act_docx(TEMPLATES / TEMPLATE_FILES['redinsalud'], act(), TEMPLATE, 'Creador')))
        self.assertEqual(len(doc.tables[3].cell(5, 1)._element.xpath('.//w:drawing')), 0)
        for value in ('!', b64encode(b'not a png').decode(), 'a' * 333_337):
            with self.subTest(value=value[:10]), self.assertRaises(ActDocumentError):
                fill_act_docx(TEMPLATES / TEMPLATE_FILES['redinsalud'], act(), TEMPLATE, 'Creador', None, value)

    def test_real_pdf_retains_pages_and_signature(self):
        pdf, _ = generate_act_pdf(TEMPLATES, act(count=5), TEMPLATE, 'Creador ficticio', '20/11/2026',
                                  deliverer_signature=b64encode(fake_signature()).decode())
        if os.environ.get('ACT_SIGNATURE_SAMPLE_DIR'):
            (Path(os.environ['ACT_SIGNATURE_SAMPLE_DIR']) / 'acta-firma-ficticia.pdf').write_bytes(pdf)
        pages = PdfReader(BytesIO(pdf)).pages
        self.assertEqual(len(pages), 2)
        self.assertIn('Creador ficticio', pages[0].extract_text())
        self.assertIn('AUTORIZACION DE DESCUENTO', pages[1].extract_text())
        self.assertIn('Firmante 5', pages[1].extract_text())
        resources = pages[0]['/Resources'].get_object().get('/XObject', {}).get_object()
        self.assertTrue(any(obj.get_object().get('/Subtype') == '/Image'
                            and obj.get_object().get('/Width', 0) >= 400
                            and obj.get_object().get('/Height', 0) >= 80
                            and obj.get_object().get('/Width') == 5 * obj.get_object().get('/Height')
                            for obj in resources.values()))

    def test_signature_stays_in_delivery_area_for_every_company(self):
        encoded = b64encode(fake_signature()).decode()
        for company in TEMPLATE_FILES:
            with self.subTest(company=company):
                pdf, _ = generate_act_pdf(TEMPLATES, act(company, count=5), TEMPLATE, 'Creador ficticio',
                                          '20/11/2026', deliverer_signature=encoded)
                pages = PdfReader(BytesIO(pdf)).pages
                self.assertIn('AUTORIZACION DE DESCUENTO', pages[1].extract_text())
                page = pages[0]
                objects = page['/Resources'].get_object().get('/XObject', {}).get_object()
                signature_names = {name for name, obj in objects.items()
                    if obj.get_object().get('/Subtype') == '/Image'
                    and obj.get_object().get('/Width', 0) >= 400
                    and obj.get_object().get('/Height', 0) >= 80
                    and obj.get_object().get('/Width') == 5 * obj.get_object().get('/Height')}
                positions, labels = [], []
                def image_position(op, args, cm, _tm):
                    if op == b'Do' and args[0] in signature_names:
                        positions.append(tuple(float(value) for value in cm))
                def label_position(text, _cm, tm, _font, _size):
                    if text.strip() == 'Firma':
                        labels.append((float(tm[4]), float(tm[5])))
                page.extract_text(visitor_operand_before=image_position, visitor_text=label_position)
                self.assertEqual(len(positions), 1)
                self.assertGreaterEqual(len(labels), 2)
                deliverer = max(labels, key=lambda point: point[0])
                width, _, _, height, x, y = positions[0]
                self.assertGreater(x, deliverer[0])
                self.assertLessEqual(x + width, float(page.mediabox.width))
                self.assertLess(abs(y - deliverer[1]), 20)
                self.assertLessEqual(height, 24)


if __name__ == '__main__':
    unittest.main(verbosity=2)
