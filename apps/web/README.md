# apps/web – Being God als mobile Web-App

Ziel: spielbar im iPhone-Browser, als Web-App zum Home-Bildschirm hinzufügbar, Deploy auf eigenem vServer.
Native Builds (Capacitor) folgen später.

Stack: Vite + React + TypeScript, Three.js über React Three Fiber (+ drei), Low-Poly-Insel.
Die App spricht mit der Engine nur über `@being-god/core` (`api.ts`: `GameView`, `Action`).

## Starten

```sh
npm run -w apps/web dev        # Entwicklungsserver (auch im WLAN erreichbar, fürs iPhone)
npm run -w apps/web build      # statischer Build nach apps/web/dist (relative Pfade)
npm run -w apps/web preview    # Build lokal ansehen
npm run -w apps/web typecheck
```

Die App spricht über `src/client/GameClient.ts`. Welche Implementierung läuft, entscheidet allein
`src/client/index.ts`: standardmäßig `EngineClient` (echte Engine; die YAML-Daten aus `packages/core/data`
werden zur Build-Zeit eingebunden und mit `buildGameData` geprüft). Der Spielstand liegt über `SaveStore`
in `localStorage` und wird beim Start fortgesetzt.

URL-Schalter: `?mock` (Vorschau-Daten ohne Engine), `?seed=abc` (fester Seed für neue Partien),
`?nosave` (nichts speichern), `?lang=en` (Englisch), `?tutorial` / `?notutorial` (Einführung erzwingen bzw. nie zeigen).

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
