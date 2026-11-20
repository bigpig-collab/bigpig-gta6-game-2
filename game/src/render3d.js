// Three.js renderer for Solmar City. The static city is built once from the
// seeded city data; every frame a small set of dynamic meshes (player, cars,
// peds, cops, bullets, objective marker) is synced to the simulation state.
// World coords (x east, y south) map to three.js (x, 0, z = y); a heading
// angle a faces (cos a, 0, sin a), so mesh rotation.y = -a.
import * as THREE from 'three';
import { WORLD_W, WORLD_H, ROAD_W, PLACES, CAR_MODELS } from './config.js';
import { ROAD_XS, ROAD_YS, districtAt } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';

const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Downtown tower face: coloured base with a grid of windows, some lit.
function facadeTexture(base) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    for (let y = 10; y < h - 10; y += 22) {
      for (let x = 10; x < w - 10; x += 20) {
        const lit = Math.random() < 0.35;
        g.fillStyle = lit ? '#ffe9a3' : 'rgba(20,30,45,0.85)';
        g.fillRect(x, y, 12, 14);
      }
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, h - 18, w, 18);
  });
}

function roadTexture() {
  const t = canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#3b4048';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f5c518';
    g.fillRect(w / 2 - 2, 0, 4, 28);
    g.fillRect(w / 2 - 2, 64, 4, 28);
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 40; i += 1) g.fillRect(Math.random() * w, Math.random() * h, 3, 3);
  });
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function textTexture(text, bg, fg) {
  return canvasTexture(512, 128, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = fg;
    g.lineWidth = 6;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.fillStyle = fg;
    g.font = 'bold 52px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function smokeTexture() {
  return canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 4, 32, 32, 30);
    grad.addColorStop(0, 'rgba(120,120,120,0.85)');
    grad.addColorStop(1, 'rgba(120,120,120,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
}

const MAT = {};
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!MAT[key]) MAT[key] = new THREE.MeshLambertMaterial({ color, ...opts });
  return MAT[key];
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0xa8c8e0, 900, 3200);
  const camera = new THREE.PerspectiveCamera(62, 1, 1, 6000);

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a6b3a, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2cc, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -500;
  sun.shadow.camera.right = 500;
  sun.shadow.camera.top = 500;
  sun.shadow.camera.bottom = -500;
  sun.shadow.camera.far = 3000;
  sun.shadow.bias = -0.0015;
  scene.add(sun);
  scene.add(sun.target);

  const dyn = new THREE.Group();
  scene.add(dyn);
  let staticGroup = new THREE.Group();
  scene.add(staticGroup);

  const carGroups = new Map();
  const pedGroups = new Map();
  const copGroups = new Map();
  let playerGroup = null;
  let markerGroup = null;
  let bulletPool = [];
  let muzzle = null;
  let camPos = V3(0, 300, 600);
  let camLook = V3(0, 0, 0);
  let camYawSmooth = 0;
  let builtSeed = null;

  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function box(parent, w, h, d, material, x, y, z) {
    const m = new THREE.Mesh(boxGeo, material);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }

  function buildStatic(city) {
    // Ground layers: grass base, sand beach east, sea beyond, port concrete.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, WORLD_H), mat('#69a84f'));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(WORLD_W / 2, 0, WORLD_H / 2);
    ground.receiveShadow = true;
    staticGroup.add(ground);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(440, WORLD_H), mat('#e8d29a'));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(2980, 0.4, WORLD_H / 2);
    sand.receiveShadow = true;
    staticGroup.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, WORLD_H + 600), mat('#2e86c1'));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(3600, 0.2, WORLD_H / 2);
    staticGroup.add(sea);
    const port = new THREE.Mesh(new THREE.PlaneGeometry(WORLD_W, 460), mat('#8a8f96'));
    port.rotation.x = -Math.PI / 2;
    port.position.set(WORLD_W / 2, 0.3, 2170);
    port.receiveShadow = true;
    staticGroup.add(port);

    // Sidewalk slabs for every city block.
    for (let bx = 0; bx < ROAD_XS.length - 1; bx += 1) {
      for (let by = 0; by < ROAD_YS.length - 1; by += 1) {
        const x0 = ROAD_XS[bx] + ROAD_W / 2;
        const y0 = ROAD_YS[by] + ROAD_W / 2;
        const x1 = ROAD_XS[bx + 1] - ROAD_W / 2;
        const y1 = ROAD_YS[by + 1] - ROAD_W / 2;
        const d = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
        if (d === 'beach') continue;
        const col = d === 'park' ? '#5da24a' : d === 'port' ? '#7d838a' : '#b9bfc6';
        const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat(col));
        p.rotation.x = -Math.PI / 2;
        p.position.set((x0 + x1) / 2, 0.5, (y0 + y1) / 2);
        p.receiveShadow = true;
        staticGroup.add(p);
      }
    }
    // Roads with dashed centre lines.
    const rt = roadTexture();
    for (const rx of ROAD_XS) {
      const t = rt.clone();
      t.needsUpdate = true;
      t.repeat.set(1, 18);
      const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, WORLD_H), new THREE.MeshLambertMaterial({ map: t }));
      r.rotation.x = -Math.PI / 2;
      r.position.set(rx, 0.8, WORLD_H / 2);
      r.receiveShadow = true;
      staticGroup.add(r);
    }
    for (const ry of ROAD_YS) {
      const t = rt.clone();
      t.needsUpdate = true;
      t.repeat.set(1, 24);
      const r = new THREE.Mesh(new THREE.PlaneGeometry(ROAD_W, WORLD_W), new THREE.MeshLambertMaterial({ map: t }));
      r.rotation.x = -Math.PI / 2;
      r.rotation.z = Math.PI / 2;
      r.position.set(WORLD_W / 2, 0.8, ry);
      r.receiveShadow = true;
      staticGroup.add(r);
    }

    // Buildings with lit-window facades and dark roofs.
    const facades = {};
    const getFacade = (color) => {
      if (!facades[color]) facades[color] = new THREE.MeshLambertMaterial({ map: facadeTexture(color) });
      return facades[color];
    };
    for (const b of city.buildings) {
      const h = b.height || 60;
      const m = new THREE.Mesh(boxGeo, getFacade(b.color));
      m.scale.set(b.w, h, b.h);
      m.position.set(b.x + b.w / 2, h / 2, b.y + b.h / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      staticGroup.add(m);
      const roof = new THREE.Mesh(boxGeo, mat('#3a3f46'));
      roof.scale.set(b.w * 0.92, 6, b.h * 0.92);
      roof.position.set(b.x + b.w / 2, h + 3, b.y + b.h / 2);
      staticGroup.add(roof);
    }

    // Trees as instanced trunks + canopies (palms get a squashed crown).
    const trunkGeo = new THREE.CylinderGeometry(3, 5, 30, 6);
    const canopyGeo = new THREE.IcosahedronGeometry(16, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, mat('#7a5230'), Math.max(1, city.trees.length));
    const canopies = new THREE.InstancedMesh(canopyGeo, mat('#2e8b3a'), Math.max(1, city.trees.length));
    const dummy = new THREE.Object3D();
    city.trees.forEach((t, i) => {
      const th = t.palm ? 55 : 30;
      dummy.position.set(t.x, th / 2, t.y);
      dummy.scale.set(1, th / 30, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(t.x, th + 10, t.y);
      dummy.scale.set(t.palm ? 0.9 : 1.2, t.palm ? 0.55 : 1, t.palm ? 0.9 : 1.2);
      dummy.updateMatrix();
      canopies.setMatrixAt(i, dummy.matrix);
    });
    trunks.castShadow = true;
    canopies.castShadow = true;
    staticGroup.add(trunks);
    staticGroup.add(canopies);

    // Props: containers, crates, umbrellas, cranes, pond.
    for (const pr of city.props) {
      if (pr.kind === 'container') {
        box(staticGroup, 90, 26, 30, mat(['#c0392b', '#2e86c1', '#e67e22', '#16a085'][Math.floor(Math.random() * 4)]), pr.x, 13, pr.y).rotation.y = Math.random();
      } else if (pr.kind === 'crate') {
        box(staticGroup, 26, 26, 26, mat('#a67c52'), pr.x, 13, pr.y);
      } else if (pr.kind === 'umbrella') {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 30, 6), mat('#dddddd'));
        pole.position.set(pr.x, 15, pr.y);
        staticGroup.add(pole);
        const top = new THREE.Mesh(new THREE.ConeGeometry(26, 12, 8), mat('#e74c3c'));
        top.position.set(pr.x, 34, pr.y);
        top.castShadow = true;
        staticGroup.add(top);
      } else if (pr.kind === 'crane') {
        box(staticGroup, 16, 160, 16, mat('#f5c518'), pr.x, 80, pr.y);
        box(staticGroup, 180, 10, 10, mat('#f5c518'), pr.x + 60, 155, pr.y);
      } else if (pr.kind === 'pond') {
        const pond = new THREE.Mesh(new THREE.CircleGeometry(70, 24), mat('#3a9bc2'));
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(pr.x, 1, pr.y);
        staticGroup.add(pond);
      }
    }

    // Named-place signs on poles, plus landmark dressing.
    const signs = [
      [PLACES.bar, "Rosa's Bar", '#7b1e1e', '#ffe600'],
      [PLACES.safehouse, 'Safehouse', '#1e8449', '#ffffff'],
      [PLACES.hospital, 'Hospital', '#e8e8e8', '#c0392b'],
      [PLACES.station, 'Police Station', '#1a2a6c', '#ffffff'],
      [PLACES.port, 'Port Docks', '#5d6d7e', '#ffe600'],
      [PLACES.beach, 'Beachfront', '#e67e22', '#ffffff'],
      [PLACES.package, 'Package Drop', '#6c3483', '#ffffff'],
    ];
    for (const [pl, label, bg, fg] of signs) {
      const tex = textTexture(label, bg, fg);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(150, 38), new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide }));
      sign.position.set(pl.x, 95, pl.y);
      staticGroup.add(sign);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 80, 6), mat('#555555'));
      pole.position.set(pl.x, 40, pl.y);
      staticGroup.add(pole);
    }
    // Safehouse: small green house with a pitched roof.
    box(staticGroup, 110, 55, 80, mat('#2ecc71'), PLACES.safehouse.x, 27, PLACES.safehouse.y);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(75, 34, 4), mat('#8e44ad'));
    roof.position.set(PLACES.safehouse.x, 72, PLACES.safehouse.y);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    staticGroup.add(roof);
    // Bar awning.
    box(staticGroup, 120, 8, 46, mat('#c0392b'), PLACES.bar.x, 46, PLACES.bar.y - 30);
    // Hospital cross.
    box(staticGroup, 60, 14, 14, mat('#ffffff'), PLACES.hospital.x, 110, PLACES.hospital.y);
    box(staticGroup, 14, 60, 14, mat('#ffffff'), PLACES.hospital.x, 110, PLACES.hospital.y);
  }

  function buildCarMesh(car) {
    const g = new THREE.Group();
    const bodyMat = mat(car.color);
    const dark = mat('#1a2028');
    const glass = mat('#9fd8e8');
    const len = car.model === 'truck' ? 64 : car.model === 'sports' ? 48 : 46;
    const wid = car.model === 'sports' ? 24 : 22;
    const hgt = car.model === 'van' ? 20 : car.model === 'truck' ? 16 : 10;
    if (car.model === 'truck') {
      box(g, 20, 16, 20, bodyMat, 20, 12, 0);
      box(g, 40, 26, 22, mat('#d8d8d8'), -12, 17, 0);
      box(g, 18, 8, 18, glass, 20, 20, 0);
    } else if (car.model === 'van') {
      box(g, len, hgt, wid, bodyMat, 0, 12, 0);
      box(g, len * 0.7, 7, wid * 0.9, glass, -2, 24, 0);
    } else {
      box(g, len, hgt, wid, bodyMat, 0, 9, 0);
      box(g, len * 0.45, 8, wid * 0.86, glass, -3, 17, 0);
      if (car.model === 'sports') box(g, 16, 2, 22, dark, -len / 2 + 2, 16, 0);
    }
    if (car.model === 'police') {
      box(g, len * 0.9, 3, wid * 0.92, mat('#f5f5f5'), 0, 15, 0);
      const bar = new THREE.Group();
      box(bar, 6, 4, 8, new THREE.MeshLambertMaterial({ color: '#ff2222', emissive: 0xff2222, emissiveIntensity: 0.8 }), -4, 22, 0);
      box(bar, 6, 4, 8, new THREE.MeshLambertMaterial({ color: '#2244ff', emissive: 0x2244ff, emissiveIntensity: 0.8 }), 4, 22, 0);
      bar.userData.isLightBar = true;
      g.add(bar);
      g.userData.lightBar = bar;
      box(g, 20, 6, 2, mat('#ffffff'), len / 2, 8, 0);
    }
    if (car.model === 'taxi') box(g, 12, 4, 10, mat('#111111'), -2, 23, 0);
    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(6, 6, 4, 10);
    const wheelMat = mat('#111111');
    for (const [wx, wz] of [[len / 2 - 10, wid / 2], [len / 2 - 10, -wid / 2], [-len / 2 + 10, wid / 2], [-len / 2 + 10, -wid / 2]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.x = Math.PI / 2;
      w.position.set(wx, 6, wz);
      w.castShadow = true;
      g.add(w);
    }
    // Headlights and brake lights.
    box(g, 2, 4, 4, mat('#fff8c0', { emissive: 0xfff8c0, emissiveIntensity: 0.5 }), len / 2, 9, wid / 2 - 4);
    box(g, 2, 4, 4, mat('#fff8c0', { emissive: 0xfff8c0, emissiveIntensity: 0.5 }), len / 2, 9, -wid / 2 + 4);
    const brakeL = box(g, 2, 4, 5, new THREE.MeshLambertMaterial({ color: '#ff2222', emissive: 0xff2222, emissiveIntensity: 0.4 }), -len / 2, 9, wid / 2 - 4);
    const brakeR = box(g, 2, 4, 5, new THREE.MeshLambertMaterial({ color: '#ff2222', emissive: 0xff2222, emissiveIntensity: 0.4 }), -len / 2, 9, -wid / 2 + 4);
    g.userData.brake = [brakeL, brakeR];
    // Damage smoke sprite.
    const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTexture(), transparent: true, opacity: 0, depthWrite: false }));
    sm.position.set(0, 26, 0);
    sm.scale.set(46, 46, 1);
    g.add(sm);
    g.userData.smoke = sm;
    // Marked-car beacon ring (mission target car).
    if (car.marked) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(34, 3, 8, 24), mat('#ffe600', { emissive: 0xffe600, emissiveIntensity: 0.7 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 2;
      g.add(ring);
      g.userData.ring = ring;
    }
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  function buildPersonMesh(shirt, skin, isCop, isGang) {
    const g = new THREE.Group();
    const shirtMat = mat(isCop ? '#1a2a6c' : isGang ? '#a93226' : shirt);
    const legL = box(g, 7, 16, 7, mat('#222831'), -4, 8, 0);
    const legR = box(g, 7, 16, 7, mat('#222831'), 4, 8, 0);
    const torso = box(g, 18, 20, 10, shirtMat, 0, 26, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(7, 10, 8), mat(skin));
    head.position.set(0, 42, 0);
    head.castShadow = true;
    g.add(head);
    if (isCop) box(g, 16, 4, 12, mat('#0d1530'), 0, 48, 0);
    const gun = box(g, 14, 3, 3, mat('#111111'), 10, 26, 0);
    gun.visible = false;
    g.userData = { legL, legR, torso, head, gun };
    return g;
  }

  function syncPerson(g, x, y, angle, walkPhase, moving, shoot) {
    g.position.set(x, 0, y);
    g.rotation.y = -angle;
    const swing = moving ? Math.sin(walkPhase) * 0.5 : 0;
    g.userData.legL.rotation.x = swing;
    g.userData.legR.rotation.x = -swing;
    g.userData.gun.visible = !!shoot;
  }

  function render(state, screen, w, h, camYaw, camPitch, dt) {
    if (builtSeed !== state.seed) {
      // First build (or reseed): the static city is rebuilt from scratch.
      scene.remove(staticGroup);
      staticGroup = new THREE.Group();
      scene.add(staticGroup);
      dyn.clear();
      carGroups.clear();
      pedGroups.clear();
      copGroups.clear();
      playerGroup = null;
      markerGroup = null;
      bulletPool = [];
      buildStatic(state.city);
      builtSeed = state.seed;
    }
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const p = state.player;
    // --- camera ---
    if (screen === SCREEN_TITLE) {
      // Slow orbit over downtown behind the title screen.
      const t = state.time + performance.now() / 1000;
      const cx = 1600 + Math.cos(t * 0.03) * 900;
      const cz = 1200 + Math.sin(t * 0.03) * 700;
      camera.position.set(cx, 420, cz);
      camera.lookAt(1400, 60, 1000);
      sun.position.set(p.x + 600, 900, p.y - 400);
      sun.target.position.set(p.x, 0, p.y);
      renderer.render(scene, camera);
      return;
    }
    // Third-person chase camera, smoothed, kept behind the player.
    const driving = !!p.inCar;
    let targetYaw;
    let camDist;
    let camHeight;
    if (driving) {
      const car = state.cars.find((c) => c.id === p.inCar);
      targetYaw = (car ? car.angle : p.angle) + camYaw;
      camDist = 185;
      camHeight = 120;
    } else {
      targetYaw = p.angle + camYaw;
      camDist = 135;
      camHeight = 90;
    }
    let dy = targetYaw - camYawSmooth;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    camYawSmooth += dy * Math.min(1, dt * 5);
    const cp = Math.max(0.1, camPitch);
    const cd = camDist * Math.cos(cp);
    const ch = camHeight + camDist * Math.sin(cp) * 0.9;
    const wantPos = V3(p.x - Math.cos(camYawSmooth) * cd, ch, p.y - Math.sin(camYawSmooth) * cd);
    camPos.lerp(wantPos, Math.min(1, dt * 6));
    camLook.lerp(V3(p.x + Math.cos(p.angle) * 30, 22, p.y + Math.sin(p.angle) * 30), Math.min(1, dt * 8));
    camera.position.copy(camPos);
    camera.lookAt(camLook);
    sun.position.set(p.x + 500, 850, p.y - 350);
    sun.target.position.set(p.x, 0, p.y);

    // --- player ---
    if (!playerGroup) {
      playerGroup = buildPersonMesh('#16a085', '#f1c27d', false, false);
      dyn.add(playerGroup);
    }
    playerGroup.visible = !driving;
    if (!driving) syncPerson(playerGroup, p.x, p.y, p.angle, p.walkPhase, p.speed > 5, p.fireCd > 0.12 || p.punchAnim > 0);

    // --- cars ---
    const seenCars = new Set();
    for (const car of state.cars) {
      seenCars.add(car.id);
      let g = carGroups.get(car.id);
      if (!g) {
        g = buildCarMesh(car);
        carGroups.set(car.id, g);
        dyn.add(g);
      }
      g.position.set(car.x, 0, car.y);
      g.rotation.y = -car.angle;
      g.visible = !car.dead || car.driver === 'player';
      g.rotation.z = car.dead ? 0.12 : 0;
      if (car.isPolice && g.userData.lightBar) {
        const on = Math.floor(state.time * 4) % 2 === 0;
        g.userData.lightBar.children[0].material.emissiveIntensity = on ? 1.6 : 0.2;
        g.userData.lightBar.children[1].material.emissiveIntensity = on ? 0.2 : 1.6;
      }
      if (g.userData.brake) {
        const b = car.brakeLight ? 1.8 : 0.35;
        g.userData.brake[0].material.emissiveIntensity = b;
        g.userData.brake[1].material.emissiveIntensity = b;
      }
      if (g.userData.smoke) {
        g.userData.smoke.material.opacity = car.smoke ? 0.5 + 0.2 * Math.sin(state.time * 9) : 0;
        g.userData.smoke.position.y = 26 + Math.sin(state.time * 5) * 4;
      }
      if (g.userData.ring) g.userData.ring.rotation.z = state.time * 2;
    }
    for (const [id, g] of carGroups) {
      if (!seenCars.has(id)) { dyn.remove(g); carGroups.delete(id); }
    }

    // --- pedestrians ---
    const seenPeds = new Set();
    state.peds.forEach((ped, i) => {
      if (ped.hp <= 0) return;
      const key = `p${i}`;
      seenPeds.add(key);
      let g = pedGroups.get(key);
      if (!g) {
        g = buildPersonMesh(ped.shirt, ped.skin, false, false);
        pedGroups.set(key, g);
        dyn.add(g);
      }
      syncPerson(g, ped.x, ped.y, ped.angle, ped.walkPhase, ped.speed > 5, false);
    });
    for (const [k, g] of pedGroups) if (!seenPeds.has(k)) { dyn.remove(g); pedGroups.delete(k); }

    // --- cops and gang ---
    const seenCops = new Set();
    state.cops.forEach((cop, i) => {
      if (cop.hp <= 0) return;
      const key = `c${i}`;
      seenCops.add(key);
      let g = copGroups.get(key);
      if (!g) {
        g = buildPersonMesh('#a93226', '#e0ac69', cop.isCop, cop.isGang);
        copGroups.set(key, g);
        dyn.add(g);
      }
      syncPerson(g, cop.x, cop.y, cop.angle, state.time * 8, cop.speed > 5, cop.shootCd > 0.9);
    });
    for (const [k, g] of copGroups) if (!seenCops.has(k)) { dyn.remove(g); copGroups.delete(k); }

    // --- bullets as glowing tracers ---
    while (bulletPool.length < state.bullets.length) {
      const b = new THREE.Mesh(boxGeo, mat('#ffe600', { emissive: 0xffe600, emissiveIntensity: 1.4 }));
      b.castShadow = false;
      dyn.add(b);
      bulletPool.push(b);
    }
    state.bullets.forEach((b, i) => {
      const m = bulletPool[i];
      m.visible = true;
      m.position.set(b.x, 24, b.y);
      m.scale.set(34, 2, 2);
      m.rotation.y = -Math.atan2(b.vy, b.vx);
    });
    for (let i = state.bullets.length; i < bulletPool.length; i += 1) bulletPool[i].visible = false;

    // --- objective marker: pulsing ring with a bobbing diamond ---
    if (!markerGroup) {
      markerGroup = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(46, 4, 8, 32), mat('#ffe600', { emissive: 0xffe600, emissiveIntensity: 0.9 }));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 3;
      markerGroup.add(ring);
      const dia = new THREE.Mesh(new THREE.OctahedronGeometry(16), mat('#ffe600', { emissive: 0xffaa00, emissiveIntensity: 1 }));
      dia.position.y = 70;
      markerGroup.add(dia);
      markerGroup.userData.dia = dia;
      dyn.add(markerGroup);
    }
    const obj = state.objective;
    if (obj && obj.x) {
      markerGroup.visible = true;
      markerGroup.position.set(obj.x, 0, obj.y);
      markerGroup.userData.dia.position.y = 70 + Math.sin(state.time * 3) * 10;
      markerGroup.userData.dia.rotation.y = state.time * 2;
      markerGroup.scale.setScalar(1 + 0.08 * Math.sin(state.time * 4));
    } else markerGroup.visible = false;

    // --- muzzle flash light ---
    if (!muzzle) {
      muzzle = new THREE.PointLight(0xffcc66, 0, 220);
      dyn.add(muzzle);
    }
    muzzle.intensity = (!driving && p.fireCd > 0.14) ? 60 : 0;
    if (muzzle.intensity) muzzle.position.set(p.x + Math.cos(p.angle) * 30, 26, p.y + Math.sin(p.angle) * 30);

    renderer.render(scene, camera);
  }

  function dispose() { renderer.dispose(); }

  return { render, dispose, scene, camera, renderer };
}
