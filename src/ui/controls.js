/**
 * Mouse, trackpad and touch handling on the 3D canvas.
 *
 *  Desktop  left-drag: orbit · right-drag (or ctrl/⌘-drag): pan · scroll / pinch: zoom · click: switches
 *  Touch    one finger: joystick (appears under your thumb; push far to run)
 *           two fingers: pinch to zoom, drag to orbit · tap: switches
 */
const JOY_RADIUS = 58;
const RUN_AT = 0.9; // push the knob this far (0-1) to run
const TAP_SLOP = 9;
const TAP_TIME = 380;

export function setupControls(canvas, { rig, input, joystickEl, onTap, onHover }) {
  const pointers = new Map();
  let mouseMode = null;
  let joyId = null;
  let joyOrigin = null;
  let gesture = null;
  let suppressJoystick = false;

  const base = joystickEl.querySelector('[data-joystick-base]');
  const knob = joystickEl.querySelector('[data-joystick-knob]');

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    try {
      canvas.setPointerCapture(e.pointerId); // keep dragging even if the pointer leaves the canvas
    } catch {
      /* some browsers refuse capture for secondary touches; that's fine */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), type: e.pointerType });

    if (e.pointerType === 'mouse') {
      mouseMode = e.button === 2 || e.button === 1 || e.ctrlKey || e.metaKey ? 'pan' : 'orbit';
      canvas.classList.add('is-dragging');
      return;
    }

    const touches = [...pointers.values()].filter((p) => p.type !== 'mouse');
    if (touches.length === 1 && !suppressJoystick && input.enabled) {
      startJoystick(e);
    } else if (touches.length >= 2) {
      stopJoystick();
      suppressJoystick = true; // don't let the leftover finger turn into a joystick
      gesture = measure();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) {
      if (e.pointerType === 'mouse') onHover?.(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    const h = canvas.clientHeight || window.innerHeight;

    if (e.pointerType === 'mouse') {
      if (mouseMode === 'orbit') rig.orbit(dx, dy, h);
      else if (mouseMode === 'pan') rig.panBy(dx, dy, h);
      return;
    }
    if (e.pointerId === joyId) {
      moveJoystick(e.clientX, e.clientY);
    } else if (gesture && pointers.size >= 2) {
      const now = measure();
      if (now.dist > 0 && gesture.dist > 0) rig.zoom(gesture.dist / now.dist);
      rig.orbit(now.mx - gesture.mx, now.my - gesture.my, h);
      gesture = now;
    }
  });

  const release = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    const moved = Math.hypot(e.clientX - p.sx, e.clientY - p.sy);
    const quick = performance.now() - p.t < TAP_TIME;
    if (e.type === 'pointerup' && moved < TAP_SLOP && quick && !gesture) onTap?.(e.clientX, e.clientY);

    if (e.pointerId === joyId) stopJoystick();
    if (pointers.size < 2) gesture = null;
    if (!pointers.size) {
      suppressJoystick = false;
      mouseMode = null;
      canvas.classList.remove('is-dragging');
    }
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('lostpointercapture', release);

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= window.innerHeight;
      // trackpad pinch arrives as ctrl + wheel with small deltas
      rig.zoom(Math.exp(dy * (e.ctrlKey ? 0.012 : 0.0012)));
    },
    { passive: false },
  );

  function measure() {
    const [a, b] = [...pointers.values()];
    if (!a || !b) return { dist: 0, mx: 0, my: 0 };
    return { dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
  }

  function startJoystick(e) {
    joyId = e.pointerId;
    joyOrigin = { x: e.clientX, y: e.clientY };
    joystickEl.classList.add('is-active');
    base.style.transform = `translate(${joyOrigin.x}px, ${joyOrigin.y}px)`;
    knob.style.transform = 'translate(0px, 0px)';
    input.joystick.active = true;
    input.joystick.x = input.joystick.y = 0;
    input.joystick.run = false;
  }

  function moveJoystick(x, y) {
    let dx = x - joyOrigin.x;
    let dy = y - joyOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len > JOY_RADIUS) {
      dx = (dx / len) * JOY_RADIUS;
      dy = (dy / len) * JOY_RADIUS;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const nx = dx / JOY_RADIUS;
    const ny = -dy / JOY_RADIUS;
    const mag = Math.hypot(nx, ny);
    const live = mag < 0.15 ? 0 : (mag - 0.15) / 0.85; // dead zone
    input.joystick.x = mag ? (nx / mag) * live : 0;
    input.joystick.y = mag ? (ny / mag) * live : 0;
    input.joystick.run = live > RUN_AT;
    joystickEl.classList.toggle('is-running', input.joystick.run);
  }

  function stopJoystick() {
    if (joyId === null) return;
    joyId = null;
    input.joystick.active = false;
    input.joystick.x = input.joystick.y = 0;
    input.joystick.run = false;
    joystickEl.classList.remove('is-active', 'is-running');
    base.style.transform = '';
    knob.style.transform = '';
  }

  return { stopJoystick };
}
