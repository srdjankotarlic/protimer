(function (root) {
  'use strict';
  // Original modal synthesis of a small struck metal bell; no recorded samples.
  // Never schedules itself: callers request a manual bell or an explicitly
  // opted-in host countdown crossing. Connection/editor events do not play it.
  const bellBuffers = new WeakMap();
  function builtinBell(context) {
    const rate = context.sampleRate, cached = bellBuffers.get(context);
    if (cached?.sampleRate === rate) return cached.buffer;

    const duration = 2.2, buffer = context.createBuffer(1, Math.round(rate * duration), rate);
    const data = buffer.getChannelData(0);
    // Frequency, strength, decay time, and split between a pair of resonances.
    // Inharmonic upper modes fade faster than the body, while the close pairs
    // give the remaining ring the gentle beating of a physical metal shell.
    const modes = [
      [1175, 0.58, 0.62, 3.1],
      [1768, 0.27, 0.43, 4.7],
      [2377, 0.19, 0.34, 6.2],
      [3154, 0.13, 0.25, 8.1],
      [4086, 0.09, 0.19, 9.7],
      [4903, 0.06, 0.14, 11.3],
      [6240, 0.035, 0.10, 14.1]
    ].filter(([frequency, , , split]) => frequency + split < rate * 0.45);
    // Rotate each oscillator and decay its amplitude by a fixed step, keeping
    // the first intentional strike quick to synthesize without an audio asset.
    for (const [frequency, strength, decay, split] of modes) {
      const step = 2 * Math.PI * frequency / rate, splitStep = 2 * Math.PI * (frequency + split) / rate;
      const sineStep = Math.sin(step), cosineStep = Math.cos(step);
      const splitSineStep = Math.sin(splitStep), splitCosineStep = Math.cos(splitStep);
      const decayStep = Math.exp(-1 / (rate * decay));
      let sine = 0, cosine = 1, splitSine = 0, splitCosine = 1, amplitude = strength;
      for (let i = 0; i < data.length; i++) {
        data[i] += amplitude * (0.76 * sine + 0.24 * splitSine);
        const nextSine = sine * cosineStep + cosine * sineStep;
        cosine = cosine * cosineStep - sine * sineStep; sine = nextSine;
        const nextSplitSine = splitSine * splitCosineStep + splitCosine * splitSineStep;
        splitCosine = splitCosine * splitCosineStep - splitSine * splitSineStep; splitSine = nextSplitSine;
        amplitude *= decayStep;
      }
    }
    const attackStep = Math.exp(-1 / (rate * 0.0012)), impactStep = Math.exp(-1 / (rate * 0.004));
    let noiseState = 0x51f15e, previousNoise = 0, peak = 0, attackRest = 1, impact = 1;
    for (let i = 0; i < data.length; i++) {
      const remaining = (data.length - 1 - i) / rate;
      const release = remaining < 0.18 ? (1 - Math.cos(Math.PI * remaining / 0.18)) / 2 : 1;
      // A deterministic, high-passed clapper impact adds a brief "tink" at the
      // strike. Its millisecond decay leaves only the pitched bell resonance.
      noiseState ^= noiseState << 13; noiseState ^= noiseState >>> 17; noiseState ^= noiseState << 5;
      const noise = (noiseState >>> 0) / 0x80000000 - 1;
      const sample = data[i] + (noise - previousNoise) * 0.09 * impact;
      previousNoise = noise;
      data[i] = sample * (1 - attackRest) * release;
      attackRest *= attackStep; impact *= impactStep;
      peak = Math.max(peak, Math.abs(data[i]));
    }
    // Leave output headroom even at full user volume, with silent endpoints.
    const scale = peak > 0 ? 0.82 / peak : 1;
    for (let i = 0; i < data.length; i++) data[i] *= scale;
    data[0] = data[data.length - 1] = 0;
    bellBuffers.set(context, { sampleRate: rate, buffer });
    return buffer;
  }
  root.ProTimerDeckAudio = function (api, warn = () => {}) {
    let context = null, playing = false, activeSource = null, activeGain = null, selectedSink = 'default', generation = 0;
    function stop() { if(activeSource){activeSource.onended=null;try{activeSource.stop();}catch(_){}activeSource.disconnect();activeSource=null;}if(activeGain){activeGain.disconnect();activeGain=null;}playing=false; }
    async function outputs() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return { ok: true, devices: [{ deviceId: 'default', label: 'System default' }, ...devices.filter(d => d.kind === 'audiooutput' && d.deviceId !== 'default').map(d => ({ deviceId: d.deviceId, label: d.label || 'Audio output' }))],
        routingSupported: typeof AudioContext.prototype.setSinkId === 'function' };
    }
    async function play(settings) {
      if (playing) return { ok: false, code: 'BELL_BUSY', message: 'Bell is already playing; overlapping presses are ignored.' };
      playing = true;
      const attempt=++generation;selectedSink=settings.sinkId;
      try {
        const list = await outputs();
        if (settings.sinkId !== 'default' && (!list.routingSupported || !list.devices.some(d => d.deviceId === settings.sinkId))) throw new Error('Selected audio output is unavailable. Choose an output explicitly.');
        context ||= new AudioContext();
        if (list.routingSupported) await context.setSinkId(settings.sinkId === 'default' ? '' : settings.sinkId);
        else if (settings.sinkId !== 'default') throw new Error('This system does not support audio routing.');
        await context.resume();
        let buffer;
        if (settings.sound === 'file') {
          const result = await api.deckInvoke('audioData');
          if (!result.ok) throw new Error('Selected audio file is unavailable.');
          buffer = await context.decodeAudioData(Uint8Array.from(result.bytes).buffer);
          if (buffer.duration > 15) throw new Error('Choose a bell sound of 15 seconds or less.');
        } else {
          buffer = builtinBell(context);
        }
        if(attempt!==generation)throw new Error('Audio devices changed. Select and test the output again.');
        const source = context.createBufferSource(), gain = context.createGain();activeSource=source;activeGain=gain;
        gain.gain.value = Math.max(0, Math.min(1, settings.volume)); source.buffer = buffer;
        source.connect(gain); gain.connect(context.destination);
        source.onended = () => { source.disconnect(); gain.disconnect();activeSource=null;activeGain=null; playing = false; };
        source.start(); return { ok: true };
      } catch (error) { if(attempt===generation){stop();warn(error.message);} return { ok: false, code: 'AUDIO_UNAVAILABLE', message: error.message }; }
    }
    navigator.mediaDevices.addEventListener('devicechange', async () => {
      // AudioContext may follow a disappeared device automatically on some OSs.
      // Suspend it until the next explicit test/press validates the route again.
      generation++;stop();if(context)await context.suspend();
      const list=await outputs();if(selectedSink!=='default'&&!list.devices.some(d=>d.deviceId===selectedSink))warn('Selected bell output disconnected. No fallback output was used.');
    });
    return { outputs, play };
  };
})(window);
