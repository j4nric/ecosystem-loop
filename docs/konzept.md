# Being God (ain't easy) – Konzept 1.4 „Die Herde“

Stand: 10.11.2026 · Status: **Richtung bestätigt** (Prototyp gespielt), Details als Entwurf.
Vorgänger: [Konzept 0.4](archiv/konzept-0.4.md) (Werte-Optimierung mit fünf Geografien, verworfen).

Spielbarer Prototyp: `prototypes/herde/index.html` · https://claude.ai/artifact/SGjunM9r8zGF2VVKFyBXcZ

## 1. Vision

Du bist ein Gott, der nicht erschafft, sondern Bedingungen formt. Eine Herde zieht Jahr für Jahr über eine Insel und
sucht sich ihren Weg selbst. Du formst die Landschaft, setzt Leben in Gang und lebst mit dem, was daraus wächst.

> Du baust keine Welt für deine Herde. Du setzt Leben in Gang und lebst mit dem, was daraus wächst.

## 2. Warum der Neuanfang

Konzept 0.4 war an der Oberfläche zu komplex (5 Zonen × 4 Werte, die ständig schwanken) und in den Entscheidungen
zu simpel (jeder Zug: die am wenigsten schlechte Karte). Die Neuausrichtung greift die Kernideen des ursprünglichen
Handovers wieder auf: indirekte Steuerung, selbst gewählte Reibung, eine Welt mit Eigenleben.

## 3. Kernprinzipien

1. **Die Welt lebt weiter.** Landschaft verändert sich von selbst (Sukzession, Feuer, Räuber). Du spielst gegen die
   Folgen deiner eigenen Entscheidungen von vor ein paar Jahren, nicht gegen Gegner.
2. **Die Herde wählt ihren Weg selbst.** Du steuerst sie nie direkt. Du lockst sie: mit Gras, Wasser, Schutz – und
   du schreckst sie ab: mit Fels, Feuer, Wölfen. Ihre Absicht ist immer sichtbar.
3. **Wenig Zahlen, viel Raum.** Sichtbar sind nur Herde, Vorrat, Wölfe und Wildnis. Alles andere zeigt die Insel
   selbst: was wo liegt und was nebeneinander liegt.
4. **Jeder Eingriff ist ein Tausch.** Jede Karte hilft jetzt und rückt die große Prüfung näher (Wildnis). Wald gibt
   Schutz und bringt Wölfe; Feuer vertreibt Wölfe und frisst den Schutz.
5. **Rundenweise, ruhig, fürs Handy.** Ein Monat pro Schritt, eine Jahreszeit pro Entscheidungspunkt.
   Eine Partie dauert 20–30 Minuten.

## 4. Die Insel

- Raster aus Feldern (Prototyp 7 × 9). Meer und Fels sind für die Herde unpassierbar.
- **Landschaften und ihr Eigenleben** (Zahlen sind Platzhalter):

| Landschaft  | Futter (max) | Besonderheit                                 | Wird von selbst …                           |
| ----------- | ------------ | -------------------------------------------- | ------------------------------------------- |
| Steppe      | 1            | karg                                         | bleibt Steppe                               |
| Wiese       | 6            | Hauptfutter, wächst im Frühling am stärksten | Busch nach 12 Monaten ohne Beweidung        |
| Busch       | 2            | Schutz im Winter                             | Wald nach 18 Monaten                        |
| Wald        | 1            | Schutz, Lebensraum der Wölfe                 | Altwald nach 36 Monaten                     |
| Altwald     | 0            | Schutz, kann im Sommer brennen               | Brandfläche (Feuer springt auf Gehölz)      |
| Brandfläche | 0            | vertreibt Wölfe                              | fruchtbare Wiese (+2 Futter) nach 4 Monaten |
| Wasser      | 0            | Tränke im Sommer                             | –                                           |
| Fels        | –            | unpassierbar                                 | –                                           |

- Die Herde selbst formt die Insel mit: Beweidete Wiese bleibt offen, gemiedene verbuscht.

## 5. Die Herde

- Zieht jeden Monat höchstens ein Feld weiter. Sie bewertet ihre Nachbarfelder nach Futter in Reichweite, im Sommer
  nach Wasser, im Winter nach Schutz, und meidet Wölfe und gerade besuchte Felder. Die Wahl ist deterministisch und
  wird als **Absicht** angezeigt („sucht Wasser ↘“).
- **Fressen:** 1 Futter pro Tier und Monat aus dem eigenen und den 8 Nachbarfeldern. Überschuss wird **Vorrat**
  (höchstens doppelte Herdengröße), Mangel zehrt ihn auf, danach sterben Tiere.
- **Jahreszeiten:** Frühling Nachwuchs (je nach Vorrat), Sommer Durst ohne Wasser in der Nähe, Herbst Vorrat
  anfressen, Winter kein Graswachstum und Kälte ohne Gehölz in der Nähe.

## 6. Wölfe

- Rudel (Stärke 1–3) leben im Gehölz. Hungrige Rudel ziehen durch zusammenhängendes Gehölz auf die Herde zu –
  **Waldkorridore sind Wolfswege.**
- Ist die Herde in Reichweite, reißen sie Tiere. Satte Rudel wachsen und gründen neue, hungrige verkümmern.
- Ohne Rudel wandern bei genug Wald neue ein. Feuer und Fels vertreiben sie.

## 7. Karten (Eingriffe des Gottes)

Zu Beginn jeder Jahreszeit 2 Karten, höchstens 5 auf der Hand. Kein Ablegen. Jede Karte erhöht die Wildnis.

| Karte          | Wirkung                           | Tausch                                       |
| -------------- | --------------------------------- | -------------------------------------------- |
| Wiese säen     | Steppe oder Brand → Wiese         | verbuscht, wenn die Herde nicht hinzieht     |
| Bäume pflanzen | Steppe oder Wiese → Busch         | Schutz jetzt, Wald und Wölfe später          |
| Quelle         | Steppe oder Wiese → Wasser        | kostet Weidefläche                           |
| Fels           | sperrt ein Feld                   | lenkt die Herde, nimmt Fläche                |
| Blitz          | Gehölz brennt, Feuer springt über | vertreibt Wölfe, frisst Schutz, später Wiese |
| Regen          | ganze Insel: Gras +2              | lässt auch Busch und Wald schneller wachsen  |

## 8. Wildnis und die große Prüfung

- Die **Wildnis** wächst jeden Monat ein wenig und mit jeder gelegten Karte. Bei 100 beginnt die **Eiszeit**:
  6 Monate Winter, kein Nachwuchs.
- Übersteht die Herde die Eiszeit, ist das Zeitalter (die Partie) gewonnen. Wertung: Zahl der Überlebenden.
- Wer viel eingreift, ist besser vorbereitet, ruft die Prüfung aber früher herbei.

## 9. Entscheidungen und offene Punkte

1. ✅ **Merkmale aus dem Erlebten** (Phase H3a). Kurzspezifikation (Zahlen sind Platzhalter in
   `packages/herde/data/traits.yaml`):
   - Die Herde zählt **Erfahrungen** (Zähler je Monat): Schutz in einer Kälte-Jahreszeit, Wolfsangriffe überlebt,
     Wasser in einer Durst-Jahreszeit, Waldbrand in der Nähe überlebt (Feuer durch die eigene Blitz-Karte zählt nicht), Monate im Gehölz gefressen, Monate auf offener
     Fläche, gegangene Felder. Was zählt, steht in den Daten (Bedingungstypen der Engine).
   - Jedes **Merkmal** gehört zu einer Erfahrung und wird verfügbar, sobald deren Zähler seine Schwelle erreicht.
   - Zu Beginn jeder Jahreszeit **bietet** die Engine bis zu 3 verfügbare Merkmale an, ohne Zufall: zuerst die, die
     die aktuelle Stufe zur Reife verlangt, dann die übrigen in der Reihenfolge der Daten. Der Spieler wählt eines
     (`pickTrait`) oder lässt das Angebot stehen; dann **rotiert** es zur nächsten Jahreszeit weiter, damit andere
     verfügbare Merkmale drankommen (die verlangten bleiben vorn). Also höchstens ein Merkmal je Jahreszeit.
   - Ein Merkmal ändert Stufenwerte (`mul`/`add` auf Zahlen der Stufe, z. B. Kälteverlust × 0,5, Wolfsverluste
     −1 je Rudel, Durst einen Monat später), in der Reihenfolge der Wahl. Die Wirkung bleibt über den Stufensprung
     erhalten; für die Reife zählt ein Merkmal nur auf der Stufe, auf der es gewählt wurde (9.2).

   | Merkmal      | Erfahrung                  | Schwelle | Wirkung                 |
   | ------------ | -------------------------- | -------- | ----------------------- |
   | Dichtes Fell | Kälte-Monate mit Schutz    | 3        | Kälteverlust × 0,5      |
   | Wachsamkeit  | Wolfsangriffe überlebt     | 2        | je Rudel 1 Tier weniger |
   | Genügsam     | Durst-Monate am Wasser     | 4        | Durst 1 Monat später    |
   | Feuerscheu   | Waldbrände in der Nähe     | 1        | Brandverlust × 0,5      |
   | Waldkundig   | Monate im Gehölz gefressen | 4        | Vorratsdeckel + 1       |
   | Weitblick    | Monate auf offener Fläche  | 6        | Durstverlust × 0,5      |
   | Ausdauer     | gegangene Felder           | 12       | Hungertote × 0,5        |

2. ✅ **Entwicklung bis zum Menschen innerhalb einer Partie, fester Weg** (Phase H3, ersetzt „Herde bleibt
   Herde“). Jede Stufe bringt neue Bedürfnisse; was der einen Stufe half, kann der nächsten schaden, und Landschaft
   braucht Jahre – der Spieler muss die Welt für die nächste Stufe vorbereiten. Entwurf der fünf Stufen:

   | Stufe                              | Braucht                                               | Was sich umdreht                                     |
   | ---------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- |
   | 1. Grasende Herde                  | Wiese, Wasser im Sommer, Gehölz im Winter             | Wölfe sind Feinde, Feuer ist Gefahr                  |
   | 2. Waldsammler                     | Früchte in Wald und Busch, Wasser                     | Wald wird Nahrung, Wiese unwichtig                   |
   | 3. Wanderer der offenen Landschaft | Wechsel aus offener Fläche und Wasser, weite Wege     | dichter Wald wird Hindernis                          |
   | 4. Jäger und Sammler               | Beute (andere Tiere), Wasser                          | Wölfe werden Konkurrenten, Feuer wird Werkzeug       |
   | 5. Mensch                          | Lagerplatz mit Wasser, Wiese und Wald nah beieinander | die Herde formt die Insel selbst mit (Rodung, Feuer) |

   Auslöser: Merkmale aus dem Erlebten (9.1) machen die Herde reif für die nächste Stufe; der Spieler entscheidet,
   wann sie den Sprung macht, ohne Rückweg. Die Eiszeit wird eine Prüfung unterwegs statt des Partie-Endes; Sieg =
   Menschen erreicht und letzte Prüfung überstanden (kommt mit H3b; bis dahin endet die Partie wie bisher mit der
   Eiszeit). Bedürfnisse je Stufe stehen in den Daten (`stages.yaml`, `herd.stage`).

   Kurzspezifikation H3a (Stufen 1–3, Zahlen sind Platzhalter):
   - **Reife:** Jede Stufe nennt ihre Folgestufe (`next`) und was sie zur Reife braucht: eine Zahl an Merkmalen und
     optional eines aus einer Liste. Es zählen nur Merkmale, die **auf dieser Stufe** gewählt wurden; frühere
     Merkmale wirken weiter, zählen aber nicht – so lässt sich keine Stufe überspringen (in den Daten umschaltbar:
     `mature.scope: stage | all`). Reif ist die Herde, sobald beides erfüllt ist. Dann darf der Spieler zwischen den
     Monaten **springen** (`evolve`); der Sprung ist unumkehrbar. Sind alle passenden Merkmale schon auf früheren
     Stufen gewählt, gilt die Bedingung als erfüllt (die Herde sitzt nie fest).
   - **Bedürfnisse je Stufe:** was als Futter, Wasser und Schutz zählt; in welchen Jahreszeiten Wasser bzw. Schutz
     nötig ist; Futter-Maximum und Wachstum je Landschaft für diese Stufe (sonst die Werte der Landschaft); welche
     Landschaften die Stufe nicht betritt; Schrittweite (Felder je Monat) und Umkreis (Fressen, Wasser, Schutz).

   | Stufe       | Futter                              | Wasser     | Schutz | Hindernis | Schritte | Reif für die nächste Stufe                   |
   | ----------- | ----------------------------------- | ---------- | ------ | --------- | -------- | -------------------------------------------- |
   | 1. Herde    | Wiese, Steppe, Busch, Wald          | Sommer     | Winter | –         | 1        | 2 neue Merkmale, darunter Waldkundig         |
   | 2. Sammler  | Früchte: Busch 3, Wald 4, Altwald 3 | ganzjährig | Winter | –         | 1        | 3 neue Merkmale, darunter Weitblick/Ausdauer |
   | 3. Wanderer | Wiese, Steppe                       | ganzjährig | Winter | Altwald   | 2        | (H3b: Jäger)                                 |

   Futter je Feld ist ein einziger Vorrat; die Stufe bestimmt, wie viel er höchstens fasst und wie schnell er
   wächst. Nach dem Sprung wächst ein Waldfeld also auf das Maximum der Sammler; eine Wiese wächst weiter wie
   bisher, zählt für den Sammler aber nicht als Futter.

3. ✅ **Jahreskreis mit Wetterfeldern** (Phase H4): je Jahreszeit ein Feld; eine Wetterkarte dort wirkt jedes Jahr
   wieder in dieser Jahreszeit, bis sie ersetzt wird; höchstens ein Wechsel pro Jahr. Beispiele: nasser Frühling
   (Wiesen wachsen doppelt, Gehölz auch), Gewittersommer (Wasser überall, mehr Brände), milder Herbst (längeres
   Graswachstum, satte Wölfe), strenger Winter (Altwald stirbt, Rudel verhungern, Herde braucht mehr Schutz).
4. 💡 **Größere Insel mit Wegen und Gabelungen**, mehrere Szenarien (Inseltypen), Ereignisse (Dürrejahr, Seuche).
5. **Partielänge:** Ziel 20–30 Minuten; der Prototyp liegt bei 10–15 (Wildnis-Tempo anpassen).

## 10. Was bleibt vom bisherigen Projekt

Infrastruktur und Arbeitsweise bleiben: Monorepo, CI, Deploy auf den vServer, App-Hülle (Vite, React, Three.js,
Capacitor), deterministische Engine mit Zufall aus dem Seed, Regeln und Zahlen in YAML, Cockpit. Die Spielregeln
von Konzept 0.4 (Geografien, Werte, Formen, Weltkarten) werden ersetzt; der Code bleibt bis zum Umbau im Repo.

## Änderungsverlauf

- **1.4 (10.11.2026):** Korrekturen zu H3a: Für die Reife zählen nur Merkmale der aktuellen Stufe, frühere wirken
  weiter (9.2, in den Daten umschaltbar); das Angebot stellt Reife-Merkmale voran und rotiert, wenn es liegen bleibt
  (9.1); Feuer durch die Blitz-Karte zählt nicht als Erfahrung, „Brand“ heißt jetzt „Waldbrand“ (9.1).
- **1.3 (10.11.2026):** Kurzspezifikation H3a: Erfahrungen, Merkmale mit Angebot je Jahreszeit, Reife und
  Sprung, Bedürfnisse der Stufen 1–3 (9.1, 9.2).
- **1.2 (10.11.2026):** Entwicklung in fünf Stufen bis zum Menschen innerhalb einer Partie, fester Weg.
- **1.1 (10.11.2026):** Entscheidungen: Merkmale aus dem Erlebten (H3), Herde bleibt Herde, Wetterfelder im
  Jahreskreis (H4).
- **1.0 (10.11.2026):** Neuausrichtung „Die Herde“ nach Prototyp-Test. Loop-Hero-Grundidee (indirekte Steuerung,
  selbst gewählte Reibung) mit lebender Welt und selbst wählender Herde. Konzept 0.4 archiviert.
