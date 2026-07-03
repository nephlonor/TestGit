# CLAUDE.md

## Project

**Pump!** — a mobile-web pump-foiling game. Static site, vanilla JS, no
dependencies, no build step. Deployed to GitHub Pages on push to `main`
(`.github/workflows/pages.yml`, serves the repo root).

The previous contents of this repo (a golf shot tracker) were fully removed;
this game is a clean restart.

## Architecture

Everything lives in two files:

- `index.html` — DOM overlays (menu, game-over), CSS, portrait-rotate hint.
- `game.js` — one module, organised in sections:
  - `TUNE` — **all gameplay tuning constants live here**, commented.
  - Sensors — `deviceorientation` (beta = nose pitch, calibrated to a
    neutral captured at takeoff, low-passed) and `devicemotion` (linear
    acceleration envelope; a spike over `pumpThresh` = one pump pulse).
    iOS 13+ permission requests happen in `enableSensors()` from the RIDE
    button's user gesture. Keyboard/mouse fallback for desktop testing.
  - Game state machine — `menu → dock → ride → splashing → over`.
  - Physics — `stepDock` (two-finger push strokes add speed, drag decays
    it, takeoff at `takeoffV`, running out of dock = fail) and `stepRide`
    (see below).
  - Effects — wake ripples (world-coordinate rings; spawn rate/size scale
    with closeness to the water) and spray particles.
  - Rendering — canvas, DPR-capped at 2. World scrolls past a fixed board
    position; `worldToScreenY` maps world distance to screen.

## Ride physics model (stepRide)

State: `v` (speed, world px/s), `h` (ride height 0..1: 0 = water,
1 = foil breach), pitch `p` in -1 (nose down) .. +1 (nose up).

- Nose down: `v` += diveAccel (height converts to speed), `h` falls.
- Nose up: `h` climbs scaled by lift capacity `(v/takeoffV)²`, `v` bleeds
  (induced drag). Below takeoff speed the lift deficit sinks you.
- Constant `settleSink` means passive riding always decays — pumping is
  mandatory.
- Pump pulse while `p < -pumpNoseDownMin`: speed boost. While
  `p > pumpStallNoseUp`: stall. Near neutral: ignored.
- Stall (bad pump, or nose held above `stallNoseUpAngle` longer than
  `stallNoseUpTime`): lift collapses for `stallDuration`, usually ends in
  touchdown.
- End states: `h <= 0` touchdown, `h >= 1` breach, both → splash → game
  over. Score = ride time, best kept in `localStorage` (`pump.best`).

## Conventions & gotchas

- Keep it dependency-free and single-file per concern; tune gameplay only
  through `TUNE`.
- Sensor code must keep working when permissions are denied or events
  never fire (desktop) — the keyboard fallback path in `updatePitch` is
  the guard; don't break it.
- `e.acceleration` can be null (some Android browsers): the
  gravity-high-pass fallback in `onMotion` handles it.
- Test locally with `python3 -m http.server`; on-device testing needs
  HTTPS (use the Pages deployment).
