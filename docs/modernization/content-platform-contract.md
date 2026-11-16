# Content platform contract — Phase 3

This is the read-only build boundary for a future Astro static renderer and selected React widgets. The shipped implementation is Python/Node tooling outside `site/`; Astro, React, MDX, browser content clients and a replacement renderer are not installed. The existing registry remains the sole catalog. No production HTML, CSS, public URL, storage key or database schema is changed by this contract.

## Authoritative data and shipped interfaces

`content/prototype/catalog.schema.json` defines `$defs.catalog`, `$defs.identity`, `$defs.mapping` and `$defs.resolutions`. Its `entity` and `relationship` definitions govern entity fields and observed edges; frontend types must be generated from, or validated against, those definitions and shared fixtures. A manual divergent TypeScript catalog is not a second authority. `schemaVersion` is checked before consumption; an unsupported version blocks generation.

An entity is a plain serializable `{id, type, title, sourceKey, source:{path,pointer}, legacyIds:[{namespace,value}], metadata}`. The actual type enum includes `LegacyPage`, `Section`, `ContentBlock`, `Exercise`, `Quiz`, `Question`, `Flashcard`, `Achievement`, `LearningPath`, `Milestone`, `PathTrack`, source/category/index/navigation/configuration types. The schema is the complete enum. `Subject`, `Course`, `Module` and `Lesson` have no independently confirmed records and are not inferred from directories. Canonical IDs identify source occurrences, independently from URL and user-state keys.

`source.pointer` is a source locator, not universally an RFC 6901 pointer: HTML uses `line:N`, while JSON arrays may use ID-plus-occurrence tokens. Relationships retain `{from,to,type,evidence:{path,pointer},status}`. Empty relationship results mean no observed confirmed relation; title similarity never creates a theory/exercise or translation link.

| Python build-time API | Result and failure behavior |
|---|---|
| `catalog.read(path)` | Parsed JSON; ordinary file/JSON errors propagate to the build boundary. |
| `catalog.validate(registry, identity, mapping)` | Structured issue list with code/severity and provenance. Any integrity error blocks output; known source warnings remain visible. |
| `catalog.query(registry, kind=None, source=None, canonical_id=None)` | Existing linear reference query; empty list for absent ID/type/source. |
| `ContentReader(registry, root=catalog.ROOT)` in `tools/content/reader.py` | Detached registry snapshot and scoped ID/type/source/edge indexes; duplicate canonical IDs raise `ValueError`. No global cache shared across builds. |
| `reader.query(*, kind=None, source=None, canonical_id=None)` | Caller-owned entity copies. Missing ID/type/source returns `[]`. |
| `reader.related(canonical_id, direction='outgoing', relation=None)` | Caller-owned observed edges in catalog order, retaining multiplicity; absent edges return `[]`; unsupported direction raises `ValueError`. |
| `reader.get_content(canonical_id)` | Actual JSON node or whole legacy source descriptor. Unknown ID raises `KeyError`; missing/outside/changed source raises `SourceUnavailableError`. Snapshot SHA-256 is verified before materialization, including cached parsed sources. |
| `resolution_rows(mapping, identity, decisions=None)` in `tools/content/resolution.py` | Lossless effective alias rows with observed status and optional explicit review. Invalid decision overlay raises `ValueError`; `validate_resolutions` supplies diagnostic strings. |
| `RouteAdapter(registry).records()` in `tools/content/routes.py` | Sorted current `{path,fragment,candidates}` records derived only from `LegacyPage` and exact `Section.html-anchor` bindings. |
| `adapter.resolve(url, source=None, deployment_base='/', future_base=None)` | Plain route result DTO described below. No browser APIs, redirect following or filesystem reads. |

These readers/adapters index or project the same registry; they do not extract a competing catalog. Validate before construction. A future JS build bridge must translate the concrete exceptions into serializable errors, for example `{status:'missing',code:'CONTENT_NOT_FOUND',canonicalId}` or `{status:'unsupported',code:'SOURCE_UNAVAILABLE',canonicalId}`; these bridge examples are a planned transport shape, not a shipped API. No Python exception object crosses into React props.

## Body loading and rendering

JSON materialization returns the actual source node with its existing legacy IDs. HTML returns `{format:'legacy-html',sourceLocator,content}` containing the **entire original document**, including for a Section lookup; JavaScript uses `format:'javascript'`. The locator does not promise an extracted reusable component. Rendering one whole source per Section would duplicate the document, DOM IDs, scripts and controls and is prohibited. A future legacy document renderer must preserve the whole document or implement an explicitly reviewed extraction slice, including math, code, assets, controls and anchors. Catalog presence does not sanitize HTML or authorize execution of arbitrary JS/MDX.

Astro reads validated sources, descriptors and route results at build time. It emits static readable HTML at the exact historical `.html` filenames. A public build projection can include only the required content, route and legacy bindings for a page. The full identity registry, all snapshots and large mapping files do not belong in browser bundles. Browser widgets receive plain JSON DTOs and explicit services; no Python paths, filesystem access, DOM nodes, React elements, user IDs or progress records enter catalog entities.

React is optional for interactive controls. It must use the existing storage facade after readiness and await committed operations. Its commands retain existing question/quiz/exercise/card/draft keys; a canonical catalog ID is additional lookup context, never an automatic replacement persistent key. It must not open IndexedDB, duplicate storage state or reinterpret the current page as the missing scope of a globally stored progress record. Unknown/historical progress stays preserved. Deprecated, orphaned, ambiguous and pending-review identity results require explicit UI handling and cannot grant completion or transfer attempts automatically. See `progress-compatibility.md` for actual keys and synthetic tests.

## Exact route DTO and deployment grammar

`resolve` accepts a URL plus explicit input deployment (`/` or `/datalab/`). `source`, when needed for relative/hash/query references, is an exact base-neutral current document path such as `/ai/ml/dl.html`. `future_base` defaults to the input deployment. The adapter strips the configured Pages prefix once, resolves relative dot segments within the site root, decodes path/fragment once for exact lookup, preserves case and locale prefixes, and renders the same `.html` path with the chosen future base once. `/practise/`, `/calender/` and `/en/` are preserved spellings. The returned `locale` is `en` for `/en/`, otherwise the current default `ru`; this is an observed path convention, not proof of translation equivalence.

```json
{
  "status": "resolved",
  "input": "../../python/base.html?pages=1#special_characters",
  "canonicalId": "<existing Section ID>",
  "path": "/python/base.html",
  "fragment": "special_characters",
  "query": "pages=1",
  "locale": "ru",
  "futureUrl": "/datalab/python/base.html?pages=1#special_characters"
}
```

The example uses `source='/ai/ml/dl.html'` and `future_base='/datalab/'`. Query bytes remain navigation data and are never entity identity. Original fragment spelling/encoding is retained in the generated URL; the decoded fragment selects the exact DOM anchor. A fragment resolves to the `Section` carrying that anchor, not an invented Lesson or its enclosing Exercise.

| Status | Meaning / additional DTO fields |
|---|---|
| `resolved` | One exact current target; `canonicalId,path,fragment,query,locale,futureUrl`. |
| `missing` | No exact document or anchor; `reason` is `document` or `anchor`, plus `path,fragment`. No guessed alias or first candidate. |
| `ambiguous` | More than one target for an exact route/anchor; `path,fragment,candidates`, no selected `canonicalId`. |
| `unsupported` | Outside the bounded internal URL grammar; explicit `reason`, optional `protocol`. Includes traversal above root, encoded path delimiters/dot segments/percent indirection, invalid UTF-8/escapes, backslashes, missing relative source, unsupported deployment and non-HTTP protocols. |
| `external` | Absolute HTTP(S) or network-path URL. Host equivalence is not inferred, including apparent same-site hostnames. |

An input `/datalab/python/base.html` in local mode is an exact local path and returns missing; it is not silently stripped. In Pages mode `/python/base.html` is outside the project deployment and returns unsupported. `/datalab/datalab/python/base.html` is not silently repaired. Encoded `/`, `\\`, `?`, `#`, `%` and NUL in a path are rejected before decoding. Ordinary literal `../` resolves only when it remains within the site root. A bare root/directory URL is unsupported here: local `/` → `main.html`, Pages directory indexes and historical redirect behavior are deployment-specific observations handled by the existing audit/server, not fabricated equivalent catalog routes. Historical `html-path` aliases retained after rebind are not evidence that an old physical URL is still served.

## Coverage, limitations and later acceptance

`tests/test_content_platform_routes.py` independently parses every physical HTML file and compares route/anchor multiplicity to adapter records, then checks `Legacy URL → canonical registry entity → same future URL` for local and Pages deployments. The current source inventory is **190 HTML documents and 2693 DOM ID/named-anchor occurrences**, all checked under both bases. Additional cases cover relative nested paths, EN, queries/fragments, encoding, traversal, missing destinations and injected duplicate-anchor ambiguity. No source URL is renamed.

This proves the adapter's current source route coverage, not that all pre-existing links work. `tools/audits/routes_inventory.py` separately checks actual source references and resource observations. The current baseline retains **18 findings**: 5 broken local links, 3 local directory-not-served cases, 5 missing assets local and 5 missing assets on Pages. This phase does not repair those production files or hide the findings to obtain a green strict audit.

Static literal links in HTML/JSON and bounded JS/CSS source patterns provide evidence only. Concatenated links, arbitrary template interpolation, runtime redirects, remote data, dynamically created anchors, external backlinks and host aliases cannot be exhaustively established by that scan. Navigation registry literals are catalog evidence; no general JavaScript evaluator is introduced. The build and isolated browser smoke checks must remain separate acceptance gates. A future renderer must compare built filenames/anchors/resources and test direct entry, relative resources, query/hash behavior and both bases in a browser before replacing a production slice.

GitHub Pages remains static hosting. No server/API is implied by a registry reader. The optional local Python exercise checker requires a separate capability and cannot be promised in Pages. A later migration needs one reviewed rendering slice and unchanged storage/multitab/recovery tests; Phase 3 does not itself prove shared-script compatibility under React hydration. New content formats or schema versions require explicit validation and compatibility decisions before adoption.
