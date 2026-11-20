// Handover script for the Solmar City v4 entry in make.fun's gta6-01 bounty.
// Node 22, standard library only. The game is a folder of static files
// (game/index.html plus its ES modules and the vendored three.js build, no
// network calls). This script copies that folder and the screenshots folder
// into the output directory and writes dossier.json — the short summary the
// judges read — through the vendored make.fun helper.
//
// To try the game first: `node serve.ts`, then open http://localhost:8080.
// Outside the judge container, set MAKEFUN_OUTPUT_DIR to stand in for
// /output, e.g.:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Caps from the scorer's own gate: text_max_bytes is the only one that
// changes the dossier's size; the rest mirror what the scorer refuses —
// over 4 screenshots, any screenshot over 256 KiB, over 993 files in game/
// or 48 MiB of game files in total, or any game path longer than 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
