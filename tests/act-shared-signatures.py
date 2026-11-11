"""Pruebas locales con plantillas reales y datos ficticios; no acceden a Firebase.

Ejecutar con python-docx y pypdf instalados, más LibreOffice en el PATH.
"""
from io import BytesIO
from pathlib import Path
import os
import sys
import unittest

from docx import Document
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "act-renderer"))
from render_act import ActDocumentError, TEMPLATE_FILES, fill_act_docx, generate_act_pdf

TEMPLATES = ROOT / "act-renderer" / "templates"
TEMPLATE = {"companyName": "Empresa ficticia", "nit": "900000000-1"}


def act(company="redinsalud", count=None):
    details = {"discountAmountWords": "Dos millones", "discountAmountValue": "2000000"}
    if count is not None:
        details["discountSignatureCount"] = count
    return {
        "companyId": company,
        "fixedAssetIdSnapshot": "TEST-001",
        "companyNitSnapshot": "900000000-1",
        "recipient": {"fullName": "Receptora Ficticia", "position": "Directora", "documentNumber": "12345678"},
        "assetSnapshot": {"type": "printer", "brand": "Marca", "model": "Modelo", "serial": "SERIE-TEST"},
        "documentDetails": details,
    }


def signature_alignment(pdf):
    """Mide en el PDF la posición horizontal del texto y del primer firmante."""
    positions = {}
    for page in PdfReader(BytesIO(pdf)).pages[1:]:
        def collect(text, cm, tm, _font, _size):
            for label in ("En constancia firman:", "Firmante 1"):
                if text.startswith(label):
                    positions[label] = cm[0] * tm[4] + cm[2] * tm[5] + cm[4]
        page.extract_text(visitor_text=collect)
    return positions


class SharedSignatureTests(unittest.TestCase):
    def test_original_and_shared_docx_for_every_company(self):
        for company, filename in TEMPLATE_FILES.items():
            for count in (None, 1, 2, 3, 4, 5):
                with self.subTest(company=company, count=count):
                    document = Document(BytesIO(fill_act_docx(TEMPLATES / filename, act(company, count), TEMPLATE, "Entrega Ficticia", "11/11/2026")))
                    authorization = next(p.text for p in document.paragraphs if p.text.startswith("En tal virtud"))
                    self.assertIn("Empresa ficticia", authorization)
                    self.assertIn("2000000", authorization)
                    self.assertIn("Receptora Ficticia", document.tables[3].cell(4, 0).text)
                    if count is None or count == 1:
                        self.assertIn("Receptora Ficticia", authorization)
                        self.assertIn("12345678", authorization)
                        self.assertEqual(len(document.tables), 4)
                    else:
                        self.assertNotIn("Receptora Ficticia", authorization)
                        self.assertNotIn("12345678", authorization)
                        self.assertIn("personas firmantes", authorization)
                        blocks = [c.text for row in document.tables[4].rows for c in row.cells if c.text.strip()]
                        self.assertEqual(len(blocks), count)
                        for index, block in enumerate(blocks, 1):
                            for label in (f"Firmante {index}", "Nombre:", "Identificación:", "Cargo:", "Firma:"):
                                self.assertIn(label, block)

    def test_invalid_counts_are_rejected(self):
        for count in (0, 6, -1, 2.5, True, "5", None):
            bad = act()
            bad["documentDetails"]["discountSignatureCount"] = count
            with self.subTest(count=count), self.assertRaises(ActDocumentError):
                fill_act_docx(TEMPLATES / TEMPLATE_FILES["redinsalud"], bad, TEMPLATE, "")

    def test_actual_pdf_pagination(self):
        for count in (1, 2, 5):
            with self.subTest(count=count):
                pdf, _ = generate_act_pdf(TEMPLATES, act(count=count), TEMPLATE, "Entrega Ficticia", "11/11/2026")
                pages = [page.extract_text() for page in PdfReader(BytesIO(pdf)).pages]
                self.assertIn("Receptora Ficticia", pages[0])
                self.assertIn("AUTORIZACION DE DESCUENTO", pages[1])
                self.assertNotIn("AUTORIZACION DE DESCUENTO", pages[0])
                if count > 1:
                    positions = signature_alignment(pdf)
                    self.assertIn("En constancia firman:", positions)
                    self.assertIn("Firmante 1", positions)
                    self.assertAlmostEqual(positions["Firmante 1"], positions["En constancia firman:"], delta=1)
                    self.assertNotIn("Receptora Ficticia", " ".join(pages[1:]))
                    for number in range(1, count + 1):
                        matching = [page for page in pages[1:] if f"Firmante {number}" in page]
                        self.assertEqual(len(matching), 1)
                        start = matching[0].index(f"Firmante {number}")
                        self.assertIn("Firma:", matching[0][start:])
                else:
                    self.assertIn("Receptora Ficticia", pages[1])
                if count == 5 and os.environ.get("ACT_SAMPLE_DIR"):
                    (Path(os.environ["ACT_SAMPLE_DIR"]) / "acta-firmas-compartidas-ejemplo.pdf").write_bytes(pdf)
                print(f"CHECK: PDF con {count} firma(s): {len(pages)} páginas", flush=True)

    def test_shared_pdf_for_every_company(self):
        for company in TEMPLATE_FILES:
            with self.subTest(company=company):
                pdf, _ = generate_act_pdf(TEMPLATES, act(company, 5), TEMPLATE, "Entrega Ficticia", "11/11/2026")
                pages = [page.extract_text() for page in PdfReader(BytesIO(pdf)).pages]
                self.assertIn("Receptora Ficticia", pages[0])
                self.assertIn("AUTORIZACION DE DESCUENTO", pages[1])
                positions = signature_alignment(pdf)
                self.assertIn("En constancia firman:", positions)
                self.assertIn("Firmante 1", positions)
                self.assertAlmostEqual(positions["Firmante 1"], positions["En constancia firman:"], delta=1)
                for number in range(1, 6):
                    matching = [page for page in pages[1:] if f"Firmante {number}" in page]
                    self.assertEqual(len(matching), 1)
                    self.assertIn("Firma:", matching[0][matching[0].index(f"Firmante {number}"):])
                print(f"CHECK: {company}, 5 firmas: {len(pages)} páginas", flush=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
