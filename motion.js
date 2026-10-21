/**
 * HALO scene motion — soft pointer wash + floating dust (2D).
 */
const HaloMotion = (() => {
  function spawnDust() {
    const host = document.getElementById("worldDust");
    if (!host) return;
    host.innerHTML = "";
    const count = window.matchMedia("(max-width: 700px)").matches ? 8 : 18;
    for (let i = 0; i < count; i += 1) {
      const speck = document.createElement("span");
      speck.style.left = `${Math.random() * 100}%`;
      speck.style.top = `${Math.random() * 100}%`;
      speck.style.animationDuration = `${11 + Math.random() * 14}s`;
      speck.style.animationDelay = `${-Math.random() * 12}s`;
      speck.style.opacity = String(0.2 + Math.random() * 0.45);
      host.appendChild(speck);
    }
  }

  function onPointer(e) {
    const x = (e.clientX / window.innerWidth) * 100;
    const y = (e.clientY / window.innerHeight) * 100;
    document.documentElement.style.setProperty("--pointer-x", `${x.toFixed(2)}%`);
    document.documentElement.style.setProperty("--pointer-y", `${y.toFixed(2)}%`);
  }

  function init() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    spawnDust();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("resize", spawnDust);
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => HaloMotion.init());
