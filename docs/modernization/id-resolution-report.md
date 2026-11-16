# ID Resolution & Progress Integrity — Phase 3

## Safety boundary and identity

This phase reads source content and synthetic records only. No IndexedDB, localStorage, production progress keys, user records or public URLs are read or migrated by the resolver. No production page imports it. Canonical identity remains the persisted `id-registry.json` binding; neither the current title nor the URL is an identity. Explicit `rebind` preserves the canonical ID, old binding key and historical source aliases. Retired identities must stay in the registry; their historical aliases become orphaned observations rather than disappearing or resolving to a new object.

The initial independent recount confirmed 53,682 mapping rows: 43,718 resolved observations, 9,964 ambiguous observations. The historical 9,371 figure counts only global ambiguous aliases; an additional 593 scoped rows are ambiguous. The initial registry contained 37,460 bindings (26,955 active and 10,505 retired). These are the pre-regeneration audit numbers; the Phase 3 report and validator output describe the final generated artifacts.

Ambiguity spans namespaces, not just translated topic IDs. Initial ambiguous rows by namespace: flashcard-id 4,865; category-id 1,545; question-index-id 1,393; md-source-id 803; definition-id 541; quiz-id 192; html-anchor 151; topic-id, difficulty-id and review-later-id 124 each; roadmap-track-id 40; definition-section-id 30; questionbank-id 17; quiz-question-id 13; card-block-topic-id 2. Counts describe aliases, not semantic errors or unique affected users.

## Observation and reviewed decision are different contracts

`legacy-id-mapping.json` remains the sole generated observation mapping. Its original candidates, occurrences, source scope and aliases are preserved. No automatic equivalence is inferred between translations, snapshot/runtime cards, repeated anchors or normalized progress IDs. Duplicate IDs retain every observed occurrence.

`content/prototype/id-resolutions.json` is a sparse authored review overlay, not another content registry. It starts with no decisions. Generation must never overwrite it or manufacture a reviewer. An example of the supported decision format is:

```json
{
  "schemaVersion": 1,
  "decisions": [{
    "namespace": "topic-id",
    "legacyId": "historical-example",
    "source": null,
    "status": "pending_review",
    "canonicalId": null,
    "review": {"reviewer": "reviewer identity", "reason": "specific evidence and decision rationale"}
  }]
}
```

An actual decision must refer to an existing observed tuple. `source:null` is a global identity; it is never filled from the currently open page. Scoped aliases are separate tuples. A reviewed `resolved` decision may select only an existing original candidate with an active registry binding. It retains all original competing candidates and occurrences. Duplicate decisions, missing evidence, unknown targets, retired selected targets and selected targets outside the candidate set are rejected. All decisions are validated before use, including ones unrelated to the requested record.

| Effective status | Meaning | Canonical progress target |
| --- | --- | --- |
| resolved | Unique observed active target, or explicit reviewed selection with evidence | Exactly one validated active ID |
| ambiguous | More than one identity or otherwise conflicting observations, no reviewed selection | null |
| deprecated | Reviewed historical alias retained but not selected for transfer | null |
| orphaned | Historical alias retained after its material is retired or absent | null |
| pending_review | Explicit review deferral while preserving evidence | null |

Absent decisions retain the observed status; no arbitrary deadline or priority changes an ambiguous alias into resolved. Unknown aliases return `unresolved`, a lookup outcome outside the five authored lifecycle states. Unknown records are still retained in full. A resolved observation with no validated active registry target also fails closed as unresolved.

## API and synthetic proof

`tools/content/resolution.py` supplies `validate_resolutions(document, mapping, identity)` and `resolution_rows(mapping, identity, decisions=None)`. The latter yields a full independent copy of every observed mapping with `observedStatus` and `review`, applying a validated sparse overlay without modifying the observations. The schema provides `$defs.resolutions` and lifecycle-compatible mapping rows.

`tools/content/progress-compatibility.cjs` supplies `createResolver(mapping, identity, resolutions?)` and `projectRecords(records, resolver)`. It indexes exact `(namespace, legacyId, source)` tuples. Omitting the registry cannot produce a resolved target. It does no URL normalization, guessing, namespace fallback, storage read or migration. Each projection includes identity, resolution and a structured clone of the entire raw record. Two attempts resolving to one object remain two attempts, even when their outcomes conflict. Achievements, code, drafts, due dates and unknown fields are never normalized or discarded.

Tests cover scoped and global collisions, namespace separation, unknown historical awards, exact math draft IDs, missing/retired canonical targets, all five reviewed states, preserved competing candidates, invalid decisions, separate contradictory quiz attempts, and synthetic records spanning achievements, quizzes, spaced repetition, Python exercises, math exercises, drafts and roadmap. A persisted-artifact check exercises the actual namespace mappings with synthetic payloads. Python tests cover historical source retention, explicit selection, unchanged observations and rejected review decisions. The existing catalog rebind tests exercise canonical stability across rename; the registry generator owns full historical alias retention.

Verification commands:

```text
node --test tests/content-progress-compatibility.test.cjs
python -m unittest discover -s tests -p test_content_resolution.py -v
```

These checks prove the offline adapter's refusal to merge and its preservation of supplied records. They cannot prove coverage of unknown historical IDs absent from today's sources, or semantic equivalence of two similarly named materials. Before any future real migration, export/preview, explicit user policy, full namespace coverage and storage recovery checks remain separate work. This phase authorizes none of that migration.

## Independent Data Architect position

Blind-first verdict: approve offline stabilization only with persisted identity, explicit historical aliases and fail-closed resolution. A registry-free resolver was a concrete risk: a singleton mapping could be reported resolved without proving the canonical target existed. The revised resolver removes that path. Confidence is high for the storage boundary and ambiguity handling, medium for historical completeness. No static audit can reconstruct every prior user key or justify semantic merging of translations and snapshot copies.
