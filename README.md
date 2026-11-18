# Solmar City — 3D open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/bigpig-collab/bigpig-gta6-game-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/bigpig-collab/bigpig-gta6-game-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A sun-soaked 3D open-world crime game built for the
[make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01) — a fresh rebuild
in three.js (WebGL, third-person chase camera) of the Solmar City story.

## The game

You are back in Solmar City, a fictional coastal city: downtown glass
towers, suburbs, a park with a pond, a beachfront with palms and umbrellas,
and container docks at the port. Mama Rosa has six jobs for you — from
borrowing a sports car to the big score — with free roam between missions.

- **On foot:** WASD move, Shift run, drag the mouse to orbit the camera,
  F punch, click to shoot the pistol (ammo, tracers, muzzle flash).
- **Driving:** E to steal / enter any car, arcade handling with handbrake
  (Space). Six models — sedan, taxi, truck, van, sports, police — each with
  its own top speed, acceleration and turning, plus damage, smoke and brake
  lights.
- **The city lives:** traffic follows the road grid and turns at junctions,
  pedestrians walk the sidewalks and flee gunfire and crashes.
- **Wanted 1–5 stars:** crime draws police cars that chase and ram, and foot
  cops who pursue and shoot. Get busted (caught on foot at 3+ stars) or
  wasted (0 HP) and you wake at the station or hospital, minus a fine. Lose
  the cops and the heat cools.
- **Missions:** the six-job Mama Rosa chain — Back in Town ($150), Borrowed
  Wheels ($300), The Pickup ($400), Heat Wave ($500), Dockside Deal ($600),
  The Big Score ($1000) — with dialogue, objective banner, minimap blip and
  cash rewards.
- **HUD + minimap:** wanted stars, HP bar, money, ammo, speed and car model,
  objective bar, dialogue box, mission banners, and a live top-down minimap
  with roads, districts, the pulsing mission blip, police and gang blips.
- **Save:** stand by the green Safehouse to save; progress resumes on reload.
- **Sound:** fully synthesised WebAudio — engine hum pitched by speed,
  sirens, gunshots, cash and mission stingers, and a synthwave radio loop.
  M mutes.

## Play it

```sh
node serve.ts   # then open http://localhost:8080
```

No build step, no network requests, no external assets: `game/` is static
files, three.js vendored under `game/vendor/three/`. Everything — city,
names, art, sounds — is original.

## How it is built

`game/src/` is split by job: `config` (tuning + places), `random` (seeded
RNG), `city` (road grid, districts, buildings), `render3d` (three.js scene,
camera, lighting, shadows), `vehicles` (driving + traffic AI), `player`,
`police` (wanted + pursuit), `peds`, `missions` (the 6-job chain), `world`
(fixed-step simulation), `hud` (DOM HUD + minimap), `audio` (WebAudio
synth), `save`, `input`, `shots` (staged screenshot scenes), `main`
(screens + game loop).

Screenshots are staged scenes (`?shot=chase|street|drive|fight&seed=1`)
that play the real rules forward from a fresh world, then freeze — real
WebGL renders, never edited.

## License

MIT — see [LICENSE](LICENSE).
