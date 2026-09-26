const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function audioHarness(options = {}) {
  let devices = [{ kind: 'audiooutput', deviceId: 'default', label: 'Default' }, { kind: 'audiooutput', deviceId: 'desk', label: 'Console USB' }];
  const contexts = [], listeners = new Map(), warnings = [], invocations = [];
  class Context {
    constructor() { this.sources = []; this.gains = []; this.buffers = []; this.sinks = []; this.resumes = 0; this.suspends = 0; this.sampleRate = options.sampleRate || 48000; this.destination = {}; contexts.push(this); }
    async setSinkId(value) { this.sinks.push(value); }
    async resume() { this.resumes++; }
    async suspend() { this.suspends++; }
    createBuffer(_channels, length, rate) { const data = new Float32Array(length), buffer = { duration: length / rate, sampleRate: rate, getChannelData: () => data }; this.buffers.push(buffer); return buffer; }
    async decodeAudioData(bytes) { return options.decode ? options.decode(bytes) : this.createBuffer(1, 100, 1000); }
    createBufferSource() {
      const source = { starts: 0, stops: 0, disconnects: 0, onended: null, connect() {}, start() { this.starts++; },
        stop() { this.stops++; this.onended?.(); }, disconnect() { this.disconnects++; }, finish() { this.onended?.(); } };
      this.sources.push(source); return source;
    }
    createGain() { const gain = { gain: { value: 1 }, disconnects: 0, connect() {}, disconnect() { this.disconnects++; } }; this.gains.push(gain); return gain; }
  }
  if (options.routing === false) delete Context.prototype.setSinkId;
  const context = vm.createContext({ window: {}, AudioContext: Context, navigator: { mediaDevices: {
    enumerateDevices: async () => devices,
    addEventListener: (name, callback) => listeners.set(name, callback)
  } } });
  vm.runInContext(fs.readFileSync(require.resolve('../deck-audio'), 'utf8'), context);
  const audio = context.window.ProTimerDeckAudio({ deckInvoke: async action => { invocations.push(action); return { ok: true, bytes: [0, 1] }; } }, message => warnings.push(message));
  return { audio, contexts, warnings, invocations, changeDevices: async value => { devices = value; await listeners.get('devicechange')(); },
    settings: { volume: 0.4, sinkId: 'desk', sound: 'builtin' } };
}

test('audio initialization, enumeration and device changes never ring automatically', async () => {
  const h = audioHarness(); assert.equal(h.contexts.length, 0);
  const outputs = await h.audio.outputs(); assert.equal(outputs.devices.length, 2); assert.equal(outputs.routingSupported, true);
  await h.changeDevices([]); assert.equal(h.contexts.length, 0); assert.equal(h.invocations.length, 0);
});

test('manual bell is one synthesized strike at chosen volume/output, without overlap', async () => {
  const h = audioHarness(); assert.equal((await h.audio.play(h.settings)).ok, true);
  const context = h.contexts[0], source = context.sources[0];
  assert.deepEqual(context.sinks, ['desk']); assert.equal(source.starts, 1); assert.equal(source.buffer.duration, 2.2);
  assert.equal(context.gains[0].gain.value, 0.4); assert.equal(h.invocations.length, 0);
  assert.equal((await h.audio.play(h.settings)).code, 'BELL_BUSY'); assert.equal(context.sources.length, 1);
  source.finish(); assert.equal((await h.audio.play(h.settings)).ok, true); assert.equal(context.sources.length, 2);
  assert.equal(context.sources[1].buffer, source.buffer); assert.equal(context.buffers.length, 1);
});

function rms(data, rate, start, end) {
  const from = Math.floor(start * rate), to = Math.min(data.length, Math.floor(end * rate));
  let energy = 0;
  for (let i = from; i < to; i++) energy += data[i] ** 2;
  return Math.sqrt(energy / (to - from));
}

function spectralAmplitude(data, rate, frequency, start = 0.015, end = 0.22) {
  const from = Math.floor(start * rate), to = Math.floor(end * rate);
  let real = 0, imaginary = 0;
  for (let i = from; i < to; i++) {
    const window = (1 - Math.cos(2 * Math.PI * (i - from) / (to - from - 1))) / 2;
    const phase = 2 * Math.PI * frequency * i / rate;
    real += data[i] * window * Math.cos(phase); imaginary += data[i] * window * Math.sin(phase);
  }
  return Math.hypot(real, imaginary) * 4 / (to - from);
}

for (const sampleRate of [44100, 48000]) {
  test(`built-in bell has a bounded, audible strike and decaying tail at ${sampleRate} Hz`, async () => {
    const h = audioHarness({ sampleRate }); await h.audio.play(h.settings);
    const data = h.contexts[0].sources[0].buffer.getChannelData(0);
    let peak = 0, peakIndex = 0;
    for (let i = 0; i < data.length; i++) {
      assert.ok(Number.isFinite(data[i]));
      if (Math.abs(data[i]) > peak) { peak = Math.abs(data[i]); peakIndex = i; }
    }
    assert.ok(peak > 0.75 && peak < 0.821, `peak ${peak} must leave headroom`);
    assert.ok(peakIndex / sampleRate < 0.04, 'the strike should reach its peak promptly');
    assert.equal(data[0], 0); assert.equal(data.at(-1), 0);
    assert.ok(Math.abs(data[1]) < 0.015, 'attack must begin smoothly');
    assert.ok(Math.abs(data.at(-2)) < 0.000001, 'tail must reach silence smoothly');
    const strike = rms(data, sampleRate, 0.005, 0.10), body = rms(data, sampleRate, 0.35, 0.55);
    const tail = rms(data, sampleRate, 1.45, 1.70), ending = rms(data, sampleRate, 2.10, 2.20);
    assert.ok(strike > 0.15, 'the generated buffer must contain an audible signal');
    assert.ok(body < strike * 0.65 && body > strike * 0.2, 'the body must decay after the strike');
    assert.ok(tail < body * 0.25 && tail > 0.005, 'a quiet natural ring should remain past one second');
    assert.ok(ending < tail * 0.15, 'the final fade should settle toward silence');
  });
}

test('bell contains several inharmonic metal resonances whose high modes decay faster', async () => {
  const h = audioHarness(); await h.audio.play(h.settings);
  const buffer = h.contexts[0].sources[0].buffer, data = buffer.getChannelData(0), rate = buffer.sampleRate;
  for (const frequency of [1175, 1768, 2377, 3154, 4086]) {
    assert.ok(spectralAmplitude(data, rate, frequency) > 0.02, `${frequency} Hz resonance must be audible`);
  }
  assert.ok(spectralAmplitude(data, rate, 1768) > spectralAmplitude(data, rate, 1768 - 80) * 20);
  assert.ok(spectralAmplitude(data, rate, 3154) > spectralAmplitude(data, rate, 1175 * 3) * 20,
    'the overtones should not collapse into a harmonic beep');
  const earlyBody = spectralAmplitude(data, rate, 1175), earlyHigh = spectralAmplitude(data, rate, 4086);
  const lateBody = spectralAmplitude(data, rate, 1175, 0.60, 0.85), lateHigh = spectralAmplitude(data, rate, 4086, 0.60, 0.85);
  assert.ok(lateHigh / lateBody < earlyHigh / earlyBody * 0.15, 'the metallic brightness should fade faster than the body');
});

test('built-in buffers are cached per context and sample rate while custom files still decode separately', async () => {
  const h = audioHarness(); await h.audio.play(h.settings);
  const context = h.contexts[0], builtin = context.sources[0].buffer;
  context.sources[0].finish(); await h.audio.play({ ...h.settings, sound: 'file' });
  assert.deepEqual(h.invocations, ['audioData']); assert.notEqual(context.sources[1].buffer, builtin);
  context.sources[1].finish(); await h.audio.play(h.settings);
  assert.equal(context.sources[2].buffer, builtin); assert.equal(context.buffers.length, 2);
  context.sources[2].finish(); context.sampleRate = 44100; await h.audio.play(h.settings);
  assert.notEqual(context.sources[3].buffer, builtin); assert.equal(context.sources[3].buffer.sampleRate, 44100);
  const other = audioHarness(); await other.audio.play(other.settings);
  assert.notEqual(other.contexts[0].sources[0].buffer, builtin);
});

test('missing selected output fails visibly and never falls back to system output', async () => {
  const h = audioHarness();
  const result = await h.audio.play({ ...h.settings, sinkId: 'disconnected-device' });
  assert.equal(result.code, 'AUDIO_UNAVAILABLE'); assert.equal(h.contexts.length, 0);
  assert.match(h.warnings.at(-1), /unavailable/i);
});

test('unsupported platform audio routing allows explicit default only', async () => {
  const h = audioHarness({ routing: false });
  assert.equal((await h.audio.play(h.settings)).ok, false); assert.equal(h.contexts.length, 0);
  assert.equal((await h.audio.play({ ...h.settings, sinkId: 'default' })).ok, true);
  assert.equal(h.contexts[0].sources.length, 1);
});

test('disconnect stops unfinished source; reconnection and later play cannot resume old bell', async () => {
  const h = audioHarness(); await h.audio.play(h.settings);
  const context = h.contexts[0], original = context.sources[0];
  await h.changeDevices([{ kind: 'audiooutput', deviceId: 'default', label: 'Default' }]);
  assert.equal(original.stops, 1); assert.equal(original.disconnects, 1); assert.equal(original.onended, null);
  assert.equal(context.suspends, 1); assert.match(h.warnings.at(-1), /disconnected/i);
  assert.equal((await h.audio.play(h.settings)).ok, false); assert.equal(context.resumes, 1);
  assert.equal((await h.audio.play({ ...h.settings, sinkId: 'default' })).ok, true);
  assert.equal(context.sources.length, 2); assert.equal(original.starts, 1); assert.equal(context.sources[1].starts, 1);
});

test('device change during file decoding cancels stale play before sound starts', async () => {
  let decode; const waiting = new Promise(resolve => { decode = resolve; });
  const h = audioHarness({ decode: () => waiting });
  const pending = h.audio.play({ ...h.settings, sound: 'file' });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await h.changeDevices([{ kind: 'audiooutput', deviceId: 'default', label: 'Default' }]);
  decode({ duration: 0.8 });
  assert.equal((await pending).ok, false); assert.equal(h.contexts[0].sources.length, 0);
});

test('stale cancelled file decoding cannot stop a newer intentional bell', async () => {
  let decode; const waiting = new Promise(resolve => { decode = resolve; });
  const h = audioHarness({ decode: () => waiting });
  const oldPlay = h.audio.play({ ...h.settings, sound: 'file' });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  await h.changeDevices([{ kind: 'audiooutput', deviceId: 'default', label: 'Default' }]);
  assert.equal((await h.audio.play({ ...h.settings, sinkId: 'default' })).ok, true);
  const currentSource = h.contexts[0].sources[0]; decode({ duration: 0.8 }); await oldPlay;
  assert.equal(currentSource.stops, 0);
  assert.equal((await h.audio.play({ ...h.settings, sinkId: 'default' })).code, 'BELL_BUSY');
});

test('overlong user sound is rejected, never auto-started or silently replaced', async () => {
  const h = audioHarness({ decode: () => ({ duration: 16 }) });
  const result = await h.audio.play({ ...h.settings, sound: 'file' });
  assert.equal(result.ok, false); assert.match(result.message, /15 seconds/); assert.equal(h.contexts[0].sources.length, 0);
});
