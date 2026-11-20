// Pedestrians: stroll the sidewalks, idle and chat, and run from gunfire,
// crashes and speeding cars. A car that hits a ped at speed knocks them
// down — and the driver earns heat for it.
import { WORLD_W, WORLD_H } from './config.js';
import { clamp, dist, pick, range } from './random.js';
import { hitsBuilding, nearestRoadX, nearestRoadY } from './city.js';
import { hurtVictim } from './player.js';

const SHIRTS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#e67e22', '#9b59b6', '#ecf0f1', '#1abc9c'];
const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];

export function makePed(rng, x, y) {
  const horiz = rng() < 0.5;
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    hp: 40, speed: 0,
    shirt: pick(rng, SHIRTS), skin: pick(rng, SKINS),
    walkSpeed: range(rng, 55, 95),
    axis: horiz ? 'h' : 'v',
    dir: rng() < 0.5 ? 1 : -1,
    lane: (rng() < 0.5 ? -1 : 1) * 62,
    flee: 0, panic: 0, wait: range(rng, 0, 3),
    walkPhase: range(rng, 0, 6),
  };
}

export function spawnPeds(state, rng, n) {
  for (let i = 0; i < n; i += 1) {
    const x = range(rng, 150, WORLD_W - 150);
    const y = range(rng, 150, WORLD_H - 150);
    if (dist(x, y, state.player.x, state.player.y) < 300) continue;
    state.peds.push(makePed(rng, x, y));
  }
}

export function stepPeds(state, dt, rng) {
  const p = state.player;
  for (const ped of state.peds) {
    if (ped.hp <= 0) continue;
    if (ped.flee > 0) ped.flee -= dt;
    let fx = 0;
    let fy = 0;
    const dp = dist(ped.x, ped.y, p.x, p.y);
    if (ped.flee > 0 || dp < 90) {
      fx = ped.x - p.x;
      fy = ped.y - p.y;
    } else {
      for (const car of state.cars) {
        if (car.dead) continue;
        const dc = dist(ped.x, ped.y, car.x, car.y);
        if (dc < 90 && Math.abs(car.speed) > 60) {
          fx = ped.x - car.x;
          fy = ped.y - car.y;
          break;
        }
      }
    }
    if (fx !== 0 || fy !== 0) {
      const l = Math.hypot(fx, fy) || 1;
      ped.angle = Math.atan2(fy / l, fx / l);
      const sp = ped.walkSpeed * 2.6;
      const nx = ped.x + Math.cos(ped.angle) * sp * dt;
      const ny = ped.y + Math.sin(ped.angle) * sp * dt;
      if (!hitsBuilding(state.city, nx, ny, 10)) { ped.x = nx; ped.y = ny; }
      ped.speed = sp;
      ped.walkPhase += dt * sp * 0.06;
      continue;
    }
    if (ped.wait > 0) { ped.wait -= dt; ped.speed = 0; continue; }
    if (rng() < dt * 0.15) ped.wait = range(rng, 1, 4);
    if (rng() < dt * 0.2) {
      ped.axis = ped.axis === 'h' ? 'v' : 'h';
      ped.dir *= rng() < 0.5 ? 1 : -1;
    }
    const a = ped.axis === 'h' ? (ped.dir > 0 ? 0 : Math.PI) : (ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    ped.angle = a;
    let nx = ped.x + Math.cos(a) * ped.walkSpeed * dt;
    let ny = ped.y + Math.sin(a) * ped.walkSpeed * dt;
    if (ped.axis === 'h') ny = nearestRoadY(ped.y) + ped.lane;
    else nx = nearestRoadX(ped.x) + ped.lane;
    if (hitsBuilding(state.city, nx, ny, 10)) { ped.dir *= -1; continue; }
    ped.x = clamp(nx, 30, WORLD_W - 30);
    ped.y = clamp(ny, 30, WORLD_H - 30);
    ped.speed = ped.walkSpeed;
    ped.walkPhase += dt * ped.walkSpeed * 0.06;
  }
  // Car-vs-ped hits.
  for (const car of state.cars) {
    if (car.dead || Math.abs(car.speed) < 80) continue;
    for (const ped of state.peds) {
      if (ped.hp <= 0) continue;
      if (dist(ped.x, ped.y, car.x, car.y) < 30) {
        hurtVictim(state, ped, 50, car.driver === 'player');
        ped.x += (ped.x - car.x) * 0.4;
        ped.y += (ped.y - car.y) * 0.4;
      }
    }
  }
  state.peds = state.peds.filter((ped) => ped.hp > 0 || dist(ped.x, ped.y, p.x, p.y) < 700);
}
