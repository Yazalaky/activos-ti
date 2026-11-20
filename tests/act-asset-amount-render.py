"""Prueba local del texto de costo en las plantillas reales y el PDF."""
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


def sample(company):
    return {
        'companyId': company,
        'fixedAssetIdSnapshot': 'TEST-001',
        'companyNitSnapshot': '900000000-1',
        'recipient': {'fullName': 'Receptora Ficticia', 'position': 'Directora', 'documentNumber': '12345678'},
        'assetSnapshot': {'type': 'laptop', 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST'},
        'documentDetails': {'discountAmountWords': 'Un millón novecientos mil pesos',
                            'discountAmountValue': '1.900.000', 'blankDiscountSigners': True},
    }


class ActAmountRendererTests(unittest.TestCase):
    def test_formatted_amount_in_all_company_templates(self):
        for company, filename in TEMPLATE_FILES.items():
            with self.subTest(company=company):
                document = Document(BytesIO(fill_act_docx(TEMPLATES / filename, sample(company), TEMPLATE, 'Entrega Ficticia')))
                authorization = next(p.text for p in document.paragraphs if p.text.startswith('En tal virtud'))
                self.assertIn('Un millón novecientos mil pesos', authorization)
                self.assertIn('1.900.000', authorization)

    def test_formatted_amount_in_real_pdf(self):
        pdf, _ = generate_act_pdf(TEMPLATES, sample('redinsalud'), TEMPLATE, 'Entrega Ficticia', '19/11/2026')
        text = ' '.join(page.extract_text() for page in PdfReader(BytesIO(pdf)).pages)
        self.assertIn('Un millón novecientos mil pesos', text)
        self.assertIn('1.900.000', text)


if __name__ == '__main__':
    unittest.main(verbosity=2)
