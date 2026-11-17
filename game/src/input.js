// input.js — keadaan keyboard + mouse. Bisa dibuat tanpa elemen DOM
// (untuk harness uji): method setKey dipakai mensimulasikan tombol.

export function createInput(el) {
  const keys = new Set();
  const pressed = new Set(); // tombol yang baru ditekan frame ini
  const mouse = { x: 0, y: 0, down: false, clicked: false };

  const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

  function onKeyDown(e) {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) pressed.add(e.code);
    keys.add(e.code);
  }
  function onKeyUp(e) { keys.delete(e.code); }
  function onMouseMove(e) {
    const r = el.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  }
  function onMouseDown(e) { mouse.down = true; mouse.clicked = true; onMouseMove(e); }
  function onMouseUp() { mouse.down = false; }
  function onBlur() { keys.clear(); mouse.down = false; }

  if (el && typeof window !== 'undefined') {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    el.addEventListener('mousemove', onMouseMove);
    el.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
  }

  return {
    keys, mouse,
    down(code) { return keys.has(code); },
    justPressed(code) { return pressed.has(code); },
    // sumbu gerak gabungan WASD + panah, ternormalisasi
    axis() {
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) { const s = Math.SQRT1_2; x *= s; y *= s; }
      return { x, y };
    },
    setKey(code, isDown) {
      if (isDown) { if (!keys.has(code)) pressed.add(code); keys.add(code); }
      else keys.delete(code);
    },
    // dipanggil di akhir tiap langkah simulasi
    endStep() { pressed.clear(); mouse.clicked = false; },
  };
}
