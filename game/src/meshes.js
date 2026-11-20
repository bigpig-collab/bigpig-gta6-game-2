// Low-poly three.js meshes: the six car models and the person figure.
// Each car mesh carries refs to its brake lights and smoke anchor so the
// game loop can light and puff them without rebuilding geometry.
import * as THREE from 'three';

const BODY = new THREE.MeshLambertMaterial({ color: 0xffffff });
function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}
export function makeCarMesh(car) {
  const g = new THREE.Group();
  g.name = 'car-' + car.type;
  const c = car.color;
  const L = car.len, W = car.wid;
  const body = box(W, 0.9, L, c, 0, 0.85, 0);
  g.add(body);
  const cabinH = car.type === 'truck' ? 1.1 : 0.8;
  const cabinL = car.type === 'truck' ? L * 0.22 : L * 0.45;
  const cabinZ = car.type === 'truck' ? -L * 0.32 : L * 0.05;
  const cabin = box(W * 0.82, cabinH, cabinL, car.type === 'police' ? 0xf2f2f2 : 0x1c2733, 0, 1.6, cabinZ);
  g.add(cabin);
  if (car.type === 'truck') {
    const bed = box(W * 0.94, 0.7, L * 0.55, 0x5a6b52, 0, 1.5, L * 0.22);
    g.add(bed);
  }
  if (car.type === 'taxi') {
    const sign = box(1.4, 0.35, 0.5, 0xf2c200, 0, 2.2, cabinZ);
    g.add(sign);
    const signTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0 }));
    signTop.position.set(0, 2.42, cabinZ); g.add(signTop);
  }
  if (car.type === 'police') {
    const bar = box(W * 0.7, 0.28, 0.5, 0x14181d, 0, 2.15, cabinZ);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    red.position.set(-0.5, 2.35, cabinZ); g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.5), new THREE.MeshBasicMaterial({ color: 0x2040ff }));
    blue.position.set(0.5, 2.35, cabinZ); g.add(blue);
    g.userData.beaconRed = red; g.userData.beaconBlue = blue;
    const stripe = box(W + 0.02, 0.3, L * 0.9, 0xf2f2f2, 0, 0.95, 0);
    g.add(stripe);
  }
  if (car.type === 'sports') {
    const spoiler = box(W * 0.9, 0.14, 0.5, 0x14181d, 0, 1.5, -L / 2 + 0.3);
    g.add(spoiler);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx * (W / 2 + 0.05), 0.42, sz * (L / 2 - 0.9));
    w.castShadow = true;
    g.add(w);
  }
  // Headlights and brake lights (brake lights glow when braking).
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0 });
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.1), headMat);
    h.position.set(sx * (W / 2 - 0.4), 0.95, L / 2 + 0.02); g.add(h);
    const mirror = box(0.28, 0.16, 0.3, 0x14181d, sx * (W / 2 + 0.12), 1.45, L * 0.18);
    g.add(mirror);
  }
  const brakeMat = new THREE.MeshBasicMaterial({ color: 0x550000 });
  const brakes = [];
  for (const sx of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.25, 0.1), brakeMat.clone());
    b.position.set(sx * (W / 2 - 0.4), 0.95, -L / 2 - 0.02); g.add(b);
    brakes.push(b);
  }
  g.userData.brakes = brakes;
  const smokeAnchor = new THREE.Object3D();
  smokeAnchor.position.set(0, 1.2, -L / 2);
  g.add(smokeAnchor);
  g.userData.smokeAnchor = smokeAnchor;
  return g;
}
export function makePersonMesh(kind, shirtColor) {
  const g = new THREE.Group();
  g.name = 'person-' + kind;
  const shirt = kind === 'cop' ? 0x1d3a6e : (kind === 'rival' ? 0xb03030 : shirtColor);
  const torso = box(0.9, 1.1, 0.5, shirt, 0, 1.35, 0);
  g.add(torso);
  const head = box(0.55, 0.55, 0.55, 0xe8b98a, 0, 2.2, 0);
  g.add(head);
  if (kind === 'cop') {
    const cap = box(0.6, 0.18, 0.6, 0x101418, 0, 2.52, 0);
    g.add(cap);
  }
  const legMat = new THREE.MeshLambertMaterial({ color: kind === 'cop' ? 0x14181d : 0x2b3a4a });
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.85, 0.35), legMat);
    leg.position.set(sx * 0.22, 0.42, 0); leg.castShadow = true;
    g.add(leg);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.9, 0.3),
      new THREE.MeshLambertMaterial({ color: shirt }));
    arm.position.set(sx * 0.6, 1.35, 0); arm.castShadow = true;
    g.add(arm);
  }
  if (kind === 'rival') {
    const gun = box(0.12, 0.12, 0.7, 0x141414, 0.6, 1.35, 0.4);
    g.add(gun);
  }
  return g;
}
export function makeMarkerMesh(color) {
  const geo = new THREE.CylinderGeometry(2.2, 2.2, 8, 12, 1, true);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 4;
  return m;
}
export function makeTracerMesh() {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 }));
  line.visible = false;
  return line;
}
