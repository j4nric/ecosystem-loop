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
              Prognose, Pfeile) – reine Funktionen ohne DOM
src/state/    useGame (View, Protokoll, Meldungen), monthRunner (schrittweises Ablaufen der Monate), motion,
              tutorialStore
src/scene/    IslandScene (Kamera, Licht, Insel, Pfeile, Hervorhebungen), islandModel (Instanzen aus der View, rein),
              Figures (Herde und Rudel), FxLayer (Effekte), Instanced, geometries, palette
src/ui/       StatusBar (Statusleiste, Jahreskreis, Absicht), Hand, Sheets (Karte/Vorschau, Feld-Info, Geschehen),
              GameOver, Help, Tutorial, Toasts
src/i18n/     de.ts, en.ts, locale.ts – UI-Texte; Namen (Landschaften, Karten, Jahreszeiten, Monate) aus den Daten,
              Regelzahlen (Geburtsmonat, Wildnis-Grenze, Eiszeit, Handgröße) aus `data.params` über `ruleNumbers`
tests/        HerdeClient, SaveStore, logic (Meldungen, Texte, Regelzahlen, Prognose, Vorschau, Inselmodell),
              monthRunner (Fake-Timer), locale
```

### Client

`HerdeClient` hält den Engine-Zustand, führt Aktionen mit `step` aus und übersetzt die Ereignisse eines Schritts
(`logic/events.ts`) in Meldungen (Toast und/oder Geschehen-Protokoll) und kurze Effekte für die Szene
(Feuer, Feldwechsel, Wölfe reißen, Nachwuchs, Verluste, Regen). Die YAML-Dateien aus `packages/herde/data` werden zur
Build-Zeit als Text eingebunden und im Browser mit `buildData` geprüft. Jede Partie hat einen eigenen Seed.

Spielstand: `localStorage` unter `being-god.herde.save.v1` (Zustand, Seed, Protokoll). Beim Start prüft
`validateState` den Stand; passt er nicht, beginnt eine neue Partie mit Hinweis. Ein alter Spielstand der früheren
Version (`being-god.save.v1`, dazu Buch, Startdeck und Einführung) wird verworfen; die App sagt das einmal freundlich.

URL-Schalter (kombinierbar, z. B. `?seed=abc&lang=en`):

| Schalter                    | Wirkung                                                    |
| --------------------------- | ---------------------------------------------------------- |
| `?seed=abc`                 | fester Seed für neue Partien                               |
| `?nosave`                   | Spielstand nur im Speicher, nichts speichern               |
| `?lang=en` / `?lang=de`     | Sprache erzwingen (sonst Gerätesprache, Fallback Englisch) |
| `?tutorial` / `?notutorial` | Einführung erzwingen bzw. nie zeigen                       |

## Bedienung (Hochformat)

- **Oben:** Statusleiste (Herde, Vorrat, Wölfe, Wildnis mit Balken; in der Eiszeit Restmonate), Menü (Hilfe, Neue
  Partie, Einführung), Jahreskreis mit 12 Monaten und Hinweis zur Jahreszeit, Absichtszeile („Die Herde sucht
  Wasser ↘“).
- **Insel:** ein Plättchen je Feld; Höhe, Farbe und Bewuchs je Landschaft (Gras, Büsche, Bäume, dichter dunkler
  Altwald, Stümpfe auf Brandfläche, Felsbrocken, Wasser, abgesenktes Meer). Grashalme zeigen das Futter (Zahl =
  Futter, Höhe und Sättigung = Anteil am Maximum). Im Winter liegt Schnee, in der Eiszeit mehr. Herde und Rudel sind
  Tierfiguren (Herde: bis 20 Figuren, größere Herden größer; Rudel: eine Figur je Stärke, Raute darüber, rot =
  hungrig). Der weiße Pfeil ist die Absicht für den nächsten Monat. Ziehen dreht die Insel ein wenig.
- **Karte legen:** Karte antippen → gültige Felder leuchten (aus `view().hand[].targets`), der Rest wird dunkler →
  Feld antippen → Vorschau (Feld vorher/nachher, Futter, Feuer, vertriebenes Rudel und – falls sie sich ändert – die
  neue Absicht als oranger Pfeil) → „Legen“. Regen: antippen, betroffene Felder leuchten grün, „Ausspielen“.
  Die Vorschau rechnet `step` auf dem aktuellen Zustand (rein) und vergleicht `view` davor und danach.
  Eine Karte ohne gültiges Ziel ist ausgegraut; angetippt sagt ihr Sheet „Gerade kein passendes Feld“. Kein
  Ablegen.
- **Zeit:** „Jahreszeit spielen“ lässt die Monate bis zur nächsten Jahreszeit einzeln ablaufen (die Herde hüpft
  sichtbar zum nächsten Feld, Effekte und Meldungen je Monat), „Anhalten“ bricht ab; „1 Monat“ geht einen Schritt.
- **Feld antippen:** Landschaft, Futter, Prognose („wird in N Monaten zu Busch“ erst ab ≤ 3 Monaten, sonst „bleibt
  Wiese, solange die Herde hier grast“), Feuer, Wasser, Schutz, Herde, Rudel.
- **📜 Geschehen:** Protokoll aller Meldungen mit Monat (auch Zug der Herde und wandernde Rudel, die nicht als Toast
  erscheinen).
- **Ende:** Sieg (Eiszeit überstanden) oder Niederlage mit Überlebenden, Dauer und Wildnis; „Insel ansehen“ oder
  „Neue Partie“.
- Einführung (5 Karten) beim ersten Start, erneut über das Menü oder die Hilfe. `prefers-reduced-motion` kürzt
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
