// Live 2D minimap: roads, district shading, building dots, safehouse
// marker, pulsing mission blip, police and rival blips, and the player as
// a dot with a direction ring. Redrawn every frame.
import { WORLD, PLACES, DISTRICT_COLORS } from './config.js';
import { listBlocks } from './world.js';

let blocksCache = null;
export function buildMinimap(doc) {
  const cv = doc.createElement('canvas');
  cv.id = 'minimap';
  cv.width = 230; cv.height = 176;
  doc.body.appendChild(cv);
  return cv;
}
export function drawMinimap(cv, s, now) {
  const g = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  const sx = W / WORLD.width, sz = H / WORLD.height;
  const X = (x) => (x + WORLD.halfW) * sx;
  const Z = (z) => (z + WORLD.halfH) * sz;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#1d2b1f'; g.fillRect(0, 0, W, H);
  // District shading.
  g.fillStyle = DISTRICT_COLORS.downtown; g.fillRect(X(-900), Z(-1200), (1800) * sx, (800) * sz); // downtown
  g.fillStyle = DISTRICT_COLORS.park; g.fillRect(X(-400), Z(0), 800 * sx, 800 * sz); // park
  g.fillStyle = DISTRICT_COLORS.beach; g.fillRect(X(1380), Z(-1200), 220 * sx, H); // beach
  g.fillStyle = DISTRICT_COLORS.port; g.fillRect(0, Z(1000), W, H - Z(1000)); // port
  // Roads.
  g.strokeStyle = '#3a3f47'; g.lineWidth = 4;
  for (const r of WORLD.roadsX) { g.beginPath(); g.moveTo(X(r), 0); g.lineTo(X(r), H); g.stroke(); }
  for (const r of WORLD.roadsZ) { g.beginPath(); g.moveTo(0, Z(r)); g.lineTo(W, Z(r)); g.stroke(); }
  // Building dots.
  if (!blocksCache) blocksCache = listBlocks();
  g.fillStyle = '#8b93a0';
  for (const b of blocksCache) {
    if (b.district === 'park' || b.district === 'beach' || b.district === 'port') continue;
    g.fillRect(X(b.cx) - 1, Z(b.cz) - 1, 2, 2);
  }
  // Safehouse.
  g.fillStyle = '#37d67a';
  g.beginPath(); g.arc(X(PLACES.safehouse.x), Z(PLACES.safehouse.z), 4, 0, 7); g.fill();
  g.fillStyle = '#0d2b18'; g.font = 'bold 7px sans-serif'; g.textAlign = 'center';
  g.fillText('H', X(PLACES.safehouse.x), Z(PLACES.safehouse.z) + 2.5);
  // Police and rival blips.
  g.fillStyle = '#2f7bff';
  for (const p of s.police) { g.beginPath(); g.arc(X(p.x), Z(p.z), 3, 0, 7); g.fill(); }
  g.fillStyle = '#ff4030';
  for (const r of s.rivals) { g.beginPath(); g.arc(X(r.x), Z(r.z), 3, 0, 7); g.fill(); }
  // Pulsing mission blip.
  const pulse = 4 + Math.sin(now * 5) * 2;
  g.fillStyle = '#ffd76a';
  g.beginPath(); g.arc(X(s.target.x), Z(s.target.z), pulse, 0, 7); g.fill();
  g.strokeStyle = '#ffd76a'; g.lineWidth = 1.5;
  g.beginPath(); g.arc(X(s.target.x), Z(s.target.z), pulse + 4, 0, 7); g.stroke();
  // Player dot with direction ring.
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(X(s.player.x), Z(s.player.z), 4, 0, 7); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(X(s.player.x), Z(s.player.z));
  g.lineTo(X(s.player.x) + Math.sin(s.player.heading) * 9, Z(s.player.z) + Math.cos(s.player.heading) * 9);
  g.stroke();
}
