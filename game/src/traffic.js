// Traffic cars and pedestrians. Pure grid AI: cars follow lanes, slow at
// junctions and turn onto cross streets; peds walk sidewalks and flee.
import { WORLD } from './config.js';
import { makeCar, updateCar, carsOverlap } from './vehicles.js';
import { makePerson } from './combat.js';
import { nearestRoadCoord, atJunction, onRoad, clampToWorld } from './world.js';
import { clamp } from './random.js';

export function spawnTraffic(rng, count) {
  const cars = [];
  const types = ['sedan', 'taxi', 'van', 'truck', 'sedan', 'sports'];
  for (let i = 0; i < count; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = axis === 'x' ? rng.pick(WORLD.roadsX) : rng.pick(WORLD.roadsZ);
    const along = rng.range(-WORLD.halfW + 100, WORLD.halfW - 100);
    const dir = rng.chance(0.5) ? 1 : -1;
    const x = axis === 'x' ? road + WORLD.lane * dir : along;
    const z = axis === 'x' ? along : road + WORLD.lane * dir;
    const heading = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    const car = makeCar(rng.pick(types), x, z, heading, { traffic: true, id: 'traffic-' + i });
    car.speed = rng.range(18, 30);
    car.axis = axis; car.dir = dir; car.cruise = car.speed;
    cars.push(car);
  }
  return cars;
}
export function updateTraffic(cars, dt, rng, playerPos) {
  for (const car of cars) {
    if (car.wrecked) continue;
    // Slow near junctions and near the player, then resume cruise speed.
    const nearJunction = atJunction(car.x, car.z);
    const pd = playerPos ? Math.hypot(car.x - playerPos.x, car.z - playerPos.z) : 999;
    const want = nearJunction ? car.cruise * 0.45 : (pd < 40 ? car.cruise * 0.5 : car.cruise);
    const input = { throttle: car.speed < want ? 0.7 : 0, brake: car.speed > want ? 0.8 : 0, steer: 0, hand: 0 };
    updateCar(car, input, dt);
    // Keep on the lane: steer gently back to the road centreline.
    const laneOff = car.axis === 'x'
      ? (car.x - (nearestRoadCoord(car.x, WORLD.roadsX).road + WORLD.lane * car.dir))
      : (car.z - (nearestRoadCoord(car.z, WORLD.roadsZ).road + WORLD.lane * car.dir));
    const steer = clamp(-laneOff * 0.02 - (car.axis === 'x' ? Math.sin(car.heading) * 0.1 : Math.cos(car.heading) * 0.1), -0.4, 0.4);
    car.heading += steer * dt * (car.speed >= 0 ? 1 : -1) * 2;
    // Turn at a junction sometimes.
    if (nearJunction && rng.chance(dt * 0.12)) {
      car.axis = car.axis === 'x' ? 'z' : 'x';
      car.dir = rng.chance(0.5) ? 1 : -1;
      car.heading = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const snap = car.axis === 'x' ? { x: nearestRoadCoord(car.x, WORLD.roadsX).road, z: car.z } : { x: car.x, z: nearestRoadCoord(car.z, WORLD.roadsZ).road };
      car.x = snap.x; car.z = snap.z;
    }
    const c = clampToWorld(car.x, car.z, 60);
    if (c.x !== car.x || c.z !== car.z) { car.x = c.x; car.z = c.z; car.heading += Math.PI; car.dir *= -1; }
  }
  // Gentle separation so traffic does not pile up bumper to bumper.
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      if (a.wrecked || b.wrecked) continue;
      if (carsOverlap(a, b)) {
        const dx = a.x - b.x, dz = a.z - b.z, d = Math.hypot(dx, dz) || 1;
        a.x += (dx / d) * 2 * dt * 10; a.z += (dz / d) * 2 * dt * 10;
        b.x -= (dx / d) * 2 * dt * 10; b.z -= (dz / d) * 2 * dt * 10;
        a.speed *= 0.98; b.speed *= 0.98;
      }
    }
  }
}
export function spawnParked(rng, count) {
  const cars = [];
  const types = ['sedan', 'taxi', 'van', 'sports', 'truck'];
  for (let i = 0; i < count; i++) {
    const axis = rng.chance(0.5) ? 'x' : 'z';
    const road = axis === 'x' ? rng.pick(WORLD.roadsX) : rng.pick(WORLD.roadsZ);
    const along = rng.range(-WORLD.halfW + 120, WORLD.halfW - 120);
    const side = rng.chance(0.5) ? 1 : -1;
    const x = axis === 'x' ? road + (WORLD.roadWidth / 2 + 6) * side : along;
    const z = axis === 'x' ? along : road + (WORLD.roadWidth / 2 + 6) * side;
    const heading = axis === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
    cars.push(makeCar(rng.pick(types), x, z, heading, { parked: true, id: 'parked-' + i }));
  }
  return cars;
}
export function spawnPeds(rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = rng.range(-1400, 1400), z = rng.range(-1000, 1000);
    const ped = makePerson('ped', x, z, { id: 'ped-' + i, heading: rng.range(0, Math.PI * 2) });
    ped.walkTarget = { x: rng.range(-1400, 1400), z: rng.range(-1000, 1000) };
    peds.push(ped);
  }
  return peds;
}
export function updatePeds(peds, dt, rng, danger) {
  for (const ped of peds) {
    if (!ped.alive) continue;
    if (!ped.walkTarget) ped.walkTarget = { x: ped.x + 40, z: ped.z + 40 };
    const dx = danger ? ped.x - danger.x : 0, dz = danger ? ped.z - danger.z : 0;
    const dd = danger ? Math.hypot(dx, dz) : 999;
    if (dd < 60) { ped.fleeing = true; ped.walkTarget = { x: ped.x + (dx / (dd || 1)) * 120, z: ped.z + (dz / (dd || 1)) * 120 }; }
    else if (ped.fleeing && dd > 120) ped.fleeing = false;
    const t = ped.walkTarget;
    const tx = t.x - ped.x, tz = t.z - ped.z, td = Math.hypot(tx, tz);
    if (td < 8) { ped.walkTarget = { x: ped.x + rng.range(-260, 260), z: ped.z + rng.range(-260, 260) }; continue; }
    const speed = ped.fleeing ? 5.5 : ped.speed;
    ped.heading = Math.atan2(tx, tz);
    ped.x += (tx / td) * speed * dt;
    ped.z += (tz / td) * speed * dt;
    const c = clampToWorld(ped.x, ped.z, 30);
    ped.x = c.x; ped.z = c.z;
  }
}
export function nearestCarTo(x, z, cars, maxDist) {
  let best = null, bestD = Infinity;
  for (const car of cars) {
    if (car.wrecked) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < maxDist && d < bestD) { best = car; bestD = d; }
  }
  return best;
}
