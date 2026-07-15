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

const APP_VERSION = 3; // sichtbar unter Zahnrad → zeigt, welche Version läuft

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
};
function saveSettings() {
  localStorage.setItem("lb.countdown", settings.countdown ? "1" : "0");
  localStorage.setItem("lb.loops", settings.loops ? "1" : "0");
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

  const del = document.createElement("button");
  del.className = "del";
  del.textContent = "×";
  del.setAttribute("aria-label", "Löschen");

  el.appendChild(num);
  el.appendChild(track);
  el.appendChild(dur);
  el.appendChild(del);

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
}

// Punkt-Animation
function tick() {
  requestAnimationFrame(tick);
  if (!currentFolder) return;
  for (const rec of recs) {
    const p = players.get(rec.id);
    if (!p) continue;
    const t = p.playing ? p.offset + (AC.currentTime - p.startedAt) : p.offset;
    positionDot(rec, Math.max(0, Math.min(1, t / rec.duration)));
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
let loopSources = [];
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

async function runCountdown() {
  const ov = $("countdownOverlay"), num = $("countdownNum");
  ov.hidden = false;
  for (const n of [3, 2, 1]) {
    num.textContent = n;
    await new Promise((r) => setTimeout(r, 700));
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
    if (settings.countdown) await runCountdown();

    recNode = await makeRecNode();
    recSource = AC.createMediaStreamSource(micStream);
    recMute = AC.createGain();
    recMute.gain.value = 0; // nicht mithören, nur aufnehmen
    recSource.connect(recNode);
    recNode.connect(recMute);
    recMute.connect(AC.destination); // hält die Audio-Verarbeitung am Laufen
    recChunks = [];
    recActive = true;

    // Alte Aufnahmen als Loop mitlaufen lassen — die Loop-Box.
    if (settings.loops) {
      for (const rec of recs) {
        try {
          const buf = await bufferOf(rec);
          const src = AC.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(AC.destination);
          src.start();
          loopSources.push(src);
        } catch (_) { /* eine kaputte Aufnahme stoppt die Session nicht */ }
      }
    }

    recStart = performance.now();
    recBtn.classList.add("recording");
    recTimer.textContent = "0:00";
    recTimerInt = setInterval(() => {
      recTimer.textContent = fmtDur((performance.now() - recStart) / 1000);
    }, 250);
    recSafetyTimer = setTimeout(stopRecording, MAX_REC_SECONDS * 1000);
  } catch (err) {
    toast("Mikrofon nicht verfügbar — bitte Zugriff erlauben");
    stopLoops();
    teardownRecGraph();
    recActive = false;
  } finally {
    starting = false;
  }
}

function stopLoops() {
  for (const s of loopSources) { try { s.stop(); } catch (_) {} }
  loopSources = [];
}

function stopRecording() {
  if (!recActive) return;
  recActive = false;
  clearInterval(recTimerInt);
  clearTimeout(recSafetyTimer);
  stopLoops();
  teardownRecGraph();
  recBtn.classList.remove("recording");
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
  // Kein Encoder, kein Decoder: die Samples werden direkt zum AudioBuffer.
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const data = buf.getChannelData(0);
  let o = 0;
  for (const c of chunks) { data.set(c, o); o += c.length; }

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
    // 1) Mix rendern: alle Aufnahmen geloopt auf die Länge der längsten.
    const bufs = [];
    for (const rec of recs) bufs.push(await bufferOf(rec));
    const durSec = Math.max(...bufs.map((b) => b.duration));
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
