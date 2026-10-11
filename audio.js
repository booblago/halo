/**
 * HALO ambient mixer — Web Audio synthesis (no external files).
 * Layers: Drift (slow tones), Rain (filtered noise), Room (brownish bed).
 */
const HaloAudio = (() => {
  let ctx = null;
  let master = null;
  let analyser = null;
  let started = false;
  let muted = false;

  const layers = {
    drift: { gain: null, nodes: [], level: 0.35 },
    rain: { gain: null, nodes: [], level: 0.2 },
    room: { gain: null, nodes: [], level: 0.25 },
  };

  function ensureContext() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) throw new Error("Web Audio API is not supported in this browser.");
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.7;
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.85;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    return ctx;
  }

  function noiseBuffer(seconds = 2) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * seconds;
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function createNoiseSource(buffer, filterType, frequency, q = 1) {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    src.connect(filter);
    return { src, filter };
  }

  function buildDrift(dest) {
    const freqs = [55, 82.5, 110];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 1 ? "triangle" : "sine";
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = 0.08 - i * 0.015;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + i * 0.015;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 4 + i;
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      osc.connect(g);
      g.connect(dest);
      osc.start();
      lfo.start();
      layers.drift.nodes.push(osc, lfo, g, lfoGain);
    });
  }

  function buildRain(dest) {
    const buffer = noiseBuffer(3);
    const { src, filter } = createNoiseSource(buffer, "bandpass", 1800, 0.7);
    const g = ctx.createGain();
    g.gain.value = 0.22;
    filter.connect(g);
    g.connect(dest);
    src.start();
    layers.rain.nodes.push(src, filter, g);
  }

  function buildRoom(dest) {
    const buffer = noiseBuffer(4);
    const { src, filter } = createNoiseSource(buffer, "lowpass", 320, 0.5);
    const g = ctx.createGain();
    g.gain.value = 0.18;
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.05;
    lfo.connect(lfoGain);
    lfoGain.connect(g.gain);
    filter.connect(g);
    g.connect(dest);
    src.start();
    lfo.start();
    layers.room.nodes.push(src, filter, g, lfo, lfoGain);
  }

  async function start() {
    ensureContext();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
    if (started) return;
    Object.keys(layers).forEach((key) => {
      const g = ctx.createGain();
      g.gain.value = muted ? 0 : layers[key].level;
      g.connect(master);
      layers[key].gain = g;
    });
    buildDrift(layers.drift.gain);
    buildRain(layers.rain.gain);
    buildRoom(layers.room.gain);
    started = true;
  }

  function setLayerLevel(name, value01) {
    if (!layers[name]) return;
    layers[name].level = Math.max(0, Math.min(1, value01));
    if (layers[name].gain && !muted) {
      layers[name].gain.gain.setTargetAtTime(layers[name].level, ctx.currentTime, 0.05);
    }
  }

  function setMuted(next) {
    muted = Boolean(next);
    if (!started) return;
    Object.keys(layers).forEach((key) => {
      const target = muted ? 0 : layers[key].level;
      layers[key].gain.gain.setTargetAtTime(target, ctx.currentTime, 0.04);
    });
  }

  function getAnalyser() {
    return analyser;
  }

  function getLevel() {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) sum += data[i];
    return sum / (data.length * 255);
  }

  function isStarted() {
    return started;
  }

  function isMuted() {
    return muted;
  }

  return {
    start,
    setLayerLevel,
    setMuted,
    getAnalyser,
    getLevel,
    isStarted,
    isMuted,
  };
})();
