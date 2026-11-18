// The player on foot: walking/running, punching, shooting, entering cars.
// When driving, the car owns the motion and this module only handles exit.
import { PLAYER, WORLD_W, WORLD_H } from './config.js';
import { clamp } from './random.js';
import { hitsBuilding } from './city.js';
import { sfx } from './audio.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, hp: PLAYER.hp, money: 120, ammo: PLAYER.startAmmo,
    inCar: null,
    fireCd: 0, punchCd: 0, punchAnim: 0, hurtFlash: 0, speed: 0,
    walkPhase: 0,
  };
}

// Move on foot. `aim` is a world-space aim point.
export function stepPlayerOnFoot(state, dt, inp, aim) {
  const p = state.player;
  p.fireCd = Math.max(0, p.fireCd - dt);
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.punchAnim = Math.max(0, p.punchAnim - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  let mx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  let my = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  const speed = inp.run ? PLAYER.run : PLAYER.walk;
  const nx = p.x + mx * speed * dt;
  const ny = p.y + my * speed * dt;
  if (!hitsBuilding(state.city, nx, p.y, 12)) p.x = clamp(nx, 20, WORLD_W - 20);
  if (!hitsBuilding(state.city, p.x, ny, 12)) p.y = clamp(ny, 20, WORLD_H - 20);
  p.speed = len > 0 ? speed : 0;
  if (len > 0) p.walkPhase += dt * speed * 0.06;
  if (aim) p.angle = Math.atan2(aim.y - p.y, aim.x - p.x);
  else if (len > 0) p.angle = Math.atan2(my, mx);

  if (inp.punch && p.punchCd <= 0) {
    p.punchCd = 0.45; p.punchAnim = 0.25;
    sfx.punch();
    const target = nearestVictim(state, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20, PLAYER.punchRange);
    if (target) hurtVictim(state, target, PLAYER.punchDamage, true);
  }
  if (inp.shoot && p.fireCd <= 0 && p.ammo > 0) {
    p.fireCd = PLAYER.fireDelay;
    p.ammo -= 1;
    sfx.shoot();
    const a = p.angle;
    state.bullets.push({
      x: p.x + Math.cos(a) * 22, y: p.y + Math.sin(a) * 22,
      vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.7, fromPlayer: true,
    });
    if (state.wanted < 1) addWanted(state, 1);
    state.shotsFired = (state.shotsFired || 0) + 1;
  }
}

export function nearestVictim(state, x, y, r) {
  let best = null; let bd = r;
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < bd) { bd = d; best = ped; }
  }
  for (const cop of state.cops) {
    if (cop.hp <= 0) continue;
    const d = Math.hypot(cop.x - x, cop.y - y);
    if (d < bd) { bd = d; best = cop; }
  }
  return best;
}

export function hurtVictim(state, v, dmg, byPlayer) {
  v.hp -= dmg;
  v.flee = 1;
  if (v.hp <= 0) {
    v.hp = 0;
    if (byPlayer) {
      addWanted(state, v.isCop ? 2 : 1);
      state.kills = (state.kills || 0) + 1;
      if (state.mission && state.mission.type === 'shootout') state.mission.kills += 1;
    }
  }
}

export function addWanted(state, n) {
  state.wanted = Math.min(5, state.wanted + n);
  state.wantedTimer = 0;
  state.seenTimer = 0;
}

export function hurtPlayer(state, dmg) {
  const p = state.player;
  if (p.hp <= 0) return;
  p.hp -= dmg;
  p.hurtFlash = 0.3;
  sfx.hurt();
  if (p.hp <= 0) {
    p.hp = 0;
    state.over = 'wasted';
    state.overTimer = 0;
  }
}

// Enter the nearest car within range; exit to a free spot beside the car.
export function tryEnterCar(state) {
  const p = state.player;
  if (p.inCar) {
    const car = state.cars.find((c) => c.id === p.inCar);
    if (car) {
      const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
      const sy = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
      if (!hitsBuilding(state.city, sx, sy, 12)) { p.x = sx; p.y = sy; }
      else { p.x = car.x - Math.cos(car.angle + Math.PI / 2) * 40; p.y = car.y - Math.sin(car.angle + Math.PI / 2) * 40; }
      p.angle = car.angle;
      car.driver = null;
      p.inCar = null;
      sfx.door();
    }
    return;
  }
  let best = null; let bd = 70;
  for (const car of state.cars) {
    if (car.dead) continue;
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bd) { bd = d; best = car; }
  }
  if (best) {
    p.inCar = best.id;
    best.driver = 'player';
    best.traffic = false;
    best.speed = 0;
    p.x = best.x; p.y = best.y; p.angle = best.angle;
    sfx.door();
    if (!best.stolen && best.model !== 'police') {
      best.stolen = true;
      addWanted(state, 1);
      state.message = `Stole a ${best.model}! The cops noticed.`;
      state.messageTimer = 2.5;
    }
  }
}
