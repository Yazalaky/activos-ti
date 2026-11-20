"""Comprueba el campo Licencia en plantillas y PDF con datos ficticios."""
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


def sample(company, license_value='Windows 10'):
    return {
        'companyId': company,
        'fixedAssetIdSnapshot': 'TEST-001',
        'companyNitSnapshot': '900000000-1',
        'recipient': {'fullName': 'Receptora Ficticia', 'position': 'Directora', 'documentNumber': '12345678'},
        'assetSnapshot': {'type': 'laptop', 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST', 'os': 'Windows 10'},
        'documentDetails': {'license': license_value, 'blankDiscountSigners': True},
    }


class ActLicenseRendererTests(unittest.TestCase):
    def test_license_in_all_company_templates(self):
        for company, filename in TEMPLATE_FILES.items():
            with self.subTest(company=company):
                doc = Document(BytesIO(fill_act_docx(TEMPLATES / filename, sample(company), TEMPLATE, 'Entrega Ficticia')))
                self.assertIn('Windows 10', doc.tables[1].cell(6, 1).text)

    def test_edited_license_is_the_value_printed(self):
        document = Document(BytesIO(fill_act_docx(TEMPLATES / TEMPLATE_FILES['redinsalud'],
                                                   sample('redinsalud', 'Windows 11'), TEMPLATE, 'Entrega Ficticia')))
        self.assertIn('Windows 11', document.tables[1].cell(6, 1).text)
        self.assertNotIn('Windows 10', document.tables[1].cell(6, 1).text)

    def test_license_in_real_pdf(self):
        pdf, _ = generate_act_pdf(TEMPLATES, sample('redinsalud'), TEMPLATE, 'Entrega Ficticia', '20/11/2026')
        self.assertIn('Windows 10', PdfReader(BytesIO(pdf)).pages[0].extract_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
