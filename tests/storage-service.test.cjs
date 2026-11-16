const test=require('node:test');
const assert=require('node:assert/strict');
const {prepare}=require('./helpers/storage-context.cjs');
function store(entries={}) {const data=new Map(Object.entries(entries));return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};}
function boot(storage=store(),{unavailable=false}={}) {
  const c={localStorage:storage,addEventListener(){},dispatchEvent(){},CustomEvent:class{},console};prepare(c,storage);
  if(unavailable)c.indexedDB=undefined;
  const service=c.DataLabStorage;
  service.configure({initialDb:()=>({users:{offline_user:{uid:'offline_user',progress:{}}},unknown:{safe:true}}),migrate(db,kv){db.datalab_migrations={...db.datalab_migrations,anonymous_progress_v1:true};kv.datalab_anonymous_import_v1='true';}});
  return service;
}
test('atomic callbacks abort on throw and reject asynchronous mutators without false commits',async()=>{
  const s=boot();await s.ready;const initial=await s.read();
  await assert.rejects(s.mutate(state=>{state.db.unknown.safe=false;throw new Error('synthetic');}),/synthetic/);
  await assert.rejects(s.mutate(async state=>{state.db.unknown.safe=false;}),e=>e.code==='ASYNC_MUTATOR');
  const after=await s.read();assert.equal(after.revision,initial.revision);assert.equal(after.db.unknown.safe,true);
});
test('restore requires preview revision, backs up current state, and undo refuses newer changes',async()=>{
  const s=boot();await s.ready;const incoming=await s.recoverySnapshot();
  await s.mutate(state=>{state.db.unknown.newer=1;});
  await assert.rejects(s.restore(incoming,{expectedRevision:incoming.state.revision}),e=>e.code==='REVISION_CONFLICT');
  const before=await s.read();const restored=await s.restore(incoming,{expectedRevision:before.revision});
  assert.equal((await s.read()).db.unknown.newer,undefined);
  assert.equal((await s.getRecovery(restored.recoveryId)).state.db.unknown.newer,1);
  await s.mutate(state=>{state.db.unknown.latest=2;});
  await assert.rejects(s.undoRestore(restored.recoveryId,{expectedRevision:restored.revision}),e=>e.code==='REVISION_CONFLICT');
  const current=await s.read();await s.undoRestore(restored.recoveryId,{expectedRevision:current.revision});
  assert.equal((await s.read()).db.unknown.newer,1);
});
test('legacy divergence stops writes and explicit reviewed adoption preserves pre-adoption recovery',async()=>{
  const raw=JSON.stringify({users:{offline_user:{uid:'offline_user',progress:{legacy:true}}}});
  const ls=store({datalab_offline_db:raw});const s=boot(ls);await s.ready;
  await s.mutate(state=>{state.db.unknown={modern:true};});
  ls.setItem('datalab_offline_db',JSON.stringify({users:{offline_user:{uid:'offline_user',progress:{olderClient:true}}}}));
  await assert.rejects(s.mutate(state=>{state.db.shouldNotSave=true;}),e=>e.code==='LEGACY_CLIENT_CONFLICT');
  assert.equal((await s.read()).db.shouldNotSave,undefined);
  assert.ok((await s.read()).legacyConflict);
  const divergent=ls.getItem('datalab_offline_db');ls.setItem('datalab_offline_db',raw);
  await assert.rejects(s.mutate(state=>{state.db.shouldNotSave=true;}),e=>e.code==='LEGACY_CLIENT_CONFLICT');
  ls.setItem('datalab_offline_db',divergent);
  const preview=await s.previewLegacy();const result=await s.adoptLegacy({expectedRevision:preview.expectedRevision,expectedLegacyChecksum:preview.legacyChecksum});
  assert.equal((await s.read()).db.users.offline_user.progress.olderClient,true);
  assert.equal((await s.read()).legacyConflict,undefined);
  assert.equal((await s.getRecovery(result.recoveryId)).state.db.unknown.modern,true);
  assert.equal((await s.getRecovery('legacy-original')).rawEntries.datalab_offline_db,raw);
});
test('failed migration has immutable original archive and can explicitly activate repaired candidate',async()=>{
  const ls=store({datalab_offline_db:'{broken'});const first=boot(ls);await assert.rejects(first.ready);
  assert.equal((await first.getRecovery('legacy-original')).rawEntries.datalab_offline_db,'{broken');
  const repaired=JSON.stringify({users:{offline_user:{uid:'offline_user',progress:{repaired:true}}},unknown:{retained:7}});
  ls.setItem('datalab_offline_db',repaired);
  const second=boot(ls);await assert.rejects(second.ready,e=>e.code==='LEGACY_CLIENT_CONFLICT');
  const preview=await second.previewLegacy();assert.equal(preview.migrationOnly,true);
  const result=await second.adoptLegacy({expectedRevision:null,expectedLegacyChecksum:preview.legacyChecksum});assert.equal(result.reloadRequired,true);
  const third=boot(ls);await third.ready;assert.equal((await third.read()).db.unknown.retained,7);
  assert.equal((await third.getRecovery('legacy-original')).rawEntries.datalab_offline_db,'{broken');
  assert.equal(ls.getItem('datalab_offline_db'),repaired);
});
test('missing IndexedDB fails closed and leaves original raw data untouched',async()=>{
  const raw=JSON.stringify({users:{offline_user:{uid:'offline_user',progress:{safe:true}}}});const ls=store({datalab_offline_db:raw});
  const s=boot(ls,{unavailable:true});await assert.rejects(s.ready,e=>e.code==='STORAGE_UNAVAILABLE');
  await assert.rejects(s.mutate(state=>{state.db.users.offline_user.progress={};}));assert.equal(ls.getItem('datalab_offline_db'),raw);
});
test('derived database mirrors cannot be silently overwritten as preferences',async()=>{
  const s=boot();await s.ready;for(const key of ['datalab_offline_db','anonymous_progress','datalab_anonymous_import_v1']){
    await assert.rejects(s.setKV(key,'{}'),e=>e.code==='DERIVED_KEY');await assert.rejects(s.removeKV(key),e=>e.code==='DERIVED_KEY');
  }
  await s.setKV('exc-draft:offline_user:test','');assert.equal(await s.getKV('exc-draft:offline_user:test'),'');
});

test('valid backup can bootstrap failed migration with reviewed raw checksum and immutable original',async()=>{
  const source=boot();await source.ready;await source.mutate(s=>{s.db.unknown.backupValue=91;});const backup=await source.recoverySnapshot();
  const ls=store({datalab_offline_db:'{broken',anonymous_progress:'{also-broken'});const target=boot(ls);await assert.rejects(target.ready);
  const status=await target.recoveryStatus();assert.equal(status.hasState,false);assert.equal(status.revision,null);
  await assert.rejects(target.bootstrapRestore(backup,{expectedRevision:null,expectedLegacyChecksum:'stale'}),e=>e.code==='LEGACY_CLIENT_CONFLICT');
  assert.equal((await target.recoveryStatus()).hasState,false);
  let puts=0;Object.defineProperty(ls,'fail',{configurable:true,get(){return ++puts===2;}});
  await assert.rejects(target.bootstrapRestore(backup,{expectedRevision:null,expectedLegacyChecksum:status.currentLegacyChecksum}));
  delete ls.fail;assert.equal((await target.recoveryStatus()).hasState,false);
  assert.equal(ls.getItem('datalab_offline_db'),'{broken');
  const restored=await target.bootstrapRestore(backup,{expectedRevision:null,expectedLegacyChecksum:status.currentLegacyChecksum});assert.equal(restored.reloadRequired,true);
  assert.equal(ls.getItem('datalab_offline_db'),'{broken');assert.equal(ls.getItem('anonymous_progress'),'{also-broken');
  assert.equal((await target.getRecovery('legacy-original')).rawEntries.datalab_offline_db,'{broken');
  assert.equal((await target.getRecovery(restored.recoveryId)).incomingSnapshot.state.db.unknown.backupValue,91);
  const reloaded=boot(ls);await reloaded.ready;assert.equal((await reloaded.read()).db.unknown.backupValue,91);
  await assert.rejects(reloaded.bootstrapRestore(backup,{expectedRevision:null,expectedLegacyChecksum:(await reloaded.recoveryStatus()).currentLegacyChecksum}),e=>e.code==='REVISION_CONFLICT');
});
