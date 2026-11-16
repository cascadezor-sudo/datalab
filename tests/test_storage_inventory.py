"""Contract tests for the storage access inventory; all source inputs are synthetic."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "tools" / "audits" / "storage_inventory.py"
spec = importlib.util.spec_from_file_location("storage_inventory", MODULE)
scanner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(scanner)


class StorageInventoryTest(unittest.TestCase):
    def test_transaction_service_candidates_are_visible_without_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            site = root / "site"
            site.mkdir()
            (site / "service.js").write_text(
                'window.DataLabStorage.mutate(secretCallback);\n'
                'window.DataLabStorage.local.setItem("secret-key", "secret-value");\n'
                '(window.DataLabStorage?.local || localStorage).getItem("secret");\n'
                'records.put(privateRecord);\n', encoding="utf-8")
            previous_root, previous_source = scanner.ROOT, scanner.SOURCE
            try:
                scanner.ROOT, scanner.SOURCE = root, site
                actual = scanner.inventory()
            finally:
                scanner.ROOT, scanner.SOURCE = previous_root, previous_source
            self.assertEqual([entry["operation"] for entry in actual], [
                "service.mutate", "service.local.setItem", "service.local.bootstrap.getItem", "indexeddb.candidate.put"])
            self.assertTrue(all(set(entry) == {"file", "line", "operation"} for entry in actual))

    def test_source_accesses_report_only_location_and_operation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            site = root / "site"
            site.mkdir()
            (site / "fixture.js").write_text(
                'localStorage.getItem("private-value");\n'
                'storage.setItem("another-value", "sensitive-content");\n'
                'db.ref("private/path");\n'
                'holder.ref("private/path");\n', encoding="utf-8")
            previous_root, previous_source = scanner.ROOT, scanner.SOURCE
            try:
                scanner.ROOT, scanner.SOURCE = root, site
                actual = scanner.inventory()
            finally:
                scanner.ROOT, scanner.SOURCE = previous_root, previous_source
            self.assertEqual(actual, [
                {"file": "site/fixture.js", "line": 1, "operation": "localStorage.getItem"},
                {"file": "site/fixture.js", "line": 2, "operation": "storage.alias.dynamic.setItem"},
                {"file": "site/fixture.js", "line": 3, "operation": "firebase.ref"},
                {"file": "site/fixture.js", "line": 4, "operation": "firebase.ref.dynamic"},
            ])


if __name__ == "__main__":
    unittest.main()
