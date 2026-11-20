// Node sims for Solmar City. Drives the pure game modules (missions,
// wanted/police, traffic, combat, save) through all six jobs end to end
// with the exact money trail, plus the subsystem checks. Node 22 stdlib.
import { WORLD, PLACES, GAME, START } from '../game/src/config.js';
import { makeRng } from '../game/src/random.js';
import { listBlocks, blockBuildings, collideCircleAABB } from '../game/src/world.js';
import { makeCar, updateCar, steerToward, damageCar, circleHitsCar } from '../game/src/vehicles.js';
import { makePlayer, updatePlayer, hurtPlayer } from '../game/src/player.js';
import { makePerson, punch, shoot } from '../game/src/combat.js';
import { spawnTraffic, spawnParked, spawnPeds, updateTraffic, updatePeds } from '../game/src/traffic.js';
import { makeWanted, addCrime, updateWanted, policeCarTarget, spawnPoliceCar, updatePoliceCar, ramDamage, maybeSpawnFootCop, updateFootCop, bustedCheck, applyFine, respawnPoint } from '../game/src/police.js';
import { makeMissionState, currentMission, startMission, completeMission, missionEvent, moneyTrail } from '../game/src/missions.js';
import { writeSave, readSave, applySave } from '../game/src/save.js';
import { nearestRoadCoord } from '../game/src/world.js';

const SEED = '1';
const rng = makeRng(SEED + '-city');
const colliders = [];
for (const b of listBlocks()) colliders.push(...blockBuildings(b, rng));
let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass += 1; console.log('PASS ' + name); }
  else { fail += 1; console.log('FAIL ' + name + ' ' + extra); }
}
function near(a, b, tol) { return Math.hypot(a.x - b.x, a.z - b.z) <= tol; }

// Manhattan route along road centrelines: along the current z-road to the
// target's x-road, then along that x-road to the target's z-road, then in.
function route(from, to) {
  const tx = nearestRoadCoord(to.x, WORLD.roadsX).road;
  const tz = nearestRoadCoord(to.z, WORLD.roadsZ).road;
  const fz = nearestRoadCoord(from.z, WORLD.roadsZ).road;
  return [{ x: tx, z: fz }, { x: tx, z: tz }, { x: to.x, z: to.z }];
}
function driveCarTo(car, to, now, maxSteps = 4000, onTick = null) {
  const wps = route(car, to);
  let wi = 0, steps = 0;
  while (wi < wps.length && steps < maxSteps) {
    const wp = wps[wi];
    const d = Math.hypot(wp.x - car.x, wp.z - car.z);
    if (d < 40) { wi += 1; continue; } // edge roads sit past the clamp; 40 still keeps the car on the road
    const target = d < 220 ? 90 : 260;
    steerToward(car, wp.x, wp.z, 0.1, target);
    for (const b of colliders) {
      const r = collideCircleAABB(car.x, car.z, car.radius * 0.62, b);
      car.x = r.x; car.z = r.z;
    }
    if (onTick) onTick(now);
    now += 0.1; steps += 1;
  }
  return { now, arrived: wi >= wps.length, steps };
}
function walkTo(p, to, now, maxSteps = 6000) {
  const wps = route(p, to);
  let wi = 0, steps = 0;
  while (wi < wps.length && steps < maxSteps) {
    const wp = wps[wi];
    const d = Math.hypot(wp.x - p.x, wp.z - p.z);
    if (d < 30) { wi += 1; continue; } // edge roads sit past the clamp; 30 still keeps the player on the road
    const yaw = Math.atan2(wp.x - p.x, wp.z - p.z);
    updatePlayer(p, { fwd: 1, strafe: 0, run: 1, camYaw: yaw }, 0.1, colliders, now);
    now += 0.1; steps += 1;
  }
  return { now, arrived: wi >= wps.length, steps };
}
function waitFor(pred, step, now, maxSteps = 2000) {
  let steps = 0;
  while (!pred() && steps < maxSteps) { step(now); now += 0.1; steps += 1; }
  return { now, ok: pred(), steps };
}

// ---- world state shared by the mission run ---------------------------
let now = 0;
const player = makePlayer(START.x, START.z, START.heading);
const wanted = makeWanted();
const missions = makeMissionState();
const traffic = spawnTraffic(rng, GAME.trafficCount);
const parked = spawnParked(rng, GAME.parkedCount);
const peds = spawnPeds(rng, GAME.pedCount);
const cops = [];
const rivals = [];
function feed(evExtra = {}) {
  return missionEvent(missions, {
    player, wanted, car: player.inCar, now, at: player, ...evExtra,
  });
}
function stepWorld(dt = 0.1) {
  updateTraffic(traffic, dt, rng, player);
  updatePeds(peds, dt, rng, player.inCar || player);
  updateWanted(wanted, now, dt);
  now += dt;
}
check('money trail is 120/270/570/970/1470/2070/3070',
  JSON.stringify(moneyTrail()) === JSON.stringify([120, 270, 570, 970, 1470, 2070, 3070]));

// ---- Mission 1: walk to the bar --------------------------------------
startMission(missions, now);
let r = walkTo(player, PLACES.bar, now);
now = r.now;
check('M1 walk to bar arrives', r.arrived, 'steps=' + r.steps);
check('M1 completes at bar', feed() === 'complete');
completeMission(missions, player, now);
check('M1 money is 270', player.money === 270, 'money=' + player.money);
startMission(missions, now);

// ---- Mission 2: steal a sports car, drive it to the bar ---------------
const sports = makeCar('sports', player.x + 8, player.z + 8, Math.PI / 2, { parked: true, id: 'sim-sports' });
player.inCar = sports;
addCrime(wanted, 1, now); // stealing in view of a witness, as the game does
const moneyBeforeDrive = player.money;
r = driveCarTo(sports, PLACES.bar, now);
now = r.now;
player.x = sports.x; player.z = sports.z;
check('M2 drive to bar arrives', r.arrived, 'steps=' + r.steps);
check('M2 no fine mid-drive', player.money === moneyBeforeDrive, 'money=' + player.money);
check('M2 completes with sports car at bar', feed() === 'complete');
completeMission(missions, player, now);
check('M2 money is 570', player.money === 570, 'money=' + player.money);
player.inCar = null;
startMission(missions, now);

// ---- Mission 3: collect the package, then lose all heat ---------------
r = walkTo(player, PLACES.drop, now);
now = r.now;
check('M3 walk to drop arrives', r.arrived);
check('M3 package collected (stage escape)', feed() === null && missions.stage === 'escape', 'stage=' + missions.stage);
const w3 = waitFor(() => wanted.stars === 0, () => stepWorld(0.1), now, 1500);
now = w3.now;
check('M3 heat decays to zero', w3.ok, 'stars=' + wanted.stars);
check('M3 completes with 0 stars', feed() === 'complete');
completeMission(missions, player, now);
check('M3 money is 970', player.money === 970, 'money=' + player.money);
startMission(missions, now);

// ---- Mission 4: lose a 3-star wanted level ---------------------------
for (let i = 0; i < 3; i++) {
  const ped = makePerson('ped', player.x + Math.sin(player.heading) * 2.5, player.z + Math.cos(player.heading) * 2.5, { id: 'sim-ped-' + i });
  peds.push(ped);
  const res = shoot(player, player.heading, [ped], now);
  if (res.hit) addCrime(wanted, 1, now);
  const res2 = shoot(player, player.heading, [ped], now);
  if (res2.hit && !res2.hit.alive) addCrime(wanted, 0, now);
  feed();
}
check('M4 three ped kills raise 3 stars', wanted.stars === 3, 'stars=' + wanted.stars);
const w4 = waitFor(() => wanted.stars === 0, () => { stepWorld(0.1); feed(); }, now, 2000);
now = w4.now;
check('M4 heat decays to zero', w4.ok, 'stars=' + wanted.stars);
check('M4 completes after losing 3 stars', feed() === 'complete');
completeMission(missions, player, now);
check('M4 money is 1470', player.money === 1470, 'money=' + player.money);
startMission(missions, now);

// ---- Mission 5: drop 5 rivals at the port ----------------------------
r = walkTo(player, PLACES.port, now);
now = r.now;
check('M5 walk to port arrives', r.arrived);
for (let i = 0; i < 5; i++) {
  const rival = makePerson('rival', player.x + Math.sin(player.heading) * 2.5, player.z + Math.cos(player.heading) * 2.5, { id: 'sim-rival-' + i, health: GAME.rivalHealth });
  rivals.push(rival);
  shoot(player, player.heading, [rival], now);
  const res = shoot(player, player.heading, [rival], now);
  if (res.hit && !res.hit.alive) {
    const ev = feed({ killedRival: true });
    if (i === 4) check('M5 completes after 5th rival', ev === 'complete');
  }
}
check('M5 kills counted', missions.kills === 5, 'kills=' + missions.kills);
completeMission(missions, player, now);
check('M5 money is 2070', player.money === 2070, 'money=' + player.money);
startMission(missions, now);

// ---- Mission 6: heist car to the safehouse at 4-star heat -------------
r = walkTo(player, PLACES.heist, now);
now = r.now;
check('M6 walk to heist car arrives', r.arrived);
// Build 4 stars on foot first (each pistol hit on a ped is +1 heat, as
// the game scores it), then enter the heist car and drive home fast:
// the first decay tick lands 20 s after the last crime, the drive is ~15 s.
for (let i = 0; i < 2; i++) {
  const ped = makePerson('ped', player.x + Math.sin(player.heading) * 2.5, player.z + Math.cos(player.heading) * 2.5, { id: 'sim-m6-ped-' + i });
  peds.push(ped);
  for (let s = 0; s < 2; s++) {
    const res = shoot(player, player.heading, [ped], now);
    if (res.hit) addCrime(wanted, 1, now);
    feed();
  }
}
check('M6 four ped hits raise 4 stars', wanted.stars === 4, 'stars=' + wanted.stars);
const heist = makeCar('sports', PLACES.heist.x, PLACES.heist.z, Math.PI / 2, { mission: true, id: 'sim-heist' });
player.inCar = heist;
feed();
check('M6 heist stage is drive', missions.stage === 'drive', 'stage=' + missions.stage);
const t0 = now;
r = driveCarTo(heist, PLACES.safehouse, now, 4000, (t) => updateWanted(wanted, t, 0.1));
now = r.now;
player.x = heist.x; player.z = heist.z;
check('M6 drive to safehouse arrives', r.arrived, 'steps=' + r.steps);
check('M6 drive is fast enough to keep 4 stars', now - t0 < 20, 'drive=' + (now - t0).toFixed(1) + 's');
check('M6 still 4 stars on arrival', wanted.stars >= 4, 'stars=' + wanted.stars);
check('M6 completes at safehouse at 4 stars', feed() === 'complete');
completeMission(missions, player, now);
check('M6 money is 3070', player.money === 3070, 'money=' + player.money);
check('M6 story done', missions.index === 6 && currentMission(missions) === null);

// ---- Wanted / police subsystem ----------------------------------------
const w2 = makeWanted();
addCrime(w2, 3, 0);
check('police target at 3 stars is 3', policeCarTarget(3) === 3);
check('police target at 0 stars is 0', policeCarTarget(0) === 0);
check('police target at 5 stars is 5', policeCarTarget(5) === 5);
const pc = spawnPoliceCar(rng, player.x + 150, player.z, 'sim-police');
const d0 = Math.hypot(pc.x - player.x, pc.z - player.z);
for (let i = 0; i < 50; i++) updatePoliceCar(pc, player, 0.1, i * 0.1);
const d1 = Math.hypot(pc.x - player.x, pc.z - player.z);
check('police car chases the player', d1 < d0, 'd0=' + d0.toFixed(0) + ' d1=' + d1.toFixed(0));
// Ram damage: police touching the player car deals 10 HP/s (5 per 0.5 s).
const victim = makeCar('sedan', pc.x, pc.z, 0, { id: 'sim-victim' });
const hp0 = victim.hp;
ramDamage(pc, victim, 1);
ramDamage(pc, victim, 1.6);
check('ram contact damages the car', victim.hp < hp0, 'hp=' + victim.hp);
// Foot cops: on foot only, 2.5 s cooldown, at most 2 at once.
const w3s = makeWanted();
addCrime(w3s, 1, 0);
const footPlayer = makePlayer(0, 0, 0);
const footCops = [];
let spawned = 0;
for (let t = 0; t < 12; t += 0.5) {
  const c = maybeSpawnFootCop(w3s, rng, footPlayer, footCops, t);
  if (c) spawned += 1;
}
check('foot cops cap at 2', spawned === 2 && footCops.length === 2, 'spawned=' + spawned);
const inCarPlayer = makePlayer(0, 0, 0);
inCarPlayer.inCar = makeCar('sedan', 0, 0, 0, { id: 'sim-incar' });
check('no foot cop spawns while in a car', maybeSpawnFootCop(w3s, rng, inCarPlayer, footCops, 20) === null);
// Wanted decay: 3 stars -> 0 after grace + 3 decay ticks.
const w4s = makeWanted();
addCrime(w4s, 3, 0);
let t = 0;
while (w4s.stars > 0 && t < 120) { updateWanted(w4s, t, 0.1); t += 0.1; }
check('wanted decays 3 -> 0', w4s.stars === 0, 't=' + t.toFixed(1));

// ---- Traffic -----------------------------------------------------------
const tCars = spawnTraffic(rng, GAME.trafficCount);
const before = tCars.map((c) => ({ x: c.x, z: c.z }));
for (let i = 0; i < 50; i++) updateTraffic(tCars, 0.1, rng, player);
const moved = tCars.filter((c, i) => Math.hypot(c.x - before[i].x, c.z - before[i].z) > 5).length;
check('traffic cars move', moved >= 10, 'moved=' + moved + '/' + tCars.length);

// ---- Combat ------------------------------------------------------------
const pedA = makePerson('ped', 2, 0, { id: 'sim-punch' });
const puncher = makePlayer(0, 0, Math.PI / 2);
const hit = punch(puncher, [pedA], 0);
check('punch hits and deals 40 (68 -> 28)', hit === pedA && pedA.health === 28, 'health=' + pedA.health);
const copA = makePerson('cop', 2, 0, { id: 'sim-cop', health: GAME.copHealth });
const shooter = makePlayer(0, 0, Math.PI / 2);
shoot(shooter, Math.PI / 2, [copA], 0);
check('pistol first shot drops cop to 34', copA.health === 34, 'health=' + copA.health);
const r2 = shoot(shooter, Math.PI / 2, [copA], 0.3);
check('pistol second shot drops the cop', r2.hit === copA && !copA.alive);

// ---- Busted / wasted respawn -------------------------------------------
const w5 = makeWanted();
addCrime(w5, 2, 0);
const bustedPlayer = makePlayer(0, 0, 0);
const nearCop = makePerson('cop', 2, 0, { id: 'sim-busted-cop' });
let busted = false;
for (let i = 0; i < 20; i++) { if (bustedCheck(w5, bustedPlayer, [nearCop], 0.1, i * 0.1)) { busted = true; break; } }
check('busted triggers on foot at 2+ stars with a cop near', busted);
const finePlayer = makePlayer(0, 0, 0);
finePlayer.money = 1000;
const w6 = makeWanted();
addCrime(w6, 4, 0);
applyFine(finePlayer, w6);
check('fine is $150 and wanted resets', finePlayer.money === 850 && w6.stars === 0 && finePlayer.health === 100,
  'money=' + finePlayer.money + ' stars=' + w6.stars);
check('busted respawn is the police station', respawnPoint('busted').x === PLACES.police.x + 30);
check('wasted respawn is the hospital', respawnPoint('wasted').x === PLACES.hospital.x + 30);

// ---- Save / load -------------------------------------------------------
const store = { data: {}, getItem(k) { return this.data[k] ?? null; }, setItem(k, v) { this.data[k] = v; }, removeItem(k) { delete this.data[k]; } };
const savePlayer = makePlayer(100, 200, 0);
savePlayer.money = 2070;
const saveMissions = makeMissionState();
saveMissions.index = 5;
const saveWanted = makeWanted();
writeSave(store, savePlayer, saveMissions, saveWanted);
const loaded = readSave(store);
check('save round-trips', loaded !== null && loaded.money === 2070 && loaded.missionIndex === 5);
const freshPlayer = makePlayer(0, 0, 0);
const freshMissions = makeMissionState();
const freshWanted = makeWanted();
applySave(freshPlayer, freshMissions, freshWanted, loaded);
check('load restores money, mission and position',
  freshPlayer.money === 2070 && freshMissions.index === 5 && freshPlayer.x === 100 && freshPlayer.z === 200);

// ---- Car edge damage throttle ------------------------------------------
const edgeCar = makeCar('sedan', 0, 0, 0, { id: 'sim-edge' });
damageCar(edgeCar, 5, 0);
damageCar(edgeCar, 5, 0.1);
damageCar(edgeCar, 5, 0.2);
check('edge damage throttles (3 hits in 0.2 s deal 5, not 15)', edgeCar.hp === 95, 'hp=' + edgeCar.hp);
damageCar(edgeCar, 5, 0.5);
check('edge damage ticks again after 0.4 s', edgeCar.hp === 90, 'hp=' + edgeCar.hp);

console.log(`\nSIMS: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
