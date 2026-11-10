/**
 * Ein Monat in fester Reihenfolge (wie `nextMonth` im Prototyp):
 *
 *  1–3. Natur: Wachstum, Sukzession, Waldbrand (nature.ts)
 *       Brennt das Feld der Herde, verliert sie Tiere.
 *  4.   Die Herde zieht (Absicht, herd.ts)
 *  5.   Fressen und Vorrat
 *  6.   Durst und Kälte
 *  7.   Wölfe: fressen Wild oder reißen, ziehen, wachsen/gründen/verhungern, einwandern (wolves.ts)
 *       Wild: fressen, wachsen/gründen, ziehen, schrumpfen, einwandern (prey.ts)
 *       Tote abziehen, Erfahrungen des Monats zählen (traits.ts)
 *  8.   Nachwuchs; Rodung am Lager (camp.ts)
 *  9.   Wildnis und Eiszeit, Sieg oder Niederlage
 *  10.  Monat weiter; zu Beginn einer Jahreszeit Karten ziehen und Merkmale anbieten
 */
import { clearing } from './camp.ts';
import { drawSeason } from './cards.ts';
import { applyDeaths, births, eat, herdInFire, moveHerd, needs } from './herd.ts';
import { runNature } from './nature.ts';
import { immigratePrey, preyLife } from './prey.ts';
import type { HerdeData } from './schema.ts';
import type { Emit, HerdeEvent, HerdeState } from './state.ts';
import { gainExperience, refreshOffer } from './traits.ts';
import { hunt, immigrate, packLife, roam } from './wolves.ts';
import { baseStageOf, RuleError, seasonOf, yearLength } from './world.ts';

export function advance(data: HerdeData, s: HerdeState, out: Emit): void {
  if (s.over) throw new RuleError('Die Partie ist vorbei.');
  // Die Ereignisse des Monats werden mitgeschrieben: aus ihnen entstehen die Erfahrungen.
  const month: HerdeEvent[] = [];
  const emit: Emit = (e) => {
    month.push(e);
    out(e);
  };
  const burned = runNature(data, s, emit);
  let dead = herdInFire(data, s, burned, emit);
  moveHerd(data, s, emit);
  dead += eat(data, s, emit);
  dead += needs(data, s, emit);
  dead += hunt(data, s, dead, emit);
  roam(data, s, emit);
  packLife(data, s, emit);
  immigrate(data, s, emit);
  preyLife(data, s, emit);
  immigratePrey(data, s, emit);
  applyDeaths(data, s, dead);
  gainExperience(data, s, month);
  births(data, s, emit);
  clearing(data, s, emit);
  wildAndIce(data, s, emit);
  s.month++;
  if (!s.over && s.month % data.monthsPerSeason === 0) {
    emit({
      type: 'seasonBegan',
      season: seasonOf(data, s).id,
      month: s.month,
      year: Math.floor(s.month / yearLength(data)) + 1,
    });
    drawSeason(data, s, emit);
    refreshOffer(data, s, emit);
  }
}

/**
 * 9. Die Wildnis wächst. Erreicht sie das Maximum, beginnt die Eiszeit (Konzept 8). Übersteht die Herde sie, ist die
 * Partie gewonnen, wenn sie auf der letzten Stufe steht und (falls die Stufe ein Lager kennt) ein Lager hat (9.2).
 * Sonst fällt die Wildnis auf `ice.wildAfter` und die Partie geht weiter – außer nach der letzten Eiszeit
 * (`ice.ages`): Dann ist sie verloren. Stirbt die Herde aus, ist sie verloren.
 */
function wildAndIce(data: HerdeData, s: HerdeState, emit: Emit): void {
  const { wild, ice } = data.params;
  s.wild += wild.perMonth;
  if (s.ice > 0) {
    s.ice--;
    if (s.ice === 0 && s.herd.size > 0) {
      s.iceAges++;
      emit({ type: 'iceAgeEnded', survivors: s.herd.size, count: s.iceAges });
      const stage = baseStageOf(data, s);
      if (stage.next === undefined && (!stage.camp || s.camp)) {
        s.over = 'won';
        emit({ type: 'gameWon', survivors: s.herd.size });
      } else if (ice.ages !== undefined && s.iceAges >= ice.ages) {
        // AUSLEGUNG: Die `ice.ages`-te Eiszeit ist die letzte Prüfung. Wer sie nicht als Mensch mit Lager übersteht,
        // hat das Zeitalter verloren – so hat jede Partie ein Ende (offene Produktfrage).
        s.over = 'lost';
        emit({ type: 'gameLost', month: s.month, cause: 'lastIce' });
      } else s.wild = ice.wildAfter;
    }
  } else if (s.wild >= wild.max) {
    s.ice = ice.months;
    emit({ type: 'iceAgeBegan', months: ice.months });
  }
  if (s.herd.size <= 0 && !s.over) {
    s.over = 'lost';
    emit({ type: 'gameLost', month: s.month, cause: 'extinct' });
  }
}
