// Staged screenshot scenes (?shot=chase|street|drive|fight). Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a tiny autopilot, so the frame is what real play looks like
// and the same seed always gives the same frame.
import { STEP, PLACES } from './config.js';
import { dist, turnToward } from './random.js';
import { createWorld, resetWorld, stepWorld } from './world.js';
import { scriptedInput } from './input.js';
import { makeCar } from './vehicles.js';
import { spawnPoliceCar } from './police.js';
import { startMission } from './missions.js';
import { SCREEN_PLAY } from './render3d.js';

function driveToward(state, inp, tx, ty) {
  const p = state.player;
  const car = state.cars.find((c) => c.id === p.inCar);
  if (!car) return;
  const want = Math.atan2(ty - car.y, tx - car.x);
  const d = turnToward(car.angle, want, Math.PI);
  inp.up = true;
  inp.left = d < -0.08;
  inp.right = d > 0.08;
  inp.brake = Math.abs(d) > 1.2;
}

function walkToward(state, inp, tx, ty) {
  const p = state.player;
  const dx = tx - p.x; const dy = ty - p.y;
  inp.up = dy < -12;
  inp.down = dy > 12;
  inp.left = dx < -12;
  inp.right = dx > 12;
  inp.run = true;
}

function putPlayerInCar(state, car) {
  state.player.inCar = car.id;
  car.driver = 'player';
  car.traffic = false;
  state.player.x = car.x;
  state.player.y = car.y;
}

export function stageShot(name, state) {
  const seed = state.seed;
  resetWorld(state, seed);
  const inp = scriptedInput();
  const aim = { x: 0, y: 0 };

  if (name === 'chase') {
    // Cover: police chase in a car, 3 stars, cops behind, HUD + objective.
    const car = makeCar(state.rng, 'sports', 1300, 1000, 0);
    car.color = '#e74c3c';
    state.cars.push(car);
    putPlayerInCar(state, car);
    state.wanted = 3;
    state.mission = null;
    state.objective = { x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: 'Escape to the safehouse — lose 3★ heat' };
    state.dialogue = "Rosa: 'Three stars, kid — drive like the city owes you money.'";
    state.dialogueTimer = 99;
    for (let i = 0; i < 3; i += 1) {
      const cop = spawnPoliceCar(state, state.rng);
      cop.x = 1300 - 450 - i * 140;
      cop.y = 1000 + (i % 2 === 0 ? 20 : -20);
      cop.angle = 0;
      cop.speed = 250;
    }
    for (let i = 0; i < 210; i += 1) {
      driveToward(state, inp, 2900, 1000);
      stepWorld(state, STEP, inp, aim);
    }
    // Stage the frozen frame: the chase camera looks forward, so the
    // pursuing police must be ahead of the player to read in one frame.
    // Put three units ahead in a loose roadblock formation, facing the
    // player, and one more closing from the side.
    {
      const pc = state.cars.filter((c) => c.isPolice && !c.dead);
      const p = state.player;
      const fx = Math.cos(p.angle); const fy = Math.sin(p.angle);
      const lx = -fy; const ly = fx;
      const spots = [[280, 70], [330, -70], [200, 130], [420, 0]];
      pc.forEach((cop, i) => {
        const [f, l] = spots[i % spots.length];
        cop.x = p.x + fx * f + lx * l;
        cop.y = p.y + fy * f + ly * l;
        cop.angle = Math.atan2(p.y - cop.y, p.x - cop.x);
        cop.speed = 220;
      });
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'drive') {
    // Coastal cruise: the road one block from the beach (x=2600), so the
    // player stays centred while sand and sea show on the right.
    const car = makeCar(state.rng, 'sports', 2600, 600, Math.PI / 2);
    car.color = '#f39c12';
    state.cars.push(car);
    putPlayerInCar(state, car);
    state.mission = null;
    state.objective = { x: 2900, y: 1500, label: 'Cruise the beachfront' };
    state.dialogue = "Rosa: 'Solmar by the sea. Not bad for a getaway driver.'";
    state.dialogueTimer = 99;
    for (let i = 0; i < 220; i += 1) {
      driveToward(state, inp, 2600, 1500);
      stepWorld(state, STEP, inp, aim);
    }
    return { screen: SCREEN_PLAY };
  }

  if (name === 'fight') {
    // Port shootout: mission 5, rivals at the docks, player firing.
    startMission(state, 4);
    state.player.x = 2480; state.player.y = 1960;
    state.player.ammo = 120;
    for (let i = 0; i < 150; i += 1) {
      let best = null; let bd = Infinity;
      for (const cop of state.cops) {
        if (cop.hp <= 0) continue;
        const d = dist(cop.x, cop.y, state.player.x, state.player.y);
        if (d < bd) { bd = d; best = cop; }
      }
      if (best) {
        aim.x = best.x; aim.y = best.y;
        inp.shoot = bd < 520;
        inp.left = i % 120 < 60;
        inp.right = i % 120 >= 60;
      }
      stepWorld(state, STEP, inp, aim);
      inp.shoot = false; inp.left = false; inp.right = false;
    }
    const p = state.player;
    // Stage the frozen frame on open ground: the port road (x=2600) so no
    // warehouse roof blocks the camera, and north of the Port Docks sign
    // so the sign stays behind the camera. Player faces the nearest rival.
    p.x = 2600; p.y = 1900;
    let nearest = null; let nd = Infinity;
    for (const cop of state.cops) {
      if (cop.hp <= 0) continue;
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d < nd) { nd = d; nearest = cop; }
    }
    if (nearest) {
      nearest.x = 2600; nearest.y = 1720;
      nearest.angle = Math.atan2(p.y - nearest.y, p.x - nearest.x);
      p.angle = Math.atan2(nearest.y - p.y, nearest.x - p.x);
    }
    for (const car of state.cars) {
      if (!car.isPolice || car.dead) continue;
      if (dist(car.x, car.y, p.x, p.y) < 150) {
        car.x = p.x - 320; car.y = p.y + 40; car.angle = 0; car.speed = 0;
      }
    }
    return { screen: SCREEN_PLAY };
  }

  // Default: street — on foot downtown, mission 1, traffic + peds + marker.
  state.player.x = 1500; state.player.y = 1250;
  state.player.angle = -Math.PI / 2;
  for (let i = 0; i < 300; i += 1) {
    walkToward(state, inp, PLACES.bar.x, PLACES.bar.y);
    stepWorld(state, STEP, inp, aim);
  }
  return { screen: SCREEN_PLAY };
}
