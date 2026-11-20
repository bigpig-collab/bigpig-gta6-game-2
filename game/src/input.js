// Keyboard and mouse input for Solmar City. Tracks held keys, drag orbit
// and clicks; the game loop reads the state each frame.
export function makeInput() {
  return {
    keys: new Set(),
    mouseDown: false, clicked: false, clickX: 0, clickY: 0,
    dragDX: 0, dragDY: 0, dragging: false,
    lastX: 0, lastY: 0,
    paused: false,
  };
}
export function bindInput(input, el) {
  const keyMap = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    ShiftLeft: 'run', ShiftRight: 'run', Space: 'hand',
    KeyF: 'punch', KeyE: 'enter', KeyM: 'mute', KeyR: 'radio',
  };
  window.addEventListener('keydown', (e) => {
    const name = keyMap[e.code];
    if (name) { input.keys.add(name); if (name === 'hand' || name === 'punch') e.preventDefault(); }
    if (e.code === 'Enter') input.keys.add('start');
    if (e.code === 'Escape' || e.code === 'KeyP') input.keys.add('pause');
  });
  window.addEventListener('keyup', (e) => {
    const name = keyMap[e.code];
    if (name) input.keys.delete(name);
    if (e.code === 'Enter') input.keys.delete('start');
    if (e.code === 'Escape' || e.code === 'KeyP') input.keys.delete('pause');
  });
  el.addEventListener('mousedown', (e) => {
    input.mouseDown = true; input.dragging = true;
    input.lastX = e.clientX; input.lastY = e.clientY;
  });
  window.addEventListener('mouseup', (e) => {
    input.mouseDown = false; input.dragging = false;
    // A short click (not a drag) fires the pistol.
    if (Math.hypot(e.clientX - input.lastX, e.clientY - input.lastY) < 6) {
      input.clicked = true; input.clickX = e.clientX; input.clickY = e.clientY;
    }
  });
  window.addEventListener('mousemove', (e) => {
    if (!input.dragging) return;
    input.dragDX += e.clientX - input.lastX;
    input.dragDY += e.clientY - input.lastY;
    input.lastX = e.clientX; input.lastY = e.clientY;
  });
  window.addEventListener('blur', () => input.keys.clear());
}
export function driveInput(input) {
  return {
    throttle: (input.keys.has('up') ? 1 : 0) - (input.keys.has('down') ? 0.4 : 0),
    brake: input.keys.has('down') ? 1 : 0,
    steer: (input.keys.has('left') ? -1 : 0) + (input.keys.has('right') ? 1 : 0),
    hand: input.keys.has('hand') ? 1 : 0,
  };
}
export function walkInput(input) {
  return {
    fwd: (input.keys.has('up') ? 1 : 0) - (input.keys.has('down') ? 1 : 0),
    strafe: (input.keys.has('right') ? 1 : 0) - (input.keys.has('left') ? 1 : 0),
    run: input.keys.has('run') ? 1 : 0,
  };
}
export function consumeClick(input) {
  if (!input.clicked) return null;
  input.clicked = false;
  return { x: input.clickX, y: input.clickY };
}
// Take a one-shot key out of the set and say whether it was pressed.
export function consumeKey(input, name) {
  if (!input.keys.has(name)) return false;
  input.keys.delete(name);
  return true;
}
