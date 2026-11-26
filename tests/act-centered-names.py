"""Posición de nombres y fechas en los PDF generados, con datos ficticios."""
from pathlib import Path
import sys
import unittest

try:
    import fitz
except ImportError:
    fitz = None

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'act-renderer'))
from render_act import TEMPLATE_FILES, generate_act_pdf

TEMPLATES = ROOT / 'act-renderer' / 'templates'

@unittest.skipUnless(fitz, 'Esta prueba de posiciones necesita PyMuPDF (fitz).')
class CenteredNamesTests(unittest.TestCase):
    def test_names_centered_like_dates_in_all_companies(self):
        for company in TEMPLATE_FILES:
            with self.subTest(company=company):
                act = {'companyId': company, 'fixedAssetIdSnapshot': 'TEST-001',
                       'recipient': {'fullName': 'Colaboradora ficticia', 'position': 'Auxiliar', 'documentNumber': '123'},
                       'assetSnapshot': {'type': 'laptop', 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST'},
                       'documentDetails': {'directorSnapshot': {'fullName': 'Valentina Gonzalez Castillo'},
                                           'blankDiscountSigners': True, 'discountSignatureCount': 1}}
                pdf, _ = generate_act_pdf(TEMPLATES, act, {'companyName': 'Empresa ficticia', 'nit': '900000000-1'},
                                          'William Hernandez Perez', '26/11/2026')
                with fitz.open(stream=pdf, filetype='pdf') as document:
                    self.assertEqual(len(document), 2)
                    page = document[0]
                    director = page.search_for('Valentina Gonzalez Castillo')
                    systems = page.search_for('William Hernandez Perez')
                    dates = sorted(page.search_for('26/11/2026'), key=lambda r: r.x0)
                    self.assertEqual(len(director), 1)
                    self.assertEqual(len(systems), 1)
                    self.assertEqual(len(dates), 2)
                    center = lambda r: (r.x0 + r.x1) / 2
                    self.assertAlmostEqual(center(director[0]), center(dates[0]), delta=3)
                    self.assertAlmostEqual(center(systems[0]), center(dates[1]), delta=3)
                    self.assertGreater(director[0].y0, 400)
                    self.assertGreater(systems[0].y0, 400)

    def test_long_name_remains_visible_without_overlapping_label(self):
        name = 'Alejandra Maria Fernanda Gonzalez Rodriguez Sanchez Hernandez Martinez Pardo'
        act = {'companyId': 'redinsalud', 'fixedAssetIdSnapshot': 'TEST-001',
               'recipient': {'fullName': 'Colaboradora ficticia', 'position': 'Auxiliar', 'documentNumber': '123'},
               'assetSnapshot': {'type': 'laptop', 'brand': 'Marca', 'model': 'Modelo', 'serial': 'TEST'},
               'documentDetails': {'directorSnapshot': {'fullName': name}, 'blankDiscountSigners': True}}
        pdf, _ = generate_act_pdf(TEMPLATES, act, {'companyName': 'Empresa ficticia', 'nit': '900000000-1'}, 'Sistemas ficticio', '26/11/2026')
        with fitz.open(stream=pdf, filetype='pdf') as document:
            self.assertEqual(len(document), 2)
            page = document[0]
            label = [r for r in page.search_for('Nombre') if r.y0 > 400 and r.x0 < 150][0]
            start = page.search_for('Alejandra Maria Fernanda')[0]
            self.assertGreaterEqual(start.x0, label.x1 - 1)
            self.assertTrue(page.search_for('Martinez Pardo'))

if __name__ == '__main__': unittest.main(verbosity=2)
