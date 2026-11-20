// Staged screenshot capture for Solmar City (Node 22+ stdlib only).
// Opens each ?shot=<name>&seed=1 view at 1280x800 in Chrome for Testing
// over CDP, waits for the game to flag itself ready plus a settle delay,
// then saves a JPEG to screenshots/. Usage: node tools/shots.mjs
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME || '/home/hatch/workspace/tools/chrome-testing/chrome-linux64/chrome';
const PORT = 9223, GAME_PORT = 8081;
const SHOTS = [['1-chase', 'chase'], ['2-street', 'street'], ['3-drive', 'drive'], ['4-fight', 'fight']];
const server = spawn('node', ['serve.ts'], { cwd: '/home/hatch/workspace/makefun/gta6-01-v7', env: { ...process.env, PORT: String(GAME_PORT) }, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader', '--window-size=1280,800', '--mute-audio',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/chrome-solmar-shots-${Date.now()}`, 'about:blank',
], { stdio: 'ignore' });
await sleep(1500);
let ws, seq = 0;
const waiting = new Map();
async function connect() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' });
      const target = await res.json();
      ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && waiting.has(m.id)) { waiting.get(m.id).resolve(m.result || m); waiting.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') console.log('PAGE EXCEPTION:', JSON.stringify(m.params.exceptionDetails).slice(0, 300));
      };
      return;
    } catch { await sleep(500); }
  }
  throw new Error('could not connect to chrome');
}
function cdp(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    setTimeout(() => { if (waiting.has(id)) { waiting.delete(id); reject(new Error('cdp timeout ' + method)); } }, 30000);
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJs(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true });
  return r.result ? r.result.value : undefined;
}
try {
  await connect();
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
  mkdirSync('/home/hatch/workspace/makefun/gta6-01-v7/screenshots', { recursive: true });
  for (const [file, name] of SHOTS) {
    await cdp('Page.navigate', { url: `http://localhost:${GAME_PORT}/?seed=1&shot=${name}` });
    let ready = false;
    for (let i = 0; i < 60; i++) {
      await sleep(1000);
      ready = await evalJs(`window.__shotReady === true`);
      if (ready) break;
    }
    if (!ready) { console.log('FAIL shot ' + name + ' never became ready'); continue; }
    await sleep(4000); // let the chase camera settle and traffic move in
    const shot = await cdp('Page.captureScreenshot', { format: 'jpeg', quality: 80 });
    const buf = Buffer.from(shot.data, 'base64');
    writeFileSync(`/home/hatch/workspace/makefun/gta6-01-v7/screenshots/${file}.jpg`, buf);
    console.log(`shot ${name}: ${buf.length} bytes`);
  }
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
}
console.log('done');
