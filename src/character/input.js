/**
 * Movement input from the keyboard (WASD / arrows, Shift to run) and the
 * on-screen joystick. Read `input.move` once per frame.
 */
const KEYS = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
};
const MOVE_CODES = new Set(Object.values(KEYS).flat());

export class Input {
  constructor() {
    this.pressed = new Set();
    this.shift = false;
    this.enabled = false;
    this.joystick = { x: 0, y: 0, active: false };
    this.move = { x: 0, y: 0, run: false, magnitude: 0 };

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => document.hidden && this.clear());
  }

  onKey(e, down) {
    this.shift = e.shiftKey;
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.shift = down;
    if (!MOVE_CODES.has(e.code)) return;
    // don't hijack keys while typing in a field or using a focused button
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    e.preventDefault();
    if (down) this.pressed.add(e.code);
    else this.pressed.delete(e.code);
  }

  clear() {
    this.pressed.clear();
    this.shift = false;
    this.joystick.x = this.joystick.y = 0;
    this.joystick.active = false;
  }

  has(name) {
    return KEYS[name].some((code) => this.pressed.has(code));
  }

  /** Call once per frame. x = right, y = forward (screen-relative), both -1..1. */
  update() {
    let x = 0;
    let y = 0;
    let run = this.shift;
    if (this.enabled) {
      if (this.has('forward')) y += 1;
      if (this.has('back')) y -= 1;
      if (this.has('right')) x += 1;
      if (this.has('left')) x -= 1;
      if (this.joystick.active) {
        x += this.joystick.x;
        y += this.joystick.y;
        run = run || this.joystick.run;
      }
    }
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.move.x = x;
    this.move.y = y;
    this.move.magnitude = Math.min(1, len);
    this.move.run = run && len > 0.05;
    return this.move;
  }
}
