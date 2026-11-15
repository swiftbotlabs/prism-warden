// WebAudio sound made in code: a synthesized effect for every action, the beam hum and a quiet generative music loop.
/** The three lights are tuned to an A-major triad, so mixed beams and kills always sound consonant. */
const LIGHT_ROOTS = [220, 277.18, 329.63, 440];
/** A-minor pentatonic for the music, two octaves. */
const MUSIC_SCALE = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99];
/** Am - F - C - G, one chord per bar. */
const BASS_ROOTS = [110, 87.31, 130.81, 98];
const MIN_GAP = { hit: 0.075, wrong: 0.16, kill: 0.03, chain: 0.05, crack: 0.12, heal: 0.08, hover: 0.05, split: 0.05 };

let audio = null;
let muted = false;
let mood = 'title';
const lastPlayed = new Map();

/** Creates the audio graph on the first user gesture (browsers keep audio locked until then). */
export function unlockAudio() {
  if (audio) {
    if (audio.ctx.state === 'suspended') audio.ctx.resume();
    return;
  }
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return;
  const ctx = new AudioCtor();
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.8;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 6;
  master.connect(limiter).connect(ctx.destination);

  const sfx = ctx.createGain();
  sfx.gain.value = 0.9;
  sfx.connect(master);
  const music = ctx.createGain();
  music.gain.value = 0.3;
  music.connect(master);
  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.45;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.35;
  const wet = ctx.createGain();
  wet.gain.value = 0.5;
  music.connect(echo);
  echo.connect(feedback).connect(echo);
  echo.connect(wet).connect(master);

  const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;

  audio = { ctx, master, sfx, music, noiseBuffer, hum: buildHum(ctx, sfx), nextNote: ctx.currentTime + 0.2, step: 0 };
  audio.timer = setInterval(scheduleMusic, 90);
}

function buildHum(ctx, bus) {
  const low = ctx.createOscillator();
  low.type = 'sawtooth';
  const high = ctx.createOscillator();
  high.type = 'sine';
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 600;
  filter.Q.value = 4;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  low.connect(filter);
  high.connect(filter);
  filter.connect(gain).connect(bus);
  low.frequency.value = 110;
  high.frequency.value = 220;
  low.start();
  high.start();
  return { low, high, filter, gain };
}

export function isMuted() {
  return muted;
}

export function setMuted(value) {
  muted = value;
  if (audio) audio.master.gain.setTargetAtTime(muted ? 0 : 0.8, audio.ctx.currentTime, 0.03);
}

/** 'title', 'play', 'boss' or 'calm': how busy the music is. */
export function setMusicMood(next) {
  mood = next;
}

/** Keeps the beam hum in step with the Warden: silent when not casting, brighter while hitting a Shade. */
export function setBeamHum(casting, colour, hitting) {
  if (!audio) return;
  const { hum, ctx } = audio;
  const now = ctx.currentTime;
  const root = LIGHT_ROOTS[colour] / 2;
  hum.low.frequency.setTargetAtTime(root, now, 0.03);
  hum.high.frequency.setTargetAtTime(root * 2.005, now, 0.03);
  hum.filter.frequency.setTargetAtTime(hitting ? 2200 : 700, now, 0.05);
  hum.gain.gain.setTargetAtTime(casting ? (hitting ? 0.07 : 0.045) : 0, now, 0.04);
}

/** Plays a named effect; `colour` picks the pitch for light-related sounds, `level` raises it (combo, card index). */
export function playSound(name, colour = 0, level = 0) {
  if (!audio || muted) return;
  const now = audio.ctx.currentTime;
  const gap = MIN_GAP[name];
  if (gap && now - (lastPlayed.get(name) ?? -1) < gap) return;
  lastPlayed.set(name, now);
  const root = LIGHT_ROOTS[colour] ?? 440;
  const lift = 2 ** (Math.min(level, 16) / 24);
  switch (name) {
    case 'select':
      tone(root * 2, { type: 'triangle', decay: 0.09, gain: 0.12 });
      break;
    case 'hit':
      tone(root * 4 * lift, { type: 'sine', decay: 0.05, gain: 0.05 });
      break;
    case 'wrong':
      tone(92, { type: 'square', decay: 0.12, gain: 0.06, filter: 600 });
      noise({ duration: 0.05, gain: 0.08, type: 'highpass', freq: 5000 });
      break;
    case 'kill':
      tone(root * 2 * lift, { type: 'sine', decay: 0.28, gain: 0.2 });
      tone(root * 3 * lift, { type: 'triangle', decay: 0.16, gain: 0.08, start: 0.02 });
      noise({ duration: 0.12, gain: 0.08, type: 'bandpass', freq: 3000, q: 2 });
      break;
    case 'split':
      tone(300, { type: 'sine', decay: 0.12, gain: 0.14, slideTo: 640 });
      break;
    case 'chain':
      tone(1400, { type: 'sawtooth', decay: 0.09, gain: 0.05, slideTo: 500, filter: 3000 });
      break;
    case 'crack':
      noise({ duration: 0.45, gain: 0.5, type: 'lowpass', freq: 1400, slideTo: 200 });
      tone(90, { type: 'sine', decay: 0.45, gain: 0.5, slideTo: 38 });
      tone(1900, { type: 'triangle', decay: 0.18, gain: 0.06, slideTo: 1200 });
      break;
    case 'shield':
      tone(520, { type: 'triangle', decay: 0.25, gain: 0.16, slideTo: 1040 });
      break;
    case 'heal':
      tone(880, { type: 'sine', decay: 0.12, gain: 0.07 });
      tone(1320, { type: 'sine', decay: 0.12, gain: 0.05, start: 0.05 });
      break;
    case 'wave':
      [440, 554.37, 659.25, 880].forEach((f, i) => tone(f, { type: 'triangle', decay: 0.35, gain: 0.12, start: i * 0.09 }));
      break;
    case 'hover':
      tone(1500 + level * 200, { type: 'sine', decay: 0.04, gain: 0.03 });
      break;
    case 'card':
      [440, 554.37, 659.25].forEach((f) => tone(f, { type: 'sine', decay: 0.6, gain: 0.1, attack: 0.02 }));
      tone(1760, { type: 'triangle', decay: 0.4, gain: 0.05, start: 0.12 });
      noise({ duration: 0.4, gain: 0.06, type: 'bandpass', freq: 6000, slideTo: 2000, q: 3 });
      break;
    case 'click':
      tone(660, { type: 'square', decay: 0.05, gain: 0.05, filter: 2000 });
      break;
    case 'pause':
      tone(523.25, { type: 'triangle', decay: 0.1, gain: 0.08 });
      tone(392, { type: 'triangle', decay: 0.14, gain: 0.08, start: 0.08 });
      break;
    case 'boss':
      tone(55, { type: 'sawtooth', attack: 0.4, decay: 1.6, gain: 0.25, slideTo: 110, filter: 500 });
      noise({ duration: 1.6, gain: 0.12, type: 'lowpass', freq: 300, slideTo: 1200 });
      break;
    case 'phase':
      noise({ duration: 1.1, gain: 0.45, type: 'lowpass', freq: 3000, slideTo: 120 });
      tone(65, { type: 'sine', decay: 1.1, gain: 0.55, slideTo: 32 });
      [880, 1108.73, 1318.51].forEach((f, i) => tone(f, { type: 'sine', decay: 0.9, gain: 0.07, start: 0.15 + i * 0.07 }));
      break;
    case 'victory':
      [440, 554.37, 659.25, 880, 1108.73, 1318.51].forEach((f, i) => tone(f, { type: 'triangle', decay: 0.7, gain: 0.12, start: i * 0.11 }));
      [220, 277.18, 329.63].forEach((f) => tone(f, { type: 'sine', attack: 0.3, decay: 2.2, gain: 0.12, start: 0.66 }));
      break;
    case 'defeat':
      noise({ duration: 0.9, gain: 0.45, type: 'highpass', freq: 2500, slideTo: 300 });
      [440, 392, 329.63, 220].forEach((f, i) => tone(f, { type: 'triangle', decay: 0.6, gain: 0.12, start: 0.25 + i * 0.22 }));
      tone(55, { type: 'sine', decay: 1.8, gain: 0.4, start: 0.2 });
      break;
    default:
      break;
  }
}

function tone(freq, { type = 'sine', start = 0, attack = 0.005, decay = 0.2, gain = 0.2, slideTo = 0, filter = 0, bus = null, at = 0 }) {
  const { ctx } = audio;
  const t0 = (at || ctx.currentTime) + start;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + attack + decay);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, t0);
  envelope.gain.exponentialRampToValueAtTime(gain, t0 + attack);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  let source = osc;
  if (filter) {
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = filter;
    osc.connect(lowpass);
    source = lowpass;
  }
  source.connect(envelope).connect(bus ?? audio.sfx);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

function noise({ start = 0, duration = 0.3, gain = 0.2, type = 'lowpass', freq = 1200, q = 1, slideTo = 0 }) {
  const { ctx } = audio;
  const t0 = ctx.currentTime + start;
  const source = ctx.createBufferSource();
  source.buffer = audio.noiseBuffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, t0);
  if (slideTo) filter.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
  filter.Q.value = q;
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(gain, t0);
  envelope.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  source.connect(filter).connect(envelope).connect(audio.sfx);
  source.start(t0, Math.random() * 0.5);
  source.stop(t0 + duration + 0.05);
}

/** Schedules the generative music a little ahead of time: a soft bass chord per bar and plucked pentatonic notes. */
function scheduleMusic() {
  if (!audio || audio.ctx.state !== 'running') return;
  const beat = mood === 'boss' ? 0.24 : 0.3;
  while (audio.nextNote < audio.ctx.currentTime + 0.3) {
    playMusicStep(audio.step, audio.nextNote, beat);
    audio.nextNote += beat;
    audio.step += 1;
  }
}

function playMusicStep(step, at, beat) {
  const bar = Math.floor(step / 8) % BASS_ROOTS.length;
  const bus = audio.music;
  if (step % 8 === 0) {
    const root = BASS_ROOTS[bar];
    tone(root, { type: 'sine', attack: 0.4, decay: beat * 8, gain: 0.22, bus, at });
    tone(root * 1.5, { type: 'triangle', attack: 0.6, decay: beat * 7, gain: 0.05, bus, at, filter: 800 });
  }
  if (mood === 'boss' && step % 2 === 0) {
    tone(BASS_ROOTS[bar] / 2, { type: 'sine', decay: 0.18, gain: 0.25, bus, at });
  }
  const density = { title: 0.3, calm: 0.25, play: 0.45, boss: 0.6 }[mood] ?? 0.4;
  if (Math.random() < density) {
    const note = MUSIC_SCALE[Math.floor(Math.random() * MUSIC_SCALE.length)];
    tone(note, { type: 'triangle', decay: beat * 2.2, gain: 0.07, bus, at, filter: 2400 });
  }
}
