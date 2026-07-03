# Pump! — Dock Start Foiling

A phone game about **pump foiling**, played with your phone's real motion
sensors. Top-down view: a foil board, water, and a dock.

## How to play

1. **Dock start** — put two fingers on the board and shove it forward along
   the dock. Keep pushing until you hit takeoff speed.
2. **Ride the foil** — tilt the phone like it's the board:
   - **Nose down** (tilt the top of the phone away/down): you accelerate,
     but the board drops toward the water — the ripples grow as you get low.
   - **Nose up** (tilt toward you): you climb away from the water, but bleed
     speed to induced drag.
3. **Pump** — physically push the whole phone downward during the
   **nose-down** stroke. The accelerometer picks up the spike and converts
   it into speed. That's the pump: down-and-forward, then rise, repeat.
4. Find the rhythm. A perfect cycle of nose-down / pump / nose-up holds an
   equilibrium of height and speed — and the clock keeps running.

## Ways to splash

- **Touchdown** — ride height reaches the water.
- **Breach** — climb too high, the foil leaves the water and loses all lift.
- **Stall (nose high)** — hold the nose up too long and the foil lets go.
- **Stall (bad pump)** — push down on the phone while the nose is still up.
- **Too slow** — below flying speed the foil can't carry you; you sink.

Score = time on foil. Your best ride is saved on the device.

## Running it

It's a static web app — no build step.

- **On your phone**: open the GitHub Pages URL for this repo (deployed
  automatically from `main`). Add to home screen for fullscreen play.
  Motion/tilt sensor access requires **HTTPS** and, on iOS, a permission
  prompt (triggered by the RIDE button).
- **Locally**: `python3 -m http.server` and open `http://localhost:8000`.
- **On a computer** (no sensors): ↑/↓ arrows tilt the nose, Space pumps,
  click-drag upward does the dock push.

## Files

- `index.html` — page shell, menu and game-over overlays
- `game.js` — everything: sensors, physics, rendering, audio
- `manifest.webmanifest`, `icons/` — PWA install metadata
- `.github/workflows/pages.yml` — GitHub Pages deploy on push to `main`
