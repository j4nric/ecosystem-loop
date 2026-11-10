# Architektur (Engine v2)

Ziel: **modular und datengetrieben**, damit sich Regeln ändern lassen, ohne den Rest anzufassen. Grundlage ist
das [Konzept](konzept.md); dieses Dokument legt fest, _wo_ welche Regel lebt.

## Schichten

```
packages/core       Regel-Engine (plattformunabhängig, keine node:-Importe außer src/node/)
  data/*.yaml       alle Inhalte und Zahlen
  src/api.ts        Vertrag für Oberflächen: GameSetup, Action, GameView, Preview (nur Typen)
  src/game.ts       Fassade: newGame, step, view, legalPlays, preview
  src/schema/       zod-Schemas je Fachbereich + GameData
  src/state.ts      GameState (reines JSON) und GameEvent
  src/rules/        Regel-Module (je Datei ein Modul, siehe unten)
  src/cards/        Karten: Ziele, Effekte, Schwellen, Kosten
  src/conditions.ts Bedingungssprache
  src/rng.ts        deterministischer Zufall
  src/meta.ts       Schöpfungsbuch, Startdeck (ab Phase 3)
packages/sim        Konsole, Bots (bis Phase 6 nur Absturz-Test)
apps/web            mobile Web-App (Vite, React, React Three Fiber) – liest nur GameView, schickt nur Action
```

Die Oberflächen kennen nur `src/api.ts` und die Fassade. Damit kann die Engine intern umgebaut werden,
ohne dass App oder Konsole brechen.

## Rundenablauf

```
newGame → [Runde n]
  Eingriffe:  step({type:'play'}) … (mind. config.turn.minPlays, Odem reicht)
  step({type:'endTurn'}) → Natur-Pipeline (Module in der Reihenfolge aus config.yaml) → Bilanz
  → Runde n+1 (Karten nachziehen, Ereignis-Vorschau)            … bis Harmonie 0 ⇒ phase 'over'
```

## Regel-Module

Jede Mechanik ist ein Modul mit fester Schnittstelle:

```ts
interface RuleModule {
  id: string; // Schlüssel in config.yaml → pipeline und rules.<id>
  run(ctx: RuleContext): void; // ctx = { data, state, params, emit, rng }
}
```

- Die **Reihenfolge** der Natur-Phase steht in `config.yaml` unter `pipeline` (Konzept Kap. 3).
  Ein Modul entfernen oder umsortieren = YAML ändern.
- Die **Parameter** eines Moduls stehen unter `rules.<id>` in `config.yaml` (z. B. Selbstheilungs-Intervall).
- Module verändern nur den `GameState` und melden jede Änderung als `GameEvent`. Sie rufen sich nicht
  gegenseitig auf; gemeinsame Hilfen liegen in `src/rules/util.ts`.

| Modul       | Konzept | Phase | Aufgabe                                              |
| ----------- | ------- | ----- | ---------------------------------------------------- |
| `season`    | 9       | 1     | Jahreszeiten-Effekte auf Werte                       |
| `event`     | 9       | 3     | angekündigtes Ereignis eintreten lassen              |
| `couplings` | 4.3     | 1     | Schneeschmelze, Süßwasser, Waldklima, Hochwasser     |
| `healing`   | 4.1     | 1     | Werte driften zum Ruhewert                           |
| `forms`     | 4.2     | 1     | Form jeder Zone aus den Werten bestimmen             |
| `levels`    | 4.4     | 1     | Zonenstufe steigen/fallen lassen                     |
| `life`      | 5.1     | 2     | Fressen, Wachstum, Hunger, Überpopulation, Wanderung |
| `evolution` | 5.2     | 2     | neue Arten aus Vorfahren                             |
| `harmony`   | 7       | 1     | Harmonie berechnen, Kollaps                          |
| `breath`    | 6.1     | 1     | Odem-Zufluss                                         |
| `forecast`  | 9       | 3     | nächstes Ereignis ankündigen                         |
| `score`     | 10      | 2     | Punkte der Runde                                     |

Ein Modul, dessen Daten noch fehlen (z. B. `life` in Phase 1), ist in der Pipeline einfach nicht aufgeführt.

## Daten

| Datei              | Inhalt                                                               |
| ------------------ | -------------------------------------------------------------------- |
| `config.yaml`      | Skalen, Zug-Regeln, Pipeline, Modul-Parameter, Startdeck             |
| `geographies.yaml` | Werte (gemeinsam + Sonderwert), Geografien mit Ruhewerten und Formen |
| `map.yaml`         | Zonen der Insel, Geografie je Zone, Nachbarschaft, Startwerte        |
| `seasons.yaml`     | Jahreszeiten und ihre Effekte                                        |
| `couplings.yaml`   | Kopplungen zwischen Zonen (Bedingung → Effekt)                       |
| `cards.yaml`       | Karten mit Kategorie, Kosten, Zielen, Effekten, Schwellen            |
| `harmony.yaml`     | Beiträge zur Harmonie                                                |
| `species.yaml`     | Stammbaum, Lebensräume, Nahrung, Gaben (Phase 2)                     |
| `events.yaml`      | Ereignisse (Phase 3)                                                 |
| `scenarios.yaml`   | Startwelten                                                          |

Effekte und Bedingungen nutzen überall dieselbe Sprache (`src/conditions.ts`, `src/cards/effects.ts`), damit
Karten, Jahreszeiten, Kopplungen und Ereignisse gleich beschrieben werden.

Alle Texte sind `{ de, en }`. Zahlen sind bis Phase 6 Platzhalter (Logik vor Balancing).

## Erweiterungspunkte

- **Neue Mechanik:** neues Modul in `src/rules/`, in der Registry eintragen, in `pipeline` aufnehmen.
- **Neue Karte/Art/Form/Ereignis:** nur YAML.
- **Neuer Effekt- oder Bedingungstyp:** Schema + eine Funktion in `effects.ts` bzw. `conditions.ts`.
- **Neue Oberfläche:** nur `api.ts` + Fassade verwenden.
