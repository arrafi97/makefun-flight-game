// Sound for Langit Nusantara, all synthesised with WebAudio: an engine
// hum that follows the throttle, wind that follows the speed, and small
// chimes for rings, touchdowns and crashes. Nothing is loaded from a file.
export function makeSoundEngine() {
  return {
    ctx: null,
    engineOsc: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    muted: false,
    started: false,
  };
}

function ensureContext(engine) {
  if (engine.ctx) return engine.ctx;
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return null;
  const ctx = new AudioContext();
  engine.ctx = ctx;
  // Engine: two detuned saws through a lowpass, pitch follows the throttle.
  engine.engineOsc = ctx.createOscillator();
  engine.engineOsc.type = 'sawtooth';
  engine.engineOsc.frequency.value = 62;
  const engineOsc2 = ctx.createOscillator();
  engineOsc2.type = 'sawtooth';
  engineOsc2.frequency.value = 93;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  engine.engineGain = ctx.createGain();
  engine.engineGain.gain.value = 0;
  engine.engineOsc.connect(filter);
  engineOsc2.connect(filter);
  filter.connect(engine.engineGain);
  engine.engineGain.connect(ctx.destination);
  engine.engineOsc.start();
  engineOsc2.start();
  engine.engineOsc2 = engineOsc2;
  // Wind: looped noise through a bandpass, loudness follows the speed.
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  engine.windSource = ctx.createBufferSource();
  engine.windSource.buffer = buffer;
  engine.windSource.loop = true;
  const windFilter = ctx.createBiquadFilter();
  windFilter.type = 'bandpass';
  windFilter.frequency.value = 700;
  windFilter.Q.value = 0.6;
  engine.windGain = ctx.createGain();
  engine.windGain.gain.value = 0;
  engine.windSource.connect(windFilter);
  windFilter.connect(engine.windGain);
  engine.windGain.connect(ctx.destination);
  engine.windSource.start();
  return ctx;
}

function tone(engine, freq, duration, type, gainValue, when = 0) {
  if (!engine.ctx || engine.muted) return;
  const ctx = engine.ctx;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  const gain = ctx.createGain();
  const t = ctx.currentTime + when;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(gainValue, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

/** Start audio on the first user gesture; browsers require one. */
export function startSound(engine) {
  const ctx = ensureContext(engine);
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
  engine.started = true;
}

/** Continuous engine and wind, called every frame while flying. */
export function updateSound(engine, state) {
  if (!engine.ctx || !engine.started || engine.muted) return;
  const t = engine.ctx.currentTime;
  const rpm = 50 + state.throttle * 90 + state.speed * 0.4;
  engine.engineOsc.frequency.setTargetAtTime(rpm, t, 0.1);
  engine.engineOsc2.frequency.setTargetAtTime(rpm * 1.5, t, 0.1);
  engine.engineGain.gain.setTargetAtTime(state.airborne || state.speed > 5 ? 0.05 + state.throttle * 0.05 : 0, t, 0.15);
  engine.windGain.gain.setTargetAtTime(Math.min(0.12, state.speed * 0.0016), t, 0.2);
}

export function playRing(engine) {
  tone(engine, 880, 0.5, 'sine', 0.18);
  tone(engine, 1318, 0.6, 'sine', 0.14, 0.09);
}

export function playTouchdown(engine) {
  tone(engine, 180, 0.25, 'sine', 0.25);
  tone(engine, 90, 0.3, 'triangle', 0.2, 0.05);
}

export function playCrash(engine) {
  if (!engine.ctx || engine.muted) return;
  const ctx = engine.ctx;
  const length = ctx.sampleRate * 0.5;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 300;
  const gain = ctx.createGain();
  gain.gain.value = 0.5;
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start();
  tone(engine, 70, 0.7, 'sine', 0.3);
}

export function playFanfare(engine) {
  tone(engine, 523, 0.4, 'triangle', 0.18);
  tone(engine, 659, 0.4, 'triangle', 0.18, 0.12);
  tone(engine, 784, 0.7, 'triangle', 0.2, 0.24);
}

export function toggleMute(engine) {
  engine.muted = !engine.muted;
  if (engine.ctx) {
    engine.engineGain.gain.value = 0;
    engine.windGain.gain.value = 0;
  }
  return engine.muted;
}
