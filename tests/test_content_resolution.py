import unittest
from tools.content.resolution import resolution_rows, validate_resolutions

class ResolutionTests(unittest.TestCase):
    def setUp(self):
        self.mapping = {'mappings':[{'namespace':'topic-id','legacyId':'old','source':'old.html','status':'ambiguous','canonicalId':None,'candidates':['a','b'],'occurrences':[{'source':'old.html'}]}]}
        self.identity = {'bindings':{'new-key':{'canonicalId':'a','status':'active'},'b':{'canonicalId':'b','status':'active'}}}
    def decision(self, status='resolved', target='a'):
        return {'schemaVersion':1,'decisions':[{'namespace':'topic-id','legacyId':'old','source':'old.html','status':status,'canonicalId':target,'review':{'reviewer':'synthetic','reason':'explicit rename evidence'}}]}
    def test_review_preserves_original_candidates_and_historical_source(self):
        row = list(resolution_rows(self.mapping,self.identity,self.decision()))[0]
        self.assertEqual(row['canonicalId'],'a')
        self.assertEqual(row['candidates'],['a','b'])
        self.assertEqual(row['occurrences'],self.mapping['mappings'][0]['occurrences'])
        self.assertEqual(self.mapping['mappings'][0]['status'],'ambiguous')
    def test_default_ambiguity_and_lifecycle_states(self):
        self.assertEqual(list(resolution_rows(self.mapping,self.identity))[0]['status'],'ambiguous')
        for status in ['ambiguous','deprecated','orphaned','pending_review']:
            self.assertEqual(list(resolution_rows(self.mapping,self.identity,self.decision(status,None)))[0]['status'],status)
    def test_missing_retired_and_unreviewed_decisions_rejected(self):
        self.assertTrue(validate_resolutions(self.decision(target='unknown'),self.mapping,self.identity))
        self.identity['bindings']['new-key']['status']='retired'
        self.assertTrue(validate_resolutions(self.decision(),self.mapping,self.identity))
        d=self.decision();d['decisions'][0]['review']['reason']=' '
        self.assertTrue(validate_resolutions(d,self.mapping,self.identity))
    def test_exact_schema_shape_required(self):
        for field in ['namespace','legacyId','source','status','canonicalId','review']:
            d=self.decision();del d['decisions'][0][field]
            self.assertTrue(validate_resolutions(d,self.mapping,self.identity),field)
        for location in ['document','decision','review']:
            d=self.decision()
            target=d if location == 'document' else d['decisions'][0] if location == 'decision' else d['decisions'][0]['review']
            target['extra']='unknown'
            self.assertTrue(validate_resolutions(d,self.mapping,self.identity),location)
        with self.assertRaises(ValueError): list(resolution_rows(self.mapping,self.identity,{}))
    def test_duplicate_decisions_rejected(self):
        d=self.decision();d['decisions']*=2
        self.assertTrue(validate_resolutions(d,self.mapping,self.identity))

if __name__ == '__main__': unittest.main()
