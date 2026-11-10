# Being God (ain't easy)

Working title. Ein Ökosystem-Spiel für iOS und Android im Low-Poly-Stil: Du bist ein Gott, der nicht erschafft,
sondern Bedingungen formt. Das Leben entwickelt sich von selbst, vom Plankton bis zum Menschen. Halte das
Gleichgewicht so lange wie möglich, denn jeder Eingriff ist ein Tausch.

- **Spielkonzept (aktuell):** [docs/konzept.md](docs/konzept.md)
- Ursprüngliches Handover: [docs/handover.md](docs/handover.md)
- Regeln des Prototyps 0.1 (historisch): [docs/prototyp-0.1-regeln.md](docs/prototyp-0.1-regeln.md)

## Projektstruktur

```
packages/
  herde/    @being-god/herde – Regel-Engine „Die Herde“ und Spieldaten (YAML). Plattformunabhängig:
            läuft in Node (Tests, Konsole, Absturz-Test) und unverändert im Browser.
    data/     Landschaften, Karten, Jahreszeiten, Stufen der Herde, Inseln, Parameter
    src/      Fassade (game.ts), Monatsablauf, Natur, Herde, Wölfe, Karten, Schema, Zufalls-Bot
    tests/
apps/
  web/      mobile Web-App (Vite + React + React Three Fiber), nativ über Capacitor
prototypes/ Wegwerf-Prototypen (z. B. herde/index.html)
docs/       Konzept, Entwicklungsplan, Architektur, Deploy, Cockpit; archiv/ für überholte Stände
```

Aufbau der Engine und der App: [docs/architektur.md](docs/architektur.md). Stand der Phasen:
[docs/entwicklungsplan.md](docs/entwicklungsplan.md).

## Befehle

```bash
npm install
npm run dev         # Web-App im Entwicklungsserver (auch im WLAN erreichbar, fürs iPhone)
npm run build       # statischer Build der Web-App nach apps/web/dist
npm run herde       # Konsole (--seed, --island)
npm run herde:smoke # Absturz-Test: Zufalls-Bots spielen Partien (--runs, --seed, --max-months)
npm run validate    # Spieldaten prüfen
npm run check       # Format, Lint, Typecheck, Tests mit Coverage, Datenprüfung (läuft auch in CI)
```

Bis H5 (Balancing) laufen die Bots nur als Absturz-Test; Zahlen in den YAML-Daten sind Platzhalter.
Details zur App (URL-Schalter, Bedienung, Tests): [apps/web/README.md](apps/web/README.md).
Deploy auf den eigenen vServer: [deploy/README.md](deploy/README.md).

## Entwicklung

Änderungen laufen über Pull Requests gegen `main` (Squash-Merge). Vor jedem Push:

```bash
npm run check       # Format, Lint, Typecheck, Tests mit Coverage, Datenprüfung
npm run format      # formatiert alles mit Prettier
```

Die CI (`.github/workflows/ci.yml`) prüft jeden PR in fünf parallelen Jobs:

| Job                     | Prüft                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------- |
| Format, Lint, Typecheck | Prettier, ESLint (inkl. vergessener `await`, unvollständiger `switch`), `tsc --strict`            |
| Tests + Coverage        | Vitest; die Regel-Engine muss ≥ 80 % Zeilen-Coverage behalten                                     |
| Spieldaten + Simulation | Schema und Querverweise der YAML-Daten; Zufalls-Bots spielen 20 Partien bis zum Ende ohne Absturz |
| Web-App bauen           | `npm run build` (Typecheck und Vite-Build der App), Caddyfile und docker-compose des Deploys      |
| Abhängigkeiten          | `npm audit` auf bekannte Sicherheitslücken                                                        |

Der Sammel-Check **„CI ok“** ist nur grün, wenn alle Jobs grün sind. Dependabot hält Abhängigkeiten aktuell.
Nach einem Merge auf `main` baut `.github/workflows/deploy.yml` die App und spielt sie auf den vServer
(siehe [deploy/README.md](deploy/README.md)).
