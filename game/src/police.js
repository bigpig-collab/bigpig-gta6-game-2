// Wanted system and police. Pure logic: heat rises from crimes, decays
// when the player stays out of trouble; police cars ram (10 HP/s of
// contact); foot cops spawn only while the player is on foot, 2.5 s
// cooldown, at most 2 at once.
import { GAME, PLACES } from './config.js';
import { makeCar, steerToward, damageCar } from './vehicles.js';
import { makePerson } from './combat.js';
import { clamp } from './random.js';

export function makeWanted() {
  return {
    stars: 0, lastCrimeAt: -100, lastDecayAt: 0,
    copSpawnAt: -10, bustedAt: -10, bustedProgress: 0,
  };
}
export function addCrime(wanted, amount, now) {
  wanted.stars = clamp(wanted.stars + amount, 0, GAME.maxWanted);
  wanted.lastCrimeAt = now;
  // The decay clock starts when the 8 s grace ends, so the first star
  // drops a full heatDecaySeconds after the player goes clean (20 s
  // after the last crime), not the moment the grace ends. Without this
  // a 4-star drive home loses its first star before the player arrives.
  wanted.lastDecayAt = now + 8;
  return wanted.stars;
}
export function updateWanted(wanted, now, dt) {
  // Decay one star every heatDecaySeconds once the player has been clean
  // for at least 8 seconds.
  if (wanted.stars > 0 && now - wanted.lastCrimeAt > 8) {
    if (now - wanted.lastDecayAt >= GAME.heatDecaySeconds) {
      wanted.lastDecayAt = now;
      wanted.stars -= 1;
    }
  } else if (wanted.stars === 0) {
    wanted.lastDecayAt = now;
  }
  return wanted.stars;
}
export function policeCarTarget(stars) {
  if (stars <= 0) return 0;
  if (stars === 1) return 1;
  if (stars === 2) return 2;
  if (stars === 3) return 3;
  if (stars === 4) return 4;
  return 5;
}
export function spawnPoliceCar(rng, x, z, id) {
  const car = makeCar('police', x, z, rng.range(0, Math.PI * 2), { id: id || 'police-' + Math.floor(rng.next() * 1e9) });
  car.speed = 60;
  return car;
}
export function updatePoliceCar(car, target, dt, now) {
  if (car.wrecked) return;
  const d = Math.hypot(target.x - car.x, target.z - car.z);
  // Ram the target: steer hard, keep speed up while closing in.
  const speedTarget = d > 120 ? car.top : Math.max(120, d * 1.4);
  steerToward(car, target.x, target.z, dt, speedTarget);
  return d;
}
// Ram contact damage, throttled: 10 HP/s while touching, applied in
// 0.5 s ticks of 5 HP so one touch never shreds a car instantly.
export function ramDamage(policeCar, playerCar, now) {
  if (!playerCar || playerCar.wrecked) return 0;
  const dx = policeCar.x - playerCar.x, dz = policeCar.z - playerCar.z;
  const rr = policeCar.radius + playerCar.radius;
  if (dx * dx + dz * dz >= rr * rr) { policeCar.ramContact = 0; return 0; }
  policeCar.ramContact += 1;
  if (now - (policeCar.lastRamAt ?? -10) >= 0.5) {
    policeCar.lastRamAt = now;
    damageCar(playerCar, 5, now);
    return 5;
  }
  return 0;
}
export function maybeSpawnFootCop(wanted, rng, player, cops, now) {
  if (player.inCar) return null;
  if (wanted.stars < 1) return null;
  if (cops.filter((c) => c.alive).length >= GAME.maxFootCops) return null;
  if (now - wanted.copSpawnAt < GAME.copSpawnCooldown) return null;
  wanted.copSpawnAt = now;
  const ang = rng.range(0, Math.PI * 2);
  const cop = makePerson('cop', player.x + Math.sin(ang) * 26, player.z + Math.cos(ang) * 26,
    { id: 'cop-' + Math.floor(now * 1000), health: GAME.copHealth, speed: 5.2 });
  cops.push(cop);
  return cop;
}
export function updateFootCop(cop, player, dt, now) {
  if (!cop.alive) return 0;
  const dx = player.x - cop.x, dz = player.z - cop.z;
  const d = Math.hypot(dx, dz);
  if (d > 26) { // chase
    cop.heading = Math.atan2(dx, dz);
    cop.x += (dx / d) * cop.speed * dt;
    cop.z += (dz / d) * cop.speed * dt;
    return 0;
  }
  if (d < 8) { // too close: back off a little and keep shooting
    cop.x -= (dx / (d || 1)) * 2 * dt;
    cop.z -= (dz / (d || 1)) * 2 * dt;
  }
  // Shoot the player about every 1.1 s, 6 damage a hit.
  if (now - cop.shootAt >= 1.1) { cop.shootAt = now; return 6; }
  return 0;
}
// Busted: on foot, wanted 2+, a living cop within 4 units for 1 s.
export function bustedCheck(wanted, player, cops, dt, now) {
  if (player.inCar || wanted.stars < 2) { wanted.bustedProgress = 0; return false; }
  const near = cops.some((c) => c.alive && Math.hypot(c.x - player.x, c.z - player.z) < 4);
  if (near) {
    wanted.bustedProgress += dt;
    if (wanted.bustedProgress >= 1) { wanted.bustedProgress = 0; return true; }
  } else wanted.bustedProgress = 0;
  return false;
}
export function applyFine(player, wanted) {
  player.money = Math.max(0, player.money - GAME.fine);
  player.health = player.maxHealth;
  wanted.stars = 0;
  wanted.lastCrimeAt = -100;
}
export function respawnPoint(kind) {
  return kind === 'busted' ? { x: PLACES.police.x + 30, z: PLACES.police.z + 30 }
    : { x: PLACES.hospital.x + 30, z: PLACES.hospital.z + 30 };
}
