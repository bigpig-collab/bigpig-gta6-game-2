// Keyboard + mouse input. Keys are tracked by code and read back as a plain
// snapshot each frame; dragging the mouse orbits the chase camera.
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    up: false, down: false, left: false, right: false,
    run: false, interact: false, punch: false, shoot: false,
    brake: false, pause: false,
    mouseX: 0, mouseY: 0, mouseDown: false,
    camYaw: 0, camPitch: 0.32,
    pressed: new Set(),
  };
  function refresh() {
    input.up = keys.has('KeyW') || keys.has('ArrowUp');
    input.down = keys.has('KeyS') || keys.has('ArrowDown');
    input.left = keys.has('KeyA') || keys.has('ArrowLeft');
    input.right = keys.has('KeyD') || keys.has('ArrowRight');
    input.run = keys.has('ShiftLeft') || keys.has('ShiftRight');
    input.brake = keys.has('Space');
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    keys.add(e.code);
    refresh();
  });
  window.addEventListener('keyup', (e) => { keys.delete(e.code); refresh(); });
  window.addEventListener('blur', () => { keys.clear(); refresh(); });
  let dragging = false;
  let lastX = 0; let lastY = 0;
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouseX = e.clientX - r.left;
    input.mouseY = e.clientY - r.top;
    if (dragging) {
      input.camYaw -= (e.clientX - lastX) * 0.005;
      input.camPitch += (e.clientY - lastY) * 0.003;
      input.camPitch = Math.max(0.08, Math.min(1.1, input.camPitch));
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      input.mouseDown = true;
      input.pressed.add('Mouse0');
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    }
  });
  window.addEventListener('mouseup', () => { input.mouseDown = false; dragging = false; });
  input.consume = (code) => {
    if (input.pressed.has(code)) { input.pressed.delete(code); return true; }
    return false;
  };
  input.endFrame = () => { input.pressed.clear(); };
  return input;
}

// A scripted input for the screenshot autopilot: same shape as live input,
// driven by shots.js instead of the keyboard.
export function scriptedInput() {
  return {
    up: false, down: false, left: false, right: false,
    run: false, interact: false, punch: false, shoot: false,
    brake: false, pause: false,
    mouseX: 0, mouseY: 0, mouseDown: false,
    camYaw: 0, camPitch: 0.32,
    pressed: new Set(),
    consume: () => false,
    endFrame: () => {},
  };
}
