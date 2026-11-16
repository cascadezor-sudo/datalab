import copy
import unittest
from tools.content.catalog import ROOT, read
from tools.content.issues import build_report, CATEGORIES

class IssueClassificationTests(unittest.TestCase):
    def test_all_actual_evidence_is_classified_losslessly(self):
        c = read(ROOT/'content/prototype/registry.json')
        m = read(ROOT/'docs/modernization/legacy-id-mapping.json')
        routes = {'findings': [{'type': 'missing_asset', 'source': 'x.html', 'reference': 'missing.svg', 'mode': 'pages'}]}
        result = build_report(c, m, routes)
        warnings = [i for i in c['issues'] if i.get('severity') == 'warning']
        aliases = [r for r in m['mappings'] if r['status'] == 'ambiguous']
        self.assertEqual([r['evidence'] for r in result['records'] if r['origin'] == 'catalog-warning'], warnings)
        self.assertEqual([r['evidence'] for r in result['records'] if r['origin'] == 'alias'], aliases)
        self.assertEqual(result['counts']['origins']['route'], 1)
        self.assertEqual(len({r['issueId'] for r in result['records']}), len(result['records']))
        for row in result['records']:
            self.assertIn(row['classification'], CATEGORIES)
            for field in ('cause', 'functionalImpact', 'safeFixability', 'fixRisk', 'sources'):
                self.assertTrue(row[field], (field, row['issueId']))

    def test_determinism_no_mutation_and_unknown_finding_visibility(self):
        c = {'entities': [], 'issues': [{'code': 'new-warning', 'severity': 'warning', 'source': 'test.json'}]}
        m = {'mappings': []}; routes = {'findings': []}
        original = copy.deepcopy((c,m,routes))
        first = build_report(c,m,routes)
        self.assertEqual(first, build_report(c,m,routes))
        self.assertEqual((c,m,routes), original)
        self.assertEqual(first['records'][0]['classification'], 'ambiguous_data')

    def test_unrelated_warning_does_not_renumber_existing_issue_and_snapshot_age_is_not_guessed(self):
        existing = {'code': 'source-copy-conflict', 'severity': 'warning', 'sources': ['a.json', 'b.json']}
        c = {'entities': [], 'issues': [existing]}
        first = build_report(c, {'mappings': []}, {'findings': []})['records'][0]
        c['issues'].insert(0, {'code': 'other', 'severity': 'warning', 'source': 'c.json'})
        second = build_report(c, {'mappings': []}, {'findings': []})['records'][1]
        self.assertEqual(first['issueId'], second['issueId'])
        self.assertEqual('ambiguous_data', second['classification'])

if __name__ == '__main__': unittest.main()
