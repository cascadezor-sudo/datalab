"""Independent adverse fixtures; never rewrite the source tree or user storage."""
import copy
import tempfile
import unittest
from pathlib import Path
from tools.content import catalog
from tools.content.resolution import validate_resolutions

ROOT = Path(__file__).resolve().parents[1]


class StabilityQA(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.seed = catalog.read(ROOT / 'docs/modernization/id-registry.json')

    def fixture(self, root):
        site = root / 'site'
        site.mkdir()
        (site / 'old.html').write_text('<div data-md-id="topic.md"><h2 class="name" id="topic.name">Topic</h2></div>', encoding='utf-8')
        return catalog.build(root)

    def test_actual_two_rebuilds_have_identical_serialized_bytes_and_identity(self):
        first = catalog.build(ROOT, self.seed)
        second = catalog.build(ROOT, first[1])
        for left, right in zip(first, second):
            self.assertEqual(catalog.dump(left).encode('utf-8'), catalog.dump(right).encode('utf-8'))
        for key, binding in self.seed['bindings'].items():
            self.assertIn(key, second[1]['bindings'])
            self.assertEqual(binding['canonicalId'], second[1]['bindings'][key]['canonicalId'])

    def test_exact_edge_deduplicates_but_distinct_citations_survive(self):
        c = catalog.Collector(ROOT, {'schemaVersion': 1, 'bindings': {}, 'aliases': {}})
        page = c.add('page', 'LegacyPage', 'old.html', '')
        child = c.add('child', 'Section', 'old.html', 'line:1', parent=page)
        c.edge(page, child, 'contains', 'old.html', 'line:1')
        c.edge(page, child, 'contains', 'old.html', 'line:2')
        self.assertEqual(2, len(c.edges))

    def test_corrupted_duplicate_edge_is_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            doc, identity, mapping = self.fixture(Path(temp))
            doc['relationships'].append(copy.deepcopy(doc['relationships'][0]))
            self.assertIn('duplicate-relationship', {i['code'] for i in catalog.validate(doc, identity, mapping)})

    def test_absent_parent_cycle_and_malformed_evidence_are_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            original, identity, mapping = self.fixture(Path(temp))
            missing = copy.deepcopy(original)
            missing['relationships'][0]['from'] = 'dl_' + '0' * 32
            self.assertIn('dangling-relationship', {i['code'] for i in catalog.validate(missing, identity, mapping)})
            cycle = copy.deepcopy(original)
            edge = copy.deepcopy(cycle['relationships'][0])
            edge['from'], edge['to'] = edge['to'], edge['from']
            cycle['relationships'].append(edge)
            self.assertIn('containment-cycle', {i['code'] for i in catalog.validate(cycle, identity, mapping)})
            for evidence in ({}, {'path': 'old.html'}, {'path': 'absent.html', 'pointer': ''}, {'path': 'old.html', 'pointer': []}):
                doc = copy.deepcopy(original)
                doc['relationships'][0]['evidence'] = evidence
                with self.subTest(evidence=evidence):
                    self.assertTrue([i for i in catalog.validate(doc, identity, mapping) if i['severity'] == 'error'])

    def test_removed_sources_preserve_orphaned_alias_evidence(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, identity, before = self.fixture(root)
            (root / 'site/old.html').unlink()
            _, retired, after = catalog.build(root, identity)
            keys = lambda document: {(r['namespace'], r['legacyId'], r['source']): r for r in document['mappings']}
            old_rows, new_rows = keys(before), keys(after)
            self.assertTrue(old_rows)
            self.assertTrue(old_rows.keys() <= new_rows.keys())
            for key in old_rows:
                self.assertEqual('orphaned', new_rows[key]['status'])
                self.assertIsNone(new_rows[key]['canonicalId'])
                self.assertEqual(old_rows[key]['candidates'], new_rows[key]['candidates'])
            self.assertTrue(all(b['status'] == 'retired' for b in retired['bindings'].values()))

    def test_containment_cannot_claim_parent_from_another_source(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            self.fixture(root)
            (root / 'site/other.html').write_text('<title>Other</title>', encoding='utf-8')
            doc, identity, mapping = catalog.build(root)
            other = next(e for e in doc['entities'] if e['sourceKey'] == 'other.html::page')
            edge = doc['relationships'][0]
            edge['from'] = other['id']
            self.assertIn('invalid-containment-source', {i['code'] for i in catalog.validate(doc, identity, mapping)})

    def test_rebind_preserves_aliases_appended_by_name_parser(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, identity, before = self.fixture(root)
            old_keys = [k for k in identity['bindings'] if k.startswith('old.html::')]
            for key in old_keys:
                catalog.rebind(identity, key, key.replace('old.html::', 'new.html::'), 'new.html')
            (root / 'site/old.html').rename(root / 'site/new.html')
            doc, identity, after = catalog.build(root, identity)
            old = [r for r in before['mappings'] if r['namespace'] in ('topic-id', 'difficulty-id', 'review-later-id') and r['source'] == 'old.html']
            self.assertEqual(3, len(old))
            for row in old:
                equivalent = [r for r in after['mappings'] if (r['namespace'], r['legacyId'], r['source']) == (row['namespace'], row['legacyId'], row['source'])]
                self.assertEqual(1, len(equivalent))
                self.assertEqual(row['canonicalId'], equivalent[0]['canonicalId'])
            self.assertFalse([i for i in catalog.validate(doc, identity, after) if i['severity'] == 'error'])

    def test_review_decision_must_match_schema_required_fields(self):
        identity = {'bindings': {'k': {'canonicalId': 'a', 'status': 'active'}}}
        mapping = {'mappings': [{'namespace': 'topic-id', 'legacyId': 'old', 'source': None, 'candidates': ['a']}]}
        row = {'namespace': 'topic-id', 'legacyId': 'old', 'source': None, 'status': 'pending_review', 'canonicalId': None, 'review': {'reviewer': 'qa', 'reason': 'synthetic'}}
        for field in ('source', 'canonicalId'):
            malformed = dict(row)
            malformed.pop(field)
            self.assertTrue(validate_resolutions({'schemaVersion': 1, 'decisions': [malformed]}, mapping, identity), field)
        malformed = dict(row, unexpected='value')
        self.assertTrue(validate_resolutions({'schemaVersion': 1, 'decisions': [malformed]}, mapping, identity))

    def test_surviving_block_retains_previous_name_progress_aliases(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, identity, before = self.fixture(root)
            (root / 'site/old.html').write_text('<div data-md-id="topic.md"><h2 class="name" id="new.name">Topic</h2></div>', encoding='utf-8')
            doc, identity, after = catalog.build(root, identity, allow_new_ids=True)
            for namespace in ('topic-id', 'difficulty-id', 'review-later-id'):
                old = next(r for r in before['mappings'] if r['namespace'] == namespace and r['source'] == 'old.html')
                retained = next(r for r in after['mappings'] if (r['namespace'], r['legacyId'], r['source']) == (namespace, old['legacyId'], 'old.html'))
                self.assertEqual('resolved', retained['status'])
                self.assertEqual(old['canonicalId'], retained['canonicalId'])
            old_anchor = next(r for r in after['mappings'] if r['namespace'] == 'html-anchor' and r['legacyId'] == 'topic.name' and r['source'] == 'old.html')
            self.assertEqual('orphaned', old_anchor['status'])
            self.assertIsNone(old_anchor['canonicalId'])
            self.assertFalse([i for i in catalog.validate(doc, identity, after) if i['severity'] == 'error'])

    def test_sealed_rebuild_does_not_allocate_unknown_identities(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            _, identity, _ = self.fixture(root)
            original = copy.deepcopy(identity)
            (root / 'site/added.html').write_text('<title>Unreviewed</title>', encoding='utf-8')
            for _ in range(2):
                with self.assertRaises(catalog.UnallocatedIdentityError):
                    catalog.build(root, identity)
                self.assertEqual(original, identity)
            first = catalog.build(root, identity, allow_new_ids=True)
            second = catalog.build(root, first[1])
            self.assertEqual(catalog.dump(first), catalog.dump(second))


if __name__ == '__main__':
    unittest.main()
