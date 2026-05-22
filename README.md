# GCCB Shot Tracker (Test)

Test fork of the GCCB Shot Tracker that adds **live GPS positioning** on the
per-hole PNGs, with an OpenStreetMap-based calibration UI.

## Features

- Interactive hole map for all 18 holes
- Tap to mark a shot — shows distance to green and distance from tee
- Point-to-point measurement mode
- Hole selector: Front 9 / Back 9 grid, dropdown, Prev/Next buttons, swipe gestures
- Teebox selection (WHITE / YELLOW / BLUE / RED)
- **Live GPS dot on the hole PNG**, with continuous refresh
  (`watchPosition` + a 5 s manual re-fix), and an auto-disable when the
  device is more than 800 m from any calibrated green
- **OSM map calibration** (Leaflet): for each hole, drag a green pin and a
  white-tee pin onto the real positions and save — the app derives a
  similarity transform from those two anchor pairs (PNG ↔ GPS)
- Dark-blue CI background, white GCCB shield logo
- Installable as iOS home-screen app (PWA)

## Calibrating a hole

1. Tap **Map** in the top GPS bar.
2. Pick the hole.
3. Drag the green pin onto the middle of the green and the white pin onto
   the white teebox. You can also tap **Green = my GPS** / **White tee =
   my GPS** while standing on the point.
4. Save. The blue GPS dot will now appear in the correct spot on that
   hole's PNG whenever you're within 800 m of any calibrated green.

## Structure

```
index.html              Main page
app.js                  Hole data + interaction logic
manifest.webmanifest    PWA manifest
assets/logo-white.png   GCCB shield (white)
icons/                  App icons (Apple touch icon, PWA icons, favicon)
holes/loch1.png..loch18.png   Per-hole background maps (placeholders)
```

## Replacing placeholder hole maps

The `holes/loch{N}.png` files are 210×700 placeholders. Replace each one
with the corresponding real hole map (same filename, same dimensions or
they'll be stretched to that aspect ratio).

## Running

It's a static site — open `index.html` in a browser or serve the folder:

```
python3 -m http.server 8000
```

On iOS Safari, use *Share → Add to Home Screen* to install as an app.
