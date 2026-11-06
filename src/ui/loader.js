import * as THREE from 'three';
import { theme } from '../world/theme.js';
import { isTouchDevice, prefersReducedMotion } from '../state.js';
import { breakPage } from './shatter.js';

/**
 * Loading screen driven by a THREE.LoadingManager.
 * The percentage counts finished files, plus the bytes of files still
 * downloading, so big models don't sit at one number for ages.
 *
 * Two looks (theme.js → page.loader.style): 'blocks' (percentage, little blocks, a Start
 * button) or 'plain' (a boring HTML page whose title becomes a link, and breaks open).
 */
export class LoadingScreen {
  constructor(root) {
    this.root = root;
    this.percentEl = root.querySelector('[data-loader-percent]');
    this.barEl = root.querySelector('[data-loader-bar]');
    this.startBtn = root.querySelector('[data-loader-start]');
    this.statusEl = root.querySelector('[data-loader-status]');
    this.plain = theme.page.loader.style === 'plain' ? root.querySelector('[data-plain]') : null;
    this.plainTitle = root.querySelector('[data-plain-title]');
    this.plainProgress = root.querySelector('[data-plain-progress]');

    this.manager = new THREE.LoadingManager();
    this.itemsLoaded = 0;
    this.itemsTotal = 0;
    this.partial = new Map();
    this.shown = 0;
    this.done = false;

    this.manager.onStart = (url, loaded, total) => {
      this.itemsLoaded = loaded;
      this.itemsTotal = total;
    };
    this.manager.onProgress = (url, loaded, total) => {
      this.itemsLoaded = loaded;
      this.itemsTotal = total;
      this.partial.delete(url);
    };
    this.manager.onError = (url) => {
      this.partial.delete(url);
    };

    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);
  }

  /** onProgress callback for a single loader.load() call. */
  bytes = (url) => (event) => {
    if (event?.lengthComputable && event.total > 0) this.partial.set(url, event.loaded / event.total);
  };

  /** Count something that isn't a file (physics engine start-up, fonts…) as one item. */
  async track(name, promise) {
    this.manager.itemStart(name);
    try {
      return await promise;
    } finally {
      this.manager.itemEnd(name);
    }
  }

  get progress() {
    if (this.done) return 1;
    if (!this.itemsTotal) return 0;
    let p = this.itemsLoaded;
    for (const f of this.partial.values()) p += Math.min(0.98, f);
    return Math.min(1, p / this.itemsTotal);
  }

  tick() {
    const target = this.progress * 100;
    // count up smoothly, never backwards
    this.shown = Math.max(this.shown, this.shown + (target - this.shown) * 0.12);
    if (target - this.shown < 0.5) this.shown = Math.max(this.shown, target);
    const value = Math.min(100, Math.floor(this.shown));
    this.percentEl.textContent = `${value}%`;
    this.barEl?.style.setProperty('--progress', `${value}%`);
    if (this.plainProgress) {
      this.plainProgress.value = value;
      this.plainProgress.textContent = `${value}%`;
    }
    if (!(this.done && value >= 100)) this.raf = requestAnimationFrame(this.tick);
    else this.onFull?.();
  }

  /**
   * Everything is in: show the Start button. `onStart` runs inside the click
   * itself (browsers only allow sound to begin during a click).
   */
  ready(onStart) {
    this.done = true;
    if (this.plain) {
      // the plain page: the title quietly turns into an ordinary link
      this.onFull = () => {
        this.onFull = null;
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'plain__link';
        link.textContent = this.plainTitle.textContent;
        this.plainTitle.replaceChildren(link);
        this.plainProgress.hidden = true;
        this.plain.classList.add('is-ready');
        link.addEventListener(
          'click',
          (event) => {
            event.preventDefault();
            const box = link.getBoundingClientRect();
            // break from where you clicked (or the middle of the link, from the keyboard)
            this.breakAt = event.detail === 0 ? [box.left + box.width / 2, box.top + box.height / 2] : [event.clientX, event.clientY];
            onStart();
          },
          { once: true },
        );
      };
      return;
    }
    this.onFull = () => {
      this.onFull = null;
      this.root.classList.add('is-ready');
      this.statusEl.textContent = 'Ready';
      this.startBtn.hidden = false;
      requestAnimationFrame(() => this.startBtn.classList.add('is-visible'));
      this.startBtn.focus({ preventScroll: true });
      this.startBtn.addEventListener('click', () => onStart(), { once: true });
    };
  }

  fail(message) {
    this.root.classList.add('is-error');
    this.statusEl.textContent = message;
    if (this.plain) {
      const note = document.createElement('p');
      note.textContent = message;
      this.plainProgress.hidden = true;
      this.plain.append(note);
      this.plain.style.cursor = 'auto';
    }
  }

  /** Leave: fade out, or (plain page) break open. `sound(name)` plays a sound effect. */
  hide({ sound } = {}) {
    if (this.plain) {
      cancelAnimationFrame(this.raf);
      const [x, y] = this.breakAt ?? [window.innerWidth / 2, window.innerHeight / 3];
      breakPage(this.plain, {
        x,
        y,
        small: isTouchDevice,
        reducedMotion: prefersReducedMotion,
        onCrack: () => sound?.('shatter'),
        onDone: () => (this.root.hidden = true),
      });
      return;
    }
    this.root.classList.add('is-leaving');
    setTimeout(() => {
      this.root.hidden = true;
      cancelAnimationFrame(this.raf);
    }, 650);
  }
}
