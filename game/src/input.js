// Keyboard and mouse input for Langit Nusantara: arrows and WASD fly the
// aircraft, W/S work the throttle, Space is the airbrake, and the mouse can
// pick a mission on the title screen.
export function makeInput() {
  return {
    keys: new Set(),
    pressed: new Set(),
    mouseX: 0,
    mouseY: 0,
    clicked: false,
  };
}

export function attachInput(input, canvas, onKey) {
  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      input.pressed.add(event.key.toLowerCase());
      if (onKey) onKey(event.key.toLowerCase());
    }
    input.keys.add(event.key.toLowerCase());
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.key.toLowerCase());
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
    input.clicked = true;
  });
  window.addEventListener('blur', () => input.keys.clear());
}

/** Continuous flight controls from the held keys, -1..1 each. */
export function readFlightInput(input) {
  const left = input.keys.has('arrowleft') || input.keys.has('a');
  const right = input.keys.has('arrowright') || input.keys.has('d');
  const up = input.keys.has('arrowup');
  const down = input.keys.has('arrowdown');
  const throttleUp = input.keys.has('w');
  const throttleDown = input.keys.has('s');
  return {
    roll: (left ? -1 : 0) + (right ? 1 : 0),
    pitch: (up ? -1 : 0) + (down ? 1 : 0),
    throttle: (throttleUp ? 1 : 0) + (throttleDown ? -1 : 0),
    brake: input.keys.has(' '),
  };
}

/** True once for each key press; call after the frame has read it. */
export function wasPressed(input, key) {
  return input.pressed.has(key.toLowerCase());
}

export function clearPressed(input) {
  input.pressed.clear();
  input.clicked = false;
}
