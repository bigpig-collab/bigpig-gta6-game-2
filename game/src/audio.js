// Synthesised sound for Solmar City: Web Audio only, no audio files.
// Engine hum follows speed, the radio cycles simple tunes, and every
// action has a small effect. M toggles mute.
export function makeAudio() {
  return {
    ctx: null, master: null, muted: false, engineOsc: null, engineGain: null,
    radioTimer: 0, radioStep: 0, radioTune: 0, radioOn: false,
  };
}
function ensure(a) {
  if (a.ctx) return true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    a.ctx = new AC();
    a.master = a.ctx.createGain();
    a.master.gain.value = 0.5;
    a.master.connect(a.ctx.destination);
    a.engineOsc = a.ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 60;
    a.engineGain = a.ctx.createGain();
    a.engineGain.gain.value = 0;
    const filt = a.ctx.createBiquadFilter();
    filt.type = 'lowpass'; filt.frequency.value = 700;
    a.engineOsc.connect(filt); filt.connect(a.engineGain); a.engineGain.connect(a.master);
    a.engineOsc.start();
  } catch { return false; }
  return true;
}
export function resumeAudio(a) { if (ensure(a) && a.ctx.state === 'suspended') a.ctx.resume(); }
export function setMuted(a, m) {
  a.muted = m;
  if (a.master) a.master.gain.value = m ? 0 : 0.5;
}
// Cycle the radio to the next tune (R key).
export function setRadioTune(a, i) {
  a.radioTune = i % TUNES.length;
  a.radioStep = 0;
}
function tone(a, freq, dur, type, vol, when = 0) {
  if (!ensure(a) || a.muted) return;
  const t0 = a.ctx.currentTime + when;
  const o = a.ctx.createOscillator(), g = a.ctx.createGain();
  o.type = type || 'square'; o.frequency.value = freq;
  g.gain.setValueAtTime(vol || 0.15, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  o.connect(g); g.connect(a.master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
export function sfx(a, name) {
  if (!ensure(a) || a.muted) return;
  switch (name) {
    case 'shoot': tone(a, 900, 0.12, 'square', 0.25); tone(a, 180, 0.1, 'sawtooth', 0.2); break;
    case 'punch': tone(a, 120, 0.1, 'sine', 0.3); break;
    case 'hit': tone(a, 220, 0.08, 'square', 0.15); break;
    case 'enter': tone(a, 440, 0.08, 'sine', 0.15); tone(a, 660, 0.1, 'sine', 0.15, 0.07); break;
    case 'crash': tone(a, 90, 0.25, 'sawtooth', 0.3); tone(a, 60, 0.3, 'square', 0.2); break;
    case 'pickup': tone(a, 880, 0.1, 'sine', 0.2); tone(a, 1320, 0.15, 'sine', 0.2, 0.09); break;
    case 'siren': tone(a, 700, 0.4, 'sine', 0.08); tone(a, 950, 0.4, 'sine', 0.08, 0.4); break;
    case 'mission': [523, 659, 784, 1046].forEach((f, i) => tone(a, f, 0.22, 'triangle', 0.22, i * 0.11)); break;
    case 'fail': [400, 300, 200].forEach((f, i) => tone(a, f, 0.25, 'sawtooth', 0.15, i * 0.14)); break;
    case 'save': tone(a, 660, 0.12, 'sine', 0.18); tone(a, 990, 0.18, 'sine', 0.18, 0.1); break;
    default: break;
  }
}
export function updateEngine(a, speed, inCar, dt) {
  if (!ensure(a)) return;
  const target = inCar ? 0.05 + Math.min(0.22, Math.abs(speed) / 470 * 0.22) : 0;
  a.engineGain.gain.value += (target - a.engineGain.gain.value) * Math.min(1, dt * 6);
  a.engineOsc.frequency.value = 55 + Math.abs(speed) * 0.55;
}
// The radio: three tiny chord loops, one note every 0.28 s.
const TUNES = [
  [262, 330, 392, 494, 392, 330],
  [294, 370, 440, 554, 440, 370],
  [220, 277, 330, 415, 330, 277],
];
export function updateRadio(a, dt) {
  if (!ensure(a) || a.muted || !a.radioOn) return;
  a.radioTimer += dt;
  if (a.radioTimer >= 0.28) {
    a.radioTimer = 0;
    const tune = TUNES[a.radioTune % TUNES.length];
    const note = tune[a.radioStep % tune.length];
    tone(a, note, 0.26, 'triangle', 0.07);
    a.radioStep += 1;
    if (a.radioStep % tune.length === 0 && a.radioStep % (tune.length * 4) === 0) a.radioTune += 1;
  }
}
