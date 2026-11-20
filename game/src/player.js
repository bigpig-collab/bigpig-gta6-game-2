// On-foot player: movement, punch cooldown, health and ammo. Pure logic;
// the 3D figure and the camera live in the render layer.
import { GAME } from './config.js';
import { clamp } from './random.js';
import { collideCircleAABB, clampToWorld } from './world.js';

export function makePlayer(x, z, heading) {
  return {
    x, z, heading, speed: 0,
    health: GAME.startHealth, maxHealth: GAME.startHealth,
    money: GAME.startMoney, ammo: GAME.startAmmo,
    inCar: null, punchAt: -10, shootAt: -10, hurtAt: -10,
    walkSpeed: 6.5, runSpeed: 12,
  };
}
// input: {fwd -1..1, strafe -1..1, run 0/1, camYaw}. Returns distance moved.
export function updatePlayer(p, input, dt, buildings, now) {
  if (p.inCar) return 0;
  const speed = input.run ? p.runSpeed : p.walkSpeed;
  const sin = Math.sin(input.camYaw), cos = Math.cos(input.camYaw);
  let mx = (sin * input.fwd + cos * input.strafe);
  let mz = (cos * input.fwd - sin * input.strafe);
  const len = Math.hypot(mx, mz);
  if (len > 0.001) {
    mx /= len; mz /= len;
    const nx = p.x + mx * speed * dt, nz = p.z + mz * speed * dt;
    p.x = nx; p.z = nz;
    for (const b of buildings) {
      const r = collideCircleAABB(p.x, p.z, 0.9, b);
      p.x = r.x; p.z = r.z;
    }
    const c = clampToWorld(p.x, p.z, 24);
    p.x = c.x; p.z = c.z;
    p.heading = Math.atan2(mx, mz);
    p.speed = speed;
    return speed * dt;
  }
  p.speed = 0;
  return 0;
}
export function hurtPlayer(p, amount, now) {
  if (now - p.hurtAt < 0.3) return 0;
  p.hurtAt = now;
  p.health = Math.max(0, p.health - amount);
  return amount;
}
export function healPlayer(p, amount) {
  const before = p.health;
  p.health = Math.min(p.maxHealth, p.health + amount);
  return p.health - before;
}
export function canPunch(p, now) { return now - p.punchAt >= 0.45; }
export function markPunch(p, now) { p.punchAt = now; }
export function canShoot(p, now) { return now - p.shootAt >= 0.22 && p.ammo > 0; }
export function markShot(p, now) { p.shootAt = now; p.ammo -= 1; }
