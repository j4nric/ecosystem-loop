/**
 * Schrittweises Ablaufen mehrerer Monate (ohne React und DOM, daher mit Fake-Timern testbar): Jeder Monat ist
 * ein `advance`; dazwischen liegt eine Pause, damit die Herde sichtbar zieht. `useGame` bindet ihn an React.
 */

/** Pause zwischen zwei Monaten beim Abspielen (die Herde braucht etwa 0,7 s für ihren Zug). */
export const MONTH_MS = 1000;
export const MONTH_MS_REDUCED = 300;
/** Nach dem letzten Monat die Bewegung noch ausklingen lassen, dann die Knöpfe wieder freigeben. */
export const SETTLE_MS = 500;

export interface Timing {
  monthMs: number;
  settleMs: number;
}

export const timingFor = (reducedMotion: boolean): Timing =>
  reducedMotion ? { monthMs: MONTH_MS_REDUCED, settleMs: 0 } : { monthMs: MONTH_MS, settleMs: SETTLE_MS };

export interface MonthRunnerHost {
  /** einen Monat ausführen; false, wenn die Engine ablehnt */
  advance(): boolean;
  /** Partie vorbei? */
  isOver(): boolean;
  /** Läuft gerade etwas (Knöpfe sperren)? */
  setRunning(running: boolean): void;
  /** Pausen; wird je Monat neu gelesen (reduzierte Bewegung kann sich unterwegs ändern) */
  timing(): Timing;
}

export interface MonthRunner {
  /** Lässt `months` Monate nacheinander ablaufen; false, wenn schon ein Lauf aktiv ist oder months ≤ 0. */
  run(months: number): boolean;
  /** Bricht einen Lauf ab (der laufende Monat ist schon ausgeführt) und gibt die Knöpfe sofort frei. */
  stop(): void;
  /** Ist noch ein Monat geplant? */
  isRunning(): boolean;
}

export function createMonthRunner(host: MonthRunnerHost): MonthRunner {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let runId = 0;

  const stop = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    runId++;
    host.setRunning(false);
  };

  const run = (months: number): boolean => {
    if (timer !== null || months <= 0) return false;
    host.setRunning(true);
    const id = ++runId;
    let left = months;
    const tick = () => {
      const ok = host.advance();
      left--;
      if (!ok || left <= 0 || host.isOver()) {
        timer = null;
        setTimeout(() => {
          // Ein neuer Lauf oder `stop` dazwischen hat das Freigeben schon übernommen.
          if (runId === id) host.setRunning(false);
        }, host.timing().settleMs);
        return;
      }
      timer = setTimeout(tick, host.timing().monthMs);
    };
    timer = setTimeout(tick, 0);
    return true;
  };

  return { run, stop, isRunning: () => timer !== null };
}
