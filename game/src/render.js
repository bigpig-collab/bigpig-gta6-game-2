// Renderer, lights, sky and the chase camera for Solmar City.
import * as THREE from 'three';
import { WORLD } from './config.js';
import { clamp, lerp } from './random.js';

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87bfe8);
  scene.fog = new THREE.Fog(0x9ec8e8, 900, 2600);
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.6);
  sun.position.set(600, 900, 300);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -900; sun.shadow.camera.right = 900;
  sun.shadow.camera.top = 900; sun.shadow.camera.bottom = -900;
  sun.shadow.camera.far = 2600;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6a8f5a, 1.1);
  scene.add(hemi);
  const camera = new THREE.PerspectiveCamera(62, 16 / 10, 0.5, 4000);
  return { renderer, scene, camera, sun };
}
export function resizeRenderer(renderer, camera, w, h) {
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
// Chase camera: behind and above the target, smoothed; drag orbit adds yaw.
export function updateCamera(camera, target, camYaw, camPitch, inCar, speed, dt) {
  const dist = inCar ? 13 + Math.abs(speed) * 0.012 : 10;
  const height = inCar ? 5.2 : 4.6;
  const px = clamp(camPitch, -0.15, 0.55);
  const tx = target.x - Math.sin(camYaw) * dist * Math.cos(px);
  const tz = target.z - Math.cos(camYaw) * dist * Math.cos(px);
  const ty = target.y + height + Math.sin(px) * dist;
  const k = 1 - Math.pow(0.0001, dt); // frame-rate independent smoothing
  camera.position.x = lerp(camera.position.x, tx, k);
  camera.position.y = lerp(camera.position.y, ty, k);
  camera.position.z = lerp(camera.position.z, tz, k);
  camera.lookAt(target.x, target.y + 1.6, target.z);
  // Keep the camera inside the world so it never clips past the edge.
  camera.position.x = clamp(camera.position.x, -WORLD.halfW - 60, WORLD.halfW + 60);
  camera.position.z = clamp(camera.position.z, -WORLD.halfH - 60, WORLD.halfH + 60);
  camera.position.y = Math.max(camera.position.y, 2.5);
}
// Snap the camera to its chase position at once (no smoothing): used
// after a staged shot is applied so the first frames are already framed.
export function snapCamera(camera, target, camYaw, camPitch, inCar, speed) {
  updateCamera(camera, target, camYaw, camPitch, inCar, speed, 10);
  camera.position.x = target.x - Math.sin(camYaw) * (inCar ? 13 + Math.abs(speed) * 0.012 : 10) * Math.cos(clamp(camPitch, -0.15, 0.55));
  camera.position.z = target.z - Math.cos(camYaw) * (inCar ? 13 + Math.abs(speed) * 0.012 : 10) * Math.cos(clamp(camPitch, -0.15, 0.55));
  camera.position.y = target.y + (inCar ? 5.2 : 4.6) + Math.sin(clamp(camPitch, -0.15, 0.55)) * (inCar ? 13 + Math.abs(speed) * 0.012 : 10);
  camera.lookAt(target.x, target.y + 1.6, target.z);
}
