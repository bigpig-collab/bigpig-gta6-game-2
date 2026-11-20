// Save and load at the safehouse. The storage object is injected so Node
// sims can pass a plain object instead of localStorage.
import { GAME } from './config.js';

export function makeSave(player, missions, wanted) {
  return {
    version: 1,
    money: player.money,
    health: player.health,
    ammo: player.ammo,
    missionIndex: missions.index,
    x: Math.round(player.x), z: Math.round(player.z),
    stars: wanted.stars,
    savedAt: Date.now(),
  };
}
export function writeSave(storage, player, missions, wanted) {
  const data = makeSave(player, missions, wanted);
  storage.setItem(GAME.saveKey, JSON.stringify(data));
  return data;
}
export function readSave(storage) {
  try {
    const raw = storage.getItem(GAME.saveKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}
export function saveExists(storage) {
  try { return storage.getItem(GAME.saveKey) !== null; } catch { return false; }
}
export function applySave(player, missions, wanted, data) {
  player.money = data.money;
  player.health = data.health;
  player.ammo = data.ammo;
  player.x = data.x; player.z = data.z;
  missions.index = data.missionIndex;
  missions.stage = 'go';
  missions.kills = 0; missions.collected = false; missions.peakStars = 0;
  wanted.stars = 0;
}
export function clearSave(storage) { storage.removeItem(GAME.saveKey); }
