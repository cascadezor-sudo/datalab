"""Optional build-time indexes over the existing registry, never a second catalog.

Reader owns a detached snapshot; all returned values are caller-owned copies.
Source bytes are checked against snapshot SHA256 on every materialization. A
changed or missing source requires a fresh catalog, never silent stale content.
"""
from __future__ import annotations
import copy
import hashlib
import json
from collections import defaultdict
from tools.content import catalog


class SourceUnavailableError(ValueError):
    """Source is missing, outside site, or no longer matches the snapshot."""


class ContentReader:
    def __init__(self, registry, root=catalog.ROOT):
        self._root = root
        self._registry = copy.deepcopy(registry)
        self._ids = {}
        self._kinds, self._sources = defaultdict(list), defaultdict(list)
        self._outgoing, self._incoming = defaultdict(list), defaultdict(list)
        self._fingerprints = {s['path']: s['sha256'] for s in self._registry['sources']}
        self._parsed = {}
        for entity in self._registry['entities']:
            if entity['id'] in self._ids:
                raise ValueError('Duplicate canonical ID')
            self._ids[entity['id']] = entity
            self._kinds[entity['type']].append(entity)
            self._sources[entity['source']['path']].append(entity)
        for edge in self._registry['relationships']:
            self._outgoing[edge['from']].append(edge)
            self._incoming[edge['to']].append(edge)

    def query(self, *, kind=None, source=None, canonical_id=None):
        if canonical_id is not None:
            entity = self._ids.get(canonical_id)
            candidates = [entity] if entity else []
        elif source is not None:
            candidates = self._sources.get(source, ())
        elif kind is not None:
            candidates = self._kinds.get(kind, ())
        else:
            candidates = self._registry['entities']
        return copy.deepcopy([e for e in candidates
                              if (kind is None or e['type'] == kind)
                              and (source is None or e['source']['path'] == source)])

    def related(self, canonical_id, *, direction='outgoing', relation=None):
        """Return observed edges, retaining multiplicity/evidence and catalog order."""
        if direction not in ('outgoing', 'incoming'):
            raise ValueError('Unknown relationship direction')
        edges = (self._outgoing if direction == 'outgoing' else self._incoming).get(canonical_id, ())
        return copy.deepcopy([e for e in edges if relation is None or e['type'] == relation])

    def get_content(self, canonical_id):
        entity = self._ids.get(canonical_id)
        if entity is None:
            raise KeyError(canonical_id)
        relative = entity['source']['path']
        site = (self._root / 'site').resolve()
        path = (site / relative).resolve()
        if not path.is_relative_to(site):
            raise SourceUnavailableError('Source outside site')
        try:
            raw = path.read_bytes()
        except OSError as error:
            raise SourceUnavailableError('Source missing or unreadable: ' + relative) from error
        if hashlib.sha256(raw).hexdigest() != self._fingerprints.get(relative):
            raise SourceUnavailableError('Source changed since catalog snapshot: ' + relative)
        if relative not in self._parsed:
            text = raw.decode('utf-8-sig')
            self._parsed[relative] = json.loads(text) if path.suffix == '.json' else text
        content = self._parsed[relative]
        if path.suffix == '.json':
            return copy.deepcopy(catalog.materialize_json(content, entity['source']['pointer']))
        return {'format': 'legacy-html' if path.suffix == '.html' else 'javascript',
                'sourceLocator': entity['source']['pointer'], 'content': content}
