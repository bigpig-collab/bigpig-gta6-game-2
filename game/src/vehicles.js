// Car physics and state for Solmar City. Pure logic, no rendering: every
// car carries its own size (half extents) so collisions can never run on a
// car with missing dimensions.
import { CAR_SPECS } from './config.js';
import { clamp, angleDiff } from './random.js';

export function makeCar(type, x, z, heading, opts = {}) {
  const spec = CAR_SPECS[type];
  if (!spec) throw new Error('unknown car type ' + type);
  return {
    id: opts.id || ('car-' + Math.floor(Math.random() * 1e9)),
    type, label: spec.label,
    x, z, heading, speed: 0,
    top: spec.top, accel: spec.accel, brake: spec.brake, turn: spec.turn,
    len: spec.len, wid: spec.wid,
    // Half extents used by every collision test; never left undefined.
    hx: spec.len / 2, hz: spec.wid / 2,
    radius: Math.hypot(spec.len, spec.wid) / 2,
    hp: opts.hp ?? spec.hp, maxHp: spec.hp,
    color: spec.color, wrecked: false, braking: false, handbrake: false,
    smoke: 0, police: type === 'police', mission: !!opts.mission,
    parked: !!opts.parked, traffic: !!opts.traffic, driver: opts.driver ?? null,
    edgeHitAt: -10, ramContact: 0,
  };
}
// Arcade drive step. input: {throttle 0..1, brake 0..1, steer -1..1, hand 0/1}
// Returns distance travelled this step (used by the engine sound).
export function updateCar(car, input, dt) {
  if (car.wrecked) { car.speed = 0; return 0; }
  const grip = input.hand ? 0.45 : 1;
  if (input.throttle > 0) car.speed += car.accel * input.throttle * dt;
  if (input.brake > 0) {
    if (car.speed > 0.5) car.speed -= car.brake * input.brake * dt;
    else car.speed -= car.accel * 0.45 * input.brake * dt; // reverse
  }
  car.speed -= car.speed * (input.hand ? 1.6 : 0.25) * dt; // drag
  car.speed = clamp(car.speed, -car.top * 0.35, car.top);
  const steerRate = car.turn * clamp(Math.abs(car.speed) / 60, 0, 1) * grip;
  car.heading += input.steer * steerRate * dt * (car.speed >= 0 ? 1 : -1);
  const dx = Math.sin(car.heading) * car.speed * dt;
  const dz = Math.cos(car.heading) * car.speed * dt;
  car.x += dx; car.z += dz;
  car.braking = input.brake > 0 && car.speed > 1;
  car.handbrake = !!input.hand;
  return Math.hypot(dx, dz);
}
// Damage with a per-car throttle so repeated contact cannot shred a car
// in a single second (edge scrapes and rams tick at most every 0.4 s).
export function damageCar(car, amount, now) {
  if (car.wrecked) return 0;
  if (now - (car.lastDamageAt ?? -10) < 0.4 && amount < 20) return 0;
  car.lastDamageAt = now;
  car.hp -= amount;
  car.smoke = clamp(1 - car.hp / car.maxHp, 0, 1);
  if (car.hp <= 0) { car.hp = 0; car.wrecked = true; car.speed = 0; }
  return amount;
}
export function carFront(car) {
  return { x: car.x + Math.sin(car.heading) * car.hx, z: car.z + Math.cos(car.heading) * car.hx };
}
export function carRear(car) {
  return { x: car.x - Math.sin(car.heading) * car.hx, z: car.z - Math.cos(car.heading) * car.hx };
}
// Circle (a person or another car centre) vs this car's rotated rectangle.
export function circleHitsCar(px, pz, r, car) {
  const dx = px - car.x, dz = pz - car.z;
  const c = Math.cos(-car.heading), s = Math.sin(-car.heading);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const qx = clamp(lx, -car.hx, car.hx), qz = clamp(lz, -car.hz, car.hz);
  const ddx = lx - qx, ddz = lz - qz;
  return ddx * ddx + ddz * ddz < r * r;
}
export function carsOverlap(a, b) {
  const dx = a.x - b.x, dz = a.z - b.z;
  const rr = a.radius + b.radius;
  if (dx * dx + dz * dz >= rr * rr) return false;
  return circleHitsCar(a.x, a.z, a.radius * 0.8, b) || circleHitsCar(b.x, b.z, b.radius * 0.8, a);
}
export function steerToward(car, tx, tz, dt, speedTarget) {
  const dx = tx - car.x, dz = tz - car.z;
  const d = Math.hypot(dx, dz);
  const want = Math.atan2(dx, dz);
  const diff = angleDiff(car.heading, want);
  const steer = clamp(diff * 1.6, -1, 1);
  // Slow down when close so the turning circle shrinks below the distance
  // to the target; a fast car that never slows orbits its target forever
  // and can never ram it or reach it.
  const closeCap = Math.max(28, d * 1.1);
  const effTarget = Math.min(speedTarget, closeCap);
  const throttle = Math.abs(diff) > 1.2 ? 0.25 : 1;
  updateCar(car, { throttle, brake: car.speed > effTarget ? 0.8 : 0, steer, hand: 0 }, dt);
  return diff;
}
