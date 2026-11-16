"""Read-only reproducible offline benchmark; emits JSON only, never writes artifacts."""
from __future__ import annotations
import argparse
import copy
import datetime
import hashlib
import json
import pathlib
import platform
import statistics
import sys
import time
import tracemalloc

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))
from tools.content import catalog
from tools.content.reader import ContentReader


def measured(operation, repetitions=1):
    samples = []
    for _ in range(repetitions):
        started = time.perf_counter()
        operation()
        samples.append(time.perf_counter() - started)
    return {'repetitions': repetitions, 'median_seconds': statistics.median(samples),
            'min_seconds': min(samples), 'max_seconds': max(samples)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--skip-build', action='store_true')
    args = parser.parse_args()
    root = catalog.ROOT
    paths = [catalog.OUT / 'registry.json', catalog.DOCS / 'id-registry.json',
             catalog.DOCS / 'legacy-id-mapping.json']
    tracemalloc.start()
    registry = catalog.read(paths[0])
    registry_current, registry_peak = tracemalloc.get_traced_memory()
    tracemalloc.reset_peak()
    reader = ContentReader(registry)
    indexed_current, indexed_peak = tracemalloc.get_traced_memory()
    tracemalloc.reset_peak()
    sample = catalog.query(registry, kind='Flashcard', source='assets/data/teormin-cards.json')[0]
    canonical_id = sample['id']
    category = 'SourceCategory'
    reader.get_content(canonical_id)  # warm parsed source, hash still checked every call
    cached_current, cached_peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    output = {
        'environment': {'measuredAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                        'python': sys.version, 'platform': platform.platform(),
                        'processor': platform.processor(), 'clock': 'time.perf_counter',
                        'timingScope': 'local wall time, warm filesystem; not browser/network',
                        'memoryScope': 'tracemalloc Python allocations only, not RSS; separate from timings'},
        'counts': {'entities': len(registry['entities']), 'relationships': len(registry['relationships']),
                   'sources': len(registry['sources'])},
        'json_bytes': {str(p.relative_to(root)): p.stat().st_size for p in paths},
        'memory_bytes': {'registry_current': registry_current, 'registry_peak': registry_peak,
                         'registry_and_detached_reader_current': indexed_current,
                         'registry_and_detached_reader_peak': indexed_peak,
                         'with_one_parsed_source_current': cached_current,
                         'with_one_parsed_source_peak': cached_peak},
        'timings': {
            'read_registry': measured(lambda: catalog.read(paths[0]), 3),
            'id_scan_300': measured(lambda: [catalog.query(registry, canonical_id=canonical_id) for _ in range(300)], 3),
            'id_index_300': measured(lambda: [reader.query(canonical_id=canonical_id) for _ in range(300)], 3),
            'category_scan_10': measured(lambda: [catalog.query(registry, kind=category) for _ in range(10)], 3),
            'category_scan_copy_10': measured(lambda: [copy.deepcopy(catalog.query(registry, kind=category)) for _ in range(10)], 3),
            'category_index_10': measured(lambda: [reader.query(kind=category) for _ in range(10)], 3),
            'related_scan_100': measured(lambda: [[e for e in registry['relationships'] if e['from'] == canonical_id] for _ in range(100)], 3),
            'related_index_100': measured(lambda: [reader.related(canonical_id) for _ in range(100)], 3),
            'materialize_uncached_30': measured(lambda: [catalog.get_content(sample) for _ in range(30)], 3),
            'materialize_snapshot_30': measured(lambda: [reader.get_content(canonical_id) for _ in range(30)], 3),
        },
        'categoryMeaning': 'type=SourceCategory occurrences, not invented Subject/Course membership',
    }
    if not args.skip_build:
        identity = catalog.read(paths[1])
        hashes, times = [], []
        for _ in range(2):
            started = time.perf_counter()
            built = catalog.build(existing=copy.deepcopy(identity))
            times.append(time.perf_counter() - started)
            hashes.append([hashlib.sha256(catalog.dump(value).encode('utf-8')).hexdigest() for value in built])
        output['build'] = {'seconds': times, 'serialized_sha256': hashes,
                           'generated_counts': {'entities': len(built[0]['entities']),
                                                'relationships': len(built[0]['relationships'])},
                           'deterministic': hashes[0] == hashes[1],
                           'persisted_id_registry_used': True,
                           'memory': 'generation not traced; no generation RSS claim'}
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
