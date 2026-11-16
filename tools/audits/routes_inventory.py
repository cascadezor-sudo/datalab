import argparse
import json
import posixpath
import re
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[2]
SITE = ROOT / 'site'
BASE = '/datalab/'

class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.refs, self.title_parts = [], [], []
        self.in_title = False
        self.in_style = False
        self.inline_scripts = 0
        self.handlers = 0
        self.evidence_counts = {'question_class_elements': 0, 'data_tests_attributes': 0, 'data_answers_attributes': 0}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if 'question' in (a.get('class') or '').split(): self.evidence_counts['question_class_elements'] += 1
        for attr in ('data-tests', 'data-answers'):
            if attr in a: self.evidence_counts[attr.replace('-', '_') + '_attributes'] += 1
        if a.get('id'): self.ids.append(a['id'])
        if tag == 'a' and a.get('name'): self.ids.append(a['name'])
        if tag == 'title': self.in_title = True
        if tag == 'style': self.in_style = True
        if a.get('style'): self.refs.extend(css_refs(a['style']))
        if tag == 'script' and not a.get('src'): self.inline_scripts += 1
        self.handlers += sum(1 for k, v in attrs if k.startswith('on') and v)
        keys = {'a': ('href',), 'area': ('href',), 'link': ('href',), 'script': ('src',),
                'img': ('src', 'srcset'), 'source': ('src', 'srcset'), 'video': ('src', 'poster'),
                'audio': ('src',), 'iframe': ('src',), 'embed': ('src',), 'object': ('data',),
                'form': ('action',), 'input': ('src',)}.get(tag, ())
        for key in keys:
            if a.get(key):
                vals = parse_srcset(a[key]) if key == 'srcset' else [a[key]]
                for value in vals:
                    kind = 'link' if tag in ('a', 'area', 'form') else 'asset'
                    self.refs.append({'tag': tag, 'attribute': key, 'kind': kind, 'url': clean(value)})

    def handle_startendtag(self, tag, attrs): self.handle_starttag(tag, attrs)
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        if tag == 'style': self.in_style = False
    def handle_data(self, data):
        if self.in_title: self.title_parts.append(data)
        if self.in_style: self.refs.extend(css_refs(data))

def parse_srcset(value):
    # Data URLs may contain commas. Consume them through the descriptor boundary.
    return [m.group(1) for m in re.finditer(r'(?:^|,\s*)(data:[^\s]+|[^,\s]+)(?:\s+[^,]*)?', value, flags=re.I)]

def css_refs(content):
    refs = []
    pattern = r'''url\(\s*(["']?)(.*?)\1\s*\)|@import\s+(["'])(.*?)\3'''
    for m in re.finditer(pattern, content, flags=re.I):
        raw = m.group(2) if m.group(2) is not None else m.group(4)
        if not raw: continue
        refs.append({'tag': 'css', 'attribute': 'url', 'kind': 'asset', 'url': clean(raw), 'quoted': bool(m.group(1) or m.group(3))})
    return refs

def clean(value):
    # Never record query values; preserve static path and fragment only.
    parts = urlsplit(value.strip())
    if parts.scheme or parts.netloc:
        return '[external:' + (parts.scheme.lower() or 'protocol-relative') + ']'
    return parts.path + ('#' + parts.fragment if parts.fragment else '')

def resolve(source, url, mode, rewrite_root=True):
    parts = urlsplit(url)
    if parts.scheme or parts.netloc or not url or url.startswith('[external:'): return None
    raw = parts.path
    # build-pages rewrites root-relative literals in quoted HTML attributes.
    if mode == 'pages' and rewrite_root and raw.startswith('/') and not raw.startswith('//'):
        raw = BASE.rstrip('/') + raw
    current = ('/' if mode == 'local' else BASE) + source
    path = posixpath.normpath(posixpath.join(posixpath.dirname(current), raw)) if raw else current
    if raw.endswith('/') and not path.endswith('/'): path += '/'
    if mode == 'pages':
        if not path.startswith(BASE): return ('outside_base', path, parts.fragment)
        rel = path[len(BASE):]
        if not rel or rel.endswith('/'): rel += 'index.html'
    else:
        if path == '/': rel = 'main.html'
        elif path.endswith('/'): return ('directory_not_served', path, parts.fragment)
        else: rel = path.lstrip('/')
    return ('target', unquote(rel), unquote(parts.fragment))

def audit(site=SITE, pages_artifact=False):
    files = sorted(p for p in site.rglob('*') if p.is_file())
    names = {p.relative_to(site).as_posix() for p in files}
    pages, parsed = [], {}
    for filename in sorted(n for n in names if n.lower().endswith('.html')):
        raw = (site / filename).read_text(encoding='utf-8', errors='replace')
        p = Page(); p.feed(raw); parsed[filename] = p
        # Follow local stylesheet links and imports; record provenance for each URL.
        css_queue = [(filename, r['url']) for r in p.refs if r['tag'] == 'link' and urlsplit(r['url']).path.lower().endswith('.css')]
        seen_css = set()
        while css_queue:
            origin, url = css_queue.pop(0)
            target = resolve(origin, url, 'pages' if pages_artifact else 'local', not pages_artifact)
            if not target or target[0] != 'target' or target[1] not in names or target[1] in seen_css: continue
            css = target[1]; seen_css.add(css)
            for ref in css_refs((site / css).read_text(encoding='utf-8', errors='replace')):
                ref['origin'] = css
                p.refs.append(ref)
                if urlsplit(ref['url']).path.lower().endswith('.css'): css_queue.append((css, ref['url']))
        scripts = [r['url'] for r in p.refs if r['tag'] == 'script']
        progress_controllers = [src for src in scripts if re.search(r'(?i)(progress|completion)', src)]
        practice_controllers = [src for src in scripts if re.search(r'(?i)(quiz|exercise|practice|practise|test)', src)]
        # Use a secondary key: distinct spellings that case-fold equally must
        # not inherit the randomized iteration order of a Python set.
        token_order = lambda token: (token.casefold(), token)
        progress = sorted(set(re.findall(r'(?i)\b(?:localStorage|sessionStorage|indexedDB|progress|completion|completed)\b', raw)), key=token_order)
        practice = sorted(set(re.findall(r'(?i)\b(?:quiz|exercise|practice|practise|pyodide|test)\b', raw)), key=token_order)
        pages.append({'source': 'site/' + filename, 'local_url': '/' + filename, 'pages_url': BASE + filename,
            'title': ' '.join(''.join(p.title_parts).split()), 'anchors': sorted(set(p.ids)),
            'references': p.refs, 'javascript_evidence': {'script_srcs': scripts, 'inline_script_count': p.inline_scripts, 'inline_event_handler_count': p.handlers},
            'progress_evidence': {'tokens': progress, 'controller_script_refs_by_name': progress_controllers}, 'practice_evidence': {'tokens': practice, 'controller_script_refs_by_name': practice_controllers, 'static_element_counts': p.evidence_counts}})
    findings = []
    modes = ('pages',) if pages_artifact else ('local', 'pages')
    for mode in modes:
        routes = {}
        for page in pages:
            route = page[mode + '_url']
            routes.setdefault(route, []).append(page['source'])
        for route, sources in routes.items():
            if len(sources) > 1:
                findings.append({'type': 'duplicate_route', 'mode': mode, 'route': route, 'sources': sources})
    for page in pages:
        source = page['source'][5:]; p = parsed[source]
        for anchor, count in Counter(p.ids).items():
            if count > 1: findings.append({'type': 'duplicate_anchor', 'source': source, 'anchor': anchor, 'count': count})
        for ref in p.refs:
            for mode in modes:
                target = resolve(ref.get('origin', source), ref['url'], mode, False if pages_artifact else ref.get('quoted', True))
                if target is None: continue
                state, path, fragment = target
                problem = None
                if state != 'target': problem = state
                elif mode == 'pages' and path + '/index.html' in names: pass  # Pages redirects directory URLs to trailing slash.
                elif path not in names: problem = 'missing_asset' if ref['kind'] == 'asset' else 'broken_link'
                elif fragment and path in parsed and fragment not in parsed[path].ids: problem = 'missing_anchor'
                if problem:
                    findings.append({'type': problem, 'mode': mode, 'source': source, 'reference': ref['url'], 'origin': ref.get('origin', source), 'resolved': path})
    result = {'schema_version': 2, 'scope': 'Static HTML attributes and source-text evidence only. Referenced stylesheets and imports are scanned with a conservative URL pattern; no JavaScript execution, network requests or user storage inspection. Query strings omitted.',
        'assumptions': {'local': 'Node server: / maps to main.html; directory paths are not served.', 'pages': 'Project base /datalab/; root-relative HTML attribute URLs modeled after build-pages.mjs; directories map to index.html.', 'evidence': 'Tokens, element counts and controller script references identified by filename are static evidence only; empty results do not mean absence, and none establish runtime behavior or complete dependencies.', 'external': 'All absolute and protocol-relative URLs, including same-site hostnames, are excluded from validation and redacted; host equivalence is not inferred.', 'srcset': 'Static candidates only; complex data URI forms may need manual review.', 'css': 'CSS url() and quoted @import are heuristic; dynamically generated CSS, escaped syntax and conditional loading are not evaluated. Unquoted root URLs are not rewritten by the Pages build.', 'anchors': 'Static id and named-anchor attributes only; dynamically created anchors are not checked.', 'routes': 'Duplicate checks cover canonical source-derived URLs; index aliases are implicit and runtime redirects are not verified.'},
        'pages': pages, 'findings': findings, 'finding_counts': dict(sorted(Counter(f['type'] + ':' + f.get('mode', 'both') for f in findings).items()))}
    if pages_artifact:
        result['assumptions']['pages'] = 'Built artifact URLs checked as written at /datalab/; no hypothetical URL rewrite. Directories map to index.html.'
        result['assumptions']['local'] = 'Not evaluated in artifact mode.'
        result['assumptions']['css'] += ' In artifact mode all URLs are checked as written.'
    return result

def main():
    parser = argparse.ArgumentParser(description='Read-only static route audit; write manifest only with --output.')
    parser.add_argument('--output', type=Path, help='Explicit destination for the JSON manifest.')
    parser.add_argument('--site', type=Path, help='Site root to inspect; defaults to the source site.')
    parser.add_argument('--pages-artifact', action='store_true', help='Validate an existing --site directory as a built /datalab/ artifact; no rewriting and no local-mode checks.')
    parser.add_argument('--strict', action='store_true', help='Exit 1 if static findings are reported.')
    args = parser.parse_args()
    if args.pages_artifact and args.site is None: parser.error('--pages-artifact requires an explicit --site directory')
    site = args.site or SITE
    if not site.is_dir(): parser.error('--site must be an existing directory')
    result = audit(site, pages_artifact=args.pages_artifact)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'pages': len(result['pages']), 'finding_counts': result['finding_counts']}, ensure_ascii=False, indent=2))
    if args.strict and result['findings']: raise SystemExit(1)

if __name__ == '__main__': main()
