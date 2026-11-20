# Solmar City

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bigpig-collab/bigpig-gta6-game-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bigpig-collab/bigpig-gta6-game-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar City** is a 3D open-world crime game that runs in a desktop browser
from static files — no build step, no network request. A sun-soaked coastal
city, 3200×2400 units of roads, towers, suburbs, a park, a beach and a port,
all generated from a seed so the same seed always builds the same city.

## Play

Open `game/index.html` through any static server (`node serve.ts`, then
http://localhost:8080) and press Enter.

- **On foot:** WASD to walk, Shift to run, drag the mouse to look around,
  F to punch, click to fire the pistol, E to enter or exit a car.
- **Driving:** six cars to steal and drive — sedan, taxi, truck, van, sports
  car and police interceptor — with arcade handling, handbrake on Space,
  damage, smoke, brake lights and a pitched engine hum.
- **The city lives:** 14 traffic cars follow the road grid, 25 pedestrians
  walk the sidewalks and flee from gunfire, parked cars line the kerbs.
- **Wanted:** 1–5 stars. Steal cars, hit peds or shoot cops and the heat
  rises; police cars chase and ram, foot cops spawn on foot. Get busted or
  wasted and you wake up at the police station or the hospital, $150 poorer.
- **The story:** six jobs from Mama Rosa — from "Back in Town" ($150) to
  "The Big Score" ($1,000) — with dialogue, a pulsing minimap blip and a
  money trail from $120 to $3,070.
- **HUD and minimap:** wanted stars, health, money, ammo, speed, objective
  bar, dialogue box, and a live 2D minimap with police and rival blips.
- **Save:** walk into the safehouse and your money and mission progress are
  stored in local storage. M mutes all sound.

## Screenshots

Four staged renders of the game itself, all at 1280×800:

1. **Chase (cover)** — a 3-star police chase, police cars ahead of the
   player's sports car, HUD, minimap, objective and dialogue in one frame.
2. **Street** — mission complete at Rosa's Bar, reward banner visible.
3. **Drive** — beachfront cruise in the sports car at speed, with traffic,
   palms and sea.
4. **Fight** — port shootout with the drop-the-rivals counter visible.

## Structure

- `game/src/` — one module per concern: world layout, city meshes, renderer,
  vehicles, player, traffic, police, combat, missions, HUD, minimap, audio,
  save/load, input, seeded random and staged screenshots.
- `game/vendor/` — three.js (vendored, minified) and its license.
- `main.ts` — the entry program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` (Node 22, stdlib only).
- `serve.ts` — a tiny static server for local testing.
- `screenshots/` — four staged renders of the game itself.

Built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on
make.fun. Everything here is original: our own city, characters, vehicles,
names, story, art and sounds — nothing from any commercial game.
