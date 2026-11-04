import * as THREE from 'three';

/**
 * Loading screen driven by a THREE.LoadingManager.
 * The percentage counts finished files, plus the bytes of files still
 * downloading, so big models don't sit at one number for ages.
 */
export class LoadingScreen {
  constructor(root) {
    this.root = root;
    this.percentEl = root.querySelector('[data-loader-percent]');
    this.barEl = root.querySelector('[data-loader-bar]');
    this.startBtn = root.querySelector('[data-loader-start]');
    this.statusEl = root.querySelector('[data-loader-status]');

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
    if (!(this.done && value >= 100)) this.raf = requestAnimationFrame(this.tick);
    else this.onFull?.();
  }

  /**
   * Everything is in: show the Start button. `onStart` runs inside the click
   * itself (browsers only allow sound to begin during a click).
   */
  ready(onStart) {
    this.done = true;
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
  }

  hide() {
    this.root.classList.add('is-leaving');
    setTimeout(() => {
      this.root.hidden = true;
      cancelAnimationFrame(this.raf);
    }, 650);
  }
}
