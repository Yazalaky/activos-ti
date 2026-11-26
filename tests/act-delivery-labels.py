"""Comprueba los encabezados y el contenido del acta con datos ficticios."""
from io import BytesIO
from pathlib import Path
import sys
import unittest

from docx import Document
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'act-renderer'))
from render_act import TEMPLATE_FILES, fill_act_docx, generate_act_pdf

TEMPLATES = ROOT / 'act-renderer' / 'templates'
TEMPLATE = {'companyName': 'Empresa ficticia', 'nit': '900000000-1'}

def act(company):
    return {'companyId': company, 'fixedAssetIdSnapshot': 'TEST-001',
            'recipient': {'fullName': 'Directora ficticia', 'position': 'Directora', 'documentNumber': '123'},
            'assetSnapshot': {'type': 'laptop', 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST'},
            'documentDetails': {'blankDiscountSigners': True, 'discountSignatureCount': 1}}

class DeliveryLabelsTests(unittest.TestCase):
    def test_labels_and_names_in_all_company_templates(self):
        for company, filename in TEMPLATE_FILES.items():
            with self.subTest(company=company):
                document = Document(BytesIO(fill_act_docx(TEMPLATES / filename, act(company), TEMPLATE,
                                                           'Sistemas ficticio', '26/11/2026')))
                table = document.tables[3]
                self.assertEqual(table.cell(3, 0).text.strip(), 'DIRECTOR DE UNIDAD')
                self.assertEqual(table.cell(3, 1).text.strip(), 'SISTEMAS')
                self.assertIn('Directora ficticia', table.cell(4, 0).text)
                self.assertIn('Sistemas ficticio', table.cell(4, 1).text)
                self.assertIn('26/11/2026', table.cell(6, 0).text)
                self.assertIn('26/11/2026', table.cell(6, 1).text)

    def test_pdf_labels_for_all_companies(self):
        for company in TEMPLATE_FILES:
            with self.subTest(company=company):
                pdf, _ = generate_act_pdf(TEMPLATES, act(company), TEMPLATE, 'Sistemas ficticio', '26/11/2026')
                pages = PdfReader(BytesIO(pdf)).pages
                self.assertEqual(len(pages), 2)
                first_page = pages[0].extract_text()
                self.assertIn('DIRECTOR DE UNIDAD', first_page)
                self.assertIn('SISTEMAS', first_page)
                self.assertIn('Directora ficticia', first_page)
                self.assertIn('Sistemas ficticio', first_page)

if __name__ == '__main__':
    unittest.main(verbosity=2)
