/* Loopbox — eine minimalistische Loop-Aufnahme-App.
 *
 * Farbkacheln sind Ordner. Im Ordner: großes + für eine neue Aufnahme.
 * Fertige Aufnahmen erscheinen als nummerierte Blöcke; Antippen spielt ab
 * (ein Punkt gleitet durch den Block und lässt sich zum Spulen ziehen),
 * (×) löscht. Bei einer neuen Aufnahme laufen die alten Aufnahmen des
 * Ordners als Loop mit — wie eine Loop-Box. Export rendert alle Aufnahmen
 * des Ordners gemischt als Video mit der Ordnerfarbe als Hintergrund.
 *
 * Technik: MediaRecorder (Aufnahme), Web Audio (Wiedergabe/Loops/Mix),
 * IndexedDB (Speicher), Canvas-Stream + MediaRecorder (Video-Export).
 */
"use strict";

const APP_VERSION = 6; // sichtbar unter Zahnrad → zeigt, welche Version läuft

// ---------------------------------------------------------------------------
// Ordner (feste Farbpalette)
// ---------------------------------------------------------------------------
const FOLDERS = [
  { id: "coral",  color: "#FF5A5F" },
  { id: "orange", color: "#FF9F1C" },
  { id: "yellow", color: "#F7C948" },
  { id: "green",  color: "#3FA34D" },
  { id: "teal",   color: "#2EC4B6" },
  { id: "blue",   color: "#3A86FF" },
  { id: "purple", color: "#8338EC" },
  { id: "pink",   color: "#FF5D8F" },
];

const MAX_REC_SECONDS = 300; // Sicherheitslimit pro Aufnahme

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------
const settings = {
  countdown: localStorage.getItem("lb.countdown") !== "0",
  loops: localStorage.getItem("lb.loops") !== "0",
  bpm: parseInt(localStorage.getItem("lb.bpm") || "90", 10) || 90,
};
function saveSettings() {
  localStorage.setItem("lb.countdown", settings.countdown ? "1" : "0");
  localStorage.setItem("lb.loops", settings.loops ? "1" : "0");
  localStorage.setItem("lb.bpm", String(settings.bpm));
}

// Metronom pro Ordner, standardmäßig AUS.
function metroEnabled(folderId) {
  return localStorage.getItem("lb.metro." + folderId) === "1";
}
function setMetroEnabled(folderId, on) {
  localStorage.setItem("lb.metro." + folderId, on ? "1" : "0");
}

// ---------------------------------------------------------------------------
// IndexedDB
// ---------------------------------------------------------------------------
let db = null;
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("loopbox", 1);
    req.onupgradeneeded = () => {
      const store = req.result.createObjectStore("recs", { keyPath: "id" });
      store.createIndex("folder", "folder");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function dbAll(folder) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recs").objectStore("recs").index("folder").getAll(folder);
    tx.onsuccess = () => resolve(tx.result.sort((a, b) => a.num - b.num));
    tx.onerror = () => reject(tx.error);
  });
}
function dbCount(folder) {
  return new Promise((resolve) => {
    const tx = db.transaction("recs").objectStore("recs").index("folder").count(folder);
    tx.onsuccess = () => resolve(tx.result);
    tx.onerror = () => resolve(0);
  });
}
function dbPut(rec) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recs", "readwrite").objectStore("recs").put(rec);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function dbDel(id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recs", "readwrite").objectStore("recs").delete(id);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------------------------------------------------------------------------
// Web Audio
// ---------------------------------------------------------------------------
let AC = null;
function ensureCtx() {
  if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
  if (AC.state === "suspended") AC.resume();
  return AC;
}
const bufferCache = new Map(); // rec.id -> AudioBuffer
async function bufferOf(rec) {
  if (bufferCache.has(rec.id)) return bufferCache.get(rec.id);
  // Neue Aufnahmen liegen als ArrayBuffer in der DB (robusteste Variante in
  // Safari); ältere Einträge können noch ein Blob tragen.
  const raw = rec.data ? rec.data.slice(0) : await rec.blob.arrayBuffer();
  const buf = await ensureCtx().decodeAudioData(raw);
  bufferCache.set(rec.id, buf);
  return buf;
}

// ---------------------------------------------------------------------------
// UI-Grundlagen
// ---------------------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const gridView = $("gridView"), folderView = $("folderView");
const blocksEl = $("blocks"), recBtn = $("recBtn"), recTimer = $("recTimer");

let currentFolder = null; // FOLDERS-Eintrag
let recs = [];            // Aufnahmen des offenen Ordners

let toastTimer = 0;
function toast(msg, ms = 2400) {
  const el = $("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), ms);
}

function fmtDur(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return m + ":" + String(r).padStart(2, "0");
}

// ---------------------------------------------------------------------------
// Kachelansicht
// ---------------------------------------------------------------------------
async function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  for (const f of FOLDERS) {
    const tile = document.createElement("button");
    tile.className = "tile";
    tile.style.background = f.color;
    tile.setAttribute("aria-label", "Ordner öffnen");
    const count = document.createElement("div");
    count.className = "count";
    tile.appendChild(count);
    tile.addEventListener("click", () => openFolder(f));
    grid.appendChild(tile);
    dbCount(f.id).then((n) => { if (n > 0) count.textContent = n; });
  }
}

async function openFolder(f) {
  currentFolder = f;
  ensureCtx(); // Nutzergeste: AudioContext hier entsperren
  folderView.style.background = f.color;
  document.querySelector('meta[name="theme-color"]').content = f.color;
  gridView.hidden = true;
  folderView.hidden = false;
  $("metroBtn").classList.toggle("off", !metroEnabled(f.id));
  recs = await dbAll(f.id);
  renderBlocks();
}

function closeFolder() {
  stopAllPlayback();
  if (recActive) stopRecording();
  if (micStream) {
    micStream.getTracks().forEach((t) => t.stop()); // Mikrofon-Anzeige aus
    micStream = null;
  }
  currentFolder = null;
  folderView.hidden = true;
  gridView.hidden = false;
  document.querySelector('meta[name="theme-color"]').content = "#f6f4ef";
  renderGrid();
}

// ---------------------------------------------------------------------------
// Blöcke & Wiedergabe
// ---------------------------------------------------------------------------
// Pro Aufnahme ein Player: { source, startedAt, offset, playing }
const players = new Map();

function renderBlocks() {
  blocksEl.innerHTML = "";
  for (const rec of recs) blocksEl.appendChild(makeBlock(rec));
  blocksEl.scrollTop = blocksEl.scrollHeight;
}

function makeBlock(rec) {
  const el = document.createElement("div");
  el.className = "block";
  el.dataset.id = rec.id;

  const num = document.createElement("div");
  num.className = "num";
  num.textContent = rec.num;

  const track = document.createElement("div");
  track.className = "track";
  const rail = document.createElement("div");
  rail.className = "rail";
  const dot = document.createElement("div");
  dot.className = "dot";
  dot.style.background = currentFolder.color;
  track.appendChild(rail);
  track.appendChild(dot);

  const dur = document.createElement("div");
  dur.className = "dur";
  dur.textContent = fmtDur(rec.duration);

  const mute = document.createElement("button");
  mute.className = "mute";
  mute.setAttribute("aria-label", "Stumm schalten");
  mute.innerHTML =
    '<svg class="muteOn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M11 5L6.5 9H3v6h3.5L11 19V5z" fill="currentColor" stroke="none"/>' +
    '<path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.2 6a9 9 0 0 1 0 12"/></svg>' +
    '<svg class="muteOff" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M11 5L6.5 9H3v6h3.5L11 19V5z" fill="currentColor" stroke="none"/>' +
    '<path d="M15.5 9.5l5 5"/><path d="M20.5 9.5l-5 5"/></svg>';
  if (rec.muted) el.classList.add("muted");

  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "×";
  del.setAttribute("aria-label", "Löschen");

  el.appendChild(num);
  el.appendChild(track);
  el.appendChild(dur);
  el.appendChild(mute);
  el.appendChild(del);

  mute.addEventListener("click", () => setMuted(rec, !rec.muted));

  // Antippen: Wiedergabe starten/stoppen. Ziehen am Punkt: spulen.
  let drag = null;
  track.addEventListener("pointerdown", (e) => {
    const p = players.get(rec.id);
    if (p && p.playing) {
      // Läuft schon: Griff zum Spulen aufnehmen
      drag = { moved: false, wasPlaying: true };
      pausePlayer(rec);
      seekTo(rec, e, track);
      track.setPointerCapture(e.pointerId);
      el.classList.add("scrubbing");
    } else {
      drag = null;
    }
  });
  track.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.moved = true;
    seekTo(rec, e, track);
  });
  track.addEventListener("pointerup", (e) => {
    el.classList.remove("scrubbing");
    if (drag) {
      // Spul-Geste beendet: weiterspielen — außer es war nur ein Tipp (Stopp)
      if (drag.moved) resumePlayer(rec);
      else stopPlayer(rec);
      drag = null;
    } else {
      if (loopAll.active) stopLoopAll();
      startPlayer(rec, 0);
    }
    e.preventDefault();
  });
  track.addEventListener("pointercancel", () => {
    el.classList.remove("scrubbing");
    if (drag) { resumePlayer(rec); drag = null; }
  });

  // Löschen: zweistufig (erst bestätigen), damit nichts aus Versehen weg ist.
  let confirmTimer = 0;
  del.addEventListener("click", async () => {
    if (!el.classList.contains("confirm")) {
      el.classList.add("confirm");
      del.textContent = "sicher?";
      confirmTimer = setTimeout(() => {
        el.classList.remove("confirm");
        del.textContent = "×";
      }, 2500);
      return;
    }
    clearTimeout(confirmTimer);
    stopPlayer(rec);
    stopLoopAllTrack(rec);
    await dbDel(rec.id);
    bufferCache.delete(rec.id);
    recs = recs.filter((r) => r.id !== rec.id);
    el.remove();
  });

  return el;
}

function blockEl(rec) {
  return blocksEl.querySelector(`.block[data-id="${rec.id}"]`);
}

async function startPlayer(rec, offset) {
  ensureCtx();
  stopPlayer(rec);
  const buf = await bufferOf(rec);
  const src = AC.createBufferSource();
  src.buffer = buf;
  src.connect(AC.destination);
  const p = { source: src, startedAt: AC.currentTime, offset, playing: true };
  players.set(rec.id, p);
  src.onended = () => {
    if (players.get(rec.id) === p && p.playing) stopPlayer(rec);
  };
  src.start(0, offset);
  const el = blockEl(rec);
  if (el) el.classList.add("playing");
}

function stopPlayer(rec) {
  const p = players.get(rec.id);
  if (p) {
    p.playing = false;
    try { p.source.stop(); } catch (_) {}
    players.delete(rec.id);
  }
  const el = blockEl(rec);
  if (el) el.classList.remove("playing");
}

function pausePlayer(rec) {
  const p = players.get(rec.id);
  if (!p || !p.playing) return;
  p.offset = Math.min(rec.duration, p.offset + (AC.currentTime - p.startedAt));
  p.playing = false;
  try { p.source.stop(); } catch (_) {}
}

function resumePlayer(rec) {
  const p = players.get(rec.id);
  const offset = p ? p.offset : 0;
  players.delete(rec.id);
  if (offset < rec.duration - 0.05) startPlayer(rec, offset);
  else stopPlayer(rec);
}

function seekTo(rec, e, track) {
  const p = players.get(rec.id);
  if (!p) return;
  const r = track.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - r.left - 8) / (r.width - 16)));
  p.offset = frac * rec.duration;
  positionDot(rec, frac);
}

function positionDot(rec, frac) {
  const el = blockEl(rec);
  if (!el) return;
  const track = el.querySelector(".track");
  const dot = el.querySelector(".dot");
  const w = track.clientWidth - 16;
  dot.style.left = (8 + frac * w) + "px";
}

function stopAllPlayback() {
  for (const rec of recs) stopPlayer(rec);
  players.clear();
  stopLoopAll();
}

// --- Alle Spuren gleichzeitig, geloopt (Play-Button neben dem +) ---------
// Da jede Aufnahme ein Vielfaches der Basis-Länge ist, bleiben alle Spuren
// beim Loopen automatisch synchron.
const loopAll = { active: false, sources: new Map(), startedAt: 0 };

async function startLoopAll() {
  if (recActive || starting) return;
  if (!recs.length) { toast("Noch keine Aufnahme in diesem Ordner"); return; }
  ensureCtx();
  stopAllPlayback();
  const list = [];
  for (const rec of recs) {
    if (rec.muted) continue;
    try { list.push([rec, await bufferOf(rec)]); } catch (_) {}
  }
  if (!list.length) { toast("Alle Spuren sind stummgeschaltet"); return; }
  const t0 = AC.currentTime + 0.06; // gemeinsamer Startpunkt für alle Spuren
  for (const [rec, buf] of list) {
    const src = AC.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(AC.destination);
    src.start(t0);
    loopAll.sources.set(rec.id, src);
    const el = blockEl(rec);
    if (el) el.classList.add("playing");
  }
  loopAll.active = true;
  loopAll.startedAt = t0;
  $("playAllBtn").classList.add("on");
}

function stopLoopAll() {
  if (!loopAll.active && loopAll.sources.size === 0) return;
  for (const src of loopAll.sources.values()) {
    try { src.stop(); } catch (_) {}
  }
  loopAll.sources.clear();
  loopAll.active = false;
  $("playAllBtn").classList.remove("on");
  for (const rec of recs) {
    const el = blockEl(rec);
    if (el && !players.has(rec.id)) el.classList.remove("playing");
  }
}

function stopLoopAllTrack(rec) {
  const src = loopAll.sources.get(rec.id);
  if (src) {
    try { src.stop(); } catch (_) {}
    loopAll.sources.delete(rec.id);
  }
  if (loopAll.active && loopAll.sources.size === 0) stopLoopAll();
}

// --- Stummschalten einzelner Spuren ---------------------------------------
// Wirkt auf Play-All, Loops beim Aufnehmen und den Export. Direktes
// Antippen eines Blocks spielt ihn weiterhin ab (bewusste Aktion).
async function setMuted(rec, muted) {
  rec.muted = muted;
  const el = blockEl(rec);
  if (el) el.classList.toggle("muted", muted);
  dbPut(rec).catch(() => {});
  if (muted) stopPlayer(rec);

  // Läuft Play-All: Spur live entfernen bzw. taktgenau wieder einsetzen.
  if (loopAll.active) {
    if (muted) {
      const src = loopAll.sources.get(rec.id);
      if (src) { try { src.stop(); } catch (_) {} loopAll.sources.delete(rec.id); }
    } else if (!loopAll.sources.has(rec.id)) {
      try {
        const buf = await bufferOf(rec);
        if (!loopAll.active) return;
        const src = AC.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(AC.destination);
        src.start(0, Math.max(0, AC.currentTime - loopAll.startedAt) % rec.duration);
        loopAll.sources.set(rec.id, src);
        if (el) el.classList.add("playing");
      } catch (_) {}
    }
    if (muted && el) el.classList.remove("playing");
  }

  // Läuft eine Aufnahme: Hintergrund-Loop live entfernen / wieder einsetzen.
  if (recActive) {
    if (muted) {
      const src = loopSources.get(rec.id);
      if (src) { try { src.stop(); } catch (_) {} loopSources.delete(rec.id); }
    } else if (settings.loops && !loopSources.has(rec.id)) {
      try {
        const buf = await bufferOf(rec);
        if (!recActive) return;
        const src = AC.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(AC.destination);
        src.start(0, Math.max(0, AC.currentTime - loopStartAC) % rec.duration);
        loopSources.set(rec.id, src);
      } catch (_) {}
    }
  }
}

// --- Metronom ---------------------------------------------------------------
// Klickt während der Aufnahme (inkl. Einzähler) im eingestellten Tempo.
// Geplant wird vorausschauend auf der AudioContext-Uhr, damit nichts jittert.
const metro = { running: false, nextBeat: 0, beat: 0, timer: 0 };

function metroClick(t, accent) {
  const o = AC.createOscillator();
  const g = AC.createGain();
  o.frequency.value = accent ? 1760 : 1175;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(accent ? 0.5 : 0.3, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
  o.connect(g);
  g.connect(AC.destination);
  o.start(t);
  o.stop(t + 0.09);
}

function startMetronome(t0) {
  stopMetronome();
  metro.running = true;
  metro.nextBeat = t0;
  metro.beat = 0;
  const schedule = () => {
    while (metro.nextBeat < AC.currentTime + 0.15) {
      metroClick(metro.nextBeat, metro.beat % 4 === 0);
      metro.beat++;
      metro.nextBeat += 60 / settings.bpm;
    }
  };
  schedule();
  metro.timer = setInterval(schedule, 30);
}

function stopMetronome() {
  clearInterval(metro.timer);
  metro.running = false;
}

// Punkt-Animation
function tick() {
  requestAnimationFrame(tick);
  if (!currentFolder) return;
  for (const rec of recs) {
    const p = players.get(rec.id);
    if (p) {
      const t = p.playing ? p.offset + (AC.currentTime - p.startedAt) : p.offset;
      positionDot(rec, Math.max(0, Math.min(1, t / rec.duration)));
    } else if (loopAll.active && loopAll.sources.has(rec.id)) {
      const t = Math.max(0, AC.currentTime - loopAll.startedAt) % rec.duration;
      positionDot(rec, t / rec.duration);
    }
  }
}
requestAnimationFrame(tick);

// ---------------------------------------------------------------------------
// Aufnahme (+ Loops im Hintergrund)
//
// Aufgenommen wird rohes PCM über Web Audio (AudioWorklet, Fallback
// ScriptProcessor) und als WAV gespeichert — nicht über MediaRecorder.
// Grund: iOS Safari erzeugt fragmentierte MP4s, die decodeAudioData oft
// nicht lesen kann ("Aufnahme konnte nicht gespeichert werden"), und
// AAC/Opus-Encoder fügen Stille am Anfang ein, die Loops unsauber macht.
// ---------------------------------------------------------------------------
let recActive = false;
let recNode = null, recSource = null, recMute = null;
let recChunks = [];   // Float32Array-Stücke vom Worklet
let recStart = 0;
let recTimerInt = 0;
let recSafetyTimer = 0;
let loopSources = new Map(); // rec.id -> AudioBufferSourceNode
let loopStartAC = 0;         // AC-Zeitpunkt, an dem Loops + Aufnahme starteten
let micStream = null;
let starting = false;
let workletReady = null;

function loadWorklet() {
  if (!AC.audioWorklet) return Promise.reject(new Error("kein AudioWorklet"));
  if (!workletReady) {
    const code = `registerProcessor("lb-rec", class extends AudioWorkletProcessor {
      process(inputs) {
        const ch = inputs[0] && inputs[0][0];
        if (ch) this.port.postMessage(ch.slice(0));
        return true;
      }
    });`;
    const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    workletReady = AC.audioWorklet.addModule(url);
  }
  return workletReady;
}

async function makeRecNode() {
  try {
    await loadWorklet();
    const node = new AudioWorkletNode(AC, "lb-rec", {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 1,
      channelCountMode: "explicit",
    });
    node.port.onmessage = (e) => { if (recActive) recChunks.push(e.data); };
    return node;
  } catch (_) {
    const node = AC.createScriptProcessor(4096, 1, 1);
    node.onaudioprocess = (e) => {
      if (recActive) recChunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    return node;
  }
}

function teardownRecGraph() {
  try { if (recSource) recSource.disconnect(); } catch (_) {}
  try { if (recNode) recNode.disconnect(); } catch (_) {}
  try { if (recMute) recMute.disconnect(); } catch (_) {}
  if (recNode && recNode.port) recNode.port.onmessage = null;
  recNode = recSource = recMute = null;
}

function wavBytes(buffer) {
  const n = buffer.length, sr = buffer.sampleRate;
  const dv = new DataView(new ArrayBuffer(44 + n * 2));
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  wstr(0, "RIFF"); dv.setUint32(4, 36 + n * 2, true); wstr(8, "WAVE");
  wstr(12, "fmt "); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true);          // PCM
  dv.setUint16(22, 1, true);          // mono
  dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 2, true);
  dv.setUint16(32, 2, true);
  dv.setUint16(34, 16, true);
  wstr(36, "data"); dv.setUint32(40, n * 2, true);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, d[i]));
    dv.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return dv.buffer;
}

async function runCountdown(labels, stepMs) {
  const ov = $("countdownOverlay"), num = $("countdownNum");
  ov.hidden = false;
  for (const n of labels) {
    num.textContent = n;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  ov.hidden = true;
}

async function startRecording() {
  if (recActive || starting) return;
  starting = true;
  try {
    ensureCtx();
    stopAllPlayback();
    if (!micStream || !micStream.active) {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }
    ensureCtx(); // iOS pausiert den AudioContext gern beim Mikrofonstart
    const metroOn = metroEnabled(currentFolder.id);
    const beat = 60 / settings.bpm;

    if (metroOn) {
      // Metronom läuft ab jetzt; mit Countdown: 4 Schläge Einzähler.
      const t0 = AC.currentTime + 0.15;
      startMetronome(t0);
      if (settings.countdown) {
        await runCountdown([4, 3, 2, 1], Math.round(beat * 1000));
      }
    } else if (settings.countdown) {
      await runCountdown([3, 2, 1], 700);
    }

    // Vorbereitete Buffer, damit die Loops exakt gleichzeitig starten.
    const loopBufs = [];
    if (settings.loops) {
      for (const rec of recs) {
        if (rec.muted) continue;
        try { loopBufs.push([rec, await bufferOf(rec)]); } catch (_) {}
      }
    }

    recNode = await makeRecNode();
    recSource = AC.createMediaStreamSource(micStream);
    recMute = AC.createGain();
    recMute.gain.value = 0; // nicht mithören, nur aufnehmen
    recSource.connect(recNode);
    recNode.connect(recMute);
    recMute.connect(AC.destination); // hält die Audio-Verarbeitung am Laufen
    recChunks = [];
    recActive = true;
    loopStartAC = AC.currentTime;

    // Alte Aufnahmen als Loop mitlaufen lassen — die Loop-Box.
    for (const [rec, buf] of loopBufs) {
      const src = AC.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(AC.destination);
      src.start(loopStartAC);
      loopSources.set(rec.id, src);
    }

    recStart = performance.now();
    recBtn.classList.add("recording");
    $("recRow").classList.add("recording");
    recTimer.textContent = "0:00";
    recTimerInt = setInterval(() => {
      recTimer.textContent = fmtDur((performance.now() - recStart) / 1000);
    }, 250);
    recSafetyTimer = setTimeout(stopRecording, MAX_REC_SECONDS * 1000);
  } catch (err) {
    toast("Mikrofon nicht verfügbar — bitte Zugriff erlauben");
    stopLoops();
    stopMetronome();
    teardownRecGraph();
    recActive = false;
    recBtn.classList.remove("recording");
    $("recRow").classList.remove("recording");
  } finally {
    starting = false;
  }
}

function stopLoops() {
  for (const s of loopSources.values()) { try { s.stop(); } catch (_) {} }
  loopSources.clear();
}

function stopRecording() {
  if (!recActive) return;
  recActive = false;
  clearInterval(recTimerInt);
  clearTimeout(recSafetyTimer);
  stopLoops();
  stopMetronome();
  teardownRecGraph();
  recBtn.classList.remove("recording");
  $("recRow").classList.remove("recording");
  recTimer.textContent = "";
  finishRecording();
}

async function finishRecording() {
  const chunks = recChunks;
  recChunks = [];
  if (!currentFolder || !chunks.length) return;
  const len = chunks.reduce((s, c) => s + c.length, 0);
  if (len / AC.sampleRate < 0.3) {
    toast("Zu kurz — einfach nochmal probieren");
    return;
  }

  // Takt-Quantisierung: jede Aufnahme wird ein Vielfaches der ersten
  // (genauer: der kürzesten vorhandenen) Aufnahme, damit Loops synchron
  // bleiben. Nur knapp über dem Takt (≈1 s) wird gekürzt; sonst wird auf
  // das nächste Vielfache AUFgerundet und mit Stille aufgefüllt.
  let target = len;
  if (recs.length) {
    const base = Math.round(Math.min(...recs.map((r) => r.duration)) * AC.sampleRate);
    if (base > 0) {
      const nDown = Math.max(1, Math.floor(len / base));
      const rest = len - nDown * base;
      const tol = Math.min(1.0 * AC.sampleRate, 0.25 * base);
      const n = (rest <= tol || len < base) ? nDown : nDown + 1;
      target = n * base;
    }
  } else if (metroEnabled(currentFolder.id)) {
    // Erste Aufnahme mit Metronom: auf ganze Schläge runden, damit der
    // Takt des Ordners zum Metronom passt.
    const beat = Math.round((60 / settings.bpm) * AC.sampleRate);
    target = Math.max(1, Math.round(len / beat)) * beat;
  }

  // Kein Encoder, kein Decoder: die Samples werden direkt zum AudioBuffer.
  // Ist die Aufnahme kürzer als das Ziel, bleibt der Rest Stille.
  const buf = AC.createBuffer(1, target, AC.sampleRate);
  const data = buf.getChannelData(0);
  let o = 0;
  for (const c of chunks) {
    if (o >= target) break;
    data.set(o + c.length <= target ? c : c.subarray(0, target - o), o);
    o += c.length;
  }

  const num = recs.reduce((m, r) => Math.max(m, r.num), 0) + 1;
  const rec = {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    folder: currentFolder.id,
    num,
    data: wavBytes(buf), // ArrayBuffer statt Blob: zuverlässiger in Safari-IDB
    duration: buf.duration,
    createdAt: Date.now(),
  };
  bufferCache.set(rec.id, buf);
  recs.push(rec);
  blocksEl.appendChild(makeBlock(rec));
  blocksEl.scrollTop = blocksEl.scrollHeight;
  try {
    await dbPut(rec);
  } catch (err) {
    // Block bleibt für diese Sitzung nutzbar, nur das Speichern schlug fehl.
    toast("Achtung: nicht dauerhaft gespeichert (" + (err && err.name || "Fehler") + ")");
  }
}

recBtn.addEventListener("click", () => {
  if (recActive) stopRecording();
  else startRecording();
});

$("playAllBtn").addEventListener("click", () => {
  if (loopAll.active) stopLoopAll();
  else startLoopAll();
});

// ---------------------------------------------------------------------------
// Export: alle Aufnahmen des Ordners gemischt, als Video (Ordnerfarbe)
// ---------------------------------------------------------------------------
let exporting = false;

function pickVideoMime() {
  const candidates = [
    "video/mp4",
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

async function exportFolder() {
  if (exporting || recActive) return;
  if (!recs.length) { toast("Noch keine Aufnahme in diesem Ordner"); return; }
  const active = recs.filter((r) => !r.muted);
  if (!active.length) { toast("Alle Spuren sind stummgeschaltet"); return; }
  exporting = true;
  stopAllPlayback();
  const overlay = $("exportOverlay");
  const bar = overlay.querySelector("#exportProgress > div");
  const state = $("exportState");
  const saveBtn = $("exportSave");
  const title = overlay.querySelector("h2");
  overlay.classList.remove("done");
  title.textContent = "Video wird erstellt …";
  bar.style.width = "0%";
  state.textContent = "";
  overlay.hidden = false;

  try {
    ensureCtx();
    // 1) Mix rendern: alle nicht stummen Aufnahmen, geloopt — die längste
    //    Spur läuft dreimal durch, kürzere füllen entsprechend öfter.
    const bufs = [];
    for (const rec of active) bufs.push(await bufferOf(rec));
    const durSec = Math.max(...bufs.map((b) => b.duration)) * 3;
    const sr = AC.sampleRate;
    const off = new OfflineAudioContext(2, Math.ceil(sr * durSec), sr);
    const gain = off.createGain();
    gain.gain.value = Math.min(1, 1.6 / Math.sqrt(bufs.length)); // sanfte Summenbegrenzung
    gain.connect(off.destination);
    for (const b of bufs) {
      const s = off.createBufferSource();
      s.buffer = b;
      s.loop = true;
      s.connect(gain);
      s.start(0);
    }
    const mixed = await off.startRendering();

    // 2) In Echtzeit als Video aufzeichnen: Canvas in Ordnerfarbe + Mix-Ton.
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    const cctx = canvas.getContext("2d");
    const videoStream = canvas.captureStream(30);
    const dest = AC.createMediaStreamDestination();
    const src = AC.createBufferSource();
    src.buffer = mixed;
    src.connect(dest);

    const stream = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks(),
    ]);
    const mime = pickVideoMime();
    if (!mime) throw new Error("kein Videoformat");
    const vr = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1200000 });
    const vChunks = [];
    vr.ondataavailable = (e) => { if (e.data && e.data.size) vChunks.push(e.data); };

    const t0 = performance.now();
    let raf = 0;
    const draw = () => {
      cctx.fillStyle = currentFolder.color;
      cctx.fillRect(0, 0, canvas.width, canvas.height);
      const frac = Math.min(1, (performance.now() - t0) / 1000 / durSec);
      bar.style.width = (frac * 100).toFixed(0) + "%";
      state.textContent = fmtDur(Math.min(durSec, (performance.now() - t0) / 1000)) +
        " / " + fmtDur(durSec);
      raf = requestAnimationFrame(draw);
    };

    const done = new Promise((resolve) => { vr.onstop = resolve; });
    vr.start(250);
    src.start();
    draw();
    src.onended = () => setTimeout(() => { try { vr.stop(); } catch (_) {} }, 250);
    await done;
    cancelAnimationFrame(raf);
    videoStream.getTracks().forEach((t) => t.stop());

    // 3) Sichern: Teilen-Dialog braucht eine frische Nutzergeste → Button.
    const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
    const file = new File(vChunks, "loopbox-" + currentFolder.id + "." + ext,
      { type: mime.split(";")[0] });
    bar.style.width = "100%";
    title.textContent = "Video ist fertig!";
    state.textContent = "";
    overlay.classList.add("done");
    saveBtn.onclick = async () => {
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file] });
        } else {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(file);
          a.download = file.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        }
        overlay.hidden = true;
      } catch (_) { /* Teilen abgebrochen — Dialog offen lassen */ }
      exporting = false;
    };
    return; // overlay bleibt bis "Video sichern" offen
  } catch (err) {
    toast("Export hat nicht geklappt");
    overlay.hidden = true;
    exporting = false;
  }
}

$("exportBtn").addEventListener("click", exportFolder);

// ---------------------------------------------------------------------------
// Einstellungen-UI
// ---------------------------------------------------------------------------
function syncSwitches() {
  $("setCountdown").classList.toggle("on", settings.countdown);
  $("setLoops").classList.toggle("on", settings.loops);
  $("bpmVal").textContent = settings.bpm;
}
$("setCountdown").addEventListener("click", () => {
  settings.countdown = !settings.countdown;
  saveSettings();
  syncSwitches();
});
$("setLoops").addEventListener("click", () => {
  settings.loops = !settings.loops;
  saveSettings();
  syncSwitches();
});
$("bpmDown").addEventListener("click", () => {
  settings.bpm = Math.max(40, settings.bpm - 5);
  saveSettings();
  syncSwitches();
});
$("bpmUp").addEventListener("click", () => {
  settings.bpm = Math.min(200, settings.bpm + 5);
  saveSettings();
  syncSwitches();
});
$("metroBtn").addEventListener("click", () => {
  const on = !metroEnabled(currentFolder.id);
  setMetroEnabled(currentFolder.id, on);
  $("metroBtn").classList.toggle("off", !on);
  if (!on && metro.running) stopMetronome();
});
$("settingsBtn").addEventListener("click", () => {
  syncSwitches();
  $("appVersion").textContent = "Loopbox · Version " + APP_VERSION;
  $("settingsOverlay").hidden = false;
});
$("settingsClose").addEventListener("click", () => {
  $("settingsOverlay").hidden = true;
});
$("backBtn").addEventListener("click", closeFolder);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
(async function init() {
  db = await openDB();
  renderGrid();
})();
