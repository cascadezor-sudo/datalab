# Phase 3 independent content QA

The independent QA pass reads actual source and exercises adverse synthetic fixtures. It does not modify `site/`, browser storage, public URLs or production scripts. Work remains on `refactor/phase-0-baseline`, HEAD `95682d2e3aedaa4d0fa70ce009b899f68fba2cdd`; pre-existing changes are outside this pass.

## Reproducible checks

```powershell
python -m unittest discover -s tests -p test_content_stability_qa.py -v
python -m unittest discover -s tests -p test_content_routes_coverage.py -v
```

The stability suite passed **10/10** in 16.980 seconds on the bundled Python runtime. It rebuilds the actual catalog twice in memory, compares UTF-8 serialization of catalog, identity and legacy mapping, and verifies every previous binding key retains its canonical ID. Synthetic fixtures cover exact duplicate versus distinct relationship citations; corrupted duplicate edges; missing parents; cycles; malformed evidence; valid endpoint types with a parent from the wrong source; removed-source orphan aliases; explicit source rebinding with parser-appended `.name` aliases; retained progress aliases after a `.name` change on a surviving block; and two rejected unallocated-identity reads followed by explicit provisioning. Resolution decisions with omitted required fields or extra fields are rejected.

The independent physical-route suite passed **3/3** in 1.542 seconds. It independently enumerates every HTML document and exact DOM ID/named-anchor occurrence, compares local and Pages route metadata, verifies structured-source inclusion and checks source SHA-256 against actual bytes.

Adverse fixtures exposed two validator false negatives: an exact duplicate relationship was accepted, and a valid relationship endpoint pair could claim containment across unrelated source files. Both now produce integrity errors. A separate fixture exposed resolution decisions accepted without schema-required `source`; the decision validator now rejects them. These tests retain the adverse inputs rather than excluding problematic data.

## Council position

QA approves the offline registry core after these checks. Data Architecture strengthened the requirement that removed aliases remain inspectable as orphaned evidence. Frontend readiness is limited to the validated static route and DTO boundary: source coverage cannot prove every dynamically assembled link or a future framework rendering. Performance indexing remains optional; source integrity checks and detached return values preserve correctness even when they affect broad-query speed.

This pass does not establish browser behavior, external-link availability, historical IDs absent from all retained source/registry evidence, or deployment completeness. Final regenerated-artifact validation and the complete browser/storage/build runs belong to the overall Phase 3 report. Confidence in the tested offline invariants: high.

## Browser test readiness finding

The full `tests/browser/storage-clients.cjs` run exposed an existing settings-page hydration race. A fresh synthetic Chromium context with the Firebase configuration response gated demonstrated the sequence: after `DataLabStorage.ready`, the test could enter `Synthetic` while email remained empty and Save was enabled; after releasing configuration, gamification initialization and `loadUserProfile` populated `Student`, the authenticated email, and disabled Save. Storage readiness therefore did not mean that the form had finished loading.

The test now waits for the authenticated email to appear and the initial Save state to be disabled before entering fields. All save, persisted-value and reload assertions remain. No production page was changed. This corrects the test's prerequisite and does not claim to fix the pre-existing usability race in which someone types before profile hydration finishes.
