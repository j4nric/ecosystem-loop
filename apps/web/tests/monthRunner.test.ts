/** Schrittweises Ablaufen der Monate („Jahreszeit spielen“, „Anhalten“) mit Fake-Timern – ohne DOM. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, step, view } from '@being-god/herde';
import { loadData } from '@being-god/herde/node';
import { HerdeClient } from '../src/client/HerdeClient.ts';
import { MemorySaveStore } from '../src/client/SaveStore.ts';
import { de } from '../src/i18n/de.ts';
import {
  createMonthRunner,
  MONTH_MS,
  MONTH_MS_REDUCED,
  SETTLE_MS,
  timingFor,
  type MonthRunnerHost,
} from '../src/state/monthRunner.ts';

const data = loadData();

/** Runner über einen echten HerdeClient; zeichnet `setRunning` auf. */
function setup(opts: { reduced?: boolean; over?: () => boolean; advance?: () => boolean } = {}) {
  const client = new HerdeClient({ data, locale: 'de', strings: de, store: new MemorySaveStore(), seed: 'lauf' });
  const running: boolean[] = [];
  let reduced = opts.reduced ?? false;
  const host: MonthRunnerHost = {
    advance: opts.advance ?? (() => client.dispatch({ type: 'advance' })),
    isOver: opts.over ?? (() => client.getView().over !== null),
    setRunning: (r) => running.push(r),
    timing: () => timingFor(reduced),
  };
  const runner = createMonthRunner(host);
  return { client, runner, running, setReduced: (r: boolean) => (reduced = r) };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('Monate ablaufen lassen', () => {
  it('führt die Monate einzeln mit Pause aus und gibt die Knöpfe nach dem Ausklingen frei', () => {
    const { client, runner, running } = setup();
    expect(runner.run(3)).toBe(true);
    expect(running).toEqual([true]);
    expect(client.getView().month).toBe(0); // der erste Monat kommt erst im nächsten Takt

    vi.advanceTimersByTime(0);
    expect(client.getView().month).toBe(1);
    vi.advanceTimersByTime(MONTH_MS - 1);
    expect(client.getView().month).toBe(1);
    vi.advanceTimersByTime(1);
    expect(client.getView().month).toBe(2);
    vi.advanceTimersByTime(MONTH_MS);
    expect(client.getView().month).toBe(3);
    expect(runner.isRunning()).toBe(false);
    expect(running).toEqual([true]); // die letzte Bewegung klingt noch aus

    vi.advanceTimersByTime(SETTLE_MS);
    expect(running).toEqual([true, false]);
    vi.runAllTimers();
    expect(client.getView().month).toBe(3);
  });

  it('entspricht Monat für Monat dem Engine-Ablauf', () => {
    const { client, runner } = setup();
    runner.run(3);
    vi.runAllTimers();
    let s = newGame(data, { seed: 'lauf' });
    for (let i = 0; i < 3; i++) s = step(data, s, { type: 'advance' }).state;
    expect(client.getView()).toEqual(view(data, s));
  });

  it('Anhalten bricht nach dem laufenden Monat ab und gibt sofort frei', () => {
    const { client, runner, running } = setup();
    runner.run(3);
    vi.advanceTimersByTime(0);
    expect(client.getView().month).toBe(1);
    runner.stop();
    expect(running).toEqual([true, false]);
    expect(runner.isRunning()).toBe(false);
    vi.runAllTimers();
    expect(client.getView().month).toBe(1);
    expect(running).toEqual([true, false]);
  });

  it('startet keinen zweiten Lauf parallel und nichts bei 0 Monaten', () => {
    const { client, runner, running } = setup();
    expect(runner.run(0)).toBe(false);
    expect(running).toEqual([]);
    expect(runner.run(2)).toBe(true);
    expect(runner.run(5)).toBe(false);
    vi.runAllTimers();
    expect(client.getView().month).toBe(2);
    expect(running).toEqual([true, false]);
  });

  it('endet früher, wenn die Partie vorbei ist oder die Engine ablehnt', () => {
    let months = 0;
    const over = setup({ over: () => months >= 2, advance: () => (++months, true) });
    over.runner.run(10);
    vi.runAllTimers();
    expect(months).toBe(2);
    expect(over.running).toEqual([true, false]);

    let calls = 0;
    const rejected = setup({ advance: () => (++calls, false) });
    rejected.runner.run(10);
    vi.runAllTimers();
    expect(calls).toBe(1);
    expect(rejected.running).toEqual([true, false]);
  });

  it('reduzierte Bewegung: kürzere Pause, kein Ausklingen; Wechsel wirkt ab dem nächsten Monat', () => {
    const { client, runner, running, setReduced } = setup({ reduced: true });
    runner.run(3);
    vi.advanceTimersByTime(0);
    vi.advanceTimersByTime(MONTH_MS_REDUCED);
    expect(client.getView().month).toBe(2);
    setReduced(false);
    vi.advanceTimersByTime(MONTH_MS_REDUCED);
    expect(client.getView().month).toBe(3);
    vi.advanceTimersByTime(0);
    expect(running).toEqual([true]); // jetzt mit Ausklingen
    vi.advanceTimersByTime(SETTLE_MS);
    expect(running).toEqual([true, false]);
  });

  it('ein neuer Lauf während des Ausklingens wird nicht vom alten freigegeben', () => {
    const { runner, running } = setup();
    runner.run(1);
    vi.advanceTimersByTime(0);
    expect(runner.isRunning()).toBe(false);
    runner.run(2);
    vi.advanceTimersByTime(SETTLE_MS);
    expect(running).toEqual([true, true]); // das Ausklingen des ersten Laufs gibt nicht frei
    vi.runAllTimers();
    expect(running).toEqual([true, true, false]);
  });
});
