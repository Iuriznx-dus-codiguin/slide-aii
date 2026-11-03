// Deterministic music bed for the SlideAI ad. No samples, no network: every
// sound is synthesised here, so the track can be regenerated after a timing
// change in src/timeline.ts.
//
//   node scripts/make-music.mjs        -> public/audio/music.mp3
//
// 120 BPM, bars aligned so the downbeat lands on the brand slam (frame 90).

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DURATION_IN_FRAMES, FPS, MOMENTS, SCENE_START } from "../src/timeline.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100;
const LEN = DURATION_IN_FRAMES / FPS;
const N = Math.ceil(LEN * SR);
const BEAT = 0.5;
const T_SLAM = SCENE_START.brand / FPS; // 3.0 s
const T_PROMPT = SCENE_START.prompt / FPS;
const T_CLICK = (SCENE_START.prompt + MOMENTS.promptClick) / FPS;
const T_GROOVE = Math.round(((SCENE_START.reveal + MOMENTS.revealCardsStart) / FPS - T_SLAM) / BEAT) * BEAT + T_SLAM;
const T_CTA = Math.round(((SCENE_START.cta) / FPS - T_SLAM) / (BEAT * 4)) * BEAT * 4 + T_SLAM;

const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N); // reverb send
const sendR = new Float32Array(N);
const duck = new Float32Array(N).fill(1); // sidechain gain from the kick

let seed = 1337;
const rnd = () => {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const noise = () => rnd() * 2 - 1;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const idx = (t) => Math.max(0, Math.min(N - 1, Math.round(t * SR)));

const add = (i, l, r, send = 0) => {
  if (i < 0 || i >= N) return;
  L[i] += l;
  R[i] += r;
  if (send) {
    sendL[i] += l * send;
    sendR[i] += r * send;
  }
};

// PolyBLEP saw, band-limited enough once it goes through the low-pass.
const polyblep = (t, dt) => {
  if (t < dt) {
    t /= dt;
    return t + t - t * t - 1;
  }
  if (t > 1 - dt) {
    t = (t - 1) / dt;
    return t * t + t + t + 1;
  }
  return 0;
};

// ---------- Instruments ----------

function kick(t0, gain = 1) {
  const len = 0.45;
  let ph = 0;
  for (let k = 0; k < len * SR; k++) {
    const t = k / SR;
    const f = 48 + 110 * Math.exp(-t * 28);
    ph += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t * 7.5);
    const click = k < 90 ? noise() * 0.25 * (1 - k / 90) : 0;
    const s = (Math.sin(ph) * env + click) * 0.85 * gain;
    add(idx(t0) + k, s, s);
  }
  // Sidechain: duck pad/bass after each kick.
  for (let k = 0; k < 0.28 * SR; k++) {
    const i = idx(t0) + k;
    if (i >= N) break;
    const g = 1 - 0.55 * gain * Math.exp(-(k / SR) * 9);
    duck[i] = Math.min(duck[i], g);
  }
}

function hat(t0, gain = 0.12, decay = 45, pan = 0.25) {
  let prev = 0;
  for (let k = 0; k < 0.12 * SR; k++) {
    const n = noise();
    const hp = n - prev; // crude high-pass
    prev = n;
    const s = hp * Math.exp(-(k / SR) * decay) * gain;
    add(idx(t0) + k, s * (1 - pan), s * (1 + pan));
  }
}

function clap(t0, gain = 0.28) {
  let bp1 = 0, bp2 = 0;
  for (let k = 0; k < 0.3 * SR; k++) {
    const t = k / SR;
    // three quick bursts then a tail
    const bursts = (t < 0.01 ? 1 : t < 0.02 ? 0.4 : t < 0.03 ? 1 : 0.8) * Math.exp(-t * 18);
    const n = noise();
    bp1 += 0.35 * (n - bp1);
    bp2 += 0.35 * (bp1 - bp2);
    const s = (bp1 - bp2) * bursts * gain * 3;
    add(idx(t0) + k, s, s, 0.5);
  }
}

function tick(t0, freq, gain = 0.22) {
  for (let k = 0; k < 0.05 * SR; k++) {
    const t = k / SR;
    const s = (Math.sin(2 * Math.PI * freq * t) * 0.7 + noise() * 0.3) * Math.exp(-t * 140) * gain;
    add(idx(t0) + k, s * 0.8, s, 0.3);
  }
}

function impact(t0) {
  let ph = 0;
  let lp = 0;
  for (let k = 0; k < 1.8 * SR; k++) {
    const t = k / SR;
    const f = 30 + 42 * Math.exp(-t * 4);
    ph += (2 * Math.PI * f) / SR;
    lp += 0.08 * (noise() - lp);
    const s = Math.sin(ph) * Math.exp(-t * 2.2) * 0.9 + lp * Math.exp(-t * 6) * 1.6;
    add(idx(t0) + k, s, s, 0.25);
  }
}

function riser(t0, t1) {
  let lp = 0, ph = 0;
  const n = (t1 - t0) * SR;
  for (let k = 0; k < n; k++) {
    const x = k / n;
    const cutoff = 0.02 + 0.5 * x * x;
    lp += cutoff * (noise() - lp);
    const f = 180 + 700 * x * x;
    ph += (2 * Math.PI * f) / SR;
    const s = (lp * 0.5 + Math.sin(ph) * 0.12) * x * x * 0.9;
    add(idx(t0) + k, s * 0.9, s, 0.4);
  }
}

function drone(t0, t1) {
  let ph1 = 0, ph2 = 0, lp = 0;
  const n = (t1 - t0) * SR;
  for (let k = 0; k < n; k++) {
    const x = k / n;
    ph1 += (2 * Math.PI * 55) / SR;
    ph2 = (ph2 + 110 / SR) % 1;
    const saw = 2 * ph2 - 1 - polyblep(ph2, 110 / SR);
    lp += 0.03 * (saw - lp);
    const env = Math.min(1, x * 3) * (1 - Math.pow(x, 8));
    const s = (Math.sin(ph1) * 0.5 + lp * 0.5) * env * 0.32;
    add(idx(t0) + k, s, s);
  }
}

// Pad: 3 detuned saws per note through a one-pole low-pass, sidechained.
function pad(t0, dur, notes, cutoffHz, gain = 0.07) {
  const n = Math.floor((dur + 0.6) * SR);
  const voices = [];
  for (const m of notes) for (const det of [-0.11, 0, 0.12]) voices.push({ f: mtof(m + det), ph: rnd(), pan: det * 4 });
  let lpL = 0, lpR = 0;
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.12) * (t > dur ? Math.exp(-(t - dur) * 7) : 1);
    let sl = 0, sr = 0;
    for (const v of voices) {
      const dt = v.f / SR;
      v.ph = (v.ph + dt) % 1;
      const s = 2 * v.ph - 1 - polyblep(v.ph, dt);
      sl += s * (1 - v.pan);
      sr += s * (1 + v.pan);
    }
    lpL += a * (sl - lpL);
    lpR += a * (sr - lpR);
    const i = idx(t0) + k;
    const g = env * gain * (i < N ? duck[i] : 1);
    add(i, lpL * g, lpR * g, 0.55);
  }
}

function bass(t0, dur, midi, gain = 0.32) {
  const f = mtof(midi);
  let ph = 0, lp = 0;
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1 - polyblep(ph, f / SR);
    lp += 0.06 * (saw - lp);
    const env = Math.min(1, t / 0.005) * Math.exp(-t * 3.5) * Math.min(1, (dur - t) / 0.01);
    const i = idx(t0) + k;
    const s = Math.tanh((lp * 0.8 + Math.sin(2 * Math.PI * f * t) * 0.6) * 1.4) * env * gain * (i < N ? duck[i] : 1);
    add(i, s, s);
  }
}

function pluck(t0, midi, gain = 0.09, pan = 0) {
  const f = mtof(midi);
  for (let k = 0; k < 0.35 * SR; k++) {
    const t = k / SR;
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
    const s = (Math.sin(2 * Math.PI * f * t) * 0.6 + tri * 0.4) * Math.exp(-t * 16) * gain;
    add(idx(t0) + k, s * (1 - pan), s * (1 + pan), 0.6);
  }
}

// ---------- Arrangement ----------

const CH = {
  F: { notes: [53, 57, 60, 64], root: 41 },
  G: { notes: [55, 59, 62, 66 - 2], root: 43 }, // G6 (E on top)
  Am: { notes: [57, 60, 64, 67], root: 45 },
  Em: { notes: [52, 55, 59, 62], root: 40 },
  C: { notes: [55, 60, 64, 71], root: 36 }, // Cmaj7, open voicing
  Csus: { notes: [55, 60, 62, 67], root: 36 },
};
const PROG = ["F", "G", "Am", "C", "F", "G", "Em", "Am", "F", "G", "G"];

// Hook: drone, clock ticks, riser, 2 frames of silence, slam.
drone(0, T_SLAM - 0.05);
for (let i = 0; i < 6; i++) tick(8 / FPS + i * BEAT, i % 2 === 0 ? 1900 : 1450);
riser(1.7, T_SLAM - 2 / FPS);
impact(T_SLAM);

const bars = Math.ceil((LEN - T_SLAM) / 2);
for (let b = 0; b < bars; b++) {
  const t0 = T_SLAM + b * 2;
  const inCta = t0 >= T_CTA - 0.01;
  const name = inCta ? (t0 >= LEN - 2.1 ? "C" : b % 2 === 0 ? "C" : "Csus") : PROG[b % PROG.length];
  const chord = CH[name];
  const grooveOn = t0 + 2 > T_GROOVE && !inCta;

  // Kicks first so the sidechain exists before pad/bass are written.
  for (let beat = 0; beat < 4; beat++) {
    const tb = t0 + beat * BEAT;
    if (tb >= LEN) break;
    if (inCta) {
      if (beat === 0) kick(tb, 0.6);
    } else if (tb >= T_GROOVE) {
      kick(tb, 1);
      if (beat % 2 === 1) clap(tb);
      hat(tb + BEAT / 2, 0.16, 30, 0.3);
    } else if (tb >= T_PROMPT) {
      if (beat % 2 === 0) kick(tb, 0.75);
      hat(tb + BEAT / 2, 0.08);
    } else if (beat === 0 && b > 0) {
      kick(tb, 0.6);
    }
  }

  // Filter opens as the story builds.
  const cutoff = inCta ? 1600 : t0 < T_PROMPT ? 900 : t0 < T_GROOVE ? 1300 : 2400;
  pad(t0, 2, chord.notes, cutoff, inCta ? 0.06 : 0.055);

  // Bass
  if (t0 < T_PROMPT || inCta) {
    bass(t0, 1.9, chord.root, 0.26);
  } else {
    for (let e = 0; e < 8; e++) {
      const te = t0 + e * (BEAT / 2);
      if (te >= LEN) break;
      bass(te, BEAT / 2 - 0.02, chord.root + (e === 7 ? 7 : 0), grooveOn ? 0.3 : 0.22);
    }
  }

  // Arp: "computing" plucks from the Generate click until the CTA.
  for (let s = 0; s < 16; s++) {
    const ts = t0 + s * (BEAT / 4);
    if (ts < T_CLICK - 0.05 || ts >= T_CTA || ts >= LEN) continue;
    const tones = chord.notes.map((m) => m + 12);
    const m = tones[[0, 1, 2, 3, 2, 1, 3, 2][s % 8]];
    pluck(ts, m, ts >= T_GROOVE ? 0.07 : 0.085, s % 2 === 0 ? -0.35 : 0.35);
  }
}

// Final shimmer on the end card.
for (let i = 0; i < 4; i++) pluck(T_CTA + 0.02 + i * 0.12, [72, 76, 79, 84][i], 0.08, (i - 1.5) * 0.3);

// ---------- Reverb (Schroeder) ----------
function reverb(input, offset) {
  const out = new Float32Array(N);
  const combs = [1557, 1617, 1491, 1422].map((d) => ({ buf: new Float32Array(d + offset), i: 0, lp: 0 }));
  for (let k = 0; k < N; k++) {
    const x = input[k];
    let y = 0;
    for (const c of combs) {
      const o = c.buf[c.i];
      c.lp = o * 0.75 + c.lp * 0.25;
      c.buf[c.i] = x + c.lp * 0.8;
      c.i = (c.i + 1) % c.buf.length;
      y += o;
    }
    out[k] = y * 0.25;
  }
  for (const d of [225 + offset, 556 + offset]) {
    const buf = new Float32Array(d);
    let i = 0;
    for (let k = 0; k < N; k++) {
      const b = buf[i];
      const v = out[k] + b * 0.5;
      buf[i] = v;
      out[k] = b - v * 0.5;
      i = (i + 1) % d;
    }
  }
  return out;
}
const rvL = reverb(sendL, 0);
const rvR = reverb(sendR, 23);

// ---------- Master ----------
let peak = 0;
const mixL = new Float32Array(N);
const mixR = new Float32Array(N);
for (let k = 0; k < N; k++) {
  const fadeOut = Math.min(1, (N - k) / (0.6 * SR));
  mixL[k] = Math.tanh((L[k] + rvL[k] * 0.35) * 1.1) * fadeOut;
  mixR[k] = Math.tanh((R[k] + rvR[k] * 0.35) * 1.1) * fadeOut;
  peak = Math.max(peak, Math.abs(mixL[k]), Math.abs(mixR[k]));
}
const norm = 0.89 / peak;

const wav = Buffer.alloc(44 + N * 4);
wav.write("RIFF", 0);
wav.writeUInt32LE(36 + N * 4, 4);
wav.write("WAVE", 8);
wav.write("fmt ", 12);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(SR, 24);
wav.writeUInt32LE(SR * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(N * 4, 40);
for (let k = 0; k < N; k++) {
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixL[k] * norm)) * 32767), 44 + k * 4);
  wav.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mixR[k] * norm)) * 32767), 46 + k * 4);
}

const outDir = join(here, "..", "public", "audio");
mkdirSync(outDir, { recursive: true });
const wavPath = join(outDir, "music.wav");
const mp3Path = join(outDir, "music.mp3");
writeFileSync(wavPath, wav);
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", wavPath, "-codec:a", "libmp3lame", "-b:a", "192k", mp3Path]);
rmSync(wavPath);
console.log(`music.mp3 written (${LEN}s, slam ${T_SLAM}s, groove ${T_GROOVE}s, CTA ${T_CTA}s)`);
