// Staged screenshot setups for Solmar City. Each applies a frozen game
// state (position, wanted level, mission, banner) that the page then
// renders at 1280x800 with the HUD visible.
import { PLACES } from './config.js';
import { makeCar } from './vehicles.js';

export const SHOTS = ['chase', 'street', 'drive', 'fight'];
export function applyShot(G, name) {
  const S = G.state;
  if (name === 'chase') {
    // Cover: 3-star police chase, police ahead of the player's sports car.
    // The car starts far west of the bar so the job cannot complete itself
    // while the shot is being framed.
    S.screen = 'playing';
    S.player.inCar = null;
    const car = makeCar('sports', -800, -400, Math.PI / 2, { id: 'shot-car' });
    car.speed = 210; car.playerOwned = true;
    S.player.inCar = car; S.player.x = car.x; S.player.z = car.z;
    S.player.money = 270;
    S.wanted.stars = 3; S.wanted.lastCrimeAt = S.now;
    S.missions.index = 1; S.missions.stage = 'go';
    S.missions.dialogue = 'Mama Rosa: "I need a fast car. Borrow a sports car and bring it to the bar."';
    S.missions.banner = 'Borrowed Wheels';
    S.missions.bannerAt = S.now;
    S.policeCars.length = 0;
    for (let i = 0; i < 3; i++) {
      const pc = makeCar('police', -800 + 95 + i * 32, -400, Math.PI / 2, { id: 'shot-police-' + i });
      pc.speed = 120;
      S.policeCars.push(pc);
    }
    G.camYaw = Math.PI / 2;
    return true;
  }
  if (name === 'street') {
    // Mission complete at Rosa's Bar, reward banner visible.
    S.screen = 'playing';
    S.player.x = PLACES.bar.x - 20; S.player.z = PLACES.bar.z + 30;
    S.player.heading = Math.PI / 2; S.player.inCar = null;
    S.player.money = 270;
    S.missions.index = 1; S.missions.stage = 'go';
    S.missions.banner = 'Job done! +$150';
    S.missions.bannerAt = S.now;
    S.missions.dialogue = 'Mama Rosa: "Good to see you. The city pays those who move."';
    S.wanted.stars = 0;
    G.camYaw = Math.PI * 0.75;
    return true;
  }
  if (name === 'drive') {
    // Beachfront cruise in the sports car at speed, with traffic and sea.
    S.screen = 'playing';
    const car = makeCar('sports', 1600, 200, 0, { id: 'shot-car' });
    car.speed = 320; car.playerOwned = true;
    S.player.inCar = car; S.player.x = car.x; S.player.z = car.z;
    S.missions.index = 0; S.missions.stage = 'go';
    S.missions.dialogue = 'Mama Rosa: "Solmar missed you, kid. Come see me at the bar."';
    S.wanted.stars = 0;
    G.camYaw = 0;
    return true;
  }
  if (name === 'fight') {
    // Port shootout, "drop the rivals" counter visible. The player stands
    // at the docks facing the rivals, containers behind them.
    S.screen = 'playing';
    S.player.x = PLACES.port.x; S.player.z = PLACES.port.z - 80;
    S.player.heading = 0; S.player.inCar = null;
    S.player.ammo = 48;
    S.player.money = 1470;
    S.missions.index = 4; S.missions.stage = 'go'; S.missions.kills = 3;
    S.missions.dialogue = 'Mama Rosa: "Rivals at the docks. Drop five of them, then the port is ours."';
    S.wanted.stars = 2; S.wanted.lastCrimeAt = S.now;
    G.camYaw = 0;
    return true;
  }
  return false;
}
