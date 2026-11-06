#!/usr/bin/env node
/**
 * Makes the ethereal theme's sounds from scratch (pure synthesis, no samples, so there's
 * nothing to license): soft glassy chimes, airy swells, a light hover for moving about and calm
 * ambient music. They're all in E major, so any of them can overlap and still sound nice together.
 *
 *   node scripts/make-ethereal-sounds.mjs                     re-make the sounds
 *   node scripts/make-ethereal-sounds.mjs unlock pop          re-make just those
 *   node scripts/make-ethereal-sounds.mjs --preview <folder>  also draw a spectrogram of each
 *
 * Writes the sounds to public/audio/ethereal/: the hover as a 16-bit WAV (so it loops without a
 * gap), everything else as a much smaller AAC .m4a (made with macOS's afconvert). The one-shot
 * effects' uncompressed WAVs go to sound-originals/ethereal/, outside public/, so they're kept
 * but not shipped.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

const SR = 44100;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'audio', 'ethereal');
// the one-shot effects' uncompressed WAVs (outside public/, so they aren't shipped)
const ORIGINALS = join(dirname(fileURLToPath(import.meta.url)), '..', 'sound-originals', 'ethereal');

// E major pentatonic (plus a few low notes for warmth)
const NOTE = {
  E2: 82.41, E4: 329.63, Gs4: 415.3, B4: 493.88,
  E5: 659.26, Gs5: 830.61, B5: 987.77, Cs6: 1108.73,
  E6: 1318.51, Gs6: 1661.22, B6: 1975.53, Cs7: 2217.46, E7: 2637.02,
};

// A glassy bell: [frequency ratio, loudness, how long it rings (share of the decay)]
const GLASS = [[1, 1, 1], [2, 0.32, 0.55], [3.01, 0.12, 0.35], [4.17, 0.08, 0.22], [5.43, 0.05, 0.15]];
const SOFT = [[1, 1, 1], [2, 0.18, 0.5]];

const samples = (s) => Math.round(s * SR);
const silence = (s) => new Float32Array(samples(s));

function random(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Add a tone made of sine partials. `freq` is a number, or a function of time for slides. */
function tone(out, { at = 0, freq, amp = 1, attack = 0.004, decay = 0.6, partials = GLASS, vibrato = 0, length = decay * 6, maxFreq = Infinity }) {
  const start = samples(at);
  const n = Math.min(out.length - start, samples(length));
  const phase = partials.map(() => 0);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = (typeof freq === 'function' ? freq(t) : freq) * (1 + vibrato * Math.sin(2 * Math.PI * 5.2 * t));
    let s = 0;
    for (let k = 0; k < partials.length; k++) {
      const [ratio, a, d] = partials[k];
      if (f * ratio > maxFreq) continue; // (optional) leave out overtones that would get piercing
      phase[k] += (2 * Math.PI * f * ratio) / SR;
      s += Math.sin(phase[k]) * a * Math.exp(-t / (decay * d));
    }
    // soft start, and a short fade at the very end so nothing clicks
    const fade = Math.min(1, t / attack, (n - i) / samples(0.01));
    out[start + i] += s * fade * amp;
  }
}

class Biquad {
  x1 = 0; x2 = 0; y1 = 0; y2 = 0;
  set(type, freq, q) {
    const w = (2 * Math.PI * Math.min(Math.max(freq, 20), SR * 0.45)) / SR;
    const c = Math.cos(w);
    const a = Math.sin(w) / (2 * q);
    const [b0, b1, b2] = type === 'lowpass' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : type === 'highpass' ? [(1 + c) / 2, -(1 + c), (1 + c) / 2] : [a, 0, -a];
    const a0 = 1 + a;
    Object.assign(this, { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: (-2 * c) / a0, a2: (1 - a) / a0 });
  }
  run(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/**
 * Add filtered noise. `filter(t)` → { type, freq, q } (or a list of them, applied one after
 * another for a steeper slope) and `env(t)` → loudness, both over time.
 */
function noise(out, { at = 0, length, amp = 1, seed = 1, filter, env }) {
  const rnd = random(seed);
  const stages = [].concat(filter(0)).map(() => new Biquad());
  const start = samples(at);
  const n = Math.min(out.length - start, samples(length));
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    if (i % 32 === 0) [].concat(filter(t)).forEach(({ type, freq, q }, k) => stages[k].set(type, freq, q));
    let v = rnd() * 2 - 1;
    for (const st of stages) v = st.run(v);
    out[start + i] += v * env(t) * amp;
  }
}

/** A lush stereo reverb (Freeverb), for the dreamy sense of space. Returns [left, right]. */
function reverb(input, { room = 0.84, damp = 0.4, wet = 0.3, tail = 1.2 }) {
  const n = input.length + samples(tail);
  const out = [new Float32Array(n), new Float32Array(n)];
  const feedback = room * 0.28 + 0.7;
  const d = damp * 0.4;
  const line = (len) => ({ buf: new Float32Array(len), i: 0, store: 0 });
  const sides = [0, 23].map((spread) => ({
    combs: [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((len) => line(len + spread)),
    passes: [556, 441, 341, 225].map((len) => line(len + spread)),
  }));
  for (let s = 0; s < n; s++) {
    const dry = s < input.length ? input[s] : 0;
    const x = dry * 0.03;
    sides.forEach((side, c) => {
      let y = 0;
      for (const cb of side.combs) {
        const o = cb.buf[cb.i];
        cb.store = o * (1 - d) + cb.store * d;
        cb.buf[cb.i] = x + cb.store * feedback;
        cb.i = (cb.i + 1) % cb.buf.length;
        y += o;
      }
      for (const ap of side.passes) {
        const o = ap.buf[ap.i];
        ap.buf[ap.i] = y + o * 0.5;
        ap.i = (ap.i + 1) % ap.buf.length;
        y = o - y;
      }
      out[c][s] = dry + y * wet * 3;
    });
  }
  return out;
}

const mono = ([l, r]) => l.map((v, i) => (v + r[i]) / 2);

/* ── The sounds ─────────────────────────────────────────────────────────────── */

/** Flipping a switch: a little bubble that rises into a glassy twinkle. */
function toggle() {
  const s = silence(0.5);
  tone(s, { freq: (t) => NOTE.Gs4 * (1 + Math.min(1, t / 0.05)), amp: 0.5, attack: 0.003, decay: 0.07, partials: SOFT, length: 0.3 });
  tone(s, { at: 0.055, freq: NOTE.B6, amp: 0.34, attack: 0.002, decay: 0.28, length: 0.44 });
  tone(s, { at: 0.055, freq: NOTE.E7, amp: 0.1, attack: 0.002, decay: 0.18, length: 0.44 });
  return { channels: [mono(reverb(s, { room: 0.7, damp: 0.5, wet: 0.22, tail: 0.6 }))], peak: 0.6 };
}

/** The character wakes up and can move: a soft, round "bloop" with a tiny sparkle. */
function pop() {
  const s = silence(0.4);
  tone(s, { freq: (t) => 280 + 700 * (1 - Math.exp(-t / 0.025)), amp: 0.6, attack: 0.002, decay: 0.09, partials: SOFT, length: 0.35 });
  tone(s, { at: 0.04, freq: NOTE.Gs6, amp: 0.2, decay: 0.2, length: 0.36 });
  return { channels: [mono(reverb(s, { room: 0.65, damp: 0.5, wet: 0.2, tail: 0.5 }))], peak: 0.45 };
}

/** A portal card opens: a quick sparkling arpeggio over a warm glow, with a drift of stardust. */
function portal() {
  const s = silence(1.2);
  [NOTE.E6, NOTE.Gs6, NOTE.B6, NOTE.E7].forEach((f, i) => tone(s, { at: i * 0.06, freq: f, amp: 0.32 - i * 0.03, attack: 0.003, decay: 0.55, vibrato: 0.002, length: 1.1 - i * 0.06 }));
  for (const [f, a] of [[NOTE.E4, 0.12], [NOTE.E5, 0.16], [NOTE.B5, 0.1]]) tone(s, { freq: f, amp: a, attack: 0.08, decay: 0.45, partials: SOFT, length: 1.1 });
  noise(s, {
    at: 0.05, length: 0.9, amp: 0.05, seed: 3,
    filter: (t) => ({ type: 'bandpass', freq: 5000 + 2500 * t, q: 2.2 }),
    env: (t) => Math.sin(Math.PI * Math.min(1, t / 0.9)) ** 2 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 18 * t)),
  });
  return { channels: reverb(s, { room: 0.88, damp: 0.35, wet: 0.4, tail: 1.4 }), peak: 0.7 };
}

/**
 * The island rises out of the sea: an airy rush that brightens as it climbs, a deep soft bloom
 * underneath, and two chimes as it settles. The game plays it at 0.85 speed, so its notes are
 * tuned up here to land back in key.
 */
function whoosh() {
  const k = 1 / 0.85;
  const s = silence(1.9);
  noise(s, {
    length: 1.9, amp: 0.5, seed: 9,
    // a soft, dark rush that opens up as it rises (low-passed, so it never turns into hiss)
    filter: (t) => ({ type: 'lowpass', freq: 300 * Math.pow(8, Math.min(1, t / 1.5)), q: 1.1 }),
    env: (t) => Math.pow(Math.sin(Math.PI * Math.min(1, t / 1.9)), 1.6),
  });
  tone(s, { freq: (t) => NOTE.E2 * k * (1 + 0.5 * Math.min(1, t / 1.6)), amp: 0.35, attack: 0.5, decay: 1.2, partials: [[1, 1, 1], [2, 0.25, 0.8]], length: 1.9 });
  tone(s, { at: 1.25, freq: NOTE.B5 * k, amp: 0.14, decay: 0.6, length: 0.65 });
  tone(s, { at: 1.38, freq: NOTE.E6 * k, amp: 0.12, decay: 0.6, length: 0.52 });
  return { channels: reverb(s, { room: 0.85, damp: 0.45, wet: 0.35, tail: 1.0 }), peak: 0.55 };
}

/**
 * The plain loading page breaking open: a crisp little crack, then (0.22 s later, as the pieces
 * fall) a soft thump and a shower of tiny glassy tinkles that fade into the dreamy space.
 * Pretty rather than violent; the high overtones are left out so nothing pierces.
 */
function shatter() {
  const s = silence(2);
  const bright = 9000;
  noise(s, { length: 0.05, amp: 0.5, seed: 51, filter: () => ({ type: 'bandpass', freq: 3200, q: 1.4 }), env: (t) => Math.exp(-t / 0.008) });
  tone(s, { freq: NOTE.E7, amp: 0.12, attack: 0.001, decay: 0.06, length: 0.3, maxFreq: bright });
  tone(s, { at: 0.03, freq: NOTE.B6, amp: 0.1, attack: 0.001, decay: 0.08, length: 0.3, maxFreq: bright });
  const at = 0.22;
  tone(s, { at, freq: (t) => 50 + 140 * Math.exp(-t / 0.08), amp: 0.35, attack: 0.003, decay: 0.12, partials: SOFT, length: 0.4 });
  noise(s, {
    at, length: 0.5, amp: 0.22, seed: 52,
    filter: () => [{ type: 'highpass', freq: 2500, q: 0.7 }, { type: 'lowpass', freq: 8500, q: 0.7 }],
    env: (t) => (t < 0.004 ? t / 0.004 : Math.exp(-(t - 0.004) / 0.09)),
  });
  const rnd = random(53);
  const notes = [NOTE.B5, NOTE.Cs6, NOTE.E6, NOTE.Gs6, NOTE.B6, NOTE.Cs7, NOTE.E7];
  for (let i = 0; i < 34; i++) {
    const t = at + 0.9 * Math.pow(rnd(), 2.2); // thick at first, thinning out
    tone(s, {
      at: t,
      freq: notes[Math.floor(rnd() * notes.length)] * (1 + (rnd() - 0.5) * 0.004),
      amp: (0.05 + 0.08 * rnd()) * (1 - (t - at) / 1.2),
      attack: 0.001,
      decay: 0.05 + 0.12 * rnd(),
      length: 0.5,
      maxFreq: bright,
    });
  }
  return { channels: reverb(s, { room: 0.82, damp: 0.4, wet: 0.32, tail: 1 }), peak: 0.6 };
}

/**
 * Join a sound end-to-start: the last `x` seconds after `length` are faded into the first `x`
 * (equal power), so it loops forever with no seam.
 */
function loopSeamlessly(channel, length, x) {
  const n = samples(length);
  const m = samples(x);
  const out = channel.slice(0, n);
  for (let i = 0; i < m; i++) {
    const k = (i / m) * (Math.PI / 2);
    out[i] = channel[i] * Math.sin(k) + channel[n + i] * Math.cos(k);
  }
  return out;
}

/**
 * Moving about: a light, airy hover (a soul floats rather than steps): a soft breath of air
 * with a faint warm hum underneath, swelling very gently. Loops every 4 seconds; every slow
 * wobble fits a whole number of times into that, so the loop is invisible.
 */
function hover() {
  const length = 4;
  const x = 0.5;
  const s = silence(length + x);
  noise(s, {
    length: length + x, amp: 0.5, seed: 31,
    // a soft, dark breath: a gentle band around 650 Hz with the treble rolled off steeply (no hiss)
    filter: (t) => [
      { type: 'bandpass', freq: 650 + 120 * Math.sin((2 * Math.PI * t) / length), q: 0.8 },
      { type: 'lowpass', freq: 1000, q: 0.6 },
      { type: 'lowpass', freq: 1000, q: 0.6 },
    ],
    env: (t) => 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.5 * t),
  });
  // E3 and B3 (tuned to whole cycles per loop), plus a slightly-off twin of E3 so it shimmers slowly
  for (const [f, a] of [[164.75, 0.12], [165.0, 0.09], [247.0, 0.06]]) {
    tone(s, { freq: f, amp: a, attack: 0.01, decay: 1e9, partials: [[1, 1, 1], [2, 0.12, 1]], length: length + x });
  }
  return { channels: [loopSeamlessly(s, length, x)], peak: 0.35 };
}

/** A soft pad note: a few gentle harmonics on two slightly detuned voices, fading in and out. */
function pad(out, { at, freq, amp, hold, attack = 3, release = 4 }) {
  const start = samples(at);
  const n = Math.min(out.length - start, samples(hold + release));
  const voices = [-0.0018, 0.0018].map((detune) => ({ f: freq * (1 + detune), phase: [0, 0, 0, 0] }));
  const harmonics = [1, 0.35, 0.12, 0.05];
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const env = Math.min(1, t / attack) * (t > hold ? Math.max(0, 1 - (t - hold) / release) : 1);
    if (env <= 0) continue;
    let s = 0;
    for (const v of voices) {
      for (let h = 0; h < harmonics.length; h++) {
        v.phase[h] += (2 * Math.PI * v.f * (h + 1)) / SR;
        s += Math.sin(v.phase[h]) * harmonics[h];
      }
    }
    out[start + i] += s * env * env * amp * 0.5;
  }
}

/**
 * Background music: calm ambience, nothing to follow (no beat, no tune): warm pad chords that
 * drift from one to the next every 8 seconds, a low hum, an occasional far-off chime and a faint
 * breeze. 64 seconds, looping seamlessly.
 */
function music() {
  const N = { A2: 110, B2: 123.47, Cs3: 138.59, E3: 164.81, Fs3: 185, Gs2: 103.83, Gs3: 207.65, A3: 220, B3: 246.94, Cs4: 277.18, Ds3: 155.56, Ds4: 311.13, E4: 329.63, Fs4: 369.99, Gs4: 415.3, B4: 493.88 };
  const chords = [
    [N.E3, N.B3, N.E4, N.Fs4, N.Gs4], // E add9
    [N.Cs3, N.Gs3, N.B3, N.E4, N.Gs4], // C#m7
    [N.A2, N.E3, N.B3, N.Cs4, N.E4], // A add9
    [N.B2, N.Fs3, N.B3, N.E4, N.Fs4], // B sus4
    [N.E3, N.Gs3, N.B3, N.Fs4, N.B4], // E add9, higher
    [N.Gs2, N.Ds3, N.Fs3, N.B3, N.Ds4], // G#m7
    [N.A2, N.E3, N.Gs3, N.Cs4, N.E4], // A maj7
    [N.B2, N.Fs3, N.Cs4, N.E4, N.Fs4], // B sus2, back home to E
  ];
  const chordLen = 8;
  const length = chords.length * chordLen;
  const x = 4;
  const s = silence(length + x);
  chords.forEach((chord, i) => chord.forEach((f, k) => pad(s, { at: i * chordLen, freq: f, amp: 0.09 - k * 0.008, hold: chordLen })));
  // a low, steady hum on E (whole cycles per loop: 82.5 Hz over 64 s)
  tone(s, { freq: 82.5, amp: 0.05, attack: 0.01, decay: 1e9, partials: [[1, 1, 1], [2, 0.2, 1]], length: length + x });
  // the odd far-off chime, never more than one at a time
  const rnd = random(77);
  const bells = [NOTE.E5, NOTE.Gs5, NOTE.B5, NOTE.Cs6, NOTE.E6];
  for (let t = 3 + rnd() * 3; t < length - 2; t += 5 + rnd() * 5) tone(s, { at: t, freq: bells[Math.floor(rnd() * bells.length)], amp: 0.035, attack: 0.02, decay: 1.6, length: 4 });
  // a faint breeze that comes and goes (whole cycles per loop)
  noise(s, {
    length: length + x, amp: 0.05, seed: 41,
    filter: () => ({ type: 'lowpass', freq: 700, q: 0.6 }),
    env: (t) => 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 16) ** 2,
  });
  const [l, r] = reverb(s, { room: 0.92, damp: 0.5, wet: 0.45, tail: 0 });
  return { channels: [loopSeamlessly(l, length, x), loopSeamlessly(r, length, x)], peak: 0.55, compress: true };
}

/* ── Files ──────────────────────────────────────────────────────────────────── */

function writeWav(path, channels, peak) {
  const n = channels[0].length;
  let max = 0;
  for (const ch of channels) for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(ch[i]));
  const gain = max > 0 ? peak / max : 1;
  const bytes = n * channels.length * 2;
  const wav = Buffer.alloc(44 + bytes);
  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + bytes, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20); // PCM
  wav.writeUInt16LE(channels.length, 22);
  wav.writeUInt32LE(SR, 24);
  wav.writeUInt32LE(SR * channels.length * 2, 28);
  wav.writeUInt16LE(channels.length * 2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(bytes, 40);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < channels.length; c++) {
      const v = Math.round(channels[c][i] * gain * 32767);
      wav.writeInt16LE(Math.max(-32768, Math.min(32767, v)), 44 + (i * channels.length + c) * 2);
    }
  }
  writeFileSync(path, wav);
  // loudness (RMS of the loudest 100 ms) and how much of the energy is high, hissy treble
  let loud = 0;
  const win = samples(0.1);
  for (let i = 0; i + win <= n; i += win / 2) {
    let e = 0;
    for (let j = i; j < i + win; j++) for (const ch of channels) e += (ch[j] * gain) ** 2;
    loud = Math.max(loud, Math.sqrt(e / (win * channels.length)));
  }
  const hp = new Biquad();
  hp.set('highpass', 5000, 0.7);
  let all = 0;
  let treble = 0;
  for (let i = 0; i < n; i++) {
    const v = channels[0][i];
    all += v * v;
    treble += hp.run(v) ** 2;
  }
  return { seconds: +(n / SR).toFixed(2), channels: channels.length, kb: Math.round(wav.length / 1024), loudDb: +(20 * Math.log10(loud)).toFixed(1), treblePct: +((100 * treble) / all).toFixed(1) };
}

/** A spectrogram picture (time across, pitch up, 0–11 kHz) to check the sounds by eye. */
function writeSpectrogram(path, channels) {
  const x = channels.length === 1 ? channels[0] : mono(channels);
  const size = 1024;
  const hop = Math.max(256, Math.ceil(x.length / 1200)); // long sounds get squeezed to ~1200 px wide
  const frames = Math.max(1, Math.floor((x.length - size) / hop));
  const rows = 256;
  const img = Buffer.alloc((frames * 3 + 1) * rows);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  for (let f = 0; f < frames; f++) {
    for (let i = 0; i < size; i++) {
      re[i] = (x[f * hop + i] || 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / size));
      im[i] = 0;
    }
    fft(re, im);
    for (let r = 0; r < rows; r++) {
      const bin = Math.floor(((rows - 1 - r) / rows) * (size / 2));
      const db = 20 * Math.log10(Math.hypot(re[bin], im[bin]) + 1e-9);
      const v = Math.max(0, Math.min(1, (db + 60) / 70));
      const o = r * (frames * 3 + 1) + 1 + f * 3;
      img[o] = Math.round(255 * Math.min(1, v * 1.6));
      img[o + 1] = Math.round(255 * v * v);
      img[o + 2] = Math.round(255 * Math.min(1, 0.25 + v));
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(frames, 0);
  header.writeUInt32BE(rows, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  writeFileSync(path, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(img)), chunk('IEND', Buffer.alloc(0))]));
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(a * k);
        const wi = Math.sin(a * k);
        const xr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const xi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k + len / 2] = re[i + k] - xr;
        im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr;
        im[i + k] += xi;
      }
    }
  }
}

/**
 * A locked portal opening (the Gallery, once every easter egg is found): the soft click of the
 * lock, then a shimmer of glassy notes running up into a warm chord, with a drift of stardust.
 * (The burst of light in the world starts 0.35 s in, as the notes do.)
 */
function unlock() {
  const s = silence(3.2);
  const bright = 9000;
  noise(s, { length: 0.04, amp: 0.35, seed: 61, filter: () => ({ type: 'bandpass', freq: 2600, q: 1.6 }), env: (t) => Math.exp(-t / 0.006) });
  tone(s, { freq: 210, amp: 0.28, attack: 0.002, decay: 0.05, partials: SOFT, length: 0.25 });
  [NOTE.E5, NOTE.Gs5, NOTE.B5, NOTE.E6, NOTE.Gs6, NOTE.B6, NOTE.E7].forEach((f, i) =>
    tone(s, { at: 0.32 + i * 0.065, freq: f, amp: 0.25 - i * 0.015, attack: 0.003, decay: 0.7, vibrato: 0.002, length: 2.4 - i * 0.1, maxFreq: bright }),
  );
  for (const [f, a] of [[NOTE.E4, 0.13], [NOTE.B4, 0.09], [NOTE.E5, 0.11], [NOTE.Gs5, 0.06]]) {
    tone(s, { at: 0.34, freq: f, amp: a, attack: 0.18, decay: 0.9, partials: SOFT, length: 2.6 });
  }
  noise(s, {
    at: 0.32, length: 1.8, amp: 0.04, seed: 67,
    filter: (t) => ({ type: 'bandpass', freq: 5200 + 1800 * t, q: 2.4 }),
    env: (t) => Math.sin(Math.PI * Math.min(1, t / 1.8)) ** 2 * (0.6 + 0.4 * Math.sin(2 * Math.PI * 21 * t)),
  });
  return { channels: reverb(s, { room: 0.9, damp: 0.35, wet: 0.42, tail: 1.6 }), peak: 0.7 };
}

const previewAt = process.argv.indexOf('--preview');
const previewDir = previewAt > 0 ? process.argv[previewAt + 1] : null;
mkdirSync(OUT, { recursive: true });
mkdirSync(ORIGINALS, { recursive: true });
if (previewDir) mkdirSync(previewDir, { recursive: true });
const all = { toggle, pop, portal, whoosh, hover, music, shatter, unlock };
// the sounds that play once: the site gets a .m4a, and the WAV is kept in sound-originals/
const ONE_SHOTS = ['toggle', 'pop', 'portal', 'whoosh', 'shatter', 'unlock'];
const wanted = process.argv.slice(2).filter((a, i, args) => !a.startsWith('--') && args[i - 1] !== '--preview');
for (const [name, make] of Object.entries(all).filter(([name]) => !wanted.length || wanted.includes(name))) {
  const { channels, peak, compress } = make();
  const oneShot = ONE_SHOTS.includes(name);
  const wav = join(oneShot ? ORIGINALS : OUT, `${name}.wav`);
  const info = writeWav(wav, channels, peak);
  if (previewDir) writeSpectrogram(join(previewDir, `${name}.png`), channels);
  let file = `${name}.wav`;
  if (compress || oneShot) {
    // AAC .m4a is about a tenth of the size (macOS's afconvert): the music at 96 kbps (its WAV
    // isn't kept), the one-shots at 128 kbps. The hover stays a WAV: AAC adds a few milliseconds
    // of silence at the start, which would make its loop click.
    try {
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', oneShot ? '128000' : '96000', wav, join(OUT, `${name}.m4a`)]);
      if (!oneShot) rmSync(wav);
      file = `${name}.m4a`;
      info.kb = Math.round(statSync(join(OUT, file)).size / 1024);
    } catch {
      console.warn(
        oneShot
          ? `  (couldn't make ${name}.m4a here: afconvert is macOS-only. The new ${name}.wav is in sound-originals/ethereal/; convert it on a Mac, or copy it into public/audio/ethereal/ and point theme.js at the .wav.)`
          : `  (couldn't convert ${name}.wav to .m4a here: afconvert is macOS-only. The WAV works too; point theme.js at it.)`,
      );
    }
  }
  console.log(`${file}  ${info.seconds}s  ${info.channels === 1 ? 'mono' : 'stereo'}  ${info.kb} KB  loudest ${info.loudDb} dB  treble above 5 kHz ${info.treblePct}%`);
}
