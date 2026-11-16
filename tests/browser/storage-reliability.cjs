// Real Chromium, fresh nonpersistent contexts and synthetic values only.
// No user browser profile, persistent context or external host is used.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer } = require('../../server/server');

(async () => {
  process.env.DATALAB_NO_BROWSER = '1';
  const server = startServer(0);
  let browser;
  let passed = 0;
  try {
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true, ...(process.env.DATALAB_CHROMIUM ? { executablePath: process.env.DATALAB_CHROMIUM } : {}) });
    async function document(context, init, configure = true) {
      const page = await context.newPage();
      await page.goto(base + '/__phase11_synthetic_probe__');
      if (init) await page.evaluate(init);
      await page.addScriptTag({url: base + '/assets/js/storage-service.js'});
      if (configure) {
        await page.addScriptTag({url: base + '/assets/js/firebase-mock.js'});
        await page.evaluate(() => DataLabStorage.ready);
      }
      return page;
    }
    async function scenario(name, callback) {
      if (process.env.DATALAB_STORAGE_CASE && !new RegExp(process.env.DATALAB_STORAGE_CASE).test(name)) return;
      const context = await browser.newContext();
      try { await callback(context); passed++; console.log('PASS:', name); }
      finally { await context.close(); }
    }
    for (const tabs of [2, 3, 5]) for (const operations of [25, 100, 500]) {
      await scenario(`${tabs} tabs x ${operations} committed independent writes, no Web Locks`, async context => {
        await context.addInitScript(() => Object.defineProperty(navigator, 'locks', {value: undefined, configurable: true}));
        const pages = [];
        for (let i = 0; i < tabs; i++) pages.push(await document(context));
        await pages[0].evaluate(() => firebase.database().ref('synthetic').set({retained: 'unchanged'}));
        const receipts = await Promise.all(pages.map((page, tab) => page.evaluate(async ({tab, operations}) => {
          let acknowledged = 0;
          for (let op = 0; op < operations; op++) {
            // Deliberately vary scheduling before operations. Never delay a read
            // to mask a race or perform a repair after an acknowledged commit.
            if (op % 17 === 0) await new Promise(resolve => setTimeout(resolve, tab % 3));
            const branch = ['progress', 'achievements', 'repetition', 'drafts', 'settings'][tab % 5];
            await firebase.database().ref(`synthetic/${branch}/tab${tab}_${op}`).set({tab, op});
            acknowledged++;
          }
          return acknowledged;
        }, {tab, operations})));
        assert.deepEqual(receipts, Array(tabs).fill(operations));
        const observer = await document(context);
        const data = await observer.evaluate(async () => (await DataLabStorage.read()).db.synthetic);
        assert.equal(data.retained, 'unchanged');
        for (let tab = 0; tab < tabs; tab++) for (let op = 0; op < operations; op++) {
          const branch = ['progress', 'achievements', 'repetition', 'drafts', 'settings'][tab % 5];
          assert.deepEqual(data[branch][`tab${tab}_${op}`], {tab, op}, `missing acknowledged tab${tab}_${op}`);
        }
      });
    }
    await scenario('same-key atomic increments serialize and mark/unmark has committed final state', async context => {
      const pages = [await document(context), await document(context), await document(context)];
      await Promise.all(pages.map(page => page.evaluate(async () => {
        for (let i = 0; i < 100; i++) await DataLabStorage.mutate(state => {
          state.db.syntheticCounter = (state.db.syntheticCounter || 0) + 1;
        });
      })));
      assert.equal(await pages[0].evaluate(async () => (await DataLabStorage.read()).db.syntheticCounter), 300);
      await Promise.all(pages.map((page, tab) => page.evaluate(value => firebase.database().ref('syntheticMark').set(value), tab % 2 === 0)));
      const final = await pages[0].evaluate(async () => (await DataLabStorage.read()).db.syntheticMark);
      assert.equal(typeof final, 'boolean');
      // Resolve the conflict explicitly: after this acknowledged operation no
      // competing writer remains, therefore every subsequent read must be false.
      await pages[1].evaluate(() => firebase.database().ref('syntheticMark').set(false));
      for (const page of pages) assert.equal(await page.evaluate(async () => (await DataLabStorage.read()).db.syntheticMark), false);
    });
    await scenario('atomic batch, repeated same-value set, clear vs independent draft, reload read-after-commit', async context => {
      const a = await document(context), b = await document(context);
      await a.evaluate(async () => {
        await DataLabStorage.mutate(state => {state.db.syntheticProgress = {old: true}; state.db.syntheticUnknown = {preserve: 'yes'};});
        await firebase.database().ref('syntheticDuplicate').set({same: 1});
        await firebase.database().ref('syntheticDuplicate').set({same: 1});
      });
      await Promise.all([
        a.evaluate(() => DataLabStorage.mutate(state => {state.db.syntheticProgress = {}; state.db.syntheticClearMarker = true;})),
        b.evaluate(() => DataLabStorage.mutate(state => {state.db.syntheticDraft = 'typed during clear';}))
      ]);
      await a.reload();
      await a.addScriptTag({url: base + '/assets/js/storage-service.js'});
      await a.addScriptTag({url: base + '/assets/js/firebase-mock.js'});
      await a.evaluate(() => DataLabStorage.ready);
      const state = await a.evaluate(async () => (await DataLabStorage.read()).db);
      assert.deepEqual(state.syntheticProgress, {});
      assert.equal(state.syntheticClearMarker, true);
      assert.equal(state.syntheticDraft, 'typed during clear');
      assert.deepEqual(state.syntheticDuplicate, {same: 1});
      assert.deepEqual(state.syntheticUnknown, {preserve: 'yes'});
    });
    for (const fault of ['QuotaExceededError', 'UnknownError', 'abort']) {
      await scenario(`real IDB transaction ${fault}: reject, no partial commit, retry succeeds`, async context => {
        const page = await document(context);
        const outcome = await page.evaluate(async fault => {
          await DataLabStorage.mutate(state => {state.db.syntheticFault = {retained: true};});
          const original = IDBObjectStore.prototype.put;
          IDBObjectStore.prototype.put = function(...args) {
            if (fault === 'abort') {const request = original.apply(this, args); this.transaction.abort(); return request;}
            throw new DOMException('Synthetic write fault', fault);
          };
          let rejected = false;
          try {await DataLabStorage.mutate(state => {state.db.syntheticFault.bad = true;});}
          catch (error) {rejected = true;}
          finally {IDBObjectStore.prototype.put = original;}
          const afterFailure = (await DataLabStorage.read()).db.syntheticFault;
          await DataLabStorage.mutate(state => {state.db.syntheticFault.retry = true;});
          return {rejected, afterFailure, afterRetry: (await DataLabStorage.read()).db.syntheticFault};
        }, fault);
        assert.equal(outcome.rejected, true, 'a failed transaction must never acknowledge success');
        assert.deepEqual(outcome.afterFailure, {retained: true});
        assert.deepEqual(outcome.afterRetry, {retained: true, retry: true});
      });
    }
    await scenario('mutator exception aborts entire batch', async context => {
      const page = await document(context);
      const result = await page.evaluate(async () => {
        let rejected = false;
        try {await DataLabStorage.mutate(state => {state.db.syntheticAbort = 1; throw new Error('Synthetic callback failure');});}
        catch (_) {rejected = true;}
        return {rejected, present: Object.hasOwn((await DataLabStorage.read()).db, 'syntheticAbort')};
      });
      assert.deepEqual(result, {rejected: true, present: false});
    });
    for (const interruption of ['close', 'reload']) await scenario(`${interruption} writer during queued work preserves all acknowledged writes and batch atomicity`, async context => {
      const observer = await document(context), writer = await document(context);
      const acknowledged = [];
      await writer.exposeFunction('recordCommit', index => {acknowledged.push(index);});
      await writer.evaluate(() => {
        window.syntheticLoop = (async () => {
          for (let i = 0; i < 500; i++) {
            await DataLabStorage.mutate(state => {
              state.db.syntheticClose = state.db.syntheticClose || {};
              state.db.syntheticClose[i] = {left: i, right: i};
            });
            await window.recordCommit(i);
            window.syntheticAcknowledged = i + 1;
          }
        })();
      });
      await writer.waitForFunction(() => window.syntheticAcknowledged >= 10);
      assert.ok(acknowledged.length >= 10, 'close test requires confirmed receipts before interruption');
      // Closing can abort the pending operation, or let it commit. Neither is
      // a success claim; only callbacks already received are required durable.
      if (interruption === 'close') await writer.close();
      else await writer.reload();
      const state = await observer.evaluate(async () => (await DataLabStorage.read()).db.syntheticClose || {});
      for (const index of acknowledged) assert.deepEqual(state[index], {left: index, right: index});
      for (const [key, value] of Object.entries(state)) assert.deepEqual(value, {left: Number(key), right: Number(key)});
      console.log('  committed receipts before close:', acknowledged.length, '; atomic records after close:', Object.keys(state).length);
    });
    await scenario('concurrent real achievement API preserves progress and grants one event per award', async context => {
      await context.route('**/assets/data/achievements/catalog.json',route=>route.fulfill({json:{achievements:[{id:'synthetic-award',title:'Synthetic',rule:{type:'questions',min:1}}]}}));
      const pages=[await document(context),await document(context)];
      await Promise.all(pages.map((page,tab)=>page.evaluate(async tab=>{
        for(let i=0;i<25;i++)await achievementApi.setQuestionProgress(`synthetic${tab}_${i}`,true);
      },tab)));
      const result=await pages[0].evaluate(async()=>{
        const db=(await DataLabStorage.read()).db;
        return {progress:db.users.offline_user.progress,award:db.user_achievements.offline_user['synthetic-award'],events:Object.values(db.achievement_events.offline_user).filter(x=>x.achievementId==='synthetic-award')};
      });
      for(let tab=0;tab<2;tab++)for(let i=0;i<25;i++)assert.equal(result.progress[`synthetic${tab}_${i}`].completed,true);
      assert.ok(result.award);assert.equal(result.events.length,1);
      await pages[1].evaluate(()=>achievementApi.setQuestionProgress('synthetic0_0',false));
      assert.equal(await pages[0].evaluate(async()=>Object.hasOwn((await DataLabStorage.read()).db.users.offline_user.progress,'synthetic0_0')),false);
    });
    await scenario('cross-tab subscription observes authoritative commit', async context => {
      const a = await document(context), b = await document(context);
      await b.evaluate(() => {
        window.syntheticNotified = false;
        DataLabStorage.subscribe(state => {if (state.db.syntheticNotice === 'committed') window.syntheticNotified = true;});
      });
      await a.evaluate(() => firebase.database().ref('syntheticNotice').set('committed'));
      await b.waitForFunction(() => window.syntheticNotified === true);
      assert.equal(await b.evaluate(async () => (await DataLabStorage.read()).db.syntheticNotice), 'committed');
    });
    await scenario('legacy migration preserves raw archive, unknown fields, markers and anonymous import across reload', async context => {
      const page = await document(context, () => {
        const legacy = {users:{offline_user:{uid:'offline_user',progress:{retained:{completed:true,unknown:'legacy'}}}},unknownBranch:{nested:[1,'two']}};
        localStorage.setItem('datalab_offline_db', JSON.stringify(legacy));
        localStorage.setItem('anonymous_progress', JSON.stringify({anonymousOnly:{completed:true}}));
        localStorage.setItem('exc-draft:anon:synthetic', 'draft');
        localStorage.setItem('theme', 'dark');
      });
      const state = await page.evaluate(async () => {
        const current = await DataLabStorage.read();
        const archive = await DataLabStorage.getRecovery('legacy-original');
        return {current, archive, raw: localStorage.getItem('datalab_offline_db')};
      });
      assert.deepEqual(state.current.db.unknownBranch, {nested:[1,'two']});
      assert.deepEqual(state.current.db.users.offline_user.progress.retained, {completed:true,unknown:'legacy'});
      assert.deepEqual(state.current.db.users.offline_user.progress.anonymousOnly, {completed:true});
      assert.equal(state.current.kv['exc-draft:anon:synthetic'], 'draft');
      assert.equal(state.archive.rawEntries.datalab_offline_db, state.raw);
      assert.equal(state.current.db.datalab_migrations.anonymous_progress_v1, true);
      assert.equal(state.current.kv.datalab_anonymous_import_v1, 'true');
      await page.evaluate(() => firebase.database().ref('users/offline_user/progress').set({}));
      await page.reload();
      await page.addScriptTag({url:base + '/assets/js/storage-service.js'});
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      await page.evaluate(() => DataLabStorage.ready);
      assert.deepEqual(await page.evaluate(async () => (await DataLabStorage.read()).db.users.offline_user.progress), {});
    });
    for (const marker of ['internal', 'external']) await scenario(`${marker} anonymous marker independently prevents deleted-progress resurrection`, async context => {
      const page = await document(context, () => {
        localStorage.setItem('datalab_offline_db',JSON.stringify({users:{offline_user:{uid:'offline_user',progress:{}}}}));
        localStorage.setItem('anonymous_progress',JSON.stringify({mustRemainDeleted:{completed:true}}));
      }, false);
      await page.evaluate(marker => {
        if (marker === 'external') localStorage.setItem('datalab_anonymous_import_v1','true');
        else {const db=JSON.parse(localStorage.getItem('datalab_offline_db'));db.datalab_migrations={anonymous_progress_v1:true,unknownMarker:'keep'};localStorage.setItem('datalab_offline_db',JSON.stringify(db));}
      }, marker);
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      await page.evaluate(() => DataLabStorage.ready);
      const state=await page.evaluate(() => DataLabStorage.read());
      assert.deepEqual(state.db.users.offline_user.progress,{});
      assert.equal(state.db.datalab_migrations.anonymous_progress_v1,true);
      assert.equal(state.kv.datalab_anonymous_import_v1,'true');
      if(marker==='internal')assert.equal(state.db.datalab_migrations.unknownMarker,'keep');
    });
    await scenario('two tabs atomically update one managed draft JSON without lost fields', async context => {
      const a=await document(context),b=await document(context);
      await Promise.all([a,b].map((page,tab)=>page.evaluate(async tab=>{
        for(let i=0;i<25;i++)await DataLabStorage.local.updateJSON('math-answer:anon:synthetic',current=>Object.assign({},current,{['tab'+tab+'_'+i]:i}));
      },tab)));
      const data=await a.evaluate(async()=>JSON.parse(await DataLabStorage.getKV('math-answer:anon:synthetic')));
      for(let tab=0;tab<2;tab++)for(let i=0;i<25;i++)assert.equal(data['tab'+tab+'_'+i],i);
    });
    await scenario('migration activation failure retains original and retry completes once', async context => {
      const page = await document(context, () => {
        localStorage.setItem('datalab_offline_db', JSON.stringify({users:{offline_user:{uid:'offline_user',progress:{before:true}}},unknown:['keep']}));
        const original = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function(...args) {
          if (this.name === 'records') throw new DOMException('Synthetic migration failure','QuotaExceededError');
          return original.apply(this,args);
        };
      }, false);
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      assert.equal(await page.evaluate(() => DataLabStorage.ready.then(() => false, () => true)), true);
      const before = await page.evaluate(async () => {
        const db = await new Promise((resolve,reject) => {const r=indexedDB.open('datalab-state-v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        const result = await new Promise((resolve,reject) => {
          const tx=db.transaction(['records','recovery'],'readonly');const a=tx.objectStore('records').get('state'),b=tx.objectStore('recovery').get('legacy-original');
          tx.oncomplete=()=>resolve({state:a.result || null,archive:b.result,raw:localStorage.getItem('datalab_offline_db')});tx.onabort=()=>reject(tx.error);
        }); db.close(); return result;
      });
      assert.equal(before.state, null);
      assert.equal(before.archive.rawEntries.datalab_offline_db, before.raw);
      await page.reload();
      await page.addScriptTag({url:base + '/assets/js/storage-service.js'});
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      await page.evaluate(() => DataLabStorage.ready);
      const after = await page.evaluate(async () => ({state:await DataLabStorage.read(),archive:await DataLabStorage.getRecovery('legacy-original'),raw:localStorage.getItem('datalab_offline_db')}));
      assert.deepEqual(after.state.db.unknown, ['keep']);
      assert.deepEqual(after.state.db.users.offline_user.progress.before, true);
      assert.equal(after.raw,before.raw);
      assert.equal(after.archive.checksum,before.archive.checksum);
    });
    await scenario('malformed legacy fails closed and changed-source retry cannot overwrite original archive', async context => {
      const page = await document(context, () => localStorage.setItem('datalab_offline_db','{synthetic-invalid'), false);
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      assert.equal(await page.evaluate(() => DataLabStorage.ready.then(() => false, () => true)),true);
      await page.evaluate(() => localStorage.setItem('datalab_offline_db','{"users":{"offline_user":{"uid":"offline_user"}},"replacement":true}'));
      await page.reload();
      await page.addScriptTag({url:base + '/assets/js/storage-service.js'});
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      assert.equal(await page.evaluate(() => DataLabStorage.ready.then(() => false, () => true)),true);
      const archive = await page.evaluate(async () => {
        const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('datalab-state-v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        const result=await new Promise((resolve,reject)=>{const tx=db.transaction(['recovery','records'],'readonly'),r=tx.objectStore('recovery').get('legacy-original'),s=tx.objectStore('records').get('state');tx.oncomplete=()=>resolve({raw:r.result.rawEntries.datalab_offline_db,state:s.result || null});tx.onabort=()=>reject(tx.error);});db.close();return result;
      });
      assert.equal(archive.raw,'{synthetic-invalid');assert.equal(archive.state,null);
      const adoption=await page.evaluate(async()=>{
        const preview=await DataLabStorage.previewLegacy();
        if(preview.migrationOnly!==true || preview.expectedRevision!==null)throw new Error('Expected failed-migration preview');
        return DataLabStorage.adoptLegacy({expectedRevision:preview.expectedRevision,expectedLegacyChecksum:preview.legacyChecksum});
      });
      assert.equal(adoption.reloadRequired,true);
      await page.reload();
      await page.addScriptTag({url:base + '/assets/js/storage-service.js'});
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      await page.evaluate(()=>DataLabStorage.ready);
      assert.equal(await page.evaluate(async()=>(await DataLabStorage.read()).db.replacement),true);
      assert.equal(await page.evaluate(async()=>(await DataLabStorage.getRecovery('legacy-original')).rawEntries.datalab_offline_db),'{synthetic-invalid');
    });
    await scenario('IndexedDB unavailable rejects ready and writes without touching legacy', async context => {
      const page = await document(context, () => {
        localStorage.setItem('datalab_offline_db', '{"users":{"offline_user":{"uid":"offline_user"}},"untouched":true}');
        Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true});
      }, false);
      await page.addScriptTag({url:base + '/assets/js/firebase-mock.js'});
      const result = await page.evaluate(async () => {
        let readyRejected=false,writeRejected=false;
        try{await DataLabStorage.ready;}catch(_){readyRejected=true;}
        try{await DataLabStorage.mutate(s=>s.db.syntheticUnsafe=true);}catch(_){writeRejected=true;}
        return {readyRejected,writeRejected,raw:localStorage.getItem('datalab_offline_db')};
      });
      assert.equal(result.readyRejected,true);assert.equal(result.writeRejected,true);
      assert.equal(JSON.parse(result.raw).untouched,true);
    });
    await scenario('unknown committed schema rejects reads and writes, retains record', async context => {
      const page = await document(context);
      const result = await page.evaluate(async () => {
        const db = await new Promise((resolve,reject) => {const r=indexedDB.open('datalab-state-v2',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
        await new Promise((resolve,reject) => {const tx=db.transaction('records','readwrite'),s=tx.objectStore('records'),r=s.get('state');r.onsuccess=()=>{r.result.schemaVersion=999;r.result.db.syntheticFuture='retained';s.put(r.result,'state');};tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
        let readRejected=false,writeRejected=false;
        try{await DataLabStorage.read();}catch(_){readRejected=true;}
        try{await DataLabStorage.mutate(s=>s.db.syntheticFuture='destroyed');}catch(_){writeRejected=true;}
        const state=await new Promise((resolve,reject)=>{const tx=db.transaction('records','readonly'),r=tx.objectStore('records').get('state');tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);});db.close();
        return {readRejected,writeRejected,version:state.schemaVersion,value:state.db.syntheticFuture};
      });
      assert.deepEqual(result,{readRejected:true,writeRejected:true,version:999,value:'retained'});
    });
    await scenario('old-client writes block new commits and preserve both conflicting states', async context => {
      const current = await document(context), legacy = await context.newPage();
      await current.evaluate(() => firebase.database().ref('syntheticNewClient').set('confirmed'));
      await legacy.goto(base + '/__phase11_legacy_probe__');
      await legacy.evaluate(() => localStorage.setItem('datalab_offline_db',JSON.stringify({users:{offline_user:{uid:'offline_user'}},syntheticOldClient:'legacy-new-value'})));
      const outcome = await current.evaluate(async () => {
        let rejected=false;
        try{await firebase.database().ref('syntheticBlocked').set(true);}catch(_){rejected=true;}
        return {rejected,db:(await DataLabStorage.read()).db,legacy:JSON.parse(localStorage.getItem('datalab_offline_db')),archives:await DataLabStorage.listRecovery()};
      });
      assert.equal(outcome.rejected,true);
      assert.equal(outcome.db.syntheticNewClient,'confirmed');
      assert.equal(Object.hasOwn(outcome.db,'syntheticBlocked'),false);
      assert.equal(outcome.legacy.syntheticOldClient,'legacy-new-value');
      assert.equal(outcome.archives.some(x=>x.id.startsWith('legacy-divergence-')),true);
      const baseline=await current.evaluate(async()=>(await DataLabStorage.read()).legacyBaseline);
      await legacy.evaluate(raw=>{localStorage.clear();for(const [key,value]of Object.entries(raw))localStorage.setItem(key,value);},baseline);
      const latched=await current.evaluate(async()=>{try{await firebase.database().ref('syntheticLatchBypass').set(true);return false;}catch(_){return true;}});
      assert.equal(latched,true,'returning legacy bytes to baseline must not silently clear a recorded conflict');

    });
    console.log(`PASS: ${passed} storage reliability scenarios`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
