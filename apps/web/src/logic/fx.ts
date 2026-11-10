import type { ZoneView } from '@core/api';
import type { Notice } from '../client/GameClient.ts';
import { towardOf, type Toward } from './ideal.ts';

/**
 * Reine Aufbereitung der Meldungen eines Schritts für die Effekt-Schicht (ohne DOM): je Zone die
 * aufsteigenden Zeilen – Wertänderungen mit Richtung zum Zielbereich, Formwechsel und „+n weitere“.
 */

export type FxLine = { zone: string; cause: 'card' | 'nature'; index: number; tone: Toward } & (
  { kind: 'stat'; delta: number; statName: string } | { kind: 'form'; name: string } | { kind: 'more'; count: number }
);

type FxLineDraft = FxLine extends infer L ? (L extends FxLine ? Omit<L, 'index'> : never) : never;

/** Höchstens so viele Wertzeilen je Zone nach dem Rundenende (Rest als „+n“). */
export const NATURE_LINES = 2;

export function fxLines(notices: readonly Notice[], zones: readonly ZoneView[]): FxLine[] {
  const perZone = new Map<string, FxLine[]>();
  const push = (zone: string, line: FxLineDraft) => {
    const list = perZone.get(zone) ?? [];
    list.push({ ...line, index: list.length } as FxLine);
    perZone.set(zone, list);
  };
  const isNature =
    notices.some((n) => n.type === 'statShift' && n.cause === 'nature') || notices.some((n) => n.type === 'round');
  for (const n of notices) {
    if (n.type === 'form' && n.zoneId) {
      const tone: Toward = n.kind === 'ideal' ? 'better' : n.kind === 'normal' ? 'neutral' : 'worse';
      push(n.zoneId, { zone: n.zoneId, cause: isNature ? 'nature' : 'card', tone, kind: 'form', name: n.to });
    }
  }
  for (const n of notices) {
    if (n.type !== 'statShift') continue;
    const zone = zones.find((z) => z.id === n.zone);
    const changes = n.changes.filter((c) => c.to !== c.from);
    const limit = n.cause === 'nature' ? NATURE_LINES : changes.length;
    changes.slice(0, limit).forEach((c) => {
      const target = zone?.stats.find((s) => s.id === c.stat)?.target;
      push(n.zone, {
        zone: n.zone,
        cause: n.cause,
        tone: towardOf(c.from, c.to, target),
        kind: 'stat',
        delta: c.to - c.from,
        statName: c.statName,
      });
    });
    if (changes.length > limit)
      push(n.zone, { zone: n.zone, cause: n.cause, tone: 'neutral', kind: 'more', count: changes.length - limit });
  }
  return [...perZone.values()].flat();
}
