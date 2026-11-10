# Arbeitsweise für Claude in diesem Repo

## Projekt

„Being God (ain't easy)“ – Ökosystem-Spiel für iOS/Android. Leitdokument: `docs/konzept.md`.
Regel-Engine in `packages/core` (plattformunabhängig, datengetrieben über YAML in `packages/core/data`),
Bots/Simulation/Konsole in `packages/sim`, App später in `apps/web`.

## Workflow (vom Projektinhaber so festgelegt)

- Jede Änderung läuft über einen Pull Request gegen `main`. Claude erstellt PRs **und mergt sie selbst**
  (Squash), sobald die CI auf dem aktuellen Head grün ist. Kein manuelles Review durch den Inhaber.
- Vor jedem Push lokal `npm run check` ausführen (Format, Lint, Typecheck, Tests mit Coverage, Datenprüfung).
- Nie Tests überspringen, deaktivieren oder Schwellen senken, um grün zu werden.
- Produktentscheidungen (Spielregeln, Konzept-Vorschläge mit 💡) mit dem Inhaber im Chat oder Cockpit klären, nicht im PR.
- **Logik vor Balancing:** Bis Phase 6 (Balancing) keine Messreihen und kein Feintuning von Zahlen. Regeln
  werden durch Tests mit konstruierten Zuständen belegt; Bots laufen nur als Absturz-Test in der CI.
  Zahlen in YAML sind bis dahin Platzhalter.

## Agenten und Parallelarbeit

Spezialisierte Agenten liegen in `.claude/agents/`. Die Hauptsitzung ist Koordinator und Integrator:
Sie zerlegt eine Aufgabe, startet Agenten parallel, führt die Ergebnisse auf dem Arbeits-Branch zusammen,
lässt den Reviewer prüfen und merged den PR.

| Agent           | Bereich                    | Wann                                            |
| --------------- | -------------------------- | ----------------------------------------------- |
| `engine-dev`    | `packages/core/src`        | Regeln und Schema umsetzen                      |
| `game-data`     | `packages/core/data`       | Konzept-Tabellen als YAML                       |
| `test-engineer` | `packages/*/tests`         | Regeln testgetrieben belegen                    |
| `docs-cockpit`  | `docs/`, Cockpit-Datenbank | Antworten/Feedback lesen, Fortschritt eintragen |
| `reviewer`      | nur lesend                 | vor jedem Merge eines größeren PRs              |
| `app-dev`       | `apps/web`              | ab Phase 4                                      |
| `sim-analyst`   | `packages/sim`             | ab Phase 6 oder auf Wunsch                      |

Regeln für parallele Läufe:

- Jeder Agent schreibt nur in seinem Bereich. Dadurch entstehen keine Konflikte beim Zusammenführen.
- Agenten, die gleichzeitig Dateien ändern, laufen mit `isolation: "worktree"`; der Koordinator übernimmt
  ihre Änderungen anschließend in den Arbeits-Branch.
- Schnittstellen zuerst: Braucht eine Aufgabe ein neues Schema, legt `engine-dev` es zuerst fest; danach
  arbeiten `game-data` und `test-engineer` parallel dagegen.
- Typischer Ablauf einer Funktion: (1) `engine-dev` Schema → (2) parallel `game-data`, `test-engineer`,
  `engine-dev` Logik → (3) Koordinator integriert, `npm run check` → (4) `reviewer` → (5) PR, CI, Merge →
  (6) `docs-cockpit` aktualisiert das Cockpit.

## Cockpit

Projekt-Cockpit: https://claude.ai/artifact/HUkj8htTK7SRZccDfGUqS4 (Datenmodell: `docs/cockpit/README.md`).

- Zu Beginn jeder Sitzung: offene Antworten (`questions` mit `status: answered`, die noch nicht verarbeitet sind)
  und neues Feedback (`feedback` mit `status: new`) lesen, umsetzen bzw. beantworten (`reply`, `status: seen`).
- Nach jedem gemergten PR: Meilensteine in `phases`, `cockpit/status` und ggf. `decisions` aktualisieren.
- Messreihen in `simruns` erst ab Phase 6 (Balancing).
- Neue Produktfragen als `questions` stellen.

## Konventionen

- TypeScript strict, ESM, Imports mit `.ts`-Endung innerhalb eines Pakets, zwischen Paketen über `@being-god/*`.
- Code-Bezeichner Englisch, Spieltexte und Doku Deutsch.
- Regeln gehören in die Daten (YAML), nicht in hart codierte Sonderfälle.
- Engine ist deterministisch (Seed); Zufall nur über `rng.ts`.
- Formatierung: Prettier (`npm run format`), Lint: ESLint (`npm run lint`).
