// Combat: punch and pistol resolution against people (peds, foot cops,
// rivals). Pure functions over plain objects, so Node sims can run them.
import { GAME } from './config.js';
import { angleDiff } from './random.js';

export function makePerson(kind, x, z, opts = {}) {
  return {
    id: opts.id || (kind + '-' + Math.floor(Math.random() * 1e9)),
    kind, x, z, heading: opts.heading ?? 0,
    health: opts.health ?? GAME.pedHealth,
    maxHealth: opts.health ?? GAME.pedHealth,
    speed: opts.speed ?? 2.2, alive: true, fleeing: false,
    shootAt: -10, state: opts.state ?? 'walk',
  };
}
export function nearestInFront(px, pz, heading, people, maxDist, maxAngle) {
  let best = null, bestD = Infinity;
  for (const person of people) {
    if (!person.alive) continue;
    const dx = person.x - px, dz = person.z - pz;
    const d = Math.hypot(dx, dz);
    if (d > maxDist || d >= bestD) continue;
    const ang = Math.atan2(dx, dz);
    if (Math.abs(angleDiff(heading, ang)) > maxAngle) continue;
    best = person; bestD = d;
  }
  return best;
}
export function damagePerson(person, amount) {
  person.health -= amount;
  if (person.health <= 0) { person.health = 0; person.alive = false; }
  return person.alive;
}
export function punch(p, people, now) {
  const target = nearestInFront(p.x, p.z, p.heading, people, 3.2, 1.1);
  if (!target) return null;
  damagePerson(target, GAME.punchDamage);
  return target;
}
// Hitscan pistol: nearest living person inside the aim cone and range.
export function shoot(p, aimHeading, people, now) {
  const target = nearestInFront(p.x, p.z, aimHeading, people, 70, 0.35);
  if (!target) return { hit: null, end: { x: p.x + Math.sin(aimHeading) * 70, z: p.z + Math.cos(aimHeading) * 70 } };
  damagePerson(target, GAME.pistolDamage);
  return { hit: target, end: { x: target.x, z: target.z } };
}
export function shootAtCar(p, aimHeading, cars, now) {
  let best = null, bestD = Infinity;
  for (const car of cars) {
    if (car.wrecked) continue;
    const dx = car.x - p.x, dz = car.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 70 || d >= bestD) continue;
    if (Math.abs(angleDiff(aimHeading, Math.atan2(dx, dz))) > 0.3) continue;
    best = car; bestD = d;
  }
  return best;
}
