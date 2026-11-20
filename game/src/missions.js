// The Mama Rosa job chain: six missions, their objectives and the money
// trail 120 -> 270 -> 570 -> 970 -> 1470 -> 2070 -> 3070. Pure state
// machine, driven by events from the game loop; Node sims run it directly.
import { MISSIONS, MISSION_REWARDS, GAME, PLACES } from './config.js';

export function makeMissionState() {
  return {
    index: 0, // 0..5 current job, 6 when the story is done
    stage: 'go', // per-mission stage
    collected: false, kills: 0, peakStars: 0,
    banner: null, bannerAt: 0, dialogue: null,
    completedAt: -1,
  };
}
export function currentMission(state) {
  return state.index < MISSIONS.length ? MISSIONS[state.index] : null;
}
export function objectiveText(state) {
  const m = currentMission(state);
  if (!m) return 'Story complete — Solmar is yours. Free roam.';
  if (m.kind === 'collect' && state.stage === 'escape') return 'Lose all heat (0 stars)';
  if (m.kind === 'kill') return `Drop rivals at the Port Docks (${state.kills}/${m.count})`;
  if (m.kind === 'heist' && state.stage === 'drive') return 'Take the heist car to the safehouse at 4-star heat';
  return m.objective;
}
export function startMission(state, now) {
  const m = currentMission(state);
  if (!m) return null;
  state.stage = 'go';
  state.collected = false;
  state.kills = 0;
  state.peakStars = 0;
  state.dialogue = m.brief;
  state.banner = m.title;
  state.bannerAt = now;
  return m;
}
export function completeMission(state, player, now) {
  const m = currentMission(state);
  if (!m) return null;
  player.money += m.reward;
  state.index += 1;
  state.stage = 'go';
  state.banner = `Job done! +$${m.reward}`;
  state.bannerAt = now;
  state.dialogue = m.done;
  state.completedAt = now;
  const next = currentMission(state);
  if (next) state.dialogue = m.done;
  return { reward: m.reward, money: player.money, next: next ? next.title : null };
}
// Feed one game event; returns 'complete' when the current job finishes.
// events: {player, wanted, car, now, at:{x,z}, killedRival, pickedPackage}
export function missionEvent(state, ev) {
  const m = currentMission(state);
  if (!m) return null;
  const target = PLACES[m.target];
  const d = Math.hypot(ev.at.x - target.x, ev.at.z - target.z);
  if (ev.wanted && ev.wanted.stars > state.peakStars) state.peakStars = ev.wanted.stars;
  switch (m.kind) {
    case 'reach':
      if (d < 55) return 'complete';
      break;
    case 'deliver':
      if (ev.car && ev.car.type === m.car && d < 60) return 'complete';
      break;
    case 'collect':
      if (state.stage === 'go') {
        if (d < 45) { state.stage = 'escape'; state.collected = true; }
      } else if (state.stage === 'escape') {
        if (ev.wanted && ev.wanted.stars === 0) return 'complete';
      }
      break;
    case 'loseheat':
      if (state.peakStars >= m.stars && ev.wanted && ev.wanted.stars === 0) return 'complete';
      break;
    case 'kill':
      if (ev.killedRival) state.kills += 1;
      if (state.kills >= m.count) return 'complete';
      break;
    case 'heist': {
      const heistD = Math.hypot(ev.at.x - PLACES.heist.x, ev.at.z - PLACES.heist.z);
      if (state.stage === 'go') {
        if (heistD < 45) state.stage = 'drive';
      } else if (state.stage === 'drive') {
        if (ev.car && ev.car.mission && d < 60 && ev.wanted && ev.wanted.stars >= m.stars) return 'complete';
      }
      break;
    }
  }
  return null;
}
export function missionTargetPos(state) {
  const m = currentMission(state);
  if (!m) return { x: PLACES.safehouse.x, z: PLACES.safehouse.z };
  if (m.kind === 'heist' && state.stage === 'go') return { x: PLACES.heist.x, z: PLACES.heist.z };
  return { x: PLACES[m.target].x, z: PLACES[m.target].z };
}
export function moneyTrail() {
  let money = GAME.startMoney;
  const trail = [money];
  for (const r of MISSION_REWARDS) { money += r; trail.push(money); }
  return trail; // [120, 270, 570, 970, 1470, 2070, 3070]
}
