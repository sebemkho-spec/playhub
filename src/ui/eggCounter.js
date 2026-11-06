import { readPref, writePref } from '../state.js';

const EGG_ICON = `<svg viewBox="0 0 24 24" aria-hidden="true">
  <path class="eggs__shell" d="M12 2.6c-3.9 0-7.1 5.7-7.1 10.5 0 4.7 3.2 8.3 7.1 8.3s7.1-3.6 7.1-8.3C19.1 8.3 15.9 2.6 12 2.6z" />
  <path class="eggs__band" d="M5.4 12.9c1.1 0 1.1-1.3 2.2-1.3s1.1 1.3 2.2 1.3 1.1-1.3 2.2-1.3 1.1 1.3 2.2 1.3 1.1-1.3 2.2-1.3 1.1 1.3 2.2 1.3" />
</svg>`;

/**
 * The "0/3" at the top: how many of the easter eggs (portals with shape 'egg') this visitor
 * has found. An egg counts the first time its card opens. With `remember`, the finds are kept
 * in the visitor's browser, so they pick up where they left off next time.
 */
export class EggCounter {
  constructor(root, { ids, remember, onChange }) {
    this.root = root;
    this.ids = ids;
    this.remember = remember;
    this.onChange = onChange; // (counter) => …: after every new find, and after a reset
    this.count = root.querySelector('[data-eggs-count]');
    this.live = document.querySelector('[data-eggs-live]');
    root.querySelector('[data-eggs-icon]').innerHTML = EGG_ICON;

    // (eggs that have since been removed from src/data/portals.js don't count)
    const saved = remember ? readPref('eggs', []) : [];
    this.found = new Set((Array.isArray(saved) ? saved : []).filter((id) => ids.includes(id)));
    root.hidden = !ids.length; // no eggs, no counter
    root.addEventListener('animationend', (e) => {
      if (e.animationName === 'eggs-pop') root.classList.remove('is-pop');
    });
    this.render();
  }

  get total() {
    return this.ids.length;
  }

  /** Every egg found (what unlocks the Gallery). */
  get complete() {
    return this.total > 0 && this.found.size === this.total;
  }

  /** Call when a card opens. Returns true the first time that egg is found. */
  find(id) {
    if (!this.ids.includes(id) || this.found.has(id)) return false;
    this.found.add(id);
    if (this.remember) writePref('eggs', [...this.found]);
    this.render();
    // pop (restarted even if the last pop is still playing)
    this.root.classList.remove('is-pop');
    void this.root.offsetWidth;
    this.root.classList.add('is-pop');
    const n = this.found.size;
    this.live.textContent = n === this.total ? `You found all ${this.total} easter eggs!` : `Easter egg found: ${n} of ${this.total}.`;
    this.onChange?.(this);
    return true;
  }

  /** Forget every find (for testing: `__playhub.eggs.reset()` in the console). */
  reset() {
    this.found.clear();
    if (this.remember) writePref('eggs', []);
    this.render();
    this.onChange?.(this);
  }

  render() {
    const n = this.found.size;
    this.count.textContent = `${n}/${this.total}`;
    this.root.classList.toggle('is-complete', n > 0 && n === this.total);
    this.root.title = n === this.total ? 'You found every easter egg!' : `Easter eggs found: ${n} of ${this.total}`;
  }
}
