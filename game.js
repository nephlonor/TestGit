/* Pump! — dock-start pump-foiling game.
 *
 * Top-down view. Two-finger push along the dock to reach takeoff speed,
 * then ride the foil with the phone's tilt sensor (pitch) and pump energy
 * into it with real downward pushes of the phone (accelerometer spikes).
 *
 * Physics summary (per-second rates, dt-integrated):
 *   - Nose down  -> gain speed, lose ride height (trading height for speed).
 *   - Nose up    -> gain height (needs speed), bleed speed (induced drag).
 *   - Below lift speed the foil can't carry you: you sink.
 *   - Pump spike while nose down  -> speed boost (the whole point).
 *   - Pump spike while nose up    -> foil stalls (lift collapses).
 *   - Nose held high too long     -> foil stalls.
 *   - height <= 0 -> touchdown splash;  height >= 1 -> foil breach splash.
 */
"use strict";

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------
const TUNE = {
  pitchRangeDeg: 26,      // device tilt (deg from neutral) mapped to full input
  pitchSmooth: 9,         // low-pass rate for tilt input (1/s)

  takeoffV: 330,          // world px/s needed to get on foil
  maxV: 950,
  minFlyV: 110,           // below this while riding -> stall/sink out
  dockLen: 2600,          // world px of dock available for pushing
  dockDrag: 0.30,         // 1/s speed decay while pushing on the dock
  pushGain: 2.1,          // finger px of forward shove -> world px/s
  pushMaxPerStroke: 240,  // speed a single stroke may add

  // riding — speed
  diveAccel: 300,         // accel at full nose-down (px/s^2), scaled by height
  climbDragK: 0.62,       // fraction/s of v lost at full nose-up
  baseDrag: 0.145,        // 1/s parasitic drag
  waveDragK: 0.55,        // extra drag ramping in below h=0.22 (near the water)

  // riding — height (h in 0..1, 0 = water surface, 1 = mast fully out)
  hStart: 0.45,
  climbRate: 0.80,        // h/s at full nose-up with lift capacity 1
  diveSink: 0.60,         // h/s at full nose-down at speed
  slowSink: 0.55,         // h/s sink when below lift speed (scaled by deficit)
  settleSink: 0.045,      // constant h/s settle — riding passively won't last

  // pumping (accelerometer)
  pumpThresh: 3.6,        // m/s^2 linear-accel envelope to count as a pump
  pumpRefractory: 0.28,   // s between pumps
  pumpBoost: 62,          // px/s per pump (+ up to ~45 more with strength)
  pumpNoseDownMin: 0.06,  // pitchNorm must be at least this far nose-DOWN
  pumpStallNoseUp: 0.18,  // pumping with pitchNorm above this nose-UP -> stall

  // stalling
  stallNoseUpAngle: 0.45, // pitchNorm considered "nose held high"
  stallNoseUpTime: 1.35,  // s of nose-high before the foil lets go
  stallDuration: 1.0,     // s of collapsed lift after a stall
  stallSink: 1.1,         // h/s dropped while stalled
  stallDrag: 1.0,         // extra 1/s drag while stalled

  metersPerPx: 0.035,     // world px -> displayed metres
};

// ---------------------------------------------------------------------------
// Canvas / DOM
// ---------------------------------------------------------------------------
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
let W = 0, H = 0, DPR = 1;

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", resize);
resize();

const $ = (id) => document.getElementById(id);
const menuEl = $("menu"), overEl = $("gameover");

// ---------------------------------------------------------------------------
// Sensors: tilt (pitch) + accelerometer (pump detection)
// ---------------------------------------------------------------------------
const sensors = {
  available: false,       // any real orientation event seen
  rawPitchDeg: 0,         // device beta, portrait front/back tilt
  neutralDeg: null,       // calibrated at takeoff
  pitch: 0,               // smoothed, calibrated, normalised -1(nose down)..1(nose up)
  pumpPulse: 0,           // strength of a pending pump (consumed by the game loop)
  _lastPump: 0,
  _gravity: { x: 0, y: 0, z: 0 }, // high-pass fallback state
};

function onOrientation(e) {
  if (e.beta == null) return;
  sensors.available = true;
  // beta: tilting the top edge of the phone DOWN (away from you) goes
  // negative, tilting it up toward you goes positive — matching nose down/up.
  sensors.rawPitchDeg = e.beta;
}

function onMotion(e) {
  let a = e.acceleration;
  if (!a || (a.x == null && a.y == null && a.z == null)) {
    // Fallback: strip gravity from accelerationIncludingGravity ourselves.
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null) return;
    const G = sensors._gravity, k = 0.12;
    G.x += (g.x - G.x) * k; G.y += (g.y - G.y) * k; G.z += (g.z - G.z) * k;
    a = { x: g.x - G.x, y: g.y - G.y, z: g.z - G.z };
  }
  const mag = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  const now = performance.now() / 1000;
  if (mag > TUNE.pumpThresh && now - sensors._lastPump > TUNE.pumpRefractory) {
    sensors._lastPump = now;
    sensors.pumpPulse = Math.min(1, (mag - TUNE.pumpThresh) / 8);
  }
}

async function enableSensors() {
  try {
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      await DeviceOrientationEvent.requestPermission();
    }
    if (typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission === "function") {
      await DeviceMotionEvent.requestPermission();
    }
  } catch (_) { /* denied — keyboard fallback still works */ }
  window.addEventListener("deviceorientation", onOrientation);
  window.addEventListener("devicemotion", onMotion);
}

// Keyboard fallback (desktop testing): hold ArrowUp/Down, Space to pump.
const keys = { up: false, down: false };
window.addEventListener("keydown", (e) => {
  if (e.code === "ArrowUp") keys.up = true;
  if (e.code === "ArrowDown") keys.down = true;
  if (e.code === "Space") {
    sensors.pumpPulse = 0.6;
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowUp") keys.up = false;
  if (e.code === "ArrowDown") keys.down = false;
});

function updatePitch(dt) {
  let targetNorm;
  if (sensors.available) {
    if (sensors.neutralDeg == null) sensors.neutralDeg = sensors.rawPitchDeg;
    const rel = sensors.rawPitchDeg - sensors.neutralDeg;
    targetNorm = Math.max(-1, Math.min(1, rel / TUNE.pitchRangeDeg));
  } else {
    targetNorm = keys.up ? 0.75 : keys.down ? -0.75 : 0;
  }
  const k = Math.min(1, TUNE.pitchSmooth * dt);
  sensors.pitch += (targetNorm - sensors.pitch) * k;
}

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------
const game = {
  state: "menu",          // menu | dock | ride | splashing | over
  v: 0,                   // forward speed, world px/s
  h: 0,                   // ride height 0..1
  dist: 0,                // world px travelled
  rideTime: 0,
  noseUpTime: 0,
  stallT: 0,              // >0 while the foil is stalled
  stallReason: null,
  splashT: 0,
  splashReason: "",
  takeoffAnim: 0,         // 0..1 rise animation after takeoff
  toast: null,            // { text, t }
  pumpFlash: 0,
  best: parseFloat(localStorage.getItem("pump.best") || "0"),
};

const boardX = () => W * 0.56;
const boardY = () => H * 0.62;

// Ripples / splash particles, in world coords (y = world distance).
let ripples = [];
let sprays = [];
let rippleAcc = 0;

function toast(text, dur = 2.2) { game.toast = { text, t: dur }; }

function resetRun() {
  game.state = "dock";
  game.v = 0;
  game.h = 0;
  game.dist = 0;
  game.rideTime = 0;
  game.noseUpTime = 0;
  game.stallT = 0;
  game.stallReason = null;
  game.takeoffAnim = 0;
  game.pumpFlash = 0;
  sensors.neutralDeg = null;
  sensors.pitch = 0;
  sensors.pumpPulse = 0;
  ripples = [];
  sprays = [];
  toast("Two fingers on the board — push!", 3.5);
}

// ---------------------------------------------------------------------------
// Dock push input (two fingers shoving the board forward)
// ---------------------------------------------------------------------------
const push = { active: false, lastY: 0, strokeGain: 0 };

function touchAvgY(touches) {
  let s = 0;
  for (const t of touches) s += t.clientY;
  return s / touches.length;
}

function nearBoard(touches) {
  const bx = boardX(), by = boardY();
  for (const t of touches) {
    if (Math.hypot(t.clientX - bx, t.clientY - by) < Math.max(150, W * 0.3)) return true;
  }
  return false;
}

canvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (game.state !== "dock") return;
  if (e.touches.length >= 2 && nearBoard(e.touches)) {
    push.active = true;
    push.lastY = touchAvgY(e.touches);
    push.strokeGain = 0;
  }
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  e.preventDefault();
  if (game.state !== "dock" || !push.active || e.touches.length < 2) return;
  const y = touchAvgY(e.touches);
  const dy = push.lastY - y; // fingers moving up = shoving the board forward
  push.lastY = y;
  if (dy > 0 && push.strokeGain < TUNE.pushMaxPerStroke) {
    const add = Math.min(dy * TUNE.pushGain, TUNE.pushMaxPerStroke - push.strokeGain);
    push.strokeGain += add;
    game.v = Math.min(TUNE.maxV, game.v + add);
    spawnDockSpray();
  }
}, { passive: false });

canvas.addEventListener("touchend", (e) => {
  e.preventDefault();
  if (e.touches.length < 2) push.active = false;
}, { passive: false });
canvas.addEventListener("touchcancel", () => { push.active = false; });

// Mouse fallback for the dock push (desktop testing).
let mouseDown = false, mouseLastY = 0;
canvas.addEventListener("mousedown", (e) => {
  if (game.state !== "dock") return;
  mouseDown = true;
  mouseLastY = e.clientY;
  push.strokeGain = 0;
});
window.addEventListener("mousemove", (e) => {
  if (!mouseDown || game.state !== "dock") return;
  const dy = mouseLastY - e.clientY;
  mouseLastY = e.clientY;
  if (dy > 0 && push.strokeGain < TUNE.pushMaxPerStroke) {
    const add = Math.min(dy * TUNE.pushGain, TUNE.pushMaxPerStroke - push.strokeGain);
    push.strokeGain += add;
    game.v = Math.min(TUNE.maxV, game.v + add);
    spawnDockSpray();
  }
});
window.addEventListener("mouseup", () => { mouseDown = false; });

// ---------------------------------------------------------------------------
// Audio (tiny WebAudio blips — no assets)
// ---------------------------------------------------------------------------
let audio = null;
function initAudio() {
  try {
    audio = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) { audio = null; }
}
function playNoise(dur, freq, gain) {
  if (!audio) return;
  const n = audio.sampleRate * dur;
  const buf = audio.createBuffer(1, n, audio.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = audio.createBufferSource();
  src.buffer = buf;
  const f = audio.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.value = freq;
  const g = audio.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(audio.destination);
  src.start();
}
const sfxPump = () => playNoise(0.09, 500, 0.25);
const sfxSplash = () => playNoise(0.7, 1400, 0.5);
const sfxTakeoff = () => playNoise(0.35, 2500, 0.2);

// ---------------------------------------------------------------------------
// Physics
// ---------------------------------------------------------------------------
function splash(reason) {
  game.state = "splashing";
  game.splashT = 0;
  game.splashReason = reason;
  sfxSplash();
  for (let i = 0; i < 26; i++) spawnSpray(boardX(), game.dist, 1);
  for (let i = 0; i < 5; i++) {
    ripples.push({
      x: boardX() + (Math.random() - 0.5) * 40,
      yw: game.dist + (Math.random() - 0.5) * 40,
      r: 6 + i * 10, vr: 90 + i * 25, a: 0.9, lw: 3.5,
    });
  }
}

function stepDock(dt) {
  game.v = Math.max(0, game.v - game.v * TUNE.dockDrag * dt);
  game.dist += game.v * dt;

  if (game.v >= TUNE.takeoffV) {
    game.state = "ride";
    game.h = 0.02;
    game.takeoffAnim = 0;
    sensors.neutralDeg = null; // calibrate neutral to how the phone is held NOW
    sensors.pumpPulse = 0;
    sfxTakeoff();
    toast("Foil up! Find your pump rhythm", 2.6);
  } else if (game.dist > TUNE.dockLen) {
    splash("Ran out of dock before takeoff speed — push harder next time.");
  }
}

function stepRide(dt) {
  updatePitch(dt);
  game.rideTime += dt;

  // Rise onto the foil just after takeoff.
  if (game.takeoffAnim < 1) {
    game.takeoffAnim = Math.min(1, game.takeoffAnim + dt / 0.6);
    game.h = Math.max(game.h, TUNE.hStart * game.takeoffAnim);
  }

  const p = sensors.pitch;              // -1 nose down .. +1 nose up
  const down = Math.max(0, -p);
  const up = Math.max(0, p);
  const stalled = game.stallT > 0;

  // --- pump pulses from the accelerometer ---
  if (sensors.pumpPulse > 0) {
    const strength = sensors.pumpPulse;
    sensors.pumpPulse = 0;
    if (!stalled) {
      if (p < -TUNE.pumpNoseDownMin) {
        // Well-timed pump on the down-stroke: free energy.
        game.v = Math.min(TUNE.maxV, game.v + TUNE.pumpBoost + strength * 45);
        game.h = Math.max(0.02, game.h - 0.02);
        game.pumpFlash = 1;
        sfxPump();
      } else if (p > TUNE.pumpStallNoseUp) {
        // Loading the foil while the nose is high: it lets go.
        game.stallT = TUNE.stallDuration;
        game.stallReason = "Pumped with the nose up — the foil stalled.";
        toast("STALL!", 1.5);
      }
      // Pumps near neutral pitch do nothing — no free lunch.
    }
  }

  // --- nose held high too long ---
  if (up > TUNE.stallNoseUpAngle && !stalled) {
    game.noseUpTime += dt;
    if (game.noseUpTime > TUNE.stallNoseUpTime) {
      game.stallT = TUNE.stallDuration;
      game.stallReason = "Held the nose up too long — the foil stalled.";
      toast("STALL!", 1.5);
    }
  } else {
    game.noseUpTime = Math.max(0, game.noseUpTime - dt * 2);
  }

  // --- speed ---
  const hFrac = game.h;
  game.v += down * TUNE.diveAccel * (0.4 + 0.6 * hFrac) * dt;   // dive: height -> speed
  game.v -= up * TUNE.climbDragK * game.v * dt;                 // climb: induced drag
  game.v -= TUNE.baseDrag * game.v * dt;
  const nearWater = Math.max(0, (0.22 - game.h) / 0.22);        // wave drag skimming low
  game.v -= nearWater * TUNE.waveDragK * game.v * dt;
  if (game.stallT > 0) game.v -= TUNE.stallDrag * game.v * dt;
  game.v = Math.max(0, Math.min(TUNE.maxV, game.v));

  // --- height ---
  const liftCap = Math.pow(game.v / TUNE.takeoffV, 2);          // ~1 at takeoff speed
  if (game.stallT > 0) {
    game.stallT -= dt;
    game.h -= TUNE.stallSink * dt;                              // lift collapsed
  } else {
    game.h += up * TUNE.climbRate * Math.min(1.6, liftCap) * dt;
    game.h -= down * TUNE.diveSink * (0.5 + 0.5 * game.v / TUNE.maxV) * dt;
    game.h -= TUNE.slowSink * Math.max(0, 1 - liftCap) * dt;
    game.h -= TUNE.settleSink * dt;
  }

  game.dist += game.v * dt;

  // --- end conditions ---
  if (game.h >= 1) {
    splash("The foil breached the surface — too high, lift gone.");
  } else if (game.h <= 0) {
    splash(game.stallReason || "The board touched down.");
  } else if (game.v < TUNE.minFlyV) {
    game.stallReason = game.stallReason || "Too slow — the foil couldn't carry you.";
  }
}

function stepSplashing(dt) {
  game.splashT += dt;
  game.v = Math.max(0, game.v - game.v * 2.5 * dt);
  game.dist += game.v * dt;
  if (game.splashT > 1.4) showGameOver();
}

// ---------------------------------------------------------------------------
// Ripples & spray
// ---------------------------------------------------------------------------
function spawnSpray(x, yw, energy) {
  sprays.push({
    x, yw,
    vx: (Math.random() - 0.5) * 260 * energy,
    vy: (Math.random() - 0.5) * 260 * energy,
    life: 0.5 + Math.random() * 0.4,
    t: 0,
    r: 1.5 + Math.random() * 3,
  });
}

function spawnDockSpray() {
  if (Math.random() < 0.4) {
    spawnSpray(boardX() + (Math.random() - 0.5) * 30, game.dist - 40, 0.5);
  }
}

function updateEffects(dt) {
  // Wake ripples while moving: bigger and denser the closer to the water.
  if ((game.state === "ride" || game.state === "dock") && game.v > 30) {
    const closeness = game.state === "dock" ? 1 : Math.max(0, 1.05 - game.h);
    const rate = 3 + closeness * 24 * (0.3 + 0.7 * game.v / TUNE.maxV);
    rippleAcc += rate * dt;
    while (rippleAcc >= 1) {
      rippleAcc -= 1;
      const side = Math.random() < 0.5 ? -1 : 1;
      ripples.push({
        x: boardX() + side * (8 + Math.random() * 16),
        yw: game.dist - 45 - Math.random() * 20,
        r: 2 + Math.random() * 3,
        vr: 18 + closeness * 55,
        a: 0.18 + closeness * 0.5,
        lw: 1 + closeness * 2.2,
      });
    }
    // Skimming the surface throws actual spray.
    if (game.state === "ride" && game.h < 0.16 && Math.random() < 0.5) {
      spawnSpray(boardX() + (Math.random() - 0.5) * 34, game.dist - 40, 0.8);
    }
  }

  for (const r of ripples) { r.r += r.vr * dt; r.a -= dt * 0.55; }
  ripples = ripples.filter((r) => r.a > 0.01 && r.r < 400);
  if (ripples.length > 160) ripples.splice(0, ripples.length - 160);

  for (const s of sprays) {
    s.t += dt;
    s.x += s.vx * dt;
    s.yw -= s.vy * dt;
    s.vx *= 1 - 2 * dt;
    s.vy *= 1 - 2 * dt;
  }
  sprays = sprays.filter((s) => s.t < s.life);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
const worldToScreenY = (yw) => boardY() + (game.dist - yw);

function drawWater() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, "#0a4a7a");
  grad.addColorStop(1, "#052a4e");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Drifting shimmer: deterministic pseudo-random streaks tied to world pos.
  ctx.strokeStyle = "rgba(160, 220, 255, 0.07)";
  ctx.lineWidth = 2;
  const spacing = 90;
  const first = Math.floor((game.dist - H) / spacing) * spacing;
  const t = performance.now() / 1000;
  for (let yw = first; yw < game.dist + H; yw += spacing) {
    const n = Math.sin(yw * 12.9898) * 43758.5453;
    const fx = (n - Math.floor(n));
    const x = fx * W;
    const y = worldToScreenY(yw);
    if (y < -30 || y > H + 30) continue;
    const wob = Math.sin(t * 1.1 + yw) * 6;
    ctx.beginPath();
    ctx.moveTo(x - 26 + wob, y);
    ctx.quadraticCurveTo(x + wob, y - 5, x + 26 + wob, y);
    ctx.stroke();
  }
}

function drawDock() {
  const dockRight = W * 0.24;
  const topYw = TUNE.dockLen + 220;   // dock extends a bit past the takeoff run
  const botYw = -300;
  const yTop = worldToScreenY(topYw);
  const yBot = worldToScreenY(botYw);
  if (yTop > H || yBot < 0) return;

  ctx.fillStyle = "#7a5a38";
  ctx.fillRect(0, Math.max(-10, yTop), dockRight, Math.min(H + 20, yBot) - Math.max(-10, yTop));
  // planks
  ctx.strokeStyle = "rgba(40, 26, 12, 0.55)";
  ctx.lineWidth = 2;
  const plank = 34;
  const firstP = Math.ceil(botYw / plank) * plank;
  for (let yw = firstP; yw <= topYw; yw += plank) {
    const y = worldToScreenY(yw);
    if (y < -5 || y > H + 5) continue;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(dockRight, y);
    ctx.stroke();
  }
  // edge + posts
  ctx.fillStyle = "#5e4227";
  ctx.fillRect(dockRight - 7, Math.max(-10, yTop), 7, Math.min(H + 20, yBot) - Math.max(-10, yTop));
  ctx.fillStyle = "#4a3078";
  for (let yw = 0; yw <= topYw; yw += 300) {
    const y = worldToScreenY(yw);
    if (y < -20 || y > H + 20) continue;
    ctx.fillStyle = "#54381f";
    ctx.beginPath();
    ctx.arc(dockRight - 14, y, 9, 0, Math.PI * 2);
    ctx.fill();
  }
  // end of dock marker
  const endY = worldToScreenY(TUNE.dockLen);
  if (endY > -20 && endY < H + 20) {
    ctx.fillStyle = "rgba(255, 214, 106, 0.9)";
    ctx.fillRect(0, endY - 3, dockRight, 6);
  }
}

function drawRipples() {
  for (const r of ripples) {
    const y = worldToScreenY(r.yw);
    if (y < -50 || y > H + 50) continue;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(214, 240, 255, ${r.a.toFixed(3)})`;
    ctx.lineWidth = r.lw;
    ctx.arc(r.x, y, r.r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(240, 250, 255, 0.85)";
  for (const s of sprays) {
    const y = worldToScreenY(s.yw);
    ctx.globalAlpha = Math.max(0, 1 - s.t / s.life);
    ctx.beginPath();
    ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBoard() {
  const bx = boardX(), by = boardY();
  const p = sensors.pitch;
  const riding = game.state === "ride";
  const h = riding ? game.h : 0;

  // Shadow on the water separates from the board with height — the main
  // visual altitude cue in a top-down view.
  const off = 6 + h * 34;
  ctx.save();
  ctx.translate(bx + off * 0.55, by + off);
  ctx.scale(1, 2.6);
  ctx.beginPath();
  ctx.fillStyle = `rgba(2, 12, 24, ${0.35 - h * 0.18})`;
  ctx.arc(0, 0, 26 - h * 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Foil visible through the water when low (dark shape under the board).
  if (riding && h < 0.35) {
    ctx.save();
    ctx.translate(bx, by + 26);
    ctx.globalAlpha = (0.35 - h) / 0.35 * 0.5;
    ctx.fillStyle = "#031828";
    ctx.beginPath();
    ctx.ellipse(0, 0, 34, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.save();
  ctx.translate(bx, by);
  // Nose-down squashes the sprite slightly toward the nose; nose-up the tail.
  const stretch = 1 + p * 0.06;
  ctx.scale(1, stretch);

  // board outline
  const L = 62, Wd = 24;
  ctx.beginPath();
  ctx.moveTo(0, -L);
  ctx.bezierCurveTo(Wd, -L * 0.55, Wd, L * 0.55, Wd * 0.72, L);
  ctx.lineTo(-Wd * 0.72, L);
  ctx.bezierCurveTo(-Wd, L * 0.55, -Wd, -L * 0.55, 0, -L);
  const bodyGrad = ctx.createLinearGradient(0, -L, 0, L);
  // brighter nose when pitched up, brighter tail when pitched down
  const noseLight = 0.5 + p * 0.5;
  bodyGrad.addColorStop(0, `rgb(${225 + noseLight * 25}, ${235 + noseLight * 15}, 250)`);
  bodyGrad.addColorStop(1, `rgb(${225 + (1 - noseLight) * 25}, ${235 + (1 - noseLight) * 15}, 250)`);
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = "rgba(6, 30, 52, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // deck pad
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.35);
  ctx.bezierCurveTo(Wd * 0.62, -L * 0.2, Wd * 0.62, L * 0.7, Wd * 0.45, L * 0.86);
  ctx.lineTo(-Wd * 0.45, L * 0.86);
  ctx.bezierCurveTo(-Wd * 0.62, L * 0.7, -Wd * 0.62, -L * 0.2, 0, -L * 0.35);
  ctx.fillStyle = "#0e74a8";
  ctx.fill();
  // stringer
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -L * 0.9);
  ctx.lineTo(0, L * 0.9);
  ctx.stroke();
  ctx.restore();

  // pump flash ring
  if (game.pumpFlash > 0) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(120, 255, 190, ${game.pumpFlash * 0.8})`;
    ctx.lineWidth = 4;
    ctx.arc(bx, by, 70 + (1 - game.pumpFlash) * 50, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawPushHint() {
  if (game.state !== "dock") return;
  const t = performance.now() / 1000;
  const bx = boardX(), by = boardY();
  if (game.v < TUNE.takeoffV * 0.25) {
    // two finger dots sliding forward
    const phase = (t % 1.1) / 1.1;
    const y = by + 70 - phase * 150;
    ctx.globalAlpha = Math.sin(phase * Math.PI) * 0.65;
    ctx.fillStyle = "#eaf6ff";
    ctx.beginPath(); ctx.arc(bx - 16, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 16, y, 12, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // speed-to-takeoff bar
  const frac = Math.min(1, game.v / TUNE.takeoffV);
  const bw = Math.min(260, W * 0.6);
  const x0 = (W - bw) / 2, y0 = H - 84;
  ctx.fillStyle = "rgba(4, 24, 44, 0.65)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y0, bw, 14, 7); else ctx.rect(x0, y0, bw, 14);
  ctx.fill();
  ctx.fillStyle = frac >= 1 ? "#7dffb0" : "#40c8ff";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x0, y0, bw * frac, 14, 7); else ctx.rect(x0, y0, bw * frac, 14);
  ctx.fill();
  ctx.fillStyle = "rgba(234, 246, 255, 0.85)";
  ctx.font = "600 12px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PUSH TO TAKEOFF SPEED", W / 2, y0 - 8);
}

function drawHUD() {
  if (game.state !== "ride" && game.state !== "splashing") return;
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(234, 246, 255, 0.92)";
  ctx.font = "800 26px -apple-system, sans-serif";
  ctx.fillText(game.rideTime.toFixed(1) + "s", 18, 44);
  ctx.font = "600 15px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(234, 246, 255, 0.6)";
  ctx.fillText(Math.round(game.dist * TUNE.metersPerPx) + " m   " +
    Math.round(game.v * TUNE.metersPerPx * 1.94384) + " kn", 18, 66);

  // Height gauge: water at the bottom, breach at the top.
  const gx = W - 34, gy = 70, gh = Math.min(240, H * 0.34), gw = 12;
  ctx.fillStyle = "rgba(4, 24, 44, 0.6)";
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(gx - gw / 2, gy, gw, gh, 6); else ctx.rect(gx - gw / 2, gy, gw, gh);
  ctx.fill();
  // danger bands
  ctx.fillStyle = "rgba(255, 90, 110, 0.55)";
  ctx.fillRect(gx - gw / 2, gy, gw, gh * 0.12);            // breach zone
  ctx.fillRect(gx - gw / 2, gy + gh * 0.85, gw, gh * 0.15); // touchdown zone
  ctx.fillStyle = "rgba(125, 255, 176, 0.30)";
  ctx.fillRect(gx - gw / 2, gy + gh * 0.30, gw, gh * 0.35); // sweet spot
  // marker
  const my = gy + gh * (1 - game.h);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(gx - gw, my);
  ctx.lineTo(gx - gw - 10, my - 7);
  ctx.lineTo(gx - gw - 10, my + 7);
  ctx.closePath();
  ctx.fill();
  ctx.font = "600 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(234, 246, 255, 0.6)";
  ctx.textAlign = "center";
  ctx.fillText("AIR", gx, gy - 8);
  ctx.fillText("SEA", gx, gy + gh + 14);

  // Pitch bubble (spirit-level style) at the bottom.
  const px0 = W / 2, py0 = H - 46, pw = Math.min(220, W * 0.55);
  ctx.strokeStyle = "rgba(234, 246, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px0 - pw / 2, py0);
  ctx.lineTo(px0 + pw / 2, py0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px0, py0 - 7);
  ctx.lineTo(px0, py0 + 7);
  ctx.stroke();
  const bxp = px0 + sensors.pitch * pw / 2;
  ctx.fillStyle = sensors.pitch < -0.05 ? "#7dffb0" :
    sensors.pitch > TUNE.stallNoseUpAngle ? "#ff5a6e" : "#40c8ff";
  ctx.beginPath();
  ctx.arc(bxp, py0, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = "600 10px -apple-system, sans-serif";
  ctx.fillStyle = "rgba(234, 246, 255, 0.5)";
  ctx.fillText("NOSE DOWN", px0 - pw / 2, py0 + 22);
  ctx.fillText("NOSE UP", px0 + pw / 2, py0 + 22);

  // stall warning
  if (game.stallT > 0 || game.noseUpTime > TUNE.stallNoseUpTime * 0.55) {
    ctx.font = "800 30px -apple-system, sans-serif";
    ctx.fillStyle = `rgba(255, 90, 110, ${0.6 + 0.4 * Math.sin(performance.now() / 60)})`;
    ctx.textAlign = "center";
    ctx.fillText(game.stallT > 0 ? "STALL" : "NOSE HIGH!", W / 2, H * 0.3);
  }
}

function drawToast() {
  if (!game.toast) return;
  ctx.font = "700 17px -apple-system, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = `rgba(234, 246, 255, ${Math.min(1, game.toast.t)})`;
  ctx.fillText(game.toast.text, W / 2, H * 0.22);
}

// ---------------------------------------------------------------------------
// Game over / scores
// ---------------------------------------------------------------------------
function showGameOver() {
  game.state = "over";
  const t = game.rideTime;
  const isBest = t > game.best;
  if (isBest) {
    game.best = t;
    localStorage.setItem("pump.best", String(t));
  }
  $("overReason").textContent = game.splashReason;
  $("scoreTime").textContent = t.toFixed(1) + "s";
  $("scoreDist").textContent = Math.round(game.dist * TUNE.metersPerPx) + "m";
  $("scoreBest").textContent = game.best.toFixed(1) + "s";
  $("newBest").style.display = isBest && t > 0 ? "block" : "none";
  overEl.classList.remove("hidden");
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  if (game.state === "menu" || game.state === "over") {
    // Keep the water alive behind the overlays.
    drawWater();
    drawDock();
    drawRipples();
    updateEffects(dt);
    return;
  }

  if (game.state === "dock") stepDock(dt);
  else if (game.state === "ride") stepRide(dt);
  else if (game.state === "splashing") stepSplashing(dt);

  updateEffects(dt);
  game.pumpFlash = Math.max(0, game.pumpFlash - dt * 3);
  if (game.toast) {
    game.toast.t -= dt;
    if (game.toast.t <= 0) game.toast = null;
  }

  drawWater();
  drawDock();
  drawRipples();
  if (game.state !== "splashing" || game.splashT < 0.35) drawBoard();
  drawPushHint();
  drawHUD();
  drawToast();
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
async function startGame() {
  if (!audio) initAudio();
  if (audio && audio.state === "suspended") audio.resume();
  await enableSensors();
  if ("wakeLock" in navigator) {
    navigator.wakeLock.request("screen").catch(() => {});
  }
  menuEl.classList.add("hidden");
  overEl.classList.add("hidden");
  resetRun();
}

$("startBtn").addEventListener("click", startGame);
$("againBtn").addEventListener("click", startGame);

document.addEventListener("visibilitychange", () => {
  if (document.hidden && (game.state === "dock" || game.state === "ride")) {
    // Pause-by-splash would be unfair; just freeze time via lastT reset.
    lastT = performance.now();
  }
});
