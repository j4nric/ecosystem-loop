# Architektur

Ziel: **modular und datengetrieben**, damit sich Regeln ändern lassen, ohne den Rest anzufassen. Grundlage ist
das [Konzept 1.2 „Die Herde“](konzept.md); dieses Dokument legt fest, _wo_ welche Regel lebt. Die Architektur
der alten Engine und App zu Konzept 0.4 steht im [Archiv](archiv/architektur-0.4.md).

## Überblick

```
packages/herde   @being-god/herde – Regel-Engine und Spieldaten (plattformunabhängig, deterministisch)
  data/*.yaml      alle Regeln und Zahlen: Landschaften, Karten, Jahreszeiten, Stufen, Parameter, Inseln
  src/             Fassade, Monatsablauf, Natur, Herde, Wölfe, Karten, Lesemodell, Prüfung, Zufalls-Bot
  src/node/        nur Node: Daten von der Platte laden, Konsole, Absturz-Test, Datenprüfung
  tests/           Vitest mit konstruierten Zuständen
apps/web         @being-god/web – mobile Web-App (Vite, React, React Three Fiber), nativ über Capacitor
prototypes/      Wegwerf-Prototypen (Referenz für den Gleichheitstest der Engine)
deploy/          Caddy und docker-compose für den eigenen vServer
```

Abhängigkeiten laufen nur in eine Richtung: Die App benutzt die Engine über `@being-god/herde` (Fassade, Typen
aus `api.ts`, `buildData`). Die Engine kennt keine Oberfläche, keine Texte außer den Namen in den Daten und keine
`node:`-Module außerhalb von `src/node/`.

## Engine `packages/herde`

Einzelheiten (Dateien, Ablauf eines Monats, Ereignisse, Erweiterungspunkte, Auslegungen):
[packages/herde/README.md](../packages/herde/README.md).

- **Fassade** (`src/game.ts`): `newGame`, `step`, `view`, `legalPlays`, `validateState`. `step` ist rein:
  Es arbeitet auf einer Kopie und liefert `{ state, events }`; ungültige Züge werfen `RuleError`.
- **Zustand** (`src/state.ts`) ist reines JSON mit `STATE_VERSION`, damit Spielstände gespeichert und mit
  `validateState` geprüft werden können. Der Seed-Zufall (`src/rng.ts`) liegt im Zustand.
- **Ereignisse** tragen nur Ids und Zahlen; Texte setzt die Oberfläche zusammen.
- **Lesemodell** (`src/view.ts`): `HerdeView` mit Feldern, Herde, Rudeln, Absicht der Herde, Prognosen und
  Hand mit gültigen Zielen. Die Absicht entsteht genau so wie im nächsten `advance`.
- **Daten** (`src/schema.ts`, `src/data.ts`): zod-Schemas je YAML-Datei und `buildData`, das Querverweise und
  Widersprüche prüft (z. B. unbekannte Landschaften, Geburtsmonat außerhalb des Jahres,
  `wolves.starveReset < starveAfter`). Die Bedürfnisse der Herde stehen als **Stufe** in `stages.yaml`.
- **Monat** (`src/month.ts`): feste Reihenfolge Natur (Wachstum, Sukzession, Feuer) → Herde (Zug, Fressen,
  Durst, Kälte) → Wölfe → Nachwuchs → Wildnis/Eiszeit → Karten ziehen.
- **Zufalls-Bot** (`src/bot.ts`) spielt nur über die Fassade und prüft jeden Zustand; er dient bis H5 als
  Absturz-Test (`npm run herde:smoke`, auch in der CI).

Werkzeuge: `npm run herde` (Konsole), `npm run herde:smoke` (Absturz-Test), `npm run validate` (Datenprüfung).

## App `apps/web`

Einzelheiten (Starten, iOS, URL-Schalter, Bedienung, Performance, Tests): [apps/web/README.md](../apps/web/README.md).

```
src/client/   GameClient (Schnittstelle der Oberfläche), HerdeClient (echte Engine), SaveStore (localStorage
              bzw. Speicher), gameData.ts (YAML zur Build-Zeit eingebunden, mit buildData geprüft), index.ts
src/logic/    reine Funktionen ohne DOM: events (Ereignisse → Meldungen und Effekte), preview (Vorschau über
              step + view), format (Texte, Regelzahlen aus den Daten, Prognose, Pfeile)
src/state/    useGame (View, Protokoll, Meldungen), monthRunner (schrittweises Ablaufen der Monate, ohne DOM
              getestet), motion (reduzierte Bewegung), tutorialStore
src/scene/    3D-Insel: IslandScene, islandModel (Instanzen aus der View, rein), Instanced, Figures, FxLayer,
              geometries, palette
src/ui/       Statusleiste, Hand, Sheets (Karte/Vorschau, Feld-Info, Geschehen), Spielende, Hilfe, Einführung,
              Meldungen
src/i18n/     Deutsch und Englisch; Namen aus den Daten, Regelzahlen aus `data.params`
tests/        Vitest ohne DOM
```

- Die App spricht ausschließlich über `GameClient`. `HerdeClient` hält den Engine-Zustand, führt Aktionen mit
  `step` aus, übersetzt die Ereignisse in Meldungen und Szenen-Effekte und speichert Stand und Protokoll.
- Die Szene rendert nur die View: Instanzen entstehen in `islandModel.ts`, wenn sich die View ändert; pro Frame
  laufen nur Schweben, Pulsieren, Zug der Figuren und Effekte.
- Spieltexte nennen keine Regelzahlen fest, sondern lesen sie aus `data.params`.
- Bei `prefers-reduced-motion` entfallen Schweben, Pulsieren, Hüpfen, flackernde Flammen und fallender Regen
  (stattdessen färben sich die Felder kurz ein); die Szene zeichnet dann nur auf Anforderung
  (`frameloop="demand"`, `invalidate()` nach jeder Änderung).

Deploy: [deploy.md](deploy.md).

## Erweiterungspunkte

- **Neue Karte, Landschaft, Insel oder Stufe:** nur YAML, solange die Wirkungen bestehen bleiben.
- **Neuer Karteneffekt:** `CardEffect` in `schema.ts` und `playCard` in `cards.ts`; Meldung und Effekt in
  `apps/web/src/logic/events.ts`.
- **Neue Regel im Monat:** eigener Schritt in `month.ts` mit Parametern in YAML und Ereignissen in `state.ts`.
- **Neue Oberfläche:** nur Fassade und `api.ts` verwenden.
