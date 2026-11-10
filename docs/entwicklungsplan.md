# Entwicklungsplan

Stand: 10.11.2026 · Grundlage: [Konzept 0.2](konzept.md) (vom Inhaber bestätigt)

Der Plan folgt zwei Regeln:

1. **Logik vor Balancing.** Die Regeln werden zuerst vollständig und testbar umgesetzt. Grundlegende Dinge
   können sich in der Entwicklung noch ändern, deshalb wird erst balanciert, wenn das Spiel steht (Phase 6).
   Bis dahin laufen Bots nur als Absturz-Test, nicht als Messinstrument.
2. **Logik vor Grafik.** Die App baut auf einer fertigen, getesteten Engine auf.

Jede Phase endet mit prüfbaren Abnahmekriterien. Offene Fragen und Feedback laufen über das Cockpit.

## Arbeitsweise

- Jede Phase besteht aus mehreren kleinen PRs. Claude erstellt sie, wartet auf grüne CI und merged selbst.
- Mehrere spezialisierte Agenten arbeiten parallel (siehe `.claude/agents/` und CLAUDE.md).
- Nach jedem PR aktualisiert Claude das Cockpit: Meilenstein-Status, neue Fragen, Entscheidungen.
- Produktentscheidungen werden im Cockpit oder im Chat gestellt. Antworten fließen in `docs/konzept.md`.
- Zahlenwerte stehen in YAML (`packages/core/data`), nie im Code. Sie sind bis Phase 6 Platzhalter.

## Phasen

### Phase 0 – Fundament ✅

PR #1–#3: Prototyp 0.1 (Expeditionsmodell), Konzept 0.2, Workspace-Struktur, CI mit Lint, Coverage,
Simulation und Audit.

### Phase 1 – Welt: Geografien, Formen, Odem, Harmonie

**Ziel:** Eine Partie ohne Tiere ist spielbar. Der Spieler muss mit Odem haushalten, um 5 Zonen gegen
Jahreszeiten und Drift im Gleichgewicht zu halten.

Umfang:

- Neues Datenmodell: 5 Geografien mit Ruhewerten, 3 gemeinsame Werte + Sonderwert, Nachbarschaft
- Formen je Geografie aus Werten ableiten (Tabellen aus dem Konzept als YAML)
- Zonenstufe 1–5 mit Auf- und Abstieg
- Rundenablauf nach Konzept: Vorschau → Eingriffe → Natur → Bilanz
- Jahreszeiten, Selbstheilung, Kopplungen (Schneeschmelze, Süßwasser, Waldklima, Hochwasser)
- Odem: Zufluss, Obergrenze, Kartenkosten; Kartenzwang mit Gratis-Naturgewalten
- Harmonie und Kollaps; Ablage wird neu gemischt
- Neue Kartensätze: Naturgewalten (mit Schwellen aus 0.1), Gaben, erste Wunder
- Zufalls-Bot für das Überlebensmodell (nur als Absturz-Test)
- Konsolen-Prototyp auf das neue Modell umgestellt

Abnahme:

- Jede Regel aus Konzept Kap. 3, 4, 6 und 7 ist durch mindestens einen Test belegt
- Jede Form jeder Geografie ist in einem Test erreichbar
- Eine Partie ist in der Konsole von Runde 1 bis zum Kollaps spielbar
- Der Zufalls-Bot spielt Partien ohne Absturz

### Phase 2 – Leben: Populationen, Evolution, Mensch

**Ziel:** Leben entsteht, frisst, wandert, stirbt aus und entwickelt sich bis zum Menschen.

Umfang:

- Bestände 0–9 je Art und Zone; Fressen, Wachstum, Hunger, Überpopulation, Wanderung, Aussterben
- Stammbaum als Daten; Evolution mit Bestand, Form, Zonenstufe, Dauer und Selektionsdruck
- Gaben der Arten als Karten; der Mensch mit eigenen Karten und laufenden Harmoniekosten
- Harmonie-Beiträge aus Artenvielfalt, Aussterben und Hunger
- Wertung (Punkte pro Runde, doppelt mit Menschen)

Abnahme:

- Jede Art des Stammbaums entsteht in einem konstruierten Test-Szenario (auch der Mensch)
- Fressketten, Hunger, Wanderung, Aussterben und Selektionsdruck sind durch Tests belegt
- Eine Partie mit Leben ist in der Konsole spielbar

### Phase 3 – Ereignisse und Meta-Progression

**Ziel:** Jede Partie fühlt sich anders an. Es gibt einen Grund, die nächste zu spielen.

Umfang:

- Ereignispool mit Ankündigung, Skalierung über die Jahre, Gegenkarten (Stille, Späherblick)
- Schöpfungsbuch: Freischaltung von Bedingungen, Gaben und Wundern über Meilensteine
- Startdeck-Auswahl, variierende Startwelten

Abnahme:

- Ereignisse, Ankündigung, Gegenkarten und Freischaltungen sind durch Tests belegt
- Das Schöpfungsbuch bleibt zwischen Partien erhalten

### Phase 4 – App-Gerüst

**Ziel:** Das Spiel läuft als Web-App und auf dem Handy, mit einfacher 3D-Insel und Platzhaltermodellen.

Umfang:

- `apps/mobile`: Vite + React + TypeScript, React Three Fiber, Capacitor
- Insel-Diorama mit 5 Zonen-Kacheln, Form als Farbe/Platzhaltermodell, Tiere als einfache Figuren
- Engine aus `@being-god/core` direkt angebunden (YAML zur Build-Zeit eingebunden)
- Spielstand speichern und laden (lokal); Speicher-Adapter für späteren Cloud-Sync
- CI: Web-Build, Android-Debug-Build; iOS-Build sobald ein Apple-Entwicklerkonto da ist
- Vorschau-Link je PR (Web-Build als Artefakt)

Abnahme:

- Eine komplette Partie ist im Handy-Browser und als Android-App spielbar
- 60 fps auf einem Mittelklasse-Handy bei der Insel-Ansicht

### Phase 5 – Bedienung und Spielgefühl

Umfang:

- Karten auf Zonen ziehen, Vorschau der Wirkung vor dem Loslassen (Schwellen sichtbar)
- Harmonie- und Odem-Anzeige, Ereignisvorschau, Zonen-Detailansicht
- Animationen für Formwechsel, Evolution, Aussterben, Ereignisse
- Tutorial / geführte erste Partie; Englisch und Deutsch
- Feedback-Runde im Cockpit pro Feature

### Phase 6 – Balancing

**Ziel:** Das fertige Regelwerk fühlt sich fair und spannend an.

Umfang:

- Bots mit Strategien (Gärtner, Evolutionsjäger, Störer), Kampagnen-Simulation über mehrere Partien
- Messreihen im Cockpit, Feedback aus eigenen Testpartien
- Zielwerte: Partien im Median 30–60 Runden (≈ 10–20 Minuten); guter Spieler erreicht Stufe 6 in Jahr 5–7;
  der Mensch entsteht in 5–20 % der guten Partien; keine Strategie dominiert; Freischaltungen helfen spürbar, aber
  nicht stark

### Phase 7 – Grafik und Ton

Umfang:

- Low-Poly-Modelle je Form (zunächst CC0-Pakete, dann eigene in Blender), Tiere, Wetter, Tag/Jahreszeit
- Farbstimmung reagiert auf Harmonie (blasser, Nebel)
- Sound und Musik

### Phase 8 – Veröffentlichung

Umfang:

- TestFlight und Google Play (interner Test), Store-Texte und Screenshots
- Absturz-Reporting, Performance-Optimierung
- Datenschutz (keine Tracking-Pflicht), Altersfreigabe
- Monetarisierung und Online-Funktionen bewusst erst hier entscheiden

## Abhängigkeiten von dir

| Wann      | Was                                                                       |
| --------- | ------------------------------------------------------------------------- |
| jetzt     | Branch-Schutz für `main` mit Pflicht-Check „CI ok“ (GitHub-Einstellungen) |
| Phase 4   | Google Play Console (25 $ einmalig) für Android-Tests                     |
| Phase 4/7 | Apple Developer Program (99 $/Jahr) für iOS-Builds und TestFlight         |
| laufend   | Antworten auf Fragen im Cockpit, Feedback zu Features                     |
