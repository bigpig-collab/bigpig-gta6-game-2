// World state + the fixed-step simulation. Owns the player, cars, peds,
// cops, bullets, wanted level, missions and timers; each subsystem lives in
// its own module and is called from here in a fixed order.
import { STEP, WORLD_W, WORLD_H, PLACES, MONEY_START, PLAYER } from './config.js';
import { makeRng, hashSeed, clamp, dist } from './random.js';
import { buildCity, hitsBuilding } from './city.js';
import { makePlayer, stepPlayerOnFoot, tryEnterCar, hurtPlayer, hurtVictim } from './player.js';
import { makeCar, resetCarIds, spawnTrafficCar, stepPlayerCar, stepTrafficCar, collideCars, damageCar } from './vehicles.js';
import { stepPolice, applyRespawn } from './police.js';
import { makePed, spawnPeds, stepPeds } from './peds.js';
import { startMission, updateMission } from './missions.js';
import { updateAudio, sfx } from './audio.js';
import { applySave } from './save.js';

export function createWorld(seed) {
  resetCarIds();
  const rng = makeRng(typeof seed === 'number' ? seed : hashSeed(String(seed)));
  const city = buildCity(typeof seed === 'number' ? seed : hashSeed(String(seed)));
  const state = {
    seed, rng, city,
    time: 0,
    player: makePlayer(PLACES.safehouse.x + 60, PLACES.safehouse.y + 40),
    cars: [], peds: [], cops: [], bullets: [],
    wanted: 0, wantedTimer: 0, spawnCd: 0,
    missionIdx: 0, mission: null, missionDone: 0, pendingNext: null, pendingTimer: 0,
    storyDone: false,
    objective: { x: 0, y: 0, label: '' },
    message: '', messageTimer: 0,
    dialogue: '', dialogueTimer: 0,
    banner: '', bannerTimer: 0,
    over: null, overTimer: 0,
    kills: 0, shotsFired: 0,
    camX: 0, camY: 0,
    nearSafehouse: false, saveCd: 0, savedFlash: 0,
  };
  state.player.money = MONEY_START;
  for (let i = 0; i < 14; i += 1) {
    const car = spawnTrafficCar(state, rng);
    if (car) state.cars.push(car);
  }
  spawnPeds(state, rng, 26);
  const starter = makeCar(rng, 'sedan', PLACES.safehouse.x + 120, PLACES.safehouse.y + 90, 0);
  state.cars.push(starter);
  startMission(state, 0);
  return state;
}

export function resetWorld(state, seed) {
  const fresh = createWorld(seed);
  for (const k of Object.keys(fresh)) state[k] = fresh[k];
}

// One fixed step. `inp` is the live or scripted input; `aim` is a world
// point the player faces / shoots toward.
export function stepWorld(state, dt, inp, aim) {
  if (state.over) {
    state.overTimer += dt;
    return;
  }
  state.time += dt;
  state.spawnCd = Math.max(0, state.spawnCd - dt);
  state.messageTimer = Math.max(0, state.messageTimer - dt);
  state.dialogueTimer = Math.max(0, state.dialogueTimer - dt);
  state.bannerTimer = Math.max(0, state.bannerTimer - dt);
  const p = state.player;

  if (inp.interact) tryEnterCar(state);

  if (p.inCar) stepPlayerCar(state, dt, inp);
  else stepPlayerOnFoot(state, dt, inp, aim);

  for (const car of state.cars) {
    if (car.isPolice || car.dead) continue;
    if (car.driver === 'player') continue;
    if (car.traffic) stepTrafficCar(state, car, dt, state.rng);
  }
  stepPolice(state, dt, state.rng);
  stepPeds(state, dt, state.rng);
  collideCars(state);

  // Bullets fly, hit buildings / people / cars / the player.
  for (const b of state.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    let hit = false;
    if (b.x < 0 || b.x > WORLD_W || b.y < 0 || b.y > WORLD_H) hit = true;
    if (!hit && hitsBuilding(state.city, b.x, b.y, 0)) hit = true;
    if (!hit && b.fromPlayer) {
      for (const ped of state.peds) {
        if (ped.hp > 0 && dist(b.x, b.y, ped.x, ped.y) < 16) {
          hurtVictim(state, ped, PLAYER.pistolDamage, true);
          hit = true; break;
        }
      }
      if (!hit) for (const cop of state.cops) {
        if (cop.hp > 0 && dist(b.x, b.y, cop.x, cop.y) < 16) {
          hurtVictim(state, cop, PLAYER.pistolDamage, true);
          hit = true; break;
        }
      }
      if (!hit) for (const car of state.cars) {
        if (!car.dead && dist(b.x, b.y, car.x, car.y) < 26) {
          damageCar(state, car, 12);
          hit = true; break;
        }
      }
    }
    if (!hit && !b.fromPlayer && !p.inCar && p.hp > 0 && dist(b.x, b.y, p.x, p.y) < 15) {
      hurtPlayer(state, 9);
      hit = true;
    }
    if (hit) b.life = 0;
  }
  state.bullets = state.bullets.filter((b) => b.life > 0);

  if (state.cars.filter((c) => c.traffic).length < 12 && state.rng() < dt * 0.5) {
    const car = spawnTrafficCar(state, state.rng);
    if (car) state.cars.push(car);
  }
  if (state.peds.length < 22 && state.rng() < dt * 0.4) spawnPeds(state, state.rng, 2);
  state.cars = state.cars.filter((c) => {
    if (c.marked || c.driver === 'player' || c.isPolice) return true;
    if (c.dead) return dist(c.x, c.y, p.x, p.y) < 500;
    return dist(c.x, c.y, p.x, p.y) < 1500 || c.traffic;
  });

  updateMission(state, dt);
  updateAudio(p.inCar ? Math.abs((state.cars.find((c) => c.id === p.inCar) || { speed: 0 }).speed) / 470 : 0, state.wanted, !!p.inCar);

  if (!p.inCar && dist(p.x, p.y, PLACES.safehouse.x, PLACES.safehouse.y) < 80) {
    state.nearSafehouse = true;
    state.saveCd -= dt;
    if (state.saveCd <= 0) {
      state.saveCd = 5;
      state.savedFlash = 2;
    }
  } else {
    state.nearSafehouse = false;
  }
  state.savedFlash = Math.max(0, (state.savedFlash || 0) - dt);
}

export function loadIntoWorld(state, data) {
  applySave(state, data);
  state.mission = null;
  state.pendingNext = null;
  startMission(state, Math.min(data.missionIdx || 0, 5));
}
