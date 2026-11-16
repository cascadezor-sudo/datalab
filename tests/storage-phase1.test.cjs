const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const mock = fs.readFileSync(path.join(root, 'site/assets/js/firebase-mock.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'site/assets/js/components/achievement-api.js'), 'utf8');
function storage(values) {
  return {
    fail: false,
    get length() { return values.size; }, key(i) { return [...values.keys()][i] ?? null; },
    getItem(k) { return values.get(k) ?? null; },
    setItem(k, v) { if (this.fail) throw new Error('quota'); values.set(k, String(v)); },
    removeItem(k) { values.delete(k); }
  };
}
function boot(store, order = ['mock'], locks) {
  const ctx = {
    localStorage: store, navigator: locks ? { locks } : {},
    location: { protocol: 'http:', origin: 'http://example.test', pathname: '/main.html' },
    document: { body: null, readyState: 'loading', documentElement: { classList: { remove() {} } }, getElementById() { return null; }, addEventListener() {} },
    addEventListener() {}, dispatchEvent() {}, setTimeout() { return 1; }, clearTimeout() {},
    console: { log() {}, warn() {}, error() {} }, fetch: async () => { throw new Error('offline'); }, CustomEvent: class {}
  };
  require("./helpers/storage-context.cjs").prepare(ctx,store);
  for (const item of order) vm.runInContext(item === 'mock' ? mock : api, ctx);
  return ctx;
}
const fixture = progress => JSON.stringify({ users: { offline_user: { uid: 'offline_user', role: 'student', progress, settings: { x: 1 } } }, user_achievements: { offline_user: { prior: { unlockedAt: 1 } } }, unknown: { kept: true } });
const data = async c => (await c.DataLabStorage.read()).db;

test('legacy completion forms share one explicit interpretation', async () => {
  const c = boot(storage(new Map()));
  for (const [input, expected] of [[true,true],[false,false],[null,false],[{},true],[{completed:false,status:'completed'},false],[{completed:true},true],[{status:'completed'},true],[{status:'pending'},false],[{unknown:1},true]]) {
    assert.equal(c.DataLabProgress.isCompleted(input), expected);
  }
});
test('legacy import is once-only, preserves independent state and survives full DB removal', async () => {
  const store=storage(new Map([['datalab_offline_db', fixture({ existing: { completed:true } })], ['anonymous_progress', JSON.stringify({ old:{completed:true} })]]));
  const c=boot(store); await c.__datalabStorageReady; assert.ok((await data(c)).users.offline_user.progress.old);
  assert.ok((await data(c)).users.offline_user.progress.existing);
  assert.equal((await data(c)).users.offline_user.settings.x,1); assert.ok((await data(c)).user_achievements.offline_user.prior); assert.ok((await data(c)).unknown.kept);
  await c.firebase.database().ref('users/offline_user/progress/old').remove();
  boot(store); assert.equal((await data(c)).users.offline_user.progress.old,undefined);
  assert.ok((await data(c)).users.offline_user.progress.existing);
  store.removeItem('datalab_offline_db'); boot(store);
  assert.equal((await data(c)).users.offline_user.progress.old,undefined);
});
test('sequential and cooperative cross-tab writes preserve other branches', async () => {
  let tail=Promise.resolve(); const locks={ request(name, fn) { const next=tail.then(fn); tail=next.catch(()=>{}); return next; } };
  const store=storage(new Map()); const a=boot(store,['mock'],locks); const b=boot(store,['mock'],locks);
  await Promise.all([
    a.firebase.database().ref('users/offline_user/progress/first').set({completed:true}),
    b.firebase.database().ref('users/offline_user/progress/second').set({completed:true}),
    a.firebase.database().ref('users/offline_user/settings/custom').set('safe')
  ]);
  await b.firebase.database().ref('users/offline_user/progress/first').set({completed:true});
  assert.ok((await data(a)).users.offline_user.progress.first); assert.ok((await data(a)).users.offline_user.progress.second);
  assert.equal((await data(a)).users.offline_user.settings.custom,'safe');
});
test('quota errors reject writes and do not report success', async () => {
  const store=storage(new Map()); const c=boot(store); await c.__datalabStorageReady; store.fail=true;
  await assert.rejects(c.firebase.database().ref('users/offline_user/progress/a').set(true), e => e.code==='OFFLINE_STORAGE_FAILED');
  assert.equal((await data(c)).users.offline_user.progress.a,undefined);
});
test('offline API owns overlapping methods in both script orders', async () => {
  for(const order of [['api','mock'],['mock','api']]) {
    const store=storage(new Map()); const c=boot(store,order);
    assert.match(String(c.achievementApi.submitQuizAttempt), /scoreOfflineQuizAttempt/);
    assert.equal(typeof c.achievementApi.getTeorminCards,'function');
    await c.achievementApi.setQuestionProgress('alpha',true);
    assert.ok((await data(c)).users.offline_user.progress.alpha);
  }
});
test('achievement fetch cannot overwrite newer progress or award duplicates', async () => {
  const store=storage(new Map()); const c=boot(store);
  let release, started;
  const ready=new Promise(resolve => { started=resolve; });
  c.fetch=() => new Promise(resolve => { release=resolve; started(); });
  const pending=c.achievementApi.setQuestionProgress('first',true);
  await ready;
  await c.firebase.database().ref('users/offline_user/progress/second').set({completed:true});
  release({ok:true,json:async()=>({achievements:[{id:'test-first',rule:{type:'questions',min:1}}]})});
  await pending;
  assert.ok((await data(c)).users.offline_user.progress.first); assert.ok((await data(c)).users.offline_user.progress.second);
  c.fetch=async()=>({ok:true,json:async()=>({achievements:[{id:'test-first',rule:{type:'questions',min:1}}]})});
  await c.achievementApi.reconcileAchievements();
  assert.equal(Object.values((await data(c)).achievement_events.offline_user).filter(x=>x.achievementId==='test-first').length,1);
});
test('bad legacy data prevents writes instead of silently replacing it', async () => {
  const store=storage(new Map([['datalab_offline_db',fixture({})],['anonymous_progress','{broken']]));
  const c=boot(store);
  await assert.rejects(c.firebase.database().ref('users/offline_user/progress/a').set(true), e => e.code==='OFFLINE_STORAGE_FAILED');
  assert.equal(store.getItem('anonymous_progress'),'{broken');
});
test('batch completion uses shared semantics and preserves unrelated progress', async () => {
  const store=storage(new Map()); const c=boot(store);
  await c.achievementApi.setQuestionProgressBatch({keep:{completed:true}, remove:{completed:true}});
  await c.achievementApi.setQuestionProgressBatch({remove:{completed:false}, legacy:{}, status:{status:'completed'}, pending:{status:'pending'}});
  const progress=(await data(c)).users.offline_user.progress;
  assert.ok(progress.keep); assert.equal(progress.remove,undefined); assert.ok(progress.legacy); assert.ok(progress.status); assert.equal(progress.pending,undefined);
  const mirror=JSON.parse(await c.DataLabStorage.getKV('anonymous_progress')); assert.ok(mirror.keep); assert.equal(mirror.remove,undefined); assert.ok(mirror.status); assert.equal(mirror.pending,undefined);
});
test('staff writes cooperate with progress and refuse a failed migration', async () => {
  let tail=Promise.resolve(); const locks={request(name,fn){const next=tail.then(fn);tail=next.catch(()=>{});return next;}};
  const store=storage(new Map()); const a=boot(store,['mock'],locks); const b=boot(store,['mock'],locks);
  await Promise.all([
    a.staffApi.saveEnglishClubRecord({id:'entry',record:{title:'synthetic'}}),
    b.firebase.database().ref('users/offline_user/progress/new').set({completed:true})
  ]);
  assert.ok((await data(a)).users.offline_user.progress.new);
  assert.ok((await data(a)).englishClubRecords.some(r=>r.id==='entry'));
  const broken=storage(new Map([['datalab_offline_db',fixture({})],['anonymous_progress','{broken']]));
  const c=boot(broken);
  await assert.rejects(c.staffApi.saveEnglishClubRecord({id:'should-not-write'}), e=>e.code==='OFFLINE_STORAGE_FAILED');
  assert.equal(JSON.parse(broken.getItem("datalab_offline_db")).englishClubRecords,undefined);
});
test('unknown offline call fails clearly instead of pretending to succeed', async () => {
  const c=boot(storage(new Map()));
  await assert.rejects(c.achievementApi.call('nonexistentSyntheticMethod'), /Unsupported offline API method/);
  await assert.rejects(c.achievementApi.call('call'), /Unsupported offline API method/);
});

test('achievement notifications are emitted only after successful durable commit',async()=>{
  const store=storage(new Map());const c=boot(store);await c.__datalabStorageReady;
  let started,release;const reached=new Promise(resolve=>{started=resolve;});const emitted=[];
  c.globalAchievementNotifications={enqueue(event){emitted.push(event);}};
  c.fetch=()=>new Promise(resolve=>{release=resolve;started();});
  const pending=c.achievementApi.setQuestionProgress('confirmed-progress',true);await reached;
  store.fail=true;release({ok:true,json:async()=>({achievements:[{id:'not-yet-committed',rule:{type:'questions',min:1}}]})});
  await assert.rejects(pending,e=>e.code==='OFFLINE_STORAGE_FAILED');assert.equal(emitted.length,0);
  assert.equal((await data(c)).user_achievements.offline_user['not-yet-committed'],undefined);
});
