import importlib.util
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('catalog_qa_target', ROOT / 'tools/content/catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)

class CatalogIntegrityQA(unittest.TestCase):
    def fixture(self):
        c = catalog.Collector(ROOT, {'schemaVersion': 1, 'bindings': {}, 'aliases': {}})
        root = c.add('page', 'LegacyPage', 'index.html', '', 'Page', [('html-path', 'index.html')])
        child = c.add('section', 'Section', 'index.html', 'line:1', 'Section', [('html-anchor', 'topic')], parent=root)
        doc = {'schemaVersion': 1, 'mode': 'offline-prototype', 'sources': [{'path': 'index.html', 'format': 'html', 'sha256': '0' * 64}], 'entities': c.entities, 'relationships': c.edges, 'issues': []}
        return doc, c.identity, catalog.make_mapping(c.entities), root, child

    def codes(self, doc, identity, mapping):
        return {issue['code'] for issue in catalog.validate(doc, identity, mapping)}

    def test_valid_minimal_catalog(self):
        doc, identity, mapping, _, _ = self.fixture()
        self.assertEqual(set(), self.codes(doc, identity, mapping))

    def test_duplicate_id_detected(self):
        doc, identity, mapping, root, child = self.fixture()
        child['id'] = root['id']
        self.assertIn('duplicate-canonical-id', self.codes(doc, identity, mapping))

    def test_dangling_edge_detected(self):
        doc, identity, mapping, _, _ = self.fixture()
        doc['relationships'][0]['to'] = 'dl_' + '0' * 32
        self.assertIn('dangling-relationship', self.codes(doc, identity, mapping))

    def test_cycle_detected(self):
        doc, identity, mapping, root, child = self.fixture()
        doc['relationships'].append({'from': child['id'], 'to': root['id'], 'type': 'contains', 'evidence': {'path': 'index.html', 'pointer': ''}, 'status': 'observed'})
        self.assertIn('containment-cycle', self.codes(doc, identity, mapping))

    def test_orphan_detected(self):
        doc, identity, mapping, _, _ = self.fixture()
        doc['relationships'].clear()
        self.assertIn('orphan-entity', self.codes(doc, identity, mapping))

    def test_registry_mismatch_detected(self):
        doc, identity, mapping, _, child = self.fixture()
        identity['bindings'][child['sourceKey']]['canonicalId'] = 'dl_' + '0' * 32
        self.assertIn('registry-mismatch', self.codes(doc, identity, mapping))

    def test_legacy_loss_detected(self):
        doc, identity, mapping, _, _ = self.fixture()
        mapping['mappings'].clear()
        self.assertIn('lost-legacy-id', self.codes(doc, identity, mapping))

    def test_mapping_resolution_status_must_agree_with_cardinality(self):
        doc, identity, mapping, root, child = self.fixture()
        row = mapping['mappings'][0]
        row.update(candidates=[root['id'], child['id']], canonicalId=None, status='resolved')
        self.assertIn('invalid-legacy-mapping', self.codes(doc, identity, mapping))

    def test_empty_candidate_mapping_is_invalid(self):
        doc, identity, mapping, _, _ = self.fixture()
        mapping['mappings'].append({'namespace': 'bogus', 'legacyId': 'absent', 'source': None, 'objectType': 'Section', 'canonicalId': None, 'status': 'ambiguous', 'candidates': [], 'aliases': [], 'occurrences': []})
        # Structural rejection may precede semantic mapping validation.
        self.assertTrue({'invalid-schema', 'invalid-legacy-mapping'} & self.codes(doc, identity, mapping))

    def test_edge_evidence_requires_path_and_pointer(self):
        doc, identity, mapping, _, _ = self.fixture()
        doc['relationships'][0]['evidence'] = {'meaningless': True}
        self.assertTrue(self.codes(doc, identity, mapping), 'Malformed evidence must fail validation')

if __name__ == '__main__':
    unittest.main()

