# Future frontend contract — Phase 2

Phase 3 update: the concrete, authoritative shipped reader, resolution and route APIs are specified in [content-platform-contract.md](content-platform-contract.md). The illustrative interface below remains a future design sketch. Indexed SHA-verified reading now exists as an optional build-time adapter; production integration remains absent.

## Decision and boundaries

Adopt a framework-neutral, read-only content catalog as the boundary between educational sources and future UI. Astro is the planned static route/document renderer, React is an option for selected interactive widgets, and MDX is an opt-in authoring format. This document specifies an intended contract, not installed framework APIs or a migration implementation. No Astro/React/MDX dependencies, production integrations, styling or storage changes belong to Phase 2.

Existing HTML remains a valid source format, particularly for large technical documents, code, math, tables and bespoke exercises. JSON continues to carry structured questions, quiz definitions, flashcards, routes and achievements. Markdown is appropriate where a plain authored document is sufficient; MDX is appropriate only where a reviewed interactive block actually needs components. A filename extension is not a domain type and does not create a Course or Lesson.

## Data boundaries

The build adapter reads the prototype's validated entities, evidence-bearing relations, ID registry, legacy mapping and route observations. It exposes immutable serializable DTOs to any renderer. No DOM node, React element, Astro component, browser global, localStorage handle, UID, progress snapshot or IndexedDB record belongs in content data.

Required logical query capabilities are lookup by canonical ID, list by entity type, resolve legacy reference with namespace/source context, enumerate outgoing/incoming evidence-bearing relations and retrieve route/body descriptors. The Phase 2 prototype implements a subset through its actual query module; consumer code must use its published exports rather than assuming the illustrative names below exist. Missing entities and ambiguous aliases are explicit results. Empty relation lists mean no confirmed relation, not evidence that the course has no exercises.

A body descriptor contains an allowed format (`legacy-html`, `json`, and optional future `markdown`/`mdx`), source reference and optional precise fragment/extraction locator. It must distinguish an existing independently addressable item from a future reusable ContentBlock. Rendering a whole legacy HTML page inside another page is not a validated block extraction strategy. The adapter records evidence and leaves unsupported extraction as an explicit legacy-renderer boundary.

Stable canonical IDs do not depend on heading text, sidebar order, frontend component name or deployment path. Once allocated they persist through title edits and tombstones. A source-path/locator rename requires an explicit reviewed `rebind` in the persisted identity registry; automatic source discovery alone does not preserve identity across renames. Rebind retains canonical identity and historical aliases, while rejecting an occupied destination. Namespaced legacy references remain intact, including MD IDs, DOM anchors, quiz item IDs, exercise IDs and card IDs. Do not interpret raw IDs from different namespaces as interchangeable. A read-only bridge may attach canonical references to views of old progress; it must not rewrite real persisted keys or delete unknown fields.

## Intended logical interface (framework-independent)

```ts
// Specification sketch, not a claim that these functions are shipped APIs.
type Resolution =
  | { status: "resolved"; canonicalId: string }
  | { status: "ambiguous"; candidates: readonly string[] }
  | { status: "unresolved"; reason: string };
type RouteRef = { path: string; fragment?: string; locale?: string };
type Evidence = { source: string; locator: string; kind: string };
type Relation = { from: string; type: string; to: string; evidence: readonly Evidence[] };
interface ContentReader {
  get(id: string): Readonly<unknown> | undefined;
  list(type: string): readonly Readonly<unknown>[];
  related(id: string, relation: string): readonly Relation[];
  resolveLegacy(namespace: string, value: string, source?: string): Resolution;
}
```

The concrete prototype currently exposes Python `query(catalog, *, kind=None, source=None, canonical_id=None)` in `tools/content/catalog.py`. Its plain entity shape is `{id, type, title, sourceKey, source: {path, pointer}, legacyIds: [{namespace, value}], metadata}`; observed relationships carry `{from, to, type, evidence: {path, pointer}, status}`. `LegacyPage.metadata.localUrl/pagesUrl` are observations; `Section` uses the exact `html-anchor` binding. The source `pointer` is a catalog locator, not universally an RFC 6901 JSON Pointer. The read-only `get_content(entity, root=ROOT)` accessor resolves a source under `site/` and rejects missing/outside sources. For JSON it returns the actual source node, resolving ID-plus-occurrence array locator tokens; for HTML and JS it returns `{format, sourceLocator, content}` with the **whole source text**, not an extracted DOM fragment or executable component. A future renderer must explicitly extract/render the intended fragment; the current accessor must not be inserted once per Section into a document. Bulk consumers need a scoped read cache/index rather than repeatedly loading the same large source; this is an integration requirement, not a current reader performance guarantee. No browser-side client bundle is supplied in this phase.

A concrete schema/query module is authoritative for actual fields. Future TypeScript types may be derived from that schema or checked against shared fixtures; introducing another manually divergent entity definition is prohibited. Content validation runs before page generation. Orphans, unsupported fields, duplicate IDs, broken confirmed relations, ambiguous aliases and semantic cycles are reported with provenance. Pre-existing content gaps are diagnosed explicitly and must not be concealed by fabricated links.

## Rendering and routes

The future SSG adapter enumerates validated legacy document routes, then renders their exact `.html` paths and actual anchors. It combines the configured deployment base with a base-neutral route once. `/datalab/` is deployment configuration, not an entity-ID prefix. `url-compatibility.md` defines the acceptance requirements for direct links, search, nested routes, locale, percent encoding and retained queries/fragments.

Static HTML generation is the default target for GitHub Pages. A frontend need not add a production server merely to read a versioned catalog. SSR or dynamic API routes require a separate hosting/backend decision and are not part of this plan. The existing optional local Python checker is a capability exposed by the local server; it cannot be assumed to exist on static Pages. A future exercise UI must reflect the available execution capability and preserve the current request/auth contracts until explicitly replaced.

Astro consumes route metadata and body descriptors at build time. Static theory should ship readable content and links without requiring React. A separate legacy template keeps complex HTML usable until a reviewed extraction slice can preserve math, code, assets, controls and anchors. Do not render the same source document twice with duplicate DOM IDs. Serialization of authored HTML/MDX requires a reviewed trust policy; catalog presence alone is not sanitization, and MDX must not become a remote arbitrary-code channel.

React widgets receive only the minimal content descriptors and explicit application services needed for quizzes, exercise editing, repetition or progress controls. Widget state is transient UI state; durable writes go through the existing storage/auth facade after readiness, and successful UI feedback follows committed operations. Widgets do not directly read/write native localStorage, open the IndexedDB schema, duplicate database trees or implement a second persistence layer. Recovery and unknown historical data remain owned by the existing storage service.

A future app adapter translates the old typed commands (`questionId`, quiz ID, page-scoped exercise/draft IDs, card ID) at the boundary; it never substitutes a new canonical ID where an existing storage method expects a legacy ID. Export/recovery remains independent of the content renderer. Unmapped historical progress stays visible in recovery/diagnostics and is preserved; absent catalog content is not permission to delete progress.

## Representative consumption experiment

| Existing material | Future reading/rendering boundary | Relation limitations |
|---|---|---|
| Python theory `special_characters` | Legacy HTML fragment at `python/base.html`, original DOM anchor | Page embeds `python:basics`; individual quiz item coverage is not inferred |
| Large DL document | Legacy HTML document/actual anchored Sections, unchanged asset paths | `data-md-id="encoder_only"` differs from `id="encoder-only"` |
| Python `filter_positive_even` | Exercise descriptor with HTML source and inline `data-tests` provenance | Execution capability/local API is separate from lesson content |
| Math `algebra-vectors` | Typed answer field descriptor from `data-answers`; legacy HTML retains math | `page` and field IDs are contextual; no automatic title-based theory mapping |
| Quiz `python:basics` | JSON definition and registry entry; items preserve their own IDs | Quiz item IDs are not theory topic IDs |
| Card `supervised_learning__1` | JSON prompt/answer plus exact target and historical card ID | Direct `questionId`/`href` evidence links card to the theory topic |

The prototype experiment establishes catalog identity/lookup/evidence compatibility only. It does not instantiate Astro routes, hydrate React, compile MDX or prove all legacy scripts can share a new renderer. Those claims require a later migration slice.

## Integration acceptance gates for a later phase

- Freeze canonical ID allocation and existing URL/anchor fixtures. Confirm generated output contains every preserved route and anchor under local and Pages bases.
- Choose one small source slice, validate its actual registry lookups and explicit relations, and compare readable content/code/math before and after rendering.
- Run the existing storage, migration, backup/restore and real multitab tests unchanged in intent. Verify existing legacy progress/drafts bind to the same objects with synthetic data.
- Test keyboard navigation, mobile overflow, focus, search result links, quiz completion, exercise result/code association and flashcard grading for that slice. Do not infer accessibility from a framework choice.
- Preserve the legacy renderer and original sources until accepted. Rollback concerns both code and data: old assets cannot read new IndexedDB progress through frozen native JSON; follow the existing recovery plan rather than invent a reverse migration.

This phase supplies content contracts and a detached prototype. It neither authorizes replacing production routes nor claims improved usability from a framework change alone.
