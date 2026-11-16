"""Read-only classification over the existing occurrence catalog and route audit."""
from __future__ import annotations
import argparse
import collections
import hashlib
import json
from tools.content.catalog import ROOT, read, dump
from tools.audits.routes_inventory import audit

CATEGORIES = ('confirmed_error', 'ambiguous_data', 'obsolete_data', 'duplicate_data',
              'acceptable_legacy', 'validator_false_positive')
OUTPUT = ROOT / 'content/prototype/content-issues.json'

def decision(code, evidence):
    if code == 'quiz-reference-unresolved' and evidence.get('source') in ('en/python/base.html', 'en/ai/ml/classic.html'):
        return ('validator_false_positive', 'Language filename heuristic ignores registry and runtime EN-to-base fallback.',
                'Catalog omits offers-quiz; runtime loads the declared base quiz when EN file is unavailable.',
                'Correct extraction using registry declaration and fetchQuizFile semantics; preserve legacy quiz ID.', 'low')
    if code == 'source-copy-conflict':
        return ('ambiguous_data', 'Independent snapshots differ; runtime authority is contextual and revision age is unproven.',
                'Config cards remain achievement fallback; primary data cards and categories-config.json are runtime inputs.',
                'Preserve both snapshots and source IDs; no safe automatic content synchronization.', 'high')
    if code == 'duplicate-question-content':
        return ('duplicate_data', 'Normalized prompt is repeated; code/options/answers may differ.',
                'No proven runtime failure; prompt equality does not establish question identity.',
                'Review complete payloads manually; never merge by prompt.', 'high')
    if code == 'duplicate-source-identifier':
        if evidence.get('namespace') in ('question-index-id', 'roadmap-track-id'):
            return ('acceptable_legacy', 'ID is reused across index categories or roadmap milestones within a source.',
                    'Global or source-only lookup cannot select an occurrence; original index/parent context remains valid.',
                    'Keep occurrences; use explicit parent context when available, otherwise ambiguous.', 'high')
        return ('ambiguous_data', 'Multiple occurrences use the same namespaced source ID.',
                'Unqualified progress lookup cannot safely choose one occurrence.',
                'Preserve all candidates and raw records pending author review.', 'high')
    if code == 'alias-ambiguity':
        return ('ambiguous_data', 'Namespaced alias maps to multiple occurrences across sources or within one source.',
                'Automatic remap would guess identity or duplicate historical progress.',
                'Require evidence-bearing scope or reviewed decision; retain all candidates.', 'high')
    if code in ('missing_asset', 'broken_link', 'directory_not_served', 'missing_anchor', 'duplicate_anchor', 'duplicate_route', 'outside_base'):
        return ('confirmed_error', 'Static route audit cannot resolve the referenced resource in this deployment mode.',
                'Navigation or asset delivery fails under the recorded local/Pages assumptions; dynamic interception is outside this audit.',
                'Review resource or server behavior separately; no URL/HTML changes authorized by this classifier.', 'medium')
    return ('ambiguous_data', 'Unrecognized finding requires explicit review; evidence retained.',
            'Impact unverified; do not suppress the finding.', 'Manual investigation required.', 'unknown')

def build_report(catalog, mapping, routes=None, root=ROOT):
    """Classify every warning, ambiguous alias and route occurrence, without resolving it."""
    routes = audit(root / 'site') if routes is None else routes
    entities = {e['id']: e for e in catalog['entities']}
    records = []
    occurrences = collections.Counter()
    def add(origin, code, evidence, number):
        category, cause, impact, fixability, risk = decision(code, evidence)
        ids = evidence.get('candidates', [])
        if evidence.get('id'): ids = [evidence['id']] + ids
        affected = [{'canonicalId': i, 'sourceKey': entities[i]['sourceKey'], 'source': entities[i]['source']}
                    for i in ids if i in entities]
        sources = evidence.get('sources', []) or ([evidence['source']] if evidence.get('source') else [])
        if not sources: sources = sorted({a['source']['path'] for a in affected})
        if not affected:
            affected = [{'canonicalId': e['id'], 'sourceKey': e['sourceKey'], 'source': e['source']}
                        for e in catalog['entities'] if e['source']['path'] in sources and e['type'] in
                        ('LegacyPage', 'SourceDataset', 'LearningPath', 'NavigationRegistry', 'KanbanConfiguration', 'QuestionBankConfiguration')]
        evidence_key = json.dumps([origin, evidence], ensure_ascii=False, sort_keys=True)
        occurrence = occurrences[evidence_key]
        occurrences[evidence_key] += 1
        token = json.dumps([evidence_key, occurrence], ensure_ascii=False)
        records.append({'issueId': hashlib.sha256(token.encode()).hexdigest(), 'origin': origin,
                        'code': code, 'classification': category, 'sources': sources,
                        'affectedObjects': affected, 'cause': cause, 'functionalImpact': impact,
                        'safeFixability': fixability, 'fixRisk': risk, 'evidence': evidence})
    for n, issue in enumerate(catalog['issues']):
        if issue.get('severity') == 'warning': add('catalog-warning', issue['code'], issue, n)
    for n, row in enumerate(mapping['mappings']):
        if row['status'] == 'ambiguous': add('alias', 'alias-ambiguity', row, n)
    for n, finding in enumerate(routes['findings']): add('route', finding['type'], finding, n)
    return {'schemaVersion': 1, 'scope': 'Classification only; reuses catalog IDs and mapping. No merge, registry, storage or route mutation.',
            'categories': list(CATEGORIES), 'counts': {
                'origins': dict(sorted(collections.Counter(r['origin'] for r in records).items())),
                'classifications': {k: sum(r['classification'] == k for r in records) for k in CATEGORIES},
                'codes': dict(sorted(collections.Counter(r['code'] for r in records).items()))},
            'routeAssumptions': routes.get('assumptions', {}), 'records': records}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--write', action='store_true')
    group.add_argument('--check', action='store_true')
    args = parser.parse_args()
    result = build_report(read(ROOT/'content/prototype/registry.json'), read(ROOT/'docs/modernization/legacy-id-mapping.json'))
    serialized = dump(result)
    if args.write: OUTPUT.write_bytes(serialized.encode('utf-8'))
    if args.check and (not OUTPUT.exists() or OUTPUT.read_bytes() != serialized.encode('utf-8')):
        print('content issues artifact differs; explicitly regenerate after reviewing catalog'); return 1
    print(json.dumps(result['counts'], ensure_ascii=False)); return 0

if __name__ == '__main__': raise SystemExit(main())
