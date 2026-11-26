"""Director y colaborador independientes con información ficticia."""
from io import BytesIO
from pathlib import Path
import sys
import unittest

from docx import Document
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'act-renderer'))
from render_act import TEMPLATE_FILES, fill_act_docx, generate_act_pdf, ActDocumentError

TEMPLATES = ROOT / 'act-renderer' / 'templates'
TEMPLATE = {'companyName': 'Empresa ficticia', 'nit': '900000000-1'}
DIRECTOR = {'fullName': 'Directora ficticia', 'position': 'Directora', 'documentNumber': '111'}
EMPLOYEE = {'fullName': 'Colaboradora ficticia', 'position': 'Auxiliar', 'documentNumber': '222'}

def act(company, count=1, legacy=False):
    details = {'blankDiscountSigners': True, 'discountSignatureCount': count}
    if not legacy: details['directorSnapshot'] = DIRECTOR
    return {'companyId': company, 'fixedAssetIdSnapshot': 'TEST-001', 'recipient': DIRECTOR if count > 1 else EMPLOYEE,
            'assetSnapshot': {'type': 'laptop', 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST'},
            'documentDetails': details}

class Tests(unittest.TestCase):
    def test_all_companies_and_signer_counts(self):
        for company, filename in TEMPLATE_FILES.items():
            for count in range(1, 6):
                with self.subTest(company=company, count=count):
                    document = Document(BytesIO(fill_act_docx(TEMPLATES / filename, act(company, count), TEMPLATE, 'Sistemas ficticio')))
                    self.assertEqual(document.tables[0].cell(1, 1).text.strip(), EMPLOYEE['fullName'] if count == 1 else DIRECTOR['fullName'])
                    self.assertIn(DIRECTOR['fullName'], document.tables[3].cell(4, 0).text)
                    self.assertIn('Sistemas ficticio', document.tables[3].cell(4, 1).text)
                    signer_text = '\n'.join(cell.text for row in document.tables[-1].rows for cell in row.cells)
                    self.assertIn('Firmante 1', signer_text)

    def test_legacy_fallback_and_invalid_director(self):
        filename = TEMPLATES / TEMPLATE_FILES['redinsalud']
        document = Document(BytesIO(fill_act_docx(filename, act('redinsalud', legacy=True), TEMPLATE, 'Sistemas')))
        self.assertIn(EMPLOYEE['fullName'], document.tables[3].cell(4, 0).text)
        invalid = act('redinsalud'); invalid['documentDetails']['directorSnapshot'] = {'fullName': ''}
        with self.assertRaises(ActDocumentError): fill_act_docx(filename, invalid, TEMPLATE, 'Sistemas')
        invalid_shared = act('redinsalud', 2); invalid_shared['recipient'] = EMPLOYEE
        with self.assertRaises(ActDocumentError): fill_act_docx(filename, invalid_shared, TEMPLATE, 'Sistemas')

    def test_real_pdf(self):
        for count in (1, 5):
            with self.subTest(count=count):
                pdf, _ = generate_act_pdf(TEMPLATES, act('redinsalud', count), TEMPLATE, 'Sistemas ficticio')
                pages = PdfReader(BytesIO(pdf)).pages
                self.assertEqual(len(pages), 2)
                self.assertIn(DIRECTOR['fullName'], pages[0].extract_text())
                if count == 1: self.assertIn(EMPLOYEE['fullName'], pages[0].extract_text())
                self.assertIn('Firmante ' + str(count), pages[1].extract_text())

if __name__ == '__main__': unittest.main(verbosity=2)
