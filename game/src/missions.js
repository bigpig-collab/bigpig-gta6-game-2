// The six-mission story chain from fixer Mama Rosa. Each mission has a
// briefing (shown as dialogue), an objective that moves the minimap blip,
// and a cash reward. Free roam between missions.
import { PLACES } from './config.js';
import { dist } from './random.js';
import { makeCar } from './vehicles.js';
import { sfx } from './audio.js';
import { addWanted } from './player.js';

export const MISSIONS = [
  {
    title: '1 — Back in Town',
    briefing: "Mama Rosa: 'Solmar missed you, kid. Come to my bar downtown — we got work.'",
    type: 'goto', target: PLACES.bar, reward: 150,
    objective: "Drive to Rosa's Bar",
  },
  {
    title: '2 — Borrowed Wheels',
    briefing: "Rosa: 'A client wants a sports car. Borrow one — permanently — and bring it to the bar.'",
    type: 'steal', model: 'sports', target: PLACES.bar, reward: 300,
    objective: 'Steal a sports car, deliver it to the bar',
  },
  {
    title: '3 — The Pickup',
    briefing: "Rosa: 'Package waiting at the drop by the park. Grab it — and expect company.'",
    type: 'pickup', target: PLACES.package, reward: 400,
    objective: 'Collect the package, then lose the heat',
  },
  {
    title: '4 — Heat Wave',
    briefing: "Rosa: 'Three stars on you, kid. Vanish. No cops on your tail, then call me.'",
    type: 'escape', target: null, reward: 500,
    objective: 'Lose the 3-star wanted level',
  },
  {
    title: '5 — Dockside Deal',
    briefing: "Rosa: 'The dock deal is going sideways. Get to the port and hold the line.'",
    type: 'shootout', target: PLACES.port, reward: 600,
    objective: 'Defend the deal at the port — drop 5 rivals',
  },
  {
    title: '6 — The Big Score',
    briefing: "Rosa: 'One last job. The heist car is downtown. Take it, outrun everything, bring it home.'",
    type: 'deliver', target: PLACES.safehouse, reward: 1000,
    objective: 'Steal the heist car, escape 4-star heat, reach the safehouse',
  },
];

export function missionCount() { return MISSIONS.length; }

export function startMission(state, idx) {
  const m = MISSIONS[idx];
  state.missionIdx = idx;
  state.mission = {
    ...m, stage: 'go', kills: 0, targetCarId: null, done: false,
    banner: 0,
  };
  state.dialogue = m.briefing;
  state.dialogueTimer = 5;
  state.objective = m.target ? { x: m.target.x, y: m.target.y, label: m.objective } : { x: 0, y: 0, label: m.objective };
  if (m.type === 'steal' || m.type === 'deliver') {
    const spot = m.type === 'deliver' ? PLACES.heistCar : { x: state.player.x + 260, y: state.player.y + 120 };
    const car = makeCar(state.rng, 'sports', spot.x, spot.y, 0);
    car.traffic = false;
    car.marked = true;
    state.cars.push(car);
    state.mission.targetCarId = car.id;
    state.objective = { x: car.x, y: car.y, label: m.type === 'deliver' ? 'Steal the heist car' : 'Steal the marked sports car' };
  }
  if (m.type === 'escape') {
    state.wanted = 3;
    state.wantedTimer = 0;
  }
  if (m.type === 'shootout') {
    for (let i = 0; i < 5; i += 1) {
      state.cops.push({
        x: PLACES.port.x + (i - 2) * 90, y: PLACES.port.y - 120 + (i % 2) * 160,
        angle: 0, hp: 50, speed: 0, isCop: false, isGang: true, flee: 0, shootCd: 1 + i * 0.3,
      });
    }
  }
  if (m.type === 'deliver') state.wantedAtSteal = 4;
}

function completeMission(state) {
  const m = state.mission;
  state.player.money += m.reward;
  state.missionDone = (state.missionDone || 0) + 1;
  sfx.cash();
  sfx.mission();
  state.banner = `MISSION COMPLETE — ${m.title}  +$${m.reward}`;
  state.bannerTimer = 3.5;
  state.dialogue = `Rosa: 'Clean work. $${m.reward} is yours.'`;
  state.dialogueTimer = 4;
  const next = state.missionIdx + 1;
  if (next < MISSIONS.length) {
    state.pendingNext = next;
    state.pendingTimer = 3.5;
  } else {
    state.storyDone = true;
    state.dialogue = "Rosa: 'That was the big score, kid. Solmar is yours now. Free roam — the city never sleeps.'";
    state.dialogueTimer = 6;
    state.objective = { x: PLACES.safehouse.x, y: PLACES.safehouse.y, label: 'Free roam — visit the safehouse to save' };
  }
  state.mission = null;
}

export function updateMission(state, dt) {
  if (state.pendingNext !== null && state.pendingNext !== undefined) {
    state.pendingTimer -= dt;
    if (state.pendingTimer <= 0) {
      const n = state.pendingNext;
      state.pendingNext = null;
      startMission(state, n);
    }
    return;
  }
  const m = state.mission;
  if (!m) return;
  const p = state.player;
  if (m.type === 'goto') {
    if (dist(p.x, p.y, m.target.x, m.target.y) < 90) completeMission(state);
  } else if (m.type === 'steal') {
    if (m.stage === 'go') {
      const car = state.cars.find((c) => c.id === m.targetCarId);
      if (car) state.objective = { x: car.x, y: car.y, label: 'Steal the marked sports car' };
      if (p.inCar === m.targetCarId) {
        m.stage = 'deliver';
        state.objective = { x: m.target.x, y: m.target.y, label: 'Deliver the car to the bar' };
        state.message = 'Deliver it to Rosa\'s Bar.';
        state.messageTimer = 2.5;
      }
    } else if (dist(p.x, p.y, m.target.x, m.target.y) < 90 && p.inCar === m.targetCarId) {
      completeMission(state);
    }
  } else if (m.type === 'pickup') {
    if (m.stage === 'go') {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 70) {
        m.stage = 'escape';
        addWanted(state, 2);
        sfx.pickup();
        state.objective = { x: p.x, y: p.y, label: 'Lose the wanted level' };
        state.message = 'Package grabbed! Lose the cops.';
        state.messageTimer = 2.5;
      }
    } else if (state.wanted === 0) completeMission(state);
  } else if (m.type === 'escape') {
    if (state.wanted === 0) completeMission(state);
  } else if (m.type === 'shootout') {
    if (m.stage === 'go') {
      if (dist(p.x, p.y, m.target.x, m.target.y) < 260) m.stage = 'fight';
      state.objective = { x: m.target.x, y: m.target.y, label: 'Reach the port docks' };
    } else {
      state.objective = { x: m.target.x, y: m.target.y, label: `Drop the rivals — ${m.kills}/5` };
      if (m.kills >= 5) completeMission(state);
    }
  } else if (m.type === 'deliver') {
    if (m.stage === 'go') {
      const car = state.cars.find((c) => c.id === m.targetCarId);
      if (car) state.objective = { x: car.x, y: car.y, label: 'Steal the heist car' };
      if (p.inCar === m.targetCarId) {
        m.stage = 'run';
        state.wanted = 4;
        state.wantedTimer = 0;
        state.objective = { x: m.target.x, y: m.target.y, label: 'Escape to the safehouse' };
        state.message = '4 stars! Get to the safehouse!';
        state.messageTimer = 3;
      }
    } else if (dist(p.x, p.y, m.target.x, m.target.y) < 100 && p.inCar === m.targetCarId) {
      completeMission(state);
    }
  }
}
