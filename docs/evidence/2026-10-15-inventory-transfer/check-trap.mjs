import puppeteer from 'puppeteer-core';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const mode = process.argv[2] ?? 'fixed';
const out = process.env.SLIDE_EVIDENCE_DIR ?? new URL('.', import.meta.url).pathname;
const url = process.env.SLIDE_PREVIEW_URL ?? 'http://127.0.0.1:3001';
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = [];
try {
  for (const [name, width, height] of [['phone', 390, 844], ['small-phone', 375, 812], ['desktop', 1440, 900]]) {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width, height });
    const pageErrors = [];
    const consoleErrors = [];
    const failedResources = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400) failedResources.push({ url: response.url(), status: response.status() });
    });
    await page.goto(url, { waitUntil: 'networkidle0' });
    await page.evaluate(() => [...document.querySelectorAll('button')].find((button) => button.textContent.includes('I AM 18')).click());
    await page.waitForSelector('[aria-label="TRAP"]');
    await page.click('[aria-label="TRAP"]');
    await page.waitForSelector('.trap-item');
    console.log(name + ' live Trap controls: ' + (await page.evaluate(() => document.querySelector('.trap-app').innerText)));
    const before = await page.$eval('.trap-item-qty', (element) => Number(element.textContent.replace('x', '')));
    const item = await page.$('.trap-item');
    await item.click();
    const dealer = await page.$('.trap-member-card');
    await dealer.click();
    await page.waitForSelector('.trap-gift-btn', { visible: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const reachable = await page.$eval('.trap-gift-btn', (button) => {
      const rect = button.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
        visible: rect.x >= 0 && rect.y >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight,
        hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.closest('.trap-gift-btn') === button };
    });
    await page.screenshot({ path: `${out}/${mode}-${name}-before-give.png` });
    await page.click('.trap-gift-btn');
    await new Promise((resolve) => setTimeout(resolve, 300));
    const after = await page.evaluate((initialStock) => {
      const stash = JSON.parse(localStorage.getItem('dealt-slide-economy'))?.state.inventory;
      return {
        stash: stash ? stash.find((item) => item.itemId === 'weed')?.quantity ?? 0 : initialStock,
        members: JSON.parse(localStorage.getItem('dealt-slide-gang'))?.state.members ?? [],
        notifications: JSON.parse(localStorage.getItem('dealt-slide-notifications'))?.state.notifications ?? [],
      };
    }, before);
    await page.screenshot({ path: `${out}/${mode}-${name}-after-give.png` });
    if (mode === 'base') {
      assert(pageErrors.some((error) => error.includes('require is not defined')));
      assert.equal(after.stash, before);
    } else {
      assert.equal(after.stash, before - 1);
      assert.equal(pageErrors.length, 0);
      assert(reachable.visible && reachable.hit);
      const recipient = after.members.find((member) => member.id === 'demo-dealer-1');
      assert(recipient.inventory.some((item) => item.itemId === 'weed' && item.quantity === 1));
      assert(after.notifications.some((notification) => notification.title === 'Item Given'));
      // Realistic denial through the same visible control: product to a shooter.
      await page.click('.trap-item');
      await page.$$eval('.trap-member-card', (cards) => cards.find((card) => card.textContent.includes('Big Rome')).click());
      await page.waitForSelector('.trap-gift-btn', { visible: true });
      await page.click('.trap-gift-btn');
      await new Promise((resolve) => setTimeout(resolve, 300));
      const denied = await page.evaluate(() => {
        return {
          stash: JSON.parse(localStorage.getItem('dealt-slide-economy')).state.inventory.find((item) => item.itemId === 'weed').quantity,
          notifications: JSON.parse(localStorage.getItem('dealt-slide-notifications')).state.notifications,
        };
      });
      assert.equal(denied.stash, before - 1);
      assert.equal(denied.notifications.filter((notification) => notification.title === 'Item Given').length, 1);
      assert(denied.notifications.some((notification) => notification.title === 'Cannot Equip'));
      assert.equal(pageErrors.length, 0);
      assert(await page.$eval('.trap-gift-panel [role="alert"]', (element) => element.textContent.includes("can't hold drugs")));
      await page.screenshot({ path: `${out}/${mode}-${name}-role-denied.png` });
      await page.reload({ waitUntil: 'networkidle0' });
      await page.waitForSelector('[aria-label="TRAP"]');
      await page.click('[aria-label="TRAP"]');
      await page.waitForSelector('.trap-member-card');
      await new Promise((resolve) => setTimeout(resolve, 450));
      await page.screenshot({ path: `${out}/${mode}-${name}-after-reload.png` });
      const restored = await page.evaluate(() => ({
        stash: JSON.parse(localStorage.getItem('dealt-slide-economy')).state.inventory.find((item) => item.itemId === 'weed').quantity,
        carried: JSON.parse(localStorage.getItem('dealt-slide-gang')).state.members.find((member) => member.id === 'demo-dealer-1').inventory,
      }));
      assert.equal(restored.stash, before - 1);
      assert.deepEqual(restored.carried, recipient.inventory);
      assert.equal(pageErrors.length, 0);
    }
    if (mode !== 'base') {
      const baselineMissing = ['/favicon.svg', '/assets/game_logo.png', '/assets/generated/ui/icons/icon_news_v001.png'];
      assert(failedResources.every((resource) => resource.status === 404
        && baselineMissing.includes(new URL(resource.url).pathname)), JSON.stringify(failedResources));
      assert(consoleErrors.every((error) => error.includes('Failed to load resource:')
        && error.includes('404')), consoleErrors.join('\n'));
      assert.equal(consoleErrors.length, failedResources.length);
    }
    results.push({ name, viewport: { width, height }, mode, url, before, after: after.stash,
      scope: 'inventory player path; not a clean-console or launch approval',
      giveControl: reachable, pageErrors, consoleErrors, failedResources, checks: mode === 'base' ? ['runtime bug reproduced']
        : ['real Trap give', 'stock deducted once', 'carried item persisted', 'role denial has no success',
          'inline rejection visible', 'real reload retains exact carried record and stock'], pass: true });
    await context.close();
  }
  await fs.writeFile(`${out}/browser-${mode}.json`, JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
