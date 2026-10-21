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
  let currentUser = null;
  let syncTimer = null;
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
    utilFill: document.getElementById("utilFill"),
    weekRunway: document.getElementById("weekRunway"),
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
    accountModal: document.getElementById("accountModal"),
    blockForm: document.getElementById("blockForm"),
    settingsForm: document.getElementById("settingsForm"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    blockId: document.getElementById("blockId"),
    blockDay: document.getElementById("blockDay"),
    blockHours: document.getElementById("blockHours"),
    blockLabel: document.getElementById("blockLabel"),
    blockType: document.getElementById("blockType"),
    deleteBlockBtn: document.getElementById("deleteBlockBtn"),
    cancelBlockBtn: document.getElementById("cancelBlockBtn"),
    settingsBtn: document.getElementById("settingsBtn"),
    accountBtn: document.getElementById("accountBtn"),
    cancelSettingsBtn: document.getElementById("cancelSettingsBtn"),
    settingName: document.getElementById("settingName"),
    settingRate: document.getElementById("settingRate"),
    settingCapacity: document.getElementById("settingCapacity"),
    accountSignedIn: document.getElementById("accountSignedIn"),
    accountSignedOut: document.getElementById("accountSignedOut"),
    accountEmail: document.getElementById("accountEmail"),
    accountSyncNote: document.getElementById("accountSyncNote"),
    tabLogin: document.getElementById("tabLogin"),
    tabRegister: document.getElementById("tabRegister"),
    loginEmail: document.getElementById("loginEmail"),
    loginPassword: document.getElementById("loginPassword"),
    loginError: document.getElementById("loginError"),
    registerName: document.getElementById("registerName"),
    registerEmail: document.getElementById("registerEmail"),
    registerPassword: document.getElementById("registerPassword"),
    registerError: document.getElementById("registerError"),
    syncNowBtn: document.getElementById("syncNowBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    closeAccountBtn: document.getElementById("closeAccountBtn"),
    cancelLoginBtn: document.getElementById("cancelLoginBtn"),
    cancelRegisterBtn: document.getElementById("cancelRegisterBtn"),
    toast: document.getElementById("toast"),
    presets: [...document.querySelectorAll(".chip[data-minutes]")],
  };

  function normalizeState(raw) {
    const base = defaultState();
    if (!raw || typeof raw !== "object") return base;
    return {
      ...base,
      ...raw,
      settings: { ...base.settings, ...(raw.settings || {}) },
      mixer: { ...base.mixer, ...(raw.mixer || {}) },
      blocks: Array.isArray(raw.blocks) ? raw.blocks : [],
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return normalizeState(JSON.parse(raw));
    } catch {
      return defaultState();
    }
  }

  function save(flash = false) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (flash) showToast(currentUser ? "Saved · syncing" : "Saved");
    queueCloud(flash);
  }

  function queueCloud(flash) {
    if (!currentUser) return;
    if (syncTimer) window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncToCloud(flash);
    }, flash ? 80 : 450);
  }

  async function api(path, options = {}) {
    const res = await fetch(path, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function syncToCloud(flash = false) {
    if (!currentUser) return;
    try {
      await api("/api/state", {
        method: "PUT",
        body: JSON.stringify({ state }),
      });
      if (flash) showToast("Synced to cloud");
      if (els.accountSyncNote) {
        els.accountSyncNote.textContent = `Last sync ${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })} · Neon Postgres`;
      }
    } catch (err) {
      console.warn(err);
      if (flash) showToast("Saved locally · cloud sync failed");
    }
  }

  function applyRemoteState(remote) {
    if (!remote) return;
    state = normalizeState(remote);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (els.gainDrift) els.gainDrift.value = String(state.mixer.drift ?? 35);
    if (els.gainRain) els.gainRain.value = String(state.mixer.rain ?? 20);
    if (els.gainRoom) els.gainRoom.value = String(state.mixer.room ?? 25);
    applyMixerGains();
    renderAll();
  }

  function setAccountMode(mode) {
    const login = mode === "login";
    els.tabLogin.classList.toggle("active", login);
    els.tabRegister.classList.toggle("active", !login);
    els.tabLogin.setAttribute("aria-selected", login ? "true" : "false");
    els.tabRegister.setAttribute("aria-selected", login ? "false" : "true");
    els.loginForm.hidden = !login;
    els.registerForm.hidden = login;
    els.loginError.hidden = true;
    els.registerError.hidden = true;
  }

  function renderAccountUi() {
    const signedIn = Boolean(currentUser);
    els.accountSignedIn.hidden = !signedIn;
    els.accountSignedOut.hidden = signedIn;
    els.accountBtn.textContent = signedIn
      ? currentUser.name || currentUser.email.split("@")[0]
      : "Account";
    if (signedIn) {
      els.accountEmail.textContent = currentUser.email;
      els.accountSyncNote.textContent = "Cloud sync is on — week data saves to Postgres.";
    }
  }

  function openAccount() {
    renderAccountUi();
    if (!currentUser) setAccountMode("login");
    els.accountModal.hidden = false;
  }

  function closeAccount() {
    els.accountModal.hidden = true;
  }

  async function refreshSession() {
    try {
      const data = await api("/api/auth/me");
      currentUser = data.user || null;
      if (currentUser && data.state) {
        applyRemoteState(data.state);
      }
      renderAccountUi();
    } catch (err) {
      console.warn(err);
      currentUser = null;
      renderAccountUi();
    }
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

  function renderWeekRunway() {
    const byDay = hoursByDay();
    const dayCap = Math.max(1, state.settings.weeklyCapacity / 5);
    const today = (new Date().getDay() + 6) % 7;

    els.weekRunway.innerHTML = byDay
      .map((day, i) => {
        const ratio = Math.min(1, day.total / dayCap);
        const height = `${Math.max(day.total > 0 ? 8 : 0, ratio * 100)}%`;
        const kind =
          day.deep > 0 && day.admin > 0 ? "mixed" : day.admin > day.deep ? "admin" : "deep";
        return `
          <button type="button" class="day-lane${i === today ? " is-today" : ""}" data-day="${i}" role="listitem" style="animation-delay:${i * 45}ms">
            <span class="day-lane-name">${DAY_NAMES[i]}</span>
            <span class="day-lane-track">
              <span class="day-lane-fill ${kind}" style="height:${height}; animation-delay:${i * 55}ms"></span>
            </span>
            <span class="day-lane-hours">${day.total ? `${formatHours(day.total)}h` : "—"}</span>
          </button>`;
      })
      .join("");

    els.weekRunway.querySelectorAll(".day-lane").forEach((btn) => {
      btn.addEventListener("click", () => openBlockModal({ day: Number(btn.dataset.day) }));
    });
  }

  function renderCore() {
    const deep = deepHours();
    const cap = state.settings.weeklyCapacity;
    const util = Math.min(100, Math.round((deep / Math.max(1, cap)) * 100));
    els.utilValue.textContent = `${util}%`;
    els.utilSub.textContent = `${formatHours(deep)} of ${formatHours(cap)} h deep`;
    els.eurValue.textContent = eur.format(billableHours() * state.settings.hourlyRate);
    if (els.utilFill) els.utilFill.style.width = `${util}%`;
  }

  function formatHours(h) {
    const n = Number(h) || 0;
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
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
      .map((w, idx) => {
        const intensity = w.hours / max;
        const bg = `linear-gradient(160deg, rgba(180,245,248,${0.35 + intensity * 0.45}), rgba(26,109,118,${0.2 + intensity * 0.65}))`;
        return `<div class="heat-cell" style="background:${bg}; animation-delay:${idx * 40}ms" title="${w.key}: ${formatHours(w.hours)}h">
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
    document.getElementById("modalTitle").textContent = editing ? "Edit block" : "Deep-work block";
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
    renderWeekRunway();
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
    els.accountBtn.addEventListener("click", openAccount);
    els.cancelSettingsBtn.addEventListener("click", closeSettings);
    els.cancelBlockBtn.addEventListener("click", closeBlockModal);
    els.closeAccountBtn.addEventListener("click", closeAccount);
    els.cancelLoginBtn.addEventListener("click", closeAccount);
    els.cancelRegisterBtn.addEventListener("click", closeAccount);
    els.tabLogin.addEventListener("click", () => setAccountMode("login"));
    els.tabRegister.addEventListener("click", () => setAccountMode("register"));

    els.settingsForm.addEventListener("submit", (e) => {
      e.preventDefault();
      state.settings.name = els.settingName.value.trim();
      state.settings.hourlyRate = Math.max(0, Number(els.settingRate.value) || 0);
      state.settings.weeklyCapacity = Math.max(1, Number(els.settingCapacity.value) || 1);
      save(true);
      closeSettings();
      renderAll();
    });

    els.loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      els.loginError.hidden = true;
      try {
        const data = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: els.loginEmail.value,
            password: els.loginPassword.value,
          }),
        });
        currentUser = data.user;
        if (data.state) applyRemoteState(data.state);
        else await syncToCloud(false);
        renderAccountUi();
        closeAccount();
        showToast("Signed in");
        els.loginPassword.value = "";
      } catch (err) {
        els.loginError.textContent = err.message || "Sign in failed";
        els.loginError.hidden = false;
      }
    });

    els.registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      els.registerError.hidden = true;
      try {
        const data = await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            name: els.registerName.value.trim(),
            email: els.registerEmail.value,
            password: els.registerPassword.value,
            state,
          }),
        });
        currentUser = data.user;
        if (data.user?.name && !state.settings.name) {
          state.settings.name = data.user.name;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }
        renderAccountUi();
        closeAccount();
        showToast("Account created · synced");
        els.registerPassword.value = "";
      } catch (err) {
        els.registerError.textContent = err.message || "Could not create account";
        els.registerError.hidden = false;
      }
    });

    els.syncNowBtn.addEventListener("click", () => syncToCloud(true));
    els.logoutBtn.addEventListener("click", async () => {
      try {
        await api("/api/auth/logout", { method: "POST", body: "{}" });
      } catch (err) {
        console.warn(err);
      }
      currentUser = null;
      renderAccountUi();
      closeAccount();
      showToast("Signed out");
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

    [els.blockModal, els.settingsModal, els.accountModal].forEach((modal) => {
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
        closeAccount();
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

  async function init() {
    seedDemoIfEmpty();
    fillDaySelects();
    bindEvents();
    HaloViz.init(els.vizCanvas);
    applyMixerGains();
    renderAll();
    syncTimerUi();
    renderAccountUi();
    await refreshSession();
  }

  init();
})();
