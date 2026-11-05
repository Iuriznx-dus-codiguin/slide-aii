// Deterministic music bed for the SlideAI commercial. No samples and no
// network: every sound is synthesised here from the shared timeline, so the
// track can be regenerated after any timing change.
//
//   node scripts/make-music.mjs        -> public/audio/music.mp3
//
// 100 BPM. Hook hits on every cut, drop + sonic logo on the brand reveal,
// four-on-the-floor through the demo, a breakdown on the tagline and the same
// sonic logo on the end card (audio mnemonic).

import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BEAT as BEAT_FRAMES, DURATION_IN_FRAMES, FPS, MOMENTS, SCENE_START } from "../src/timeline.ts";

const here = dirname(fileURLToPath(import.meta.url));
const SR = 44100;
const LEN = DURATION_IN_FRAMES / FPS;
const N = Math.ceil(LEN * SR);
const BEAT = BEAT_FRAMES / FPS; // 0.5 s
const sec = (f) => f / FPS;

const T = {
  brand: sec(SCENE_START.brand),
  prompt: sec(SCENE_START.prompt),
  click: sec(SCENE_START.prompt + MOMENTS.promptClick),
  burst: sec(SCENE_START.prompt + MOMENTS.promptBurst),
  demo: sec(SCENE_START.demo),
  audience: sec(SCENE_START.audience),
  features: sec(SCENE_START.features),
  exportBurst: sec(SCENE_START.features + MOMENTS.featureExportBurst),
  demoShot2: sec(SCENE_START.demo + MOMENTS.demoShot2),
  tagline: sec(SCENE_START.tagline),
  endcard: sec(SCENE_START.endcard),
  click2: sec(SCENE_START.endcard + MOMENTS.endClick),
};

const L = new Float32Array(N);
const R = new Float32Array(N);
const sendL = new Float32Array(N);
const sendR = new Float32Array(N);
const duck = new Float32Array(N).fill(1);

let seed = 20261103;
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
  let ph = 0;
  for (let k = 0; k < 0.45 * SR; k++) {
    const t = k / SR;
    const f = 46 + 120 * Math.exp(-t * 30);
    ph += (2 * Math.PI * f) / SR;
    const click = k < 80 ? noise() * 0.3 * (1 - k / 80) : 0;
    const s = Math.tanh((Math.sin(ph) * Math.exp(-t * 7) + click) * 1.6) * 0.8 * gain;
    add(idx(t0) + k, s, s);
  }
  for (let k = 0; k < 0.3 * SR; k++) {
    const i = idx(t0) + k;
    if (i >= N) break;
    duck[i] = Math.min(duck[i], 1 - 0.6 * gain * Math.exp(-(k / SR) * 8));
  }
}

function hat(t0, gain = 0.12, decay = 45, pan = 0.25) {
  let prev = 0;
  for (let k = 0; k < 0.3 * SR; k++) {
    const n = noise();
    const hp = n - prev;
    prev = n;
    const s = hp * Math.exp(-(k / SR) * decay) * gain;
    add(idx(t0) + k, s * (1 - pan), s * (1 + pan));
  }
}

function clap(t0, gain = 0.3) {
  let a = 0, b = 0;
  for (let k = 0; k < 0.32 * SR; k++) {
    const t = k / SR;
    const env = (t < 0.008 ? 1 : t < 0.016 ? 0.35 : t < 0.024 ? 1 : 0.85) * Math.exp(-t * 16);
    const n = noise();
    a += 0.38 * (n - a);
    b += 0.38 * (a - b);
    const s = (a - b) * env * gain * 3.2;
    add(idx(t0) + k, s, s, 0.45);
  }
}

function snare(t0, gain = 0.25) {
  let ph = 0, a = 0;
  for (let k = 0; k < 0.2 * SR; k++) {
    const t = k / SR;
    ph += (2 * Math.PI * (190 - t * 300)) / SR;
    const n = noise();
    a += 0.5 * (n - a);
    const s = (Math.sin(ph) * 0.5 * Math.exp(-t * 30) + (n - a) * Math.exp(-t * 22)) * gain;
    add(idx(t0) + k, s, s, 0.3);
  }
}

function impact(t0, gain = 1) {
  let ph = 0, lp = 0;
  for (let k = 0; k < 2.2 * SR; k++) {
    const t = k / SR;
    const f = 28 + 46 * Math.exp(-t * 4);
    ph += (2 * Math.PI * f) / SR;
    lp += 0.06 * (noise() - lp);
    const s = (Math.sin(ph) * Math.exp(-t * 1.8) * 0.95 + lp * Math.exp(-t * 5) * 1.8) * gain;
    add(idx(t0) + k, s, s, 0.3);
  }
}

function crash(t0, gain = 0.18, len = 1.6) {
  let prev = 0;
  for (let k = 0; k < len * SR; k++) {
    const t = k / SR;
    const n = noise();
    const hp = n - prev * 0.6;
    prev = n;
    const s = hp * Math.exp(-t * 2.6) * gain;
    add(idx(t0) + k, s * (0.8 + 0.2 * noise()), s * (0.8 + 0.2 * noise()), 0.5);
  }
}

// Noise sweep. dir 1 = rising (into a cut), -1 = falling.
function whoosh(tCenter, len = 0.5, gain = 0.5, dir = 1) {
  const t0 = tCenter - len * 0.7;
  const n = len * SR;
  let low = 0, band = 0;
  for (let k = 0; k < n; k++) {
    const x = k / n;
    const f = dir > 0 ? 200 + 5000 * x * x : 5200 - 5000 * x;
    const q = 0.35;
    const fc = 2 * Math.sin((Math.PI * Math.min(f, 8000)) / SR);
    const inp = noise();
    low += fc * band;
    const high = inp - low - q * band;
    band += fc * high;
    const env = Math.sin(Math.PI * Math.min(1, x * 1.15)) ** 2;
    const pan = (x - 0.5) * 0.8 * dir;
    const s = band * env * gain;
    add(idx(t0) + k, s * (1 - pan), s * (1 + pan), 0.35);
  }
}

function riser(t0, t1, gain = 0.8) {
  let lp = 0, ph = 0;
  const n = (t1 - t0) * SR;
  for (let k = 0; k < n; k++) {
    const x = k / n;
    lp += (0.02 + 0.55 * x * x) * (noise() - lp);
    ph += (2 * Math.PI * (160 + 900 * x * x)) / SR;
    const s = (lp * 0.5 + Math.sin(ph) * 0.14) * x * x * gain;
    add(idx(t0) + k, s * 0.9, s, 0.4);
  }
}

function pad(t0, dur, notes, cutoffHz, gain = 0.055) {
  const n = Math.floor((dur + 0.7) * SR);
  const voices = [];
  for (const m of notes) for (const det of [-0.12, 0, 0.13]) voices.push({ f: mtof(m + det), ph: rnd(), pan: det * 4 });
  let lpL = 0, lpR = 0;
  const a = 1 - Math.exp((-2 * Math.PI * cutoffHz) / SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.08) * (t > dur ? Math.exp(-(t - dur) * 6) : 1);
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

function bass(t0, dur, midi, gain = 0.3) {
  const f = mtof(midi);
  let ph = 0, lp = 0;
  const n = Math.floor(dur * SR);
  for (let k = 0; k < n; k++) {
    const t = k / SR;
    ph = (ph + f / SR) % 1;
    const saw = 2 * ph - 1 - polyblep(ph, f / SR);
    lp += 0.07 * (saw - lp);
    const env = Math.min(1, t / 0.004) * Math.exp(-t * 3) * Math.min(1, (dur - t) / 0.01);
    const i = idx(t0) + k;
    const s = Math.tanh((lp * 0.8 + Math.sin(2 * Math.PI * f * t) * 0.7) * 1.5) * env * gain * (i < N ? duck[i] : 1);
    add(i, s, s);
  }
}

function pluck(t0, midi, gain = 0.08, pan = 0, decay = 16) {
  const f = mtof(midi);
  for (let k = 0; k < 0.4 * SR; k++) {
    const t = k / SR;
    const tri = (2 / Math.PI) * Math.asin(Math.sin(2 * Math.PI * f * t));
    const s = (Math.sin(2 * Math.PI * f * t) * 0.6 + tri * 0.4) * Math.exp(-t * decay) * gain;
    add(idx(t0) + k, s * (1 - pan), s * (1 + pan), 0.6);
  }
}

// FM bell: the sonic logo.
function bell(t0, midi, gain = 0.12, pan = 0) {
  const f = mtof(midi);
  for (let k = 0; k < 2.4 * SR; k++) {
    const t = k / SR;
    const mod = Math.sin(2 * Math.PI * f * 3.5 * t) * 2.2 * Math.exp(-t * 3);
    const s = Math.sin(2 * Math.PI * f * t + mod) * Math.exp(-t * 1.6) * Math.min(1, t / 0.003) * gain;
    add(idx(t0) + k, s * (1 - pan), s * (1 + pan), 0.7);
  }
}

function sonicLogo(t0, gain = 1) {
  [79, 84, 88, 91].forEach((m, i) => bell(t0 + i * 0.09, m, 0.11 * gain, (i - 1.5) * 0.35));
  bell(t0 + 0.36, 96, 0.06 * gain, 0);
}

// ---------- Arrangement ----------

const CH = {
  Am: { notes: [57, 60, 64, 67], root: 45 },
  F: { notes: [53, 57, 60, 64], root: 41 },
  G: { notes: [55, 59, 62, 64], root: 43 },
  C: { notes: [55, 60, 64, 71], root: 36 },
  Cadd9: { notes: [60, 64, 67, 74], root: 36 },
  Gsus: { notes: [55, 60, 62, 67], root: 43 },
};

// 1) Hook: tense pulse, a hit on each of the two lines, roll + riser into
// the drop.
for (const cut of MOMENTS.hookCuts) {
  impact(sec(cut), 0.45);
  crash(sec(cut), 0.08, 1.2);
}
for (let b = 0; b * BEAT < T.brand - 0.05; b++) {
  const tb = b * BEAT;
  kick(tb, b % 4 === 0 ? 1 : 0.55);
  for (let s = 0; s < 2; s++) hat(tb + s * (BEAT / 2), s === 0 ? 0.07 : 0.05, 60, 0.3);
}
for (let e = 0; e * (BEAT / 2) < T.brand - 0.06; e++) {
  bass(e * (BEAT / 2), BEAT / 2 - 0.03, 33 + (e % 4 === 3 ? 3 : 0), 0.24);
}
pad(0, T.brand - 0.1, CH.Am.notes.map((m) => m - 12), 700, 0.05);
for (let k = 0; k < 12; k++) {
  const t = T.brand - 1.2 + k * 0.1;
  snare(t, 0.05 + k * 0.012);
}
riser(T.brand - 2.0, T.brand - 0.06, 0.85);

// 2) Drop + sonic logo, open pad, swell into the light world.
impact(T.brand, 1.15);
kick(T.brand, 1);
crash(T.brand, 0.22, 2.2);
sonicLogo(T.brand + 0.02);
const brandSplit = T.brand + BEAT * 4;
pad(T.brand, brandSplit - T.brand, CH.Cadd9.notes, 1800, 0.06);
pad(brandSplit, T.prompt - brandSplit, CH.G.notes, 1800, 0.055);
bass(T.brand, brandSplit - T.brand - 0.1, CH.C.root, 0.25);
bass(brandSplit, T.prompt - brandSplit - 0.05, CH.G.root, 0.25);
riser(T.prompt - 0.9, T.prompt - 0.02, 0.6);

// 3) Groove from the light world to the features.
const PROG = ["F", "G", "Am", "F", "C", "G", "Am", "F", "G"];
const BAR_S = BEAT * 4;
for (let b = 0; ; b++) {
  const t0 = T.prompt + b * BAR_S;
  if (t0 >= T.tagline - 0.01) break;
  const chord = CH[PROG[b % PROG.length]];
  const energy = t0 >= T.features ? 2 : t0 >= T.demo ? 1 : 0;
  for (let beat = 0; beat < 4; beat++) {
    const tb = t0 + beat * BEAT;
    if (tb >= T.tagline - 0.2) break;
    kick(tb, 1);
    if (beat % 2 === 1) clap(tb, energy >= 1 ? 0.32 : 0.24);
    hat(tb + BEAT / 2, energy === 2 ? 0.2 : 0.14, energy === 2 ? 18 : 32, 0.3);
    if (energy >= 1) {
      hat(tb + BEAT / 4, 0.05, 80, -0.3);
      hat(tb + (3 * BEAT) / 4, 0.05, 80, -0.3);
    }
  }
  const len = Math.min(BAR_S, T.tagline - t0);
  pad(t0, len, chord.notes, energy === 0 ? 1400 : 2600, 0.05);
  for (let e = 0; e < 8; e++) {
    const te = t0 + e * (BEAT / 2);
    if (te >= T.tagline - 0.2) break;
    bass(te, BEAT / 2 - 0.02, chord.root + (e === 7 ? 7 : e === 3 ? 12 : 0), 0.3);
  }
  for (let s = 0; s < 16; s++) {
    const ts = t0 + s * (BEAT / 4);
    if (ts < T.click - 0.02 || ts >= T.tagline - 0.25) continue;
    const tones = chord.notes.map((m) => m + 12);
    pluck(ts, tones[[0, 1, 2, 3, 2, 1, 3, 2][s % 8]], 0.065, s % 2 === 0 ? -0.35 : 0.35);
  }
}
// Accents on the cuts and events of the groove section
pluck(T.click, 84, 0.12, 0, 9);
whoosh(T.burst + 0.3, 0.6, 0.55, 1);
impact(T.demo, 0.6);
crash(T.demo, 0.14);
whoosh(T.demoShot2, 0.45, 0.4, 1);
whoosh(T.audience, 0.6, 0.6, 1);
crash(T.audience, 0.12);
MOMENTS.audienceSwaps.slice(1).forEach((f, i) => pluck(T.audience + sec(f) - 0.05, [88, 91, 95][i], 0.08, 0.3, 12));
whoosh(T.features, 0.6, 0.6, 1);
impact(T.features, 0.5);
MOMENTS.featureHits.slice(1).forEach((f) => whoosh(T.features + sec(f), 0.45, 0.45, 1));
impact(T.exportBurst, 0.5);
crash(T.exportBurst, 0.14);

// 4) Tagline breakdown: drums out, reverse swell, sparse bells.
const tagSplit = T.tagline + (T.endcard - T.tagline) / 2;
pad(T.tagline, tagSplit - T.tagline, CH.F.notes, 1200, 0.06);
pad(tagSplit, T.endcard - tagSplit - 0.05, CH.Gsus.notes, 1500, 0.06);
bell(T.tagline + 0.05, 77, 0.07, -0.3);
bell(tagSplit + 0.05, 79, 0.07, 0.3);
riser(tagSplit - 0.3, T.endcard - 0.03, 0.7);

// 5) End card: same sonic logo, light groove, final chord rings out.
impact(T.endcard, 0.9);
crash(T.endcard, 0.18, 2.4);
sonicLogo(T.endcard + 0.02, 1.1);
for (let beat = 0; T.endcard + beat * BEAT < LEN - 0.6; beat++) {
  const tb = T.endcard + beat * BEAT;
  kick(tb, beat % 4 === 0 ? 0.9 : 0.6);
  hat(tb + BEAT / 2, 0.1, 30, 0.3);
}
pad(T.endcard, LEN - T.endcard - 0.4, CH.C.notes, 2200, 0.06);
bass(T.endcard, LEN - T.endcard - 0.8, CH.C.root, 0.24);
pluck(T.click2, 91, 0.1, 0, 8);

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
  const fadeOut = Math.min(1, (N - k) / (0.5 * SR));
  mixL[k] = Math.tanh((L[k] + rvL[k] * 0.32) * 1.15) * fadeOut;
  mixR[k] = Math.tanh((R[k] + rvR[k] * 0.32) * 1.15) * fadeOut;
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
console.log(`music.mp3 written (${LEN}s; drop ${T.brand}s, groove ${T.prompt}s, breakdown ${T.tagline}s, end card ${T.endcard}s)`);
