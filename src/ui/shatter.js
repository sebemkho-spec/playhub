/**
 * The 'plain' loading page breaking open (theme.js → page.loader.style = 'plain').
 *
 *   1. glitch  (0–0.42 s)   the page stutters, the title splits into colour, and slits of
 *                           the world behind flicker through
 *   2. crack   (0.42 s)     cracks shoot out from where you clicked, like glass
 *   3. shatter (0.64 s)     the page breaks into pieces that tumble away, revealing the world
 *
 * The 3D world is already running underneath (the intro starts on the click), so the
 * island is rising out of the sea as the pieces fall.
 */

const GLITCH = 420;
const CRACK = 220; // the crack has this long to spread before the page breaks

const rand = (a, b) => a + Math.random() * (b - a);
const svg = (tag, attrs = {}) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/** A spider-web crack around (cx, cy): rays out to the edges, joined by rings. */
function crackWeb(cx, cy, w, h, small) {
  const reach = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy)); // to the farthest corner
  const rays = small ? 8 : 11;
  const rings = [0.07, 0.17, 0.32, 0.52, 0.8, 1.6];
  const turn = rand(0, Math.PI * 2);
  const angles = Array.from({ length: rays }, (_, k) => turn + ((k + rand(-0.35, 0.35)) / rays) * Math.PI * 2);
  const points = angles.map((a) =>
    rings.map((r) => {
      const wobble = a + rand(-0.07, 0.07);
      const d = r * reach * rand(0.85, 1.15);
      return [cx + Math.cos(wobble) * d, cy + Math.sin(wobble) * d];
    }),
  );
  const cells = [];
  for (let k = 0; k < rays; k++) {
    const next = (k + 1) % rays;
    cells.push([[cx, cy], points[k][0], points[next][0]]);
    for (let j = 0; j < rings.length - 1; j++) cells.push([points[k][j], points[k][j + 1], points[next][j + 1], points[next][j]]);
  }
  return { reach, rays, rings: rings.length, points, cells };
}

/**
 * Break `page` open from the point (x, y). `onCrack` runs as the cracks appear (for a sound),
 * `onDone` once every piece has gone.
 */
export function breakPage(page, { x, y, small = false, reducedMotion = false, onCrack, onDone }) {
  const w = window.innerWidth;
  const h = window.innerHeight;

  if (reducedMotion) {
    onCrack?.();
    page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 350, fill: 'forwards' }).finished.then(() => onDone?.());
    return;
  }

  // 1. glitch: stutter, two colour flashes, and slits of the world showing through
  page.classList.add('is-glitching');
  const slit = (top, size) => `polygon(0 0, 100% 0, 100% ${top}%, 0 ${top}%, 0 ${top + size}%, 100% ${top + size}%, 100% 100%, 0 100%)`;
  const whole = slit(0, 0);
  const step = 'steps(1, end)';
  page.animate(
    [
      { offset: 0, transform: 'none', clipPath: whole, filter: 'none', easing: step },
      { offset: 0.12, transform: 'translate(-6px, 0)', clipPath: slit(38, 5), easing: step },
      { offset: 0.22, transform: 'translate(4px, 1px)', clipPath: whole, easing: step },
      { offset: 0.34, transform: 'none', clipPath: slit(62, 3), filter: 'invert(1)', easing: step },
      { offset: 0.42, transform: 'translate(-2px, 0)', clipPath: whole, filter: 'none', easing: step },
      { offset: 0.58, transform: 'translate(8px, -2px)', clipPath: slit(18, 9), easing: step },
      { offset: 0.7, transform: 'translate(-5px, 0)', clipPath: slit(50, 14), easing: step },
      { offset: 0.82, transform: 'translate(2px, 0)', clipPath: whole, filter: 'invert(1)', easing: step },
      { offset: 0.9, transform: 'none', clipPath: slit(30, 2), filter: 'none', easing: step },
      { offset: 1, transform: 'none', clipPath: whole, filter: 'none' },
    ],
    { duration: GLITCH, fill: 'forwards' },
  );

  const web = crackWeb(x, y, w, h, small);

  // 2. crack: lines race outward from the click
  setTimeout(() => {
    page.classList.remove('is-glitching');
    onCrack?.();
    const layer = svg('svg', { class: 'plain-cracks', viewBox: `0 0 ${w} ${h}`, 'aria-hidden': 'true' });
    const lines = [];
    for (const ray of web.points) lines.push({ d: `M${x},${y}` + ray.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join(''), delay: 0 });
    for (let j = 0; j < web.rings - 1; j++) {
      for (let k = 0; k < web.rays; k++) {
        const [ax, ay] = web.points[k][j];
        const [bx, by] = web.points[(k + 1) % web.rays][j];
        if (Math.random() < 0.85) lines.push({ d: `M${ax.toFixed(1)},${ay.toFixed(1)}L${bx.toFixed(1)},${by.toFixed(1)}`, delay: 40 + j * 35 });
      }
    }
    for (const { d, delay } of lines) {
      for (const cls of ['', 'glint']) {
        const path = svg('path', { d, class: cls, transform: cls ? 'translate(0.8 0.8)' : '' });
        layer.append(path);
        const length = path.getTotalLength?.() || 2000;
        path.style.strokeDasharray = `${length}`;
        path.animate([{ strokeDashoffset: length }, { strokeDashoffset: 0 }], { duration: 170, delay, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)', fill: 'both' });
      }
    }
    document.body.append(layer);

    // 3. shatter: the page becomes pieces, which tumble away toward you and fall
    setTimeout(() => {
      const shards = document.createElement('div');
      shards.className = 'plain-shards';
      shards.style.perspectiveOrigin = `${x}px ${y}px`;
      let longest = 0;
      for (const cell of web.cells) {
        const xs = cell.map((p) => p[0]);
        const ys = cell.map((p) => p[1]);
        const left = Math.max(0, Math.floor(Math.min(...xs)));
        const top = Math.max(0, Math.floor(Math.min(...ys)));
        const right = Math.min(w, Math.ceil(Math.max(...xs)));
        const bottom = Math.min(h, Math.ceil(Math.max(...ys)));
        if (right - left < 1 || bottom - top < 1) continue; // entirely off screen

        const piece = document.createElement('div');
        piece.className = 'plain-shard';
        Object.assign(piece.style, { left: `${left}px`, top: `${top}px`, width: `${right - left}px`, height: `${bottom - top}px` });
        piece.style.clipPath = `polygon(${cell.map(([px, py]) => `${(px - left).toFixed(1)}px ${(py - top).toFixed(1)}px`).join(',')})`;
        piece.style.setProperty('--shade', rand(0, 0.07).toFixed(3)); // each piece catches the light a little differently
        const copy = page.cloneNode(true);
        copy.classList.remove('is-glitching');
        copy.getAnimations?.().forEach((a) => a.cancel());
        Object.assign(copy.style, { left: `${-left}px`, top: `${-top}px`, width: `${w}px`, height: `${h}px`, transform: 'none', clipPath: 'none', filter: 'none' });
        piece.append(copy);
        shards.append(piece);

        // fly: a small burst away from the click, then tumbling and falling
        const mx = xs.reduce((s, v) => s + v, 0) / xs.length;
        const my = ys.reduce((s, v) => s + v, 0) / ys.length;
        const dist = Math.hypot(mx - x, my - y);
        const dx = (mx - x) / (dist || 1);
        const dy = (my - y) / (dist || 1);
        const near = 1 - Math.min(1, dist / web.reach);
        const push = rand(40, 160) + near * 140;
        const fall = rand(520, 950);
        const toward = rand(150, 620);
        const axis = [rand(-1, 1), rand(-1, 1), rand(-0.5, 0.5)].map((v) => v.toFixed(2)).join(',');
        const spin = rand(60, 200) * (Math.random() < 0.5 ? -1 : 1);
        const delay = (1 - near) * 220 + rand(0, 40);
        const duration = rand(1000, 1400);
        longest = Math.max(longest, delay + duration);
        piece.style.transformOrigin = `${(mx - left).toFixed(1)}px ${(my - top).toFixed(1)}px`;
        piece.animate(
          [
            { transform: 'translate3d(0, 0, 0)', opacity: 1 },
            { transform: `translate3d(${(dx * push * 0.35).toFixed(1)}px, ${(dy * push * 0.35).toFixed(1)}px, ${(toward * 0.3).toFixed(1)}px) rotate3d(${axis}, ${(spin * 0.15).toFixed(1)}deg)`, opacity: 1, offset: 0.18 },
            { transform: `translate3d(${(dx * push).toFixed(1)}px, ${(dy * push + fall).toFixed(1)}px, ${toward.toFixed(1)}px) rotate3d(${axis}, ${spin.toFixed(1)}deg)`, opacity: 0 },
          ],
          { duration, delay, easing: 'cubic-bezier(0.45, 0, 0.85, 0.55)', fill: 'both' },
        );
      }
      document.body.append(shards);
      page.style.visibility = 'hidden';
      layer.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' });
      setTimeout(() => {
        shards.remove();
        layer.remove();
        onDone?.();
      }, longest + 60);
    }, CRACK);
  }, GLITCH);
}
