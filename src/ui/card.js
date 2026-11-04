import { socialIcon } from './icons.js';

/** A spring curve as a CSS linear() easing, so the card pops like the original's motion springs. */
function springEasing(stiffness = 170, damping = 19, mass = 1, samples = 48) {
  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));
  const wd = w0 * Math.sqrt(Math.max(0, 1 - zeta * zeta));
  const at = (t) =>
    zeta < 1
      ? 1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
      : 1 - Math.exp(-w0 * t) * (1 + w0 * t);
  // run until it has settled
  let duration = 0.2;
  while (duration < 3 && Math.abs(1 - at(duration)) > 0.002) duration += 0.02;
  const points = [];
  for (let i = 0; i <= samples; i++) points.push(at((i / samples) * duration).toFixed(4));
  points[samples] = '1';
  return { easing: `linear(${points.join(', ')})`, duration: Math.round(duration * 1000) };
}

const supportsLinear = typeof CSS !== 'undefined' && CSS.supports?.('animation-timing-function', 'linear(0, 1)');
const SPRING = supportsLinear ? springEasing() : { easing: 'cubic-bezier(.2, 1.3, .35, 1)', duration: 650 };
const SOFT_SPRING = supportsLinear ? springEasing(120, 18) : { easing: 'cubic-bezier(.2, 1.15, .35, 1)', duration: 700 };

/**
 * The card that appears when you walk into a portal. Pure HTML/CSS overlay.
 * Pointer events only hit the card itself, so you can still look around.
 */
export class PortalCard {
  constructor(root, { onClose } = {}) {
    this.root = root;
    this.card = root.querySelector('[data-card]');
    this.image = root.querySelector('[data-card-image]');
    this.title = root.querySelector('[data-card-title]');
    this.body = root.querySelector('[data-card-body]');
    this.socials = root.querySelector('[data-card-socials]');
    this.more = root.querySelector('[data-card-more]');
    this.live = root.querySelector('[data-card-live]');
    this.onClose = onClose;
    this.openId = null;
    this.animation = null;

    root.querySelectorAll('[data-card-close]').forEach((btn) => btn.addEventListener('click', () => this.onClose?.('button')));
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.openId) this.onClose?.('escape');
    });
  }

  fill(data) {
    this.title.textContent = data.title;
    this.body.innerHTML = data.body ?? ''; // your own content from src/data/portals.js
    const noImage = () => {
      this.image.hidden = true;
      this.card.classList.remove('has-image');
    };
    if (data.image) {
      this.image.onerror = () => {
        console.warn(`[playhub] Card image not found: ${data.image}`);
        noImage();
      };
      this.image.src = data.image;
      this.image.alt = '';
      this.image.hidden = false;
      this.card.classList.add('has-image');
    } else {
      noImage();
    }

    this.socials.replaceChildren();
    for (const s of data.socials ?? []) {
      const icon = socialIcon(s.icon);
      if (!icon) {
        console.warn(`[playhub] Unknown social icon "${s.icon}" on portal "${data.id}".`);
        continue;
      }
      const a = document.createElement('a');
      a.className = 'card__social';
      a.href = s.url;
      if (!/^mailto:|^tel:/i.test(s.url)) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }
      a.title = s.label ?? icon.title;
      a.setAttribute('aria-label', s.label ?? icon.title);
      a.innerHTML = icon.svg;
      this.socials.append(a);
    }
    this.socials.hidden = !this.socials.children.length;

    if (data.link) {
      this.more.href = data.link;
      this.more.textContent = data.linkLabel ?? 'Learn More';
      this.more.hidden = false;
    } else {
      this.more.hidden = true;
    }
    this.card.style.setProperty('--accent', data.color ?? '#00aab0');
  }

  /** origin = { x, y } in CSS pixels: where on screen the portal is, so the card grows out of it. */
  open(data, origin) {
    const switching = this.openId && this.openId !== data.id;
    this.openId = data.id;
    this.fill(data);
    this.root.hidden = false;
    this.root.classList.add('is-open');
    document.body.classList.add('has-card');
    this.live.textContent = `${data.title} card opened. Press Escape or walk away to close it.`;

    this.animation?.cancel();
    const rect = this.card.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = origin ? origin.x - cx : 0;
    const dy = origin ? origin.y - cy : 40;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.animation = this.card.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: `translate(${dx}px, ${dy}px) scale(0.06)`, borderRadius: '50%' },
            { opacity: 1, offset: 0.25 },
            { opacity: 1, transform: 'translate(0, 0) scale(1)', borderRadius: '16px' },
          ],
      { duration: reduced ? 200 : SPRING.duration, easing: reduced ? 'ease-out' : SPRING.easing, fill: 'both' },
    );

    // content slides in from the sides a beat later
    if (!reduced) {
      this.card.querySelectorAll('[data-stagger]').forEach((el, i) => {
        const from = el.dataset.stagger === 'right' ? 50 : -50;
        el.animate(
          [
            { opacity: 0, transform: `translateX(${from}px)` },
            { opacity: 1, transform: 'translateX(0)' },
          ],
          { duration: SOFT_SPRING.duration, easing: SOFT_SPRING.easing, delay: (switching ? 80 : 260) + i * 45, fill: 'both' },
        );
      });
    }
  }

  close() {
    if (!this.openId) return;
    this.openId = null;
    this.root.classList.remove('is-open');
    document.body.classList.remove('has-card');
    this.animation?.cancel();
    const anim = this.card.animate(
      [
        { opacity: 1, transform: 'scale(1)' },
        { opacity: 0, transform: 'scale(0.94) translateY(10px)' },
      ],
      { duration: 200, easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'both' },
    );
    this.animation = anim;
    // hide once faded out (with a timer fallback, so an invisible card can never block clicks)
    const hide = () => {
      if (!this.openId) this.root.hidden = true;
    };
    anim.finished.then(hide, () => {});
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(hide, 260);
  }
}
