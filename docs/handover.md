# Handover: Urwald-Ökosystem-Spiel

Nov 9, 2026 · @Jan

## Zweck und Ausgangspunkt

Dieses Dokument übergibt ein Spielkonzept, das in einer Chat-Session entwickelt wurde, an eine neue Claude-Code-Session. Es ist ein Design-Stand, kein Code und keine Technologieentscheidung.

Ausgangspunkt war Loop Hero: Der Held läuft autonom eine Schleife, der Spieler legt Kacheln, die die Welt gefährlicher machen und zugleich besseren Loot bringen. Der Tradeoff „schwerer machen, um mehr zu bekommen“ gefiel, Kacheln, Loop und Loot sollten aber nicht übernommen werden.

Der Weg dorthin in drei Schritten: Erst wurde das Muster abstrahiert (indirekte Kontrolle, selbstgewählte Reibung, Ausstiegsmoment), dann in andere Beziehungen übersetzt (Lehrer/Schüler, Autor/Figur, Gärtner/Garten, Trainer/Athlet), dann der Garten zum Urwald mit anpassungsfähigem Ökosystem weiterentwickelt. Das Thema ist bewusst noch nicht festgelegt, der Urwald ist Arbeitshypothese.

## Kern-Muster

Das Spiel beruht auf drei Prinzipien, die jede Mechanik erfüllen muss:

1. **Indirekte Kontrolle.** Der Spieler steuert nie das Lebewesen, nur dessen Umstände. Er setzt kein Tier und keine Pflanze, er schafft Bedingungen.
2. **Selbstgewählte Reibung.** Jede Handlung, die etwas einbringt, destabilisiert gleichzeitig Bestehendes. Stillstand ist keine Option, der Spieler wird zum Handeln gezwungen.
3. **Ausstiegsmoment.** Der Spieler entscheidet, wann die Runde endet, und riskiert mit jedem weiteren Zug, was er bereits erreicht hat.

Der Spieler ist Autor des Problems, nicht dessen Löser. Das Problem muss schwer genug sein, um etwas Wertvolles hervorzubringen, aber nicht so schwer, dass es das System zerbricht.

## Spielmechanik

Eine Runde heißt Expedition. Der Spieler formt einen Urwald über mehrere Züge, bis er die Expedition beendet und das Ökosystem dokumentiert wird.

**Spielfeld.** Der Urwald besteht aus fünf bis sechs Zonen, die als Nachbarn verbunden sind: Ufer, Lichtung, Dickicht, Kronendach, Sumpf. Keine Kacheln, keine Schleife.

**Zustandswerte.** Jede Zone hat vier sichtbare Werte von 0 bis 5: Licht, Feuchte, Dichte, Totholz. Alles im Spiel wirkt über diese vier Werte. Zonen können ihren Typ wechseln, wenn Werte Schwellen über- oder unterschreiten (Sumpf wird zur Lichtung bei Feuchte 0).

**Karten.** Der Spieler hält drei bis vier Karten und muss jeden Zug eine spielen (Kartenzwang). Karten sind Eingriffe, keine Objekte: Gewitter, Sturm, Dürre, Samenflug. Sie verschieben Zustandswerte einer Zone.

**Tiere.** Jedes Tier hat einen Steckbrief aus zwei bis sechs Bedingungen (Zustandswerte, vorhandene andere Tiere, abwesende Fressfeinde, Ruhe). Sind sie erfüllt, zieht es von selbst ein; sind sie verletzt, zieht es aus. Ein eingezogenes Tier frisst etwas aus dem System und speist seine eigene Karte in den Nachziehstapel.

**Störung als Werkzeug.** Feuer, Flut und Sturm zerstören Bestehendes, öffnen aber Nischen. Manche Tiere kommen nur nach einer Störung. Der Spieler muss kaputtmachen, was er aufgebaut hat.

**Ausstiegsmoment.** Der Spieler ruft die Expedition ab, wenn er will. Gewertet wird, was in diesem Moment da ist. Länger warten kann ein seltenes Tier bringen oder eine Trockenzeit, die das Gefüge zerreißt.

## Kartendesign

Karten haben feste Effekte, die Variabilität sitzt in der Zone. Keine Prozentchancen auf dem Karteneffekt: Der Spieler hat schon zwei Schichten Kontrollverlust (Tiere steuern sich selbst, Kartenzwang), eine dritte würde Lernen verhindern.

Jede Karte verschiebt nur die vier universellen Zustandswerte und funktioniert damit auf jeder Zone. Interessant wird sie durch eine Schwelle, die jede Zone anders erreicht. Dieselbe Gewitterkarte ist im Sumpf eine Flut, im Dickicht ein Regen und auf der trockenen Lichtung ein Brand.

| Karte | Grundeffekt | Schwelle | Folge bei Schwelle |
| --- | --- | --- | --- |
| Gewitter | Feuchte +2 | Feuchte ≤ 1 vor dem Spielen | Feuer: Dichte auf 0, Totholz +3 |
| Sturm | Dichte −1, Totholz +1 | Dichte ≥ 4 | Baumsturz: Nachbarzone Licht +2 |
| Dürre | Feuchte −2 | Feuchte erreicht 0 | Sumpf wird zur Lichtung |
| Samenflug | Dichte +1 | Licht ≥ 3 | Blütenwiese, zieht Insekten an |

Zufall bleibt an zwei Stellen erlaubt: beim Ziehen der Karten und bei der Wahl, welches von mehreren Tieren einzieht, wenn die Bedingungen mehrerer zugleich erfüllt sind. Unsicherheit wird als sichtbare Warnung gezeigt (Flammensymbol bei Feuchte ≤ 1), nie als versteckte Prozentzahl.

Offen: Die Schwelle für Feuer wurde im Gespräch als „Trockenheit ≥ 3“ formuliert; da Trockenheit kein eigener Wert ist, ist sie hier als „Feuchte ≤ 1“ übersetzt. Zu prüfen.

## Freischaltbaum

Zehn Tiere in vier Stufen. Jede Stufe setzt Tiere oder Karten der vorigen voraus, sodass sich die Kette über drei bis vier Expeditionen zieht. Die Stufe-4-Tiere sind die Ziele.

| Tier | Stufe | Bedingungen | Bringt Karte | Frisst |
| --- | --- | --- | --- | --- |
| Käfer | 1 | Totholz ≥ 2 | Zersetzung: Totholz −1, Feuchte +1 | – |
| Schmetterling | 1 | Licht ≥ 3, Dichte ≤ 2 | Bestäubung: Dichte +1 auf Nachbarzone | – |
| Frosch | 1 | Feuchte ≥ 4 | Nebel: Feuchte +1 auf alle Nachbarzonen | – |
| Specht | 2 | Käfer vorhanden, Dichte ≥ 3 | Baumhöhle: Zone wird Nistplatz | Käfer |
| Kolibri | 2 | Schmetterling vorhanden, Nachbarzone Dichte ≥ 3 | Fernflug: Dichte +1 auf beliebige Zone | – |
| Schlange | 2 | Frosch vorhanden, Licht ≥ 2 | Scheu: ein Tier zieht in Nachbarzone um | Frosch |
| Wasserschwein | 3 | Feuchte ≥ 3, Licht ≥ 3, Dichte ≤ 2, keine Schlange | Trampelpfad: verbindet zwei Zonen dauerhaft | – |
| Papagei | 3 | Baumhöhle vorhanden, Dichte ≥ 4, Bestäubung 2× gespielt | Fruchtregen: Samenflug plus Nahrung für Nachbarzone | – |
| Jaguar | 4 | Wasserschwein vorhanden, Nachbarzone Dichte ≥ 4, 3 Züge keine Störung | Kadaver: lockt Aasfresser | Wasserschwein |
| Harpyie | 4 | Papagei vorhanden, Dichte 5, Baumhöhle | Horst: Zone brennt nie mehr | Papagei |

Die Reibung steckt in der Kette: Specht braucht Käfer und frisst sie. Die Schlange braucht Frösche, die dir Nebel liefern. Das Wasserschwein braucht offene Uferwiese, der Jaguar dichtes Dickicht daneben und drei ruhige Züge, während der Kartenzwang dich zu Störungen drängt. Die Harpyie frisst den Papagei, der Fruchtregen liefert.

Eine zweite Ebene (Aasfresser, Affen, Faultier) ist angedacht, aber nicht ausgearbeitet.

## Progression und Wiederspielwert

Zweischichtig wie Loop Hero: ein kleines Startdeck von außen, der Großteil entsteht in der Session.

**Startdeck.** Vor der Expedition stellt der Spieler aus freigeschalteten Karten ein Deck von acht bis zehn Karten zusammen: die Grundkräfte plus erspielte Tierkarten. Das Deck ist klein, damit es früh leer ist und der Spieler auf das angewiesen ist, was ihm die Tiere geben.

**Sessionkarten.** Eingezogene Tiere speisen ihre Karten in den Stapel. Diese Karten gehören zur Session und verschwinden danach.

**Feldnotizen.** Jedes erstmals angelockte Tier wird dauerhaft ins Notizbuch eingetragen. Das schaltet zwei Dinge frei: Seine Bedingungen werden sichtbar statt erraten, und seine Karte wandert in den Pool für künftige Startdecks. Progression bedeutet damit früheren Zugang, nicht mehr Macht.

**Beispielverlauf.** Expedition 1 erreicht Stufe 1 und 2, danach sind Zersetzung und Baumhöhle im Pool. Expedition 2 startet mit Baumhöhle, der Papagei wird früh möglich, Fruchtregen kommt in den Pool. Expedition 3 oder 4 ist die erste, in der Jaguar oder Harpyie erreichbar sind.

**Drei Quellen für Wiederspielwert:**

- Der Startzustand des Waldes variiert: ausgetrocknet, überflutet, abgebrannt.
- Jede Expedition hat ein vorher sichtbares Ziel („Dokumentiere drei Vogelarten“), das lenkt, welches Deck sinnvoll ist.
- Das Notizbuch ist nie voll; seltene Tiere brauchen Karten seltener Tiere.

**Optional: Mitbringsel.** Ein bis zwei Samen oder Eier pro Expedition, die der Spieler direkt in eine Zone legen darf. Wäre die einzige direkte Setzung im Spiel und dadurch besonders wertvoll. Noch nicht entschieden.

## Entscheidungen und Offenes

**Entschieden:**

- Keine Kacheln, keine Schleife; stattdessen fünf bis sechs Zonen mit vier Zustandswerten.
- Kartenzwang statt frei einsetzbarer Werkzeuge.
- Feste Karteneffekte mit sichtbaren Schwellen; Zufall nur beim Ziehen und bei konkurrierenden Tieren.
- Startdeck von außen plus Sessionkarten aus Tieren; Freischaltung über Feldnotizen.
- Thema vorerst ausgeklammert, Urwald ist Arbeitshypothese.

**Bewusst offen:**

- [ ] Ausrottungsregel: Wann verlässt eine Beute die Zone, wenn ihr Fresser bleibt? Vorschlag aus dem Gespräch: nach drei Zügen mit dem Fresser, sofern die Bedingungen der Beute nicht mehr als „üppig“ zählen.
- [ ] Dauerhafte Setzungen: Der Harpyien-Horst ist die einzige Karte, die eine Zone dauerhaft verändert. Soll das die einzige bleiben, damit der Wald nicht zu stabil wird?
- [ ] Mitbringsel: einbauen oder weglassen.
- [ ] Zonentyp-Wechsel: Welche Schwellen kippen welche Zone in welche andere? Nur Sumpf→Lichtung ist bisher definiert.
- [ ] Rundenstruktur: Wie viele Züge hat eine Expedition, was löst die Trockenzeit aus, wie wird gewertet?
- [ ] Wie lange braucht ein Tier zum Einziehen, nachdem seine Bedingungen erfüllt sind: sofort oder mit Verzögerung?
- [ ] Plattform, Engine und Darstellung sind nicht besprochen.

## Vorschlag für die ersten Schritte

Bevor Grafik oder Engine eine Rolle spielen, sollte die Simulation beweisen, dass die Entscheidungen tragen. Empfohlene Reihenfolge:

1. Mit dem Nutzer Plattform und Sprache klären; für den ersten Prototyp genügt eine Konsolen- oder Textsimulation.
2. Datenmodell anlegen: Zone (vier Werte, Typ, Nachbarn, Bewohner), Karte (Grundeffekt, Schwelle, Folge), Tier (Bedingungen, Karte, Beute), Expedition (Zug, Hand, Stapel, Notizbuch).
3. Die vier Grundkarten und zehn Tiere aus diesem Dokument als Daten erfassen, nicht hart codieren, damit Balancing ohne Codeänderung geht.
4. Zug-Schleife bauen: Karte spielen, Werte verschieben, Schwellen prüfen, Tiere ein- und ausziehen lassen, Fressen anwenden, Tierkarten in den Stapel legen.
5. Eine Expedition Zug für Zug durchspielen und prüfen, ob Stufe 2 in einer ersten Expedition erreichbar ist und Stufe 4 in der dritten oder vierten.
6. Die offenen Fragen aus dem vorigen Abschnitt anhand der Simulation entscheiden, beginnend mit der Ausrottungsregel.

Maßstab für den Prototyp: Fühlt sich jede Entscheidung wie „jetzt oder noch warten“ und „wo setze ich die Störung“ an? Wenn der Spieler nur Werte hochdreht, ohne etwas zu riskieren, fehlt die Reibung und die Steckbriefe müssen widersprüchlicher werden.
