// Solmar City — entry point. Wires the world, cars, traffic, police,
// missions, HUD, minimap, audio and save together into one game loop.
import * as THREE from 'three';
import { WORLD, PLACES, START, CAR_SPECS, GAME } from './config.js';
import { makeRng, clamp, angleDiff } from './random.js';
import { listBlocks, blockBuildings, collideCircleAABB, clampToWorld, nearestRoadCoord } from './world.js';
import { makeCar, updateCar, damageCar, circleHitsCar, carsOverlap } from './vehicles.js';
import { makePlayer, updatePlayer, hurtPlayer, healPlayer, canPunch, markPunch, canShoot, markShot } from './player.js';
import { spawnTraffic, spawnParked, spawnPeds, updateTraffic, updatePeds, nearestCarTo } from './traffic.js';
import { makeWanted, addCrime, updateWanted, policeCarTarget, spawnPoliceCar, updatePoliceCar, ramDamage, maybeSpawnFootCop, updateFootCop, bustedCheck, applyFine, respawnPoint } from './police.js';
import { makePerson, punch, shoot, shootAtCar } from './combat.js';
import { makeMissionState, currentMission, objectiveText, startMission, completeMission, missionEvent, missionTargetPos } from './missions.js';
import { writeSave, readSave, applySave } from './save.js';
import { buildCity } from './city.js';
import { makeCarMesh, makePersonMesh, makeMarkerMesh, makeTracerMesh } from './meshes.js';
import { createScene, resizeRenderer, updateCamera, snapCamera } from './render.js';
import { buildHud, renderHud } from './hud.js';
import { buildMinimap, drawMinimap } from './minimap.js';
import { makeAudio, resumeAudio, setMuted, setRadioTune, sfx, updateEngine, updateRadio } from './audio.js';
import { makeInput, bindInput, driveInput, walkInput, consumeClick, consumeKey } from './input.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = params.get('seed') || '1';
const SHOT = params.get('shot') || '';
const rng = makeRng(SEED);

const canvas = document.getElementById('game');
const { renderer, scene, camera } = createScene(canvas);
const { colliders } = buildCity(scene, SEED);
const hud = buildHud(document);
const minimapCv = buildMinimap(document);
const audio = makeAudio();
const input = makeInput();
bindInput(input, canvas);

const G = {
  now: 0, camYaw: START.heading, camPitch: 0.22, lastDragAt: -10,
  state: {
    screen: 'title', overKind: 'wasted',
    player: makePlayer(START.x, START.z, START.heading),
    wanted: makeWanted(),
    missions: makeMissionState(),
    traffic: [], parked: [], policeCars: [], cops: [], rivals: [], peds: [],
    heistCar: null, lastSaveAt: -10, lastHurtAt: -10, dialogueUntil: 0, bannerUntil: 0,
    shotFrames: 0,
  },
};
const S = G.state;
window.__solmar = { state: S, game: G, version: 7 };

// ---- world population -------------------------------------------------
S.traffic = spawnTraffic(rng, GAME.trafficCount);
S.parked = spawnParked(rng, GAME.parkedCount);
S.peds = spawnPeds(rng, GAME.pedCount);
S.heistCar = makeCar('sports', PLACES.heist.x, PLACES.heist.z, Math.PI / 2, { mission: true, id: 'heist-car' });
S.heistCar.playerOwned = false;

// ---- meshes -----------------------------------------------------------
const carMeshes = new Map();
function meshForCar(car) {
  let m = carMeshes.get(car.id);
  if (!m) {
    m = makeCarMesh(car);
    carMeshes.set(car.id, m);
    scene.add(m);
  }
  return m;
}
function syncCarMesh(car, dt) {
  const m = meshForCar(car);
  m.position.set(car.x, 0, car.z);
  m.rotation.y = car.heading;
  for (const b of m.userData.brakes || []) b.material.color.setHex(car.braking ? 0xff2020 : 0x550000);
  if (car.police) {
    const blink = Math.floor(G.now * 4) % 2 === 0;
    if (m.userData.beaconRed) m.userData.beaconRed.material.color.setHex(blink ? 0xff2020 : 0x550000);
    if (m.userData.beaconBlue) m.userData.beaconBlue.material.color.setHex(blink ? 0x2040ff : 0x550000);
  }
  if (car.smoke > 0.25 && Math.random() < car.smoke * 0.35) spawnSmoke(car);
}
const playerMesh = makePersonMesh('player', 0x3a6fd8);
scene.add(playerMesh);
const pedMeshes = new Map();
function meshForPerson(p) {
  let m = pedMeshes.get(p.id);
  if (!m) {
    m = makePersonMesh(p.kind, [0xe84a5f, 0x2f9e44, 0xf2c200, 0x9b59b6][Math.floor(Math.random() * 4)]);
    pedMeshes.set(p.id, m);
    scene.add(m);
  }
  return m;
}
const marker = makeMarkerMesh(0xffd76a);
scene.add(marker);
const tracer = makeTracerMesh();
scene.add(tracer);
let tracerUntil = 0;
const smokePool = [];
function spawnSmoke(car) {
  let s = smokePool.find((x) => !x.visible);
  if (!s) {
    s = new THREE.Mesh(new THREE.SphereGeometry(1.6, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x555555, transparent: true, opacity: 0.5 }));
    smokePool.push(s); scene.add(s);
  }
  const a = carMeshes.get(car.id)?.userData.smokeAnchor;
  const p = a ? new THREE.Vector3().setFromMatrixPosition(a.matrixWorld) : new THREE.Vector3(car.x, 1.5, car.z);
  s.position.copy(p); s.visible = true; s.userData.life = 0.8;
}
function syncPersonMesh(p, dt) {
  const m = meshForPerson(p);
  m.visible = p.alive;
  m.position.set(p.x, 0, p.z);
  m.rotation.y = p.heading;
  m.position.y = Math.abs(Math.sin(G.now * 8 + p.x)) * (p.fleeing ? 0.25 : 0.08);
}

// ---- police & rivals --------------------------------------------------
function maintainPolice(dt) {
  const want = policeCarTarget(S.wanted.stars);
  while (S.policeCars.length < want) {
    const ang = rng.range(0, Math.PI * 2);
    const car = spawnPoliceCar(rng, S.player.x + Math.sin(ang) * 190, S.player.z + Math.cos(ang) * 190);
    S.policeCars.push(car);
    sfx(audio, 'siren');
  }
  while (S.policeCars.length > want) {
    const car = S.policeCars.pop();
    const m = carMeshes.get(car.id);
    if (m) { scene.remove(m); carMeshes.delete(car.id); }
  }
}
function spawnRivals() {
  if (S.rivals.some((r) => r.alive)) return;
  for (let i = 0; i < 5; i++) {
    const r = makePerson('rival', PLACES.port.x + (i - 2) * 22, PLACES.port.z - 40 - (i % 2) * 26,
      { id: 'rival-' + i, health: GAME.rivalHealth, speed: 3.4 });
    S.rivals.push(r);
  }
}

// ---- actions ----------------------------------------------------------
function nearestEnterableCar() {
  const all = [...S.parked, ...S.traffic, S.heistCar];
  return nearestCarTo(S.player.x, S.player.z, all, 7);
}
function enterCar() {
  const car = nearestEnterableCar();
  if (!car || car.wrecked) return;
  const witnessed = S.policeCars.some((p) => Math.hypot(p.x - car.x, p.z - car.z) < 150) ||
    S.peds.some((p) => p.alive && Math.hypot(p.x - car.x, p.z - car.z) < 25);
  if (!car.mission && !car.playerOwned && witnessed) addCrime(S.wanted, 1, G.now);
  S.player.inCar = car;
  car.traffic = false; car.parked = false;
  car.driver = 'player';
  sfx(audio, 'enter');
}
function exitCar() {
  const car = S.player.inCar;
  if (!car) return;
  car.speed = 0;
  car.playerOwned = true;
  car.driver = null;
  S.player.x = car.x - Math.sin(car.heading + Math.PI / 2) * 4;
  S.player.z = car.z - Math.cos(car.heading + Math.PI / 2) * 4;
  S.player.heading = car.heading;
  S.player.inCar = null;
  sfx(audio, 'enter');
}
function doPunch() {
  if (!canPunch(S.player, G.now)) return;
  markPunch(S.player, G.now);
  sfx(audio, 'punch');
  const people = [...S.peds, ...S.cops, ...S.rivals];
  const hit = punch(S.player, people, G.now);
  if (!hit) return;
  sfx(audio, 'hit');
  if (hit.kind === 'ped') addCrime(S.wanted, 1, G.now);
  if (hit.kind === 'cop' && !hit.alive) addCrime(S.wanted, 2, G.now);
  if (hit.kind === 'rival' && !hit.alive) missionKill(hit);
}
function doShoot() {
  if (!canShoot(S.player, G.now)) return;
  markShot(S.player, G.now);
  sfx(audio, 'shoot');
  const aim = G.camYaw;
  const people = [...S.peds, ...S.cops, ...S.rivals];
  const res = shoot(S.player, aim, people, G.now);
  const from = new THREE.Vector3(S.player.x, 1.6, S.player.z);
  const to = new THREE.Vector3(res.end.x, 1.4, res.end.z);
  tracer.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([from.x, from.y, from.z, to.x, to.y, to.z]), 3));
  tracer.visible = true;
  tracerUntil = G.now + 0.09;
  if (res.hit) {
    if (res.hit.kind === 'ped') addCrime(S.wanted, 1, G.now);
    if (res.hit.kind === 'cop') addCrime(S.wanted, res.hit.alive ? 1 : 2, G.now);
    if (res.hit.kind === 'rival' && !res.hit.alive) missionKill(res.hit);
    S.peds.forEach((p) => { if (p.alive && Math.hypot(p.x - S.player.x, p.z - S.player.z) < 70) p.fleeing = true; });
  } else {
    const car = shootAtCar(S.player, aim, [...S.traffic, ...S.parked, ...S.policeCars], G.now);
    if (car) damageCar(car, 10, G.now);
  }
}
function missionKill(rival) {
  const ev = missionEvent(S.missions, { player: S.player, wanted: S.wanted, car: S.player.inCar, now: G.now, at: S.player, killedRival: true });
  if (ev === 'complete') finishMission();
}
function finishMission() {
  const res = completeMission(S.missions, S.player, G.now);
  if (!res) return;
  sfx(audio, 'mission');
  S.bannerUntil = G.now + 4;
  S.dialogueUntil = G.now + 7;
  writeSave(localStorage, S.player, S.missions, S.wanted);
  const next = currentMission(S.missions);
  if (next) startMission(S.missions, G.now);
}
function respawn(kind) {
  applyFine(S.player, S.wanted);
  const pt = respawnPoint(kind);
  S.player.x = pt.x; S.player.z = pt.z;
  S.player.heading = Math.PI / 2;
  S.player.inCar = null;
  for (const c of S.cops) c.alive = false;
  S.cops.length = 0;
  for (const car of S.policeCars) {
    const m = carMeshes.get(car.id);
    if (m) { scene.remove(m); carMeshes.delete(car.id); }
  }
  S.policeCars.length = 0;
  S.screen = 'playing';
}
function gameOver(kind) {
  S.screen = 'over';
  S.overKind = kind;
  S.pendingRespawn = kind;
  sfx(audio, 'fail');
}

// ---- per-frame update -------------------------------------------------
function collideCarWithWorld(car, dt) {
  // Circle vs building AABBs: push out along the least-penetration axis,
  // which lets the car slide along walls instead of wedging into them.
  for (const b of colliders) {
    const r = collideCircleAABB(car.x, car.z, car.radius * 0.62, b);
    if (r.hit) {
      car.x = r.x; car.z = r.z;
      car.speed *= 0.92;
      damageCar(car, 2, G.now);
    }
  }
  const c = clampToWorld(car.x, car.z, 30);
  if (c.x !== car.x || c.z !== car.z) {
    car.x = c.x; car.z = c.z;
    car.speed *= 0.6;
    damageCar(car, 5, G.now); // throttled inside damageCar
  }
}
function tick(dt) {
  G.now += dt;
  const p = S.player;
  const hpBefore = p.health;
  if (S.screen === 'playing') {
    // Camera orbit from drag.
    if (input.dragDX !== 0 || input.dragDY !== 0) {
      G.camYaw -= input.dragDX * 0.005;
      G.camPitch = clamp(G.camPitch + input.dragDY * 0.003, -0.1, 0.6);
      input.dragDX = 0; input.dragDY = 0;
      G.lastDragAt = G.now;
    }
    if (input.keys.has('mute')) { input.keys.delete('mute'); setMuted(audio, !audio.muted); }
    if (consumeKey(input, 'radio')) setRadioTune(audio, audio.radioTune + 1);
    if (consumeKey(input, 'pause')) { S.screen = 'pause'; return; }
    // Enter / exit car.
    if (input.keys.has('enter')) {
      input.keys.delete('enter');
      if (p.inCar) exitCar(); else enterCar();
    }
    // Driving or walking.
    if (p.inCar) {
      const car = p.inCar;
      updateCar(car, driveInput(input), dt);
      collideCarWithWorld(car, dt);
      p.x = car.x; p.z = car.z; p.heading = car.heading;
      if (G.now - G.lastDragAt > 2.5) {
        const diff = angleDiff(G.camYaw, car.heading);
        G.camYaw += diff * Math.min(1, dt * 1.6);
      }
      if (car.wrecked) { p.health = 0; exitCar(); gameOver('wasted'); }
    } else {
      const w = walkInput(input);
      updatePlayer(p, { ...w, camYaw: G.camYaw }, dt, colliders, G.now);
      if (input.keys.has('punch')) { input.keys.delete('punch'); doPunch(); }
      const click = consumeClick(input);
      if (click) doShoot();
      // Ammo refill at the bar and the safehouse.
      if ((Math.hypot(p.x - PLACES.bar.x, p.z - PLACES.bar.z) < 40 ||
        Math.hypot(p.x - PLACES.safehouse.x, p.z - PLACES.safehouse.z) < 40) && p.ammo < GAME.startAmmo) {
        p.ammo = GAME.startAmmo;
      }
    }
    // Traffic, peds, rivals.
    updateTraffic(S.traffic, dt, rng, p);
    updatePeds(S.peds, dt, rng, p.inCar ? p.inCar : p);
    for (const car of S.traffic) {
      if (car.wrecked) continue;
      collideCarWithWorld(car, dt);
      // Traffic car hitting the player on foot hurts.
      if (!p.inCar && circleHitsCar(p.x, p.z, 1, car) && Math.abs(car.speed) > 5) {
        hurtPlayer(p, 12, G.now);
        car.speed = 0;
      }
      // Player car vs traffic car.
      if (p.inCar && carsOverlap(p.inCar, car)) {
        damageCar(p.inCar, 4, G.now);
        damageCar(car, 4, G.now);
        sfx(audio, 'crash');
      }
      // Traffic car running over a ped: ped dies, driver gets heat only if it is the player.
      for (const ped of S.peds) {
        if (ped.alive && circleHitsCar(ped.x, ped.z, 1, car) && Math.abs(car.speed) > 8) {
          ped.alive = false; ped.health = 0;
          if (car === p.inCar) addCrime(S.wanted, 1, G.now);
        }
      }
    }
    // Wanted, police, foot cops.
    updateWanted(S.wanted, G.now, dt);
    maintainPolice(dt);
    for (const pc of S.policeCars) {
      updatePoliceCar(pc, p, dt, G.now);
      collideCarWithWorld(pc, dt);
      if (p.inCar) {
        const dmg = ramDamage(pc, p.inCar, G.now);
        if (dmg > 0) sfx(audio, 'crash');
        if (carsOverlap(pc, p.inCar)) { pc.speed *= 0.85; }
      }
    }
    const cop = maybeSpawnFootCop(S.wanted, rng, p, S.cops, G.now);
    if (cop) sfx(audio, 'siren');
    for (const c of S.cops) {
      const dmg = updateFootCop(c, p, dt, G.now);
      if (dmg > 0) hurtPlayer(p, dmg, G.now);
    }
    if (bustedCheck(S.wanted, p, S.cops, dt, G.now)) { gameOver('busted'); }
    if (p.health <= 0 && S.screen === 'playing') { gameOver('wasted'); }
    // Rivals (mission 5): spawn when near the port, shoot the player.
    const m5 = currentMission(S.missions);
    if (m5 && m5.kind === 'kill' && Math.hypot(p.x - PLACES.port.x, p.z - PLACES.port.z) < 320) spawnRivals();
    for (const r of S.rivals) {
      if (!r.alive) continue;
      const d = Math.hypot(r.x - p.x, r.z - p.z);
      if (d < 60 && d > 10) {
        r.heading = Math.atan2(p.x - r.x, p.z - r.z);
        r.x += Math.sin(r.heading) * r.speed * dt;
        r.z += Math.cos(r.heading) * r.speed * dt;
      }
      if (d < 45 && G.now - r.shootAt >= 1.4) { r.shootAt = G.now; hurtPlayer(p, 4, G.now); }
    }
    // Health regen after 10 calm seconds at 0 stars.
    if (p.health < hpBefore) S.lastHurtAt = G.now;
    if (S.wanted.stars === 0 && G.now - S.lastHurtAt > 10 && p.health > 0 && p.health < p.maxHealth) {
      healPlayer(p, 1.5 * dt);
    }
    // Missions.
    const ev = missionEvent(S.missions, { player: p, wanted: S.wanted, car: p.inCar, now: G.now, at: p });
    if (ev === 'complete') finishMission();
    // Safehouse autosave.
    if (!p.inCar && Math.hypot(p.x - PLACES.safehouse.x, p.z - PLACES.safehouse.z) < 45 && G.now - S.lastSaveAt > 5) {
      S.lastSaveAt = G.now;
      writeSave(localStorage, p, S.missions, S.wanted);
      sfx(audio, 'save');
      S.missions.dialogue = 'Progress saved at the safehouse.';
      S.dialogueUntil = G.now + 3;
    }
    // Dialogue / banner expiry.
    if (S.missions.banner && G.now - S.missions.bannerAt > 4) S.missions.banner = null;
    if (S.missions.dialogue && G.now > S.dialogueUntil && S.missions.dialogue !== 'Progress saved at the safehouse.') {
      // keep mission dialogue until the next mission starts
    }
    updateEngine(audio, p.inCar ? p.inCar.speed : 0, !!p.inCar, dt);
    updateRadio(audio, dt);
  } else if (S.screen === 'title') {
    if (input.keys.has('start')) {
      input.keys.delete('start');
      resumeAudio(audio);
      audio.radioOn = true;
      const save = readSave(localStorage);
      if (save) applySave(p, S.missions, S.wanted, save);
      startMission(S.missions, G.now);
      S.dialogueUntil = G.now + 8;
      S.screen = 'playing';
    }
  } else if (S.screen === 'pause') {
    if (input.keys.has('pause')) { input.keys.delete('pause'); S.screen = 'playing'; }
  } else if (S.screen === 'over') {
    if (input.keys.has('start')) { input.keys.delete('start'); respawn(S.pendingRespawn || 'wasted'); }
  }
  // ---- sync meshes & HUD every frame ----------------------------------
  for (const car of [...S.traffic, ...S.parked, S.heistCar, ...S.policeCars]) syncCarMesh(car, dt);
  // The car the player is driving is not always in those lists (a staged
  // shot car, for example), so sync it explicitly or it renders invisible.
  if (p.inCar) syncCarMesh(p.inCar, dt);
  if (p.inCar) {
    playerMesh.visible = false;
  } else {
    playerMesh.visible = true;
    playerMesh.position.set(p.x, 0, p.z);
    playerMesh.rotation.y = p.heading;
    playerMesh.position.y = p.speed > 0.5 ? Math.abs(Math.sin(G.now * 9)) * 0.15 : 0;
  }
  for (const ped of S.peds) syncPersonMesh(ped, dt);
  for (const c of S.cops) syncPersonMesh(c, dt);
  for (const r of S.rivals) syncPersonMesh(r, dt);
  const target = missionTargetPos(S.missions);
  marker.position.set(target.x, 0, target.z);
  marker.material.opacity = 0.4 + Math.sin(G.now * 4) * 0.18;
  marker.rotation.y = G.now * 0.8;
  if (tracer.visible && G.now > tracerUntil) tracer.visible = false;
  for (const s of smokePool) {
    if (!s.visible) continue;
    s.userData.life -= dt;
    s.position.y += dt * 3;
    s.scale.multiplyScalar(1 + dt * 1.5);
    if (s.userData.life <= 0) { s.visible = false; s.scale.set(1, 1, 1); }
  }
  const camTarget = { x: p.x, y: 0, z: p.z };
  updateCamera(camera, camTarget, G.camYaw, G.camPitch, !!p.inCar, p.inCar ? p.inCar.speed : p.speed, dt);
  const m = currentMission(S.missions);
  renderHud(hud, {
    stars: S.wanted.stars, money: p.money, health: p.health, ammo: p.ammo,
    speed: p.inCar ? p.inCar.speed : p.speed,
    carName: p.inCar ? p.inCar.label : '',
    objective: objectiveText(S.missions),
    dialogue: S.missions.dialogue && G.now < S.dialogueUntil ? S.missions.dialogue : null,
    banner: S.missions.banner,
    screen: S.screen, overKind: S.overKind,
  });
  drawMinimap(minimapCv, {
    player: p, target, police: S.policeCars, rivals: S.rivals.filter((r) => r.alive),
  }, G.now);
}

// ---- boot -------------------------------------------------------------
function resize() {
  resizeRenderer(renderer, camera, window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', resize);
resize();
if (SHOT) {
  applyShot(G, SHOT);
  S.dialogueUntil = G.now + 30;
  S.bannerUntil = G.now + 30;
  snapCamera(camera, { x: S.player.x, y: 0, z: S.player.z }, G.camYaw, G.camPitch,
    !!S.player.inCar, S.player.inCar ? S.player.inCar.speed : 0);
} else {
  startMission(S.missions, 0);
  S.dialogueUntil = 8;
}
let last = performance.now();
let frames = 0;
function loop(t) {
  const dt = Math.min(0.05, Math.max(0.001, (t - last) / 1000));
  last = t;
  try { tick(dt); } catch (e) { console.error('tick error', e); }
  renderer.render(scene, camera);
  frames += 1;
  if (SHOT && frames >= 4) window.__shotReady = true;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
