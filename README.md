# Urwald-Ökosystem-Spiel (Arbeitstitel)

Rundenbasiertes Kartenspiel mit indirekter Kontrolle: Der Spieler formt über Karten-Eingriffe
die Bedingungen in einem Urwald, Tiere ziehen anhand ihrer Steckbriefe selbst ein und aus.

- Konzept: [docs/handover.md](docs/handover.md)
- Umgesetzte Regeln, Auslegungen und offene Punkte: [docs/regeln.md](docs/regeln.md)

## Stand: Prototyp 0.1 – Regel-Engine und Simulation

Noch keine Grafik. Es gibt eine spielbare Konsolenversion und Bots für Balancing-Läufe.

```bash
npm install
npm run play                       # interaktive Expedition in der Konsole
npm run play -- --scenario dry     # Startzustand: standard | dry | flooded | burnt
npm run sim                        # 200 Kampagnen × 4 Expeditionen mit dem greedy-Bot
npm run sim -- --bot random --runs 500 --scenario random
npm run validate                   # Spieldaten prüfen und als Text ausgeben
npm run check                      # Typecheck + Tests + Datenprüfung (läuft auch in CI)
```

Das Notizbuch der Konsolenversion liegt in `save/notebook.json` (nicht im Repo). Löschen = Neustart der Progression.

## Balancing ohne Code

Alle Regeln stehen als YAML in [`data/`](data):

| Datei | Inhalt |
| --- | --- |
| `config.yaml` | Handgröße, Kartenzwang, Deckgrößen, Einzugsverzögerung, Ausrottungsregel, Startdeck … |
| `cards.yaml` | Karten mit Zielen (Slots), Grundeffekten und Schwellen |
| `animals.yaml` | Steckbriefe: Stufe, Bedingungen, Karte, Beute |
| `zones.yaml` | Zonentypen, Zonenwechsel, Karte des Waldes (Startwerte, Nachbarn) |
| `scenarios.yaml` | Startzustände (ausgetrocknet, überflutet, abgebrannt) |

Nach einer Änderung: `npm run validate` (findet Tippfehler und kaputte Verweise), dann `npm run sim`.

## Architektur

```
src/core/   Regel-Engine ohne Plattformabhängigkeit (läuft später unverändert im Browser)
  schema.ts      Datenschema (zod) – Bedingungs- und Effektsprache
  data.ts        Laden + Querverweisprüfung
  state.ts       Spielzustand (reine Daten, serialisierbar) und Ereignis-Log
  conditions.ts  Auswertung der Bedingungen
  engine.ts      Zugablauf: Karte spielen, Schwellen, Zugende (Ökosystem), Wertung
  meta.ts        Notizbuch, Kartenpool, Deckprüfung
  rng.ts         Deterministischer Zufall (Seed)
src/sim/    Bots (random, greedy) und Kampagnen-Simulation
src/node/   Dateizugriff (YAML laden)
src/cli/    Konsolen-Oberfläche, deutsche Texte, Simulation, Validierung
tests/      Vitest
```

Die Engine schreibt alle Vorgänge als strukturierte Ereignisse ins Log; Texte entstehen erst in der
Oberfläche (`src/cli/text.ts`). Damit sind Übersetzungen und eine spätere Web-Oberfläche entkoppelt.

## Entwicklung

Änderungen laufen über Pull Requests gegen `main`; CI führt `npm run check` und einen kurzen Simulationslauf aus.
