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
  mobile/   iOS-/Android-App (geplant: Vite + React Three Fiber + Capacitor)
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
> folgt in den nächsten PRs, siehe Fahrplan in [docs/konzept.md](docs/konzept.md#13-fahrplan).

## Entwicklung

Änderungen laufen über Pull Requests gegen `main`. CI führt `npm run check` und einen kurzen Simulationslauf aus.
