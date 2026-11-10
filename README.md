# Being God (ain't easy)

Working title. Ein Ökosystem-Spiel für iOS und Android im Low-Poly-Stil: Du bist ein Gott, der nicht erschafft,
sondern Bedingungen formt. Das Leben entwickelt sich von selbst, vom Plankton bis zum Menschen. Halte das
Gleichgewicht so lange wie möglich, denn jeder Eingriff ist ein Tausch.

- **Spielkonzept (aktuell):** [docs/konzept.md](docs/konzept.md)
- Ursprüngliches Handover: [docs/handover.md](docs/handover.md)
- Regeln des Prototyps 0.1: [docs/prototyp-0.1-regeln.md](docs/prototyp-0.1-regeln.md)

## Projektstruktur

```
packages/
  core/     @being-god/core – Regel-Engine und Spieldaten (YAML). Plattformunabhängig:
            läuft in Node (Simulation, Tests) und später unverändert in der App.
    data/     Karten, Tiere, Zonen, Szenarien, Parameter – Balancing ohne Code
    src/      Schema, Engine, Bedingungen, Meta-Progression, Zufall
    tests/
  sim/      @being-god/sim – Bots, Balancing-Simulation, Konsolen-Prototyp
apps/
  mobile/   mobile Web-App (Vite + React Three Fiber), später nativ
docs/       Konzept und Entscheidungen
```

## Befehle

```bash
npm install
npm run play        # Konsolen-Prototyp
npm run sim         # Balancing-Simulation mit Bots (--bot random|greedy, --runs, --expeditions)
npm run validate    # Spieldaten prüfen
npm run check       # Typecheck + Tests + Datenprüfung (läuft auch in CI)
```

> Die Engine entspricht noch dem Prototyp 0.1 (Expeditions-Modell). Der Umbau auf das neue Konzept
> folgt in den nächsten PRs, siehe [Entwicklungsplan](docs/entwicklungsplan.md).

## Entwicklung

Änderungen laufen über Pull Requests gegen `main` (Squash-Merge). Vor jedem Push:

```bash
npm run check       # Format, Lint, Typecheck, Tests mit Coverage, Datenprüfung
npm run format      # formatiert alles mit Prettier
```

Die CI (`.github/workflows/ci.yml`) prüft jeden PR in vier parallelen Jobs:

| Job                     | Prüft                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- |
| Format, Lint, Typecheck | Prettier, ESLint (inkl. vergessener `await`, unvollständiger `switch`), `tsc --strict`         |
| Tests + Coverage        | Vitest; die Regel-Engine muss ≥ 80 % Zeilen-Coverage behalten                                  |
| Spieldaten + Simulation | Schema und Querverweise der YAML-Daten; Bots spielen Kampagnen in allen Szenarien ohne Absturz |
| Abhängigkeiten          | `npm audit` auf bekannte Sicherheitslücken                                                     |

Der Sammel-Check **„CI ok“** ist nur grün, wenn alle Jobs grün sind. Dependabot hält Abhängigkeiten aktuell.
