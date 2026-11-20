// Solmar City in three.js: ground, roads, buildings, park, beach, port and
// props. Colliders come from world.js so meshes and physics agree exactly.
import * as THREE from 'three';
import { WORLD, PLACES } from './config.js';
import { listBlocks, blockBuildings, districtAt } from './world.js';
import { makeRng } from './random.js';

function windowTexture(rng, base, lit) {
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 64, 128);
  for (let y = 6; y < 122; y += 12) {
    for (let x = 6; x < 58; x += 10) {
      g.fillStyle = rng.chance(0.45) ? lit : '#1d2733';
      g.fillRect(x, y, 6, 7);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function labelSprite(text, color) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,18,28,0.82)'; g.fillRect(0, 0, 256, 64);
  g.strokeStyle = color; g.lineWidth = 4; g.strokeRect(2, 2, 252, 60);
  g.fillStyle = '#ffffff'; g.font = 'bold 26px sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
  const s = new THREE.Sprite(m);
  s.scale.set(46, 11.5, 1);
  return s;
}
export function buildCity(scene, seed) {
  const rng = makeRng(seed + '-city');
  const colliders = [];
  const group = new THREE.Group();
  group.name = 'city';
  // Ground: big grass slab, then road strips, sand east, concrete south.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD.width + 600, WORLD.height + 600),
    new THREE.MeshLambertMaterial({ color: 0x6fae5e }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  group.add(ground);
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const sandMat = new THREE.MeshLambertMaterial({ color: 0xe8d29a });
  const seaMat = new THREE.MeshLambertMaterial({ color: 0x2f7fc2 });
  const portMat = new THREE.MeshLambertMaterial({ color: 0x8d9299 });
  for (const r of WORLD.roadsX) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, WORLD.height), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(r, 0.05, 0); road.receiveShadow = true;
    group.add(road);
  }
  for (const r of WORLD.roadsZ) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width, WORLD.roadWidth), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.05, r); road.receiveShadow = true;
    group.add(road);
  }
  // Centre dashes on every road.
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5d76e });
  for (const r of WORLD.roadsX) {
    for (let z = -WORLD.halfH + 40; z < WORLD.halfH; z += 80) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(2, 22), dashMat);
      d.rotation.x = -Math.PI / 2; d.position.set(r, 0.08, z);
      group.add(d);
    }
  }
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(240, WORLD.height), sandMat);
  sand.rotation.x = -Math.PI / 2; sand.position.set(WORLD.halfW - 40, 0.04, 0); sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(500, WORLD.height + 600), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.set(WORLD.halfW + 300, 0.02, 0);
  group.add(sea);
  const port = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.width, 240), portMat);
  port.rotation.x = -Math.PI / 2; port.position.set(0, 0.04, WORLD.halfH - 60); port.receiveShadow = true;
  group.add(port);
  // Buildings, park, beach and port props per block.
  const glassTex = windowTexture(rng, '#274b6d', '#ffd76a');
  const brickTex = windowTexture(rng, '#7a6a58', '#ffe9a8');
  const glassMat = new THREE.MeshLambertMaterial({ map: glassTex });
  const brickMat = new THREE.MeshLambertMaterial({ map: brickTex });
  const houseCols = [0xd8b48f, 0xc9d6de, 0xe0cfa8, 0xb7c4a8, 0xdba0a0];
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f3a });
  const palmMat = new THREE.MeshLambertMaterial({ color: 0x2f9e44 });
  const blocks = listBlocks();
  for (const block of blocks) {
    const bs = blockBuildings(block, rng);
    for (const b of bs) {
      colliders.push(b);
      const mat = b.district === 'downtown' ? glassMat : (rng.chance(0.5) ? brickMat : new THREE.MeshLambertMaterial({ color: rng.pick(houseCols) }));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.hw * 2, b.h, b.hd * 2), mat);
      mesh.position.set(b.x, b.h / 2, b.z);
      mesh.castShadow = true; mesh.receiveShadow = true;
      group.add(mesh);
      if (b.district === 'downtown') {
        const roof = new THREE.Mesh(new THREE.BoxGeometry(b.hw * 2 * 0.5, 4, b.hd * 2 * 0.5),
          new THREE.MeshLambertMaterial({ color: 0x22303e }));
        roof.position.set(b.x, b.h + 2, b.z); group.add(roof);
      }
    }
    if (block.district === 'park') {
      const pond = new THREE.Mesh(new THREE.CircleGeometry(70, 24),
        new THREE.MeshLambertMaterial({ color: 0x3f8fd2 }));
      pond.rotation.x = -Math.PI / 2; pond.position.set(block.cx + 60, 0.06, block.cz + 40);
      group.add(pond);
      for (let i = 0; i < 16; i++) addTree(group, rng, block.cx + rng.range(-160, 160), block.cz + rng.range(-160, 160), trunkMat, leafMat);
      for (let i = 0; i < 4; i++) {
        const bench = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 3), new THREE.MeshLambertMaterial({ color: 0x8a6b45 }));
        bench.position.set(block.cx + rng.range(-140, 140), 1, block.cz + rng.range(-140, 140));
        bench.castShadow = true; group.add(bench);
      }
    }
    if (block.district === 'beach') {
      for (let i = 0; i < 6; i++) addTree(group, rng, 1420 + rng.range(0, 140), block.cz + rng.range(-150, 150), trunkMat, palmMat, true);
      for (let i = 0; i < 4; i++) {
        const um = new THREE.Mesh(new THREE.ConeGeometry(9, 4, 8), new THREE.MeshLambertMaterial({ color: rng.pick([0xe84a5f, 0x2f9e44, 0xf2c200, 0x3a6fd8]) }));
        um.position.set(1460 + rng.range(0, 80), 7, block.cz + rng.range(-140, 140));
        um.castShadow = true; group.add(um);
      }
    }
    if (block.district === 'port') {
      for (let i = 0; i < 8; i++) {
        const cont = new THREE.Mesh(new THREE.BoxGeometry(24, 9, 9),
          new THREE.MeshLambertMaterial({ color: rng.pick([0xc0392b, 0x2471a3, 0x229954, 0xd4ac0d, 0x7d3c98]) }));
        cont.position.set(block.cx + rng.range(-140, 140), 4.5, block.cz + rng.range(-60, 60));
        cont.rotation.y = rng.chance(0.5) ? 0 : Math.PI / 2;
        cont.castShadow = true; group.add(cont);
        colliders.push({ x: cont.position.x, z: cont.position.z, hw: 12, hd: 5, h: 9, district: 'port' });
      }
      const crane = new THREE.Group();
      const legMat = new THREE.MeshLambertMaterial({ color: 0xd35400 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(3, 60, 3), legMat);
        leg.position.set(sx * 12, 30, sz * 12); crane.add(leg);
      }
      const arm = new THREE.Mesh(new THREE.BoxGeometry(90, 4, 4), legMat);
      arm.position.set(20, 58, 0); crane.add(arm);
      crane.position.set(block.cx, 0, block.cz + 40);
      group.add(crane);
    }
    if (block.district === 'suburbs' || block.district === 'midtown') {
      for (let i = 0; i < 3; i++) addTree(group, rng, block.cx + rng.range(-150, 150), block.cz + rng.range(-150, 150), trunkMat, leafMat);
    }
  }
  // Street lamps along roads and traffic lights at junctions.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x30343a });
  const lampHead = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const r of WORLD.roadsX) {
    for (let z = -1000; z <= 1000; z += 400) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 16, 6), lampMat);
      pole.position.set(r + 38, 8, z); group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 6), lampHead);
      head.position.set(r + 38, 16.4, z); group.add(head);
    }
  }
  const lightCols = [0x2ecc40, 0xffdc00, 0xff4136];
  for (const rx of WORLD.roadsX) {
    for (const rz of WORLD.roadsZ) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(2, 12, 2), lampMat);
      post.position.set(rx + 36, 6, rz + 36); group.add(post);
      const lamp = new THREE.Mesh(new THREE.BoxGeometry(3, 7, 3),
        new THREE.MeshBasicMaterial({ color: lightCols[Math.floor(Math.random() * 3)] }));
      lamp.position.set(rx + 36, 13, rz + 36); group.add(lamp);
    }
  }
  // Lighthouse on the beach at the north end: striped tower, visible
  // from the beachfront cruise and a landmark for the drive shot.
  const lightHouse = new THREE.Group();
  const stripeA = new THREE.MeshLambertMaterial({ color: 0xf2f2f2 });
  const stripeB = new THREE.MeshLambertMaterial({ color: 0xd21f2b });
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(5 - i * 0.5, 5.5 - i * 0.5, 9, 10), i % 2 === 0 ? stripeA : stripeB);
    seg.position.y = 4.5 + i * 9;
    seg.castShadow = true;
    lightHouse.add(seg);
  }
  const lampRoom = new THREE.Mesh(new THREE.BoxGeometry(7, 5, 7), new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
  lampRoom.position.y = 49;
  lightHouse.add(lampRoom);
  lightHouse.position.set(1560, 0, -1120);
  group.add(lightHouse);
  colliders.push({ x: 1560, z: -1120, hw: 6, hd: 6, h: 52, district: 'beach' });
  // Named-place signs.
  for (const key of Object.keys(PLACES)) {
    const p = PLACES[key];
    const sign = labelSprite(p.name.toUpperCase(), key === 'bar' ? '#ff9f1c' : '#7ee0ff');
    sign.position.set(p.x, 26, p.z);
    group.add(sign);
  }
  scene.add(group);
  return { colliders, group };
}
function addTree(group, rng, x, z, trunkMat, leafMat, palm = false) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.6, palm ? 14 : 8, 6), trunkMat);
  trunk.position.set(x, palm ? 7 : 4, z); trunk.castShadow = true; group.add(trunk);
  const leaf = new THREE.Mesh(palm ? new THREE.ConeGeometry(7, 8, 7) : new THREE.SphereGeometry(6, 8, 6), leafMat);
  leaf.position.set(x, palm ? 16 : 11, z); leaf.castShadow = true; group.add(leaf);
}
