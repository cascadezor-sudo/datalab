// Behavioural diagnostics for two known storage risks. Uses synthetic data in
// an in-memory VM; never reads or writes browser storage or user profiles.
// Exit 1 means a risk reproduced. This is deliberately not part of node --test.
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = readFileSync(path.resolve(__dirname, '../../site/assets/js/firebase-mock.js'), 'utf8');

function boot(values, fetchImpl) {
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const ctx = {
    localStorage: storage,
    location: { protocol: 'http:', origin: 'http://example.test', pathname: '/main.html' },
    document: {
      body: null, readyState: 'loading',
      documentElement: { classList: { remove() {} } },
      getElementById() { return null; }, addEventListener() {},
    },
    addEventListener() {}, dispatchEvent() {}, setTimeout() { return 1; }, clearTimeout() {},
    console: { log() {}, warn() {}, error() {} },
    fetch: fetchImpl || (async () => { throw new Error('Network disabled'); }),
    CustomEvent: class {},
  };
  require("../../tests/helpers/storage-context.cjs").prepare(ctx,storage,values);
  vm.runInContext(source, ctx);
  return ctx;
}

function fixture(progress) {
  return JSON.stringify({ users: { offline_user: { uid: 'offline_user', role: 'student', progress } } });
}

async function resetSurvivesReload() {
  const completion = { completed: true, timestamp: 1 };
  const values = new Map([
    ['datalab_offline_db', fixture({ synthetic: completion })],
    ['anonymous_progress', JSON.stringify({ synthetic: completion })],
  ]);
  const first = boot(values);
  await first.firebase.database().ref('users/offline_user').update({ progress: {} });
  const reloaded=boot(values); // same synthetic IDB origin on reload
  const progress = (await reloaded.DataLabStorage.read()).db.users.offline_user.progress;
  return !Object.prototype.hasOwnProperty.call(progress, 'synthetic');
}

async function concurrentWriteSurvivesAchievement() {
  const values = new Map([['datalab_offline_db', fixture({})]]);
  let releaseFetch;
  let signalFetch;
  const started = new Promise(resolve => { signalFetch = resolve; });
  const ctx = boot(values, () => new Promise(resolve => { releaseFetch = resolve; signalFetch(); }));
  const pending = ctx.achievementApi.setQuestionProgress('first', true);
  // A real timer bounds the diagnostic if a future implementation changes flow.
  let timer;
  try {
    await Promise.race([started, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('catalog fetch was not reached')), 2000); })]);
    await ctx.firebase.database().ref('users/offline_user/progress/second').set({ completed: true });
    releaseFetch({ ok: true, json: async () => ({ achievements: [
      { id: 'synthetic-first', rule: { type: 'questions', min: 1 } },
    ] }) });
    await pending;
    const progress = (await ctx.DataLabStorage.read()).db.users.offline_user.progress;
    return Boolean(progress.first && progress.second);
  } finally { clearTimeout(timer); }
}

(async () => {
  let failed = false;
  for (const [name, check] of [
    ['cleared progress remains cleared after reload', resetSurvivesReload],
    ['concurrent progress survives achievement evaluation', concurrentWriteSurvivesAchievement],
  ]) {
    try {
      const passed = await check();
      console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
      if (!passed) failed = true;
    } catch (error) {
      failed = true;
      console.error(`ERROR: ${name}: ${error.message}`);
    }
  }
  if (failed) process.exitCode = 1;
})();
