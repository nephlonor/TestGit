// Hole data extracted from the per-hole HTML files.
// Coordinates are in the original 210x700 canvas space.
// holeLength is the real-world meters that the tee->green-marker pixel
// distance maps to. For par 4/5 holes the green marker is at the FRONT
// of the green, so we add ~12m (half a 25m-deep green) to make in-canvas
// distances read to roughly the middle/pin. Par 3 markers are already
// at the middle, so their values match the scorecard.
// pixelLength is the Euclidean pixel distance between the WHITE tee
// and the green marker. Keep it in sync if you ever move either point.
const HOLES = {
  1:  { green: {x:114, y:77},  tees: { WHITE:{x:102,y:656}, YELLOW:{x:100,y:636}, BLUE:{x:98,y:615},  RED:{x:98,y:600}  }, holeLength: 335, pixelLength: 578 }, // +20: extra-long green
  2:  { green: {x:104, y:70},  tees: { WHITE:{x:80, y:657}, YELLOW:{x:82, y:639}, BLUE:{x:86, y:614}, RED:{x:91, y:587} }, holeLength: 459, pixelLength: 587 },
  3:  { green: {x:121, y:121}, tees: { WHITE:{x:90, y:578}, YELLOW:{x:93, y:556}, BLUE:{x:103,y:494}, RED:{x:83, y:456} }, holeLength: 203, pixelLength: 458 },
  4:  { green: {x:135, y:55},  tees: { WHITE:{x:127,y:650}, YELLOW:{x:120,y:630}, BLUE:{x:98, y:573}, RED:{x:98, y:573} }, holeLength: 409, pixelLength: 595 },
  5:  { green: {x:109, y:71},  tees: { WHITE:{x:94, y:650}, YELLOW:{x:93, y:605}, BLUE:{x:95, y:567}, RED:{x:93, y:543} }, holeLength: 393, pixelLength: 580 },
  6:  { green: {x:104, y:68},  tees: { WHITE:{x:84, y:657}, YELLOW:{x:90, y:632}, BLUE:{x:97, y:575}, RED:{x:99, y:562} }, holeLength: 522, pixelLength: 589 },
  7:  { green: {x:111, y:175}, tees: { WHITE:{x:95, y:587}, YELLOW:{x:93, y:546}, BLUE:{x:90, y:525}, RED:{x:81, y:496} }, holeLength: 131, pixelLength: 412 },
  8:  { green: {x:158, y:65},  tees: { WHITE:{x:169,y:649}, YELLOW:{x:152,y:611}, BLUE:{x:138,y:573}, RED:{x:125,y:540} }, holeLength: 367, pixelLength: 600 }, // dogleg: pixelLength tracks playing path
  9:  { green: {x:82,  y:63},  tees: { WHITE:{x:82, y:667}, YELLOW:{x:87, y:624}, BLUE:{x:75, y:572}, RED:{x:79, y:554} }, holeLength: 327, pixelLength: 602 },
  10: { green: {x:89,  y:66},  tees: { WHITE:{x:137,y:665}, YELLOW:{x:128,y:640}, BLUE:{x:109,y:596}, RED:{x:110,y:551} }, holeLength: 466, pixelLength: 601 },
  11: { green: {x:105, y:125}, tees: { WHITE:{x:83, y:626}, YELLOW:{x:105,y:603}, BLUE:{x:100,y:566}, RED:{x:100,y:533} }, holeLength: 185, pixelLength: 501 },
  12: { green: {x:72,  y:62},  tees: { WHITE:{x:61, y:643}, YELLOW:{x:93, y:604}, BLUE:{x:111,y:575}, RED:{x:101,y:503} }, holeLength: 362, pixelLength: 600 }, // dogleg: pixelLength tracks playing path
  13: { green: {x:61,  y:77},  tees: { WHITE:{x:54, y:637}, YELLOW:{x:67, y:612}, BLUE:{x:96, y:556}, RED:{x:104,y:542} }, holeLength: 399, pixelLength: 560 },
  14: { green: {x:154, y:80},  tees: { WHITE:{x:170,y:624}, YELLOW:{x:158,y:596}, BLUE:{x:138,y:553}, RED:{x:125,y:528} }, holeLength: 398, pixelLength: 544 },
  15: { green: {x:124, y:92},  tees: { WHITE:{x:101,y:650}, YELLOW:{x:100,y:631}, BLUE:{x:98, y:594}, RED:{x:97, y:581} }, holeLength: 314, pixelLength: 558 },
  16: { green: {x:105, y:136}, tees: { WHITE:{x:118,y:628}, YELLOW:{x:114,y:609}, BLUE:{x:110,y:553}, RED:{x:110,y:543} }, holeLength: 167, pixelLength: 490 },
  17: { green: {x:163, y:68},  tees: { WHITE:{x:89, y:646}, YELLOW:{x:80, y:601}, BLUE:{x:78, y:578}, RED:{x:72, y:536} }, holeLength: 427, pixelLength: 595 }, // dogleg: pixelLength tracks playing path
  18: { green: {x:64,  y:69},  tees: { WHITE:{x:80, y:661}, YELLOW:{x:98, y:607}, BLUE:{x:100,y:585}, RED:{x:120,y:548} }, holeLength: 561, pixelLength: 601 }, // dogleg: pixelLength tracks playing path
};

const TEE_COLORS = {
  WHITE:  '#ffffff',
  YELLOW: '#FFD700',
  BLUE:   '#87CEFA',
  RED:    '#ff3b30',
};

// Per-hole scorecard. Tee numbers map: 62=WHITE, 59=YELLOW, 55=BLUE, 53=RED.
const HOLE_INFO = {
  1:  { par: 4, hcp: 16, dist: { WHITE: 315, YELLOW: 305, BLUE: 295, RED: 287 } },
  2:  { par: 5, hcp:  8, dist: { WHITE: 447, YELLOW: 437, BLUE: 403, RED: 384 } },
  3:  { par: 3, hcp: 12, dist: { WHITE: 203, YELLOW: 193, BLUE: 176, RED: 149 } },
  4:  { par: 4, hcp:  2, dist: { WHITE: 397, YELLOW: 385, BLUE: 353, RED: 353 } },
  5:  { par: 4, hcp: 10, dist: { WHITE: 381, YELLOW: 359, BLUE: 329, RED: 309 } },
  6:  { par: 5, hcp:  4, dist: { WHITE: 510, YELLOW: 490, BLUE: 436, RED: 436 } },
  7:  { par: 3, hcp: 18, dist: { WHITE: 131, YELLOW: 119, BLUE: 113, RED: 102 } },
  8:  { par: 4, hcp:  6, dist: { WHITE: 355, YELLOW: 331, BLUE: 309, RED: 296 } },
  9:  { par: 4, hcp: 14, dist: { WHITE: 315, YELLOW: 299, BLUE: 270, RED: 258 } },
  10: { par: 5, hcp: 15, dist: { WHITE: 454, YELLOW: 438, BLUE: 412, RED: 391 } },
  11: { par: 3, hcp: 11, dist: { WHITE: 185, YELLOW: 175, BLUE: 167, RED: 159 } },
  12: { par: 4, hcp:  7, dist: { WHITE: 350, YELLOW: 328, BLUE: 306, RED: 274 } },
  13: { par: 4, hcp:  1, dist: { WHITE: 387, YELLOW: 367, BLUE: 330, RED: 330 } },
  14: { par: 4, hcp:  5, dist: { WHITE: 386, YELLOW: 372, BLUE: 353, RED: 331 } },
  15: { par: 4, hcp: 13, dist: { WHITE: 302, YELLOW: 292, BLUE: 273, RED: 266 } },
  16: { par: 3, hcp: 17, dist: { WHITE: 167, YELLOW: 159, BLUE: 141, RED: 141 } },
  17: { par: 4, hcp:  3, dist: { WHITE: 415, YELLOW: 384, BLUE: 367, RED: 339 } },
  18: { par: 5, hcp:  9, dist: { WHITE: 549, YELLOW: 497, BLUE: 479, RED: 445 } },
};

const TEE_NUMBERS = { WHITE: 62, YELLOW: 59, BLUE: 55, RED: 53 };

// YouTube video IDs for each hole.
const HOLE_VIDEOS = {
  1:  '8SCCX-bhKO4',
  2:  '0KjXjuzE_kI',
  3:  'jyQka61rcIE',
  4:  'k7mkw0wI9t4',
  5:  'B1FCJqx0F74',
  6:  'zrMKES8dKjg',
  7:  'idW_ZrAB7xY',
  8:  'Nl8DQlOsqyI',
  9:  'XE2yOgoAFSY',
  10: 'ex5_VbRE7xM',
  11: 'h6XUwTcbcTQ',
  12: 'P1vgbe_w15c',
  13: 'bkFB5Hor44A',
  14: 'Cd7hs5O4GNA',
  15: 'Ir9Lg3mVWnI',
  16: 'MvipzleIqVc',
  17: 'iGp9d2V6t7k',
  18: 'sOWilbXL0po',
};

function updateHoleInfo() {
  const info = HOLE_INFO[currentHole];
  const parEl = document.getElementById('parVal');
  const hcpEl = document.getElementById('hcpVal');
  const distEl = document.getElementById('distVal');
  if (!info || !parEl) return;
  parEl.textContent = info.par == null ? '—' : info.par;
  hcpEl.textContent = info.hcp == null ? '—' : info.hcp;
  const d = info.dist[teeboxSelect.value];
  distEl.textContent = d == null ? '—' : d;
}

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
// Hole coordinates were authored for a 210x700 canvas. The canvas
// element is 840x2800 internally for crisp rendering; SCALE maps the
// logical 210x700 space to the actual pixel buffer.
const COORD_W = 210;
const COORD_H = 700;
const SCALE = canvas.width / COORD_W; // 4
const sx = v => v * SCALE;
const teeboxSelect = document.getElementById('teeboxSelect');
const measurementModeSwitch = document.getElementById('measurementMode');
const holeSelect = document.getElementById('holeSelect');
const holeGrid = document.getElementById('holeGrid');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const nineTabs = document.getElementById('nineTabs');

let currentHole = parseInt(localStorage.getItem('gccb.hole')) || 1;
let currentNine = currentHole >= 10 ? 'back' : 'front';
let bgImage = null;
let bgLoaded = false;
let lastClick = null;
let firstPoint = null;

// Per-hole persisted state (markers + notes), keyed by hole number.
//   normal: ball position when point-to-point is off
//   p2pA / p2pB: first / second points when point-to-point is on
//   notes: free-text notes shown in the right panel
const STATE_KEY = 'gccb.state.v1';
let allState = {};
try { allState = JSON.parse(localStorage.getItem(STATE_KEY)) || {}; } catch {}

const notesArea = document.getElementById('notesArea');

function holeSlot(n) {
  if (!allState[n]) allState[n] = { normal: null, p2pA: null, p2pB: null, notes: '' };
  return allState[n];
}

function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(allState));
}

function captureToSlot() {
  const slot = holeSlot(currentHole);
  if (measurementModeSwitch.checked) {
    slot.p2pA = firstPoint;
    slot.p2pB = lastClick;
  } else {
    slot.normal = lastClick;
  }
  saveState();
}

function restoreFromSlot() {
  const slot = holeSlot(currentHole);
  if (measurementModeSwitch.checked) {
    firstPoint = slot.p2pA;
    lastClick = slot.p2pB;
  } else {
    firstPoint = null;
    lastClick = slot.normal;
  }
}

// Build hole dropdown
for (let i = 1; i <= 18; i++) {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = `Hole ${i}`;
  holeSelect.appendChild(opt);
}

function buildHoleGrid() {
  holeGrid.innerHTML = '';
  const start = currentNine === 'front' ? 1 : 10;
  for (let i = start; i < start + 9; i++) {
    const b = document.createElement('button');
    b.textContent = i;
    b.dataset.hole = i;
    if (i === currentHole) b.classList.add('active');
    b.addEventListener('click', () => selectHole(i));
    holeGrid.appendChild(b);
  }
}

function updateNineTabs() {
  nineTabs.querySelectorAll('button').forEach(b => {
    b.classList.toggle('active', b.dataset.nine === currentNine);
  });
}

function loadHole(n) {
  currentHole = n;
  currentNine = n >= 10 ? 'back' : 'front';
  localStorage.setItem('gccb.hole', n);
  holeSelect.value = n;
  updateNineTabs();
  buildHoleGrid();
  prevBtn.disabled = (n === 1);
  nextBtn.disabled = (n === 18);

  restoreFromSlot();
  if (notesArea) notesArea.value = holeSlot(currentHole).notes || '';
  bgLoaded = false;
  bgImage = new Image();
  bgImage.onload = () => { bgLoaded = true; redraw(); };
  bgImage.onerror = () => { bgLoaded = false; redraw(); };
  bgImage.src = `holes/loch${n}.png?v=32`;
  updateHoleInfo();
  updateHoleVideo();
  // The blue-dot-in-frame check is hole-specific, so re-derive on
  // every hole change.
  autoUpdateMode();
  updateGpsStatus();
  redraw();
}

function updateHoleVideo() {
  const iframe = document.getElementById('holeVideo');
  if (!iframe) return;
  const id = HOLE_VIDEOS[currentHole];
  // Lazy-load: only set src when the hole is selected, so the iframe
  // doesn't fetch a video for a hole the user hasn't opened yet.
  const desired = id ? `https://www.youtube.com/embed/${id}?rel=0` : '';
  if (iframe.src !== desired) iframe.src = desired;
}

function selectHole(n) {
  if (n < 1 || n > 18) return;
  loadHole(n);
}

function drawPoint(point, color, size) {
  ctx.beginPath();
  ctx.arc(sx(point.x), sx(point.y), sx(size), 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = sx(1.2);
  ctx.stroke();
}

function drawLine(p1, p2, color, width) {
  ctx.beginPath();
  ctx.moveTo(sx(p1.x), sx(p1.y));
  ctx.lineTo(sx(p2.x), sx(p2.y));
  ctx.strokeStyle = color;
  ctx.lineWidth = sx(width);
  ctx.stroke();
}

function getDistance(p1, p2) {
  return Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2);
}

function getLength(p1, p2) {
  const hole = HOLES[currentHole];
  return getDistance(p1, p2) * (hole.holeLength / hole.pixelLength);
}

function drawLabel(text, x, y) {
  const fontPx = sx(14);
  ctx.font = `bold ${fontPx}px -apple-system, Helvetica, Arial`;
  const w = ctx.measureText(text).width;
  const padX = sx(3), padY = sx(2);
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(sx(x) - padX, sx(y) - fontPx + padY, w + padX * 2, fontPx + padY);
  ctx.fillStyle = '#000';
  ctx.fillText(text, sx(x), sx(y));
}

function clear() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bgLoaded && bgImage) {
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#e8eef2';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9ab';
    ctx.font = `bold ${sx(18)}px -apple-system, Helvetica, Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(`Hole ${currentHole}`, canvas.width / 2, canvas.height / 2);
    ctx.textAlign = 'start';
  }
}

function drawTeeAndGreen() {
  // In point-to-point mode the green and tee markers are hidden so they
  // don't compete visually with the user's measurement.
  if (measurementModeSwitch.checked) return;
  const hole = HOLES[currentHole];
  const tee = hole.tees[teeboxSelect.value];
  drawPoint(hole.green, '#2ecc71', 9);
  drawPoint(tee, TEE_COLORS[teeboxSelect.value] || '#fff', 9);
}

function updateDisplay() {
  const hole = HOLES[currentHole];
  const ballColor = TEE_COLORS[teeboxSelect.value] || '#ffd54a';

  if (!measurementModeSwitch.checked) {
    // In Live mode the ball follows the live GPS dot whenever it's
    // visible (in range + hole calibrated). Saved tap is preserved
    // for when the user switches back to Shot planner.
    const ball = liveBallPos() || lastClick;
    if (!ball) return;
    const tee = hole.tees[teeboxSelect.value];
    drawLine(tee, ball, 'rgba(0,0,0,0.85)', 2.5);
    drawLine(hole.green, ball, 'rgba(0,0,0,0.85)', 2.5);
    drawPoint(ball, ballColor, 9);
    drawLabel(`${Math.round(getLength(hole.green, ball))}m`, ball.x + 12, ball.y);
    drawLabel(`${Math.round(getLength(tee, ball))}m`,        ball.x + 12, ball.y + 16);
  } else {
    if (firstPoint) drawPoint(firstPoint, ballColor, 9);
    if (lastClick) drawPoint(lastClick, ballColor, 9);
    if (firstPoint && lastClick) {
      drawLine(firstPoint, lastClick, 'rgba(0,0,0,0.85)', 2.5);
      drawLabel(`${Math.round(getLength(firstPoint, lastClick))}m`, lastClick.x + 12, lastClick.y + 10);
    }
  }
}

// In Live mode (normal measurement only), the ball marker follows the
// live GPS fix. Returns null in Shot planner mode, in p2p, or when
// the blue dot isn't currently being drawn (no fix, out of range, or
// hole not calibrated).
function liveBallPos() {
  if (!gpsEnabled || measurementModeSwitch.checked) return null;
  if (!currentGps || !gpsInRange) return null;
  return gpsToPng(currentHole, currentGps);
}

function drawGpsMarker() {
  if (!gpsEnabled || !currentGps || !gpsInRange) return;
  const pos = gpsToPng(currentHole, currentGps);
  if (!pos) return;
  // Accuracy halo, scaled into PNG metres using the hole's known scale.
  const accLogical = Math.min(40, Math.max(5, currentGps.accuracy || 10));
  const hole = HOLES[currentHole];
  const mPerPx = hole.holeLength / hole.pixelLength;
  const accPx = accLogical / mPerPx;
  ctx.beginPath();
  ctx.arc(sx(pos.x), sx(pos.y), sx(accPx), 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0, 122, 255, 0.18)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(sx(pos.x), sx(pos.y), sx(6), 0, Math.PI * 2);
  ctx.fillStyle = '#007aff';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = sx(2);
  ctx.stroke();
}

function redraw() {
  clear();
  drawTeeAndGreen();
  updateDisplay();
  drawGpsMarker();
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = COORD_W / rect.width;
  const scaleY = COORD_H / rect.height;
  const pt = e.touches ? e.touches[0] : e;
  return {
    x: (pt.clientX - rect.left) * scaleX,
    y: (pt.clientY - rect.top) * scaleY
  };
}

// Hit radius (in logical 210x700 coords) for grabbing a placed dot.
const HIT_RADIUS = 16;

function hitTest(p) {
  // Returns the *user-placed* dot under the pointer, or null.
  // Tees and the green are intentionally not draggable. In Live mode +
  // normal measurement the ball is GPS-driven, so it's not draggable
  // either.
  if (measurementModeSwitch.checked) {
    if (lastClick  && getDistance(lastClick,  p) <= HIT_RADIUS) return 'last';
    if (firstPoint && getDistance(firstPoint, p) <= HIT_RADIUS) return 'first';
  } else if (!gpsEnabled) {
    if (lastClick  && getDistance(lastClick,  p) <= HIT_RADIUS) return 'last';
  }
  return null;
}

function placeTap(p) {
  // Live mode + normal: GPS owns the ball, ignore taps.
  if (gpsEnabled && !measurementModeSwitch.checked) return;
  if (measurementModeSwitch.checked) {
    if (!firstPoint) {
      // 1st tap: drop first point on its own.
      firstPoint = p;
      lastClick = null;
    } else if (!lastClick) {
      // 2nd tap: drop second point and reveal the measurement.
      lastClick = p;
    } else {
      // 3rd tap: restart with a fresh first point.
      firstPoint = p;
      lastClick = null;
    }
  } else {
    lastClick = p;
  }
  captureToSlot();
  redraw();
}

// Pointer handling: single-finger drag of placed dots, single-finger
// tap to drop a new dot, horizontal swipe to change hole. Multi-touch
// is left alone so the browser can pinch-zoom.
let activePointers = 0;
let dragTarget = null;      // 'last' | 'first' | null
let downAt = null;          // { x, y, time } client coords of pointerdown
let moved = false;          // exceeded the tap threshold

canvas.addEventListener('pointerdown', (e) => {
  activePointers++;
  if (activePointers > 1) {
    // Pinch starting — abandon any drag in progress.
    dragTarget = null;
    downAt = null;
    return;
  }
  const p = getCanvasPoint(e);
  downAt = { x: e.clientX, y: e.clientY, time: Date.now() };
  moved = false;
  const hit = hitTest(p);
  if (hit) {
    dragTarget = hit;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  }
});

canvas.addEventListener('pointermove', (e) => {
  if (activePointers > 1) return;
  if (!downAt) return;
  const dx = e.clientX - downAt.x;
  const dy = e.clientY - downAt.y;
  if (!moved && Math.hypot(dx, dy) > 6) moved = true;
  if (!dragTarget) return;
  const p = getCanvasPoint(e);
  if (dragTarget === 'last')  lastClick = p;
  if (dragTarget === 'first') firstPoint = p;
  redraw();
  e.preventDefault();
});

function endPointer(e) {
  activePointers = Math.max(0, activePointers - 1);
  const wasDrag = !!dragTarget;
  dragTarget = null;
  if (!downAt) return;
  const dx = e.clientX - downAt.x;
  const dy = e.clientY - downAt.y;
  const dist = Math.hypot(dx, dy);
  const dt = Date.now() - downAt.time;
  downAt = null;
  if (wasDrag) { captureToSlot(); return; }
  if (!moved && dist < 10 && dt < 500) {
    placeTap(getCanvasPoint(e));
    return;
  }
  // Treat a clear horizontal flick as a hole-change swipe.
  if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
    if (dx < 0 && currentHole < 18) selectHole(currentHole + 1);
    else if (dx > 0 && currentHole > 1) selectHole(currentHole - 1);
  }
}

canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', (e) => {
  activePointers = Math.max(0, activePointers - 1);
  dragTarget = null;
  downAt = null;
});

holeSelect.addEventListener('change', () => selectHole(parseInt(holeSelect.value)));
prevBtn.addEventListener('click', () => selectHole(currentHole - 1));
nextBtn.addEventListener('click', () => selectHole(currentHole + 1));
teeboxSelect.addEventListener('change', () => { updateHoleInfo(); redraw(); });
measurementModeSwitch.addEventListener('change', () => {
  // Toggle just flipped. Save the *previous* mode's positions into
  // its slot, then restore the new mode's saved positions so that
  // each mode remembers its own last marker(s).
  const slot = holeSlot(currentHole);
  const nowP2P = measurementModeSwitch.checked;
  if (nowP2P) {
    slot.normal = lastClick;
  } else {
    slot.p2pA = firstPoint;
    slot.p2pB = lastClick;
  }
  saveState();
  restoreFromSlot();
  redraw();
});

nineTabs.querySelectorAll('button').forEach(b => {
  b.addEventListener('click', () => {
    currentNine = b.dataset.nine;
    updateNineTabs();
    buildHoleGrid();
  });
});

if (notesArea) {
  notesArea.addEventListener('input', () => {
    holeSlot(currentHole).notes = notesArea.value;
    saveState();
  });
}

// ============================================================
// Geolocation
// ------------------------------------------------------------
// Per-hole calibration: GPS (lat,lng) of the green-center and white
// tee. The PNG already knows those two points in pixel space (see
// HOLES.green and HOLES.tees.WHITE), so the two pairs uniquely define
// a similarity transform (rotation + uniform scale + translation)
// from world metres to PNG pixels.
//
// The user authors the calibration in the OSM modal: drag the two
// pins onto the real green / white-tee on the OpenStreetMap view,
// hit Save. Stored in localStorage.
//
// Live GPS uses watchPosition + a 5s tick that re-runs
// getCurrentPosition, so the dot keeps refreshing even when the
// browser sits on a stale fix.
// ============================================================

const GEO_KEY = 'gccb.geo.v1';
// Defaults seeded from OpenStreetMap (overpass query against
// way=269050363 "Golf & Country Club Basel"). For each `golf=hole` way
// the first node is the WHITE tee and the last node is the green
// centre; path lengths match the scorecard WHITE yardages to within
// a few metres on every hole, which confirms the convention.
// Per-hole entries saved via the calibration UI override these.
const DEFAULT_GEO_CAL = {
   1: { green: {lat:47.5418887, lng:7.4843423}, white: {lat:47.5399647, lng:7.4812424} },
   2: { green: {lat:47.5446193, lng:7.4871021}, white: {lat:47.5416536, lng:7.4831177} },
   3: { green: {lat:47.5429880, lng:7.4860829}, white: {lat:47.5445107, lng:7.4875823} },
   4: { green: {lat:47.5433845, lng:7.4919301}, white: {lat:47.5430442, lng:7.4868768} },
   5: { green: {lat:47.5425517, lng:7.4869251}, white: {lat:47.5432542, lng:7.4919020} },
   6: { green: {lat:47.5397271, lng:7.4819818}, white: {lat:47.5423543, lng:7.4874227} },
   7: { green: {lat:47.5410182, lng:7.4800307}, white: {lat:47.5400206, lng:7.4808843} },
   8: { green: {lat:47.5398411, lng:7.4764645}, white: {lat:47.5417650, lng:7.4799822} },
   9: { green: {lat:47.5390734, lng:7.4794042}, white: {lat:47.5396401, lng:7.4753755} },
  10: { green: {lat:47.5377875, lng:7.4745928}, white: {lat:47.5390412, lng:7.4804233} },
  11: { green: {lat:47.5396112, lng:7.4748310}, white: {lat:47.5379634, lng:7.4741471} },
  12: { green: {lat:47.5401761, lng:7.4712932}, white: {lat:47.5398004, lng:7.4758020} },
  13: { green: {lat:47.5372970, lng:7.4688792}, white: {lat:47.5402666, lng:7.4709472} },
  14: { green: {lat:47.5388217, lng:7.4643919}, white: {lat:47.5372309, lng:7.4685252} },
  15: { green: {lat:47.5363337, lng:7.4656981}, white: {lat:47.5387402, lng:7.4638286} },
  16: { green: {lat:47.5356456, lng:7.4681121}, white: {lat:47.5359896, lng:7.4657840} },
  17: { green: {lat:47.5366741, lng:7.4740291}, white: {lat:47.5361707, lng:7.4688041} },
  18: { green: {lat:47.5389484, lng:7.4809357}, white: {lat:47.5370037, lng:7.4743482} },
};
// User overrides live in localStorage; geoCal is the merged view
// (overrides on top of OSM defaults) used at runtime.
let savedGeoCal = {};
try { savedGeoCal = JSON.parse(localStorage.getItem(GEO_KEY)) || {}; } catch {}
let geoCal = {};
function rebuildGeoCal() {
  geoCal = {};
  for (let i = 1; i <= 18; i++) {
    if (savedGeoCal[i]) geoCal[i] = savedGeoCal[i];
    else if (DEFAULT_GEO_CAL[i]) geoCal[i] = DEFAULT_GEO_CAL[i];
  }
}
rebuildGeoCal();

// Approximate centre of Golf & Country Club Basel (Hagenthal-le-Bas).
// Only used as a fallback when no hole is calibrated yet.
const COURSE_CENTER_FALLBACK = { lat: 47.5402, lng: 7.4779 };
// Disable live-position display beyond this distance from any
// calibrated green (or, if none calibrated, the fallback centre).
const COURSE_RADIUS_M = 800;

let currentGps = null;        // { lat, lng, accuracy }
let gpsWatchId = null;
let gpsRefreshTimer = null;
// Live mode is auto-derived: true iff the blue dot would currently be
// drawn inside the current hole's PNG frame (in range + calibrated +
// projected pixel within 0..COORD_W / 0..COORD_H). The user no longer
// toggles this; the mode switches on every GPS fix and hole change.
let gpsEnabled = false;
let gpsInRange = false;
let gpsDenied = false;

function haversineMeters(a, b) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// GPS (lat,lng) -> local east/north metres relative to origin.
function gpsToLocalMeters(origin, p) {
  const toRad = d => d * Math.PI / 180;
  const R = 6371000;
  const east  = R * toRad(p.lng - origin.lng) * Math.cos(toRad(origin.lat));
  const north = R * toRad(p.lat - origin.lat);
  return { east, north };
}

function getCourseCenter() {
  const greens = Object.values(geoCal)
    .map(c => c && c.green)
    .filter(g => g && g.lat != null);
  if (!greens.length) return COURSE_CENTER_FALLBACK;
  const lat = greens.reduce((s, g) => s + g.lat, 0) / greens.length;
  const lng = greens.reduce((s, g) => s + g.lng, 0) / greens.length;
  return { lat, lng };
}

function isGpsInRange(gps) {
  if (!gps) return false;
  const greens = Object.values(geoCal)
    .map(c => c && c.green)
    .filter(g => g && g.lat != null);
  const targets = greens.length ? greens : [COURSE_CENTER_FALLBACK];
  for (const t of targets) {
    if (haversineMeters(gps, t) <= COURSE_RADIUS_M) return true;
  }
  return false;
}

// Returns the PNG pixel (in 210x700 logical space) for a given GPS
// position on the current hole, using its two-anchor calibration.
// Returns null if the hole isn't calibrated.
function gpsToPng(holeNum, gps) {
  const cal = geoCal[holeNum];
  if (!cal || !cal.green || !cal.white) return null;
  if (cal.green.lat == null || cal.white.lat == null) return null;
  const hole = HOLES[holeNum];
  if (!hole) return null;

  const aPx = hole.green;
  const bPx = hole.tees.WHITE;
  const dx = bPx.x - aPx.x;
  const dy = bPx.y - aPx.y;

  // World vector from green->white tee, in metres. We use (east, -north)
  // so positive Y matches the PNG y-axis (which points down). The two
  // anchor pairs then uniquely define a similarity transform.
  const origin = cal.green;
  const bMtr = gpsToLocalMeters(origin, cal.white);
  const pMtr = gpsToLocalMeters(origin, gps);

  const ex = bMtr.east;
  const ny = -bMtr.north;
  const denom = ex * ex + ny * ny;
  if (denom < 1e-9) return null;
  // Complex multiplier (re + i*im) with (ex + i*ny) -> (dx + i*dy).
  const re = (dx * ex + dy * ny) / denom;
  const im = (dy * ex - dx * ny) / denom;

  const px = pMtr.east;
  const py = -pMtr.north;
  return {
    x: aPx.x + re * px - im * py,
    y: aPx.y + im * px + re * py,
  };
}

function updateGpsStatus() {
  const el = document.getElementById('gpsStatus');
  const planner = document.getElementById('modePlannerBtn');
  const live = document.getElementById('modeLiveBtn');
  if (planner) planner.classList.toggle('active', !gpsEnabled);
  if (live) live.classList.toggle('active', gpsEnabled);
  if (live) live.classList.toggle('live', gpsEnabled);
  if (!el) return;
  if (gpsDenied)   { el.textContent = 'GPS permission denied — enable in browser settings'; return; }
  if (plannerOverride) {
    el.textContent = 'Shot planner (manual) — tap Live to resume auto';
    return;
  }
  if (!gpsAcquiring && !currentGps) { el.textContent = 'Shot planner — tap the fairway to measure'; return; }
  if (!currentGps) { el.textContent = 'Acquiring GPS…'; return; }
  const acc = Math.round(currentGps.accuracy);
  if (!gpsInRange) {
    el.textContent = `Too far from course — Shot planner (±${acc}m)`;
    return;
  }
  const cal = geoCal[currentHole];
  const calibrated = cal && cal.green && cal.green.lat != null;
  if (!calibrated) {
    el.textContent = `±${acc}m · hole ${currentHole} not calibrated`;
    return;
  }
  const dToGreen = Math.round(haversineMeters(currentGps, cal.green));
  if (!gpsEnabled) {
    el.textContent = `±${acc}m · ${dToGreen}m to green · off this hole, Shot planner`;
    return;
  }
  el.textContent = `±${acc}m · ${dToGreen}m to green · Live`;
}

// True iff the live GPS dot would currently fall inside the visible
// PNG canvas for the active hole. Drives the auto mode-switch.
function gpsDotInFrameForCurrent() {
  if (!currentGps || !gpsInRange) return false;
  const pos = gpsToPng(currentHole, currentGps);
  if (!pos) return false;
  return pos.x >= 0 && pos.x <= COORD_W && pos.y >= 0 && pos.y <= COORD_H;
}

// Manual override: when true, the user has chosen to stay in Shot
// planner regardless of where the GPS dot would be. Cleared by
// tapping the Live location button.
let plannerOverride = localStorage.getItem('gccb.plannerOverride') === '1';

// Re-derives gpsEnabled (Live vs Shot planner) from the in-frame check,
// unless the user has manually locked to Shot planner.
// Returns true if the state actually changed.
function autoUpdateMode() {
  const next = plannerOverride ? false : gpsDotInFrameForCurrent();
  if (next === gpsEnabled) return false;
  gpsEnabled = next;
  return true;
}

function setPlannerOverride(on) {
  plannerOverride = !!on;
  if (plannerOverride) localStorage.setItem('gccb.plannerOverride', '1');
  else localStorage.removeItem('gccb.plannerOverride');
  autoUpdateMode();
  updateGpsStatus();
  redraw();
}

let gpsAcquiring = false;

function handleGpsFix(pos) {
  currentGps = {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
  gpsInRange = isGpsInRange(currentGps);
  gpsDenied = false;
  autoUpdateMode();
  updateGpsStatus();
  redraw();
}

function handleGpsError(err) {
  if (err && err.code === 1) {
    gpsDenied = true;
    gpsEnabled = false;
    _stopGpsInternal(true);
  }
  updateGpsStatus();
}

function startGpsAcquisition() {
  if (!navigator.geolocation || gpsDenied) {
    updateGpsStatus();
    return;
  }
  gpsAcquiring = true;
  if (gpsWatchId == null) {
    gpsWatchId = navigator.geolocation.watchPosition(
      handleGpsFix, handleGpsError,
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 }
    );
  }
  // Belt-and-braces: re-trigger a single-shot fix every 5s so the
  // marker doesn't get stuck on a stale watchPosition cache.
  if (!gpsRefreshTimer) {
    gpsRefreshTimer = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        handleGpsFix, () => {},
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
      );
    }, 5000);
  }
  updateGpsStatus();
  redraw();
}

function _stopGpsInternal(silent) {
  gpsAcquiring = false;
  gpsEnabled = false;
  if (gpsWatchId != null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  if (gpsRefreshTimer) {
    clearInterval(gpsRefreshTimer);
    gpsRefreshTimer = null;
  }
  if (!silent) updateGpsStatus();
  redraw();
}

function refreshGpsOnce() {
  if (!navigator.geolocation || gpsDenied) return;
  // Bypass any cache to force a real fix.
  navigator.geolocation.getCurrentPosition(
    handleGpsFix, handleGpsError,
    { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
  );
}

// ============================================================
// OSM calibration UI (Leaflet)
// ============================================================

let leafletMap = null;
let calGreenMarker = null;
let calWhiteMarker = null;
let calUserMarker = null;
let calLine = null;

function ensureLeafletMap() {
  if (leafletMap) return;
  if (typeof L === 'undefined') return;       // Leaflet not loaded yet
  const c = getCourseCenter();
  leafletMap = L.map('calMap', { zoomControl: true }).setView([c.lat, c.lng], 17);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
  }).addTo(leafletMap);

  const greenIcon = L.divIcon({
    className: 'cal-pin',
    html: '<div class="cal-pin-dot" style="background:#2ecc71"></div><div class="cal-pin-label">Green</div>',
    iconSize: [22, 22], iconAnchor: [11, 11]
  });
  const whiteIcon = L.divIcon({
    className: 'cal-pin',
    html: '<div class="cal-pin-dot" style="background:#fff"></div><div class="cal-pin-label">White tee</div>',
    iconSize: [22, 22], iconAnchor: [11, 11]
  });
  calGreenMarker = L.marker([c.lat, c.lng], { draggable: true, icon: greenIcon }).addTo(leafletMap);
  calWhiteMarker = L.marker([c.lat - 0.0006, c.lng], { draggable: true, icon: whiteIcon }).addTo(leafletMap);
  calLine = L.polyline([calGreenMarker.getLatLng(), calWhiteMarker.getLatLng()], {
    color: '#B3A16E', weight: 2, dashArray: '6,4'
  }).addTo(leafletMap);
  const updateLine = () => calLine.setLatLngs([calGreenMarker.getLatLng(), calWhiteMarker.getLatLng()]);
  calGreenMarker.on('drag', updateLine);
  calWhiteMarker.on('drag', updateLine);
}

function loadHoleCalibrationIntoMap(n) {
  ensureLeafletMap();
  if (!leafletMap) return;
  const cal = geoCal[n];
  let green, white;
  if (cal && cal.green && cal.white && cal.green.lat != null && cal.white.lat != null) {
    green = [cal.green.lat, cal.green.lng];
    white = [cal.white.lat, cal.white.lng];
  } else {
    const c = getCourseCenter();
    green = [c.lat, c.lng];
    white = [c.lat - 0.0006, c.lng];
  }
  calGreenMarker.setLatLng(green);
  calWhiteMarker.setLatLng(white);
  calLine.setLatLngs([green, white]);
  if (currentGps) {
    if (!calUserMarker) {
      const userIcon = L.divIcon({
        className: 'cal-pin',
        html: '<div class="cal-pin-dot" style="background:#007aff;border-color:#fff"></div>',
        iconSize: [18, 18], iconAnchor: [9, 9]
      });
      calUserMarker = L.marker([currentGps.lat, currentGps.lng], { icon: userIcon, interactive: false }).addTo(leafletMap);
    } else {
      calUserMarker.setLatLng([currentGps.lat, currentGps.lng]);
    }
  }
  leafletMap.fitBounds([green, white], { padding: [60, 60], maxZoom: 18 });
}

function openCalibration() {
  const modal = document.getElementById('calModal');
  if (!modal) return;
  modal.hidden = false;
  const sel = document.getElementById('calHoleSelect');
  if (sel) sel.value = currentHole;
  setTimeout(() => {
    ensureLeafletMap();
    if (leafletMap) {
      leafletMap.invalidateSize();
      loadHoleCalibrationIntoMap(currentHole);
    }
  }, 40);
}

function closeCalibration() {
  const modal = document.getElementById('calModal');
  if (modal) modal.hidden = true;
}

function saveCurrentCalibration() {
  const n = parseInt(document.getElementById('calHoleSelect').value);
  const g = calGreenMarker.getLatLng();
  const w = calWhiteMarker.getLatLng();
  savedGeoCal[n] = {
    green: { lat: g.lat, lng: g.lng },
    white: { lat: w.lat, lng: w.lng },
  };
  localStorage.setItem(GEO_KEY, JSON.stringify(savedGeoCal));
  rebuildGeoCal();
  if (currentGps) gpsInRange = isGpsInRange(currentGps);
  updateGpsStatus();
  redraw();
  const btn = document.getElementById('calSaveBtn');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = 'Saved ✓';
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1000);
  }
}

function clearCurrentCalibration() {
  // Drop the user override; the OSM default for this hole takes over.
  const n = parseInt(document.getElementById('calHoleSelect').value);
  delete savedGeoCal[n];
  localStorage.setItem(GEO_KEY, JSON.stringify(savedGeoCal));
  rebuildGeoCal();
  if (currentGps) gpsInRange = isGpsInRange(currentGps);
  updateGpsStatus();
  loadHoleCalibrationIntoMap(n);
  redraw();
}

function useGpsForMarker(which) {
  if (!currentGps) {
    alert('No GPS fix yet — enable GPS and wait for a lock.');
    return;
  }
  const ll = [currentGps.lat, currentGps.lng];
  if (which === 'green') calGreenMarker.setLatLng(ll);
  else calWhiteMarker.setLatLng(ll);
  calLine.setLatLngs([calGreenMarker.getLatLng(), calWhiteMarker.getLatLng()]);
  leafletMap.panTo(ll);
}

(function wireGeoUi() {
  const plannerBtn = document.getElementById('modePlannerBtn');
  const liveBtn = document.getElementById('modeLiveBtn');
  const gpsRefresh = document.getElementById('gpsRefreshBtn');
  const calBtn = document.getElementById('calibrateBtn');
  const calClose = document.getElementById('calCloseBtn');
  const calSave = document.getElementById('calSaveBtn');
  const calClear = document.getElementById('calClearBtn');
  const calUseGreen = document.getElementById('calUseGpsGreen');
  const calUseWhite = document.getElementById('calUseGpsWhite');
  const calHoleSel = document.getElementById('calHoleSelect');

  // Mode is auto-driven by the in-frame check, but tapping Shot
  // planner always forces a manual override; Live location clears
  // the override so auto switching resumes.
  if (plannerBtn) plannerBtn.addEventListener('click', () => setPlannerOverride(true));
  if (liveBtn) liveBtn.addEventListener('click', () => setPlannerOverride(false));
  if (gpsRefresh) gpsRefresh.addEventListener('click', refreshGpsOnce);
  if (calBtn) calBtn.addEventListener('click', openCalibration);
  if (calClose) calClose.addEventListener('click', closeCalibration);
  if (calSave) calSave.addEventListener('click', saveCurrentCalibration);
  if (calClear) calClear.addEventListener('click', clearCurrentCalibration);
  if (calUseGreen) calUseGreen.addEventListener('click', () => useGpsForMarker('green'));
  if (calUseWhite) calUseWhite.addEventListener('click', () => useGpsForMarker('white'));

  if (calHoleSel) {
    for (let i = 1; i <= 18; i++) {
      const o = document.createElement('option');
      o.value = i; o.textContent = `Hole ${i}`;
      calHoleSel.appendChild(o);
    }
    calHoleSel.addEventListener('change', () => {
      loadHoleCalibrationIntoMap(parseInt(calHoleSel.value));
    });
  }
})();

loadHole(currentHole);

// Always acquire GPS in the background when permission is allowed.
// The displayed mode (Shot planner vs Live) auto-switches per fix
// based on whether the GPS-projected dot falls inside the current
// hole's PNG frame, so no manual mode persistence is needed.
(function autoStartGpsAcquisition() {
  if (!navigator.geolocation) { updateGpsStatus(); return; }
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'geolocation' }).then(s => {
      if (s.state === 'denied') { gpsDenied = true; updateGpsStatus(); return; }
      startGpsAcquisition();
    }).catch(() => startGpsAcquisition());
  } else {
    startGpsAcquisition();
  }
})();

// First-visit welcome popup. Persisted in localStorage so it only ever
// shows once per device (until the user clears site data).
(function () {
  if (localStorage.getItem('gccb.seenWelcome')) return;
  const modal = document.getElementById('welcomeModal');
  const ok = document.getElementById('welcomeOk');
  if (!modal || !ok) return;
  modal.hidden = false;
  ok.addEventListener('click', () => {
    modal.hidden = true;
    localStorage.setItem('gccb.seenWelcome', '1');
  });
})();

// "Install app" prompt.
// - Chromium / Edge: capture beforeinstallprompt, show a real Install
//   button that triggers the browser's native dialog.
// - iOS Safari (and Chrome on iOS, which is just Safari): show
//   instructions to use Share -> Add to Home Screen.
// - Already installed (standalone display mode) or previously
//   dismissed: stay hidden.
(function () {
  const prompt = document.getElementById('installPrompt');
  const btn = document.getElementById('installBtn');
  const dismiss = document.getElementById('installDismiss');
  const msg = document.getElementById('installMsg');
  if (!prompt || !btn || !dismiss || !msg) return;

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) return;
  if (localStorage.getItem('gccb.installDismissed')) return;

  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;

  function show(html, withBtn) {
    msg.innerHTML = html;
    btn.hidden = !withBtn;
    prompt.hidden = false;
  }
  function hide() { prompt.hidden = true; }

  dismiss.addEventListener('click', () => {
    hide();
    localStorage.setItem('gccb.installDismissed', '1');
  });

  let deferred = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e;
    show('<b>Install app</b> for the full-screen experience.', true);
  });

  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch {}
    deferred = null;
    hide();
  });

  window.addEventListener('appinstalled', () => {
    deferred = null;
    hide();
    localStorage.setItem('gccb.installDismissed', '1');
  });

  if (isIOS) {
    // iOS Safari never fires beforeinstallprompt; show manual hint.
    show('Install: tap <b>Share</b> &rarr; <b>Add to Home Screen</b>.', false);
  }
})();
