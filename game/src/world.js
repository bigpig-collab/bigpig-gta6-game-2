// Pure world math for Solmar City: road grid, districts, building blocks
// and collision shapes. No three.js here, so Node sims can import it.
import { WORLD, PLACES } from './config.js';
import { clamp } from './random.js';

export function nearestRoadCoord(v, roads) {
  let best = roads[0], bd = Infinity;
  for (const r of roads) { const d = Math.abs(v - r); if (d < bd) { bd = d; best = r; } }
  return { road: best, dist: bd };
}
export function onRoad(x, z) {
  return nearestRoadCoord(x, WORLD.roadsX).dist <= WORLD.roadWidth / 2 ||
    nearestRoadCoord(z, WORLD.roadsZ).dist <= WORLD.roadWidth / 2;
}
export function atJunction(x, z) {
  return nearestRoadCoord(x, WORLD.roadsX).dist <= WORLD.roadWidth / 2 &&
    nearestRoadCoord(z, WORLD.roadsZ).dist <= WORLD.roadWidth / 2;
}
export function districtAt(x, z) {
  if (x > 1380) return 'beach';
  if (z > 1000) return 'port';
  if (x > -400 && x < 400 && z > 0 && z < 800) return 'park';
  if (x > -900 && x < 900 && z < -400) return 'downtown';
  if (x < -800) return 'suburbs';
  return 'midtown';
}
// Snap a point to the nearest road centreline (used by traffic lanes).
export function snapToRoad(x, z) {
  const nx = nearestRoadCoord(x, WORLD.roadsX);
  const nz = nearestRoadCoord(z, WORLD.roadsZ);
  if (nx.dist <= nz.dist) return { x: nx.road, z, axis: 'x' };
  return { x, z: nz.road, axis: 'z' };
}
// Blocks are the rectangles between roads; each gets buildings or a park.
export function listBlocks() {
  const blocks = [];
  for (let i = 0; i < WORLD.roadsX.length - 1; i++) {
    for (let j = 0; j < WORLD.roadsZ.length - 1; j++) {
      const x0 = WORLD.roadsX[i] + WORLD.roadWidth / 2 + 8;
      const x1 = WORLD.roadsX[i + 1] - WORLD.roadWidth / 2 - 8;
      const z0 = WORLD.roadsZ[j] + WORLD.roadWidth / 2 + 8;
      const z1 = WORLD.roadsZ[j + 1] - WORLD.roadWidth / 2 - 8;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      blocks.push({ x0, x1, z0, z1, cx, cz, district: districtAt(cx, cz) });
    }
  }
  return blocks;
}
export function clampToWorld(x, z, margin = 20) {
  return {
    x: clamp(x, -WORLD.halfW + margin, WORLD.halfW - margin),
    z: clamp(z, -WORLD.halfH + margin, WORLD.halfH - margin),
  };
}
export function placePos(name) { const p = PLACES[name]; return { x: p.x, z: p.z }; }
export function nearestPlace(x, z) {
  let best = null, bestD = Infinity;
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bestD) { bestD = d; best = { key, name: p.name, x: p.x, z: p.z, dist: d }; }
  }
  return best;
}
// Axis-aligned building colliders for a block, generated from a seed.
export function blockBuildings(block, rng) {
  const out = [];
  if (block.district === 'park' || block.district === 'beach' || block.district === 'port') return out;
  const n = block.district === 'downtown' ? rng.int(2, 4) : rng.int(1, 3);
  const w = (block.x1 - block.x0) / 2, d = (block.z1 - block.z0) / 2;
  for (let k = 0; k < n; k++) {
    const bw = rng.range(40, 90), bd = rng.range(40, 90);
    const bx = block.cx + (k % 2 === 0 ? -w / 2 : w / 2) + rng.range(-14, 14);
    const bz = block.cz + (k < 2 ? -d / 2 : d / 2) + rng.range(-14, 14);
    const tall = block.district === 'downtown' ? rng.range(90, 220) : rng.range(14, 42);
    out.push({ x: bx, z: bz, hw: bw / 2, hd: bd / 2, h: tall, district: block.district });
  }
  return out;
}
// Circle vs AABB push-out. Returns corrected {x,z} and whether it hit.
// Sliding emerges because only the penetrating axis is cancelled.
export function collideCircleAABB(x, z, r, box) {
  const cx = clamp(x, box.x - box.hw, box.x + box.hw);
  const cz = clamp(z, box.z - box.hd, box.z + box.hd);
  const dx = x - cx, dz = z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return { x, z, hit: false };
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2), push = (r - d) / d;
    return { x: x + dx * push, z: z + dz * push, hit: true };
  }
  // Centre inside the box: push out along the smallest exit.
  const px = box.hw + r - Math.abs(x - box.x);
  const pz = box.hd + r - Math.abs(z - box.z);
  if (px < pz) return { x: box.x + (x >= box.x ? box.hw + r : -box.hw - r), z, hit: true };
  return { x, z: box.z + (z >= box.z ? box.hd + r : -box.hd - r), hit: true };
}
export function circleHitsBox(x, z, r, box) {
  const cx = clamp(x, box.x - box.hw, box.x + box.hw);
  const cz = clamp(z, box.z - box.hd, box.z + box.hd);
  const dx = x - cx, dz = z - cz;
  return dx * dx + dz * dz < r * r;
}
