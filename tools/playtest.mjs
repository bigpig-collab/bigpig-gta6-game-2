// Headless browser playtest for Solmar City (Node 22+ stdlib only).
// Drives the real game in Chrome for Testing over CDP: title -> play,
// walk, steal + drive to the bar (mission 2 end to end, closed-loop
// autopilot), pistol, pause/resume, police at 3 stars, safehouse save
// and reload. Fails on any console/page error. Usage: node tools/playtest.mjs
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME || '/home/hatch/workspace/tools/chrome-testing/chrome-linux64/chrome';
const PORT = 9222, GAME_PORT = 8080;
let pass = 0, fail = 0;
const errors = [];
function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log('PASS ' + name); }
  else { fail += 1; console.log('FAIL ' + name + ' ' + extra); }
}
function start(proc, name) {
  return new Promise((resolve, reject) => {
    proc.on('error', reject);
    setTimeout(resolve, 1500);
  });
}
const server = spawn('node', ['serve.ts'], { cwd: '/home/hatch/workspace/makefun/gta6-01-v7', env: { ...process.env, PORT: String(GAME_PORT) }, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--enable-unsafe-swiftshader',
  '--use-angle=swiftshader', '--window-size=1280,800', '--mute-audio',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=/tmp/chrome-solmar-test-${Date.now()}`, 'about:blank',
], { stdio: 'ignore' });
await start(server, 'server');
await start(chrome, 'chrome');

let ws;
async function cdp(method, params = {}) {
  const id = ++cdp.seq;
  const p = new Promise((resolve, reject) => {
    cdp.waiting.set(id, { resolve, reject });
    setTimeout(() => { if (cdp.waiting.has(id)) { cdp.waiting.delete(id); reject(new Error('cdp timeout ' + method)); } }, 15000);
  });
  ws.send(JSON.stringify({ id, method, params }));
  return p;
}
cdp.seq = 0; cdp.waiting = new Map();
async function connect() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/json/new?about:blank`, { method: 'PUT' });
      const target = await res.json();
      ws = new WebSocket(target.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
      ws.onmessage = (ev) => {
        const m = JSON.parse(ev.data);
        if (m.id && cdp.waiting.has(m.id)) { cdp.waiting.get(m.id).resolve(m.result || m); cdp.waiting.delete(m.id); }
        if (m.method === 'Runtime.exceptionThrown') errors.push('exception: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400));
        if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push('console.error: ' + m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300));
        if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') errors.push('log.error: ' + (m.params.entry.text || '').slice(0, 300));
      };
      return;
    } catch { await sleep(500); }
  }
  throw new Error('could not connect to chrome');
}
async function evalJs(expr) {
  const r = await cdp('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 300));
  return r.result.value;
}
async function key(code, keyName, vk, type) {
  await cdp('Input.dispatchKeyEvent', { type, code, key: keyName, windowsVirtualKeyCode: vk });
}
async function tapKey(code, keyName, vk) {
  await key(code, keyName, vk, 'rawKeyDown');
  await sleep(60);
  await key(code, keyName, vk, 'keyUp');
}
async function holdKey(code, keyName, vk) { await key(code, keyName, vk, 'rawKeyDown'); }
async function releaseKey(code, keyName, vk) { await key(code, keyName, vk, 'keyUp'); }
async function click(x, y) {
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(50);
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

try {
  await connect();
  await cdp('Runtime.enable');
  await cdp('Page.enable');
  await cdp('Log.enable');
  await cdp('Page.navigate', { url: `http://localhost:${GAME_PORT}/?seed=1` });
  await sleep(5000);
  check('page has no console/page errors so far', errors.length === 0, errors.join(' | '));
  check('WebGL context exists', await evalJs(`!!document.querySelector('#game').getContext('webgl2')`));
  check('title screen shows', await evalJs(`__solmar.state.screen === 'title'`));
  // Start the game.
  await tapKey('Enter', 'Enter', 13);
  await sleep(500);
  check('Enter starts the game', await evalJs(`__solmar.state.screen === 'playing'`));
  check('mission 1 is Back in Town', await evalJs(`__solmar.state.missions.index === 0`));
  check('money starts at 120', await evalJs(`__solmar.state.player.money === 120`));
  // Walk forward with W for 8 s and confirm movement. (Under SwiftShader
  // the headless renderer runs far below 60 fps and dt is clamped, so
  // game time runs slower than wall time; 8 s still covers ~10 game metres.)
  const p0 = await evalJs(`({x: __solmar.state.player.x, z: __solmar.state.player.z})`);
  await holdKey('KeyW', 'w', 87);
  await sleep(8000);
  await releaseKey('KeyW', 'w', 87);
  const p1 = await evalJs(`({x: __solmar.state.player.x, z: __solmar.state.player.z})`);
  check('WASD walking moves the player', Math.hypot(p1.x - p0.x, p1.z - p0.z) > 5,
    `moved ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)}u`);
  // Mission 1: walk the last stretch to the bar (harness places the
  // player near the bar; the completion itself is the game's logic).
  await evalJs(`__solmar.state.player.x = 380; __solmar.state.player.z = -380;`);
  await sleep(800);
  check('mission 1 completes at the bar', await evalJs(`__solmar.state.missions.index === 1`));
  check('mission 1 money is 270', await evalJs(`__solmar.state.player.money === 270`));
  // Mission 2: find a parked sports car, steal it, drive to the bar.
  const carInfo = await evalJs(`(() => { const c = __solmar.state.parked.find(c => c.type === 'sports'); return c ? {x: c.x, z: c.z} : null; })()`);
  check('a parked sports car exists', !!carInfo, JSON.stringify(carInfo));
  if (carInfo) {
    await evalJs(`__solmar.state.player.x = ${carInfo.x + 4}; __solmar.state.player.z = ${carInfo.z + 4}; __solmar.state.player.inCar = null;`);
    await sleep(300);
    await tapKey('KeyE', 'e', 69);
    await sleep(400);
    check('E enters the sports car', await evalJs(`!!__solmar.state.player.inCar && __solmar.state.player.inCar.type === 'sports'`));
    // Closed-loop autopilot: steer toward waypoints on the road grid.
    const roadsX = [-1600, -1200, -800, -400, 0, 400, 800, 1200, 1600];
    const roadsZ = [-1200, -800, -400, 0, 400, 800, 1200];
    const nearest = (v, arr) => arr.reduce((a, b) => Math.abs(v - b) < Math.abs(v - a) ? b : a);
    const target = { x: 400, z: -400 };
    let arrived = false, driveStart = Date.now();
    await holdKey('KeyW', 'w', 87);
    let steer = null;
    try {
      while (Date.now() - driveStart < 60000) {
        const st = await evalJs(`(() => { const c = __solmar.state.player.inCar; const p = __solmar.state.player; return c ? {x: c.x, z: c.z, h: c.heading, s: c.speed} : {x: p.x, z: p.z, h: p.heading, s: 0}; })()`);
        const d = Math.hypot(target.x - st.x, target.z - st.z);
        if (d < 55) { arrived = true; break; }
        const tx = nearest(target.x, roadsX), tz = nearest(target.z, roadsZ);
        const wp = Math.abs(st.x - tx) > 60 ? { x: tx, z: nearest(st.z, roadsZ) } : { x: tx, z: tz };
        const want = Math.atan2(wp.x - st.x, wp.z - st.z);
        let diff = (want - st.h) % (Math.PI * 2);
        if (diff > Math.PI) diff -= Math.PI * 2;
        if (diff < -Math.PI) diff += Math.PI * 2;
        const wantSteer = diff > 0.25 ? 'right' : diff < -0.25 ? 'left' : null;
        if (wantSteer !== steer) {
          if (steer) await releaseKey(steer === 'left' ? 'KeyA' : 'KeyD', steer === 'left' ? 'a' : 'd', steer === 'left' ? 65 : 68);
          steer = wantSteer;
          if (steer) await holdKey(steer === 'left' ? 'KeyA' : 'KeyD', steer === 'left' ? 'a' : 'd', steer === 'left' ? 65 : 68);
        }
        await sleep(200);
      }
    } finally {
      await releaseKey('KeyW', 'w', 87);
      if (steer) await releaseKey(steer === 'left' ? 'KeyA' : 'KeyD', steer === 'left' ? 'a' : 'd', steer === 'left' ? 65 : 68);
    }
    check('autopilot drive to the bar arrives', arrived);
    await sleep(600);
    check('mission 2 completes in the browser', await evalJs(`__solmar.state.missions.index === 2`));
    check('mission 2 money is 570', await evalJs(`__solmar.state.player.money === 570`));
    const fineCheck = await evalJs(`__solmar.state.player.money`);
    check('no fine during the drive (money is exactly 570)', fineCheck === 570, 'money=' + fineCheck);
    // Exit the car, fire the pistol, check ammo drops.
    await tapKey('KeyE', 'e', 69);
    await sleep(300);
    const ammo0 = await evalJs(`__solmar.state.player.ammo`);
    await click(640, 300);
    await sleep(300);
    const ammo1 = await evalJs(`__solmar.state.player.ammo`);
    check('pistol fires (ammo drops)', ammo1 === ammo0 - 1, `ammo ${ammo0} -> ${ammo1}`);
    // Pause and resume.
    await tapKey('Escape', 'Escape', 27);
    await sleep(300);
    check('Esc pauses', await evalJs(`__solmar.state.screen === 'pause'`));
    await tapKey('Escape', 'Escape', 27);
    await sleep(300);
    check('Esc resumes', await evalJs(`__solmar.state.screen === 'playing'`));
    // Police at 3 stars: cars spawn and close in.
    await evalJs(`__solmar.state.wanted.stars = 3; __solmar.state.wanted.lastCrimeAt = __solmar.game.now;`);
    await sleep(3000);
    const police = await evalJs(`__solmar.state.policeCars.length`);
    check('3 police cars spawn at 3 stars', police >= 3, 'count=' + police);
    const pd0 = await evalJs(`Math.hypot(__solmar.state.policeCars[0].x - __solmar.state.player.x, __solmar.state.policeCars[0].z - __solmar.state.player.z)`);
    await sleep(3000);
    const pd1 = await evalJs(`Math.hypot(__solmar.state.policeCars[0].x - __solmar.state.player.x, __solmar.state.policeCars[0].z - __solmar.state.player.z)`);
    check('police cars close in on the player', pd1 < pd0, `d ${pd0.toFixed(0)} -> ${pd1.toFixed(0)}`);
    // Safehouse save, reload, load.
    await evalJs(`__solmar.state.wanted.stars = 0; __solmar.state.player.x = -1200; __solmar.state.player.z = 400;`);
    await sleep(6000);
    const saved = await evalJs(`localStorage.getItem('solmar-city-save-v1')`);
    check('safehouse autosave writes localStorage', !!saved, String(saved).slice(0, 120));
    await cdp('Page.reload', { ignoreCache: true });
    await sleep(5000);
    await tapKey('Enter', 'Enter', 13);
    await sleep(500);
    check('save loads money after reload', await evalJs(`__solmar.state.player.money === 570`));
    check('save loads mission progress after reload', await evalJs(`__solmar.state.missions.index === 2`));
  }
  check('zero console/page errors at the end', errors.length === 0, errors.join(' | '));
} catch (e) {
  fail += 1;
  console.log('FAIL playtest threw: ' + (e && e.message ? e.message : e));
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
}
console.log(`\nPLAYTEST: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
