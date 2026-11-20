// Wanted system and police AI. Stars rise with crime; police cars spawn and
// chase/ram, foot cops run the player down and shoot; when no unit can see
// the player the heat cools off one star at a time. Getting busted (caught
// on foot at 3+ stars) or wasted (0 HP) respawns the player with a fine.
import { CAR_MODELS, PLACES, WANTED_MAX } from './config.js';
import { clamp, dist, turnToward } from './random.js';
import { makeCar } from './vehicles.js';
import { hurtPlayer } from './player.js';
import { sfx } from './audio.js';

export function wantedLabel(w) {
  return '★'.repeat(w) + '☆'.repeat(WANTED_MAX - w);
}

// How many police cars the current heat supports.
export function policeTarget(wanted) {
  if (wanted <= 0) return 0;
  return Math.min(1 + wanted, 6);
}

export function spawnPoliceCar(state, rng) {
  const p = state.player;
  const a = rng() * Math.PI * 2;
  const x = clamp(p.x + Math.cos(a) * 620, 120, 3080);
  const y = clamp(p.y + Math.sin(a) * 620, 120, 2280);
  const car = makeCar(rng, 'police', x, y, Math.atan2(p.y - y, p.x - x));
  car.traffic = false;
  car.isPolice = true;
  car.cruise = 300;
  state.cars.push(car);
  return car;
}

export function spawnFootCop(state, rng) {
  const p = state.player;
  const a = rng() * Math.PI * 2;
  state.cops.push({
    x: clamp(p.x + Math.cos(a) * 420, 40, 3160),
    y: clamp(p.y + Math.sin(a) * 420, 40, 2360),
    angle: 0, hp: 60, speed: 0, isCop: true, isGang: false, flee: 0, shootCd: 1.2,
  });
}

function nearestCopDist(state) {
  const p = state.player;
  let best = Infinity;
  for (const car of state.cars) {
    if (car.isPolice && !car.dead) best = Math.min(best, dist(car.x, car.y, p.x, p.y));
  }
  for (const cop of state.cops) {
    if (cop.hp > 0) best = Math.min(best, dist(cop.x, cop.y, p.x, p.y));
  }
  return best;
}

export function stepPolice(state, dt, rng) {
  const p = state.player;
  const want = policeTarget(state.wanted);
  const active = state.cars.filter((c) => c.isPolice && !c.dead).length;
  if (active < want && state.spawnCd <= 0) {
    spawnPoliceCar(state, rng);
    state.spawnCd = 1.6;
  }
  if (state.wanted >= 2 && !p.inCar && state.cops.filter((c) => c.hp > 0 && c.isCop).length < 2 && state.spawnCd <= 0 && rng() < dt * 0.4) {
    spawnFootCop(state, rng);
    state.spawnCd = 2.5;
  }
  // Pursuit cars: steer at the player, ram at speed, wobble a little.
  for (const car of state.cars) {
    if (!car.isPolice || car.dead) continue;
    const spec = CAR_MODELS.police;
    const targetAngle = Math.atan2(p.y - car.y, p.x - car.x);
    car.angle += turnToward(car.angle, targetAngle, spec.turn * 0.9 * dt);
    const d = dist(car.x, car.y, p.x, p.y);
    const wantSpeed = d > 90 ? spec.top : spec.top * 0.55;
    car.speed += clamp(wantSpeed - car.speed, -320 * dt, 300 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 40, 3160);
    car.y = clamp(car.y, 40, 2360);
    if (d < 56) {
      const pcar = state.cars.find((c) => c.id === p.inCar);
      if (pcar) {
        pcar.hp -= 10 * dt;
        if (pcar.hp <= 0) {
          pcar.hp = 0;
          pcar.dead = true;
          p.inCar = null;
          p.x = pcar.x + 46;
          p.y = pcar.y + 46;
        }
      } else if (p.hp > 0) {
        hurtPlayer(state, 26 * dt);
      }
      car.speed *= 0.5;
    }
  }
  // Foot cops: run at the player, shoot when in range, catch = busted.
  for (const cop of state.cops) {
    if (cop.hp <= 0) continue;
    const d = dist(cop.x, cop.y, p.x, p.y);
    const a = Math.atan2(p.y - cop.y, p.x - cop.x);
    cop.angle = a;
    if (d > 34) {
      const sp = 215;
      cop.x += Math.cos(a) * sp * dt;
      cop.y += Math.sin(a) * sp * dt;
      cop.speed = sp;
    } else {
      cop.speed = 0;
      if (cop.isCop && state.wanted >= 3 && !p.inCar && p.hp > 0) {
        state.over = 'busted';
        state.overTimer = 0;
        sfx.busted();
      }
    }
    cop.shootCd -= dt;
    if (d < 420 && d > 60 && cop.shootCd <= 0) {
      cop.shootCd = 1.1;
      state.bullets.push({
        x: cop.x, y: cop.y,
        vx: Math.cos(a) * 700, vy: Math.sin(a) * 700,
        life: 0.8, fromPlayer: false,
      });
    }
  }
  // Heat decay: no police nearby for 9 seconds drops one star.
  const near = nearestCopDist(state);
  if (state.wanted > 0) {
    if (near > 520) {
      state.wantedTimer += dt;
      if (state.wantedTimer > 9) {
        state.wanted -= 1;
        state.wantedTimer = 0;
        state.message = state.wanted === 0 ? 'You lost them. Heat is off.' : 'Heat dropping…';
        state.messageTimer = 2;
      }
    } else {
      state.wantedTimer = 0;
    }
  }
  state.cars = state.cars.filter((c) => !(c.isPolice && c.dead && dist(c.x, c.y, p.x, p.y) > 900));
  state.cops = state.cops.filter((c) => !(c.hp <= 0 && dist(c.x, c.y, p.x, p.y) > 900));
}

// Busted / wasted: wake at the station (busted) or hospital (wasted), minus
// a fine of up to $150, heat cleared, police stood down.
export function applyRespawn(state) {
  const p = state.player;
  const spot = state.over === 'busted' ? PLACES.station : PLACES.hospital;
  p.x = spot.x;
  p.y = spot.y;
  p.hp = 100;
  p.inCar = null;
  const fine = Math.min(p.money, 150);
  p.money -= fine;
  state.wanted = 0;
  state.wantedTimer = 0;
  state.cars = state.cars.filter((c) => !c.isPolice);
  state.cops = [];
  state.message = state.over === 'busted'
    ? `Busted! Released at the station. Fine $${fine}.`
    : `Wasted! Woke up at the hospital. Bill $${fine}.`;
  state.messageTimer = 4;
  state.over = null;
}
