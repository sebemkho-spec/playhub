import { CONFIG } from '../config.js';
import { hasAsset } from '../assets.js';
import { theme } from '../world/theme.js';

// every sound-effect slot (footsteps loops; the rest play once). 'shatter' = the plain loading page
// breaking, 'unlock' = the Gallery opening once every easter egg is found.
const SOUND_EFFECTS = ['footsteps', 'portal', 'toggle', 'whoosh', 'pop', 'shatter', 'unlock'];

/**
 * Background music + footsteps (+ optional sound effects), all from
 * /public/audio/. Anything missing is skipped quietly. Browsers only allow
 * sound after a click, so `unlock()` must run inside the Start click.
 */
export class AudioManager {
  constructor() {
    this.cfg = { ...CONFIG.audio, ...theme.sounds };
    this.ctx = null;
    this.enabled = true; // the sound toggle
    this.hushed = false; // a song or clip on a card is playing: the island keeps quiet meanwhile
    this.buffers = {};
    this.music = null;
    this.steps = null;
    // start downloading the sound effects now, so they're ready the moment sound is allowed
    this.prefetched = new Map();
    for (const key of SOUND_EFFECTS) {
      const url = this.cfg[key];
      if (url && hasAsset(url)) this.prefetched.set(key, fetch(url).then((res) => res.arrayBuffer()).catch(() => null));
    }
  }

  /** Call synchronously from a click/tap handler. */
  unlock(enabled) {
    this.enabled = enabled;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx || this.ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.audible ? 1 : 0;
    this.master.connect(this.ctx.destination);
    this.ctx.resume?.().catch(() => {});

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.ctx.suspend();
      else if (this.audible) this.ctx.resume();
    });

    // files and volumes from config.js, unless the theme brings its own (theme.js → sounds)
    const cfg = this.cfg;
    const missing = [];
    if (hasAsset(cfg.music)) this.setupMusic(cfg.music);
    else if (cfg.music) missing.push(cfg.music);

    for (const key of SOUND_EFFECTS) {
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
    if (this.enabled) this.musicGain.gain.setTargetAtTime(this.cfg.musicVolume, this.ctx.currentTime, 1.2);
    else setTimeout(() => !this.enabled && el.pause(), 50);
  }

  async loadBuffer(key, url) {
    try {
      const bytes = (await this.prefetched.get(key)) ?? (await (await fetch(url)).arrayBuffer());
      this.buffers[key] = await this.ctx.decodeAudioData(bytes);
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
    const c = this.cfg;
    s.gain.gain.setTargetAtTime(active ? c.footstepsVolume : 0, t, active ? c.footstepsFadeIn : c.footstepsFadeOut);
    s.source.playbackRate.setTargetAtTime(running ? c.footstepsRunRate : 1, t, 0.1);
  }

  play(key, { rate = 1, volume = 1 } = {}) {
    const buffer = this.buffers[key];
    if (!buffer || !this.ctx || !this.audible) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = this.ctx.createGain();
    gain.gain.value = this.cfg.sfxVolume * volume;
    source.connect(gain).connect(this.master);
    source.start();
  }

  /** Whether the island's own sounds can be heard: sound is on, and no song or clip is playing. */
  get audible() {
    return this.enabled && !this.hushed;
  }

  setEnabled(on) {
    this.enabled = on;
    this.fadeTo(0.15);
  }

  /**
   * Quiet every island sound (the ambience, the hover, the effects) while a song or clip on a
   * card plays, and bring them back softly afterwards.
   */
  hush(on) {
    if (this.hushed === on) return;
    this.hushed = on;
    this.fadeTo(on ? 0.12 : 0.7);
  }

  /** Fade everything in or out to match `audible` (`fade` = seconds to get most of the way). */
  fadeTo(fade) {
    if (!this.ctx) return;
    const on = this.audible;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(on ? 1 : 0, t, fade);
    clearTimeout(this.pauseTimer);
    if (on) {
      this.ctx.resume();
      if (this.music) {
        this.music.play().catch(() => {});
        this.musicGain.gain.setTargetAtTime(this.cfg.musicVolume, t, 0.8);
      }
    } else {
      // (the ambience pauses once it's silent, and carries on from there when it comes back)
      this.pauseTimer = setTimeout(() => !this.audible && this.music?.pause(), 600);
    }
  }
}
