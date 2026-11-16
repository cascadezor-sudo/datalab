import copy
import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('content_catalog', ROOT / 'tools/content/catalog.py')
catalog = importlib.util.module_from_spec(spec)
spec.loader.exec_module(catalog)


class CatalogPrototypeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = catalog.read(ROOT / 'content/prototype/registry.json')
        cls.identity = catalog.read(ROOT / 'docs/modernization/id-registry.json')
        cls.mapping = catalog.read(ROOT / 'docs/modernization/legacy-id-mapping.json')

    def test_actual_contract_has_no_integrity_errors_but_keeps_source_defects(self):
        issues = catalog.validate(self.registry, self.identity, self.mapping)
        self.assertFalse([i for i in issues if i['severity'] == 'error'])
        self.assertIn('source-copy-conflict', {i['code'] for i in self.registry['issues']})
        self.assertIn('duplicate-source-identifier', {i['code'] for i in self.registry['issues']})

    def test_real_content_materializes_without_browser_or_storage(self):
        samples = [('LegacyPage', 'python/base.html'), ('LegacyPage', 'ai/ml/dl.html'),
                   ('Exercise', 'practise/python/base.html'), ('Exercise', 'practise/math.html'),
                   ('Question', 'assets/data/quizzes/python-base.json'),
                   ('Flashcard', 'assets/data/teormin-cards.json'),
                   ('Definition', 'assets/data/definitions/definitions.json')]
        for kind, source in samples:
            with self.subTest(kind=kind, source=source):
                entity = catalog.query(self.registry, kind=kind, source=source)[0]
                if kind == 'Flashcard':
                    # Catalog ordering is canonical, not pedagogic/card order.
                    entity = next(e for e in catalog.query(self.registry, kind=kind, source=source)
                                  if {'namespace': 'flashcard-id', 'value': 'supervised_learning__1'} in e['legacyIds'])
                result = catalog.get_content(entity)
                self.assertTrue(result)
                self.assertEqual([entity], catalog.query(self.registry, canonical_id=entity['id']))
                if kind == 'Flashcard': self.assertEqual('supervised_learning__1', result['id'])
                if kind == 'Question': self.assertIn('answer', result)
        self.assertEqual(5638, len(catalog.query(self.registry, kind='Flashcard', source='assets/data/teormin-cards.json')))
        self.assertEqual(4867, len(catalog.query(self.registry, kind='Flashcard', source='assets/js/config/teormin-cards.json')))

    def test_materializer_rejects_outside_source(self):
        entity = {'source': {'path': '../outside.json', 'pointer': ''}, 'metadata': {}}
        with self.assertRaises(ValueError): catalog.get_content(entity)

    def test_names_titles_and_array_order_do_not_change_seed_ids(self):
        with tempfile.TemporaryDirectory(prefix='datalab-content-fixture-') as temp:
            root = pathlib.Path(temp); (root / 'site/assets/data/quizzes').mkdir(parents=True)
            page = root / 'site/lesson.html'; page.write_text('<title>Original</title><div id="one"></div><div id="two"></div>', encoding='utf-8')
            quiz = root / 'site/assets/data/quizzes/sample.json'
            quiz.write_text(json.dumps({'id':'test','items':[{'id':'a','q':'A'},{'id':'b','q':'B'}]}), encoding='utf-8')
            first, identities, _ = catalog.build(root)
            before = {e['sourceKey']: e['id'] for e in first['entities']}
            page.write_text('<title>Renamed title</title><div id="two"></div><div id="one"></div>', encoding='utf-8')
            quiz.write_text(json.dumps({'id':'test','items':[{'id':'b','q':'Changed B'},{'id':'a','q':'A'}]}), encoding='utf-8')
            after, _, _ = catalog.build(root, identities)
            self.assertEqual(before, {e['sourceKey']: e['id'] for e in after['entities']})

    def test_explicit_source_rename_preserves_uuid_and_old_url_alias(self):
        with tempfile.TemporaryDirectory(prefix='datalab-content-fixture-') as temp:
            root = pathlib.Path(temp); (root / 'site').mkdir()
            page = root / 'site/old.html'; page.write_text('<title>One</title>', encoding='utf-8')
            first, identity, _ = catalog.build(root)
            old_id = first['entities'][0]['id']
            page.rename(root / 'site/new.html')
            catalog.rebind(identity, 'old.html::page', 'new.html::page', 'new.html')
            second, identity, mapping = catalog.build(root, identity)
            self.assertEqual(old_id, second['entities'][0]['id'])
            old = [m for m in mapping['mappings'] if m['namespace']=='html-path' and m['legacyId']=='old.html']
            self.assertTrue(old); self.assertTrue(all(m['canonicalId']==old_id for m in old))
            self.assertFalse([i for i in catalog.validate(second, identity, mapping) if i['severity']=='error'])
            with self.assertRaises(ValueError): catalog.rebind(identity, 'new.html::page', 'new.html::page', 'new.html')

    def test_wrong_semantic_endpoints_fail(self):
        doc = copy.deepcopy(self.registry)
        quiz = next(e for e in doc['entities'] if e['type']=='Quiz')
        achievement = next(e for e in doc['entities'] if e['type']=='Achievement')
        doc['relationships'].append({'from':quiz['id'],'to':achievement['id'],'type':'reviews',
                                     'evidence':quiz['source'],'status':'observed'})
        self.assertIn('invalid-relationship-endpoints', {i['code'] for i in catalog.validate(doc,self.identity,self.mapping)})

    def test_malformed_documents_fail_closed(self):
        for doc in (None, {}, {'entities':None}):
            with self.subTest(doc=doc): self.assertTrue(catalog.validate(doc, {}, {}))

    def test_active_binding_cannot_exist_without_entity_or_reuse_uuid(self):
        identity = copy.deepcopy(self.identity)
        original = next(iter(identity['bindings'].values()))
        identity['bindings']['invented::binding'] = {**original, 'status': 'active'}
        codes = {i['code'] for i in catalog.validate(self.registry, identity, self.mapping)}
        self.assertIn('registry-mismatch', codes)
        self.assertIn('duplicate-binding-id', codes)


if __name__ == '__main__': unittest.main()
