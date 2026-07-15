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
   Schicht für Schicht kleine Songs. Der **Play-Knopf** neben dem + spielt
   alle Spuren gleichzeitig als Endlos-Loop ab (nochmal drücken stoppt).
   Damit alles synchron bleibt, wird jede neue Aufnahme automatisch auf
   ein **Vielfaches der ersten Aufnahme** gebracht: Ist sie nur knapp
   (≈1 s) über dem Takt, wird gekürzt — sonst wird auf das nächste
   Vielfache aufgerundet und mit Stille aufgefüllt.
5. **Export** (Pfeil oben rechts im Ordner): mischt alle Aufnahmen des
   Ordners (kürzere werden geloopt) und erstellt ein **Video** mit der
   Ordnerfarbe als Hintergrund — auf dem iPhone lässt es sich über den
   Teilen-Dialog direkt in **Fotos sichern**.
6. **Metronom** (Symbol oben im Ordner): tickt beim Aufnehmen im
   eingestellten Tempo — bei neuen Ordnern standardmäßig an. Mit
   Countdown gibt es einen 4-Schläge-Einzähler auf dem Beat; die erste
   Aufnahme wird auf ganze Schläge gerundet, damit alles zum Takt passt.
7. **Stumm schalten**: das Lautsprecher-Symbol im Block nimmt die Spur
   aus Play-All, aus den Loops beim Aufnehmen und aus dem Export —
   direktes Antippen spielt sie weiterhin ab.
8. **Zahnrad** (Startbildschirm): Countdown, „Loops beim Aufnehmen" und
   das Metronom-Tempo (BPM) einstellen.

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
