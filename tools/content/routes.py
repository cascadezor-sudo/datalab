"""Read-only build-time URL adapter over existing catalog entities.

No redirect aliases, browser navigation, or filesystem reads are inferred.
"""
from collections import defaultdict
import re
from urllib.parse import quote, unquote, urlsplit


class RouteAdapter:
    def __init__(self, registry):
        self._routes = defaultdict(list)
        for entity in registry['entities']:
            path = '/' + entity['source']['path']
            if entity['type'] == 'LegacyPage':
                self._routes[(path, '')].append(entity['id'])
            elif entity['type'] == 'Section':
                for alias in entity['legacyIds']:
                    if alias['namespace'] == 'html-anchor':
                        self._routes[(path, alias['value'])].append(entity['id'])

    def records(self):
        """Deterministic base-neutral current routes, including duplicate anchors."""
        return [{'path': path, 'fragment': fragment, 'candidates': list(ids)}
                for (path, fragment), ids in sorted(self._routes.items())]

    def resolve(self, url, *, source=None, deployment_base='/', future_base=None):
        """Return a JSON DTO; source is a base-neutral current document path.

        deployment_base describes the input deployment. future_base defaults to
        that same deployment. Root/directory aliases are deliberately unsupported.
        """
        def fail(code, **details):
            return {'status': code, 'input': url, **details}
        if deployment_base not in ('/', '/datalab/') or future_base not in (None, '/', '/datalab/'):
            return fail('unsupported', reason='deployment-base')
        if not isinstance(url, str) or url != url.strip() or any(ord(c) < 32 for c in url) or '\\' in url:
            return fail('unsupported', reason='invalid-url')
        try:
            parsed = urlsplit(url)
        except ValueError:
            return fail('unsupported', reason='invalid-url')
        if parsed.scheme in ('http', 'https'):
            return fail('external', reason='absolute-url')
        if parsed.scheme:
            return fail('unsupported', reason='protocol', protocol=parsed.scheme)
        if parsed.netloc or url.startswith('//'):
            return fail('external', reason='network-path')
        if re.search(r'%(?![0-9a-fA-F]{2})', parsed.path + parsed.fragment):
            return fail('unsupported', reason='invalid-percent-encoding')
        # Decode once only; encoded delimiters/backslashes/percent/dot segments
        # are outside this adapter's bounded URL grammar, never normalized.
        if re.search(r'%(?:2f|5c|3f|23|25|00)', parsed.path, re.I):
            return fail('unsupported', reason='encoded-path-delimiter')
        try:
            path = unquote(parsed.path, errors='strict')
            fragment = unquote(parsed.fragment, errors='strict')
        except UnicodeError:
            return fail('unsupported', reason='invalid-utf8')
        if any(ord(c) < 32 for c in path + fragment) or '//' in path:
            return fail('unsupported', reason='invalid-path-or-fragment')
        if '%' in parsed.path and any(p in ('.', '..') for p in path.split('/')):
            return fail('unsupported', reason='encoded-dot-segment')
        if path.startswith('/'):
            if deployment_base != '/':
                if not path.startswith(deployment_base):
                    return fail('unsupported', reason='outside-deployment-base')
                path = '/' + path[len(deployment_base):]
        else:
            if not source or not source.startswith('/') or '?' in source or '#' in source or '\\' in source:
                return fail('unsupported', reason='relative-source-required')
            if any(part in ('.', '..') for part in source.split('/')):
                return fail('unsupported', reason='invalid-source')
            if (source, '') not in self._routes:
                return fail('unsupported', reason='unknown-source')
            path = source if not path else source.rsplit('/', 1)[0] + '/' + path
        parts = []
        for part in path.split('/'):
            if part == '..':
                if not parts:
                    return fail('unsupported', reason='path-traversal')
                parts.pop()
            elif part and part != '.':
                parts.append(part)
        path = '/' + '/'.join(parts)
        if path == '/' or parsed.path.endswith('/'):
            return fail('unsupported', reason='directory-alias-not-modeled')
        ids = self._routes.get((path, fragment), [])
        if not ids:
            return fail('missing', reason='anchor' if (path, '') in self._routes else 'document',
                        path=path, fragment=fragment)
        if len(ids) != 1:
            return fail('ambiguous', path=path, fragment=fragment, candidates=list(ids))
        base = future_base or deployment_base
        future = base.rstrip('/') + quote(path, safe='/')
        if '?' in url.split('#', 1)[0]:
            future += '?' + parsed.query
        if '#' in url:
            future += '#' + parsed.fragment
        return {'status': 'resolved', 'input': url, 'canonicalId': ids[0],
                'path': path, 'fragment': fragment, 'query': parsed.query,
                'locale': 'en' if path.startswith('/en/') else 'ru', 'futureUrl': future}
