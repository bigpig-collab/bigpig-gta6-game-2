// Solmar City v3 — entry point: screens, fixed-step loop, input wiring,
// screenshot staging, and the error trap the verifier looks for.
import * as THREE from 'three';
import { STEP } from './config.js';
import { createWorld, stepWorld, loadIntoWorld } from './world.js';
import { createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER } from './render3d.js';
import { createHud, updateHud } from './hud.js';
import { ensureAudio, toggleMute, startRadio, sfx } from './audio.js';
import { applyRespawn } from './police.js';
import { saveGame, loadGame, hasSave } from './save.js';
import { stageShot } from './shots.js';

// Any uncaught error is written into the title and a visible banner, so a
// headless check can see it without opening devtools.
window.addEventListener('error', (e) => {
  const msg = `ERROR: ${e.message}`;
  document.title = msg;
  const fatal = document.getElementById('fatal');
  if (fatal) { fatal.textContent = msg; fatal.style.display = 'block'; }
});
window.addEventListener('unhandledrejection', (e) => {
  document.title = `ERROR: ${e.reason}`;
  const fatal = document.getElementById('fatal');
  if (fatal) { fatal.textContent = `ERROR: ${e.reason}`; fatal.style.display = 'block'; }
});

const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam === null ? 1 : Number(seedParam) || 1;
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const hud = createHud();
const input = createInput(canvas);
const renderer3d = createRenderer(canvas);

let state = createWorld(seed);
window.__solmar = state; // debug handle: lets a headless check read the live state
let screen = SCREEN_TITLE;
let shotMode = false;
let shotFrames = 0;
window.__solmarScreen = () => screen;

const titleEl = document.getElementById('title-screen');
const pauseEl = document.getElementById('pause-screen');
const overEl = document.getElementById('over-screen');
const overTitle = document.getElementById('over-title');
const overText = document.getElementById('over-text');

function showScreens() {
  titleEl.style.display = screen === SCREEN_TITLE ? 'flex' : 'none';
  pauseEl.style.display = screen === SCREEN_PAUSE ? 'flex' : 'none';
  overEl.style.display = screen === SCREEN_OVER ? 'flex' : 'none';
  document.getElementById('hud').style.display = screen === SCREEN_PLAY ? 'block' : 'none';
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

if (shotName) {
  const staged = stageShot(shotName, state);
  screen = staged.screen;
  shotMode = true;
  showScreens();
  updateHud(hud, state);
} else if (hasSave()) {
  const data = loadGame();
  if (data) loadIntoWorld(state, data);
}
showScreens();

function startGame() {
  ensureAudio();
  startRadio();
  screen = SCREEN_PLAY;
  showScreens();
  sfx.mission();
}

// Mouse aim: ray from the camera through the cursor onto the ground plane.
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ndc = new THREE.Vector2();
const hitPoint = new THREE.Vector3();
function aimPoint() {
  const p = state.player;
  ndc.set((input.mouseX / window.innerWidth) * 2 - 1, -(input.mouseY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, renderer3d.camera);
  if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
    return { x: hitPoint.x, y: hitPoint.z };
  }
  return { x: p.x + Math.cos(p.angle) * 200, y: p.y + Math.sin(p.angle) * 200 };
}

let last = performance.now();
let acc = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;

  const interactPressed = input.consume('KeyE');
  const punchPressed = input.consume('KeyF');
  const enterPressed = input.consume('Enter') || input.consume('NumpadEnter') || input.consume('Mouse0');
  const pausePressed = input.consume('KeyP') || input.consume('Escape');
  if (input.consume('KeyM')) toggleMute();

  if (!shotMode) {
    if (screen === SCREEN_TITLE && enterPressed) startGame();
    else if (screen === SCREEN_OVER && enterPressed && state.overTimer > 0.8) {
      applyRespawn(state);
      screen = SCREEN_PLAY;
      showScreens();
    } else if (screen === SCREEN_PLAY && pausePressed) { screen = SCREEN_PAUSE; showScreens(); }
    else if (screen === SCREEN_PAUSE && pausePressed) { screen = SCREEN_PLAY; showScreens(); }
  }

  if (screen === SCREEN_PLAY && !shotMode) {
    acc += dt;
    let n = 0;
    while (acc >= STEP && n < 5) {
      const inp = {
        up: input.up, down: input.down, left: input.left, right: input.right,
        run: input.run, brake: input.brake,
        interact: interactPressed && n === 0,
        punch: punchPressed && n === 0,
        shoot: input.mouseDown,
        pause: false,
      };
      stepWorld(state, STEP, inp, aimPoint());
      acc -= STEP;
      n += 1;
      if (state.over) {
        screen = SCREEN_OVER;
        overTitle.textContent = state.over === 'busted' ? 'BUSTED!' : 'WASTED!';
        overText.textContent = state.over === 'busted'
          ? 'The cops caught you. Press Enter to walk out of the station.'
          : 'You flatlined. Press Enter to wake up at the hospital.';
        showScreens();
        break;
      }
    }
    if (n === 5) acc = 0;
    if (state.nearSafehouse && state.savedFlash > 0 && !state._savedShown) {
      state._savedShown = true;
      saveGame(state);
      state.message = 'Progress saved at the safehouse.';
      state.messageTimer = 2;
    }
    if (!state.nearSafehouse) state._savedShown = false;
  }

  input.endFrame();
  if (screen === SCREEN_PLAY) updateHud(hud, state);
  try {
    renderer3d.render(state, screen, window.innerWidth, window.innerHeight, input.camYaw, input.camPitch, dt);
  } catch (e) {
    document.title = `ERROR: ${e.message}`;
    const fatal = document.getElementById('fatal');
    if (fatal) { fatal.textContent = `ERROR: ${e.message}`; fatal.style.display = 'block'; }
    throw e;
  }
  if (shotMode) {
    shotFrames += 1;
    // Wall-clock based: under software rendering a frame can take seconds.
    if (shotFrames === 1) window.__shotStart = now;
    if (now - window.__shotStart > 4000 && document.title !== 'SHOT-READY') document.title = 'SHOT-READY';
  }
}
requestAnimationFrame(frame);
