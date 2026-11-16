"""Independent physical-source/URL coverage; does not reuse catalog extraction."""
import collections
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.values = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        value = attrs.get('id') or (attrs.get('name') if tag == 'a' else None)
        if value:
            self.values.append(value)


class ContentRoutesCoverage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = json.loads((ROOT / 'content/prototype/registry.json').read_text(encoding='utf-8'))
        cls.by_source = collections.defaultdict(list)
        for entity in cls.catalog['entities']:
            cls.by_source[entity['source']['path']].append(entity)

    def test_every_physical_html_document_has_exact_local_and_pages_route(self):
        physical = {p.relative_to(ROOT / 'site').as_posix() for p in (ROOT / 'site').rglob('*.html')}
        pages = [e for e in self.catalog['entities'] if e['type'] == 'LegacyPage']
        self.assertEqual(collections.Counter(e['source']['path'] for e in pages), collections.Counter(physical))
        for page in pages:
            path = page['source']['path']
            with self.subTest(path=path):
                self.assertEqual(page['metadata']['localUrl'], '/' + path)
                self.assertEqual(page['metadata']['pagesUrl'], '/datalab/' + path)
                self.assertIn({'namespace': 'html-path', 'value': path}, page['legacyIds'])

    def test_every_real_anchor_occurrence_is_retained_with_exact_spelling(self):
        for path in (ROOT / 'site').rglob('*.html'):
            relative = path.relative_to(ROOT / 'site').as_posix()
            parser = Anchors()
            parser.feed(path.read_text(encoding='utf-8-sig'))
            actual = [a['value'] for e in self.by_source[relative] for a in e['legacyIds'] if a['namespace'] == 'html-anchor']
            with self.subTest(path=relative):
                self.assertEqual(collections.Counter(actual), collections.Counter(parser.values))

    def test_source_fingerprints_are_physical_bytes_and_all_structured_sources_are_included(self):
        sources = self.catalog['sources']
        counts = collections.Counter(source['path'] for source in sources)
        self.assertTrue(all(count == 1 for count in counts.values()))
        expected = {p.relative_to(ROOT / 'site').as_posix() for prefix in ('assets/data', 'assets/js/config')
                    for p in (ROOT / 'site' / prefix).rglob('*.json')}
        self.assertTrue(expected.issubset(counts.keys()), sorted(expected - counts.keys()))
        for source in sources:
            with self.subTest(path=source['path']):
                self.assertEqual(source['sha256'], hashlib.sha256((ROOT / 'site' / source['path']).read_bytes()).hexdigest())


if __name__ == '__main__':
    unittest.main()
