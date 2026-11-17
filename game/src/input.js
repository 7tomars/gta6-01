// Keyboard and mouse state for the game: held movement keys, one-shot action
// edges (interact, pause, confirm, punch), and the mouse position for aiming.

export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_CONFIRM = 4;
export const ACTION_PUNCH = 8;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

/** Create the input tracker bound to a canvas; call dispose() to unbind. */
export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  function onKeyDown(event) {
    const name = KEYMAP[event.code];
    if (name) { held[name] = true; event.preventDefault(); }
    if (event.repeat) return;
    if (event.code === 'KeyE' || event.code === 'KeyF') actions |= ACTION_INTERACT;
    if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACTION_PAUSE;
    if (event.code === 'Enter' || event.code === 'Space') actions |= ACTION_CONFIRM;
    if (event.code === 'Space') actions |= ACTION_PUNCH;
  }
  function onKeyUp(event) {
    const name = KEYMAP[event.code];
    if (name) held[name] = false;
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse.x = event.clientX - rect.left;
    mouse.y = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    if (event.button === 0) { mouse.down = true; mouse.clicked = true; }
  }
  function onMouseUp(event) {
    if (event.button === 0) mouse.down = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);

  return {
    held,
    mouse,
    /** Movement vector from held keys, normalised, in screen space. */
    moveVector() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Read and clear the one-shot action edges gathered since the last call. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Read and clear the mouse click edge. */
    takeClick() {
      const clicked = mouse.clicked;
      mouse.clicked = false;
      return clicked;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mouseup', onMouseUp);
    },
  };
}
