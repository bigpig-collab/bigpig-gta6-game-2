// Solmar City — entry program for the make.fun gta6-01 bounty.
// Copies game/ and screenshots/ into MAKEFUN_OUTPUT_DIR and writes
// dossier.json with the kit's buildDossier helper. Node 22, stdlib only.
import { cpSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR;
if (!out) {
  console.error('MAKEFUN_OUTPUT_DIR is not set');
  process.exit(1);
}
mkdirSync(out, { recursive: true });
const gameDir = join(root, 'game');
const shotsDir = join(root, 'screenshots');
if (!existsSync(gameDir)) { console.error('game/ is missing'); process.exit(1); }
if (!existsSync(shotsDir)) { console.error('screenshots/ is missing'); process.exit(1); }
cpSync(gameDir, join(out, 'game'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
});
writeFileSync(join(out, 'dossier.json'), dossier);
// Gate self-check: the dossier text must hold no http references and
// must fit the 160 KiB text cap, or the entry is not handed in.
const parsed = JSON.parse(Buffer.from(dossier).toString('utf8'));
const textBytes = Buffer.byteLength(parsed.text || '', 'utf8');
if (textBytes > 163840) { console.error('dossier text over the cap: ' + textBytes + ' bytes'); process.exit(1); }
if (/https?:/.test(parsed.text || '')) { console.error('dossier text holds an http reference'); process.exit(1); }
console.log('wrote ' + join(out, 'dossier.json') + ' (' + dossier.length + ' bytes, text ' + textBytes + ' bytes, 0 http refs)');
