# Entwicklungsplan

Stand: 10.11.2026 · Grundlage: [Konzept 1.0 „Die Herde“](konzept.md)
Vorgänger: [Entwicklungsplan zu Konzept 0.4](archiv/entwicklungsplan-0.4.md) (Phasen 0–6 dort abgeschlossen bzw.
durch die Neuausrichtung überholt).

Regeln wie bisher: **Logik vor Balancing**, **Logik vor Grafik**, kleine PRs, CI grün, Claude merged selbst,
Regeln und Zahlen in YAML, Fortschritt im Cockpit.

## Stand

| Phase                                | Status      |
| ------------------------------------ | ----------- |
| H0 – Prototyp „Die Herde“            | ✅ erledigt |
| H1 – Engine: Insel, Herde, Wölfe     | offen       |
| H2 – App: Insel und Herde            | offen       |
| H3 – Entwicklung der Herde, Meta     | offen       |
| H4 – Jahreskreis, Ereignisse, Inseln | offen       |
| H5 – Balancing                       | offen       |
| H6 – Grafik und Ton                  | offen       |
| H7 – Veröffentlichung                | offen       |

## Phasen

### H0 – Prototyp ✅

Wegwerf-Prototyp `prototypes/herde/index.html`: lebende Insel, Herde mit sichtbarer Absicht, Wölfe in
Gehölz-Korridoren, sechs Karten, Wildnis und Eiszeit. Ergebnis: Richtung vom Inhaber bestätigt.

### H1 – Engine: Insel, Herde, Wölfe

Neue Regeln in `packages/core` nach Konzept 1.0, Kapitel 4–8, mit derselben Bauweise wie bisher (Fassade, reine
Schritte, Daten in YAML, Seed-Zufall). Die alten Regelmodule werden entfernt.

- Abnahme: Tests belegen Sukzession, Feuer, Herdenwahl (deterministisch), Fressen/Vorrat/Jahreszeiten, Wölfe,
  Karten, Wildnis und Eiszeit; Absturz-Test der Bots in der CI; Konsole spielbar.

### H2 – App: Insel und Herde

Low-Poly-Insel aus Feldern, laufende Herde, Absicht als Pfeil, Karten legen, Jahreskreis, Feld-Info
(„verbuscht in 2 Monaten“), Einführung.

- Abnahme: Partie auf dem iPhone von Anfang bis Eiszeit spielbar, ohne Konsolenfehler.

### H3 – Entwicklung der Herde und Meta-Progression

Merkmale aus dem Erlebten, Schöpfungsbuch als Abstammung bis zur ersten Menschengruppe (Konzept 9.1, 9.2 –
erst nach Entscheidung des Inhabers).

### H4 – Jahreskreis, Ereignisse, Inseln

Wetterfelder je Jahreszeit, Ereignisse, mehrere Inseltypen bzw. größere Insel mit Gabelungen (Konzept 9.3, 9.4).

### H5 – Balancing

Bots und Messreihen (Werkzeuge aus Phase 6 des alten Plans wiederverwenden), Ziel 20–30 Minuten pro Partie.

### H6 – Grafik und Ton · H7 – Veröffentlichung

Wie im alten Plan: Low-Poly-Stil, Ton, Capacitor-Apps, TestFlight, Stores.
