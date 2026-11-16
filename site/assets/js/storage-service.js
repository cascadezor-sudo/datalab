(function () {
  'use strict';
  if (window.DataLabStorage && !window.DataLabStorage.__pending) return;
  const clone = x => x === undefined ? undefined : JSON.parse(JSON.stringify(x));
  const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const listeners = new Set();
  let connection, config, cached, failure, activeLegacy, channel;
  let startResolve, startReject;
  const ready = new Promise((resolve,reject) => { startResolve=resolve; startReject=reject; });
  ready.catch(() => {});
  function error(code,message) { return Object.assign(new Error(message),{code}); }
  function notifyError(e) {
    failure=e;
    window.dispatchEvent(new CustomEvent('datalab_storage_error',{detail:{code:e.code || e.name,message:e.message}}));
  }
  const exact = new Set(['datalab_offline_db','anonymous_progress','datalab_anonymous_import_v1','theme','palette','lang','course-roadmap-demo-state','start_diagnostic_result','start_diagnostic_progress','introShown','questionsTocCollapsed','dictionaryTocCollapsed','newsPanelState','lastFactDate','dailyFactSeen','datalab_nav_role_cache_v1','datalab_nav_learning_format_v1']);
  function managed(k) { return exact.has(k) || /^(exc-draft:|math-answer:|page_completion_|main-daily-goal:|staff-selected-student:)/.test(k) || /_offline_db$/.test(k); }
  function legacy() {
    const entries={};
    for (let i=0;i<localStorage.length;i++) {const k=localStorage.key(i); if (managed(k)) entries[k]=localStorage.getItem(k);}
    return Object.fromEntries(Object.entries(entries).sort((a,b)=>a[0].localeCompare(b[0])));
  }
  const stable = x => JSON.stringify(x);
  const displayKeys=new Set(['theme','palette','lang']);
  function legacyEqual(a,b) {const clean=x=>Object.fromEntries(Object.entries(x).filter(([k])=>!displayKeys.has(k)));return stable(clean(a))===stable(clean(b));}
  function projectPreferences(state) {for(const key of displayKeys) {try{if(own(state.kv,key))localStorage.setItem(key,state.kv[key]);else localStorage.removeItem(key);}catch(e){window.dispatchEvent(new CustomEvent('datalab_storage_projection_error',{detail:{message:'Настройка сохранена, но раннее оформление страницы может не обновиться.'}}));}}}

  async function checksum(x) {
    if (!window.crypto || !window.crypto.subtle) throw error('CRYPTO_UNAVAILABLE','Для проверки резервной копии нужен безопасный адрес HTTPS или localhost.');
    const bytes = new TextEncoder().encode(stable(x));
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
  }
  function open() { return new Promise((resolve,reject)=>{
    if (!window.indexedDB) return reject(error('STORAGE_UNAVAILABLE','IndexedDB недоступен. Изменения не сохраняются.'));
    const req=indexedDB.open('datalab-state-v2',1);
    req.onupgradeneeded=()=>{req.result.createObjectStore('records');req.result.createObjectStore('recovery');};
    req.onerror=()=>reject(req.error); req.onblocked=()=>reject(error('STORAGE_BLOCKED','Закройте другие вкладки DataLab для обновления хранилища.'));
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(req.result);};
  }); }
  function transaction(mode, callback) { return new Promise((resolve,reject)=>{
    let result, thrown;
    const tx=connection.transaction(['records','recovery'],mode);
    const records=tx.objectStore('records'), recovery=tx.objectStore('recovery');
    const req=records.get('state');
    req.onsuccess=()=>{try {result=callback(req.result,records,recovery);if(result && typeof result.then==='function') throw error('ASYNC_MUTATOR','Mutation callbacks must be synchronous');}catch(e){thrown=e;tx.abort();}};
    tx.oncomplete=()=>resolve(result);
    tx.onabort=()=>reject(thrown || tx.error || error('TRANSACTION_ABORTED','Изменения не сохранены: транзакция прервана.'));
    tx.onerror=()=>{};
  }); }
  function validate(state) {
    if (!state || typeof state!=='object' || !state.db || typeof state.db!=='object' || Array.isArray(state.db) || !state.db.users || typeof state.db.users!=='object' || Array.isArray(state.db.users) || !state.kv || typeof state.kv!=='object' || Array.isArray(state.kv)) throw error('INVALID_STATE','Неверный формат данных.');
    JSON.parse(JSON.stringify(state), (k,v)=>{if (['__proto__','prototype','constructor'].includes(k)) throw error('UNSAFE_KEY','Недопустимое имя поля.');return v;});
    for (const [k,v] of Object.entries(state.kv)) if (!managed(k) || typeof v!=='string') throw error('INVALID_KV','Недопустимый ключ настроек.');
  }
  function project(state) {
    state.kv.datalab_offline_db=JSON.stringify(state.db);
    state.kv.anonymous_progress=JSON.stringify(state.db.users.offline_user && state.db.users.offline_user.progress || {});
    state.kv.datalab_anonymous_import_v1="true";
  }
  function build(raw) {
    let db;
    if (own(raw,'datalab_offline_db')) db=JSON.parse(raw.datalab_offline_db);
    else {
      const candidates=Object.keys(raw).filter(k=>/_offline_db$/.test(k)).map(k=>JSON.parse(raw[k])).filter(v=>v && v.users && v.users.offline_user && v.users.offline_user.uid==='offline_user');
      if(candidates.length>1) throw error('AMBIGUOUS_LEGACY','Найдено несколько старых баз. Нужен явный выбор резервной копии.');
      db=candidates[0] || config.initialDb();
    }
    const state={db:clone(db),kv:clone(raw),revision:0}; validate(state);
    if(config.migrate) config.migrate(state.db,state.kv);
    validate(state);project(state);return state;
  }
  function publish(state) {
    if(cached && state.revision < cached.revision) return;
    cached=clone(state); projectPreferences(state); listeners.forEach(cb=>{try{cb(clone(state));}catch(e){console.error(e);}});
  }
  async function initialize() {
    try {
      connection=await open();
      const raw=legacy(), digest=await checksum(raw);
      // Archive is committed and read back before any migration is attempted.
      await transaction('readwrite',(state,records,recovery)=>{if(!state) { const req=recovery.get('legacy-original'); req.onsuccess=()=>{if(!req.result) recovery.put({id:'legacy-original',rawEntries:raw,checksum:digest,createdAt:Date.now()},'legacy-original');}; }});
      if(!await transaction('readonly',(state,records,recovery)=>state || null)) {
        const archive=await getRecord('legacy-original');
        if(!archive || await checksum(archive.rawEntries)!==archive.checksum) throw error('BACKUP_VERIFY_FAILED','Не удалось проверить исходную резервную копию.');
        if(stable(raw)!==stable(archive.rawEntries)) throw error('LEGACY_CLIENT_CONFLICT','Старые данные изменились после создания исходной копии. Сохраните копию и перезапустите контролируемый перенос.');
        const next=build(archive.rawEntries);
        await transaction('readwrite',(state,records)=>{if(!state){next.legacyBaseline=archive.rawEntries;next.schemaVersion=1;records.put(next,'state');}});
      }
      const state=await transaction('readonly',s=>s);
      if(state.schemaVersion!==1) throw error('INCOMPATIBLE_VERSION','Версия базы не поддерживается.');
      activeLegacy=state.legacyBaseline;
      const changedPreferences=Array.from(displayKeys).filter(k=>(own(raw,k)?raw[k]:null)!==(own(state.kv,k)?state.kv[k]:null));
      if(changedPreferences.length){const id='legacy-preference-start-'+Date.now()+'-'+Math.random().toString(36).slice(2);await transaction('readwrite',(s,r,recovery)=>{recovery.put({id,rawEntries:raw,checksum:digest,changedPreferences,revision:s.revision,createdAt:Date.now()},id);});}
      publish(state);
      if(window.BroadcastChannel){channel=new BroadcastChannel('datalab-state-v2');channel.onmessage=()=>read().then(publish).catch(notifyError);}
      startResolve(service);
    } catch(e){notifyError(e);startReject(e);}
  }
  function getRecord(id) {return new Promise((resolve,reject)=>{const tx=connection.transaction('recovery','readonly');const req=tx.objectStore('recovery').get(id);let value;req.onsuccess=()=>value=req.result;tx.oncomplete=()=>resolve(value);tx.onabort=()=>reject(tx.error);});}
  async function read() {await ready;const s=await transaction('readonly',s=>s);if(!s || s.schemaVersion!==1) throw error('INCOMPATIBLE_VERSION','Версия базы не поддерживается.');if(!cached || s.revision >= cached.revision) cached=clone(s);return clone(s);}
  async function recordDivergence(raw) {
    const digest=await checksum(raw),id='legacy-divergence-'+digest;
    let committed;
    await transaction('readwrite',(s,r,recovery)=>{
      recovery.put({id,rawEntries:raw,checksum:digest,createdAt:Date.now(),revision:s.revision},id);
      if(!s.legacyConflict){s.legacyConflict={recoveryId:id,detectedAt:Date.now()};s.revision++;r.put(s,'state');}
      committed=s;
    });
    publish(committed);if(channel)channel.postMessage({revision:committed.revision});
    throw Object.assign(error('LEGACY_CLIENT_CONFLICT','Старая вкладка изменила данные. Запись остановлена. Закройте старые вкладки и откройте восстановление данных.'),{recorded:true});
  }
  async function mutate(fn,options) {
    await ready;
    try {
      const raw=legacy(); const before=await read();
      if(!legacyEqual(raw,before.legacyBaseline)) return await recordDivergence(raw);
      let committed;
      const result=await transaction('readwrite',(state,records,recovery)=>{
        if(state.schemaVersion!==1) throw error('INCOMPATIBLE_VERSION','Версия базы не поддерживается.');
        if(state.legacyConflict)throw error('LEGACY_CLIENT_CONFLICT','Обнаружена старая вкладка. Требуется явное восстановление данных.');
        if(!legacyEqual(legacy(),state.legacyBaseline)) throw error('LEGACY_CLIENT_CONFLICT','Старая вкладка изменила данные. Запись остановлена.');
        if(options && options.expectedRevision!==undefined && options.expectedRevision!==state.revision) throw error('REVISION_CONFLICT','Данные изменились после предварительного просмотра. Повторите просмотр.');
        const work=clone(state);const result=fn(work,recovery);
        if(result && typeof result.then==='function') {if(result.catch)result.catch(()=>{});throw error('ASYNC_MUTATOR','Mutation callback must be synchronous');}
        validate(work);if(work.schemaVersion!==1)throw error("INCOMPATIBLE_VERSION","Версия базы не поддерживается.");work.legacyBaseline=state.legacyBaseline;project(work);work.revision=state.revision+1;records.put(work,'state');committed=work;return result;
      });
      publish(committed);if(channel)channel.postMessage({revision:committed.revision});
      // A legacy client cannot join the IDB transaction. Detect the race after commit and fail visibly; both trees remain recoverable.
      if(!legacyEqual(legacy(),committed.legacyBaseline)) await recordDivergence(legacy());
      return result;
    }catch(e){if(e.code==='LEGACY_CLIENT_CONFLICT' && !e.recorded){try{await recordDivergence(legacy());}catch(recorded){e=recorded;}}notifyError(e);throw e;}
  }
  async function restore(snapshot,options) {
    if(!snapshot || snapshot.schemaVersion!==1)throw error("INCOMPATIBLE_VERSION","Версия резервной копии не поддерживается.");
    if(!options || !Number.isSafeInteger(options.expectedRevision))throw error("REVISION_REQUIRED","Сначала выполните предварительный просмотр восстановления.");
    validate(snapshot.state);
    const id='restore-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    let revision;
    await mutate((state,recovery)=>{recovery.put({id,state:clone(state),createdAt:Date.now(),revision:state.revision},id);state.db=clone(snapshot.state.db);state.kv=clone(snapshot.state.kv);revision=state.revision+1;},options);
    return {revision,recoveryId:id};
  }
  async function retryMigration(options) {
    if(!connection)throw error('STORAGE_UNAVAILABLE','Хранилище недоступно.');
    const raw=legacy(),digest=await checksum(raw);
    if(!options || options.expectedRevision!==null || options.expectedLegacyChecksum!==digest)throw error('LEGACY_CLIENT_CONFLICT','Повторите предварительный просмотр исправленных данных.');
    const id='migration-retry-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    await transaction('readwrite',(state,r,recovery)=>{if(state)throw error('REVISION_CONFLICT','База уже активирована. Перезагрузите страницу.');recovery.put({id,rawEntries:raw,checksum:digest,createdAt:Date.now()},id);});
    const archive=await getRecord(id);if(await checksum(archive.rawEntries)!==archive.checksum)throw error('BACKUP_VERIFY_FAILED','Резервная копия не прошла проверку.');
    const state=build(archive.rawEntries);state.schemaVersion=1;state.legacyBaseline=raw;
    await transaction('readwrite',(existing,r)=>{if(existing)throw error('REVISION_CONFLICT','База уже активирована.');if(stable(legacy())!==stable(raw))throw error('LEGACY_CLIENT_CONFLICT','Исходные данные изменились после просмотра.');r.put(state,'state');});
    publish(state);if(!legacyEqual(legacy(),state.legacyBaseline))await recordDivergence(legacy());
    return {revision:state.revision,recoveryId:id,reloadRequired:true};
  }
  async function recoveryStatus() {
    await ready.catch(()=>{});
    if(!connection)throw error('STORAGE_UNAVAILABLE','Хранилище недоступно.');
    const state=await transaction('readonly',s=>s);
    if(state && state.schemaVersion!==1)throw error('INCOMPATIBLE_VERSION','Версия базы не поддерживается.');
    return {hasState:!!state,revision:state?state.revision:null,currentLegacyChecksum:await checksum(legacy())};
  }
  async function bootstrapRestore(snapshot,options) {
    await ready.catch(()=>{});
    if(!connection)throw error('STORAGE_UNAVAILABLE','Хранилище недоступно.');
    if(!snapshot || snapshot.schemaVersion!==1)throw error('INCOMPATIBLE_VERSION','Версия резервной копии не поддерживается.');
    validate(snapshot.state);
    const raw=legacy(),digest=await checksum(raw);
    if(!options || options.expectedRevision!==null || options.expectedLegacyChecksum!==digest)throw error('LEGACY_CLIENT_CONFLICT','Исходные данные изменились. Повторите предварительный просмотр.');
    const id='bootstrap-restore-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    await transaction('readwrite',(state,r,recovery)=>{
      if(state)throw error('REVISION_CONFLICT','Основная база уже активирована. Перезагрузите страницу.');
      const request=recovery.get('legacy-original');request.onsuccess=()=>{if(!request.result)recovery.put({id:'legacy-original',rawEntries:raw,checksum:digest,createdAt:Date.now()},'legacy-original');};
      recovery.put({id,rawEntries:raw,checksum:digest,incomingSnapshot:clone(snapshot),createdAt:Date.now()},id);
    });
    const archive=await getRecord(id),original=await getRecord('legacy-original');
    if(!archive || await checksum(archive.rawEntries)!==archive.checksum || !original || await checksum(original.rawEntries)!==original.checksum)throw error('BACKUP_VERIFY_FAILED','Исходная резервная копия не прошла проверку.');
    const state={db:clone(snapshot.state.db),kv:clone(snapshot.state.kv),schemaVersion:1,revision:0,legacyBaseline:raw};
    project(state);validate(state);
    await transaction('readwrite',(existing,r)=>{
      if(existing)throw error('REVISION_CONFLICT','Основная база уже активирована. Перезагрузите страницу.');
      if(stable(legacy())!==stable(raw))throw error('LEGACY_CLIENT_CONFLICT','Исходные данные изменились после просмотра.');
      r.put(state,'state');
    });
    cached=clone(state);if(!legacyEqual(legacy(),state.legacyBaseline))await recordDivergence(legacy());
    return {revision:0,recoveryId:id,reloadRequired:true};
  }
  const service={ready,whenReady:ready,configure(options){if(config)return ready;config=options;initialize();return ready;},read,mutate,
    managedKey:managed,
    async getKV(k){const s=await read();return own(s.kv,k)?s.kv[k]:null;},
    setKV(k,v){return mutate(s=>{if(['datalab_offline_db','anonymous_progress','datalab_anonymous_import_v1'].includes(k))throw error('DERIVED_KEY','Используйте адресное изменение основной базы, а не её копию.');if(!managed(k))throw error('UNMANAGED_KEY','Unsupported storage key');s.kv[k]=String(v);});},
    removeKV(k){return mutate(s=>{if(['datalab_offline_db','anonymous_progress','datalab_anonymous_import_v1'].includes(k))throw error('DERIVED_KEY','Используйте адресное изменение основной базы, а не её копию.');delete s.kv[k];});},
    subscribe(cb){listeners.add(cb);return ()=>listeners.delete(cb);},
    async recoverySnapshot(){const state=await read();const archive=await getRecord('legacy-original');return {schemaVersion:1,state:{db:state.db,kv:state.kv,revision:state.revision},legacy:archive};},
    async getRecovery(id){await ready.catch(()=>{});if(!connection)throw error("STORAGE_UNAVAILABLE","Хранилище недоступно.");return getRecord(id);},
    async listRecovery(){await ready.catch(()=>{});if(!connection)throw error("STORAGE_UNAVAILABLE","Хранилище недоступно.");return new Promise((resolve,reject)=>{const tx=connection.transaction('recovery','readonly');const req=tx.objectStore('recovery').getAll();let values;req.onsuccess=()=>values=req.result;tx.oncomplete=()=>resolve(values.map(v=>({id:v.id,revision:v.revision,createdAt:v.createdAt})));tx.onabort=()=>reject(tx.error);});},
    restore,retryMigration,recoveryStatus,bootstrapRestore,
    async undoRestore(id,options){const previous=await service.getRecovery(id);if(!previous || !previous.state)throw error('RECOVERY_NOT_FOUND','Резервная копия не найдена.');return restore({schemaVersion:1,state:previous.state},options);},
    async currentLegacySnapshot(){const rawEntries=legacy();return {rawEntries,checksum:await checksum(rawEntries)};},
    async previewLegacy(){await ready.catch(()=>{});if(!connection)throw error('STORAGE_UNAVAILABLE','Хранилище недоступно.');const state=await transaction('readonly',s=>s);if(state && state.schemaVersion!==1)throw error('INCOMPATIBLE_VERSION','Версия базы не поддерживается.');const current=await service.currentLegacySnapshot();const candidate=build(current.rawEntries);const revision=state?state.revision:null;return {snapshot:{schemaVersion:1,state:{db:candidate.db,kv:candidate.kv,revision:revision===null?0:revision},legacy:current},expectedRevision:revision,legacyChecksum:current.checksum,migrationOnly:!state};},
    async adoptLegacy(options){await ready.catch(()=>{});if(!connection)throw error('STORAGE_UNAVAILABLE','Хранилище недоступно.');const existing=await transaction('readonly',s=>s);if(!existing)return retryMigration(options);if(existing.schemaVersion!==1)throw error('INCOMPATIBLE_VERSION','Версия базы не поддерживается.');const raw=legacy();const digest=await checksum(raw);if(!options || options.expectedLegacyChecksum!==digest)throw error('LEGACY_CLIENT_CONFLICT','Старые данные изменились после просмотра. Повторите просмотр.');const imported=build(raw);const id='adoption-'+Date.now()+'-'+Math.random().toString(36).slice(2);let committed;await transaction('readwrite',(s,r,recovery)=>{if(!options || options.expectedRevision!==s.revision)throw error('REVISION_CONFLICT','Повторите просмотр данных.');if(stable(legacy())!==stable(raw))throw error('LEGACY_CLIENT_CONFLICT','Старые данные снова изменились.');recovery.put({id,state:clone(s),rawEntries:raw,checksum:digest,revision:s.revision,createdAt:Date.now()},id);s.db=imported.db;s.kv=imported.kv;project(s);s.legacyBaseline=raw;delete s.legacyConflict;s.revision++;r.put(s,'state');committed=s;});publish(committed);if(channel)channel.postMessage({revision:committed.revision});return {revision:committed.revision,recoveryId:id};}
  };
  function handled(p){p.catch(notifyError);return p;}
  service.local={getItem(k){return cached && own(cached.kv,k)?cached.kv[k]:null;},setItem(k,v){return handled(service.setKV(k,v));},removeItem(k){return handled(service.removeKV(k));},updateJSON(k,fn){return handled(mutate(s=>{const current=own(s.kv,k)?JSON.parse(s.kv[k]):null;if(['datalab_offline_db','anonymous_progress','datalab_anonymous_import_v1'].includes(k))throw error('DERIVED_KEY','Используйте основную базу.');const next=fn(current);if(next && typeof next.then==='function'){if(next.catch)next.catch(()=>{});throw error('ASYNC_MUTATOR','JSON callback must be synchronous');}s.kv[k]=JSON.stringify(next);}));}};
  window.addEventListener('storage',e=>{
    if(e.key && displayKeys.has(e.key)) {
      read().then(async state=>{
        if((own(state.kv,e.key)?state.kv[e.key]:null)===e.newValue)return;
        const id='legacy-preference-'+Date.now()+'-'+Math.random().toString(36).slice(2);
        const rawEntries=e.newValue===null?{}:{[e.key]:e.newValue};const digest=await checksum(rawEntries);
        await transaction('readwrite',(s,r,recovery)=>{recovery.put({id,rawEntries,checksum:digest,removedKeys:e.newValue===null?[e.key]:[],revision:s.revision,createdAt:Date.now()},id);});
        window.dispatchEvent(new CustomEvent('datalab_legacy_preference_observed',{detail:{key:e.key,recoveryId:id}}));
        projectPreferences(await read());
      }).catch(notifyError);return;
    }
if(!e.key || managed(e.key)){if(cached && !legacyEqual(legacy(),cached.legacyBaseline))recordDivergence(legacy()).catch(notifyError);}});
  window.DataLabStorage=service;
})();
