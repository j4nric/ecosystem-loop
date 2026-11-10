# @being-god/herde

Regel-Engine von Konzept 1.x „Die Herde“ ([Konzept](../../docs/konzept.md), Kapitel 4–8). Sie setzt die Regeln des
Prototyps `prototypes/herde/index.html` um – datengetrieben, deterministisch und ohne Plattform-Abhängigkeit.
Für denselben Seed und dieselben Züge liefert sie Schritt für Schritt denselben Zustand wie der Prototyp
(`tests/prototype.test.ts`). Die alte Engine `packages/core` (Konzept 0.4) bleibt bis H2 daneben bestehen.

## Aufbau

```
data/landscapes.yaml  Landschaften: Futter-Maximum, Wachstum je Jahreszeit, walk/wood/den, Brand, Sukzession, Startwerte
data/cards.yaml       Karten: Ziel-Landschaften, Wirkung (transform/ignite/grow), Wildnis-Kosten, Ziehgewicht, global
data/seasons.yaml     Jahreszeiten (water/shelter/fire), Monate je Jahreszeit, Monatsnamen
data/stages.yaml      Stufen der Herde: Bedürfnisse (Futter, Wasser, Schutz, Verluste, Gewichte der Herdenwahl)
data/params.yaml      Parameter (Herde zu Beginn, Feuer, Wölfe, Wildnis, Eiszeit, Karten)
data/islands.yaml     Inseln als Zeichenraster mit Legende, Start von Herde und Rudeln

src/index.ts          öffentlicher Einstieg
src/api.ts            Vertrag für Oberflächen: Action, HerdeView, StepResult, StateCheck (nur Typen)
src/game.ts           Fassade: newGame, step, legalPlays (+ view, validateState)
src/month.ts          ein Monat in fester Reihenfolge (advance)
src/nature.ts         Wachstum, Sukzession, Feuer
src/herd.ts           Herdenwahl (chooseMove), Fressen, Durst, Kälte, Feuer, Nachwuchs
src/wolves.ts         Reißen, Wandern, Wachsen/Gründen/Verhungern, Einwandern
src/cards.ts          Ziehen, gültige Ziele, Ausspielen
src/view.ts           Lesemodell (Absicht, Prognosen, Hand mit Zielen)
src/validate.ts       validateState für gespeicherte Stände (STATE_VERSION)
src/world.ts          Abfragen (Felder, Nachbarn, Jahreszeit, Stufe), Landschaftswandel, RuleError
src/state.ts          HerdeState (reines JSON) und HerdeEvent
src/schema.ts         zod-Schemas, HerdeData
src/data.ts           buildData: Rohdaten → geprüfte Daten inkl. Querverweise
src/rng.ts            Seed-Zufall (Zustand `rng` im Spielstand)
src/bot.ts            Zufalls-Bot für den Absturz-Test
src/node/load.ts      Daten von der Platte lesen (nur Node)
src/node/cli/         Konsole (play), Absturz-Test (smoke), Datenprüfung (validate)
tests/                Vitest mit konstruierten Zuständen (Testinsel 7 × 7 aus tests/helpers.ts)
```

```sh
npm run herde -- --seed 7          # Konsole: p <hand> <x> <y> · w (Monat) · s (Jahreszeit) · q
npm run herde:smoke -- --runs 20   # Zufalls-Bots bis zum Ende, jeder Zustand wird geprüft
npm run validate                   # Datenprüfung (core und herde)
```

## Fassade

```ts
newGame(data, { seed, island? }): HerdeState
step(data, state, action): { state, events }      // rein, wirft RuleError bei ungültigen Zügen
  action = { type: 'play', hand, x?, y? } | { type: 'advance' }
view(data, state): HerdeView                       // Felder, Herde, Rudel, Absicht, Hand mit Zielen, Datum, Eiszeit
legalPlays(data, state): Action[]                  // alle Kartenzüge; 'advance' geht immer
validateState(data, unknown): { ok: true } | { ok: false, reason }
```

Daten: `buildData(raw)` (plattformunabhängig, z. B. für die App mit zur Build-Zeit eingebundenem YAML) bzw.
`loadData()` aus `@being-god/herde/node`.

## Ablauf eines Monats (`advance`)

1. **Wachstum:** Jedes Feld wächst um `grow[Jahreszeit]` seiner Landschaft bis zum Maximum (+ `fertileBonus`,
   solange fruchtbar).
2. **Sukzession:** Alter +1, Fruchtbarkeit −1; ein Feld wandelt sich, wenn seine Uhr (`age` bzw. `ungrazed`)
   `months` erreicht.
3. **Waldbrand:** In Jahreszeiten mit `fire` brennt jedes Feld mit `fireChance` (Zeile für Zeile) mit dieser
   Chance; Feuer springt mit `fire.spread` auf brennbare 4er-Nachbarn über; Rudel im Feuer sterben. Brennt das Feld
   der Herde, verliert sie `fireLoss`.
4. **Herde zieht** auf das beste Feld im Umkreis 1 (Absicht).
5. **Fressen** aus dem eigenen und den 8 Nachbarfeldern, die vollsten zuerst; Überschuss → Vorrat, Mangel zehrt
   ihn auf, danach Hungertote.
6. **Durst** (Jahreszeit `water`, ab `thirstAfter` Monaten) und **Kälte** (Jahreszeit `shelter`).
7. **Wölfe:** reißen (Umkreis 1), hungrige ziehen durchs Gehölz zur Herde, satte wachsen bzw. gründen neue Rudel,
   hungrige verkümmern; ohne Rudel wandern bei genug Gehölz neue ein. Danach werden die Toten abgezogen.
8. **Nachwuchs** im Geburtsmonat (nicht in der Eiszeit), je nach Vorrat.
9. **Wildnis** +`perMonth`; bei `max` beginnt die Eiszeit (`ice.months` Monate `ice.season`); endet sie mit
   lebender Herde, ist die Partie gewonnen. Stirbt die Herde aus, ist sie verloren.
10. **Monat +1;** zu Beginn jeder Jahreszeit `drawPerSeason` Karten ziehen, höchstens `handMax` auf der Hand.

Die **Absicht** in `view` entsteht, indem die Schritte 1–3 auf einer Kopie laufen (mit demselben Seed-Zufall) und
danach die Herdenwahl folgt – also genau so wie in `advance`. Die Herdenwahl selbst hat keinen Zufall.

## Ereignisse

`cardPlayed`, `cardsDrawn`, `cellChanged` (cause: succession/card/fire), `grassGrew`, `fire` (cause:
lightning/wildfire, Felder), `herdMoved` (mit Grund), `herdAte`, `herdStarved`, `herdThirsted`, `herdFroze`,
`herdBurned`, `herdBorn`, `wolvesHunted`, `packMoved`, `packGrew`, `packFounded`, `packStarved`, `packGone` (cause:
starved/fire/driven), `packImmigrated`, `seasonBegan`, `iceAgeBegan`, `iceAgeEnded`, `gameWon`, `gameLost`.
Ereignisse tragen nur Ids und Zahlen; Texte setzt die Oberfläche zusammen (Namen stehen in den Daten).

## Erweiterungspunkte

- **Stufen der Herde (H3, Entwicklung):** Alle Bedürfnisse der Herde stehen in `stages.yaml` (was als Futter,
  Wasser, Schutz zählt; Bedarf, Fressfaktor, Vorratsdeckel; Verluste durch Hunger, Durst, Kälte, Feuer;
  Geburtenrate; Gewichte der Herdenwahl). Der Zustand trägt `herd.stage`. Eine neue Stufe ist nur YAML; der
  Wechsel zwischen Stufen (Entwicklungslogik) fehlt noch und gehört als eigener Schritt in `month.ts`.
- **Merkmale (H3):** Merkmale verändern dieselben Größen wie eine Stufe. Naheliegend: `herd.traits: string[]` im
  Zustand, `traits.yaml` mit Änderungen an Stufenwerten (z. B. `coldLoss × 0.5`), und `stageOf()` in `world.ts`
  liefert die um Merkmale angepasste Stufe – alle Regeln lesen ihre Werte schon über `stageOf()`. Zähler für das
  „Erlebte“ (Winter im Wald, Wolfsangriffe) lassen sich aus den Ereignissen von `advance` fortschreiben.
- **Wetterfelder (H4):** Die Jahreszeit wird überall über `seasonOf()` gelesen (Wachstum über `grow[season]`,
  Bedürfnisse über `water`/`shelter`, Feuer über `fire`). Ein Wetterfeld je Jahreszeit kann als Zustand
  `weather: Record<season, card>` diese Werte überlagern (z. B. Wachstum ×2, `fire` mit höherer Chance); Wetterkarten
  wären Karten mit neuem Effekttyp in `cards.yaml`.
- **Neue Karte:** nur YAML, solange die Wirkung `transform`, `ignite` oder `grow` ist; sonst neuer Effekttyp in
  `schema.ts` (`CardEffect`) und `cards.ts` (`playCard`).
- **Neue Landschaft oder Insel:** nur YAML.

## Auslegungen und Abweichungen vom Prototyp

Im Code mit `// AUSLEGUNG:` markiert:

- **Absicht = Ausführung** (`view.ts`): Der Prototyp zeigt die Absicht vor dem Wachstum, führt sie aber danach aus;
  hier wird beides nach den Schritten 1–3 berechnet. Folge: Ein Waldbrand im nächsten Monat kann sich in der Absicht
  andeuten.
- **Zufall** (`rng.ts`): Der Zustand schreitet wie im Prototyp fort (Mischung auf dem Zustand, dann
  `+0x9e3779b9`), nicht wie in core – dadurch ist der Verlauf identisch zum Prototyp.
- **Rudelgründung** (`wolves.ts`): Felder, auf denen sich im selben Monat schon ein Rudel gegründet hat, gelten als
  besetzt (im Prototyp könnten zwei neue Rudel auf einem Feld landen).
- **Fels nicht auf die Herde** (`cards.ts`): allgemein aus den Daten – keine Karte, deren Ziel unbetretbar ist.
- **Beweidungs-Uhr** (`world.ts`): Jeder Landschaftswechsel setzt sie zurück (im Prototyp nur Säen und Brand →
  Wiese; für andere Ziele ohne Wirkung).
- **`iceDone`** (`month.ts`) entfällt: Das Ende der Eiszeit beendet die Partie immer.
- **Prognose** (`view.ts`): `inMonths` ist die genaue Zahl der Monatsschritte; der Prototyp zeigte bei der
  Verbuschung einen Monat zu wenig an.
