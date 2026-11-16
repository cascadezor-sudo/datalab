"""Offline content occurrence catalog. Never imports site code or browser storage.

Generate explicitly with --write; validate existing artifacts with --check.
Canonical UUIDs are persisted; source locators are bindings, never ID hashes.
"""
from __future__ import annotations
import argparse, collections, hashlib, json, os, pathlib, posixpath, re, tempfile, uuid
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[2]
DOCS = ROOT / 'docs/modernization'
OUT = ROOT / 'content/prototype'

def read(path):
    return json.loads(path.read_text(encoding='utf-8-sig'))

def dump(value):
    return json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + '\n'

class UnallocatedIdentityError(ValueError):
    """A read/check must not mint identities for unreviewed new source objects."""

def pointer(value):
    return str(value).replace('~', '~0').replace('/', '~1')

class Collector:
    def __init__(self, root, identity, allow_new_ids=True):
        self.root, self.identity = root, identity
        self.entities, self.edges, self.issues, self.sources = [], [], [], []
        self.by_key, self.routes, self.pending = {}, {}, []
        self.seen = set()
        self.allow_new_ids = allow_new_ids
        self.edge_keys = set()
        self.previous_aliases = {}

    def add(self, key, kind, path, loc, title='', legacy=(), metadata=None, parent=None):
        if key in self.seen:
            raise ValueError('duplicate source key: ' + key)
        self.seen.add(key)
        binding = self.identity['bindings'].get(key)
        if binding:
            self.previous_aliases[key] = [dict(a) for a in binding.get('legacyIds', [])]
        if binding is None:
            if not self.allow_new_ids:
                raise UnallocatedIdentityError('Unallocated source identity: ' + key)
            binding = {'canonicalId': 'dl_' + uuid.uuid4().hex, 'objectType': kind,
                       'source': path, 'status': 'active'}
            self.identity['bindings'][key] = binding
        binding['status'] = 'active'
        binding['legacyIds'] = [{'namespace': n, 'value': str(v)} for n, v in legacy if v is not None]
        entity = {'id': binding['canonicalId'], 'type': kind, 'title': str(title or ''),
                  'sourceKey': key, 'source': {'path': path, 'pointer': loc},
                  'legacyIds': [{'namespace': n, 'value': str(v)} for n, v in legacy if v is not None],
                  'metadata': metadata or {}}
        self.entities.append(entity); self.by_key[key] = entity
        if parent:
            self.edge(parent, entity, 'contains', path, loc)
        return entity

    def edge(self, source, target, kind, path, loc):
        # Different evidence locations are distinct citations. Exact duplicates
        # carry no additional evidence and must not inflate a relationship.
        key = (source['id'], target['id'], kind, path, loc)
        if key in self.edge_keys:
            return
        self.edge_keys.add(key)
        self.edges.append({'from': source['id'], 'to': target['id'], 'type': kind,
                           'evidence': {'path': path, 'pointer': loc}, 'status': 'observed'})

    def reference(self, entity, value, path, loc, kind='references'):
        if isinstance(value, str) and value:
            self.pending.append((entity, value, path, loc, kind))

    def resolve(self):
        for entity, value, path, loc, kind in self.pending:
            parsed = urlsplit(value)
            if parsed.scheme or parsed.netloc or value.startswith(('mailto:', 'javascript:', 'data:')):
                continue
            target_path = unquote(parsed.path)
            if target_path.startswith('/datalab/'):
                target_path = target_path[len('/datalab/'):]
            elif target_path.startswith('/'):
                target_path = target_path[1:]
            elif target_path:
                target_path = posixpath.normpath(posixpath.join(posixpath.dirname(path), target_path))
            else:
                target_path = path
            if not pathlib.PurePosixPath(target_path).suffix:
                target_path = (target_path.rstrip('/') + '/index.html').lstrip('/')
            route = target_path + ('#' + unquote(parsed.fragment) if parsed.fragment else '')
            targets = self.routes.get(route, [])
            if len(targets) == 1:
                self.edge(entity, targets[0], kind, path, loc)
            elif len(targets) > 1:
                self.issues.append({'code': 'ambiguous-reference', 'severity': 'warning',
                                    'source': path, 'pointer': loc, 'target': route,
                                    'candidates': [x['id'] for x in targets]})
            elif target_path.endswith('.html'):
                self.issues.append({'code': 'missing-reference', 'severity': 'warning',
                                    'source': path, 'pointer': loc, 'target': route})

class PageParser(HTMLParser):
    def __init__(self, catalog, path, page):
        super().__init__(convert_charrefs=True)
        self.c, self.path, self.page = catalog, path, page
        self.counts = collections.Counter(); self.in_title = False; self.title = []
        self.stack = []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs); line = str(self.getpos()[0]); self.in_title |= tag == 'title'
        base = self.stack[-1][1] if self.stack else self.page
        topic = a.get('data-md-id')
        exercise = 'data-tests' in a or 'data-answers' in a
        if topic or exercise:
            token = topic or a.get('id') or 'anonymous'
            occurrence = self.counts[('topic', token)]; self.counts[('topic', token)] += 1
            kind = 'Exercise' if exercise else 'ContentBlock'
            md = {'tag': tag, 'line': int(line), 'format': 'legacy-html',
                  'hasPythonTests': 'data-tests' in a, 'hasMathAnswers': 'data-answers' in a}
            for field in ('data-tests', 'data-answers'):
                if field in a:
                    if field == 'data-tests':
                        md[field] = a[field]
                        continue
                    try:
                        payload = json.loads(a[field]); md[field] = payload
                    except (ValueError, TypeError):
                        self.c.issues.append({'code': 'invalid-exercise-json', 'severity': 'error',
                                              'source': self.path, 'line': int(line), 'attribute': field})
            old_ids = [('md-source-id', topic)] + ([('exercise-id', token)] if exercise else [])
            if 'data-answers' in a:
                old_ids += [('math-exercise-id', token), ('math-draft-id', self.path + '#' + token)]
            base = self.c.add(f'{self.path}::topic:{token}:{occurrence}', kind, self.path,
                              'line:' + line, token,
                              old_ids, md, self.page)
        anchor_value = a.get('id') or (a.get('name') if tag == 'a' else None)
        if anchor_value:
            token = anchor_value; occurrence = self.counts[('anchor', token)]; self.counts[('anchor', token)] += 1
            anchor = self.c.add(f'{self.path}::anchor:{token}:{occurrence}', 'Section', self.path,
                                'line:' + line, token, [('html-anchor', token)], {'tag': tag}, base)
            self.c.routes.setdefault(self.path + '#' + token, []).append(anchor)
            if 'name' in a.get('class', '').split():
                topic_entity = base if base['type'] in ('ContentBlock', 'Exercise') else anchor
                alias = {'namespace': 'topic-id', 'value': token}
                if alias not in topic_entity['legacyIds']: topic_entity['legacyIds'].append(alias)
                sanitized = re.sub(r'[.#$\[\]/]', '_', token)
                topic_entity['legacyIds'] += [{'namespace': name, 'value': sanitized} for name in ('difficulty-id', 'review-later-id')]
            if occurrence:
                self.c.issues.append({'code': 'duplicate-html-id', 'severity': 'warning',
                                      'source': self.path, 'legacyId': token, 'line': int(line)})
        if a.get('href'):
            self.c.reference(base, a['href'], self.path, 'line:' + line)
        if a.get('data-quiz-id'):
            self.page['metadata'].setdefault('quizRefs', []).append(a['data-quiz-id'])
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.stack.append((tag, base))

    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]; break

    def handle_data(self, data):
        if self.in_title: self.title.append(data)

def json_nodes(c, path, data, parent, loc='', context=''):
    """All identifier-bearing objects; explicit dictionary-key identities below."""
    if isinstance(data, list):
        id_counts = collections.Counter()
        for index, item in enumerate(data):
            label = str(item.get('id', '')) if isinstance(item, dict) else ''
            # Stable explicit IDs independent of order; duplicate occurrences retain ordinal.
            token = 'id:' + label + ':' + str(id_counts[label]) if label else str(index)
            id_counts[label] += 1
            json_nodes(c, path, item, parent, loc + '/' + pointer(token), context)
    elif isinstance(data, dict):
        current = parent
        old_id = data.get('id')
        if old_id is not None:
            kind, namespace = 'SourceRecord', 'source-id'
            if '/quizzes/' in path:
                kind, namespace = ('Question', 'quiz-question-id') if context == 'items' else ('Quiz', 'quiz-id')
            elif 'teormin-cards.json' in path: kind, namespace = 'Flashcard', 'flashcard-id'
            elif 'achievements/' in path: kind, namespace = 'Achievement', 'achievement-id'
            elif 'course-roadmap' in path:
                kind, namespace = ('Milestone', 'roadmap-milestone-id') if context == 'milestones' else ('PathTrack', 'roadmap-track-id')
            elif 'question-of-day' in path: kind, namespace = 'QuestionIndexEntry', 'question-index-id'
            current = c.add(path + '::json:' + loc, kind, path, loc, data.get('title', data.get('q', data.get('promptText', old_id))),
                            [(namespace, old_id)], {'format': 'json', 'fields': sorted(data),
                               **{k: data[k] for k in ('questionId', 'category', 'week', 'phase', 'questionCategory', 'targetPage') if k in data}}, parent)
            if kind == 'Flashcard' and data.get('targetPage') and data.get('questionId'):
                c.reference(current, '/' + data['targetPage'].lstrip('/') + '#' + str(data['questionId']), path, loc + '/questionId', 'reviews')
            for field in ('href', 'url'):
                if field in data: c.reference(current, data[field], path, loc + '/' + field)
        for key, value in data.items():
            child_loc = loc + '/' + pointer(key)
            if key == 'section_labels': continue
            if current.get('type') == 'Flashcard' and key == 'category': continue
            if key == 'categories' and isinstance(value, dict):
                for cat, record in value.items():
                    category = c.add(path + '::category:' + cat, 'SourceCategory', path, child_loc + '/' + pointer(cat),
                                     record.get('displayName', cat) if isinstance(record, dict) else cat,
                                     [('category-id', cat)], {'group': record.get('group') if isinstance(record, dict) else None}, current)
                    if isinstance(record, list):
                        category['metadata']['questionIds'] = record
                        for index, old in enumerate(record):
                            if isinstance(old, str):
                                c.add(path + '::question-index:' + cat + ':' + old, 'QuestionReference', path,
                                      child_loc + '/' + pointer(cat) + '/' + str(index), old,
                                      [('question-index-id', old)], {}, category)
                    elif isinstance(record, dict):
                        for target in record.get('questionPaths', []):
                            c.reference(category, '/' + target.lstrip('/'), path, child_loc, 'categorizes')
                        if record.get('roadmapUrl'): c.reference(category, record['roadmapUrl'], path, child_loc, 'roadmap')
                continue
            if 'definitions/' in path and not loc and isinstance(value, dict):
                section = c.add(path + '::definition-section:' + key, 'SourceCategory', path, child_loc, key,
                                [('definition-section-id', key)], {}, current)
                for term, record in value.items():
                    if isinstance(record, dict):
                        c.add(path + '::definition:' + key + '/' + term, 'Definition', path,
                              child_loc + '/' + pointer(term), record.get('title', term), [('definition-id', term)],
                              {'section': key, 'format': 'json'}, section)
                continue
            json_nodes(c, path, value, current, child_loc, key)

def build(root=ROOT, existing=None, *, allow_new_ids=None):
    if allow_new_ids is None:
        allow_new_ids = existing is None
    identity = json.loads(json.dumps(existing or {'schemaVersion': 1, 'bindings': {}, 'aliases': {}}))
    for entry in identity['bindings'].values(): entry['status'] = 'retired'
    c = Collector(root, identity, allow_new_ids=allow_new_ids)
    site = root / 'site'
    for file in sorted(site.rglob('*.html')):
        path = file.relative_to(site).as_posix()
        page = c.add(path + '::page', 'LegacyPage', path, '', path, [('html-path', path)],
                     {'localUrl': '/' + path, 'pagesUrl': '/datalab/' + path,
                      'classification': 'unclassified', 'format': 'legacy-html'})
        c.routes[path] = [page]
        parser = PageParser(c, path, page)
        text = file.read_text(encoding='utf-8-sig'); parser.feed(text)
        page['title'] = ''.join(parser.title).strip() or path
        c.sources.append({'path': path, 'format': 'html', 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
    for file in sorted(site.rglob('*.json')):
        path = file.relative_to(site).as_posix()
        if not path.startswith(('assets/data/', 'assets/js/config/')): continue
        text = file.read_text(encoding='utf-8-sig')
        try: data = json.loads(text)
        except ValueError:
            c.issues.append({'code': 'invalid-json', 'severity': 'error', 'source': path}); continue
        kind = 'LearningPath' if path.endswith('course-roadmap.json') else 'SourceDataset'
        dataset = c.add(path + '::dataset', kind, path, '', data.get('title', path) if isinstance(data, dict) else path,
                        [('dataset-path', path)], {'format': 'json'})
        c.sources.append({'path': path, 'format': 'json', 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
        json_nodes(c, path, data, dataset)
        if path.endswith('teormin-card-blocks.json') and isinstance(data, dict):
            for page, spec in data.get('pages', {}).items():
                for old, block in spec.get('blocks', {}).items():
                    entry = c.add(path + '::card-block:' + page + '#' + old, 'CardBlockAssignment', path,
                                  '/pages/' + pointer(page) + '/blocks/' + pointer(old), old,
                                  [('card-block-topic-id', old)], {'blockNumber': block, 'targetPage': page}, dataset)
                    c.reference(entry, '/' + page + '#' + old, path, entry['source']['pointer'], 'assigns-block')
        if '/quizzes/registry' in path and isinstance(data, dict):
            for key, record in data.items():
                if not isinstance(record, dict): continue
                ent = next((e for e in c.entities if e['source']['path'] == path and any(i['value'] == str(record.get('id', key)) for i in e['legacyIds'])), dataset)
                if record.get('file'):
                    c.pending.append((ent, record['file'], path, '/' + key + '/file', 'quiz-definition'))
                    target = 'assets/data/quizzes/' + record['file']
                    # JSON target resolved after every dataset has been collected.
                    ent['metadata']['definitionFile'] = target
    # Link JSON resources and registry quiz declarations explicitly.
    for e in c.entities:
        if e['type'] in ('SourceDataset', 'LearningPath'): c.routes[e['source']['path']] = [e]
    quiz_by_file = collections.defaultdict(list)
    for e in c.entities:
        if e['type'] == 'Quiz' and '/registry' not in e['source']['path']:
            quiz_by_file[e['source']['path']].append(e)
    quiz_dir = site / 'assets/data/quizzes'
    base_registry = read(quiz_dir / 'registry.json') if (quiz_dir / 'registry.json').is_file() else {}
    en_registry = read(quiz_dir / 'registry.en.json') if (quiz_dir / 'registry.en.json').is_file() else {}
    for page in c.entities:
        for old in page['metadata'].get('quizRefs', []):
            language = '/en/' in '/' + page['source']['path']
            # quiz.js loads base registry, applies EN metadata, then tries the
            # translated definition before the base file. An EN page does not
            # imply the existence of a separate translated quiz identity.
            info = dict(base_registry.get(old, {}))
            if language:
                info.update(en_registry.get(old, {}))
            filename = info.get('file', '')
            base_file = 'assets/data/quizzes/' + filename if isinstance(filename, str) else ''
            translated_file = re.sub(r'\.json$', '.en.json', base_file)
            selected = translated_file if language and quiz_by_file.get(translated_file) else base_file
            candidates = quiz_by_file.get(selected, [])
            if len(candidates) == 1:
                c.edge(page, candidates[0], 'offers-quiz', page['source']['path'], 'data-quiz-id=' + old)
                page['metadata'].setdefault('quizResolution', []).append({
                    'quizId': old, 'registry': 'assets/data/quizzes/registry.json',
                    'selectedDefinition': selected,
                    'fallbackDefinition': base_file if language else None,
                    'evidence': 'assets/js/components/quiz.js::loadQuizRegistry/fetchQuizFile'})
            else: c.issues.append({'code': 'quiz-reference-unresolved', 'severity': 'warning', 'source': page['source']['path'], 'legacyId': old, 'candidates': [x['id'] for x in candidates]})
    # JS literal registries are evidence-only: never execute arbitrary source code.
    for name in ('navigation.js', '../kanban-board.js', '../interview-question-bank.js', 'interview-question-bank.js'):
        file = site / 'assets/js/components' / name
        if not file.exists(): continue
        path = file.relative_to(site).as_posix().replace('components/../', '')
        text = file.read_text(encoding='utf-8-sig')
        registry_kind = 'NavigationRegistry' if name == 'navigation.js' else ('QuestionBankConfiguration' if 'question-bank' in name else 'KanbanConfiguration')
        dataset = c.add(path + '::dataset', registry_kind, path, '', path,
                        [('dataset-path', path)], {'extraction': 'static-literals-only', 'runtimeValuesExcluded': True})
        c.sources.append({'path': path, 'format': 'javascript', 'sha256': hashlib.sha256(file.read_bytes()).hexdigest()})
        counts = collections.Counter()
        for match in re.finditer(r'\b(href|id)\s*:\s*([\"\x27])([^\"\x27\n]+)\2', text):
            field, _, val = match.groups(); number = counts[(field, val)]; counts[(field, val)] += 1
            child_kind = 'NavigationEntry' if name == 'navigation.js' else ('QuestionBankTopic' if 'question-bank' in name else 'KanbanValue')
            namespace = 'navigation-id' if name == 'navigation.js' else ('questionbank-id' if 'question-bank' in name else 'kanban-id')
            child = c.add(f'{path}::literal:{field}:{val}:{number}', child_kind,
                          path, 'line:' + str(text[:match.start()].count('\n') + 1), val,
                          [(namespace, val)] if field == 'id' else [],
                          {'field': field, 'extraction': 'literal'}, dataset)
            if field == 'href': c.reference(child, val, path, child['source']['pointer'], 'navigates-to')
    # Independent copies are retained as separate occurrences, with conflict evidence.
    for left, right in [('assets/data/teormin-cards.json', 'assets/js/config/teormin-cards.json'),
                        ('assets/js/config/categories-config.json', 'assets/js/config/categories-config-live.json')]:
        if (site / left).exists() and (site / right).exists():
            a, b = read(site / left), read(site / right)
            if a != b:
                issue = {'code': 'source-copy-conflict', 'severity': 'warning', 'sources': [left, right]}
                if 'cards' in a and 'cards' in b:
                    aa = {item['id']: item for item in a['cards']}; bb = {item['id']: item for item in b['cards']}
                    shared = set(aa) & set(bb)
                    issue.update({'leftCount': len(a['cards']), 'rightCount': len(b['cards']),
                                  'leftUniqueIds': len(aa), 'rightUniqueIds': len(bb), 'sharedIds': len(shared),
                                  'differentRecords': sum(aa[k] != bb[k] for k in shared)})
                c.issues.append(issue)
    c.resolve()
    # HTML parsing appends real DOM/progress aliases after add(). Persist those
    # too, otherwise explicit rebind would lose the historical scoped aliases.
    for entity in c.entities:
        binding = identity['bindings'][entity['sourceKey']]
        removed = [a for a in c.previous_aliases.get(entity['sourceKey'], []) if a not in entity['legacyIds']]
        if removed:
            binding.setdefault('historicalSources', []).append({
                'sourceKey': entity['sourceKey'], 'source': entity['source']['path'], 'legacyIds': removed})
        binding['legacyIds'] = sorted(entity['legacyIds'], key=lambda a: (a['namespace'], a['value']))
        entity['legacyIds'] = list(binding['legacyIds'])
    c.entities.sort(key=lambda e: e['sourceKey'])
    c.edges.sort(key=lambda r: (r['from'], r['to'], r['type'], r['evidence']['path'], r['evidence']['pointer']))
    c.sources.sort(key=lambda s: s['path'])
    catalog = {'schemaVersion': 1, 'mode': 'offline-prototype', 'sources': c.sources,
               'entities': c.entities, 'relationships': c.edges, 'issues': c.issues}
    mapping = make_mapping(c.entities, identity)
    catalog['issues'].extend(validate(catalog, identity, mapping))
    decision_path = root / 'content/prototype/id-resolutions.json'
    if decision_path.is_file():
        try:
            from tools.content.resolution import validate_resolutions
        except ModuleNotFoundError:
            from resolution import validate_resolutions
        decisions = read(decision_path)
        schema_errors = validate_schema(decisions, {'$ref': '#/$defs/resolutions'}, read(OUT / 'catalog.schema.json'))
        decision_errors = schema_errors or validate_resolutions(decisions, mapping, identity)
        if decision_errors:
            catalog['issues'].append({'code': 'invalid-resolution-decisions', 'severity': 'error', 'details': decision_errors})
    catalog['issues'].sort(key=lambda issue: json.dumps(issue, sort_keys=True, ensure_ascii=False))
    return catalog, identity, mapping

def make_mapping(entities, identity=None):
    groups = collections.defaultdict(list)
    for entity in entities:
        for alias in entity['legacyIds']:
            for scope in (entity['source']['path'], None):
                groups[(alias['namespace'], alias['value'], scope)].append(entity)
    if identity:
        current = {e['id']: e for e in entities}
        for source_key, binding in identity['bindings'].items():
            if binding['canonicalId'] not in current:
                # Tombstones remain inspectable aliases; they never grant
                # completion or pretend an archived source is active content.
                retired = {'id': binding['canonicalId'], 'type': binding['objectType'],
                           'sourceKey': source_key, 'source': {'path': binding['source'], 'pointer': ''}}
                for alias in binding.get('legacyIds', []):
                    for scope in (binding['source'], None):
                        groups[(alias['namespace'], alias['value'], scope)].append(retired)
            for historical in binding.get('historicalSources', []):
                entity = dict(current.get(binding['canonicalId'], {
                    'id': binding['canonicalId'], 'type': binding['objectType']}))
                entity['source'] = {'path': historical['source'], 'pointer': ''}
                entity['sourceKey'] = historical['sourceKey']
                for alias in historical['legacyIds']:
                    for scope in (historical['source'], None):
                        groups[(alias['namespace'], alias['value'], scope)].append(entity)
    mappings = []
    active = {e['id'] for e in entities}
    for (namespace, old, source), entries in sorted(groups.items(), key=lambda pair: (pair[0][0], pair[0][1], pair[0][2] or '')):
        ids = sorted({e['id'] for e in entries})
        status = 'resolved' if len(ids) == 1 and ids[0] in active else ('orphaned' if not active.intersection(ids) else 'ambiguous')
        mappings.append({'namespace': namespace, 'legacyId': old, 'source': source,
                         'objectType': entries[0]['type'] if len({e['type'] for e in entries}) == 1 else 'mixed',
                         'canonicalId': ids[0] if status == 'resolved' else None,
                         'status': status,
                         'candidates': ids, 'aliases': [],
                         'occurrences': [{'source': e['source']['path'], 'sourceKey': e['sourceKey'], 'canonicalId': e['id']} for e in entries]})
    return {'schemaVersion': 1, 'mappings': mappings}

def validate(catalog, identity, mapping):
    issues = []
    def malformed(field):
        return [{'code': 'invalid-schema', 'severity': 'error', 'field': field}]
    if not isinstance(catalog, dict) or not isinstance(identity, dict) or not isinstance(mapping, dict): return malformed('documents')
    schema = read(OUT / 'catalog.schema.json')
    for value, name in ((catalog, 'catalog'), (identity, 'identity'), (mapping, 'mapping')):
        schema_errors = validate_schema(value, {'$ref': '#/$defs/' + name}, schema)
        if schema_errors: return [{'code': 'invalid-schema', 'severity': 'error', 'field': name, 'details': schema_errors[:10]}]
    if any(not isinstance(catalog.get(k), list) for k in ('entities','relationships','sources','issues')): return malformed('catalog collections')
    if not isinstance(identity.get('bindings'), dict) or not isinstance(identity.get('aliases'), dict): return malformed('identity')
    if not isinstance(mapping.get('mappings'), list): return malformed('mapping')
    if identity.get('schemaVersion') != 1 or mapping.get('schemaVersion') != 1: return malformed('schemaVersion')
    for entity in catalog['entities']:
        if not isinstance(entity, dict) or any(not isinstance(entity.get(k), str) for k in ('id','type','title','sourceKey')): return malformed('entity fields')
        if not isinstance(entity.get('source'), dict) or any(not isinstance(entity['source'].get(k), str) for k in ('path','pointer')): return malformed('entity source')
        if not isinstance(entity.get('legacyIds'), list) or not isinstance(entity.get('metadata'), dict): return malformed('entity payload')
        if any(not isinstance(a, dict) or any(not isinstance(a.get(k), str) for k in ('namespace','value')) for a in entity['legacyIds']): return malformed('legacy alias')
    for edge in catalog['relationships']:
        if not isinstance(edge, dict) or any(not isinstance(edge.get(k), str) for k in ('from','to','type','status')): return malformed('relationship fields')
        if not isinstance(edge.get('evidence'), dict) or any(not isinstance(edge['evidence'].get(k), str) for k in ('path','pointer')): return malformed('relationship evidence')
    for source in catalog['sources']:
        if not isinstance(source, dict) or any(not isinstance(source.get(k), str) for k in ('path','format','sha256')): return malformed('sources')
    for binding in identity['bindings'].values():
        if not isinstance(binding, dict) or any(not isinstance(binding.get(k), str) for k in ('canonicalId','objectType','source','status')): return malformed('binding')
    for row in mapping['mappings']:
        if not isinstance(row, dict) or any(not isinstance(row.get(k), str) for k in ('namespace','legacyId','objectType','status')): return malformed('mapping fields')
        if not (row.get('source') is None or isinstance(row.get('source'), str)): return malformed('mapping source')
        if not (row.get('canonicalId') is None or isinstance(row.get('canonicalId'), str)): return malformed('mapping canonicalId')
        if any(not isinstance(row.get(k), list) for k in ('candidates','aliases','occurrences')): return malformed('mapping arrays')
        if any(not isinstance(v, str) for v in row['candidates']): return malformed('mapping candidates')
        if any(not isinstance(v, dict) or any(not isinstance(v.get(k), str) for k in ('source','sourceKey','canonicalId')) for v in row['occurrences']): return malformed('mapping occurrence')
    entities = catalog['entities']; ids = [e['id'] for e in entities]; known = set(ids)
    by_id = {e['id']: e for e in entities}
    source_paths = {s['path'] for s in catalog['sources']}
    for source in catalog['sources']:
        if (source['format'] not in ('html','json','javascript') or not re.fullmatch('[0-9a-f]{64}', source['sha256'])
            or pathlib.PurePosixPath(source['path']).is_absolute() or '..' in pathlib.PurePosixPath(source['path']).parts):
            issues.append({'code': 'invalid-source', 'severity': 'error', 'source': source['path']})
    if len(source_paths) != len(catalog['sources']): issues.append({'code': 'duplicate-source', 'severity': 'error'})
    source_keys = [e['sourceKey'] for e in entities]
    if len(set(source_keys)) != len(source_keys): issues.append({'code': 'duplicate-source-key', 'severity': 'error'})
    entity_by_key = {e['sourceKey']: e for e in entities}
    bound_ids = collections.Counter(b['canonicalId'] for b in identity['bindings'].values())
    for bound_id, count in bound_ids.items():
        if count > 1: issues.append({'code': 'duplicate-binding-id', 'severity': 'error', 'id': bound_id})
    for key, binding in identity['bindings'].items():
        if binding['status'] == 'active' and (key not in entity_by_key or entity_by_key[key]['id'] != binding['canonicalId']):
            issues.append({'code': 'registry-mismatch', 'severity': 'error', 'sourceKey': key})
    for e in entities:
        if e['source']['path'] not in source_paths: issues.append({'code': 'missing-source', 'severity': 'error', 'id': e['id']})
        binding = identity['bindings'].get(e['sourceKey'])
        if not binding or (binding['objectType'], binding['source'], binding['status']) != (e['type'], e['source']['path'], 'active'):
            issues.append({'code': 'registry-mismatch', 'severity': 'error', 'id': e['id']})
    for old, alias in identity['aliases'].items():
        if not isinstance(alias, dict) or not isinstance(alias.get('targetKey'), str) or not isinstance(alias.get('canonicalId'), str):
            issues.append({'code': 'invalid-binding-alias', 'severity': 'error', 'sourceKey': old}); continue
        seen = {old}; target = alias['targetKey']
        while target in identity['aliases']:
            if target in seen: break
            seen.add(target); next_alias = identity['aliases'][target]
            if not isinstance(next_alias, dict) or not isinstance(next_alias.get('targetKey'), str): break
            target = next_alias['targetKey']
        if target in seen:
            issues.append({'code': 'binding-alias-cycle', 'severity': 'error', 'sourceKey': old})
        elif target not in identity['bindings'] or identity['bindings'][target]['canonicalId'] != alias['canonicalId']:
            issues.append({'code': 'invalid-binding-alias', 'severity': 'error', 'sourceKey': old})
    if catalog.get('schemaVersion') != 1 or catalog.get('mode') != 'offline-prototype':
        issues.append({'code': 'invalid-schema', 'severity': 'error', 'field': 'catalog-header'})
    allowed_types = {'LegacyPage','Section','ContentBlock','Exercise','SourceDataset','Achievement','SourceRecord',
                     'LearningPath','Milestone','PathTrack','SourceCategory','Definition','QuestionIndexEntry','Quiz',
                     'Question','Flashcard','QuestionReference','CardBlockAssignment','NavigationRegistry','NavigationEntry',
                     'KanbanConfiguration','KanbanValue','QuestionBankConfiguration','QuestionBankTopic'}
    edge_types = {'contains','references','reviews','categorizes','roadmap','quiz-definition','offers-quiz','navigates-to','assigns-block'}
    for entity in entities:
        if (entity.get('type') not in allowed_types or not re.fullmatch(r'dl_[0-9a-f]{32}', entity.get('id', ''))
            or not isinstance(entity.get('title'), str) or not isinstance(entity.get('metadata'), dict)
            or not isinstance(entity.get('sourceKey'), str) or not isinstance(entity.get('source'), dict)
            or not isinstance(entity['source'].get('path'), str) or not isinstance(entity['source'].get('pointer'), str)
            or not isinstance(entity.get('legacyIds'), list)):
            issues.append({'code': 'invalid-schema', 'severity': 'error', 'id': entity.get('id')})
        for alias in entity.get('legacyIds', []):
            if not isinstance(alias, dict) or not isinstance(alias.get('namespace'), str) or not isinstance(alias.get('value'), str):
                issues.append({'code': 'invalid-schema', 'severity': 'error', 'field': 'legacyIds'})
    for value, count in collections.Counter(ids).items():
        if count > 1: issues.append({'code': 'duplicate-canonical-id', 'severity': 'error', 'id': value})
    adjacency = collections.defaultdict(list); contained = set()
    edge_keys = set()
    parents = collections.defaultdict(set)
    for edge in catalog['relationships']:
        edge_key = (edge['from'], edge['to'], edge['type'], edge['evidence']['path'], edge['evidence']['pointer'])
        if edge_key in edge_keys:
            issues.append({'code': 'duplicate-relationship', 'severity': 'error', 'edge': edge})
        edge_keys.add(edge_key)
        if edge.get('type') not in edge_types:
            issues.append({'code': 'invalid-relationship-type', 'severity': 'error', 'edge': edge})
        if edge['from'] not in known or edge['to'] not in known:
            issues.append({'code': 'dangling-relationship', 'severity': 'error', 'edge': edge})
        if not edge.get('evidence') or edge.get('status') != 'observed':
            issues.append({'code': 'relationship-without-evidence', 'severity': 'error', 'edge': edge})
        if edge['type'] == 'contains':
            adjacency[edge['from']].append(edge['to']); contained.add(edge['to'])
            parents[edge['to']].add(edge['from'])
        if edge['evidence']['path'] not in source_paths:
            issues.append({'code': 'invalid-evidence-source', 'severity': 'error', 'edge': edge})
        semantic_pairs = {'reviews': {('Flashcard','Section')}, 'offers-quiz': {('LegacyPage','Quiz')},
                          'quiz-definition': {('Quiz','SourceDataset')}, 'categorizes': {('SourceCategory','LegacyPage')},
                          'roadmap': {('SourceCategory','LegacyPage')}, 'assigns-block': {('CardBlockAssignment','Section')},
                          'navigates-to': {('NavigationEntry','LegacyPage'),('NavigationEntry','Section')}}
        if edge['type'] in semantic_pairs and edge['from'] in by_id and edge['to'] in by_id:
            pair = (by_id[edge['from']]['type'], by_id[edge['to']]['type'])
            if pair not in semantic_pairs[edge['type']]:
                issues.append({'code': 'invalid-relationship-endpoints', 'severity': 'error', 'edge': edge})
        if edge['type'] == 'contains' and edge['from'] in by_id and edge['to'] in by_id:
            pair = (by_id[edge['from']]['type'], by_id[edge['to']]['type'])
            parent_source = by_id[edge['from']]['source']['path']
            child_source = by_id[edge['to']]['source']['path']
            if parent_source != child_source or edge['evidence']['path'] != parent_source:
                issues.append({'code': 'invalid-containment-source', 'severity': 'error', 'edge': edge})
            allowed_contains = {('ContentBlock','Section'),('Exercise','Section'),('KanbanConfiguration','KanbanValue'),
                ('LearningPath','Milestone'),('LegacyPage','ContentBlock'),('LegacyPage','Exercise'),('LegacyPage','Section'),
                ('Milestone','PathTrack'),('NavigationRegistry','NavigationEntry'),('QuestionBankConfiguration','QuestionBankTopic'),
                ('Quiz','Question'),('SourceCategory','Definition'),('SourceCategory','QuestionReference'),
                *[('SourceDataset', t) for t in ('Achievement','CardBlockAssignment','Flashcard','QuestionIndexEntry','Quiz','SourceCategory','SourceRecord')]}
            if pair not in allowed_contains:
                issues.append({'code': 'invalid-containment-type', 'severity': 'error', 'edge': edge})
    for child, parent_ids in parents.items():
        if len(parent_ids) > 1:
            issues.append({'code': 'multiple-containment-parents', 'severity': 'error', 'id': child, 'parents': sorted(parent_ids)})
    visiting, done = set(), set()
    def visit(value):
        if value in visiting:
            issues.append({'code': 'containment-cycle', 'severity': 'error', 'id': value}); return
        if value in done: return
        visiting.add(value)
        for child in adjacency[value]: visit(child)
        visiting.remove(value); done.add(value)
    for value in ids: visit(value)
    for entity in entities:
        if identity['bindings'].get(entity['sourceKey'], {}).get('canonicalId') != entity['id']:
            issues.append({'code': 'registry-mismatch', 'severity': 'error', 'id': entity['id']})
        if entity['type'] not in ('LegacyPage', 'LearningPath', 'SourceDataset', 'NavigationRegistry', 'KanbanConfiguration', 'QuestionBankConfiguration') and entity['id'] not in contained:
            issues.append({'code': 'orphan-entity', 'severity': 'error', 'id': entity['id']})
    coverage = {(m['namespace'], m['legacyId'], m['source']): m for m in mapping['mappings']}
    if len(coverage) != len(mapping['mappings']): issues.append({'code': 'duplicate-mapping-key', 'severity': 'error'})
    for entity in entities:
        for old in entity['legacyIds']:
            for scope in (entity['source']['path'], None):
                row = coverage.get((old['namespace'], old['value'], scope))
                if not row or entity['id'] not in row['candidates']:
                    issues.append({'code': 'lost-legacy-id', 'severity': 'error', 'id': entity['id'], 'namespace': old['namespace']})
    bindings_by_id = {b['canonicalId']: b for b in identity['bindings'].values()}
    retired = {cid: b for cid, b in bindings_by_id.items() if b['status'] == 'retired'}
    known_targets = known | set(retired)
    for key, binding in identity['bindings'].items():
        if binding['status'] != 'retired':
            continue
        for source, aliases in [(binding['source'], binding.get('legacyIds', []))] + [(h['source'], h['legacyIds']) for h in binding.get('historicalSources', [])]:
            for alias in aliases:
                for scope in (source, None):
                    row = coverage.get((alias['namespace'], alias['value'], scope))
                    if not row or binding['canonicalId'] not in row['candidates']:
                        issues.append({'code': 'lost-legacy-id', 'severity': 'error', 'id': binding['canonicalId'], 'namespace': alias['namespace']})
    for row in mapping['mappings']:
        candidates = row['candidates']
        expected_status = 'resolved' if len(candidates) == 1 and candidates[0] in known else ('orphaned' if candidates and not known.intersection(candidates) else 'ambiguous')
        if (not candidates or len(candidates) != len(set(candidates)) or any(value not in known_targets for value in candidates)
            or row['canonicalId'] != (candidates[0] if expected_status == 'resolved' else None)
            or row['status'] != expected_status):
            issues.append({'code': 'invalid-legacy-mapping', 'severity': 'error', 'namespace': row['namespace'], 'legacyId': row['legacyId']})
        expected = []
        for occurrence in row['occurrences']:
            entity = by_id.get(occurrence['canonicalId'])
            if not entity:
                binding = identity['bindings'].get(occurrence['sourceKey'])
                if binding and binding['status'] == 'retired' and binding['canonicalId'] == occurrence['canonicalId'] and binding['source'] == occurrence['source']:
                    entity = {'id': binding['canonicalId'], 'type': binding['objectType'],
                              'sourceKey': occurrence['sourceKey'], 'source': {'path': binding['source']},
                              'legacyIds': binding.get('legacyIds', [])}
            if not entity or entity['sourceKey'] != occurrence['sourceKey'] or entity['source']['path'] != occurrence['source']:
                # Explicit historical aliases are separately authorized by persisted binding history.
                history = [h for b in identity['bindings'].values() if b['canonicalId'] == occurrence['canonicalId'] for h in b.get('historicalSources', [])]
                if not any(h['sourceKey'] == occurrence['sourceKey'] and h['source'] == occurrence['source'] for h in history):
                    issues.append({'code': 'invalid-mapping-occurrence', 'severity': 'error', 'legacyId': row['legacyId']})
            if not entity and occurrence['canonicalId'] in retired:
                binding = retired[occurrence['canonicalId']]
                entity = {'id': binding['canonicalId'], 'type': binding['objectType'],
                          'sourceKey': occurrence['sourceKey'], 'source': {'path': occurrence['source']}, 'legacyIds': []}
            if entity: expected.append(entity)
        types = {e['type'] for e in expected}
        expected_type = next(iter(types)) if len(types) == 1 else 'mixed'
        if set(candidates) != {o['canonicalId'] for o in row['occurrences']} or row['objectType'] != expected_type:
            issues.append({'code': 'invalid-mapping-occurrence', 'severity': 'error', 'legacyId': row['legacyId']})
        if row['source'] is not None and any(o['source'] != row['source'] for o in row['occurrences']):
            issues.append({'code': 'invalid-mapping-scope', 'severity': 'error', 'legacyId': row['legacyId']})
        for entity in expected:
            if not any(a['namespace'] == row['namespace'] and a['value'] == row['legacyId'] for a in entity['legacyIds']):
                history = bindings_by_id.get(entity['id'], {}).get('historicalSources', [])
                if not any(any(a['namespace'] == row['namespace'] and a['value'] == row['legacyId'] for a in h['legacyIds']) for h in history):
                    issues.append({'code': 'unexpected-mapping-alias', 'severity': 'error', 'legacyId': row['legacyId']})
    # Duplicate legacy identifiers within the same physical dataset stay unresolved.
    for row in mapping['mappings']:
        if row['source'] is not None and row['status'] == 'ambiguous':
            issues.append({'code': 'duplicate-source-identifier', 'severity': 'warning', 'source': row['source'],
                           'namespace': row['namespace'], 'legacyId': row['legacyId'], 'candidates': row['candidates']})
    prompts = collections.defaultdict(list)
    for entity in entities:
        if entity['type'] == 'Question' and entity['title'].strip():
            prompts[' '.join(entity['title'].split())].append(entity['id'])
    for prompt, candidates in prompts.items():
        if len(candidates) > 1:
            issues.append({'code': 'duplicate-question-content', 'severity': 'warning',
                           'promptSha256': hashlib.sha256(prompt.encode()).hexdigest(), 'candidates': candidates,
                           'meaning': 'exact prompt text after whitespace normalization; code/options/answers may differ; no identity merge'})
    return issues

def rebind(identity, old_key, new_key, new_source):
    """Explicit reviewed rename, never fuzzy matching or automatic title inference."""
    if old_key not in identity['bindings']: raise ValueError('Unknown original binding')
    if new_key in identity['bindings']: raise ValueError('Destination binding already exists')
    binding = identity['bindings'].pop(old_key)
    binding.setdefault('historicalSources', []).append({'sourceKey': old_key, 'source': binding['source'],
                                                       'legacyIds': binding.get('legacyIds', [])})
    identity['aliases'][old_key] = {'targetKey': new_key, 'canonicalId': binding['canonicalId']}
    binding['source'] = new_source
    identity['bindings'][new_key] = binding
    return binding['canonicalId']

def validate_schema(value, rule, document, path='$'):
    """Dependency-free validator for every keyword used in catalog.schema.json.

    This is deliberately NOT a general-purpose JSON Schema implementation.
    The supported subset is $ref/type/const/enum/required/properties/
    additionalProperties/items/minItems/uniqueItems/pattern, all used by this contract.
    """
    if '$ref' in rule:
        target = document
        for part in rule['$ref'].removeprefix('#/').split('/'): target = target[part]
        return validate_schema(value, target, document, path)
    errors = []
    type_map = {'object': dict, 'array': list, 'string': str, 'null': type(None), 'number': (int,float), 'boolean': bool}
    expected = rule.get('type')
    if expected and not any(isinstance(value, type_map[t]) for t in (expected if isinstance(expected, list) else [expected])):
        return [path + ': type']
    if 'const' in rule and (value != rule['const'] or type(value) != type(rule['const'])): errors.append(path + ': const')
    if 'enum' in rule and value not in rule['enum']: errors.append(path + ': enum')
    if isinstance(value, str) and 'pattern' in rule and not re.search(rule['pattern'], value): errors.append(path + ': pattern')
    if isinstance(value, dict):
        for field in rule.get('required', []):
            if field not in value: errors.append(path + ': missing ' + field)
        properties = rule.get('properties', {})
        for key, item in value.items():
            if key in properties: errors.extend(validate_schema(item, properties[key], document, path + '/' + key))
            elif rule.get('additionalProperties') is False: errors.append(path + ': extra ' + key)
            elif isinstance(rule.get('additionalProperties'), dict): errors.extend(validate_schema(item, rule['additionalProperties'], document, path + '/' + key))
    if isinstance(value, list):
        if len(value) < rule.get('minItems', 0): errors.append(path + ': minItems')
        if rule.get('uniqueItems') and len({json.dumps(v, sort_keys=True) for v in value}) != len(value): errors.append(path + ': uniqueItems')
        if 'items' in rule:
            for index, item in enumerate(value): errors.extend(validate_schema(item, rule['items'], document, path + '/' + str(index)))
    return errors

def materialize_json(content, locator):
    """One shared locator implementation for plain reads and cached readers."""
    for raw in locator.lstrip('/').split('/') if locator else []:
        token = raw.replace('~1', '/').replace('~0', '~')
        if isinstance(content, list):
            if token.startswith('id:'):
                old, occurrence = token[3:].rsplit(':', 1)
                content = [item for item in content if isinstance(item, dict) and str(item.get('id')) == old][int(occurrence)]
            else:
                content = content[int(token)]
        else:
            content = content[token]
    return content

def get_content(entity, root=ROOT):
    """Materialize source content safely, without importing production application code."""
    site = (root / 'site').resolve()
    path = (site / entity['source']['path']).resolve()
    if not path.is_relative_to(site) or not path.is_file(): raise ValueError('Source outside site or missing')
    if path.suffix == '.json':
        return materialize_json(read(path), entity['source']['pointer'])
    return {'format': 'legacy-html' if path.suffix == '.html' else 'javascript',
            'sourceLocator': entity['source']['pointer'], 'content': path.read_text(encoding='utf-8-sig')}

def query(catalog, *, kind=None, source=None, canonical_id=None):
    return [e for e in catalog['entities'] if (kind is None or e['type'] == kind)
            and (source is None or e['source']['path'] == source)
            and (canonical_id is None or e['id'] == canonical_id)]

def write_artifacts(files):
    """Stage all bytes first, then replace individual artifacts atomically.

    This is not a multi-file filesystem transaction. Identity is published first
    so a failed later replacement never forgets newly allocated UUIDs. --check
    detects an interrupted bundle; retry regeneration using that identity seed.
    """
    staged = []
    try:
        for path, value in files.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.' + path.name + '.', suffix='.tmp', delete=False) as output:
                temporary = pathlib.Path(output.name)
                staged.append((temporary, path))
                output.write(dump(value).encode('utf-8'))
                output.flush()
                os.fsync(output.fileno())
        for temporary, path in staged:
            os.replace(temporary, path)
    finally:
        for temporary, _ in staged:
            if temporary.exists():
                temporary.unlink()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--write', action='store_true'); mode.add_argument('--check', action='store_true')
    parser.add_argument('--strict', action='store_true'); parser.add_argument('--type'); parser.add_argument('--source')
    args = parser.parse_args()
    identity_path = DOCS / 'id-registry.json'
    try:
        existing = read(identity_path) if identity_path.exists() else None
        if existing is None:
            raise ValueError('Missing persisted identity registry; restore the identity seed instead of reallocating existing UUIDs')
        if existing is not None:
            errors = validate_schema(existing, {'$ref': '#/$defs/identity'}, read(OUT / 'catalog.schema.json'))
            if errors: raise ValueError('Invalid identity schema: ' + '; '.join(errors[:5]))
        if not (OUT / 'id-resolutions.json').is_file():
            raise ValueError('Missing authored id-resolutions.json; review decisions must not be silently reset')
        catalog, identity, mapping = build(existing=existing, allow_new_ids=args.write)
    except (ValueError, OSError) as error:
        print(dump({'error': {'code': 'unallocated-identity' if isinstance(error, UnallocatedIdentityError) else 'content-input-error', 'message': str(error)}}))
        return 1
    files = {identity_path: identity, DOCS / 'legacy-id-mapping.json': mapping, OUT / 'registry.json': catalog}
    integrity_errors = [i for i in catalog['issues'] if i['severity'] == 'error']
    if integrity_errors:
        print(dump({'integrityErrors': integrity_errors, 'artifactsWritten': False}))
        return 1
    if args.write:
        try:
            write_artifacts(files)
        except OSError as error:
            print(dump({'error': {'code': 'artifact-write-error', 'message': str(error)}, 'bundleMayBePartial': True}))
            return 1
    if args.check:
        mismatches = [path.relative_to(ROOT).as_posix() for path, value in files.items() if not path.exists() or path.read_bytes() != dump(value).encode('utf-8')]
        if mismatches: print(dump({'artifactMismatch': mismatches})); return 1
    summary = {'sources': len(catalog['sources']), 'entities': dict(collections.Counter(e['type'] for e in catalog['entities'])),
               'relationships': len(catalog['relationships']), 'issues': dict(collections.Counter(i['code'] for i in catalog['issues'])),
               'ambiguousGlobalAliases': sum(m['source'] is None and m['status'] == 'ambiguous' for m in mapping['mappings'])}
    print(dump(summary))
    if args.type or args.source: print(dump(query(catalog, kind=args.type, source=args.source)))
    return int(any(i['severity'] == 'error' for i in catalog['issues']) or (args.strict and bool(catalog['issues'])))

if __name__ == '__main__': raise SystemExit(main())
