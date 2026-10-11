/**
 * HALO canvas field — rings driven by mixer energy.
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
    drawIdle();
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

  function drawIdle() {
    if (!ctx || !canvas) return;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2;
    const cy = h / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.18, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(31, 111, 120, 0.35)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, Math.min(w, h) * 0.28, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(184, 115, 51, 0.22)";
    ctx.stroke();
  }

  function frame() {
    if (!active || !ctx) return;
    resize();
    const { width: w, height: h } = canvas;
    const cx = w / 2;
    const cy = h / 2;
    const energy = typeof HaloAudio !== "undefined" ? HaloAudio.getLevel() : 0.1;
    phase += 0.02 + energy * 0.08;

    ctx.clearRect(0, 0, w, h);

    const analyser = HaloAudio.getAnalyser && HaloAudio.getAnalyser();
    let bins = null;
    if (analyser) {
      bins = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(bins);
    }

    const base = Math.min(w, h) * 0.12;
    for (let i = 0; i < 5; i += 1) {
      const t = (i + 1) / 5;
      const pulse = bins
        ? bins[Math.floor(t * (bins.length - 1))] / 255
        : 0.2 + Math.sin(phase + i) * 0.05;
      const radius = base + i * (Math.min(w, h) * 0.07) + pulse * Math.min(w, h) * 0.08;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, phase * (0.4 + i * 0.05), phase * (0.4 + i * 0.05) + Math.PI * 1.4);
      ctx.strokeStyle =
        i % 2 === 0
          ? `rgba(120, 210, 214, ${0.25 + pulse * 0.55})`
          : `rgba(214, 164, 110, ${0.2 + pulse * 0.45})`;
      ctx.lineWidth = 2 + pulse * 3;
      ctx.lineCap = "round";
      ctx.stroke();
    }

    if (bins) {
      const barCount = 36;
      const step = Math.floor(bins.length / barCount);
      for (let i = 0; i < barCount; i += 1) {
        const v = bins[i * step] / 255;
        const ang = (i / barCount) * Math.PI * 2 - Math.PI / 2;
        const inner = Math.min(w, h) * 0.08;
        const outer = inner + v * Math.min(w, h) * 0.16;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
        ctx.lineTo(cx + Math.cos(ang) * outer, cy + Math.sin(ang) * outer);
        ctx.strokeStyle = `rgba(238, 246, 247, ${0.25 + v * 0.55})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (active) return;
    active = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    active = false;
    cancelAnimationFrame(raf);
    drawIdle();
  }

  window.addEventListener("resize", () => {
    resize();
    if (!active) drawIdle();
  });

  return { init, start, stop, resize };
})();
