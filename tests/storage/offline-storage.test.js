const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const projectRoot = process.env.DATALAB_TEST_ROOT || path.resolve(__dirname, '../..');
const mockSource = readFileSync(path.join(projectRoot, 'site/assets/js/firebase-mock.js'), 'utf8');

function fixture(progress = { algebra: { completed: true } }) {
  return {
    users: { offline_user: {
      uid: 'offline_user', email: 'offline@previous.local', role: 'student', progress,
      difficultyRatings: { algebra: 4 },
      spaced_repetition: { algebra__1: { nextReviewAt: 123456789, repetitions: 3 } },
    } },
    kanbanTasks: { task1: { title: 'Keep this task', boardStatus: 'doing' } },
    daily_reports: { offline_user: { report1: { text: 'Keep this report' } } },
  };
}

function boot(entries = {}, { blocked = false } = {}) {
  const values = new Map(Object.entries(entries));
  let blockWrites = blocked;
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) {
      if (blockWrites) throw new Error('Quota exceeded');
      values.set(key, String(value));
    },
    removeItem(key) { values.delete(key); },
  };
  const context = {
    localStorage: storage,
    location: { protocol: 'http:', origin: 'http://localhost:8080', pathname: '/main.html' },
    document: {
      body: null, readyState: 'loading',
      documentElement: { classList: { remove() {} } },
      getElementById() { return null; }, addEventListener() {},
    },
    addEventListener() {}, dispatchEvent() {},
    setTimeout() { return 1; }, clearTimeout() {},
    console: { log() {}, warn() {}, error() {} },
    fetch: async () => { throw new Error('Network must not be used'); },
    CustomEvent: class {},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(mockSource, context);
  const readUser = () => context.firebase.database().ref('users/offline_user').once('value');
  return { context, storage, values, readUser, setBlocked: value => { blockWrites = value; } };
}

test('compatible earlier progress is copied with all related state; original is preserved', async () => {
  const original = JSON.stringify(fixture());
  const app = boot({ previous_offline_db: original });
  const user = (await app.readUser()).val();
  assert.equal(user.progress.algebra.completed, true);
  assert.equal(user.difficultyRatings.algebra, 4);
  assert.equal(user.spaced_repetition.algebra__1.repetitions, 3);
  assert.equal(user.email, 'offline@datalab.local');
  const imported = JSON.parse(app.storage.getItem('datalab_offline_db'));
  assert.equal(imported.kanbanTasks.task1.title, 'Keep this task');
  assert.equal(imported.daily_reports.offline_user.report1.text, 'Keep this report');
  assert.equal(app.storage.getItem('previous_offline_db'), original);
});

test('current database takes precedence over earlier databases', async () => {
  const app = boot({
    datalab_offline_db: JSON.stringify(fixture({ current: true })),
    previous_offline_db: JSON.stringify(fixture({ earlier: true })),
  });
  const user = (await app.readUser()).val();
  assert.equal(user.progress.current, true);
  assert.equal(user.progress.earlier, undefined);
});

test('corrupt earlier data is preserved and is not replaced by an empty database', () => {
  const app = boot({ previous_offline_db: '{broken' });
  assert.throws(app.readUser, error => error.code === 'OFFLINE_STORAGE_FAILED');
  assert.equal(app.storage.getItem('previous_offline_db'), '{broken');
  assert.equal(app.storage.getItem('datalab_offline_db'), null);
});

test('multiple compatible earlier stores require a deliberate choice', () => {
  const app = boot({
    first_offline_db: JSON.stringify(fixture({ first: true })),
    second_offline_db: JSON.stringify(fixture({ second: true })),
  });
  assert.throws(app.readUser, error => error.code === 'OFFLINE_STORAGE_FAILED');
  assert.equal(app.storage.getItem('datalab_offline_db'), null);
});

test('failed migration retains the original and can be retried', async () => {
  const original = JSON.stringify(fixture());
  const app = boot({ previous_offline_db: original }, { blocked: true });
  assert.throws(app.readUser, error => error.code === 'OFFLINE_STORAGE_FAILED');
  assert.equal(app.storage.getItem('previous_offline_db'), original);
  assert.equal(app.storage.getItem('datalab_offline_db'), null);
  app.setBlocked(false);
  assert.equal((await app.readUser()).val().progress.algebra.completed, true);
});

test('corrupt current data is never silently replaced by an earlier version', () => {
  const app = boot({
    datalab_offline_db: '{broken',
    previous_offline_db: JSON.stringify(fixture()),
  });
  assert.throws(app.readUser, error => error.code === 'OFFLINE_STORAGE_FAILED');
  assert.equal(app.storage.getItem('datalab_offline_db'), '{broken');
});

test('fresh installs keep the offline exercise and math hooks available', async () => {
  const app = boot();
  assert.equal((await app.readUser()).val().email, 'offline@datalab.local');
  assert.equal(app.context.__datalabOfflineChecker, true);
  assert.equal(typeof app.context.__datalabOfflineMathCheck, 'function');
});

test('material links use the address of the running project', () => {
  const context = { location: { protocol: 'http:', origin: 'http://localhost:8080' } };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(path.join(projectRoot, 'site/assets/js/components/task-details.js'), 'utf8'), context);
  assert.equal(context.TaskDetails.toAbsoluteSiteUrl('/bank/index.html'), 'http://localhost:8080/bank/index.html');
  assert.equal(context.TaskDetails.toAbsoluteSiteUrl('python/base.html#loops'), 'http://localhost:8080/python/base.html#loops');
  assert.equal(context.TaskDetails.toAbsoluteSiteUrl('https://example.org/material'), 'https://example.org/material');
});
