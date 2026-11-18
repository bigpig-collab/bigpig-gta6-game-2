// Save / load via localStorage, at the safehouse. Stores money, health,
// ammo, mission progress, player position and time.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const p = state.player;
    const data = {
      money: p.money, hp: p.hp, ammo: p.ammo,
      x: p.x, y: p.y,
      missionIdx: state.missionIdx,
      missionDone: state.missionDone || 0,
      kills: state.kills || 0,
      time: state.time,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

export function applySave(state, data) {
  const p = state.player;
  p.money = data.money ?? p.money;
  p.hp = data.hp ?? 100;
  p.ammo = data.ammo ?? p.ammo;
  p.x = data.x ?? p.x;
  p.y = data.y ?? p.y;
  state.missionDone = data.missionDone || 0;
  state.kills = data.kills || 0;
  state.time = data.time || 0;
}
