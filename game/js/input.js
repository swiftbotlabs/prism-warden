// Keyboard and mouse state in arena coordinates: held keys, one-shot presses, cursor, left button and wheel.
const GAME_KEYS = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Digit1', 'Digit2', 'Digit3', 'KeyP', 'KeyM', 'KeyR', 'Escape', 'Space', 'Enter',
]);

/** Listens on `canvas` and the window; `toArena(clientX, clientY)` maps page pixels to arena units. */
export function createInput(canvas, toArena) {
  const input = {
    keys: new Set(),
    presses: [],
    mouseX: 900,
    mouseY: 300,
    mouseDown: false,
    clicks: 0,
    wheel: 0,
  };

  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    if (!event.repeat) input.presses.push(event.code);
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => input.keys.delete(event.code));
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  const trackPointer = (event) => {
    const point = toArena(event.clientX, event.clientY);
    input.mouseX = point.x;
    input.mouseY = point.y;
  };
  canvas.addEventListener('pointermove', trackPointer);
  canvas.addEventListener('pointerdown', (event) => {
    trackPointer(event);
    if (event.button !== 0) return;
    input.mouseDown = true;
    input.clicks += 1;
    canvas.setPointerCapture?.(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    input.wheel += Math.sign(event.deltaY);
  }, { passive: false });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  return input;
}

/** Key codes pressed since the last call, oldest first. */
export function takePresses(input) {
  const presses = input.presses;
  input.presses = [];
  return presses;
}

/** Left clicks since the last call. */
export function takeClicks(input) {
  const clicks = input.clicks;
  input.clicks = 0;
  return clicks;
}

/** Wheel notches since the last call (positive = down). */
export function takeWheel(input) {
  const wheel = input.wheel;
  input.wheel = 0;
  return wheel;
}

/** WASD / arrow movement as a vector of length 0 or 1. */
export function movementAxes(input) {
  const keys = input.keys;
  let x = 0;
  let y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  const length = Math.hypot(x, y);
  return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 };
}
