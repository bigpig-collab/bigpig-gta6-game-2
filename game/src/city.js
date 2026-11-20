// City layout: road grid, districts, buildings, trees and props. All of it
// is deterministic from the seed — roads every BLOCK, downtown towers in the
// middle, beach on the east edge, port along the south edge, park to the west.
import { WORLD_W, WORLD_H, BLOCK, ROAD_W } from './config.js';
import { makeRng, pick, range } from './random.js';

export const ROAD_XS = [];
export const ROAD_YS = [];
for (let x = 200; x < WORLD_W - 100; x += BLOCK) ROAD_XS.push(x);
for (let y = 200; y < WORLD_H - 100; y += BLOCK) ROAD_YS.push(y);

export function nearestRoadX(x) {
  let best = ROAD_XS[0];
  for (const rx of ROAD_XS) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadY(y) {
  let best = ROAD_YS[0];
  for (const ry of ROAD_YS) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}
export function onRoad(x, y) {
  for (const rx of ROAD_XS) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROAD_YS) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}
export function nearJunction(x, y, r = 70) {
  for (const rx of ROAD_XS) {
    for (const ry of ROAD_YS) {
      if (Math.abs(x - rx) < r && Math.abs(y - ry) < r) return true;
    }
  }
  return false;
}

const TOWER_COLORS = ['#b03a2e', '#2e5f8a', '#6c3483', '#1e8449', '#935116', '#7b7d7d'];
const HOUSE_COLORS = ['#e59866', '#f5b7b1', '#aed6f1', '#a9dfbf', '#f9e79f', '#d7bde2'];
const DOCK_COLORS = ['#5d6d7e', '#a93226', '#7d6608', '#2c3e50'];

export function districtAt(x, y) {
  if (x > 2780) return 'beach';
  if (y > 1950) return 'port';
  if (x >= 1000 && x <= 2200 && y >= 600 && y <= 1500) return 'downtown';
  if (x >= 600 && x < 1000 && y >= 1400 && y < 1800) return 'park';
  return 'suburb';
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const props = [];
  for (let bx = 0; bx < ROAD_XS.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_YS.length - 1; by += 1) {
      const x0 = ROAD_XS[bx] + ROAD_W / 2 + 14;
      const y0 = ROAD_YS[by] + ROAD_W / 2 + 14;
      const x1 = ROAD_XS[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROAD_YS[by + 1] - ROAD_W / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const d = districtAt(cx, cy);
      if (d === 'beach') {
        for (let i = 0; i < 3; i += 1) {
          trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), palm: true });
        }
        continue;
      }
      if (d === 'park') {
        for (let i = 0; i < 9; i += 1) {
          trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), palm: false });
        }
        props.push({ x: cx, y: cy, kind: 'pond' });
        continue;
      }
      if (d === 'port') {
        for (let i = 0; i < 4; i += 1) {
          props.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), kind: pick(rng, ['crate', 'container', 'container']) });
        }
        buildings.push({ x: x0 + 20, y: y0 + 20, w: 120, h: 70, color: pick(rng, DOCK_COLORS), tall: 0, height: 55 });
        continue;
      }
      const count = d === 'downtown' ? 2 : (rng() < 0.6 ? 2 : 3);
      for (let i = 0; i < count; i += 1) {
        const w = d === 'downtown' ? range(rng, 90, 150) : range(rng, 70, 130);
        const h = d === 'downtown' ? range(rng, 80, 140) : range(rng, 60, 110);
        const px = x0 + ((i % 2) * (x1 - x0 - w)) + range(rng, 0, 12);
        const py = y0 + (Math.floor(i / 2) * (y1 - y0 - h)) + range(rng, 0, 12);
        buildings.push({
          x: px, y: py, w, h,
          color: d === 'downtown' ? pick(rng, TOWER_COLORS) : pick(rng, HOUSE_COLORS),
          tall: d === 'downtown' ? Math.floor(range(rng, 1, 4)) : 0,
          height: d === 'downtown' ? range(rng, 150, 420) : range(rng, 45, 95),
        });
      }
      if (rng() < 0.7) trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), palm: false });
    }
  }
  for (let i = 0; i < 8; i += 1) {
    props.push({ x: 2830 + rng() * 130, y: 300 + i * 240 + rng() * 60, kind: 'umbrella' });
  }
  for (let i = 0; i < 3; i += 1) props.push({ x: 600 + i * 900, y: 2280, kind: 'crane' });
  return { buildings, trees, props };
}

// Point-in-building test used by movement and bullet collision.
export function hitsBuilding(city, x, y, pad = 0) {
  for (const b of city.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

export function roadPoint(x, y) {
  const rx = nearestRoadX(x);
  const ry = nearestRoadY(y);
  if (Math.abs(x - rx) < Math.abs(y - ry)) return { x: rx, y };
  return { x, y: ry };
}
