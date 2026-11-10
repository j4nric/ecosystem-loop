# Regeln im Prototyp 0.1 (Expeditions-Modell)

> **Historisch.** Beschreibt die Engine aus PR #1, die noch dem Handover folgt. Das aktuelle Konzept steht in
> [konzept.md](konzept.md). Die hier beschriebene Engine ist inzwischen entfernt und nur noch im Git-Verlauf
> zu finden; die aktuelle Engine ist `packages/herde`.

Dieses Dokument hält fest, wie das Konzept aus dem [Handover](handover.md) umgesetzt ist – inklusive
der Auslegungen, die beim Programmieren nötig waren. Alles, was als **Parameter** markiert ist,
stand in der Datei `data/config.yaml` der alten Engine und ließ sich ohne Code ändern.

## Zugablauf

1. **Karten spielen.** Der Spieler spielt nacheinander beliebig viele Handkarten
   (mindestens 1 = Kartenzwang; Parameter `hand.minPlaysPerTurn`, `hand.maxPlaysPerTurn`).
   Ist keine Karte spielbar, entfällt der Kartenzwang.
2. **Jede Karte wirkt sofort.** Zuerst werden ihre Schwellen am Zustand _vor_ dem Grundeffekt geprüft,
   dann wirkt der Grundeffekt, dann die Folgen ausgelöster Schwellen.
   → Die Reihenfolge der gespielten Karten zählt: _Dürre, dann Gewitter_ auf Feuchte 3 brennt,
   _Gewitter, dann Dürre_ nicht.
3. **Zugende** (in dieser Reihenfolge):
   1. Zonenwechsel (z. B. Sumpf → Lichtung bei Feuchte 0)
   2. Fressen (Ausrottungsregel, s. u.)
   3. Auszüge: Tiere, deren Steckbrief verletzt ist, verlassen die Zone
   4. Einzüge: Tiere, deren Steckbrief erfüllt ist, ziehen ein
   5. Ist der Nachziehstapel leer, **endet die Expedition**. Sonst wird auf 4 Karten nachgezogen.
4. **Ausstieg.** Zu Beginn eines Zuges (bevor eine Karte gespielt wurde) kann der Spieler die Expedition beenden.

Gespielte Karten landen auf der Ablage und kommen **nicht** zurück. Neue Karten kommen nur von Tieren:
Jeder Einzug mischt eine Kopie der Tierkarte an zufälliger Stelle in den Nachziehstapel
(Parameter `arrival.cardOnArrival`: `every` oder `firstPerSpecies`). Die Tiere sind damit der Treibstoff der Expedition.

## Zonen und Werte

- Vier Werte (Licht, Feuchte, Dichte, Totholz), begrenzt auf 0–5 (Parameter `values`).
  Prozentwerte wären möglich, indem man die Skala z. B. auf 0–100 setzt und alle Zahlen in den Daten anpasst.
- Zonen haben eine feste Kennung (A–E) und einen Typ, der wechseln kann.
- Zusätzlich tragen Zonen **Merkmale**: Baumhöhle (`nest`), Blütenwiese (`flowers`), Horst/feuerfest
  (`fireproof`), Früchte (`fruit`), Kadaver (`carrion`), …
- Karte des Waldes: Ring A–B–C–D–E–A plus Abkürzung B–D. Neue Verbindungen entstehen durch den Trampelpfad.

## Tiere

- Ein Tier wohnt in einer Zone; Bedingungen beziehen sich auf diese Zone, außer es steht „Nachbarzone“ dabei.
- Dieselbe Art kann in mehreren Zonen leben, aber nur einmal je Zone.
- Höchstens 1 Einzug je Zone und Zug; konkurrieren mehrere Tiere, entscheidet der Zufall (Parameter `arrival.perZonePerTurn`).
- Einzugsverzögerung: Parameter `arrival.delayTurns` (0 = sofort am Zugende).
- **Ausrottungsregel (vorläufig):** Lebt Beute 3 Zugenden am Stück mit ihrem Fresser in derselben Zone, verschwindet sie
  (Parameter `predation.extinctionTurns`). Die „üppig“-Ausnahme aus dem Handover ist noch nicht umgesetzt.
- **Störung** = eine ausgelöste Schwelle mit `disturbance: true` (Feuer, Flut, Baumsturz). „3 Züge keine Störung“ gilt für
  die Zone selbst und ihre Nachbarn.

## Wertung und Notizbuch

- Wertung = Summe der Stufen aller **Arten**, die beim Abschluss im Wald leben (jede Art einmal).
- Ins Notizbuch kommt, was beim Abschluss dokumentiert ist (Parameter `notebook.recordOn: end`;
  Alternative `arrival` = jeder Einzug zählt). Das hält das Risiko des Ausstiegsmoments auch für die Progression aufrecht.
- Ein Notizbuch-Eintrag macht die Bedingungen sichtbar und legt die Tierkarte in den Pool.
- Startdeck: 8–10 Karten aus dem Pool, höchstens 2 Kopien je Karte.

## Auslegungen und Vorschläge (bitte prüfen)

| Thema                 | Umsetzung                                                                                                             | Status                                          |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Feuer-Schwelle        | „Feuchte ≤ 1 vor dem Spielen“ (aus Handover übernommen)                                                               | offen laut Handover                             |
| **Flut**              | Gewitter auf Feuchte ≥ 4: Dichte −1, alle Nachbarn Feuchte +1, zählt als Störung                                      | **neu vorgeschlagen** – im Handover nur erwähnt |
| Sturm                 | Spieler wählt die Nachbarzone, in die der Baum stürzt                                                                 | Auslegung                                       |
| Bestäubung            | „Dichte +1 auf Nachbarzone“ einer frei gewählten Zone – an keinen Schmetterling gebunden                              | Auslegung                                       |
| Fruchtregen           | Samenflug inkl. Schwelle + Merkmal „Früchte“ auf allen Nachbarzonen; Früchte wirken noch nicht                        | offen                                           |
| Kadaver               | setzt Merkmal „Kadaver“; Aasfresser gibt es noch nicht                                                                | offen (2. Ebene)                                |
| Horst                 | macht die Zone dauerhaft feuerfest                                                                                    | wie Handover                                    |
| Karteneffekt „ziehen“ | Engine unterstützt `draw`; Ablegen von Karten gibt es bewusst nicht (Entscheidung des Inhabers: Dilemma statt Ausweg) | bereit                                          |

## Bekannte Grenzen

- Der greedy-Bot schaut nur einen Kartenzug weit voraus und kennt dabei den Zufall des nächsten Zugendes.
  Langfristige Ketten (Bestäubung 2× → Papagei → Harpyie) verfolgt er kaum.
- Expeditionsziele („Dokumentiere drei Vogelarten“), Trockenzeit und Mitbringsel sind noch nicht umgesetzt.
