import { mkdir, writeFile } from 'node:fs/promises';

const outputDir = '/home/ubuntu/work/slide-live/verification';
await mkdir(outputDir, { recursive: true });
const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) => response.json());
const target = targets.find((item) => item.type === 'page' && item.url === 'about:blank')
  ?? targets.find((item) => item.type === 'page');
if (!target) throw new Error('No isolated Chromium page target found.');

const socket = new WebSocket(target.webSocketDebuggerUrl);
let nextId = 1;
const pending = new Map();
const events = [];

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      reject(new Error(`Timed out: ${method}`));
    }, 45000);
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

socket.addEventListener('message', (message) => {
  const payload = JSON.parse(message.data);
  if (payload.id && pending.has(payload.id)) {
    const request = pending.get(payload.id);
    pending.delete(payload.id);
    payload.error ? request.reject(new Error(JSON.stringify(payload.error))) : request.resolve(payload.result);
    return;
  }
  if (['Runtime.exceptionThrown', 'Runtime.consoleAPICalled', 'Log.entryAdded', 'Network.loadingFailed'].includes(payload.method)) {
    events.push(payload);
  }
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
await Promise.all([
  send('Runtime.enable'),
  send('Log.enable'),
  send('Network.enable'),
  send('Page.enable'),
]);
await send('Emulation.setDeviceMetricsOverride', {
  width: 1280,
  height: 720,
  deviceScaleFactor: 1,
  mobile: false,
});
await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try { localStorage.setItem('slide.age-affirmation.v1', 'confirmed'); } catch {}`,
});
await send('Page.navigate', { url: 'http://127.0.0.1:3000/?demo=1&camera=third-person&showdown-verification=1' });
await wait(5000);

async function evaluate(expression) {
  const response = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  return response.result.value;
}

async function clickText(text) {
  return evaluate(`(() => {
    const button = [...document.querySelectorAll('button')].find((item) => item.textContent?.replace(/\\s+/g, ' ').trim().includes(${JSON.stringify(text)}));
    if (!button) return { clicked: false, buttons: [...document.querySelectorAll('button')].map((item) => item.textContent?.replace(/\\s+/g, ' ').trim()).slice(0, 100) };
    button.click();
    return { clicked: true, text: button.textContent?.trim() };
  })()`);
}

async function capture(name) {
  const screenshot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, captureBeyondViewport: false });
  await writeFile(`${outputDir}/${name}.jpg`, Buffer.from(screenshot.data, 'base64'));
}

async function opsState() {
  const raw = await evaluate(`JSON.stringify({
    modernOps: Boolean(document.querySelector('.modern-ops')),
    loading: Boolean(document.querySelector('.modern-ops__loading')),
    error: document.querySelector('.modern-ops__error')?.textContent ?? null,
    camera: document.querySelector('.ops-camera-switcher button.active')?.textContent?.trim() ?? null,
    selected: document.querySelector('.ops-member-switch strong')?.textContent?.trim() ?? null,
    control: document.querySelector('.ops-vitals > span')?.textContent?.trim() ?? null,
    ammo: document.querySelector('.ops-ammo')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    status: document.querySelector('.ops-status')?.textContent?.trim() ?? null,
    result: document.querySelector('.ops-result')?.textContent?.replace(/\\s+/g, ' ').trim() ?? null,
    canvases: document.querySelectorAll('canvas').length,
    opsCanvas: (() => { const canvas = document.querySelector('.modern-ops-canvas'); return canvas ? { width: canvas.width, height: canvas.height, clientWidth: canvas.clientWidth, clientHeight: canvas.clientHeight, webgl2: Boolean(canvas.getContext('webgl2')), webgl: Boolean(canvas.getContext('webgl')) } : null; })()
  })`);
  return JSON.parse(raw ?? '{}');
}

const stripClick = await clickText('Strip');
await wait(1800);
const opsClick = await clickText('OPS 3D');
await wait(3500);
const thirdPersonBefore = await opsState();
await capture('showdown-third-person');

const switchedMember = await evaluate(`(() => {
  const buttons = document.querySelectorAll('.ops-member-switch button');
  if (buttons.length < 2) return false;
  buttons[1].click();
  return true;
})()`);
await wait(500);
const thirdPersonAfterSwitch = await opsState();

const fpsClick = await clickText('FPS');
await wait(900);
await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'Space', key: ' ', text: ' ' });
await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'Space', key: ' ' });
await wait(650);
const firstPerson = await opsState();
await capture('showdown-first-person');

const tacticalClick = await clickText('TAC');
await wait(900);
const tactical = await opsState();
await capture('showdown-tactical');

await clickText('TPS');
await wait(500);
await evaluate(`(() => {
  window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', key: 'q', bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ', key: 'q', bubbles: true }));
  return true;
})()`);
let resultState = await opsState();
for (let attempt = 0; attempt < 20 && !resultState.result; attempt += 1) {
  await wait(250);
  resultState = await opsState();
}
await capture('showdown-result');

const applied = resultState.result ? await evaluate(`(() => {
  const button = document.querySelector('.ops-result button');
  if (!button) return false;
  button.click();
  return true;
})()`) : false;
await wait(1600);
const returnState = JSON.parse(await evaluate(`JSON.stringify({
  modernOps: Boolean(document.querySelector('.modern-ops')),
  blockText: document.querySelector('.block-mode-view')?.innerText?.slice(0, 1800) ?? null,
  bodyText: document.body.innerText.slice(0, 2200)
})`) ?? '{}');
await capture('showdown-return-strategy');

const fatalEvents = events.filter((event) => event.method === 'Runtime.exceptionThrown'
  || (event.method === 'Log.entryAdded'
    && event.params?.entry?.level === 'error'
    && event.params?.entry?.url?.startsWith('http://127.0.0.1:3000/')));
const report = {
  stripClick,
  opsClick,
  thirdPersonBefore,
  switchedMember,
  thirdPersonAfterSwitch,
  fpsClick,
  firstPerson,
  tacticalClick,
  tactical,
  resultState,
  applied,
  returnState,
  eventCount: events.length,
  fatalEventCount: fatalEvents.length,
};
await writeFile(`${outputDir}/showdown-browser-events.json`, JSON.stringify(events, null, 2));
await writeFile(`${outputDir}/showdown-browser-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
socket.close();

if (!thirdPersonBefore.modernOps || thirdPersonBefore.error) process.exitCode = 1;
if (thirdPersonBefore.camera !== 'TPS' || firstPerson.camera !== 'FPS' || tactical.camera !== 'TAC') process.exitCode = 1;
if (!switchedMember || thirdPersonBefore.selected === thirdPersonAfterSwitch.selected) process.exitCode = 1;
if (!firstPerson.status || firstPerson.status === thirdPersonAfterSwitch.status) process.exitCode = 1;
if (!resultState.result || !applied || returnState.modernOps) process.exitCode = 1;
if (fatalEvents.length > 0) process.exitCode = 1;
