"""Independent storage-ID coverage, parsed from HTML rather than catalog code."""
import json
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]


class StorageIdentifiers(HTMLParser):
    def __init__(self):
        super().__init__()
        self.names = set()
        self.math = set()
        self.exercises = set()

    def handle_starttag(self, tag, attributes):
        attr = dict(attributes)
        if 'name' in attr.get('class', '').split() and attr.get('id'):
            self.names.add(attr['id'])
        if tag == 'li' and attr.get('data-md-id') and 'data-answers' in attr:
            form = json.loads(attr['data-answers'])
            self.math.add((attr['data-md-id'], form['page'] + '#' + attr['data-md-id']))
        if tag == 'li' and 'question' in attr.get('class', '').split() and attr.get('data-tests'):
            key = attr.get('data-md-id') or attr.get('id')
            if key:
                self.exercises.add(key)


class ContentProgressCoverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        document = json.loads((ROOT / 'docs/modernization/legacy-id-mapping.json').read_text(encoding='utf-8'))
        cls.mapping = {(r['namespace'], r['legacyId'], r['source']): r for r in document['mappings']}
        cls.pages = {}
        for path in (ROOT / 'site').rglob('*.html'):
            parser = StorageIdentifiers()
            parser.feed(path.read_text(encoding='utf-8'))
            cls.pages[path.relative_to(ROOT / 'site').as_posix()] = parser

    def covered(self, namespace, legacy_id, source):
        scoped = self.mapping.get((namespace, legacy_id, source))
        global_row = self.mapping.get((namespace, legacy_id, None))
        self.assertIsNotNone(scoped, (namespace, legacy_id, source))
        self.assertIsNotNone(global_row, (namespace, legacy_id, None))
        self.assertTrue(set(scoped['candidates']).issubset(global_row['candidates']))

    def test_actual_progress_difficulty_review_keys_are_not_lost(self):
        for source, page in self.pages.items():
            for key in page.names:
                with self.subTest(source=source, key=key):
                    self.covered('topic-id', key, source)
                    normalized = re.sub(r'[.#$\[\]/]', '_', key)
                    self.covered('difficulty-id', normalized, source)
                    self.covered('review-later-id', normalized, source)

    def test_actual_math_and_python_draft_identities_are_not_conflated(self):
        for source, page in self.pages.items():
            for key, draft in page.math:
                with self.subTest(source=source, key=key):
                    self.covered('math-exercise-id', key, source)
                    self.covered('math-draft-id', draft, source)
            for key in page.exercises:
                with self.subTest(source=source, key=key):
                    self.covered('exercise-id', key, source)


if __name__ == '__main__':
    unittest.main()
