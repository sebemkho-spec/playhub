/**
 * The opening sequence, timed like the original: the island rises out of the
 * sea, then the trees and statues pop up, then the character drops in.
 */
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const easeOutBack = (t) => {
  const c = 1.5;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export function createIntro(steps) {
  let time = -1;
  const fired = new Set();
  return {
    get running() {
      return time >= 0 && time < Math.max(...steps.map((s) => (s.at ?? 0) + (s.duration ?? 0))) + 0.05;
    },
    start() {
      time = 0;
      this.update(0);
    },
    /** Jump straight to the end (reduced motion). */
    finish() {
      time = 1e6;
      this.update(0);
    },
    update(dt) {
      if (time < 0) return;
      time += dt;
      for (const [i, s] of steps.entries()) {
        if (s.duration) {
          const k = Math.min(1, Math.max(0, (time - s.at) / s.duration));
          const ease = s.ease === 'back' ? easeOutBack : s.ease === 'linear' ? (x) => x : easeOutQuint;
          s.run(ease(k), k);
        } else if (time >= s.at && !fired.has(i)) {
          fired.add(i);
          s.run();
        }
      }
    },
  };
}
