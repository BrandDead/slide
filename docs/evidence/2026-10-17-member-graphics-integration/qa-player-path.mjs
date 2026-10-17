// Run with Node 24 and playwright-core available in QA_NODE_MODULES.
// Usage: QA_NODE_MODULES=/path/node_modules node qa-player-path.mjs ORIGIN OUTPUT LABEL [fail-images]
// Serves no app, modifies no game code, and never writes stores or dispatches engine commands.
// Only player controls/taps mutate the isolated local demo. React refs are inspected read-only.
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import path from 'node:path';
const require = createRequire(path.resolve(process.env.QA_NODE_MODULES, '../package.json'));
const { chromium } = require('playwright-core');
const [origin, output, label, failureFlag] = process.argv.slice(2);
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin ?? '')) throw new Error('Local demo origin required');
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const reports = [];
for (const viewport of [{width:390,height:844}, {width:1440,height:900}]) {
  const suffix = `${label}-${viewport.width}x${viewport.height}`;
  const report = { label, origin, viewport, imageFailure: failureFlag === 'fail-images', checks: [], screenshots: [], pageErrors: [], consoleErrors: [], failedRequests: [], snapshots: [] };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport.width === 390, hasTouch: viewport.width === 390, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', e => report.pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') report.consoleErrors.push(m.text()); });
  report.httpErrors = [];
  page.on('response', r => { if (r.status() >= 400) report.httpErrors.push({url:r.url(),status:r.status()}); });
  page.on('requestfailed', r => report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  if (report.imageFailure) await page.route('**/assets/runtime/generated/characters/**', r => r.abort('failed'));
  const capture = async name => {
    const file = `${suffix}-${name}.png`;
    await page.screenshot({ path:path.join(output,file) });
    report.screenshots.push(file);
  };
  const observe = () => page.evaluate(() => {
    const el = document.querySelector('.unified-encounter');
    if (!el) return null;
    const key = Object.keys(el).find(k => k.startsWith('__reactFiber$'));
    let fiber = el[key];
    for (let depth=0;fiber && depth<30;fiber=fiber.return,depth++) {
      let hook = fiber.memoizedState;
      for (let count=0;hook && count<35;hook=hook.next,count++) {
        const scene = hook.memoizedState?.current;
        if (scene?.session && scene?.actorViews instanceof Map) {
          const views = [...scene.actorViews.entries()].map(([id,v]) => ({id,type:v.sprite.type,texture:v.sprite.texture?.key,label:v.label.text}));
          return {tick:scene.session.tick,phase:scene.session.phase,selectedCrewId:scene.selectedCrewId,actors:scene.session.combatants,events:scene.session.events,terrain:scene.session.terrain,views,canvas:{width:scene.game.canvas.width,height:scene.game.canvas.height},hud:document.querySelector('.ue-live-stats')?.innerText};
        }
      }
    }
    return { error:'Read-only scene observer unavailable' };
  });
  const checkpoint = async name => {
    const state = await observe();
    report.snapshots.push({name,state});
    return state;
  };
  const tapCell = async (col,row) => {
    const box = await page.locator('.ue-stage canvas').boundingBox();
    const x = box.x + (col+0.5)*box.width/8;
    const y = box.y + (86+(row+0.5)*(600-86-72)/8)*box.height/600;
    if (viewport.width === 390) await page.touchscreen.tap(x,y); else await page.mouse.click(x,y);
    await page.waitForTimeout(100);
  };
  try {
    await page.goto(`${origin}/?app=block_loop`, {waitUntil:'domcontentloaded'});
    await page.getByRole('button',{name:'I AM 18+ — CONTINUE',exact:true}).click();
    await page.getByTestId('lock-las-olas-crew').click();
    const dismiss = page.getByRole('button',{name:'Dismiss rival activity'});
    if (await dismiss.count()) await dismiss.click();
    await page.waitForTimeout(300);
    await capture('strategy-diorama');
    await page.getByRole('button',{name:'Legal board',exact:true}).click();
    await page.locator('.td-cell[aria-label*="1,2"]').click();
    await page.getByRole('button',{name:'Shooter',exact:true}).click();
    await page.locator('.td-cell[aria-label*="4,3"]').click();
    await page.getByTestId('assign-river-cut').click();
    await page.getByTestId('close-the-deal').click();
    await page.getByTestId('enter-slide').click();
    await page.getByRole('button',{name:'Fire nearest',exact:true}).waitFor({state:'visible'});
    await page.waitForFunction(() => !document.querySelector('.ue-action-row button')?.disabled);
    let state = await checkpoint('entry');
    if (!state?.actors) throw new Error('Scene observer missing actors');
    await capture('encounter-entry');
    report.checks.push({name:'Named fictional opposition visible',pass:state.views.filter(v=>state.actors.find(a=>a.id===v.id)?.team==='opposition').every(v=>v.label.length>0)});
    report.checks.push({name:report.imageFailure ? 'Failed actor images have named fallback markers' : 'All opposition uses registered character Images, not circles',pass:state.views.filter(v=>state.actors.find(a=>a.id===v.id)?.team==='opposition').every(v=>report.imageFailure ? v.type === 'Arc' && v.label.length>0 : v.type==='Image' && v.texture.includes('/assets/runtime/'))});
    const dre = state.actors.find(a=>a.team==='crew');
    await tapCell(dre.position.x,dre.position.y);
    await tapCell(0,2);
    state = await checkpoint('dre-move');
    report.checks.push({name:'Actual Dre cell matches rendered destination (0,2)',pass:state.actors.find(a=>a.id===dre.id)?.position.x===0 && state.actors.find(a=>a.id===dre.id)?.position.y===2});
    const rome = state.actors.find(a=>a.team==='crew' && a.id!==dre.id);
    await tapCell(rome.position.x,rome.position.y);
    await tapCell(4,4);
    state = await checkpoint('rome-move');
    report.checks.push({name:'Actual Rome cell matches rendered destination (4,4)',pass:state.actors.find(a=>a.id===rome.id)?.position.x===4 && state.actors.find(a=>a.id===rome.id)?.position.y===4});
    await page.getByRole('button',{name:'Fire nearest',exact:true}).click();
    await page.waitForTimeout(150);
    await checkpoint('after-fire');
    await page.getByRole('button',{name:'Reload',exact:true}).click();
    state = await checkpoint('reload-start');
    await capture('reload-hud');
    report.checks.push({name:'Reload command emits real engine event',pass:state.events.some(e=>e.type==='reload-start')});
    if (label !== 'main') report.checks.push({name:'DOM condition shows reloading',pass:state.hud.includes('reloading')});
    for (let wait=0;wait<30;wait++) {
      state = await observe();
      if (state.events.some(e=>e.type==='reload-complete')) break;
      await page.waitForTimeout(150);
    }
    state = await checkpoint('reload-complete');
    report.checks.push({name:'Reload finishes through the real engine',pass:state.events.some(e=>e.type==='reload-complete')});
    for (let i=0;i<24 && state.phase==='active' && !state.actors.some(a=>a.team==='opposition' && a.isDown);i++) {
      await page.getByRole('button',{name:'Fire nearest',exact:true}).click();
      await page.waitForTimeout(140);
      state = await observe();
      const selected = state.actors.find(a=>a.id===state.selectedCrewId);
      if (selected?.ammo === 0 && selected.reloadUntilTick === null) {
        await page.getByRole('button',{name:'Reload',exact:true}).click();
        await page.waitForTimeout(1100);
      }
    }
    state = await checkpoint('combat-state');
    await capture('combat-state');
    report.checks.push({name:'Real fire event recorded',pass:state.events.some(e=>e.type==='weapon-fired')});
    const downed = state.actors.filter(a=>a.team==='opposition' && a.isDown);
    report.checks.push({name:report.imageFailure ? 'Downed opponent retains a named fallback' : 'Downed opponent uses registered downed state',pass:downed.length>0 && downed.every(a=>state.views.some(v=>v.id===a.id && (report.imageFailure ? v.label.length>0 : v.type==='Image' && v.texture.includes('_downed_'))))});
    if (state.phase === 'active') await page.getByRole('button',{name:'Retreat safely',exact:true}).click();
    await page.getByRole('button',{name:'Apply result and return',exact:true}).waitFor();
    await capture('result');
    await page.getByRole('button',{name:'Apply result and return',exact:true}).click();
    await page.getByRole('heading',{name:'Consequence',exact:true}).waitFor();
    await capture('consequence');
    const ledger = await page.evaluate(() => localStorage.getItem('dealt-slide-authoritative-block-loop-v1'));
    report.ledgerBeforeReload = ledger;
    await page.getByRole('button',{name:'Return to desktop',exact:true}).click();
    await page.waitForTimeout(200);
    await capture('returned');
    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForTimeout(500);
    report.ledgerAfterReload = await page.evaluate(() => localStorage.getItem('dealt-slide-authoritative-block-loop-v1'));
    const before = ledger ? JSON.parse(ledger) : null;
    const after = report.ledgerAfterReload ? JSON.parse(report.ledgerAfterReload) : null;
    report.checks.push({name:'Demo result receipt survives reload exactly once',pass:!!before && !!after && before.appliedEncounterKeys?.length===1 && JSON.stringify(before.appliedEncounterKeys)===JSON.stringify(after.appliedEncounterKeys)});
    report.checks.push({name:'Reload preserves booked money, heat, morale, and crew health',pass:!!before && !!after && ['money','playerHeat','blockMorale','crew'].every(k=>Object.hasOwn(before,k) && Object.hasOwn(after,k) && JSON.stringify(before[k])===JSON.stringify(after[k]))});
    report.checks.push({name:'No uncaught page errors',pass:report.pageErrors.length===0});
    await capture('reload-return');
  } catch(e) {
    report.error = e.stack;
    report.lastScreenText = await page.locator('body').innerText().catch(()=>null);
    await capture('failure').catch(()=>{});
  }
  reports.push(report);
  await fs.writeFile(path.join(output,`${suffix}-report.json`),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({label,viewport,error:report.error?.split('\n')[0],checks:report.checks,pageErrors:report.pageErrors,consoleErrors:report.consoleErrors.length}));
  await context.close();
}
await browser.close();
if (reports.some(r=>r.error || r.checks.some(c=>!c.pass))) process.exitCode=1;
