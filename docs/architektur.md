# Architektur (Engine v2)

Ziel: **modular und datengetrieben**, damit sich Regeln ändern lassen, ohne den Rest anzufassen. Grundlage ist
das [Konzept](konzept.md); dieses Dokument legt fest, _wo_ welche Regel lebt.

## Neue Engine `packages/herde` (Konzept 1.x „Die Herde“, Phase H1)

`@being-god/herde` setzt die Regeln des Prototyps `prototypes/herde/index.html` als eigenes Paket um, nach derselben
Bauweise wie core: Fassade (`newGame`, `step`, `view`, `legalPlays`, `validateState`), reiner `step` auf einer
Kopie, Seed-Zufall im Zustand, Ereignisse mit Ids statt Texten, alle Regeln und Zahlen in YAML
(`landscapes`, `cards`, `seasons`, `stages`, `params`, `islands`) mit zod-Schema und Prüfung der Querverweise.
Die Bedürfnisse der Herde stehen als **Stufe** in `stages.yaml` (Zustand `herd.stage`), damit H3 Entwicklungsstufen
ergänzen kann. Ein Monat läuft in fester Reihenfolge (Natur → Herde → Wölfe → Nachwuchs → Wildnis/Eiszeit →
Karten ziehen); Details, Erweiterungspunkte und Auslegungen: [packages/herde/README.md](../packages/herde/README.md).
Ein Gleichheitstest prüft Schritt für Schritt gegen die Prototyp-Logik. Konsole: `npm run herde`, Absturz-Test:
`npm run herde:smoke` (auch in der CI). App und Deploy laufen bis H2 weiter auf core; mit dem Umstieg wird core
entfernt. Der Rest dieses Dokuments beschreibt core (Konzept 0.4).

## Schichten

```
packages/core           @being-god/core – Regel-Engine (plattformunabhängig, keine node:-Importe außer src/node/)
  data/*.yaml           alle Inhalte, Zahlen und Textbausteine
  src/index.ts          öffentlicher Einstieg (exportiert api, schema, state, rng, conditions, data, game, meta …)
  src/api.ts            Vertrag für Oberflächen: GameSetup, Action, GameView, Preview, CreationBook (nur Typen)
  src/game.ts           Fassade: newGame, step, view, legalPlays, slotOptions, preview, describeEvent, validateState
  src/validate.ts       validateState: passt ein gespeicherter Spielstand zu den Daten? (wirft nie)
  src/meta.ts           Meta-Progression: newBook, recordGame, parseBook, cardPool, validateDeck, dailySeed
  src/nature.ts         Natur-Phase und Bilanz: führt die Regel-Module in Pipeline-Reihenfolge aus
  src/turn.ts           Zug-Regeln: legalPlays, canEndTurn (Kartenzwang)
  src/view.ts           Lesemodell GameView mit lokalisierten Texten, Odem-Zufluss der nächsten Runde
  src/describe.ts       lokalisierte Meldungen zu GameEvents (describeEvent) und zur Ereignis-Ankündigung
  src/population.ts     Bestände lesen/setzen, Lebenslauf der Arten (entstanden, ausgestorben), Gaben ins Deck
  src/world.ts          kleine gemeinsame Abfragen (Zone, Geografie, Jahreszeit, Jahr, Störung) und RuleError
  src/state.ts          GameState (reines JSON, STATE_VERSION) und GameEvent
  src/conditions.ts     Auswertung der Bedingungssprache
  src/data.ts           buildGameData: Rohdaten → geprüfte GameData inkl. Querverweise (DATA_FILES)
  src/rng.ts            deterministischer Zufall (mulberry32, Zustand im Spielstand)
  src/cards/            deck.ts (Nachziehen, Ablage mischen), play.ts (Ziele, Kosten, Schwellen, Ausspielen),
                        effects.ts (Effektsprache), worldcard.ts (Weltkarten: alle Zonen, je Geografie),
                        text.ts (Kartentexte aus Effekten, Textbausteine)
  src/schema/           zod-Schemas: common (Ids, Texte, Bedingungen, Effekte), world, cards, life,
                        events (Ereignisse + Meta), game (Config, Harmonie, Szenarien, GameData)
  src/rules/            Regel-Module (je Datei ein Modul, Registry in index.ts, Schnittstelle in module.ts)
  src/node/load.ts      Spieldaten von der Platte lesen (nur Node: Tests, Konsole, Simulation)
  tests/                Vitest, Regeln mit konstruierten Zuständen belegt
packages/sim            @being-god/sim – Konsole (play), Simulation mit Bots (sim), Datenprüfung (validate);
                        bis Phase 6 nur Absturz-Test
apps/web                mobile Web-App (Vite, React, React Three Fiber) – liest nur GameView, schickt nur Action
```

Die Oberflächen kennen nur `src/api.ts`, die Fassade und die Meta-Funktionen. Damit kann die Engine intern
umgebaut werden, ohne dass App oder Konsole brechen. `step` ist rein: Der Eingangszustand wird nie verändert.

### Fassade (`src/game.ts`)

| Funktion        | Aufgabe                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `newGame`       | Partie aus Szenario, Seed, Deck und Schöpfungsbuch; optional variierte Startwelt; erste Vorschau |
| `step`          | `play` (Karte ausspielen) oder `endTurn` (Natur-Pipeline, neue Runde, nachziehen)                |
| `view`          | `GameView` für Oberflächen, lokalisiert                                                          |
| `legalPlays`    | alle bezahlbaren, vollständig belegten Kartenzüge                                                |
| `slotOptions`   | gültige Werte für den nächsten offenen Slot einer Handkarte                                      |
| `preview`       | Wirkung eines Kartenzugs ohne Ausführung (Werte, Schwellen, Formen, Bestände, Ereignis)          |
| `describeEvent` | lokalisierter Kurztext zu einem `GameEvent`                                                      |
| `validateState` | prüft einen gespeicherten Zustand gegen die Daten (`{ ok }` bzw. `{ ok: false, reason }`)        |

### Meta (`src/meta.ts`)

Das Schöpfungsbuch ist reines JSON; jede Funktion liefert ein neues Buch.

| Funktion       | Aufgabe                                                                             |
| -------------- | ----------------------------------------------------------------------------------- |
| `newBook`      | leeres Buch vor der ersten Partie                                                   |
| `recordGame`   | Partie eintragen: entdeckte Arten, Kennzahlen, Bestwerte, neue Meilensteine         |
| `parseBook`    | gespeichertes Buch prüfen (oder `null`)                                             |
| `cardPool`     | Kartenpool für Startdecks: Grundpool + Gaben entdeckter Arten + Freischaltungen     |
| `validateDeck` | Startdeck prüfen (Größe, Kopien, bekannte Karten, mit Buch auch Pool-Zugehörigkeit) |
| `dailySeed`    | Seed der Welt des Tages aus einem Datum                                             |

## Rundenablauf

```
newGame → [Runde n]
  Vorschau:   angekündigtes Ereignis (forecast) ist sichtbar
  Eingriffe:  step({type:'play'}) … (mind. config.turn.minPlays, sofern eine bezahlbare Karte spielbar ist)
  step({type:'endTurn'}) → Natur-Pipeline und Bilanz (Module in der Reihenfolge aus config.yaml)
  → Runde n+1: Karten auf turn.handSize nachziehen        … bis Harmonie 0 ⇒ phase 'over'
```

## Regel-Module

Jede Mechanik ist ein Modul mit fester Schnittstelle (`src/rules/module.ts`):

```ts
interface RuleModule<P> {
  id: string; // Schlüssel in config.yaml → pipeline und rules.<id>
  params: z.ZodType<P>; // Schema der Parameter unter rules.<id> (mit Defaults)
  run(ctx: RuleContext<P>): void; // ctx = { data, state, params, emit, rng }
}
```

- Die **Reihenfolge** steht in `config.yaml` unter `pipeline` (Konzept Kap. 3). Ein Modul entfernen oder
  umsortieren = YAML ändern.
- Die **Parameter** eines Moduls stehen unter `rules.<id>` in `config.yaml` (z. B. Selbstheilungs-Intervall).
- Module verändern nur den `GameState` und melden jede Änderung als `GameEvent`. Sie rufen sich nicht
  gegenseitig auf; gemeinsame Hilfen liegen in `src/world.ts`, `src/population.ts` und `src/cards/effects.ts`.

Aktuelle Pipeline (`config.yaml`):

```
season → event → couplings → healing → forms → levels → life → evolution → score → harmony → breath → forecast
└────────────────────────────── Natur ──────────────────────────────┘   └──────────── Bilanz ────────────┘
```

| #   | Modul       | Konzept | Aufgabe                                                                  |
| --- | ----------- | ------- | ------------------------------------------------------------------------ |
| 1   | `season`    | 9       | Jahreszeiten-Effekte auf Werte                                           |
| 2   | `event`     | 9       | angekündigtes Ereignis eintreten lassen (skaliert mit den Jahren)        |
| 3   | `couplings` | 4.3     | Schneeschmelze, Süßwasser, Waldklima, Hochwasser                         |
| 4   | `healing`   | 4.1     | Werte driften zum Ruhewert                                               |
| 5   | `forms`     | 4.2     | Form jeder Zone aus den Werten bestimmen; Störungsform stört die Zone    |
| 6   | `levels`    | 4.4     | Zonenstufe steigen/fallen lassen                                         |
| 7   | `life`      | 5.1     | Fressen, Wachstum, Hunger, Überweidung, Jagd, Wanderung, Aussterben      |
| 8   | `evolution` | 5.2     | neue Arten aus Vorfahren, Selektionsdruck, Gaben ins Deck                |
| 9   | `score`     | 10      | Punkte der Runde (vor `harmony`, damit die Kollaps-Runde noch zählt)     |
| 10  | `harmony`   | 7       | Harmonie berechnen, Kollaps                                              |
| 11  | `breath`    | 6.1     | Odem-Zufluss                                                             |
| 12  | `forecast`  | 9       | Ereignis der nächsten Runde auslosen und ankündigen (am Ende der Bilanz) |

Das Nachziehen gehört nicht zur Pipeline, sondern zu `step` (Beginn der neuen Runde).

## Daten

| Datei              | Inhalt                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------- |
| `config.yaml`      | Skala, Zug-Regeln, Deck-Grenzen, Startwelt, Pipeline, Modul-Parameter, Startdeck, Texte |
| `geographies.yaml` | Werte (gemeinsam + Sonderwert), Geografien mit Ruhewerten und Formen                    |
| `map.yaml`         | Zonen der Insel, Geografie je Zone, Nachbarschaft, Startwerte                           |
| `seasons.yaml`     | Jahreszeiten und ihre Effekte                                                           |
| `couplings.yaml`   | Kopplungen zwischen Zonen (Bedingung → Effekt)                                          |
| `cards.yaml`       | Kategorien; Karten mit Kosten, Reichweite, Slots, Effekten (je Geografie), Schwellen    |
| `harmony.yaml`     | Start, Kollaps, Beiträge zur Harmonie pro Runde                                         |
| `species.yaml`     | Stammbaum: Stufe, Vorfahr, Lebensraum, Nahrung, Jagd, Gaben, Evolutionsbedingungen      |
| `events.yaml`      | Ereignisse: Gewicht, frühestes Jahr, Zielzone, Effekte oder Karte, Skalierung           |
| `meta.yaml`        | Grundpool für Startdecks, Meilensteine mit Bedingungen und Freischaltungen              |
| `scenarios.yaml`   | Startwelten (standard, drought, wet, fragile)                                           |

Alle Texte sind `{ de, en }`; erzeugte Texte (Kartentext, Meldungen) setzen sich aus `config.yaml → texts`
zusammen. Zahlen sind bis Phase 6 Platzhalter (Logik vor Balancing).

### Effekt- und Bedingungssprache

Effekte und Bedingungen nutzen überall dieselbe Sprache (`src/schema/common.ts`, `src/conditions.ts`,
`src/cards/effects.ts`), damit Karten, Schwellen, Jahreszeiten, Kopplungen, Formen, Evolution und Ereignisse
gleich beschrieben werden.

**Bedingungen** (immer gegen eine Zone ausgewertet): `stat` (gte/lte/eq), `hasStat`, `geography`, `form`,
`formKind`, `season`, `disturbedWithin`, `population` (gte/lte/eq), `minLevel`, `anyNeighbor`, `not`, `any`.

**Effekte** (mit `at` = gebundene Zone und `scope` = self/neighbors/area/all): `adjust`, `set`, `restore`
(ganz oder in Schritten), `transfer` (Wert wandert als anderer Wert in eine Zone), `draw`, `breath`,
`population`, `move` (Tiere wandern), `disturb`, `setLevel`, `event` (cancel/delay).

**Slot-Arten** von Karten (Ziele, die der Spieler wählt):

| Slot       | Bedeutung                                                                       |
| ---------- | ------------------------------------------------------------------------------- |
| `zone`     | eine Zone, optional gefiltert (`when`)                                          |
| `neighbor` | Nachbarzone eines früheren Zonen-Slots (`of`)                                   |
| `species`  | Art mit Bestand ≥ 1 in der Zone eines früheren Slots; optional `eats`/`species` |
| `choice`   | Wahl zwischen Optionen mit eigenen Effekten (z. B. Späherblick)                 |

**Schwellen** (`triggers`) einer Karte prüfen Bedingungen an einem Slot vor oder nach dem Grundeffekt und
können als Störung zählen (🔥 Feuer, Baumsturz …).

**Reichweite** (`reach`, Konzept 6.2, Variante C): `zone` (Standard) wirkt auf die gewählten Slots. `world`
(Wetter, Naturkräfte) wirkt ohne Zielwahl auf alle Zonen: Weltkarten haben keine Zonen-/Art-Slots (ein
`choice`-Slot ist erlaubt), die jeweilige Zone heißt `self` (`at` weglassen). `effects` wirken in jeder Zone,
`byGeography.<geografie>` zusätzlich nur in Zonen dieser Geografie; Schwellen gelten je Zone.

```yaml
- id: rain
  category: weather
  reach: world
  byGeography:
    forest: [{ adjust: moisture, by: 1 }]
    mountains: [{ adjust: snow, by: 1 }]
```

Ablauf (`src/cards/worldcard.ts`), damit die Reihenfolge der Zonen nichts entscheidet: `before`-Schwellen aller
Zonen gegen den Zustand vor der Karte → Grundwirkung (Effekte auf die Zone selbst sofort; Ausstrahlungen mit
`scope` ≠ self werden je Zone und Wert summiert und einmal angewendet) → zonenlose Effekte (Ziehen, Odem,
Ereignis) einmal → `after`-Schwellen aller Zonen → Folgen je Schwelle in allen auslösenden Zonen (Ausstrahlungen
und Odem wieder summiert). Die Datenprüfung verlangt: Werte passen zur Geografie (Schnee nur in den Bergen),
Ausstrahlungen nur mit `adjust`, `population`, `disturb`. `legalPlays` liefert für eine Weltkarte genau einen Zug
mit `targets: {}` (bzw. einen je Wahl), `preview` die Änderungen aller Zonen. Als Ereigniskarte (`events.yaml →
card`) wirkt eine Weltkarte mit Zielzone nur dort, ohne Zielzone auf allen Zonen.

## Web-App (`apps/web`)

```
src/client/   GameClient (Schnittstelle der Oberfläche, Notices), EngineClient (echte Engine),
              MockClient (Vorschau-Daten ohne Regeln), SaveStore/BookStore/DeckStore (localStorage bzw. Speicher),
              gameData.ts (YAML zur Build-Zeit eingebunden, mit buildGameData geprüft),
              index.ts (einzige Stelle, die die Implementierung wählt; URL-Schalter)
src/logic/    reine, getestete Logik: Zielwahl-Zustandsautomat (targeting), Startdeck (deck)
src/state/    useGame, Zielwahl (useTargeting), Ziehen (useCardDrag), Bewegung (motion), Einführung
src/scene/    3D-Insel (React Three Fiber): Zonen, Figuren als Instanced-Meshes, Farben, Beschriftungen
src/ui/       HUD, Hand, Kartendetail, Vorschau, Zonen-Detail, Wahl-Chips, Meldungen, Spiel-Ende, Schöpfungsbuch,
              Startdeck-Auswahl, Hilfe, Einführung
src/i18n/     Deutsch und Englisch (Satzbau der Meldungen); locale.ts wählt die Sprache (Standard Englisch)
tests/        Vitest ohne DOM: EngineClient, SaveStore, Buch-Eintrag, Startdeck, Zielwahl, Sprache
```

Die App spricht ausschließlich über `GameClient`; `EngineClient` übersetzt `GameEvent`s in lokalisierte
`Notice`s und schreibt Spielstand und Schöpfungsbuch über die Stores fort. Details: [apps/web/README.md](../apps/web/README.md),
Deploy: [deploy.md](deploy.md).

## Erweiterungspunkte

- **Neue Mechanik:** neues Modul in `src/rules/`, in `src/rules/index.ts` eintragen, in `pipeline` aufnehmen.
- **Neue Karte/Art/Form/Ereignis/Meilenstein:** nur YAML.
- **Neuer Effekt- oder Bedingungstyp:** Schema in `schema/common.ts` + eine Funktion in `cards/effects.ts`
  bzw. `conditions.ts` + Textbaustein in `cards/text.ts` und `config.yaml → texts`.
- **Neue Oberfläche:** nur `api.ts`, Fassade und Meta-Funktionen verwenden.
