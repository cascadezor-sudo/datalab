import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('routes_inventory', Path(__file__).resolve().parents[1] / 'tools/audits/routes_inventory.py')
routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(routes)

class RoutesInventoryTest(unittest.TestCase):
    def test_mode_resolution_and_query_redaction(self):
        self.assertEqual(routes.resolve('nested/page.html', routes.clean('../index.html?token=secret#hello'), 'pages'), ('target', 'index.html', 'hello'))
        self.assertEqual(routes.resolve('nested/page.html', '/', 'local'), ('target', 'main.html', ''))
        self.assertEqual(routes.resolve('nested/page.html', '/', 'pages'), ('target', 'index.html', ''))
        self.assertEqual(routes.resolve('nested/page.html', '../', 'local')[0], 'target')  # root maps to main
        self.assertEqual(routes.resolve('nested/page.html', '/nested/', 'local')[0], 'directory_not_served')
        self.assertEqual(routes.resolve('nested/page.html', '../../outside', 'pages')[0], 'outside_base')
        self.assertEqual(routes.clean('mailto:person@example.com?subject=secret'), '[external:mailto]')

    def test_static_resources_and_encoded_anchors(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            (site / 'css').mkdir()
            (site / 'css/main.css').write_text('@import "nested.css"; x { background:url(../gone.png) }', encoding='utf-8')
            (site / 'css/nested.css').write_text('x { background:url(/root-missing.png) }', encoding='utf-8')
            (site / 'index.html').write_text('<p id="hello world"></p><a href="#hello%20world">ok</a><a href="https://example.com/index.html">outside</a><link href="css/main.css"><img srcset="data:image/png;base64,AAAA 1x, missing.png 2x">', encoding='utf-8')
            result = routes.audit(site)
            refs = result['pages'][0]['references']
            self.assertTrue(any(x.get('origin') == 'css/nested.css' for x in refs))
            self.assertTrue(any(x['url'] == 'missing.png' for x in refs))
            self.assertFalse(any(x['type'] == 'missing_anchor' for x in result['findings']))
            self.assertTrue(any(x['type'] == 'outside_base' and x['mode'] == 'pages' for x in result['findings']))
            self.assertNotIn('AAAA', str(result))

    def test_progress_and_practice_evidence(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            (site / 'index.html').write_text('<div class="x question y" data-tests="[]" data-answers></div><div class="questionnaire" data-tests="[]"></div><script src="progress-tracker.js"></script><script src="quiz.js"></script>', encoding='utf-8')
            page = routes.audit(site)['pages'][0]
            self.assertEqual(page['javascript_evidence']['script_srcs'], ['progress-tracker.js', 'quiz.js'])
            self.assertEqual(page['practice_evidence']['static_element_counts'], {'question_class_elements': 1, 'data_tests_attributes': 2, 'data_answers_attributes': 1})
            self.assertEqual(page['progress_evidence']['controller_script_refs_by_name'], ['progress-tracker.js'])
            self.assertEqual(page['practice_evidence']['controller_script_refs_by_name'], ['quiz.js'])

    def test_built_artifact_checks_actual_base_and_follows_css(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            (site / 'assets').mkdir()
            (site / 'assets/site.css').write_text('x { background: url(/datalab/assets/ok.png) }', encoding='utf-8')
            (site / 'assets/ok.png').write_bytes(b'')
            (site / 'index.html').write_text('<link href="/datalab/assets/site.css"><img src="/datalab/assets/ok.png"><img src="/assets/ok.png">', encoding='utf-8')
            result = routes.audit(site, pages_artifact=True)
            findings = result['findings']
            self.assertEqual([(f['type'], f['reference']) for f in findings], [('outside_base', '/assets/ok.png')])
            self.assertTrue(any(r.get('origin') == 'assets/site.css' for r in result['pages'][0]['references']))

    def test_findings_include_links_anchors_assets_and_modes(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            (site / 'folder').mkdir()
            (site / 'folder/index.html').write_text('<title>Folder</title><p id="ok">', encoding='utf-8')
            (site / 'index.html').write_text('<a href="folder/">ok</a><a href="folder/index.html#missing">x</a><img src="absent.png"><a href="https://example.org/?secret=value">x</a>', encoding='utf-8')
            result = routes.audit(site)
            types = {(f['type'], f['mode']) for f in result['findings']}
            self.assertIn(('directory_not_served', 'local'), types)
            self.assertNotIn(('broken_link', 'pages'), types)
            self.assertIn(('missing_anchor', 'local'), types)
            self.assertIn(('missing_asset', 'pages'), types)
            self.assertNotIn('secret', str(result))

if __name__ == '__main__': unittest.main()
