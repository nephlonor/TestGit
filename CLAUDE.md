# CLAUDE.md

## Project

**Loopbox** — a minimalist loop-box audio recording web app for a child.
UI language is **German**. Static site, vanilla JS, no dependencies, no
build step. Deployed to GitHub Pages on push to `main`
(`.github/workflows/pages.yml`, serves the repo root). This repo previously
held other prototypes; they were fully removed.

## Concept

- Home screen: 2×4 grid of colour tiles (`FOLDERS` in `app.js`); each tile
  is a folder. Badge shows the recording count.
- Inside a folder: numbered recording blocks + a big `+` button that
  starts/stops a recording. While recording, all existing recordings of
  that folder play as endless loops (loop-box layering). A play button
  next to `+` loops ALL tracks simultaneously (`loopAll` state).
- Loop sync: every new recording is quantised to a multiple of the
  shortest existing recording (the "bar"). Slightly over the bar (≤ ~1 s
  or 25% of the bar) → trimmed down; clearly longer → rounded UP to the
  next multiple and padded with silence (see `finishRecording`).
- Tapping a block plays it — no player UI, just a dot sliding across the
  block; dragging the dot seeks. `×` deletes (two-step confirm).
- Export (arrow icon in folder header): offline-renders a mix of all
  non-muted folder recordings (3× the longest track; shorter ones keep
  looping to fill), then records a
  solid-colour canvas + the mix in realtime via MediaRecorder into a
  video (mp4 on Safari, webm elsewhere) and offers `navigator.share`
  (→ iOS Photos) with download fallback.
- Settings gear (home screen): toggles for countdown and
  loops-while-recording plus metronome BPM stepper, persisted in
  `localStorage` (`lb.*`).
- Metronome: per-folder toggle in the folder header (`lb.metro.<id>`,
  default OFF). Clicks (WebAudio osc, lookahead scheduling on the AC
  clock) during recording; with countdown on, a 4-beat count-in replaces
  3-2-1. The FIRST recording of a folder is rounded to whole beats so
  the folder's bar matches the metronome grid.
- Per-track mute: speaker icon on each block (`rec.muted`, persisted).
  Muted tracks are excluded from play-all, loops-while-recording and
  export; live mute/unmute re-enters loops phase-aligned. Direct tap
  still plays a muted block.

## Architecture

Two files: `index.html` (markup + all CSS) and `app.js`, organised in
sections: folders/settings, IndexedDB (`loopbox` db, `recs` store keyed by
`id`, indexed by `folder`; blobs stored directly), Web Audio (lazy
`AudioContext`, decoded-buffer cache), grid view, blocks & playback
(per-recording player objects in `players` map; rAF loop positions dots),
recording (raw PCM via AudioWorklet with ScriptProcessor fallback, stored
as 16-bit mono WAV), export, settings UI.

## Gotchas

- `AudioContext` must be created/resumed from a user gesture (done in
  `openFolder` / `startRecording`).
- iOS 17+: `navigator.share` needs transient user activation, which is
  lost after the realtime export — hence the explicit "Video sichern"
  button in the export overlay.
- Recording deliberately does NOT use MediaRecorder: iOS Safari emits
  fragmented MP4 that `decodeAudioData` often cannot parse (save failed
  for the user with "Aufnahme konnte nicht gespeichert werden"), and
  AAC/Opus encoder priming silence breaks gapless loops. Raw PCM → WAV
  avoids both; `decodeAudioData` is only used to load WAV blobs from
  IndexedDB, which every browser handles.
- Recording is capped at `MAX_REC_SECONDS` (safety).
- Testing: `python3 -m http.server`; headless Chromium needs
  `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`
  for mic access. On-device testing needs HTTPS (Pages URL).
