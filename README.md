# Loopbox

Eine bunte, minimalistische Loop-Box zum Aufnehmen — gebaut für Kinder.

## So funktioniert's

1. **Farbe antippen** — jede Farbkachel ist ein Ordner.
2. **Großes + drücken** — die Aufnahme startet (auf Wunsch mit 3‑2‑1‑Countdown).
   Nochmal drücken stoppt sie.
3. Die Aufnahme erscheint als **nummerierter Block**. Antippen spielt sie ab:
   ein Punkt gleitet von links nach rechts durch den Block und lässt sich
   mit dem Finger verschieben (spulen). Das **×** rechts löscht die Aufnahme
   (mit kurzer Nachfrage, damit nichts aus Versehen wegkommt).
4. **Loop-Box**: Wird im selben Ordner eine neue Aufnahme gestartet, laufen
   alle alten Aufnahmen des Ordners als Endlos-Loop mit — so entstehen
   Schicht für Schicht kleine Songs.
5. **Export** (Pfeil oben rechts im Ordner): mischt alle Aufnahmen des
   Ordners (kürzere werden geloopt) und erstellt ein **Video** mit der
   Ordnerfarbe als Hintergrund — auf dem iPhone lässt es sich über den
   Teilen-Dialog direkt in **Fotos sichern**.
6. **Zahnrad** (Startbildschirm): Countdown und „Loops beim Aufnehmen"
   ein-/ausschalten.

Alle Aufnahmen bleiben auf dem Gerät gespeichert (IndexedDB) — auch nach
dem Schließen der App.

## Installation auf dem Handy

Die App ist eine statische Web-App ohne Build-Schritt und wird per GitHub
Pages von `main` ausgeliefert. Auf dem iPhone/iPad: Pages-URL in Safari
öffnen → Teilen → **„Zum Home-Bildschirm"**. Mikrofon und Aufnahme
funktionieren nur über **HTTPS** (die Pages-URL erfüllt das).

Lokal testen: `python3 -m http.server` und `http://localhost:8000` öffnen.

## Dateien

- `index.html` — Oberfläche und Styles
- `app.js` — komplette Logik (Aufnahme, Loops, Wiedergabe, Export, Speicher)
- `manifest.webmanifest`, `icons/` — PWA-Installation
- `.github/workflows/pages.yml` — Deployment auf GitHub Pages
