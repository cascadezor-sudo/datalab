# Content catalog performance — Phase 3

The registry remains an offline build/QA artifact. No catalog is loaded by the
production site. No storage, HTML, routes, frameworks or dependencies changed.
Measurements below describe this machine and Python implementation, not a browser
budget, network transfer, production throughput or projected frontend performance.

## Reproduction and measurement contract

Run `python tools/content/catalog.py --check` before benchmarking. This checks the
persisted UUID-backed artifacts without writing. Then run
`python tools/content/benchmark.py`. The benchmark emits JSON to stdout and never
generates or writes artifacts. `--skip-build` omits the two generation runs.
`content-performance-measurements.json` records a real run with the full Python
version, OS, CPU identifier and exact sizes. Timings use `time.perf_counter`, three
samples for each read/query/materialization workload and two whole builds.
Filesystem cache is warm; no cold-cache claim is made. Workload counts are in the
metric names. Generation timing includes the identity input copy, extraction and validation but excludes
serialization, which is measured only for deterministic SHA256 comparison.

Memory is separately measured with `tracemalloc`: live and peak Python allocations
while loading a registry, constructing the detached reader and caching one actual
large JSON source. These are not RSS, OS peak working set, browser memory or
generation memory. They intentionally include the original registry and its reader
snapshot simultaneously. Parsed-source cache growth beyond one source is not
estimated: it depends on the sources actually materialized in a reader lifetime.

## Measured reason for the optional reader

The initial unchanged baseline passed `catalog.py --check`: 408 sources, 26,955
entities and 54,181 relationships. A direct preliminary measurement of the first
runtime Flashcard gave 1.537 seconds for 30 `get_content` calls and 0.318 seconds
for 300 canonical-ID scans. Every existing accessor call read and parsed the same
large JSON file. This actual repeated work justifies a small optional adapter;
it does not justify partitioning files or introducing infrastructure.

`tools/content/reader.py` indexes the existing registry by ID, entity type and
source, and observed incoming/outgoing edges. It does not create a second domain
model, invent memberships or infer semantic links. The category benchmark means
`type=SourceCategory`, whose occurrences already exist in the registry. Actual
membership is obtained from existing evidence-bearing relationships.

The reader owns a detached snapshot and returns caller-owned DTO copies. Unknown
queries yield an empty list; materializing an unknown ID raises `KeyError`.
Missing, unreadable, escaped or changed sources raise `SourceUnavailableError`
(a `ValueError` subclass). Exact raw source SHA256 is checked on every access,
including cache hits. Same-length source edits are rejected too. A stale catalog
must be explicitly rebuilt and a new reader constructed; cached old content is
never silently served. JSON locator handling is the same function used by the
existing safe `catalog.get_content`; occurrence disambiguation is unchanged.

The lazy parsed-source cache lives only as long as its reader. Releasing the
reader releases its snapshot/index/cache. A build should scope it to the build or
projection job. There is no global cache, persistent cache, watcher or production
integration. Returning DTO copies has a real cost: a broad category query may be
slower than the old function returning mutable references. ID/edge lookup and
repeated source parsing are the targeted improvements, not every workload.
The benchmark also records a scan followed by the same DTO copying, to separate
indexing cost from the cost of protecting returned objects against mutation.

## Determinism and limitations

Both generation runs receive separate deep copies of the same persisted identity
registry. SHA256 is calculated over the canonical existing `catalog.dump` output
for catalog, identity and mapping. Equality tests serialized byte content, not
only object counts; UUIDs are never intentionally regenerated for the benchmark.
Artifact checking separately compares current outputs with persisted files.

The current full catalog/provenance/mapping files should not be shipped to a
browser. A future build can emit minimal route/widget DTOs, but this phase adds no
speculative sharding or competing public format. Scaling beyond the observed
tens of thousands of entities requires fresh measurements with real content.

Reader regression tests cover detached inputs/outputs, duplicate-ID occurrence
selection, stale/missing sources after warmup, unknown IDs/types, relationship
direction/filtering and traversal rejection. They never touch browser storage.
