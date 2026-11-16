"""Explicit review overlay; observations remain authoritative and lossless."""
from copy import deepcopy
STATUSES = ('resolved', 'ambiguous', 'deprecated', 'orphaned', 'pending_review')

def key(row):
    return (row['namespace'], row['legacyId'], row.get('source'))

def validate_resolutions(document, mapping, identity):
    errors = []
    if not isinstance(document, dict) or set(document) != {'schemaVersion', 'decisions'} or type(document.get('schemaVersion')) is not int or document.get('schemaVersion') != 1 or not isinstance(document.get('decisions'), list):
        return ['invalid resolution document']
    observed = {key(row): row for row in mapping['mappings']}
    active = {b['canonicalId'] for b in identity['bindings'].values() if b.get('status') == 'active'}
    seen = set()
    for row in document['decisions']:
        if not isinstance(row, dict) or set(row) != {'namespace', 'legacyId', 'source', 'status', 'canonicalId', 'review'} or not all(isinstance(row.get(f), str) for f in ('namespace', 'legacyId', 'status')) or not (row.get('source') is None or isinstance(row.get('source'), str)) or not (row.get('canonicalId') is None or isinstance(row.get('canonicalId'), str)):
            errors.append('invalid decision identity'); continue
        k = key(row)
        if k in seen: errors.append('duplicate decision')
        seen.add(k)
        review = row.get('review')
        if not isinstance(review, dict) or set(review) != {'reviewer', 'reason'} or not all(isinstance(review.get(f), str) and review[f].strip() for f in ('reviewer', 'reason')):
            errors.append('review evidence required')
        if row['status'] not in STATUSES: errors.append('invalid decision status')
        if k not in observed: errors.append('decision alias missing from observations'); continue
        if row['status'] == 'resolved':
            if row.get('canonicalId') not in observed[k]['candidates'] or row.get('canonicalId') not in active:
                errors.append('resolved decision target must be active observed candidate')
        elif row.get('canonicalId') is not None: errors.append('unresolved decision cannot select target')
    return errors

def resolution_rows(mapping, identity, decisions=None):
    """Effective view retains full observed row and adds reviewed status; no merge."""
    if decisions is None: decisions = {'schemaVersion': 1, 'decisions': []}
    errors = validate_resolutions(decisions, mapping, identity)
    if errors: raise ValueError('; '.join(errors))
    reviews = {key(row): row for row in decisions['decisions']}
    for row in mapping['mappings']:
        result = deepcopy(row)
        decision = reviews.get(key(row))
        result['observedStatus'] = row['status']
        result['review'] = deepcopy(decision['review']) if decision else None
        if decision:
            result['status'] = decision['status']
            result['canonicalId'] = decision.get('canonicalId')
        yield result
