# Being God (ain't easy) – Spielkonzept

Stand: 10.11.2026 · Version 0.2.1 (löst das [Handover](handover.md) als Leitdokument ab)

> **Status:** Vom Inhaber am 10.11.2026 bestätigt (✅). Zahlen sind Startwerte fürs Balancing –
> sie werden in der Simulation justiert, nicht am Schreibtisch. Umsetzung: [Entwicklungsplan](entwicklungsplan.md).

## 1. Vision

Der Spieler ist ein Gott, der eine kleine Insel nicht direkt erschafft, sondern nur ihre Bedingungen
formt: Regen, Dürre, Sturm, Samen. Das Leben entwickelt sich von selbst – vom Plankton bis zum Menschen.
Je höher das Leben steigt, desto empfindlicher wird das Gleichgewicht. Ziel ist es, möglichst lange zu
überleben und dabei möglichst hoch entwickeltes Leben zu tragen. Jeder Eingriff hilft an einer Stelle
und schadet an einer anderen.

- Plattform: iOS und Android (App) ✅
- Stil: einfaches Low-Poly-Diorama, eine schwebende Insel ✅
- Partie: Roguelite-Durchgang von 10–20 Minuten mit Highscore, Meta-Progression zwischen den Partien ✅
- Sprache: Englisch (Hauptsprache) und Deutsch ✅

## 2. Kernprinzipien

Jede Mechanik muss mindestens eines davon tragen und darf keines verletzen:

1. **Indirekte Kontrolle.** Der Gott setzt keine Tiere und Pflanzen, er formt Werte. Das Leben folgt.
2. **Jeder Eingriff ist ein Tausch.** Was einer Zone oder Art hilft, kostet woanders: Odem, Werte
   einer Nachbarzone, den Bestand einer anderen Art.
3. **Gleichgewicht ist fragil, nicht statisch.** Jahreszeiten, Ereignisse und die Tiere selbst
   verschieben die Werte ständig. Stillstand führt in den Verfall.
4. **Fehler sind korrigierbar, aber teuer.** Die Natur heilt langsam von selbst; schnelle Korrekturen
   kosten viel Odem.
5. **Zerstörung kann Absicht sein.** Evolution braucht Selektionsdruck. Wer gezielt stört, kann
   Sprünge erzwingen – und riskiert den Kollaps.

## 3. Ablauf einer Partie

Eine **Runde ist eine Jahreszeit** ✅, vier Runden sind ein Jahr. Jede Runde hat vier Phasen:

1. **Vorschau:** Die kommende Jahreszeit und ein angekündigtes Ereignis werden gezeigt ✅.
2. **Eingriffe:** Der Spieler spielt Karten aus seiner Hand und bezahlt sie mit Odem.
   ✅ Kartenzwang bleibt: mindestens eine Karte pro Runde. Naturgewalten kosten 0 Odem, man ist also nie blockiert –
   aber sie sind grob und haben Nebenwirkungen.
3. **Natur:** in fester Reihenfolge
   1. Jahreszeit wirkt auf die Werte
   2. Ereignis tritt ein
   3. Zonen-Kopplungen (z. B. Gletscher speist Fluss)
   4. Selbstheilung (Werte driften zum Ruhewert)
   5. Formen werden neu bestimmt, Zonenstufen steigen oder fallen
   6. Populationen: Fressen, Wachstum, Hunger, Wanderung
   7. Evolution
4. **Bilanz:** Harmonie wird neu berechnet, Odem fließt zu, Karten werden nachgezogen.

Die Partie endet, wenn die **Harmonie auf 0 fällt (Kollaps)** ✅. Ereignisse werden mit jedem Jahr
härter, sodass jede Partie irgendwann endet.

## 4. Die Welt: fünf Geografien

Die Insel hat **fünf Zonen mit fester Geografie** ✅: Berge, Wald, Flachland, Fluss, Küste.
Erweiterbar auf mehr Zonen pro Geografie ✅ (z. B. zwei Waldzonen), zunächst eine je Geografie.

```
          Berge
        /       \
     Wald ─── Fluss
        \     /    \
      Flachland ── Küste
```

✅ Nachbarschaft: Berge–Wald, Berge–Fluss, Wald–Fluss, Wald–Flachland, Fluss–Flachland, Fluss–Küste,
Flachland–Küste. Der Fluss ist die Lebensader: Er grenzt an alles außer sich selbst.

### 4.1 Werte

Jede Zone hat **drei gemeinsame Werte** ✅ und **einen Sonderwert ihrer Geografie** ✅, jeweils 0–5:

| Wert       | Bedeutung                |
| ---------- | ------------------------ |
| Licht      | Sonne bis Schatten       |
| Feuchte    | trocken bis nass         |
| Vegetation | kahl bis dicht bewachsen |

| Geografie | Sonderwert ✅ | Bedeutung                                                  |
| --------- | ------------- | ---------------------------------------------------------- |
| Berge     | Schnee        | Schneedecke und Gletscher, speist im Frühling den Fluss    |
| Wald      | Totholz       | Zersetzung, Nährstoffe und Brandgefahr                     |
| Flachland | Boden         | Nährstoffe; wird durch Überweidung und Ackerbau ausgelaugt |
| Fluss     | Wasserstand   | vom ausgetrockneten Bett bis zum Hochwasser                |
| Küste     | Salz          | Salzgehalt; Süßwasser vom Fluss senkt ihn                  |

Jede Geografie hat einen **Ruhewert** je Wert (ihren natürlichen Zustand). ✅ Alle zwei Runden bewegt sich
jeder Wert um 1 auf seinen Ruhewert zu – das ist die langsame Selbstheilung.

### 4.2 Formen ✅ (Vorschlag zu Frage 10)

Aus den Werten ergibt sich die **Form** einer Zone. Sie bestimmt, welche Arten dort leben können,
und wird als 3D-Modell gezeigt. Jede Geografie hat eine **Idealform** (beste Lebensgrundlage, nur mit
ausgewogenen Werten erreichbar) und eine **verödete Form** (zieht Harmonie ab).
Bei mehreren passenden Formen gilt die erste in der Tabelle.

**Berge** (Sonderwert Schnee)

| Form               | Bedingung (Startwerte)                | Lebensraum für                 |
| ------------------ | ------------------------------------- | ------------------------------ |
| Gletscher          | Schnee 5                              | – (speist den Fluss)           |
| Geröll · _verödet_ | Vegetation 0, Schnee ≤ 1              | –                              |
| **Alm** · _ideal_  | Vegetation 2–3, Schnee 1–2, Licht ≥ 3 | Bienen, Kleinsäuger, Hirsche   |
| Bergwald           | Vegetation ≥ 4                        | Vögel, Greifvögel, Wölfe       |
| Fels               | sonst                                 | Echsen, Greifvögel (Nistplatz) |

**Wald** (Sonderwert Totholz)

| Form                                   | Bedingung                              | Lebensraum für                            |
| -------------------------------------- | -------------------------------------- | ----------------------------------------- |
| Brandfläche · _verödet, vorübergehend_ | Vegetation ≤ 1, Totholz ≥ 3            | Käfer – und fruchtbar für den Neuaufwuchs |
| Trockenwald                            | Feuchte ≤ 1, Vegetation ≥ 3            | Echsen; hohe Brandgefahr                  |
| **Urwald** · _ideal_                   | Vegetation 5, Feuchte ≥ 4, Totholz 2–3 | Primaten, Vögel, alle Waldarten           |
| Lichter Wald                           | Licht ≥ 3, Vegetation 2–3              | Hirsche, Vögel, Bienen                    |
| Mischwald                              | sonst                                  | Käfer, Kleinsäuger, Wölfe                 |

**Flachland** (Sonderwert Boden)

| Form                      | Bedingung                            | Lebensraum für                         |
| ------------------------- | ------------------------------------ | -------------------------------------- |
| Ödland · _verödet_        | Vegetation 0, Feuchte ≤ 1            | –                                      |
| Moor                      | Feuchte ≥ 4                          | Frösche, Käfer                         |
| **Blumenwiese** · _ideal_ | Vegetation 2–4, Boden ≥ 4, Licht ≥ 3 | Bienen, Kleinsäuger, Hirsche, Menschen |
| Steppe                    | Feuchte ≤ 2                          | Echsen, Kleinsäuger, Wölfe             |
| Buschland                 | Vegetation 5                         | Kleinsäuger, Vögel                     |
| Wiese                     | sonst                                | Käfer, Kleinsäuger, Hirsche, Menschen  |

**Fluss** (Sonderwert Wasserstand)

| Form                            | Bedingung                     | Lebensraum für                                     |
| ------------------------------- | ----------------------------- | -------------------------------------------------- |
| Trockenes Flussbett · _verödet_ | Wasserstand 0                 | –                                                  |
| Hochwasser · _Störung_          | Wasserstand 5                 | – (überflutet Nachbarn: Feuchte +1, Vegetation −1) |
| Bach                            | Wasserstand 1–2               | Plankton, Frösche                                  |
| **Aue** · _ideal_               | Wasserstand 3, Vegetation ≥ 4 | Fische, Frösche, Vögel, Menschen                   |
| Strom                           | sonst                         | Plankton, Fische                                   |

**Küste** (Sonderwert Salz)

| Form                   | Bedingung                             | Lebensraum für                       |
| ---------------------- | ------------------------------------- | ------------------------------------ |
| Salzwüste · _verödet_  | Salz 5, Feuchte ≤ 2                   | –                                    |
| **Mangrove** · _ideal_ | Vegetation ≥ 4, Salz 2–3, Feuchte ≥ 4 | Fische (Kinderstube), Frösche, Vögel |
| Riff                   | Licht ≥ 4, Salz ≥ 3                   | Plankton, Fische                     |
| Watt                   | Feuchte ≥ 4, Vegetation ≤ 2           | Plankton, Vögel                      |
| Strand                 | sonst                                 | Echsen                               |

### 4.3 Kopplungen zwischen Zonen ✅

Die Geografien hängen zusammen. Darum hat jeder Eingriff Nebenwirkungen:

- **Schneeschmelze:** Im Frühling wandert Schnee der Berge als Wasserstand in den Fluss.
- **Süßwasser:** Ein Fluss mit Wasserstand ≥ 3 senkt das Salz der Küste.
- **Waldklima:** Ein Wald mit Vegetation ≥ 4 erhöht die Feuchte des Flachlands.
- **Hochwasser** überflutet alle Nachbarn des Flusses.

### 4.4 Zonenstufe ✅

Jede Zone hat eine **Stufe von 1 bis 5**: ihre Reife als Lebensraum.

- ✅ Sie steigt um 1, wenn die Zone 3 Runden am Stück in einer nicht verödeten Form war und genügend Arten trägt.
- Stufe 4 und 5 sind **nur in der Idealform** erreichbar. Stufe 5 verlangt zusätzlich ≥ 4 Arten in der Zone.
  Das ist die schwer erreichbare Obergrenze.
- Sie fällt um 1 bei verödeter Form, nach einer Störung (Feuer, Hochwasser …) oder beim Wechsel in eine andere Form.
- Die Zonenstufe begrenzt die Evolution: Eine Art der Entwicklungsstufe _n_ kann nur in einer Zone mit
  Stufe ≥ _n − 2_ entstehen. Hohes Leben braucht reife Lebensräume.

## 5. Das Leben

### 5.1 Populationen ✅

Jede Art hat pro Zone einen **Bestand von 0–9**.

- **Fressen:** Pflanzenfresser zehren an der Vegetation, Räuber an ihrer Beute.
- **Wachstum:** Reicht die Nahrung und passt die Form, wächst der Bestand um 1.
- **Hunger:** Reicht sie nicht, schrumpft er um 1.
- **Überpopulation** frisst die Nahrung leer: Überweidung senkt Vegetation und Boden, zu viele Räuber
  rotten ihre Beute aus. Das ist die wichtigste Quelle für Fehler und Kettenreaktionen.
- **Wanderung:** Ab Bestand ≥ 4 wandert 1 Tier in eine passende Nachbarzone.
- **Aussterben:** Bestand 0 in allen Zonen ⇒ die Art ist ausgestorben (Harmonie −). Sie kann nur
  zurückkehren, wenn ihr Vorfahr sie erneut hervorbringt.

### 5.2 Evolution ✅

Höhere Arten **entstehen aus niedrigeren** entlang eines Stammbaums. Eine Art entwickelt sich weiter, wenn in einer Zone

- ihr Bestand hoch genug ist (✅ ≥ 5),
- die Form für die neue Art passt,
- die Zonenstufe reicht,
- diese Bedingungen ✅ 3 Runden lang erfüllt sind.

Dann wechseln 2 Tiere zur neuen Art.

**Selektionsdruck** ✅: Ab Entwicklungsstufe 4 braucht ein Evolutionsschritt zusätzlich eine
**Störung in der Zone oder einer Nachbarzone in den letzten 4 Runden**. Wer höheres Leben will,
muss sein Gleichgewicht bewusst erschüttern – das ist das zentrale Risiko-Werkzeug.

### 5.3 Stammbaum ✅ (Vorschlag)

| Stufe | Art         | entsteht aus                      | frisst               | Gabe (Karte)                                                |
| ----- | ----------- | --------------------------------- | -------------------- | ----------------------------------------------------------- |
| 1     | Plankton    | – (Startleben im Wasser)          | Licht                | _Algenblüte_: Vegetation +1 in einer Wasserzone, Licht −1   |
| 1     | Käfer       | – (Startleben an Land)            | Totholz              | _Zersetzung_: Totholz −1, Boden +1 in einer Nachbarzone     |
| 2     | Fisch       | Plankton                          | Plankton             | _Laichzug_: 1 Fisch wandert flussaufwärts oder flussabwärts |
| 2     | Biene       | Käfer                             | Vegetation (Blüten)  | _Bestäubung_: Vegetation +1                                 |
| 3     | Frosch      | Fisch                             | Käfer, Bienen        | _Regenruf_: Feuchte +1                                      |
| 4     | Echse       | Frosch                            | Käfer                | _Sonnenbad_: Licht +1, Feuchte −1                           |
| 5     | Kleinsäuger | Echse                             | Vegetation           | _Graben_: Boden +1, Vegetation −1                           |
| 5     | Vogel       | Echse                             | Käfer, Fische        | _Samenflug_: Vegetation +1 in beliebiger Zone               |
| 6     | Hirsch      | Kleinsäuger                       | Vegetation           | _Äsen_: Vegetation −1 (gegen Verbuschung)                   |
| 6     | Wolf        | Kleinsäuger (braucht Hirsche)     | Hirsch, Kleinsäuger  | _Jagd_: Bestand eines Pflanzenfressers −2                   |
| 6     | Greifvogel  | Vogel                             | Kleinsäuger, Fische  | _Späherblick_: nächstes Ereignis abwenden oder verschieben  |
| 6     | Primat      | Kleinsäuger (nur Urwald)          | Vegetation (Früchte) | _Fruchtregen_: Vegetation +1 in allen Nachbarzonen          |
| 7     | **Mensch**  | Primat (Zone Stufe ≥ 5, am Fluss) | alles                | siehe 5.4                                                   |

Damit entsteht eine Kette über alle Geografien: Wasser → Land → Wald → Flachland. Kein Lebensraum genügt allein.

### 5.4 Der Mensch ✅

Der Mensch ist die höchste Stufe, aber **kein Sieg**. Er bringt die stärksten Karten und verbraucht
das Ökosystem:

- **Karten:** _Feuer_ (gezielte Brandrodung, 0 Odem), _Ackerbau_ (Boden −1, Vegetation fest +2), _Siedlung_ (Mensch-Bestand +2).
- **Kosten:** Jede Runde senkt jeder Mensch-Bestand die Harmonie ein wenig. Ackerbau laugt den Boden aus. Menschen
  jagen alle Pflanzenfresser.
- **Wertung:** Solange Menschen leben, zählt jede Runde doppelt.

Die Endspiel-Frage lautet also: Wie lange hält meine Welt den Menschen aus?

## 6. Der Gott: Odem und Karten

### 6.1 Odem ✅

**Odem** ist die knappe Ressource des Gottes. ✅ Er fließt jede Runde zu:

```
Odem pro Runde = 1 + ⌊Harmonie / 25⌋ + (1, wenn ≥ 6 Arten leben)   · Obergrenze: 10 angespart
```

Eine gesunde Welt gibt mehr Kraft. Eine kranke Welt macht den Gott schwach, genau wenn er Kraft
am dringendsten bräuchte. Das ist der zentrale Tausch.

### 6.2 Karten ✅

Hand mit 4 Karten, nach jeder Runde wird auf 4 nachgezogen. Ist der Stapel leer, wird die Ablage gemischt.

| Kategorie       | Odem | Charakter                                        | Beispiele                                                                                                                 |
| --------------- | ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Naturgewalten   | 0    | grob, mit Schwellen und Nebenwirkungen           | Gewitter, Dürre, Sturm, Frost                                                                                             |
| Gaben           | 1–2  | präzise, ein Wert ±1                             | Regen, Sonne, Samen, Dünger                                                                                               |
| Wunder          | 3–5  | Korrektur von Fehlern                            | _Heilung_ (Zone zum Ruhewert), _Arche_ (Art vor dem Aussterben retten: Bestand +2), _Stille_ (nächstes Ereignis entfällt) |
| Gaben der Arten | 0–2  | kommen ins Deck, wenn eine Art erstmals entsteht | siehe Stammbaum                                                                                                           |
| Menschenkarten  | 0–2  | stark, mit Langzeitkosten                        | Feuer, Ackerbau, Siedlung                                                                                                 |

Die Schwellen-Logik aus Prototyp 0.1 bleibt: Gewitter auf trockener Zone wird Feuer, Sturm auf dichter Zone wird Baumsturz.
Gefahren werden **sichtbar angezeigt** (🔥 auf der Zone), nie als versteckte Prozentzahl.

## 7. Harmonie ✅

Die **Harmonie (0–100)** ist das Lebenszeichen der Welt. Sie startet bei ✅ 60.

✅ Veränderung pro Runde:

| Quelle                                | Wirkung        |
| ------------------------------------- | -------------- |
| Zone in Idealform                     | +2             |
| Zone in verödeter Form                | −3             |
| Arten am Leben                        | +0,5 pro Art   |
| Art ausgestorben                      | −10 (einmalig) |
| Hunger / Überpopulation in einer Zone | −1             |
| Mensch-Bestand                        | −0,5 pro Tier  |

Bei 0 kollabiert die Welt und die Partie endet. Die Harmonie wird als Lebensbalken ganz oben
angezeigt. Die Insel reagiert sichtbar: Farben werden blasser, Nebel zieht auf.

## 8. Fehler ausbügeln oder bewusst in Kauf nehmen ✅

| Mittel           | Kosten                                               | Zweck                                                    |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Selbstheilung    | gratis, aber langsam (±1 alle 2 Runden zum Ruhewert) | kleine Fehler verwachsen von selbst                      |
| Gaben            | 1–2 Odem                                             | gezielt nachsteuern                                      |
| Wunder           | 3–5 Odem                                             | große Fehler schnell reparieren                          |
| Arche            | 4 Odem                                               | eine Art vor dem Aussterben retten                       |
| Gezielte Störung | Harmonie-Einbruch, Zonenstufe −1                     | Selektionsdruck für Evolution, Brandfläche als Neuanfang |

## 9. Ereignisse ✅

Ereignisse werden **eine Runde vorher angekündigt**. Der Spieler kann sich vorbereiten, abwenden
(_Stille_, _Späherblick_) oder sie für Selektionsdruck nutzen.

✅ Pool (mit jedem Jahr wahrscheinlicher und stärker):

| Ereignis             | Wirkung                                              |
| -------------------- | ---------------------------------------------------- |
| Hitzesommer          | alle Zonen Feuchte −1                                |
| Kälteeinbruch        | Berge Schnee +2, alle Zonen Vegetation −1            |
| Blitzschlag          | Gewitter auf zufälliger Zone (kann Feuer auslösen)   |
| Seuche               | dichteste Population −3                              |
| Sturmflut            | Küste Salz +2, Flachland Feuchte +1                  |
| Heuschrecken         | Flachland Vegetation −2                              |
| Meteorit (ab Jahr 8) | eine Zone fällt auf Stufe 1, starker Selektionsdruck |

**Jahreszeiten** ✅ (wirken jede Runde):

- Frühling: Vegetation +1 in Zonen mit Feuchte ≥ 2, Schneeschmelze
- Sommer: Feuchte −1
- Herbst: Totholz +1, Vegetation −1 im Wald
- Winter: Schnee +1, Wachstum der Populationen pausiert

## 10. Wertung und Meta-Progression

**Punkte** ✅: Jede Runde bringt die Summe der Entwicklungsstufen aller lebenden Arten, verdoppelt
solange Menschen leben. Langes Überleben und hohes Leben zählen also beide.

**Schöpfungsbuch** ✅ (das frühere Notizbuch): Jede Art, die zum ersten Mal entsteht, wird dauerhaft eingetragen.

- Ihre Bedingungen werden sichtbar.
- Ihre Gabe kommt in den Pool für Startdecks (8–10 Karten).
- Wunder werden über Meilensteine freigeschaltet, z. B. _Arche_ nach dem ersten Aussterben.

Progression bedeutet früheren Zugang zu Werkzeugen, nicht mehr Macht.

**Wiederspielwert:** variierende Startwelten (Seed, Startwerte), Ereignis-Reihenfolge, Startdeck-Wahl.

## 11. Was aus Prototyp 0.1 bleibt

| Bleibt                                                                         | Ändert sich                                                                      |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Datengetriebene Engine, Bedingungs- und Effektsprache, Seeds, Bots, Simulation | Expedition mit Ausstieg → Überleben bis zum Kollaps                              |
| Karten mit festen Effekten und sichtbaren Schwellen                            | Kartenstapel läuft nicht mehr leer (Ablage wird gemischt)                        |
| Kartenzwang (✅ mindestens 1 Karte, Naturgewalten gratis)                      | Odem als Kosten                                                                  |
| Tierkarten kommen ins Deck                                                     | Tiere ziehen nicht ein, sondern entstehen durch Evolution; Bestände statt An/Aus |
| Schöpfungsbuch (Notizbuch)                                                     | 5 feste Geografien mit Formen und Zonenstufe statt wechselnder Zonentypen        |

## 12. Offene Punkte

- [x] Vorschläge bestätigt: Formen, Stammbaum, Odem-Formel, Harmonie-Tabelle, Kartenzwang
- [ ] Zahlenwerte per Simulation balancieren. Ziel: Ein guter Spieler erreicht Stufe 6 in Jahr 5–7, den Menschen nur selten.
- [ ] Name für „Odem“ in der englischen Version (_Breath_? _Grace_? _Divinity_?)
- [ ] Tutorial und Einstieg (erste Partie stark geführt?)
- [ ] Monetarisierung und Online-Funktionen – bewusst später ✅

## 13. Fahrplan

Siehe [Entwicklungsplan](entwicklungsplan.md).

## Anhang: Umgesetzte Auslegungen

Wo das Konzept offen oder mehrdeutig ist, hat die Umsetzung eine Auslegung gewählt. Sie sind im Code und in den
Daten mit `AUSLEGUNG:` markiert und hier gesammelt (Stand: Phase 5, Teil 1). Sie gelten, bis der Inhaber anders
entscheidet; Zahlen bleiben Platzhalter bis Phase 6.

**Kap. 3 – Ablauf**

- Reihenfolge der Bilanz: erst Wertung, dann Harmonie – auch die Runde des Kollapses bringt noch Punkte.
- Die Vorschau entsteht am Ende der Bilanz: Das Ereignis für die nächste Runde wird ausgelost und ist während
  der Eingriffe sichtbar. Es tritt in der Natur-Phase direkt nach der Jahreszeit ein.
- Ohne Schöpfungsbuch (Tests, Bots, Konsole) prüft die Engine beim Startdeck nur Größe, Kopien und bekannte
  Karten, nicht den freigeschalteten Pool.

**Kap. 4 – Welt**

- Ein Wert, den eine Geografie nicht hat (z. B. Boden im Wald), erfüllt keine Wert-Bedingung.
- Kopplungen, die Werte übertragen (Schneeschmelze): Es wandert höchstens, was die Quelle hat; was im Ziel über
  die Skala hinausgeht, geht verloren – ein voller Fluss läuft dann über (Hochwasser).
- Eine Störungsform (Hochwasser) stört ihre eigene Zone in jeder Runde, in der sie besteht. Die Nachbarn trifft
  sie über die Kopplung „Hochwasser“, nicht als Störung.
- Zonenstufe: Sie fällt pro Runde höchstens um 1, auch wenn mehrere Gründe zusammenkommen. Die Runde des
  Abstiegs zählt nicht zur Serie; die 3 Runden für den Aufstieg beginnen danach neu.
- „Urwald – alle Waldarten“ = jede Art, die in einer anderen Waldform lebt.

**Kap. 5 – Leben**

- Konkurrenz um dieselbe Nahrung wird der Reihe nach aufgelöst: Zone für Zone, darin niedrige Stufen zuerst.
- Räuber jagen auch in Nachbarzonen (Revier), weil viele Räuber in anderen Formen leben als ihre Beute.
- Satte Tiere verbrauchen ihre Nahrung nicht dauerhaft. Erst bei Knappheit fressen hungrige Tiere sie leer
  (Überweidung: Vegetation und Boden −1, bzw. Totholz −1; zu viele Räuber: Beute −1).
- Satt, aber außerhalb des Lebensraums: kein Wachstum; nur in verödeter Form schrumpft der Bestand.
- Wanderung „in eine passende Nachbarzone“ = deren Form gehört zum Lebensraum und dort ist noch Platz; bei
  Gleichstand gilt die Reihenfolge der Nachbarn in den Daten.
- Passt die Form der Ursprungszone nicht zur neuen Art (Frosch → Echse, Primat → Mensch), entsteht sie in einer
  passenden Nachbarzone („Landgang“), bei mehreren in der mit dem kleinsten Bestand.
- Das Startleben gilt als „erstmals entstanden“: Seine Gaben kommen gleich zu Beginn ins Deck.
- Stammbaum: Käfer fressen Totholz, wo es keins gibt (Flachland), Pflanzenreste (Vegetation). Der Mensch
  „frisst alles“ = Hirsch, Kleinsäuger, Fisch, dann Vegetation. „Am Fluss“ = der Fluss selbst oder eine
  Nachbarzone des Flusses. Menschen jagen alle Pflanzenfresser außer Bienen.
- Karten: _Laichzug_ „flussauf- oder flussabwärts“ = in eine Nachbarzone mit Wasser (Fluss oder Küste).
  _Jagd_ trifft Pflanzenfresser = Arten, die laut 5.3 Vegetation fressen (Käfer und Mensch zählen nicht).
  _Feuer_ = gezielte Brandrodung wie die Feuer-Schwelle des Gewitters (Störung), nur wo etwas wächst.
  _Ackerbau_ „Vegetation fest +2“ = Vegetation +2 ohne Schwelle, dazu Boden −1.

**Kap. 6 – Odem und Karten**

- Startodem = Zufluss bei Start-Harmonie: 1 + ⌊60 / 25⌋ = 3.

**Kap. 7 und 8 – Harmonie und Störungen**

- Der „Harmonie-Einbruch“ einer gezielten Störung (Kap. 8) ist ein eigener Beitrag je gestörter Zone und Runde
  (Platzhalter −2), da Kap. 7 dafür keine Zahl nennt.

**Kap. 9 – Ereignisse und Jahreszeiten**

- Seuche, Sturmflut, Heuschrecken und Meteorit stören die getroffenen Zonen (zählt für Selektionsdruck,
  Zonenstufe und Harmonie). Hitzesommer und Kälteeinbruch treffen alle Zonen mild und stören nicht.
- Die Seuche trifft die Population, die beim Eintreten am dichtesten ist; angekündigt wird sie ohne Zone.
- Meteorit, „starker Selektionsdruck“ = die Zone und alle Nachbarn gelten als gestört.
- _Stille_ „nächstes Ereignis entfällt“: Ist gerade keins angekündigt, entfällt das nächste ausgeloste.
  Verschieben (_Späherblick_) ohne angekündigtes Ereignis bleibt wirkungslos.
- Herbst „Totholz +1, Vegetation −1 im Wald“: beides nur im Wald (Totholz gibt es nur dort).

**App (Darstellung)**

- Frösche zählen bei den Figuren optisch zu „Reptil“ (Amphibien und Reptilien).
