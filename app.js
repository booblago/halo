(() => {
  const STORAGE_KEY = "halo-deepwork-v1";
  const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const DAY_FULL = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ];

  const eur = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  const defaultState = () => ({
    settings: {
      name: "",
      hourlyRate: 85,
      weeklyCapacity: 30,
    },
    blocks: [],
    sessions: [],
    mixer: { drift: 35, rain: 20, room: 25 },
  });

  let state = load();
  let session = {
    running: false,
    paused: false,
    totalMs: 25 * 60 * 1000,
    remainingMs: 25 * 60 * 1000,
    tickId: null,
    endsAt: 0,
  };

  const els = {
    weekLabel: document.getElementById("weekLabel"),
    utilValue: document.getElementById("utilValue"),
    utilSub: document.getElementById("utilSub"),
    eurValue: document.getElementById("eurValue"),
    radialSvg: document.getElementById("radialSvg"),
    dayLegend: document.getElementById("dayLegend"),
    emptyHint: document.getElementById("emptyHint"),
    blockList: document.getElementById("blockList"),
    heatmap: document.getElementById("heatmap"),
    timerDisplay: document.getElementById("timerDisplay"),
    sessionDay: document.getElementById("sessionDay"),
    startBtn: document.getElementById("startBtn"),
    pauseBtn: document.getElementById("pauseBtn"),
    completeBtn: document.getElementById("completeBtn"),
    muteAllBtn: document.getElementById("muteAllBtn"),
    gainDrift: document.getElementById("gainDrift"),
    gainRain: document.getElementById("gainRain"),
    gainRoom: document.getElementById("gainRoom"),
    vizCanvas: document.getElementById("vizCanvas"),
    blockModal: document.getElementById("blockModal"),
    settingsModal: document.getElementById("settingsModal"),
    blockForm: document.getElementById("blockForm"),
    settingsForm: document.getElementById("settingsForm"),
    blockId: document.getElementById("blockId"),
    blockDay: document.getElementById("blockDay"),
    blockHours: document.getElementById("blockHours"),
    blockLabel: document.getElementById("blockLabel"),
    blockType: document.getElementById("blockType"),
    deleteBlockBtn: document.getElementById("deleteBlockBtn"),
    cancelBlockBtn: document.getElementById("cancelBlockBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    settingName: document.getElementById("settingName"),
    settingRate: document.getElementById("settingRate"),
    settingCapacity: document.getElementById("settingCapacity"),
    toast: document.getElementById("toast"),
    presets: [...document.querySelectorAll(".chip[data-minutes]")],
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        settings: { ...defaultState().settings, ...(parsed.settings || {}) },
        mixer: { ...defaultState().mixer, ...(parsed.mixer || {}) },
        blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [],
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    } catch {
      return defaultState();
    }
  }

  function save(flash = false) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (flash) showToast("Saved");
  }

  function showToast(message) {
    els.toast.textContent = message;
    els.toast.hidden = false;
    els.toast.classList.remove("save-flash");
    void els.toast.offsetWidth;
    els.toast.classList.add("save-flash");
    window.setTimeout(() => {
      els.toast.hidden = true;
    }, 900);
  }

  function uid() {
    return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function startOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - day);
    return d;
  }

  function weekKey(date = new Date()) {
    const s = startOfWeek(date);
    return s.toISOString().slice(0, 10);
  }

  function formatWeekLabel() {
    const start = startOfWeek();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
    els.weekLabel.textContent = `${fmt.format(start)} – ${fmt.format(end)}`;
  }

  function deepHours() {
    return state.blocks
      .filter((b) => b.type === "deep")
      .reduce((sum, b) => sum + Number(b.hours || 0), 0);
  }

  function billableHours() {
    return state.blocks.reduce((sum, b) => sum + Number(b.hours || 0), 0);
  }

  function hoursByDay() {
    const map = Array.from({ length: 7 }, () => ({ deep: 0, admin: 0, total: 0 }));
    state.blocks.forEach((b) => {
      const day = Number(b.day);
      if (day < 0 || day > 6) return;
      const h = Number(b.hours) || 0;
      map[day][b.type === "admin" ? "admin" : "deep"] += h;
      map[day].total += h;
    });
    return map;
  }

  function polar(cx, cy, r, angle) {
    return {
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  }

  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polar(cx, cy, r, endAngle);
    const end = polar(cx, cy, r, startAngle);
    const large = endAngle - startAngle <= Math.PI ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
  }

  function renderRadial() {
    const svg = els.radialSvg;
    const cx = 210;
    const cy = 210;
    const radius = 148;
    const trackWidth = 22;
    const gap = 0.09;
    const slice = (Math.PI * 2) / 7;
    const byDay = hoursByDay();
    const dayCap = Math.max(1, state.settings.weeklyCapacity / 5);

    svg.innerHTML = "";

    const utilRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    utilRing.setAttribute("cx", cx);
    utilRing.setAttribute("cy", cy);
    utilRing.setAttribute("r", "96");
    utilRing.setAttribute("fill", "none");
    utilRing.setAttribute("stroke", "rgba(20,32,40,0.08)");
    utilRing.setAttribute("stroke-width", "8");
    svg.appendChild(utilRing);

    const util = Math.min(1, deepHours() / Math.max(1, state.settings.weeklyCapacity));
    const utilArc = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const utilStart = -Math.PI / 2;
    const utilEnd = utilStart + util * Math.PI * 2;
    utilArc.setAttribute("d", describeArc(cx, cy, 96, utilStart, Math.max(utilStart + 0.001, utilEnd)));
    utilArc.setAttribute("fill", "none");
    utilArc.setAttribute("stroke", "#1f6f78");
    utilArc.setAttribute("stroke-width", "8");
    utilArc.setAttribute("stroke-linecap", "round");
    utilArc.style.opacity = util > 0 ? "1" : "0";
    svg.appendChild(utilArc);

    byDay.forEach((day, i) => {
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.classList.add("day-group");
      group.dataset.day = String(i);

      const startAngle = -Math.PI / 2 + i * slice + gap / 2;
      const endAngle = -Math.PI / 2 + (i + 1) * slice - gap / 2;
      const mid = (startAngle + endAngle) / 2;

      const hit = document.createElementNS("http://www.w3.org/2000/svg", "path");
      const outer = polar(cx, cy, radius + trackWidth, startAngle);
      const outer2 = polar(cx, cy, radius + trackWidth, endAngle);
      const inner = polar(cx, cy, radius - trackWidth, endAngle);
      const inner2 = polar(cx, cy, radius - trackWidth, startAngle);
      const large = endAngle - startAngle > Math.PI ? 1 : 0;
      hit.setAttribute(
        "d",
        [
          `M ${outer.x} ${outer.y}`,
          `A ${radius + trackWidth} ${radius + trackWidth} 0 ${large} 1 ${outer2.x} ${outer2.y}`,
          `L ${inner.x} ${inner.y}`,
          `A ${radius - trackWidth} ${radius - trackWidth} 0 ${large} 0 ${inner2.x} ${inner2.y}`,
          "Z",
        ].join(" ")
      );
      hit.classList.add("day-hit");
      hit.addEventListener("click", () => openBlockModal({ day: i }));

      const track = document.createElementNS("http://www.w3.org/2000/svg", "path");
      track.setAttribute("d", describeArc(cx, cy, radius, startAngle, endAngle));
      track.classList.add("day-track");
      track.setAttribute("stroke-width", String(trackWidth));

      const fillRatio = Math.min(1, day.total / dayCap);
      const fillEnd = startAngle + (endAngle - startAngle) * Math.max(fillRatio, fillRatio > 0 ? 0.04 : 0);
      const arc = document.createElementNS("http://www.w3.org/2000/svg", "path");
      arc.setAttribute("d", describeArc(cx, cy, radius, startAngle, fillEnd));
      arc.classList.add("day-arc", day.admin > day.deep ? "admin" : "deep");
      arc.setAttribute("stroke-width", String(trackWidth - 4));
      arc.style.opacity = day.total > 0 ? "1" : "0";
      arc.style.animationDelay = `${i * 40}ms`;

      const labelPos = polar(cx, cy, radius + 42, mid);
      const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
      label.setAttribute("x", labelPos.x);
      label.setAttribute("y", labelPos.y);
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "middle");
      label.classList.add("day-label");
      label.textContent = DAY_NAMES[i];

      group.append(hit, track, arc, label);
      svg.appendChild(group);
    });
  }

  function renderCore() {
    const deep = deepHours();
    const cap = state.settings.weeklyCapacity;
    const util = Math.round((deep / Math.max(1, cap)) * 100);
    els.utilValue.textContent = `${util}%`;
    els.utilSub.textContent = `${formatHours(deep)} of ${formatHours(cap)} h deep`;
    els.eurValue.textContent = eur.format(billableHours() * state.settings.hourlyRate);
  }

  function formatHours(h) {
    const n = Number(h) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  function renderLegend() {
    els.dayLegend.innerHTML = DAY_NAMES.map(
      (name, i) => `<button type="button" class="day-pill" data-day="${i}">${name}</button>`
    ).join("");
    els.dayLegend.querySelectorAll(".day-pill").forEach((btn) => {
      btn.addEventListener("click", () => openBlockModal({ day: Number(btn.dataset.day) }));
    });
  }

  function renderBlocks() {
    const sorted = [...state.blocks].sort((a, b) => a.day - b.day || b.hours - a.hours);
    els.emptyHint.hidden = sorted.length > 0;
    els.blockList.innerHTML = sorted
      .map(
        (b) => `
        <li>
          <button type="button" class="block-item" data-id="${b.id}">
            <span class="block-badge ${b.type === "admin" ? "admin" : ""}" aria-hidden="true"></span>
            <span>
              <strong>${escapeHtml(b.label)}</strong>
              <span>${DAY_FULL[b.day]} · ${b.type === "admin" ? "Admin" : "Deep"}</span>
            </span>
            <span class="block-hours">${formatHours(b.hours)}h</span>
          </button>
        </li>`
      )
      .join("");
    els.blockList.querySelectorAll(".block-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const block = state.blocks.find((b) => b.id === btn.dataset.id);
        if (block) openBlockModal(block);
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderHeatmap() {
    const weeks = [];
    const start = startOfWeek();
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(start);
      d.setDate(d.getDate() - i * 7);
      const key = weekKey(d);
      const hours = state.sessions
        .filter((s) => s.weekKey === key)
        .reduce((sum, s) => sum + Number(s.hours || 0), 0);
      weeks.push({ key, hours, date: d });
    }
    const max = Math.max(1, ...weeks.map((w) => w.hours));
    const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "short" });

    els.heatmap.innerHTML = weeks
      .map((w) => {
        const intensity = w.hours / max;
        const bg = `rgba(31, 111, 120, ${0.08 + intensity * 0.72})`;
        return `<div class="heat-cell" style="background:${bg}" title="${w.key}: ${formatHours(w.hours)}h">
          <strong>${formatHours(w.hours)}</strong>
          <span>${monthFmt.format(w.date)} ${w.date.getDate()}</span>
        </div>`;
      })
      .join("");
  }

  function fillDaySelects() {
    const options = DAY_FULL.map((name, i) => `<option value="${i}">${name}</option>`).join("");
    els.blockDay.innerHTML = options;
    els.sessionDay.innerHTML = options;
    const today = (new Date().getDay() + 6) % 7;
    els.sessionDay.value = String(today);
  }

  function openBlockModal(block = {}) {
    const editing = Boolean(block.id);
    els.blockId.value = block.id || "";
    els.blockDay.value = String(block.day ?? (new Date().getDay() + 6) % 7);
    els.blockHours.value = block.hours ?? 2;
    els.blockLabel.value = block.label || "";
    els.blockType.value = block.type || "deep";
    els.deleteBlockBtn.hidden = !editing;
    document.getElementById("modalTitle").textContent = editing ? "Edit arc" : "Deep-work arc";
    els.blockModal.hidden = false;
    els.blockLabel.focus();
  }

  function closeBlockModal() {
    els.blockModal.hidden = true;
  }

  function openSettings() {
    els.settingName.value = state.settings.name || "";
    els.settingRate.value = state.settings.hourlyRate;
    els.settingCapacity.value = state.settings.weeklyCapacity;
    els.settingsModal.hidden = false;
  }

  function closeSettings() {
    els.settingsModal.hidden = true;
  }

  function renderAll() {
    formatWeekLabel();
    renderRadial();
    renderCore();
    renderBlocks();
    renderHeatmap();
  }

  function formatTimer(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function syncTimerUi() {
    els.timerDisplay.textContent = formatTimer(session.remainingMs);
    els.startBtn.disabled = session.running && !session.paused;
    els.pauseBtn.disabled = !session.running || session.paused;
    els.completeBtn.disabled = !session.running && session.remainingMs === session.totalMs;
    if (session.running && !session.paused) {
      els.startBtn.textContent = "Running";
    } else if (session.paused) {
      els.startBtn.textContent = "Resume";
      els.startBtn.disabled = false;
    } else {
      els.startBtn.textContent = "Start focus";
    }
  }

  function clearTick() {
    if (session.tickId) {
      clearInterval(session.tickId);
      session.tickId = null;
    }
  }

  async function startSession() {
    try {
      await HaloAudio.start();
      applyMixerGains();
      HaloViz.start();
    } catch (err) {
      showToast("Audio unavailable — timer still works");
      console.warn(err);
    }

    if (session.paused) {
      session.paused = false;
      session.endsAt = Date.now() + session.remainingMs;
    } else if (!session.running) {
      session.running = true;
      session.paused = false;
      session.remainingMs = session.totalMs;
      session.endsAt = Date.now() + session.remainingMs;
    }

    clearTick();
    session.tickId = window.setInterval(() => {
      session.remainingMs = Math.max(0, session.endsAt - Date.now());
      syncTimerUi();
      if (session.remainingMs <= 0) {
        completeSession(true);
      }
    }, 200);
    syncTimerUi();
  }

  function pauseSession() {
    if (!session.running || session.paused) return;
    session.paused = true;
    session.remainingMs = Math.max(0, session.endsAt - Date.now());
    clearTick();
    HaloViz.stop();
    syncTimerUi();
  }

  function completeSession(auto = false) {
    if (!session.running && session.remainingMs === session.totalMs) return;
    const elapsedMs = session.totalMs - session.remainingMs;
    const hours = Math.max(0.25, Math.round((elapsedMs / 3600000) * 4) / 4);
    const day = Number(els.sessionDay.value);
    const label = state.settings.name ? `${state.settings.name} · focus` : "Focus session";

    state.sessions.push({
      id: uid(),
      weekKey: weekKey(),
      day,
      hours,
      at: new Date().toISOString(),
    });

    const existing = state.blocks.find(
      (b) => b.day === day && b.type === "deep" && b.label.toLowerCase().includes("focus")
    );
    if (existing) {
      existing.hours = Number((Number(existing.hours) + hours).toFixed(2));
    } else {
      state.blocks.push({
        id: uid(),
        day,
        hours,
        label,
        type: "deep",
      });
    }

    session.running = false;
    session.paused = false;
    session.remainingMs = session.totalMs;
    clearTick();
    HaloViz.stop();
    save(true);
    renderAll();
    syncTimerUi();
    showToast(auto ? `Session complete · +${formatHours(hours)}h` : `Landed ${formatHours(hours)}h`);
  }

  function applyMixerGains() {
    HaloAudio.setLayerLevel("drift", Number(els.gainDrift.value) / 100);
    HaloAudio.setLayerLevel("rain", Number(els.gainRain.value) / 100);
    HaloAudio.setLayerLevel("room", Number(els.gainRoom.value) / 100);
  }

  function bindEvents() {
    els.settingsBtn.addEventListener("click", openSettings);
    els.cancelSettingsBtn.addEventListener("click", closeSettings);
    els.cancelBlockBtn.addEventListener("click", closeBlockModal);

    els.settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.settings.name = els.settingName.value.trim();
      state.settings.hourlyRate = Math.max(0, Number(els.settingRate.value) || 0);
      state.settings.weeklyCapacity = Math.max(1, Number(els.settingCapacity.value) || 1);
      save(true);
      closeSettings();
      renderAll();
    });

    els.blockForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = els.blockId.value;
      const payload = {
        id: id || uid(),
        day: Number(els.blockDay.value),
        hours: Math.max(0.5, Number(els.blockHours.value) || 0.5),
        label: els.blockLabel.value.trim() || "Untitled",
        type: els.blockType.value === "admin" ? "admin" : "deep",
      };
      if (id) {
        const idx = state.blocks.findIndex((b) => b.id === id);
        if (idx >= 0) state.blocks[idx] = payload;
      } else {
        state.blocks.push(payload);
      }
      save(true);
      closeBlockModal();
      renderAll();
    });

    els.deleteBlockBtn.addEventListener("click", () => {
      const id = els.blockId.value;
      state.blocks = state.blocks.filter((b) => b.id !== id);
      save(true);
      closeBlockModal();
      renderAll();
    });

    [els.blockModal, els.settingsModal].forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) {
          modal.hidden = true;
        }
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeBlockModal();
        closeSettings();
      }
    });

    els.presets.forEach((chip) => {
      chip.addEventListener("click", () => {
        if (session.running) return;
        els.presets.forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        const minutes = Number(chip.dataset.minutes);
        session.totalMs = minutes * 60 * 1000;
        session.remainingMs = session.totalMs;
        syncTimerUi();
      });
    });

    els.startBtn.addEventListener("click", () => {
      startSession();
    });
    els.pauseBtn.addEventListener("click", pauseSession);
    els.completeBtn.addEventListener("click", () => completeSession(false));

    els.muteAllBtn.addEventListener("click", () => {
      const next = !HaloAudio.isMuted();
      HaloAudio.setMuted(next);
      els.muteAllBtn.textContent = next ? "Unmute" : "Mute all";
    });

    const gainMap = [
      [els.gainDrift, "drift"],
      [els.gainRain, "rain"],
      [els.gainRoom, "room"],
    ];
    gainMap.forEach(([input, key]) => {
      input.value = String(state.mixer[key] ?? input.value);
      input.addEventListener("input", () => {
        state.mixer[key] = Number(input.value);
        HaloAudio.setLayerLevel(key, Number(input.value) / 100);
        save(false);
      });
    });
  }

  function seedDemoIfEmpty() {
    if (state.blocks.length || state.sessions.length) return;
    const today = (new Date().getDay() + 6) % 7;
    state.blocks = [
      { id: uid(), day: Math.max(0, today - 1), hours: 3, label: "Studio redesign", type: "deep" },
      { id: uid(), day: today, hours: 2.5, label: "Client discovery", type: "deep" },
      { id: uid(), day: Math.min(6, today + 1), hours: 1, label: "Invoices", type: "admin" },
    ];
    const wk = weekKey();
    for (let i = 1; i <= 8; i += 1) {
      const d = startOfWeek();
      d.setDate(d.getDate() - i * 7);
      state.sessions.push({
        id: uid(),
        weekKey: weekKey(d),
        day: 2,
        hours: 4 + ((i * 3) % 7),
        at: d.toISOString(),
      });
    }
    state.sessions.push({
      id: uid(),
      weekKey: wk,
      day: today,
      hours: 2,
      at: new Date().toISOString(),
    });
    save(false);
  }

  function init() {
    seedDemoIfEmpty();
    fillDaySelects();
    bindEvents();
    HaloViz.init(els.vizCanvas);
    applyMixerGains();
    renderAll();
    syncTimerUi();
  }

  init();
})();
