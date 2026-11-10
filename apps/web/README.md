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
`?nosave` (nichts speichern), `?lang=en` (Englisch).
