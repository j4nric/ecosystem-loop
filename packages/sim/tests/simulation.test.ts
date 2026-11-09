import { describe, expect, it } from 'vitest';
import { loadGameData } from '@being-god/core/node';
import { simulate } from '../src/campaign.ts';

const data = loadGameData();

describe('Simulation', () => {
  it('läuft deterministisch mit beiden Bots', () => {
    for (const bot of ['random', 'greedy'] as const) {
      const opts = { bot, runs: 3, expeditions: 2, seed: 's', scenario: 'random' };
      const a = simulate(data, opts);
      expect(a.perExpedition).toHaveLength(2);
      expect(simulate(data, opts)).toEqual(a);
    }
  });
});
