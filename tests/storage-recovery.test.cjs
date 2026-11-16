const test = require('node:test');
const assert = require('node:assert/strict');
const recovery = require('../site/assets/js/storage-recovery.js');
function sample() {
  return { schemaVersion: 1, state: { revision: 7, db: { users: { offline_user: { progress: { example: true }, futureField: { keep: [1, 2] } } }, datalab_migrations: { anonymous_progress_v1: true } }, kv: { 'exc-draft:anon:demo': '', theme: 'dark' } }, legacy: { rawEntries: { datalab_offline_db: '{"unknown":42}', anonymous_progress: '{}', datalab_anonymous_import_v1: '1' }, checksum: 'synthetic' } };
}
test('backup round trip preserves unknown fields, raw empty draft and both migration markers', async () => {
  const source = sample();
  const text = await recovery.encode(source);
  const decoded = await recovery.decode(text);
  assert.deepEqual(decoded.snapshot, source);
});
test('backup refuses corruption, incompatible versions, credentials and unsafe objects without mutations', async () => {
  const text = await recovery.encode(sample());
  await assert.rejects(recovery.decode(text.replace('example', 'changed')), /сумма/);
  await assert.rejects(recovery.decode(text.replace('"version": 1', '"version": 9')), /версия/);
  const secret = sample(); secret.state.db.access_token = 'never-export-this';
  await assert.rejects(recovery.encode(secret), /секрет/);
  const polluted = sample(); polluted.state.db = JSON.parse('{"__proto__":{"polluted":true}}');
  await assert.rejects(recovery.encode(polluted), /служебный/);
  assert.equal({}.polluted, undefined);
  const rawSecret = sample(); rawSecret.legacy.rawEntries.datalab_offline_db = '{"apiKey":"private"}';
  await assert.rejects(recovery.encode(rawSecret), /секрет/);
});
test('preview exposes replacements and deletions rather than silently merging old snapshots', () => {
  const before = sample(), after = sample();
  after.state.db.users.offline_user.progress.example = false;
  delete after.state.kv.theme;
  after.state.kv.palette = 'default';
  const result = recovery.diff(before, after);
  assert.equal(result.expectedRevision, 7);
  assert.equal(result.conflicts, 2);
  assert.ok(result.changes.some(x => x.key === 'theme' && x.action === 'delete'));
  assert.ok(result.changes.some(x => x.key === 'palette' && x.action === 'add'));
});
test('backup bounds input and rejects unknown localStorage key families', async () => {
  await assert.rejects(recovery.decode(' '.repeat(recovery.MAX_BYTES + 1)), /большой/);
  const unknown = sample(); unknown.state.kv.auth_token = 'no';
  await assert.rejects(recovery.encode(unknown), /секрет|Недопустимый/);
  const future = sample(); future.state.kv.future_unreviewed_key = 'no';
  await assert.rejects(recovery.encode(future), /Недопустимый/);
});
test('preview identifies nested unknown deletions and truncates display with truthful totals', () => {
  const before = sample(), after = sample();
  before.state.db.users.offline_user.futureUnknown = { lostLeaf: 'keep until confirmed' };
  for (let i = 0; i < 300; i++) before.state.db.users.offline_user.progress['topic' + i] = true;
  const result = recovery.diff(before, after);
  assert.equal(result.totalChanges, 301);
  assert.equal(result.conflicts, 301);
  assert.equal(result.changes.length, 250);
  assert.equal(result.truncated, true);
  assert.ok(result.changes.some(x => x.path === 'db/users/offline_user/futureUnknown/lostLeaf' && x.action === 'delete'));
});
