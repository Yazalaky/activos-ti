"""Prueba local de tipos de equipo en las plantillas de actas."""
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
W14 = '{http://schemas.microsoft.com/office/word/2010/wordml}'


def act(company, kind):
    choices = {'desktop': False, 'laptop': False, 'printer': False, 'tablet': False, 'cellphone': False, 'other': False}
    choices[kind if kind != 'custom' else 'other'] = True
    return {'companyId': company, 'fixedAssetIdSnapshot': 'TEST-001', 'companyNitSnapshot': '900000000-1',
            'recipient': {'fullName': 'Receptora ficticia', 'position': 'Directora', 'documentNumber': '123456'},
            'assetSnapshot': {'type': kind, 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST'},
            'documentDetails': {'blankDiscountSigners': True, 'deviceTypes': choices,
                                'otherDeviceType': 'Video beam' if kind == 'custom' else ''}}


class AssetTypeActTests(unittest.TestCase):
    def test_cellphone_tablet_and_custom_in_all_templates(self):
        for company, filename in TEMPLATE_FILES.items():
            for kind, index in [('cellphone', 2), ('tablet', 3), ('custom', 2)]:
                with self.subTest(company=company, kind=kind):
                    document = Document(BytesIO(fill_act_docx(TEMPLATES / filename, act(company, kind), TEMPLATE, 'Entrega ficticia')))
                    cell = document.tables[1].cell(2, 0)
                    controls = cell._tc.xpath('.//w14:checkbox')
                    states = [control.find(f'{W14}checked').get(f'{W14}val') for control in controls[:4]]
                    self.assertEqual(states, ['1' if i == index else '0' for i in range(4)])
                    if kind == 'cellphone': self.assertIn('Celular', cell.text)
                    if kind == 'custom': self.assertIn('Video beam', cell.text)

    def test_cellphone_actual_pdf(self):
        pdf, _ = generate_act_pdf(TEMPLATES, act('redinsalud', 'cellphone'), TEMPLATE, 'Entrega ficticia', '20/11/2026')
        self.assertIn('Celular', PdfReader(BytesIO(pdf)).pages[0].extract_text())


if __name__ == '__main__':
    unittest.main(verbosity=2)
