# @being-god/herde

Regel-Engine von Konzept 1.x „Die Herde“ ([Konzept](../../docs/konzept.md), Kapitel 4–8 und 9.1/9.2). Sie setzt die Regeln des
Prototyps `prototypes/herde/index.html` um – datengetrieben, deterministisch und ohne Plattform-Abhängigkeit.
Für denselben Seed und dieselben Züge liefert sie Schritt für Schritt denselben Zustand wie der Prototyp
(`tests/prototype.test.ts`; Stufe 1 ohne Merkmale – die Entwicklung braucht keinen Zufall – bis zum Ende der ersten
Eiszeit, die ab H3b eine Prüfung unterwegs ist).

## Aufbau

```
data/landscapes.yaml  Landschaften: Futter-Maximum, Wachstum je Jahreszeit, walk/wood/den, Brand, Sukzession, Startwerte
data/cards.yaml       Karten: Ziel-Landschaften, Wirkung (transform/ignite/grow), Wildnis-Kosten, Ziehgewicht, global
data/seasons.yaml     Jahreszeiten (fire), Monate je Jahreszeit, Monatsnamen
data/stages.yaml      Stufen der Herde: Bedürfnisse (Futter, Wasser, Schutz und wann, Futter je Landschaft, Hindernisse,
                      Schritte, Umkreis, Verluste, Gewichte der Herdenwahl), Folgestufe und Reife (mit mature.scope)
data/traits.yaml      Erfahrungen (Zähler des Erlebten) und Merkmale (Schwelle, Wirkung auf Stufenwerte), Angebotsgröße
data/params.yaml      Parameter (Herde zu Beginn, Feuer, Wölfe, Wild, Wildnis, Eiszeit mit Prüfungen, Karten)
data/islands.yaml     Inseln als Zeichenraster mit Legende, Start von Herde und Rudeln

src/index.ts          öffentlicher Einstieg
src/api.ts            Vertrag für Oberflächen: Action, HerdeView, StepResult, StateCheck (nur Typen)
src/game.ts           Fassade: newGame, step, legalPlays (+ view, validateState)
src/month.ts          ein Monat in fester Reihenfolge (advance)
src/nature.ts         Wachstum, Sukzession, Feuer
src/herd.ts           Herdenwahl (chooseMove), Fressen, Durst, Kälte, Feuer, Nachwuchs
src/traits.ts         Entwicklung: Erfahrungen zählen, Merkmale anbieten und wählen, Reife, Sprung
src/wolves.ts         Wild fressen oder reißen, Wandern, Wachsen/Gründen/Verhungern, Einwandern
src/prey.ts           Wild: Fressen, Wachsen/Gründen, Ziehen, Schrumpfen, Einwandern
src/camp.ts           Lager: gültige Plätze, Niederlassen (settle), Rodung
src/cards.ts          Ziehen, gültige Ziele, Ausspielen
src/view.ts           Lesemodell (Absicht, Prognosen, Hand mit Zielen)
src/validate.ts       validateState für gespeicherte Stände (STATE_VERSION)
src/world.ts          Abfragen (Felder, Nachbarn, Jahreszeit, Stufe mit Merkmalen, Bedarf, Wege), Landschaftswandel
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
npm run herde -- --seed 7          # Konsole: p <hand> <x> <y> · w (Monat) · s (Jahreszeit) · m <nr> · e · q
npm run herde:smoke -- --runs 20   # Zufalls-Bots bis zum Ende, jeder Zustand wird geprüft
npm run validate                   # Datenprüfung
```

## Fassade

```ts
newGame(data, { seed, island? }): HerdeState
step(data, state, action): { state, events }      // rein, wirft RuleError bei ungültigen Zügen
  action = { type: 'play', hand, x?, y? } | { type: 'advance' }
         | { type: 'pickTrait', trait }             // ein angebotenes Merkmal wählen
         | { type: 'evolve' }                       // zur nächsten Stufe springen (nur wenn reif, unumkehrbar;
                                                   // Merkmale wirken weiter, die Reife zählt neu)
         | { type: 'settle', x, y }                 // Lager gründen (Stufe mit camp, gültiger Platz in Zugweite,
                                                   // nicht in der Eiszeit); danach sesshaft
view(data, state): HerdeView                       // Felder, Herde, Rudel, Absicht, Hand mit Zielen, Datum, Eiszeit,
                                                   // evolution (Stufe, Merkmale, davon zählend, Angebot, verfügbar,
                                                   // Erfahrung, Reife, was auf dieser Stufe fehlt, Vorschau)
legalPlays(data, state): Action[]                  // alle Kartenzüge; 'advance' geht immer
legalActions(data, state): Action[]                // Kartenzüge, pickTrait je Angebot, evolve (wenn reif),
                                                   // settle je Lagerplatz, advance
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
4. **Herde zieht** (mit Lager: bleibt, Grund `settled`) auf das beste Feld, das sie mit `move` Schritten über für ihre Stufe begehbare Felder erreicht
   (Stufe 1: Umkreis 1) – die Absicht.
5. **Fressen** im Umkreis `reach` (Stufe 1: eigenes und 8 Nachbarfelder), die vollsten zuerst; danach **Jagd**
   (Stufen mit `preyFood`): Wild im Umkreis, größte Bestände zuerst, höchstens `huntKill` Tiere (+ `fireHunt` bei
   frischer Brandfläche im Umkreis). Überschuss → Vorrat, Mangel zehrt ihn auf, danach Hungertote.
6. **Durst** (Jahreszeiten aus `needs.water` der Stufe, ab `thirstAfter` Monaten) und **Kälte** (`needs.shelter`).
7. **Wölfe:** fressen zuerst Wild im Umkreis 1, sonst reißen sie Tiere der Herde (nur `wolves: enemy`); hungrige
   ziehen durchs Gehölz zum nächsten Wild (ohne Wild zur Herde), satte wachsen bzw. gründen neue Rudel,
   hungrige verkümmern; ohne Rudel wandern bei genug Gehölz neue ein. **Wild** frisst, wächst bzw. gründet, zieht zu
   besserer Weide, schrumpft; ohne Wild wandert ab Stufe `prey.from` mit `spawnChance` neues ein. Danach werden die
   Toten abgezogen und die
   **Erfahrungen** des Monats gezählt (aus Lage und Ereignissen des Monats, nur wenn die Herde lebt).
8. **Nachwuchs** im Geburtsmonat (nicht in der Eiszeit), je nach Vorrat; **Rodung** am Lager im Monat
   `camp.clear.month`.
9. **Wildnis** +`perMonth`; bei `max` beginnt die Eiszeit (`ice.months` Monate `ice.season`). Endet sie mit
   lebender Herde, ist sie überstanden (`iceAges`): auf der letzten Stufe mit Lager → gewonnen; nach der
   `ice.ages`-ten Eiszeit sonst → verloren; sonst fällt die Wildnis auf `ice.wildAfter`. Stirbt die Herde aus, ist
   die Partie verloren.
10. **Monat +1;** zu Beginn jeder Jahreszeit `drawPerSeason` Karten ziehen, höchstens `handMax` auf der Hand, und
    bis zu `offerSize` verfügbare **Merkmale anbieten**: zuerst die aus `mature.oneOf` der aktuellen Stufe, dann die
    übrigen (je Reihenfolge der Daten). Ist ein Angebot liegen geblieben, rotiert es weiter (`herd.offerTurn`, ohne
    Zufall): Reife-Merkmale bleiben vorn (höchstens `offerSize − 1`), die übrigen Plätze wandern durch den Rest.

Zwischen den Monaten (wie Karten): `pickTrait` wählt ein Merkmal aus dem Angebot (danach ist es verbraucht – höchstens
eines je Jahreszeit), `evolve` springt zur Folgestufe, sobald die Herde reif ist.

**Reife je Stufe:** Bei `mature.scope: stage` (Standard, so in `stages.yaml`) zählen für die Reife nur Merkmale, die auf
der aktuellen Stufe gewählt wurden (`herd.traits` ab Index `herd.traitsAtStage`); die Wirkung früherer Merkmale bleibt.
Damit lässt sich keine Stufe überspringen. `scope: all` zählt alle Merkmale der Herde (Rückweg, falls der Inhaber die
Entscheidung ändert – nur YAML).

Die **Absicht** in `view` entsteht, indem die Schritte 1–3 auf einer Kopie laufen (mit demselben Seed-Zufall) und
danach die Herdenwahl folgt – also genau so wie in `advance`. Die Herdenwahl selbst hat keinen Zufall.

## Ereignisse

`cardPlayed`, `cardsDrawn`, `cellChanged` (cause: succession/card/fire), `grassGrew`, `fire` (cause:
lightning/wildfire, Felder), `herdMoved` (mit Grund), `herdAte`, `herdStarved`, `herdThirsted`, `herdFroze`,
`herdBurned` (nur mit Verlust), `herdBorn`, `traitOffered`, `traitPicked`, `matured`, `herdEvolved`, `wolvesHunted`, `packMoved`, `packGrew`, `packFounded`, `packStarved`, `packGone` (cause:
starved/fire/driven), `packImmigrated`, `packAtePrey`, `preyGrew`, `preyFounded`, `preyMoved`, `preyStarved`,
`preyGone`, `preyImmigrated`, `preyHunted` (mit `fire`), `campFounded`, `fieldCleared` (dazu `cellChanged` mit cause
clearing), `seasonBegan`, `iceAgeBegan`, `iceAgeEnded` (mit `count`), `gameWon`, `gameLost` (cause: extinct/lastIce).
Ereignisse tragen nur Ids und Zahlen; Texte setzt die Oberfläche zusammen (Namen stehen in den Daten).

## Erweiterungspunkte

- **Entwicklung (H3a):** Stufen und Merkmale sind Daten. `stageOf()` in `world.ts` liefert die Stufe mit der
  Wirkung der Merkmale (`mul`/`add` auf Zahlen der Stufe); alle Regeln lesen ihre Werte darüber. Listen (Futter,
  Wasser, Schutz, Hindernisse, `forage`, `needs`) kommen aus der Stufe selbst (`baseStageOf`). Eine neue Erfahrung
  mit vorhandenem Bedingungstyp ist nur YAML; ein neuer Typ kommt in `ExperienceWhen` (`schema.ts`) und
  `gainExperience` (`traits.ts`).
- **Futter je Stufe (`forage`):** Futter bleibt ein einziger Vorrat je Feld; die Stufe legt für einzelne Landschaften
  Maximum und Wachstum fest (`maxFood`/`growOf` in `world.ts`). Begründung: Das passt ohne neuen Zustand in die
  bestehende Engine (Wachstum, Fressen, Regen, Prognose und Anzeige lesen schon `maxFood`), die Insel bleibt ein
  Raster aus Feldern mit einem Futterwert, und Stufe 1 ohne `forage` verhält sich exakt wie der Prototyp. Getrennte
  Vorräte (Gras und Früchte) hätten jedes Feld, die Karten und die Anzeige verdoppelt. Folge: Beim Sprung wird das
  Futter auf das neue Maximum gekappt; ein Wald wächst danach mit den Werten der neuen Stufe.
- **Stufen 4 und 5 (H3b):** Wild ist ein Spielobjekt im Zustand (`prey`, Parameter in `params.yaml → prey`). Eine
  Stufe jagt über `preyFood`/`huntKill`/`fireHunt` (Stufenwerte, also auch durch Merkmale änderbar), hat Wölfe als
  Feinde oder Konkurrenten (`wolves`) und kann ein Lager haben (`camp` mit `near` und `clear`). Sieg: letzte Stufe
  (ohne `next`) mit Lager, falls die Stufe eins kennt, am Ende einer Eiszeit (`wildAndIce` in `month.ts`).
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
  `+0x9e3779b9`), nicht wie in der alten Engine – dadurch ist der Verlauf identisch zum Prototyp.
- **Rudelgründung** (`wolves.ts`): Felder, auf denen sich im selben Monat schon ein Rudel gegründet hat, gelten als
  besetzt (im Prototyp könnten zwei neue Rudel auf einem Feld landen).
- **Fels nicht auf die Herde** (`cards.ts`): allgemein aus den Daten – keine Karte, deren Ziel unbetretbar ist.
- **Beweidungs-Uhr** (`world.ts`): Jeder Landschaftswechsel setzt sie zurück (im Prototyp nur Säen und Brand →
  Wiese; für andere Ziele ohne Wirkung).
- **`iceDone`** (`month.ts`) entfällt: Gezählt werden die überstandenen Eiszeiten (`iceAges`).
- **Gleichheit mit dem Prototyp** (`tests/prototype.test.ts`): bis einschließlich des Monats, in dem die erste
  Eiszeit endet. Dort gewinnt der Prototyp, die Engine geht weiter (Wildnis fällt zurück, ggf. Karten der neuen
  Jahreszeit). Wild wandert erst ab `prey.from` ein (ohne Würfeln davor), die Startphase bleibt also exakt.
- **Wild vor der Herde** (`wolves.ts`): Ein Rudel mit Wild in Reichweite frisst immer Wild, auch wenn die Herde
  ebenfalls in Reichweite ist.
- **Wild auf unbegehbarem Feld** (`world.ts`): weicht auf das erste freie Nachbarfeld im Lebensraum aus, sonst
  verschwindet es (`preyGone`); auf begehbaren Feldern außerhalb des Lebensraums bleibt es und zieht weiter.
- **Wild und Verbuschung** (`prey.ts`): Wild hält Wiese nicht offen (setzt die Beweidungs-Uhr nicht zurück).
- **Lager in Zugweite, nicht in der Eiszeit** (`camp.ts`): Ein Lager besteht am Ende einer Eiszeit damit schon vor
  ihrem Beginn („danach die nächste Eiszeit überstehen“).
- **Letzte Prüfung** (`month.ts`): Nach der `ice.ages`-ten Eiszeit ist die Partie verloren, wenn die Herde dann nicht
  Mensch mit Lager ist (ohne `ice.ages` unbegrenzt).
- **Kein Feuerverlust, kein Ereignis** (`herd.ts`): Mit `fireLoss` 0 gibt es kein `herdBurned`.
- **Prognose** (`view.ts`): `inMonths` ist die genaue Zahl der Monatsschritte; der Prototyp zeigte bei der
  Verbuschung einen Monat zu wenig an.
- **Eigenes Feld** (`herd.ts`): Die Herde darf immer bleiben, auch auf einem Feld, das ihre Stufe sonst nicht betritt
  (Altwald nach dem Sprung zum Wanderer).
- **Erfahrung „fire“** (`traits.ts`): Nur ein Waldbrand zählt, kein Feuer durch die Blitz-Karte – sonst ließe sich
  „Feuerscheu“ mit der eigenen Karte farmen.
- **Erfahrung „ate“** (`traits.ts`): großzügig – die Herde steht auf einer passenden Landschaft und hat in diesem Monat
  gefressen; woher das Futter im Umkreis kam, wird nicht geprüft.
- **Erfahrung „moved“** (`traits.ts`): Luftlinie zwischen Start und Ziel des Monats (Chebyshev), nicht der Weg.
- **Unerfüllbare Reife** (`traits.ts`): Sind alle passenden Merkmale schon auf früheren Stufen gewählt, gilt die
  Bedingung als erfüllt (`required` wird auf das noch Wählbare gekappt, aus `oneOf` zählt dann auch ein früheres) –
  sonst säße die Herde fest.
- **Angebot beim Sprung** (`traits.ts`): Ein stehendes Angebot wird sofort nach den Reife-Merkmalen der neuen Stufe
  geordnet; ein schon genutztes bleibt leer (weiterhin höchstens eine Wahl je Jahreszeit).
- **Abgewehrtes Rudel** (`wolves.ts`): Reißt ein Rudel wegen `wolfGuard` kein Tier, ist das kein Angriff (kein
  Ereignis, keine Erfahrung) und das Rudel bleibt hungrig.
