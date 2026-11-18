// DOM HUD + live 2D minimap (top-down canvas): roads, districts,
// building dots, safehouse, pulsing mission blip, police/gang blips,
// player dot with ring. All text updates are cheap string writes.
import { WORLD_W, WORLD_H, CAR_MODELS } from './config.js';
import { ROAD_XS, ROAD_YS } from './city.js';
import { wantedLabel } from './police.js';
import { PLACES } from './config.js';

export function createHud() {
  return {
    stars: document.getElementById('hud-stars'),
    healthFill: document.getElementById('hud-health-fill'),
    healthText: document.getElementById('hud-health-text'),
    money: document.getElementById('hud-money'),
    ammo: document.getElementById('hud-ammo'),
    speed: document.getElementById('hud-speed'),
    objective: document.getElementById('hud-objective'),
    message: document.getElementById('hud-message'),
    dialogue: document.getElementById('hud-dialogue'),
    banner: document.getElementById('hud-banner'),
    minimap: document.getElementById('minimap'),
    status: document.getElementById('status'),
  };
}

export function updateHud(hud, state) {
  const p = state.player;
  hud.stars.textContent = wantedLabel(state.wanted);
  hud.stars.style.color = state.wanted > 0 ? '#ff5b5b' : '#fff';
  hud.healthFill.style.width = `${Math.max(0, p.hp)}%`;
  hud.healthFill.style.background = p.hp > 50 ? '#2ecc71' : p.hp > 25 ? '#f39c12' : '#e74c3c';
  hud.healthText.textContent = `HP ${Math.ceil(p.hp)}`;
  hud.money.textContent = `$${p.money}`;
  hud.ammo.textContent = p.inCar ? '' : `Ammo ${p.ammo}  ·  F punch`;
  const car = p.inCar ? state.cars.find((c) => c.id === p.inCar) : null;
  hud.speed.textContent = car
    ? `${CAR_MODELS[car.model].name} · ${Math.round(Math.abs(car.speed) * 0.55)} km/h${car.hp < car.maxHp * 0.4 ? ' · SMOKING' : ''}`
    : '';
  hud.objective.textContent = `◆ ${state.objective.label || 'Free roam'}`;
  hud.message.textContent = state.messageTimer > 0 ? state.message : '';
  if (state.dialogueTimer > 0) {
    hud.dialogue.style.display = 'block';
    hud.dialogue.textContent = state.dialogue;
  } else hud.dialogue.style.display = 'none';
  if (state.bannerTimer > 0) {
    hud.banner.style.display = 'block';
    hud.banner.textContent = state.banner;
  } else hud.banner.style.display = 'none';
  drawMinimap(hud.minimap, state);
  hud.status.textContent = `${state.objective.label || ''} Wanted ${state.wanted} HP ${Math.ceil(p.hp)} $${p.money}`;
}

function drawMinimap(canvas, state) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width; const h = canvas.height;
  const sx = w / WORLD_W; const sy = h / WORLD_H;
  ctx.fillStyle = '#1d3a24'; ctx.fillRect(0, 0, w, h);
  // Beach + sea.
  ctx.fillStyle = '#e8d29a'; ctx.fillRect(2780 * sx, 0, (WORLD_W - 2780) * sx, h);
  ctx.fillStyle = '#2e86c1'; ctx.fillRect(3050 * sx, 0, (WORLD_W - 3050) * sx, h);
  // Port.
  ctx.fillStyle = '#5d6d7e'; ctx.fillRect(0, 1950 * sy, w, (WORLD_H - 1950) * sy);
  // Park.
  ctx.fillStyle = '#2e7d32'; ctx.fillRect(600 * sx, 1400 * sy, 400 * sx, 400 * sy);
  // Roads.
  ctx.fillStyle = '#3b4048';
  for (const rx of ROAD_XS) ctx.fillRect((rx - 48) * sx, 0, 96 * sx, h);
  for (const ry of ROAD_YS) ctx.fillRect(0, (ry - 48) * sy, w, 96 * sy);
  // Buildings.
  ctx.fillStyle = '#9aa0a6';
  for (const b of state.city.buildings) ctx.fillRect(b.x * sx, b.y * sy, Math.max(2, b.w * sx), Math.max(2, b.h * sy));
  // Safehouse.
  ctx.fillStyle = '#2ecc71';
  ctx.fillRect((PLACES.safehouse.x - 14) * sx, (PLACES.safehouse.y - 14) * sy, 28 * sx + 3, 28 * sy + 3);
  // Mission blip (pulsing yellow).
  if (state.objective.x) {
    const r = 5 + 2.5 * Math.sin(state.time * 5);
    ctx.fillStyle = '#ffe600';
    ctx.beginPath(); ctx.arc(state.objective.x * sx, state.objective.y * sy, r, 0, Math.PI * 2); ctx.fill();
  }
  // Police (red) and gang (orange) blips.
  ctx.fillStyle = '#ff2222';
  for (const car of state.cars) if (car.isPolice && !car.dead) {
    ctx.beginPath(); ctx.arc(car.x * sx, car.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff7b00';
  for (const cop of state.cops) if (cop.hp > 0) {
    ctx.beginPath(); ctx.arc(cop.x * sx, cop.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  // Player dot with ring.
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(state.player.x * sx, state.player.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(state.player.x * sx, state.player.y * sy, 3, 0, Math.PI * 2); ctx.fill();
}
