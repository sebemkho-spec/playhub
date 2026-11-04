import { CONFIG } from '../config.js';
import { hasAsset } from '../assets.js';

/**
 * Background music + footsteps (+ optional sound effects), all from
 * /public/audio/. Anything missing is skipped quietly. Browsers only allow
 * sound after a click, so `unlock()` must run inside the Start click.
 */
export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.buffers = {};
    this.music = null;
    this.steps = null;
  }

  /** Call synchronously from a click/tap handler. */
  unlock(enabled) {
    this.enabled = enabled;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || this.ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = enabled ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.ctx.resume?.().catch(() => {});

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx.suspend();
      else if (this.enabled) this.ctx.resume();
    });

    const cfg = CONFIG.audio;
    const missing = [];
    if (hasAsset(cfg.music)) this.setupMusic(cfg.music);
    else if (cfg.music) missing.push(cfg.music);

    for (const key of ['footsteps', 'portal', 'toggle', 'whoosh', 'pop']) {
      const url = cfg[key];
      if (!url) continue;
      if (!hasAsset(url)) {
        missing.push(url);
        continue;
      }
      this.loadBuffer(key, url).then(() => key === 'footsteps' && this.setupFootsteps());
    }
    if (missing.length) {
      console.info(`[playhub audio] Not in public/ yet (skipped): ${missing.join(', ')}`);
    }
  }

  setupMusic(url) {
    const el = new Audio(url);
    el.loop = true;
    el.preload = 'auto';
    const source = this.ctx.createMediaElementSource(el);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0;
    source.connect(this.musicGain).connect(this.master);
    this.music = el;
    // start now (inside the click) even when muted, so it's allowed to play later
    el.play().catch(() => {});
    if (this.enabled) this.musicGain.gain.setTargetAtTime(CONFIG.audio.musicVolume, this.ctx.currentTime, 1.2);
    else setTimeout(() => !this.enabled && el.pause(), 50);
  }

  async loadBuffer(key, url) {
    try {
      const res = await fetch(url);
      this.buffers[key] = await this.ctx.decodeAudioData(await res.arrayBuffer());
    } catch (err) {
      console.warn(`[playhub audio] Couldn't decode ${url}: ${err.message || err}`);
    }
  }

  setupFootsteps() {
    const buffer = this.buffers.footsteps;
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.master);
    source.start();
    this.steps = { source, gain, active: false, running: false };
  }

  /** Called every frame: footsteps play while you walk on the ground. */
  footsteps(active, running) {
    const s = this.steps;
    if (!s || (s.active === active && s.running === running)) return;
    s.active = active;
    s.running = running;
    const t = this.ctx.currentTime;
    s.gain.gain.setTargetAtTime(active ? CONFIG.audio.footstepsVolume : 0, t, active ? 0.04 : 0.09);
    s.source.playbackRate.setTargetAtTime(running ? 1.45 : 1, t, 0.1);
  }

  play(key, { rate = 1, volume = 1 } = {}) {
    const buffer = this.buffers[key];
    if (!buffer || !this.ctx || !this.enabled) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = CONFIG.audio.sfxVolume * volume;
    source.connect(gain).connect(this.master);
    source.start();
  }

  setEnabled(on) {
    this.enabled = on;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 1 : 0, t, 0.15);
    if (on) {
      this.ctx.resume();
      if (this.music) {
        this.music.play().catch(() => {});
        this.musicGain.gain.setTargetAtTime(CONFIG.audio.musicVolume, t, 0.8);
      }
    } else {
      setTimeout(() => !this.enabled && this.music?.pause(), 600);
    }
  }
}
