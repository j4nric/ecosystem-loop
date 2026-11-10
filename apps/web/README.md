# apps/web – Being God als mobile Web-App

Ziel: spielbar im iPhone-Browser, als Web-App zum Home-Bildschirm hinzufügbar, Deploy auf eigenem vServer.
Dieselbe App läuft als native iOS-App in einer Capacitor-Hülle, siehe [ios/README.md](ios/README.md).

Stack: Vite + React + TypeScript, Three.js über React Three Fiber (+ drei), Low-Poly-Insel.
Die App spricht mit der Engine nur über `@being-god/core` (`api.ts`: `GameView`, `Action`).

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

Schritt-für-Schritt-Anleitung, Fehlerbilder und Unterschiede zur Web-Version: [ios/README.md](ios/README.md).
Spielstand und Buch liegen auch in der App in `localStorage`; für dauerhafte Speicherung wäre später
`@capacitor/preferences` sinnvoll (die Stores sind austauschbar).

## Aufbau

```
src/client/   GameClient (Schnittstelle), EngineClient, MockClient, SaveStore/BookStore/DeckStore, gameData.ts, index.ts
src/logic/    targeting (Zielwahl), deck (Startdeck) – reine Funktionen
src/state/    useGame, useTargeting (Zielwahl), useCardDrag (Ziehen), motion, tutorialStore
src/scene/    IslandScene, ZoneTile, Instanced (Figuren), ZoneLabels, layout, palette, props, registry
src/ui/       Hud, Hand, CardDetail, PlayPreview, ZoneSheet, ChoiceChips, DragOverlay, Toasts, GameOver, Book,
              DeckPicker, Help, Tutorial
src/i18n/     de.ts, en.ts, locale.ts – Texte; Standard Englisch, Deutsch auf deutschen Geräten
tests/        EngineClient, SaveStore, Buch-Eintrag, deck, targeting, locale
```

Die App spricht über `src/client/GameClient.ts`. Welche Implementierung läuft, entscheidet allein
`src/client/index.ts`: standardmäßig `EngineClient` (echte Engine; die YAML-Daten aus `packages/core/data`
werden zur Build-Zeit eingebunden und mit `buildGameData` geprüft). `EngineClient` übersetzt die `GameEvent`s
der Engine in `Notice`s mit lokalisierten Namen; den Satz bildet `src/i18n`. Der Spielstand liegt über
`SaveStore` in `localStorage` (`being-god.save.v1`) und wird beim Start fortgesetzt; passt er nicht mehr zu den
Spieldaten, bietet die App eine neue Partie an.

URL-Schalter (kombinierbar, z. B. `?seed=abc&lang=en`):

| Schalter                    | Wirkung                                                         |
| --------------------------- | --------------------------------------------------------------- |
| `?mock`                     | `MockClient`: Vorschau-Daten ohne Engine und ohne Spielregeln   |
| `?seed=abc`                 | fester Seed für neue Partien                                    |
| `?nosave`                   | Spielstand und Schöpfungsbuch nur im Speicher, nichts speichern |
| `?lang=en` / `?lang=de`     | Sprache erzwingen (sonst Gerätesprache, Fallback Deutsch)       |
| `?tutorial` / `?notutorial` | Einführung erzwingen bzw. nie zeigen                            |

## Bedienung (Phase 5)

- Karte antippen und dann eine leuchtende Zone antippen – oder die Karte direkt auf die Insel ziehen
  (`state/useCardDrag.ts`, Raycast über `scene/registry.ts`). Beim Ziehen leuchten gültige Zonen, unten erscheint die
  Vorschau der Zone unter dem Finger. Art-Slots (z. B. „Jagd“) wählt man über Chips.
- Bestände erscheinen als Low-Poly-Figuren je Gruppe (Wasser, Insekt, Reptil, Vogel, Säugetier, Mensch; Zuordnung rein
  optisch in `scene/palette.ts`), ein Instanced-Mesh je Gruppe. Neue Arten blitzen kurz auf.
- Formwechsel blenden weich über; niedrige Harmonie macht die Insel blass und neblig; die Jahreszeit tönt das Licht.
  `prefers-reduced-motion` schaltet Bewegungen ab.
- Einführung beim ersten Start (Status in `localStorage`), Hilfe über „?“ im HUD.
- Zonen-Beschriftungen sind eine DOM-Schicht (`scene/ZoneLabels.tsx`) statt drei `<Html>`.

## Ereignisse und Schöpfungsbuch (Phase 3)

- Das angekündigte Ereignis steht unter der Kopfzeile (Symbol, Name, wann, wo); Antippen zeigt den Text. „Stille“
  zeigt einen Schild-Hinweis. Wahl-Slots (z. B. Späherblick: Abwenden/Verschieben) wählt man über Chips.
- Zielwahl über `slotOptions`, Vorschau mit den lokalisierten Feldern aus `preview(…, locale)`.
- Das Schöpfungsbuch liegt unter eigenem Schlüssel in `localStorage` (`LocalBookStore`), wird nach dem Kollaps mit
  `recordGame` fortgeschrieben und an `newGame` übergeben. Spiel-Ende zeigt Neues (entdeckt, freigeschaltet,
  Bestwerte); die Buch-Ansicht ist über das Menü (☰) erreichbar.

## Tests

`apps/web/tests` (vitest, ohne DOM): EngineClient und SaveStore. Lokal: `npx vitest run apps/web/tests --config /dev/null`.

## Bundle

`vite.config.ts` teilt three/R3F, React und übrige Bibliotheken in eigene Chunks; ein App-Update lädt dann nur den
kleinen App-Chunk (Engine, Daten, Oberfläche) neu.
