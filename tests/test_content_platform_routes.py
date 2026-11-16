import copy
from html.parser import HTMLParser
import json
from pathlib import Path
import unittest
from urllib.parse import quote
from tools.content.routes import RouteAdapter

ROOT = Path(__file__).resolve().parents[1]


class Anchors(HTMLParser):
    def __init__(self):
        super().__init__()
        self.values = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        value = attrs.get('id') or (attrs.get('name') if tag == 'a' else None)
        if value:
            self.values.append(value)


class PlatformRoutesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.registry = json.loads((ROOT / 'content/prototype/registry.json').read_text(encoding='utf-8'))
        cls.adapter = RouteAdapter(cls.registry)

    def test_every_physical_document_and_anchor_has_exact_registry_future_route(self):
        files = sorted((ROOT / 'site').rglob('*.html'))
        anchor_count = 0
        expected = []
        for file in files:
            path = '/' + file.relative_to(ROOT / 'site').as_posix()
            parser = Anchors()
            parser.feed(file.read_text(encoding='utf-8-sig'))
            for fragment in ['', *parser.values]:
                url = path + ('#' + quote(fragment, safe='') if fragment else '')
                expected.append((path, fragment))
                for base in ('/', '/datalab/'):
                    public = base.rstrip('/') + url
                    result = self.adapter.resolve(public, deployment_base=base)
                    self.assertEqual('resolved', result['status'], public)
                    self.assertEqual(public, result['futureUrl'])
                    self.assertEqual(fragment, result['fragment'])
            anchor_count += len(parser.values)
        self.assertEqual(190, len(files))
        self.assertEqual(2693, anchor_count)
        actual = [(r['path'], r['fragment']) for r in self.adapter.records() for _ in r['candidates']]
        self.assertCountEqual(expected, actual)

    def test_relative_nested_locale_query_and_fragment(self):
        result = self.adapter.resolve('../../python/base.html?pages=1#special_characters',
                                      source='/ai/ml/dl.html', future_base='/datalab/')
        self.assertEqual('resolved', result['status'])
        self.assertEqual('/datalab/python/base.html?pages=1#special_characters', result['futureUrl'])
        self.assertEqual('resolved', self.adapter.resolve('#special_characters', source='/python/base.html')['status'])
        en = next(r for r in self.adapter.records() if r['path'].startswith('/en/') and not r['fragment'])
        self.assertEqual('en', self.adapter.resolve(en['path'])['locale'])

    def test_structured_failures_and_no_guessing(self):
        for url in ('/../main.html', '/%2e%2e/main.html', '/python%2fbase.html', '/python%252fbase.html',
                    '/python%5cbase.html', '/python/base.html%23x', '/%ZZ', '/%FF', '/python/', '/',
                    'javascript:alert(1)', 'mailto:test@example.org', r'python\base.html',
                    '/python//base.html', ' /python/base.html', '/python/base.html#%00'):
            with self.subTest(url=url):
                self.assertEqual('unsupported', self.adapter.resolve(url)['status'])
        self.assertEqual('external', self.adapter.resolve('https://example.org/python/base.html')['status'])
        self.assertEqual('external', self.adapter.resolve('//example.org/python/base.html')['status'])
        self.assertEqual('missing', self.adapter.resolve('/does-not-exist.html')['status'])
        self.assertEqual('missing', self.adapter.resolve('/python/base.html#not-an-anchor')['status'])
        self.assertEqual('missing', self.adapter.resolve('/datalab/python/base.html')['status'])
        self.assertEqual('unsupported', self.adapter.resolve('/python/base.html', deployment_base='/datalab/')['status'])
        self.assertEqual('missing', self.adapter.resolve('/datalab/datalab/python/base.html', deployment_base='/datalab/')['status'])
        self.assertEqual('unsupported', self.adapter.resolve('base.html')['status'])
        self.assertEqual('unsupported', self.adapter.resolve('base.html', source='/missing.html')['status'])

    def test_duplicate_anchor_is_ambiguous_without_first_candidate_selection(self):
        registry = copy.deepcopy(self.registry)
        anchor = next(e for e in registry['entities'] if e['type'] == 'Section')
        duplicate = copy.deepcopy(anchor)
        duplicate['id'] = 'test-duplicate-id'
        registry['entities'].append(duplicate)
        value = next(a['value'] for a in anchor['legacyIds'] if a['namespace'] == 'html-anchor')
        result = RouteAdapter(registry).resolve('/' + anchor['source']['path'] + '#' + quote(value, safe=''))
        self.assertEqual('ambiguous', result['status'])
        self.assertEqual([anchor['id'], duplicate['id']], result['candidates'])
        self.assertNotIn('canonicalId', result)

    def test_percent_decoding_once_and_exact_case(self):
        result = self.adapter.resolve('/%70ython/base.html#special%5Fcharacters')
        self.assertEqual('resolved', result['status'])
        self.assertEqual('/python/base.html#special%5Fcharacters', result['futureUrl'])
        self.assertEqual('missing', self.adapter.resolve('/Python/base.html')['status'])
        self.assertEqual('/python/base.html?#', self.adapter.resolve('/python/base.html?#')['futureUrl'])


if __name__ == '__main__':
    unittest.main()
