# URL compatibility contract — Phase 2

## Scope and observed baseline

This is a future routing contract and a read-only audit. Production paths, IDs, HTML, CSS and storage were not changed by Phase 2. The current `routes-manifest.json` records 190 physical HTML documents, their static IDs/named anchors and source-derived local/Pages paths. It is evidence for static routes, not proof of runtime redirects or every dynamically generated link. Its own assumptions remain binding.

The local Node server maps `/` to `/main.html`; it does not automatically serve arbitrary directory indexes (`server/server.js`). GitHub Pages uses the project base `/datalab/`, while `tools/build-pages.mjs` rewrites URL literals in the output copy and adds asset version queries. `command-palette.js` derives the deployment prefix from its own script URL and prefixes result links once. `firebase-mock.js::normalizeSiteUrl` handles root-relative URLs and trailing directory indexes; the Pages prefix in those literals is normally supplied by the builder. These are different mechanisms, not one interchangeable URL resolver.

## Durable route record

Canonical content identity and public location are separate. Keep a base-neutral leading-slash `path`, exact decoded DOM `fragment` where applicable, source provenance and status. A future adapter renders the pathname with a deployment base exactly once. For example `/python/base.html` plus `special_characters` renders `/python/base.html#special_characters` locally and `/datalab/python/base.html#special_characters` on Pages. Neither URL becomes a storage key or canonical ID. Language prefix `/en/`, extension, case and spelling such as `/practise/` and `/calender/` are part of historical paths; do not silently correct them.

Store exact source attributes alongside parsed route metadata when needed. Decode percent escapes only as a controlled lookup step, never repeatedly; preserve Unicode spelling/case, encoded reserved separators, queries and fragments. Reject traversal, network-path references and unsupported protocols in the internal-route adapter. Do not treat query strings as identity merely because deployment adds `?pages=...`; retain existing query behavior, including documented hash/query combinations, during navigation. External URLs stay external. Do not infer same-origin aliases from hostname similarity.

A route can point to a whole document or an anchored Section/Exercise. Several objects may be rendered in a document; owning a page does not imply an executable lesson or a one-to-one match between page, subject and course. A missing or ambiguous destination returns an explicit status and candidate set, not a guessed first match. Historical directory URLs are explicit deployment-specific aliases, not automatically canonical routes.

## Representative source evidence

| Object / source | Exact public path or anchor | Relationship that is justified |
|---|---|---|
| Python theory, `site/python/base.html` | `/python/base.html#special_characters` | DOM `.name` ID `special_characters`; document embeds quiz `python:basics` |
| Large technical document, `site/ai/ml/dl.html` | `/ai/ml/dl.html#encoder-only` | DOM ID `encoder-only`; `data-md-id="encoder_only"` is a distinct source identifier |
| Python task, `site/practise/python/base.html` | `/practise/python/base.html#filter_positive_even` | Same task node carries `data-tests`; it belongs to that practice document |
| Mathematics theory, `site/math/algebra.html` | `/math/algebra.html` | Document embeds quiz `math:algebra`; individual topics retain their actual anchors |
| Mathematics task, `site/practise/math.html` | `/practise/math.html#algebra-vectors` | Inline `data-answers.page` is `practise/math.html`, fields `sum` and `combo` |
| Flashcard `supervised_learning__1` | `/ai/ml/classic.html#supervised_learning` | `targetPage`, `questionId` and `href` agree in `assets/data/teormin-cards.json` |
| Quiz `python:basics` | Embedded at `/python/base.html` | Registry file `python-base.json` and document `data-quiz-id` agree; no individual quiz-question URL is promised |

A textually similar theory topic and exercise are not linked automatically. The page-level quiz relation does not map every quiz item to every theory Section. MD source IDs must not replace real DOM anchors or progress IDs. For the DL example both spellings can be inventoried, but alias equivalence needs explicit evidence.

## Future routing implementation requirements

1. Freeze the current exact route/fragment list as an acceptance fixture before each migration slice; compare the source inventory after each change. New routes are additions. Deleted routes require an approved retained compatibility document or explicit mapping; archive content objects without reclaiming IDs.
2. Produce the same legacy `.html` output filenames through a future SSG adapter. If a new preferred path is introduced later, continue serving the historical file. On static hosting a compatibility HTML document can carry a link and client redirect; keep the fragment and query intact and test with JavaScript disabled. Do not promise configurable HTTP 301 rules from a static artifact.
3. Preserve the historical DOM IDs on the rendered elements, including named anchors. If a heading changes, its old anchor remains an explicit alias element. A title-derived slug is not a replacement. Dynamic selectors and progress bindings must still resolve the original ID.
4. Resolve search, navbar, flashcard, quiz launch, roadmap and lesson links through the same route adapter in a future integration. Until then existing controllers remain untouched; centralization is a proposal, not current behavior.
5. Test both `/` and `/datalab/` deployments, plus nested and `/en/` paths. Assert no `/datalab/datalab/`, no dropped fragments, no asset prefix doubling, real anchor presence and retained relative resources. Test keyboard/new-tab navigation and direct entry to an old URL.
6. Run built-artifact checks as well as source inventory. URL literals synthesized by JS, absolute same-host links, redirects, asynchronous anchors and external systems need browser/manual coverage beyond the static manifest.

## Phase 2 acceptance and limits

The prototype catalog must retain all physical source routes and exact source anchors as metadata and provide lookup without changing production. Alias lookup is contextual: legacy ID alone can be ambiguous across documents or object types. Its validator must reject a nonexistent document/anchor and duplicate route ownership within the same object namespace, while permitting distinct content fragments in one document.

Prototype validation is not a claim that all pre-existing site links work. Known baseline broken icons and directory behavior are documented in earlier reports. Routes are source observations; runtime-only routes/IDs, all possible external backlinks and browser-generated anchors cannot be exhaustively reconstructed statically. Future SSG integration must re-run actual built-route/browser acceptance before replacing any production page.

### Independent source cross-check

A separate Phase 2 read-only script rebuilt the catalog in memory and independently parsed every current HTML file with Python `HTMLParser`. It compared each document's multiset of exact `id` attributes to `Section` entities' `html-anchor` bindings: **190 documents, 2693 ID occurrences, zero missing documents or anchor-count mismatches**, and zero catalog-validator errors at that run. Scoped `topic-id` lookup resolved `special_characters`, `encoder-only`, `filter_positive_even` and `algebra-vectors` in their exact source documents. A separate scan found zero current `<a name>` anchors without an `id`; named-anchor parser support is future robustness. This verifies source metadata coverage; it does not execute navigation or prove all destinations work in a deployed artifact.
