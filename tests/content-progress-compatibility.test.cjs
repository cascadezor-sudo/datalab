'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createResolver, projectRecords } = require('../tools/content/progress-compatibility.cjs');
const row = (legacyId, canonicalId, source = null, namespace = 'topic-id') => ({ namespace, legacyId, canonicalId, source, status: 'resolved', candidates: [canonicalId] });
const make = mappings => createResolver({ schemaVersion: 1, mappings }, { bindings: Object.fromEntries(mappings.flatMap(m => m.candidates).filter(Boolean).map(id => [id, { canonicalId: id, status: 'active' }])) });

test('global ambiguous progress cannot be multiplied into translated or duplicate lessons', () => {
  const resolve = make([row('same', 'ru', 'site/python/base.html'), row('same', 'en', 'site/en/python/base.html'),
    { ...row('same', null), status: 'ambiguous', candidates: ['ru', 'en'] }]);
  assert.equal(resolve({ namespace: 'topic-id', legacyId: 'same' }).status, 'ambiguous');
  assert.equal(resolve({ namespace: 'topic-id', legacyId: 'same', source: 'site/python/base.html' }).canonicalId, 'ru');
  assert.equal(resolve({ namespace: 'topic-id', legacyId: 'same', source: '/datalab/python/base.html' }).status, 'unresolved');
});
test('unknown historical achievements and fields remain lossless, original unmodified', () => {
  const records = [{ namespace: 'achievement-id', legacyId: 'retired-award', value: { unlockedAt: 1, custom: ['unknown'] }, privateFutureField: { a: 2 } }];
  const before = structuredClone(records);
  const result = projectRecords(records, make([]));
  assert.equal(result[0].resolution.status, 'unresolved');
  assert.deepEqual(result[0].raw, records[0]);
  result[0].raw.value.custom.push('copy');
  assert.deepEqual(records, before);
});
test('same legacy id in exercise, topic and math namespaces never leaks', () => {
  const resolve = make([row('x', 'topic'), row('x', 'exercise', null, 'exercise-id')]);
  assert.equal(resolve({ namespace: 'exercise-id', legacyId: 'x' }).canonicalId, 'exercise');
  assert.equal(resolve({ namespace: 'math-exercise-id', legacyId: 'x' }).status, 'unresolved');
});
test('conflicting mappings and orphan canonical targets fail closed', () => {
  assert.equal(make([row('x', 'a'), row('x', 'b')])({ namespace: 'topic-id', legacyId: 'x' }).status, 'ambiguous');
  const resolver = createResolver({ schemaVersion: 1, mappings: [row('x', 'missing')] }, { bindings: {} });
  assert.equal(resolver({ namespace: 'topic-id', legacyId: 'x' }).status, 'unresolved');
});
test('quiz attempts preserve identity and contradictory results without aggregation', () => {
  const records = [false, true].map((passed, i) => ({ namespace: 'quiz-id', legacyId: 'quiz', attemptId: `attempt-${i}`, value: { passed, answers: { future: i } } }));
  const result = projectRecords(records, make([row('quiz', 'canonical-quiz', null, 'quiz-id')]));
  assert.equal(result.length, 2);
  assert.deepEqual(result.map(r => r.raw), records);
  assert.equal(new Set(result.map(r => r.resolution.canonicalId)).size, 1);
});
test('math drafts preserve form page and markdown id verbatim, aliases require explicit rows', () => {
  const resolve = make([row('math-practice#md-1', 'math-object', null, 'math-draft-id')]);
  assert.equal(resolve({ namespace: 'math-draft-id', legacyId: 'math-practice#md-1' }).canonicalId, 'math-object');
  assert.equal(resolve({ namespace: 'math-draft-id', legacyId: 'md-1' }).status, 'unresolved');
  assert.equal(resolve({ namespace: 'topic-id', legacyId: 'md-1' }).status, 'unresolved');
});

test('persisted real mappings resolve scoped progress and refuse global collisions', () => {
  const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/modernization', name), 'utf8'));
  const resolve = createResolver(read('legacy-id-mapping.json'), read('id-registry.json'));
  assert.equal(resolve({ namespace: 'topic-id', legacyId: 'median' }).status, 'ambiguous');
  const math = resolve({ namespace: 'topic-id', legacyId: 'median', source: 'math/probability.html' });
  const cv = resolve({ namespace: 'topic-id', legacyId: 'median', source: 'ai/ml/classic-cv.html' });
  assert.equal(math.status, 'resolved');
  assert.equal(cv.status, 'resolved');
  assert.notEqual(math.canonicalId, cv.canonicalId);
  assert.equal(resolve({ namespace: 'topic-id', legacyId: 'python_versions' }).status, 'ambiguous');
  assert.equal(resolve({ namespace: 'math-draft-id', legacyId: 'practise/math.html#algebra-vectors', source: 'practise/math.html' }).status, 'resolved');
  assert.equal(resolve({ namespace: 'achievement-id', legacyId: 'unknown-historical-award' }).status, 'unresolved');
});

test('unvalidated target and retired binding cannot resolve even singleton', () => {
  const doc = { schemaVersion: 1, mappings: [row('x', 'a')] };
  assert.equal(createResolver(doc)({ namespace: 'topic-id', legacyId: 'x' }).status, 'unresolved');
  assert.equal(createResolver(doc, { bindings: { a: { canonicalId: 'a', status: 'retired' } } })({ namespace: 'topic-id', legacyId: 'x' }).status, 'unresolved');
});

test('review decisions preserve original candidates and fail closed for every lifecycle status', () => {
  const mappings = [{ ...row('x', null), status: 'ambiguous', candidates: ['a', 'b'] }];
  const registry = { bindings: { a: { canonicalId: 'a', status: 'active' }, b: { canonicalId: 'b', status: 'active' } } };
  for (const status of ['resolved', 'ambiguous', 'deprecated', 'orphaned', 'pending_review']) {
    const decision = { namespace: 'topic-id', legacyId: 'x', source: null, status, canonicalId: status === 'resolved' ? 'b' : null, review: { reviewer: 'synthetic-review', reason: 'explicit evidence' } };
    const resolve = createResolver({ schemaVersion: 1, mappings }, registry, { schemaVersion: 1, decisions: [decision] });
    const record = { namespace: 'topic-id', legacyId: 'x', user: 'synthetic', value: { unknown: [1, 2] } };
    const projected = projectRecords([record], resolve)[0];
    assert.equal(projected.resolution.status, status);
    assert.equal(projected.resolution.canonicalId, status === 'resolved' ? 'b' : null);
    assert.deepEqual(projected.resolution.candidates, ['a', 'b']);
    assert.deepEqual(projected.raw, record);
  }
  const invalid = { namespace: 'topic-id', legacyId: 'x', source: null, status: 'resolved', canonicalId: 'missing', review: { reviewer: 'r', reason: 'r' } };
  assert.throws(() => createResolver({ schemaVersion: 1, mappings }, registry, { schemaVersion: 1, decisions: [invalid] }), TypeError);
});

test('all synthetic historical progress families remain separate and lossless', () => {
  const namespaces = ['achievement-id', 'quiz-id', 'flashcard-id', 'exercise-id', 'math-exercise-id', 'math-draft-id', 'roadmap-milestone-id', 'topic-id'];
  const records = namespaces.flatMap((namespace, i) => [
    { namespace, legacyId: `legacy-${i}`, user: 'one', attemptId: `attempt-${i}`, value: { completed: false, code: 'print(1)', draft: 'text', due: 123, unknown: [i] } },
    { namespace, legacyId: `unknown-${i}`, user: 'two', value: { completed: true, custom: 'historical' } },
  ]);
  const resolve = make(namespaces.map((namespace, i) => row(`legacy-${i}`, `canonical-${i}`, null, namespace)));
  const projected = projectRecords(records, resolve);
  assert.equal(projected.length, records.length);
  assert.deepEqual(projected.map(p => p.raw), records);
  assert.equal(projected.filter(p => p.resolution.status === 'resolved').length, namespaces.length);
  assert.equal(projected.filter(p => p.resolution.status === 'unresolved').length, namespaces.length);
});


test('actual persisted namespaces cover synthetic achievements, quizzes, SR, Python, math, drafts and roadmap', () => {
  const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, '../docs/modernization', name), 'utf8'));
  const mapping = read('legacy-id-mapping.json');
  const resolve = createResolver(mapping, read('id-registry.json'));
  const namespaces = ['achievement-id', 'quiz-id', 'flashcard-id', 'exercise-id', 'math-exercise-id', 'math-draft-id', 'roadmap-milestone-id', 'roadmap-track-id'];
  const records = namespaces.map(namespace => {
    const observed = mapping.mappings.find(m => m.namespace === namespace);
    assert.ok(observed, namespace);
    return { namespace, legacyId: observed.legacyId, source: observed.source, value: { attempts: [false, true], historicalUnknown: { due: 1, award: true, code: 'print(2)', draft: 'keep' } } };
  });
  const projected = projectRecords(records, resolve);
  assert.deepEqual(projected.map(p => p.raw), records);
  for (const p of projected) {
    assert.ok(['resolved', 'ambiguous', 'orphaned'].includes(p.resolution.status));
    if (p.resolution.status !== 'resolved') assert.equal(p.resolution.canonicalId, null);
  }
});

test('explicit historical rename aliases preserve identity without merging records', () => {
  const mappings = [row('old-topic', 'stable', 'old/page.html'), row('renamed-topic', 'stable', 'new/page.html')];
  const records = [
    { namespace: 'topic-id', legacyId: 'old-topic', source: 'old/page.html', value: { completed: false, recordedAt: 1 } },
    { namespace: 'topic-id', legacyId: 'renamed-topic', source: 'new/page.html', value: { completed: true, recordedAt: 2 } },
  ];
  const projected = projectRecords(records, make(mappings));
  assert.deepEqual(projected.map(p => p.resolution.canonicalId), ['stable', 'stable']);
  assert.deepEqual(projected.map(p => p.raw), records);
  assert.equal(projected.length, 2);
  assert.equal(make(mappings)({ namespace: 'topic-id', legacyId: 'old-topic', source: 'new/page.html' }).status, 'unresolved');
});
