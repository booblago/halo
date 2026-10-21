/**
 * HALO canvas field — flat waveform + pulse bars (2D).
 */
const HaloViz = (() => {
  let canvas = null;
  let ctx = null;
  let raf = 0;
  let active = false;
  let phase = 0;

  function init(el) {
    canvas = el;
    ctx = canvas.getContext("2d");
    resize();
    startIdle();
  }

  function resize() {
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width * ratio));
    const h = Math.max(140, Math.floor(rect.height * ratio));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function drawScene(intensity = 0.2) {
    if (!ctx || !canvas) return;
    const { width: w, height: h } = canvas;
    phase += 0.035 + intensity * 0.06;
    ctx.clearRect(0, 0, w, h);

    const analyser = active && HaloAudio.getAnalyser ? HaloAudio.getAnalyser() : null;
    let bins = null;
    if (analyser) {
      bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
    }

    // baseline
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.55);
    ctx.lineTo(w, h * 0.55);
    ctx.stroke();

    // waveform
    ctx.beginPath();
    const steps = 64;
    for (let i = 0; i <= steps; i += 1) {
      const x = (i / steps) * w;
      const sample = bins
        ? bins[Math.floor((i / steps) * (bins.length - 1))] / 255
        : 0.2 + Math.sin(phase * 1.6 + i * 0.28) * 0.12;
      const y = h * 0.55 - sample * h * (0.22 + intensity * 0.25);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "rgba(47, 173, 179, 0.15)");
    grad.addColorStop(0.5, "rgba(180, 245, 248, 0.85)");
    grad.addColorStop(1, "rgba(192, 122, 54, 0.45)");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2.5 * (window.devicePixelRatio || 1) * 0.7;
    ctx.stroke();

    // mirrored fill
    ctx.lineTo(w, h * 0.55);
    ctx.lineTo(0, h * 0.55);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, h * 0.2, 0, h * 0.55);
    fill.addColorStop(0, "rgba(47, 173, 179, 0.18)");
    fill.addColorStop(1, "rgba(47, 173, 179, 0)");
    ctx.fillStyle = fill;
    ctx.fill();

    // vertical pulse bars
    const bars = 28;
    const gap = w / bars;
    for (let i = 0; i < bars; i += 1) {
      const v = bins
        ? bins[Math.floor((i / bars) * (bins.length - 1))] / 255
        : 0.15 + Math.abs(Math.sin(phase + i * 0.4)) * 0.35;
      const bh = v * h * 0.35;
      const x = i * gap + gap * 0.28;
      const bw = gap * 0.44;
      ctx.fillStyle = i % 3 === 0 ? `rgba(192,122,54,${0.2 + v * 0.45})` : `rgba(47,173,179,${0.2 + v * 0.5})`;
      ctx.fillRect(x, h * 0.78 - bh, bw, bh);
    }
  }

  function loop() {
    resize();
    const energy = active && typeof HaloAudio !== "undefined" ? HaloAudio.getLevel() : 0.18;
    drawScene(energy);
    raf = requestAnimationFrame(loop);
  }

  function startIdle() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(loop);
  }

  function start() {
    active = true;
    startIdle();
  }

  function stop() {
    active = false;
  }

  window.addEventListener("resize", resize);

  return { init, start, stop, resize };
})();
