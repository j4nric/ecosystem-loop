# apps/web – „Die Herde“ als mobile Web-App

Ziel: spielbar im iPhone-Browser im Hochformat, als Web-App zum Home-Bildschirm hinzufügbar, Deploy auf eigenem
vServer. Dieselbe App läuft als native iOS-App in einer Capacitor-Hülle, siehe [ios/README.md](ios/README.md).

Stack: Vite + React + TypeScript, Three.js über React Three Fiber (+ drei), Low-Poly-Insel. Die App spricht mit der
Engine nur über `@being-god/herde` (Konzept 1.2 „Die Herde“, [packages/herde](../../packages/herde/README.md)):
`newGame`, `step`, `view`, `validateState`, `buildData`.

## Starten

Vom Repo-Wurzelverzeichnis aus:

```sh
npm run dev                    # Entwicklungsserver (vite --host, auch im WLAN erreichbar, fürs iPhone)
npm run build                  # Typecheck + statischer Build nach apps/web/dist (relative Pfade)
npm run -w apps/web preview    # Build lokal ansehen
npm run -w apps/web typecheck
```

Deploy: Nach jedem Merge auf `main` baut `.github/workflows/deploy.yml` die App und kopiert `dist` auf den
vServer, siehe [deploy/README.md](../../deploy/README.md). Icons und Manifest (Home-Bildschirm) liegen in `public/`.

## iOS-App (Capacitor)

`capacitor.config.ts` (App-ID-Platzhalter `de.beinggod.app`, Name „Being God“, `webDir: dist`) und das Xcode-Projekt
in `ios/` (Swift Package Manager, kein CocoaPods). Auf dem Mac:

```sh
npm run -w apps/web ios:sync   # vite build && cap sync ios
npm run -w apps/web ios:open   # Xcode öffnen, dann Team wählen und Run
```

Der Spielstand liegt auch in der App in `localStorage`; für dauerhafte Speicherung wäre später
`@capacitor/preferences` sinnvoll (`SaveStore` ist austauschbar).

## Aufbau

```
src/client/   GameClient (Schnittstelle), HerdeClient, SaveStore, gameData.ts (YAML → buildData), index.ts
src/logic/    events (Ereignisse → Meldungen und Effekte), preview (Vorschau über step + view), format (Texte,
              Prognose, Pfeile, Regelzahlen der Stufe), evolution (Bedürfnisse mit Feldern auf der Insel, Merkmale,
              Erfahrung, Reife, Hinweis, Aktionen; Beute, Wölfe, Lager), hunt (Wild, Lagerplätze und Vorschau,
              Eiszeit-Nummer, Bilanz am Ende, Regeln für die Hilfe) – reine Funktionen ohne DOM
src/state/    useGame (View, Protokoll, Meldungen), monthRunner (schrittweises Ablaufen der Monate), motion,
              tutorialStore
src/scene/    IslandScene (Kamera, Licht, Insel, Pfeile, Hervorhebungen), islandModel (Instanzen aus der View, rein),
              Figures (Herde, Rudel, Wild), FxLayer (Effekte), Instanced, geometries, palette
src/ui/       StatusBar (Statusleiste, Jahreskreis, Absicht), Hand, Sheets (Karte/Vorschau, Feld-Info, Geschehen),
              Evolution (Knopf, Hinweis, Panel „Herde und Entwicklung“, Merkmal-Angebot, Sprung-Dialog, Einblendung),
              Camp (Hinweis, Vorschau, Bestätigung), GameOver, Help, Tutorial, Toasts
src/i18n/     de.ts, en.ts, locale.ts – UI-Texte; Namen (Landschaften, Karten, Jahreszeiten, Monate) aus den Daten,
              Regelzahlen (Geburtsmonat, Wildnis-Grenze, Eiszeit, Handgröße) aus `data.params`, Schritte, Umkreis,
              Wasser- und Schutzzeiten aus `view.evolution.stage` über `ruleNumbers`
tests/        HerdeClient, SaveStore, logic (Meldungen, Texte, Regelzahlen, Prognose, Vorschau, Inselmodell),
              evolution (Zählen aus der View, Texte je Stufe, Aktionen, Meldungen, Stand der Version 1),
              hunt (Wild, Lager, Panel-Zeilen, Bilanz, Texte), monthRunner (Fake-Timer), locale
```

### Client

`HerdeClient` hält den Engine-Zustand, führt Aktionen mit `step` aus und übersetzt die Ereignisse eines Schritts
(`logic/events.ts`) in Meldungen (Toast und/oder Geschehen-Protokoll) und kurze Effekte für die Szene
(Feuer, Feldwechsel, Wölfe reißen, Nachwuchs, Verluste, Regen, Jagd mit und ohne Feuer, Rudel reißt Wild, Wild
wandert ein, Lager gegründet, Rodung). Die YAML-Dateien aus `packages/herde/data` werden zur
Build-Zeit als Text eingebunden und im Browser mit `buildData` geprüft. Jede Partie hat einen eigenen Seed.

Spielstand: `localStorage` unter `being-god.herde.save.v1` (Zustand, Seed, Protokoll). Beim Start prüft
`validateState` den Stand; passt er nicht, beginnt eine neue Partie mit Hinweis (ein Stand einer früheren
`STATE_VERSION`, z. B. 1 vor der Entwicklung der Herde, bekommt einen eigenen Hinweis). Ein alter Spielstand der früheren
Version (`being-god.save.v1`, dazu Buch, Startdeck und Einführung) wird verworfen; die App sagt das einmal freundlich.

URL-Schalter (kombinierbar, z. B. `?seed=abc&lang=en`):

| Schalter                    | Wirkung                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `?seed=abc`                 | fester Seed für neue Partien                               |
| `?nosave`                   | Spielstand nur im Speicher, nichts speichern               |
| `?lang=en` / `?lang=de`     | Sprache erzwingen (sonst Gerätesprache, Fallback Englisch) |
| `?tutorial` / `?notutorial` | Einführung erzwingen bzw. nie zeigen                       |

## Bedienung (Hochformat)

- **Oben:** Statusleiste (Herde, Vorrat, Wölfe, Wild – Zahl der Tiere, ab der Stufe, mit der Wild einwandert, oder
  sobald Wild da ist –, Wildnis mit Balken; in der Eiszeit Restmonate), Menü (Hilfe, Neue Partie, Einführung),
  Jahreskreis mit 12 Monaten, Nummer der Eiszeit („❄ 1/3“, in der Eiszeit „Eiszeit 1 von 3“) und Hinweis zur
  Jahreszeit, Absichtszeile („Die Herde sucht Wasser ↘“).
- **Insel:** ein Plättchen je Feld; Höhe, Farbe und Bewuchs je Landschaft (Gras, Büsche, Bäume, dichter dunkler
  Altwald, Stümpfe auf Brandfläche, Felsbrocken, Wasser, abgesenktes Meer). Grashalme zeigen das Futter (Zahl =
  Futter, Höhe und Sättigung = Anteil am Maximum). Im Winter liegt Schnee, in der Eiszeit mehr. Herde und Rudel sind
  Tierfiguren (Herde: bis 20 Figuren, größere Herden größer; Rudel: eine Figur je Stärke, Raute darüber, rot =
  hungrig). Wild sind Rehe, eines je Tier des Bestands (1–3; hungrig blasser; auf dem Feld der Herde in einer Ecke).
  Jäger tragen Speere, Menschen ein Gewand; das Lager ist ein kleines Modell aus Zelten und Feuerstelle. Der weiße
  Pfeil ist die Absicht für den nächsten Monat (am Lager entfällt er). Ziehen dreht die Insel ein wenig.
- **Karte legen:** Karte antippen → gültige Felder leuchten (aus `view().hand[].targets`), der Rest wird dunkler →
  Feld antippen → Vorschau (Feld vorher/nachher, Futter, Feuer, vertriebenes Rudel und – falls sie sich ändert – die
  neue Absicht als oranger Pfeil) → „Legen“. Regen: antippen, betroffene Felder leuchten grün, „Ausspielen“.
  Die Vorschau rechnet `step` auf dem aktuellen Zustand (rein) und vergleicht `view` davor und danach.
  Eine Karte ohne gültiges Ziel ist ausgegraut; angetippt sagt ihr Sheet „Gerade kein passendes Feld“. Kein
  Ablegen.
- **Zeit:** „Jahreszeit spielen“ lässt die Monate bis zur nächsten Jahreszeit einzeln ablaufen (die Herde hüpft
  sichtbar zum nächsten Feld, Effekte und Meldungen je Monat), „Anhalten“ bricht ab; „1 Monat“ geht einen Schritt.
- **Feld antippen:** Landschaft, Futter, Prognose („wird in N Monaten zu Busch“ erst ab ≤ 3 Monaten, sonst „bleibt
  Wiese, solange die Herde hier grast“), Feuer, Wasser und Schutz der aktuellen Stufe mit Jahreszeiten, Wölfe,
  „für diese Stufe unpassierbar“ (`CellView.blocked`), „kein Futter für die Stufe“, Herde, Lager, Wild (Größe,
  hungrig, in Jagdweite) bzw. Lebensraum des Wilds, Rudel.
- **Lager gründen** (Stufe mit `camp`, solange `view.campSites` nicht leer ist): Hinweis „⛺ Lagerplatz wählen“, die
  Plätze leuchten mit Fahne. Antippen (Hinweis oder Platz) öffnet eine kompakte Vorschau im Dock (Fluss, Wiese,
  Wald im Umkreis des Lagers; Futter, Schutz, Wild im Umkreis der Stufe; ein Satz zu Sesshaftigkeit und Rodung aus
  den Daten), die Hand ruht. „⛺ Lager gründen“ → Bestätigung im Spiel mit den Folgen → `settle`. In der Eiszeit
  sagt ein Hinweis, dass kein Lager gegründet wird; ohne Platz in Zugweite, was gesucht ist.
- **Herde und Entwicklung** (Knopf mit dem Symbol der Stufe neben 📜; Punkt mit Zahl bei einem Angebot, ⬆ bei
  Reife; dazu ein goldener bzw. grüner Hinweis unter der Absicht): aktuelle Stufe mit Bedürfnissen (Futter mit
  Maximum, Beute mit Futter je Wild, Tieren je Monat und Bonus im Feuer, Wasser und Schutz mit Jahreszeiten, Wölfe als
  Feinde oder Konkurrenten, Hindernis, Lager, Schritte und Umkreis) und der Zahl passender Felder auf der
  Insel, gewählte Merkmale mit Wirkung (markiert: „zählt für die Reife“ bzw. „frühere Stufe – wirkt, zählt nicht“,
  aus `evolution.counted`), Erfahrungen mit Balken bis zur Schwelle und dem Merkmal, das dann kommt (Reife-Merkmale
  zuerst, gold; erreichte Merkmale „im Angebot“ bzw. „kommt in einem späteren Angebot“), was zur Reife auf dieser
  Stufe fehlt (gewählt x von y), und die **Vorschau der nächsten Stufe**: was sie braucht, wie
  viele Felder die Insel heute bietet, was nicht mehr als Futter zählt, was unpassierbar wird, wie viel Wild es gibt
  bzw. wann es einwandert, wie viele Lagerplätze die Insel hätte, und was ganz fehlt.
  Alles wird aus `view.evolution` gelesen und aus `view.cells` gezählt, keine Regel nachgebaut.
- **Merkmal-Angebot:** 1–3 Karten (Symbol, Name, Wirkung, Erfahrung und Schwelle, „hilft zur Reife“), wählen, dann
  „Merkmal annehmen“ (`pickTrait`); „Später“ lässt das Angebot liegen (zur nächsten Jahreszeit rotiert es weiter, Reife-Merkmale bleiben vorn).
- **Sprung:** bei Reife „Weiterentwickeln zu …“ → Dialog im Spiel mit den neuen Bedürfnissen und „Kein Zurück“ →
  `evolve`. Danach eine goldene Lichtsäule mit Ringen über der Herde und eine kurze Einblendung der neuen Stufe. Die
  Figuren sehen je Stufe anders aus (grasende Tiere, gedrungene Waldsammler, schlanke Wanderer; `STAGE_LOOK` in
  `palette.ts`). Wanderer ziehen bis zu 2 Felder je Monat (direkt; das Ereignis nennt kein Zwischenfeld), für die Stufe
  unpassierbare Felder haben einen dezenten dunkelroten Rahmen.
- **📜 Geschehen:** Protokoll aller Meldungen mit Monat (auch Zug der Herde und wandernde Rudel, die nicht als Toast
  erscheinen).
- **Ende:** Sieg (als Mensch mit Lager die letzte Eiszeit überstanden), ausgestorben oder letzte Eiszeit
  überstanden, aber nicht als Mensch mit Lager (aus der View abgeleitet: lebende Herde bei verlorener Partie); Bilanz
  mit Überlebenden, Dauer, Eiszeiten, erreichter Stufe und Merkmalen; „Insel ansehen“ oder „Neue Partie“.
- Einführung (6 Karten, darunter „Die Herde entwickelt sich“) beim ersten Start, erneut über das Menü oder die Hilfe. `prefers-reduced-motion` kürzt
  Animationen und die Pausen zwischen den Monaten, lässt Schweben, Pulsieren, Hüpfen, flackernde Flammen und
  fallenden Regen weg (stattdessen färben sich die betroffenen Felder kurz und ruhig ein) und zeichnet die Szene
  nur bei Änderungen neu (`frameloop="demand"`).

## Performance

Je Art von Objekt ein Instanced Mesh (Plättchen, Erdreich, Gras, Büsche, Kronen, Stämme, Felsen, Tierkörper,
Tierköpfe, Hervorhebungen): rund 20 Draw Calls. Die Instanzen entstehen in `islandModel.ts` nur, wenn sich die
View ändert; pro Frame laufen nur das sanfte Schweben, das Pulsieren der Ziele und – solange sie dauern – der Zug der
Figuren und die Effekte. Keine Echtzeit-Schatten (Schatten unter der Insel ist eine Textur).

## Tests

`apps/web/tests` (vitest, ohne DOM): HerdeClient (Züge, Meldungen, Speichern, Prüfen und Verwerfen alter Stände,
Daten aus den eingebundenen YAML-Texten, Regen-Felder), SaveStore, reine Logik (Meldungen, Texte, Regelzahlen aus
den Daten, spielbare Karten, Prognose, Vorschau, Inselmodell), schrittweises Ablaufen der Monate mit Fake-Timern
(„Jahreszeit spielen“, „Anhalten“), Sprachwahl. Im Entwicklungsmodus stellt die Szene `window.__herdeCell(x, y)` bereit (Bildschirmpunkt
eines Felds) – für Klicktests mit Playwright.

## Bundle

`vite.config.ts` teilt three/R3F, React und übrige Bibliotheken in eigene Chunks; ein App-Update lädt dann nur den
kleinen App-Chunk (Engine, Daten, Oberfläche) neu.
