import hashlib
import json
import pathlib
import tempfile
import unittest
from tools.content.reader import ContentReader, SourceUnavailableError


class ContentReaderTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        (self.root / 'site').mkdir()
        self.path = self.root / 'site/cards.json'
        self.path.write_text(json.dumps([{'id': 'a', 'value': 1}, {'id': 'a', 'value': 2}]), encoding='utf-8')
        self.registry = {
            'sources': [{'path': 'cards.json', 'sha256': hashlib.sha256(self.path.read_bytes()).hexdigest()}],
            'entities': [{'id': 'one', 'type': 'Flashcard', 'source': {'path': 'cards.json', 'pointer': '/id:a:1'}}],
            'relationships': [{'from': 'one', 'to': 'one', 'type': 'example', 'evidence': {'pointer': 'x'}}],
        }

    def test_snapshot_and_return_values_are_isolated(self):
        reader = ContentReader(self.registry, self.root)
        self.registry['entities'][0]['source']['pointer'] = '/missing'
        reader.query(canonical_id='one')[0]['source']['pointer'] = '/missing'
        payload = reader.get_content('one')
        self.assertEqual(2, payload['value'])
        payload['value'] = 100
        self.assertEqual(2, reader.get_content('one')['value'])
        reader.related('one')[0]['evidence']['pointer'] = 'bad'
        self.assertEqual('x', reader.related('one')[0]['evidence']['pointer'])

    def test_stale_and_missing_sources_fail_even_after_cache_warmup(self):
        reader = ContentReader(self.registry, self.root)
        reader.get_content('one')
        self.path.write_text(self.path.read_text(encoding='utf-8').replace('2', '3'), encoding='utf-8')
        with self.assertRaisesRegex(SourceUnavailableError, 'changed'):
            reader.get_content('one')
        self.path.unlink()
        with self.assertRaisesRegex(SourceUnavailableError, 'missing'):
            reader.get_content('one')

    def test_queries_unknown_ids_and_relationship_direction(self):
        reader = ContentReader(self.registry, self.root)
        self.assertEqual([], reader.query(canonical_id='unknown'))
        self.assertEqual([], reader.query(kind='Course'))
        self.assertEqual([], reader.query(canonical_id='one', source='other.json'))
        self.assertEqual(1, len(reader.related('one', direction='incoming')))
        self.assertEqual([], reader.related('one', relation='contains'))
        with self.assertRaises(KeyError): reader.get_content('unknown')
        with self.assertRaises(ValueError): reader.related('one', direction='both')

    def test_traversal_rejected_before_read(self):
        self.registry['entities'][0]['source']['path'] = '../outside.json'
        reader = ContentReader(self.registry, self.root)
        with self.assertRaisesRegex(SourceUnavailableError, 'outside'):
            reader.get_content('one')


if __name__ == '__main__': unittest.main()
