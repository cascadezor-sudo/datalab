const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
function setup() {
  const data = new Map();
  const localStorage = {
    get length() { return data.size; },
    key: i => [...data.keys()][i] ?? null,
    getItem: k => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, String(v)),
    removeItem: k => data.delete(k),
  };
  const context = {
    localStorage, location: { protocol: 'http:', origin: 'http://localhost:8080', pathname: '/' },
    document: { body: null, readyState: 'loading', documentElement: { classList: { remove() {} } },
      addEventListener() {}, getElementById() { return null; } },
    addEventListener() {}, dispatchEvent() {}, setTimeout() { return 1; }, clearTimeout() {},
    console: { log() {}, warn() {}, error() {} }, fetch: async () => { throw Error('no network'); },
    CustomEvent: class {},
  };
  require("../helpers/storage-context.cjs").prepare(context,localStorage);
  for (const file of ['site/assets/js/firebase-mock.js',
    'site/assets/js/components/progress-tracker-questions.js',
    'site/assets/js/components/roadmap-progress.js',
    'site/assets/js/components/spaced-repetition.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
  }
  return context;
}

test('tracker, roadmap and repetition agree on old and current progress values', () => {
  const c = setup();
  const values = { legacy: true, object: { completed: true }, oldObject: {},
    status: { status: 'completed' }, incomplete: { completed: false }, deleted: null };
  const tracker = c.questionProgressTracker;
  tracker.progressData = values;
  for (const [key, expected] of Object.entries({ legacy: true, object: true, oldObject: true,
    status: true, incomplete: false, deleted: false, missing: false })) {
    assert.equal(tracker.isQuestionCompleted(key), expected, key);
  }
  c.sample = values;
  assert.equal(vm.runInContext('RoadmapProgress.calculateCategoryProgress(Object.keys(sample), sample).completed', c), 4);
  const repetition = new c.SpacedRepetitionSystem();
  repetition.progressData = values;
  assert.equal(repetition.isCardFromCompletedQuestion({ questionId: 'legacy' }), true);
  assert.equal(repetition.isCardFromCompletedQuestion({ questionId: 'incomplete' }), false);
});
