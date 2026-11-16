"""Generator publication safety; only disposable artifacts are written."""
import contextlib
import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from tools.content import catalog


class ContentPublication(unittest.TestCase):
    def test_missing_identity_seed_cannot_be_recreated_by_normal_write(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with patch.object(catalog, 'DOCS', root), patch('sys.argv', ['catalog.py', '--write']), \
                    contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(1, catalog.main())
            self.assertEqual([], list(root.iterdir()))

    def test_en_page_quizzes_follow_declared_files_with_runtime_fallback(self):
        registry = catalog.read(catalog.OUT / 'registry.json')
        for source, filename in [('en/python/base.html', 'python-base.json'), ('en/ai/ml/classic.html', 'ml-classic.json')]:
            page = catalog.query(registry, kind='LegacyPage', source=source)[0]
            target = catalog.query(registry, kind='Quiz', source='assets/data/quizzes/' + filename)[0]
            self.assertTrue(any(edge['from'] == page['id'] and edge['to'] == target['id'] and edge['type'] == 'offers-quiz'
                                for edge in registry['relationships']))
            self.assertTrue(any(item['selectedDefinition'] == 'assets/data/quizzes/' + filename
                                for item in page['metadata']['quizResolution']))
        self.assertNotIn('quiz-reference-unresolved', {issue['code'] for issue in registry['issues']})

    def test_writes_reproducible_utf8_lf_and_leaves_no_staging_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            files = {root / 'identity.json': {'z': 'Русский', 'a': [1]}, root / 'registry.json': {'value': 2}}
            catalog.write_artifacts(files)
            first = {path: path.read_bytes() for path in files}
            catalog.write_artifacts(files)
            self.assertEqual(first, {path: path.read_bytes() for path in files})
            self.assertTrue(all(b'\r' not in value for value in first.values()))
            self.assertEqual(set(files), set(root.iterdir()))

    def test_failed_staging_does_not_replace_any_existing_file(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            paths = [root / 'identity.json', root / 'registry.json']
            for path in paths:
                path.write_bytes(b'original')
            real = catalog.tempfile.NamedTemporaryFile
            calls = 0

            def fault(*args, **kwargs):
                nonlocal calls
                calls += 1
                if calls == 2:
                    raise OSError('synthetic no space')
                return real(*args, **kwargs)

            with patch.object(catalog.tempfile, 'NamedTemporaryFile', fault):
                with self.assertRaises(OSError):
                    catalog.write_artifacts({path: {} for path in paths})
            self.assertEqual([b'original', b'original'], [p.read_bytes() for p in paths])
            self.assertEqual(set(paths), set(root.iterdir()))

    def test_invalid_catalog_cannot_be_published(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docs, output = root / 'docs/modernization', root / 'content/prototype'
            docs.mkdir(parents=True)
            output.mkdir(parents=True)
            identity = {'schemaVersion': 1, 'bindings': {}, 'aliases': {}}
            (docs / 'id-registry.json').write_bytes(catalog.dump(identity).encode())
            (output / 'catalog.schema.json').write_bytes((catalog.OUT / 'catalog.schema.json').read_bytes())
            (output / 'id-resolutions.json').write_text('{"schemaVersion":1,"decisions":[]}', encoding='utf-8')
            target = output / 'registry.json'
            target.write_bytes(b'original reviewed artifact')
            invalid = {'issues': [{'code': 'synthetic-integrity-error', 'severity': 'error'}]}
            with patch.object(catalog, 'ROOT', root), patch.object(catalog, 'DOCS', docs), patch.object(catalog, 'OUT', output), \
                    patch.object(catalog, 'build', return_value=(invalid, identity, {})), \
                    patch('sys.argv', ['catalog.py', '--write']), contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(1, catalog.main())
            self.assertEqual(b'original reviewed artifact', target.read_bytes())
            self.assertFalse((docs / 'legacy-id-mapping.json').exists())


if __name__ == '__main__':
    unittest.main()
