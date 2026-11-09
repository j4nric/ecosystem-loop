# Arbeitsweise für Claude in diesem Repo

## Projekt

„Being God (ain't easy)“ – Ökosystem-Spiel für iOS/Android. Leitdokument: `docs/konzept.md`.
Regel-Engine in `packages/core` (plattformunabhängig, datengetrieben über YAML in `packages/core/data`),
Bots/Simulation/Konsole in `packages/sim`, App später in `apps/mobile`.

## Workflow (vom Projektinhaber so festgelegt)

- Jede Änderung läuft über einen Pull Request gegen `main`. Claude erstellt PRs **und mergt sie selbst**
  (Squash), sobald die CI auf dem aktuellen Head grün ist. Kein manuelles Review durch den Inhaber.
- Vor jedem Push lokal `npm run check` ausführen (Format, Lint, Typecheck, Tests mit Coverage, Datenprüfung).
- Nie Tests überspringen, deaktivieren oder Schwellen senken, um grün zu werden.
- Produktentscheidungen (Spielregeln, Konzept-Vorschläge mit 💡) mit dem Inhaber im Chat klären, nicht im PR.

## Konventionen

- TypeScript strict, ESM, Imports mit `.ts`-Endung innerhalb eines Pakets, zwischen Paketen über `@being-god/*`.
- Code-Bezeichner Englisch, Spieltexte und Doku Deutsch.
- Regeln gehören in die Daten (YAML), nicht in hart codierte Sonderfälle.
- Engine ist deterministisch (Seed); Zufall nur über `rng.ts`.
- Formatierung: Prettier (`npm run format`), Lint: ESLint (`npm run lint`).
