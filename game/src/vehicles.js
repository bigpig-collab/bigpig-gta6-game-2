// Cars: creation, player driving physics, traffic AI, collisions, damage.
import { CAR_MODELS, WORLD_W, WORLD_H, ROAD_W, STEP } from './config.js';
import { clamp, pick, range, turnToward } from './random.js';
import { hitsBuilding, nearJunction, nearestRoadX, nearestRoadY, onRoad } from './city.js';
import { sfx } from './audio.js';

let nextId = 1;

export function makeCar(rng, model, x, y, angle) {
  const spec = CAR_MODELS[model];
  return {
    id: nextId += 1, model, x, y, angle,
    speed: 0, hp: spec.hp, maxHp: spec.hp,
    color: pick(rng, spec.colors),
    traffic: false, driver: null, stolen: false,
    axis: 'h', dir: 1, lane: 0, wait: 0, cruise: range(rng, 110, 190),
    smoke: 0, brakeLight: false,
  };
}

export function resetCarIds() { nextId = 1; }

// Spawn a traffic car on a random road, away from the player.
export function spawnTrafficCar(state, rng) {
  const models = ['sedan', 'sedan', 'taxi', 'truck', 'van', 'sports'];
  const model = pick(rng, models);
  const horiz = rng() < 0.5;
  let x; let y; let angle;
  if (horiz) {
    y = pick(rng, [200, 600, 1000, 1400, 1800, 2200]);
    x = range(rng, 150, WORLD_W - 150);
    angle = rng() < 0.5 ? 0 : Math.PI;
  } else {
    x = pick(rng, [200, 600, 1000, 1400, 1800, 2200, 2600]);
    y = range(rng, 150, WORLD_H - 150);
    angle = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  const d = Math.hypot(x - state.player.x, y - state.player.y);
  if (d < 420) return null;
  const car = makeCar(rng, model, x, y, angle);
  car.traffic = true;
  car.axis = horiz ? 'h' : 'v';
  car.dir = horiz ? (angle === 0 ? 1 : -1) : (angle === Math.PI / 2 ? 1 : -1);
  car.lane = (rng() < 0.5 ? -1 : 1) * 20;
  return car;
}

// Player driving: arcade handling — throttle, steering scales with speed,
// handbrake (Space) cuts grip and speed.
export function stepPlayerCar(state, dt, inp) {
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.inCar);
  if (!car) { p.inCar = null; return; }
  const spec = CAR_MODELS[car.model];
  const throttle = (inp.up ? 1 : 0) - (inp.down ? 0.6 : 0);
  const steer = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
  if (inp.brake) car.speed *= Math.max(0, 1 - 3.2 * dt);
  car.speed += throttle * spec.accel * dt;
  car.speed -= car.speed * 0.55 * dt; // drag
  car.speed = clamp(car.speed, -spec.top * 0.4, spec.top);
  const grip = inp.brake ? 0.35 : 1;
  const turnRate = spec.turn * clamp(Math.abs(car.speed) / 120, 0, 1) * grip;
  car.angle += steer * turnRate * dt * Math.sign(car.speed || 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const hit = hitsBuilding(state.city, nx, ny, 24);
  if (hit) {
    if (Math.abs(car.speed) > 120) { damageCar(state, car, 14); sfx.crash(); }
    car.speed *= -0.25;
  } else {
    car.x = clamp(nx, 30, WORLD_W - 30);
    car.y = clamp(ny, 30, WORLD_H - 30);
  }
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
  car.brakeLight = inp.brake || inp.down;
  car.smoke = car.hp < car.maxHp * 0.4 ? 1 : 0;
}

function carAhead(state, car, look) {
  const ax = Math.cos(car.angle); const ay = Math.sin(car.angle);
  let best = null; let bd = look;
  for (const other of state.cars) {
    if (other === car) continue;
    const dx = other.x - car.x; const dy = other.y - car.y;
    const along = dx * ax + dy * ay;
    const side = Math.abs(-dx * ay + dy * ax);
    if (along > 0 && along < bd && side < 34) { bd = along; best = other; }
  }
  return best;
}

// Traffic: follow the road grid, turn at junctions sometimes, slow for the
// car ahead, stop briefly at busy junctions.
export function stepTrafficCar(state, car, dt, rng) {
  if (car.wait > 0) { car.wait -= dt; car.speed *= 0.9; return; }
  const ahead = carAhead(state, car, 110);
  const target = ahead ? Math.max(0, ahead.speed - 30) : car.cruise;
  car.speed += clamp(target - car.speed, -260 * dt, 140 * dt);
  if (nearJunction(car.x, car.y, 46) && rng() < dt * 0.9) {
    const turn = rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    car.angle += turn;
    car.axis = car.axis === 'h' ? 'v' : 'h';
    car.dir = Math.abs(Math.sin(car.angle)) > 0.5 ? Math.sign(Math.sin(car.angle)) : Math.sign(Math.cos(car.angle));
    if (car.axis === 'h') car.y = nearestRoadY(car.y);
    else car.x = nearestRoadX(car.x);
  }
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (!hitsBuilding(state.city, nx, ny, 24) && onRoad(nx, ny)) {
    car.x = nx; car.y = ny;
  } else {
    car.angle += Math.PI;
    car.speed *= 0.4;
  }
  if (car.x < 80 || car.x > WORLD_W - 80 || car.y < 80 || car.y > WORLD_H - 80) {
    car.angle += Math.PI;
    car.x = clamp(car.x, 90, WORLD_W - 90);
    car.y = clamp(car.y, 90, WORLD_H - 90);
  }
}

export function damageCar(state, car, dmg) {
  car.hp -= dmg;
  if (car.hp <= 0) {
    car.hp = 0;
    car.speed = 0;
    car.dead = true;
    if (car.driver === 'player') {
      state.player.inCar = null;
      state.player.x = car.x + 40;
      state.player.y = car.y + 40;
    }
  }
}

// Simple pairwise car collision: push apart, exchange a little speed, damage.
export function collideCars(state) {
  const cars = state.cars;
  for (const c of cars) c._hitCd = Math.max(0, (c._hitCd || 0) - STEP);
  for (let i = 0; i < cars.length; i += 1) {
    for (let j = i + 1; j < cars.length; j += 1) {
      const a = cars[i]; const b = cars[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x; const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 52 && d > 0.01) {
        const push = (52 - d) / 2;
        const ux = dx / d; const uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        if (a._hitCd > 0 || b._hitCd > 0) continue;
        const rel = Math.abs(a.speed - b.speed);
        if (rel > 90) {
          damageCar(state, a, 6); damageCar(state, b, 6);
          if (a.driver === 'player' || b.driver === 'player') sfx.crash();
          for (const ped of state.peds) {
            if (Math.hypot(ped.x - a.x, ped.y - a.y) < 160) ped.flee = 1;
          }
        }
        a.speed *= 0.8; b.speed *= 0.8;
        a._hitCd = 0.5; b._hitCd = 0.5;
      }
    }
  }
}
