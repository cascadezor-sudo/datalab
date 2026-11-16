// Real application clients, fresh synthetic origin/context per scenario.
const assert = require('node:assert/strict');
const {chromium}=require('playwright');
const {startServer}=require('../../server/server');
(async()=>{
  process.env.DATALAB_NO_BROWSER='1';
  const server=startServer(0);let browser,passed=0;
  try{
    await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
    const base=`http://127.0.0.1:${server.address().port}`;
    browser=await chromium.launch({headless:true,...(process.env.DATALAB_CHROMIUM?{executablePath:process.env.DATALAB_CHROMIUM}:{})});
    async function open(context,path){const p=await context.newPage();await p.goto(base+path);await p.waitForFunction(()=>window.DataLabStorage && !DataLabStorage.__pending);await p.evaluate(()=>DataLabStorage.ready);return p;}
    async function test(name,fn){if(process.env.DATALAB_STORAGE_CASE&&!new RegExp(process.env.DATALAB_STORAGE_CASE).test(name))return;const context=await browser.newContext();try{await fn(context);passed++;console.log('PASS:',name);}finally{await context.close();}}
    await test('live topic mark, unmark and settings clear propagate to second tab and survive reload',async context=>{
      const a=await open(context,'/python/base.html'),b=await open(context,'/python/base.html');
      for(const p of [a,b])await p.waitForFunction(()=>window.questionProgressTracker?.currentUser?.uid==='offline_user');
      const q=a.locator('li.question').first();await q.locator('.name').click();await q.locator('.difficulty-progress-btn').waitFor();
      await q.locator('.difficulty-progress-btn').click();
      for(const p of [a,b])await p.waitForFunction(()=>document.querySelector('li.question')?.classList.contains('question-completed'));
      await q.locator('.difficulty-progress-btn').click();
      for(const p of [a,b])await p.waitForFunction(()=>!document.querySelector('li.question')?.classList.contains('question-completed'));
      await q.locator('.difficulty-progress-btn').click();
      for(const p of [a,b])await p.waitForFunction(()=>document.querySelector('li.question')?.classList.contains('question-completed'));
      const settings=await open(context,'/profile/settings.html');settings.on('dialog',dialog=>dialog.accept());
      await settings.locator('#clearProgress').click();
      await settings.waitForFunction(async()=>Object.keys((await DataLabStorage.read()).db.users.offline_user.progress).length===0);
      for(const p of [a,b])await p.waitForFunction(()=>!document.querySelector('li.question')?.classList.contains('question-completed'));
      await a.reload();await a.waitForFunction(()=>window.questionProgressTracker?.currentUser?.uid==='offline_user');
      assert.equal(await a.locator('li.question').first().evaluate(el=>el.classList.contains('question-completed')),false);
      assert.deepEqual(await a.evaluate(async()=>JSON.parse(await DataLabStorage.getKV('anonymous_progress'))),{});
    });
    await test('two real repetition clients grade same card from latest transactional state',async context=>{
      const a=await open(context,'/spaced-repetition.html'),b=await open(context,'/spaced-repetition.html');
      for(const p of [a,b])await p.waitForFunction(()=>window.spacedRepetitionSystem?.filteredQueue?.length>0);
      const card=await a.evaluate(()=>spacedRepetitionSystem.filteredQueue[spacedRepetitionSystem.currentIndex]);
      const initial={repetitions:0,intervalDays:0,ease:2.5,syntheticUnknown:'retained'};
      await a.evaluate(({card,initial})=>firebase.database().ref(`users/offline_user/spaced_repetition/${card.id}`).set(initial),{card,initial});
      for(const p of [a,b])await p.evaluate(({card,initial})=>{const s=spacedRepetitionSystem;s.filteredQueue=[card];s.currentIndex=0;s.reviewState[card.id]=initial;s.renderCard();},{card,initial});
      await Promise.all([a,b].map(p=>p.evaluate(()=>spacedRepetitionSystem.gradeCurrentCard('good'))));
      const persisted=await a.evaluate(async id=>(await DataLabStorage.read()).db.users.offline_user.spaced_repetition[id],card.id);
      assert.equal(persisted.repetitions,2);assert.equal(persisted.syntheticUnknown,'retained');
      for(const p of [a,b])assert.equal(await p.evaluate(()=>spacedRepetitionSystem.sessionGraded),1);
      await a.reload();await a.waitForFunction(()=>window.spacedRepetitionSystem?.user?.uid==='offline_user');
      assert.equal(await a.evaluate(async id=>(await DataLabStorage.read()).db.users.offline_user.spaced_repetition[id].repetitions,card.id),2);
    });
    await test('appearance and language commit before reload and native boot projection follows',async context=>{
      const page=await open(context,'/main.html');await page.waitForFunction(()=>typeof applyAppearance==='function'&&typeof switchLanguage==='function');
      page.on('console',msg=>{if(msg.type()==='error')console.log('  appearance console error:',msg.text());});
      await page.evaluate(()=>applyAppearance({theme:'dark',palette:'graphite'}));
      const appearance=await page.evaluate(async()=>{const s=await DataLabStorage.read();return{theme:s.kv.theme,palette:s.kv.palette,nativeTheme:localStorage.getItem('theme'),nativePalette:localStorage.getItem('palette')};});
      if(appearance.theme!=='dark')console.log('  divergent legacy keys:',await page.evaluate(async()=>{const s=await DataLabStorage.read();return Object.keys(localStorage).filter(k=>DataLabStorage.managedKey(k)&&localStorage.getItem(k)!==s.legacyBaseline[k]);}));
      assert.deepEqual(appearance,{theme:'dark',palette:'graphite',nativeTheme:'dark',nativePalette:'graphite'});
      await page.reload();await page.waitForFunction(()=>window.DataLabStorage&&!DataLabStorage.__pending);await page.evaluate(()=>DataLabStorage.ready);
      assert.equal(await page.evaluate(()=>document.documentElement.getAttribute('data-theme')),'dark');
      await Promise.all([page.waitForNavigation(),page.evaluate(()=>switchLanguage('en')).catch(e=>{if(!/context was destroyed|navigation/i.test(e.message))throw e;})]);
      await page.waitForFunction(()=>window.DataLabStorage&&!DataLabStorage.__pending);await page.evaluate(()=>DataLabStorage.ready);
      assert.equal(await page.evaluate(()=>DataLabStorage.getKV('lang')),'en');assert.equal(await page.evaluate(()=>localStorage.getItem('lang')),'en');
    });
    await test('exercise draft survives real editor reload without submission',async context=>{
      const page=await open(context,'/practise/python/base.html');
      let q=page.locator('[data-md-id="filter_positive_even"]');await q.locator('.name').click();await q.locator('.exc-textarea').waitFor();
      const draft='# synthetic unsent draft\nprint(42)';await q.locator('.exc-textarea').fill(draft);
      await page.waitForFunction(async expected=>(await DataLabStorage.getKV('exc-draft:offline_user:filter_positive_even'))===expected,draft);
      await page.reload();q=page.locator('[data-md-id="filter_positive_even"]');await q.locator('.name').click();await q.locator('.exc-textarea').waitFor();
      await page.waitForFunction(expected=>document.querySelector('[data-md-id="filter_positive_even"] .exc-textarea')?.value===expected,draft);
      assert.equal(await q.locator('.exc-textarea').inputValue(),draft);
      await q.locator('.exc-textarea').fill('');
      await page.waitForFunction(async()=>(await DataLabStorage.getKV('exc-draft:offline_user:filter_positive_even'))==='');
      await page.reload();q=page.locator('[data-md-id="filter_positive_even"]');await q.locator('.name').click();await q.locator('.exc-textarea').waitFor();
      await page.waitForFunction(()=>document.querySelector('[data-md-id="filter_positive_even"] .exc-textarea')?.value==='');
      assert.equal(await q.locator('.exc-textarea').inputValue(),'');

    });
    await test('profile settings save synthetic fields and retain them on reload',async context=>{
      const page=await open(context,'/profile/settings.html');page.on('dialog',dialog=>dialog.accept());
      // Storage readiness precedes async config/gamification/profile hydration.
      // loadUserProfile fills email after assigning the editable fields and then
      // sets the initial disabled state; wait for that UI state before typing.
      await page.waitForFunction(()=>{
        const email=window.firebase?.auth().currentUser?.email;
        return typeof email==='string'&&email.length>0&&document.getElementById('email')?.value===email&&document.getElementById('saveBtn')?.disabled===true;
      });
      await page.locator('#firstName').fill('Synthetic');await page.locator('#lastName').fill('Learner');await page.locator('#telegram').fill('@synthetic_learner');
      await page.locator('#saveBtn').click();
      await page.waitForFunction(async()=>{const u=(await DataLabStorage.read()).db.users.offline_user;return u.firstName==='Synthetic'&&u.lastName==='Learner'&&u.telegram==='@synthetic_learner';});
      await page.reload();await page.locator('#firstName').waitFor();await page.waitForFunction(()=>document.getElementById('firstName')?.value==='Synthetic');
      assert.equal(await page.locator('#lastName').inputValue(),'Learner');
      assert.equal(await page.locator('#telegram').inputValue(),'@synthetic_learner');
    });
    await test('kanban real create form persists task and reload shows card',async context=>{
      const page=await open(context,'/calender/index.html');
      // Creation controls are intentionally hidden for student role in CSS.
      // Seed a synthetic mentor role through the real service, then use UI.
      await page.evaluate(()=>firebase.database().ref('users/offline_user/role').set('mentor'));await page.reload();
      await page.locator('#kanban-create-btn').click();
      await page.locator('#kanban-title').fill('Synthetic reliability task');await page.locator('#kanban-student').selectOption('offline_user');await page.locator('#kanban-save').click();
      await page.waitForFunction(async()=>Object.values((await DataLabStorage.read()).db.kanbanTasks||{}).some(t=>t.title==='Synthetic reliability task'));
      await page.reload();await page.getByText('Synthetic reliability task',{exact:true}).first().waitFor();
    });
    await test('roadmap milestone real completion persists across reload',async context=>{
      const page=await open(context,'/calender/roadmap.html');
      await page.evaluate(()=>firebase.database().ref('users/offline_user/role').set('mentor'));await page.reload();
      const button=page.locator('[data-action="complete"][data-milestone-id]').first();await button.waitFor();
      const id=await button.getAttribute('data-milestone-id');await button.click();
      await page.waitForFunction(async id=>(await DataLabStorage.read()).db.studentRoadmaps?.offline_user?.milestones?.[id]?.status==='done',id);
      await page.reload();
      await page.locator(`[data-action="reopen"][data-milestone-id="${id}"]`).waitFor();
      assert.equal(await page.evaluate(async id=>(await DataLabStorage.read()).db.studentRoadmaps.offline_user.milestones[id].status,id),'done');
    });
    console.log(`PASS: ${passed} application storage client scenarios`);
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
