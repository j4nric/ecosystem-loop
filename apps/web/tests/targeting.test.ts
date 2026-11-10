/** Zielwahl als reine Zustandsübergänge: offene Slots, Zonen-/Chip-Wahl, Neustart, Ziehen. */
import { describe, expect, it } from 'vitest';
import type { CardView, ZoneView } from '@core/api';
import {
  canDrag,
  chipOptionsFor,
  chosenWithout,
  dropZone,
  editSlotOf,
  isSupportedSlot,
  movedBeyond,
  openSlot,
  pickChipTargets,
  pickZoneTargets,
  startTargets,
} from '../src/logic/targeting.ts';

const card = (slots: CardView['slots'], playable = true): CardView => ({
  uid: 7,
  card: 'x',
  name: 'X',
  category: 'gift',
  cost: 1,
  text: 'Text',
  short: 'Kurz',
  playable,
  slots,
});
const zoneSlot = { id: 'zone', kind: 'zone', label: 'Zone' };
const neighborSlot = { id: 'to', kind: 'neighbor', label: 'Nachbar', of: 'zone' };
const speciesSlot = { id: 'prey', kind: 'species', label: 'Beute', of: 'zone' };
const choiceSlot = {
  id: 'mode',
  kind: 'choice',
  label: 'Wahl',
  options: [
    { id: 'cancel', label: 'Abwenden' },
    { id: 'delay', label: 'Verschieben' },
  ],
};

describe('Slots', () => {
  const c = card([zoneSlot, neighborSlot]);
  it('findet den nächsten offenen Slot und bearbeitet nach Abschluss den letzten', () => {
    expect(openSlot(c, {})?.id).toBe('zone');
    expect(openSlot(c, { zone: 'a' })?.id).toBe('to');
    expect(openSlot(c, { zone: 'a', to: 'b' })).toBeUndefined();
    expect(editSlotOf(c, { zone: 'a', to: 'b' })?.id).toBe('to');
    expect(chosenWithout({ zone: 'a', to: 'b' }, neighborSlot)).toEqual({ zone: 'a' });
    expect(chosenWithout({ zone: 'a' }, undefined)).toEqual({ zone: 'a' });
  });

  it('kennt die unterstützten Slot-Arten', () => {
    expect(['zone', 'neighbor', 'species', 'choice'].every(isSupportedSlot)).toBe(true);
    expect(isSupportedSlot('card')).toBe(false);
  });
});

describe('Zielwahl', () => {
  const c = card([zoneSlot, neighborSlot]);

  it('beginnt auf einer gezogenen Zone nur, wenn die Engine sie erlaubt', () => {
    expect(startTargets(c, ['a', 'b'], 'a')).toEqual({ zone: 'a' });
    expect(startTargets(c, ['a', 'b'], 'z')).toBeNull();
    expect(startTargets(card([zoneSlot], false), ['a'], 'a')).toBeNull();
    expect(startTargets(card([choiceSlot]), ['a'], 'a')).toBeNull();
  });

  it('trägt eine gültige Zone in den offenen Slot ein', () => {
    expect(pickZoneTargets(c, {}, ['a'], new Set(), 'a')).toEqual({ zone: 'a' });
    expect(pickZoneTargets(c, { zone: 'a' }, ['b'], new Set(['a', 'c']), 'b')).toEqual({ zone: 'a', to: 'b' });
  });

  it('ersetzt nach Abschluss die Wahl des letzten Slots (Vorschauen vergleichen)', () => {
    expect(pickZoneTargets(c, { zone: 'a', to: 'b' }, ['b', 'd'], new Set(['a']), 'd')).toEqual({
      zone: 'a',
      to: 'd',
    });
  });

  it('beginnt mit einer für den ersten Slot gültigen Zone neu, sonst nichts', () => {
    expect(pickZoneTargets(c, { zone: 'a' }, ['b'], new Set(['a', 'c']), 'c')).toEqual({ zone: 'c' });
    expect(pickZoneTargets(c, { zone: 'a' }, ['b'], new Set(['a', 'c']), 'x')).toBeNull();
  });

  it('wählt Chips nur für Chip-Slots und nur gültige Optionen', () => {
    const hunt = card([zoneSlot, speciesSlot]);
    expect(pickChipTargets(hunt, { zone: 'a' }, ['deer'], 'deer')).toEqual({ zone: 'a', prey: 'deer' });
    expect(pickChipTargets(hunt, { zone: 'a' }, ['deer'], 'wolf')).toBeNull();
    expect(pickChipTargets(hunt, {}, ['deer'], 'deer')).toBeNull(); // offener Slot ist eine Zone
    expect(pickChipTargets(hunt, { zone: 'a', prey: 'deer' }, ['deer', 'wolf'], 'wolf')).toEqual({
      zone: 'a',
      prey: 'wolf',
    });
  });
});

describe('Chips', () => {
  const zones = [
    { id: 'a', populations: [{ species: 'deer', name: 'Hirsch', tier: 5, count: 3 }] },
    { id: 'b', populations: [{ species: 'wolf', name: 'Wolf', tier: 6, count: 1 }] },
  ] as unknown as ZoneView[];

  it('zeigt bei Art-Slots Namen und Bestand der gewählten Zone, sonst den Namen vom Client', () => {
    const opts = chipOptionsFor(speciesSlot, ['deer', 'bear'], { zone: 'a' }, zones, (id) => `#${id}`);
    expect(opts).toEqual([
      { id: 'deer', name: 'Hirsch', count: 3 },
      { id: 'bear', name: '#bear', count: null },
    ]);
  });

  it('zeigt bei Wahl-Slots die lokalisierten Beschriftungen', () => {
    expect(chipOptionsFor(choiceSlot, ['delay', 'nope'], {}, zones, (id) => id)).toEqual([
      { id: 'delay', name: 'Verschieben', count: null },
      { id: 'nope', name: 'nope', count: null },
    ]);
    expect(chipOptionsFor(zoneSlot, ['a'], {}, zones, (id) => id)).toEqual([]);
    expect(chipOptionsFor(undefined, ['a'], {}, zones, (id) => id)).toEqual([]);
  });
});

describe('Ziehen', () => {
  it('zieht nur spielbare Karten mit Zonenziel', () => {
    expect(canDrag(card([zoneSlot]))).toBe(true);
    expect(canDrag(card([zoneSlot], false))).toBe(false);
    expect(canDrag(card([choiceSlot]))).toBe(false);
    expect(canDrag(card([]))).toBe(false);
  });

  it('unterscheidet Antippen und Ziehen an der Schwelle', () => {
    expect(movedBeyond({ x: 0, y: 0 }, { x: 5, y: 5 })).toBe(false);
    expect(movedBeyond({ x: 0, y: 0 }, { x: 12, y: 0 })).toBe(true);
    expect(movedBeyond({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
  });

  it('lässt nur auf gültigen Zonen fallen', () => {
    expect(dropZone('a', ['a', 'b'])).toBe('a');
    expect(dropZone('c', ['a', 'b'])).toBeNull();
    expect(dropZone(null, ['a'])).toBeNull();
  });
});
