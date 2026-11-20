// All sound is synthesized with WebAudio — no audio files. Engine hum and
// siren are continuous oscillators; everything else is a short blip or a
// burst of filtered noise. The radio is a tiny synthwave loop on a timer.
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let radioTimer = null;
let radioStep = 0;

export function isMuted() { return muted; }

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  } catch (e) { ctx = null; }
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type || 'square';
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol || 0.15, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noiseBurst(dur, vol, low) {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = low || 1200;
  const g = ctx.createGain();
  g.gain.value = vol || 0.4;
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(t);
}

export const sfx = {
  shoot() { noiseBurst(0.12, 0.5, 2600); blip(180, 0.08, 'square', 0.2, 60); },
  punch() { noiseBurst(0.08, 0.3, 500); },
  pickup() { blip(660, 0.09, 'sine', 0.2); setTimeout(() => blip(990, 0.12, 'sine', 0.2), 70); },
  cash() { blip(880, 0.08, 'sine', 0.2); setTimeout(() => blip(1320, 0.16, 'sine', 0.2), 80); },
  hurt() { blip(140, 0.18, 'sawtooth', 0.25, 70); },
  busted() { blip(220, 0.5, 'sawtooth', 0.25, 110); },
  mission() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'sine', 0.22), i * 110)); },
  door() { noiseBurst(0.1, 0.2, 900); },
  crash() { noiseBurst(0.25, 0.45, 700); },
};

// Called every frame: engine pitch follows speed, siren wails at 2+ stars.
export function updateAudio(speedFrac, wanted, driving) {
  if (!ctx) return;
  const t = ctx.currentTime;
  if (engineGain) {
    engineGain.gain.setTargetAtTime(driving ? 0.05 + speedFrac * 0.09 : 0.0, t, 0.08);
    engineOsc.frequency.setTargetAtTime(50 + speedFrac * 130, t, 0.08);
  }
  if (sirenGain) {
    const on = wanted >= 2;
    sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, t, 0.2);
    if (on) sirenOsc.frequency.setTargetAtTime(650 + 250 * Math.sin(t * 3.2), t, 0.05);
  }
}

// Synthwave loop: bass note plus an arpeggio, one step per tick.
const BASS = [55, 55, 65.4, 49];
const ARP = [220, 261.6, 329.6, 392, 329.6, 261.6];
export function startRadio() {
  ensureAudio();
  if (!ctx || radioTimer) return;
  radioTimer = setInterval(() => {
    if (muted || !ctx) return;
    const bar = Math.floor(radioStep / 8) % 4;
    const step = radioStep % 8;
    if (step % 2 === 0) blip(BASS[bar], 0.22, 'triangle', 0.16);
    if (step % 2 === 1) blip(ARP[(radioStep * 7) % ARP.length], 0.12, 'square', 0.05);
    radioStep += 1;
  }, 150);
}
export function stopRadio() {
  if (radioTimer) { clearInterval(radioTimer); radioTimer = null; }
}
