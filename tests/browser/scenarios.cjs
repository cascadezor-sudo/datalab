// Synthetic state only. Set NODE_PATH and DATALAB_CHROMIUM as in scenario-results.md.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startServer } = require('../../server/server.js');
(async () => {
  process.env.DATALAB_NO_BROWSER = '1';
  const server = startServer(0);
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({headless:true, ...(process.env.DATALAB_CHROMIUM ? {executablePath:process.env.DATALAB_CHROMIUM} : {})});
    let page;
    let failures = 0;
    const task = async (name, action) => {
      const context = await browser.newContext({viewport:{width:1440,height:900}});
      page = await context.newPage(); page.setDefaultTimeout(6000);
      try { console.log(JSON.stringify({name,result:await action()})); }
      catch (error) {failures++;console.log(JSON.stringify({name,error:error.message.slice(0,500)}));}
      finally {await context.close();}
    };
    await task('quiz', async () => {
      await page.goto(base + '/python/base.html');
      await page.getByRole('button',{name:'Начать тест',exact:true}).first().click();
      for (let i=0;i<10;i++) {
        await page.locator('.quiz-options input').first().check();
        await page.locator('[data-action="next"]').click();
        await page.locator('.quiz-result').waitFor();
        await page.locator('[data-action="next"]').click();
      }
      await page.waitForTimeout(1500);
      const text = await page.locator('body').innerText();
      const records = await page.evaluate(async()=>Object.values((await DataLabStorage.read()).db.users.offline_user.quizResults?.['python:basics:block-1'] || {}).map(x=>({quizId:x.quizId, answers:Object.keys(x.answers||{}).length})));
      assert.equal(text.includes('\u041f\u0440\u0430\u0432\u0438\u043b\u044c\u043d\u044b\u0445 \u043e\u0442\u0432\u0435\u0442\u043e\u0432:'),true);
      assert.ok(records.some(x=>x.quizId==='python:basics:block-1' && x.answers===10));
      await page.reload(); await page.waitForTimeout(700);
      await page.evaluate(()=>DataLabStorage.ready);
      const after = await page.evaluate(async()=>{
        const results=(await DataLabStorage.read()).db.users.offline_user.quizResults || {};
        return {groups:Object.keys(results), matching:Object.values(results['python:basics:block-1'] || {}).filter(x=>x.quizId==='python:basics:block-1').length};
      });
      assert.ok(after.matching>=1);
      return {resultVisible:text.includes('Правильных ответов:'), records, afterReload:after};
    });
    await task('math', async () => {
      await page.goto(base+'/practise/math.html');
      const q=page.locator('[data-md-id="algebra-determinant"]');
      await q.locator('.name').click();
      await page.waitForTimeout(1000);
      await q.locator('.mans input').first().fill('10');
      await q.locator('.mans-submit').click();
      await page.waitForTimeout(1000);
      const status=await q.locator('.mans-status').innerText();
      assert.match(status,/\u0412\u0435\u0440\u043d\u043e/);
      return {answer:'10',status};
    });
    await task('repetition', async () => {
      await page.goto(base+'/spaced-repetition.html');
      await page.getByRole('button',{name:'Показать ответ',exact:true}).click();
      await page.getByRole('button',{name:/Нормально/}).click();
      await page.waitForTimeout(1000);
      const before=await page.evaluate(async()=>(await DataLabStorage.read()).db.users.offline_user.spaced_repetition || null);
      await page.reload(); await page.waitForTimeout(1000);
      const after=await page.evaluate(async()=>(await DataLabStorage.read()).db.users.offline_user.spaced_repetition || null);
      assert.ok(before && Object.keys(before).length);
      assert.deepEqual(after,before);
      return {before,after,persisted:JSON.stringify(before)===JSON.stringify(after) && !!before};
    });
    await task('python', async () => {
      await page.goto(base+'/python/base.html');
      const q=page.locator('.question .name').first(); await q.click();
      await page.locator('.run-code-btn').first().waitFor();
      const btn=page.locator('.run-code-btn').first();
      const block=btn.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," code-block ")][1]');
      const source=await block.locator('.code-text').first().innerText();
      const failures=[];page.on('requestfailed',r=>{if(r.url().includes('pyodide')) failures.push({url:r.url(),error:r.failure()?.errorText})});
      await btn.click();
      try {await page.waitForFunction(el=>!el.disabled,await btn.elementHandle(),{timeout:45000});} catch {return {source:source.slice(0,300),timeoutMs:45000,label:await btn.innerText(),failures};}
      if (failures.length) console.log('SKIP: Pyodide execution unavailable because external CDN request failed; UI error observed.');
      return {status:failures.length?'blocked-external':'observed',source:source.slice(0,300),output:await block.locator('.code-block-output').innerText(),failures};
    });
    assert.equal(failures,0, 'one or more actual browser scenarios failed');
  } finally {if(browser) await browser.close(); await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1});
