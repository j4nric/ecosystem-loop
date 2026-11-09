/** Prüft die Spieldaten und gibt eine Übersicht aus:  npm run validate */
import { DataError } from '../core/data.ts';
import { loadGameData } from '../node/load.ts';
import { describeCard, describeCondition } from './text.ts';

try {
  const d = loadGameData();
  console.log(`✓ Spieldaten gültig: ${d.cards.size} Karten, ${d.animals.size} Tiere, ${d.mapZones.length} Zonen, ${d.scenarios.size} Szenarien\n`);
  console.log('Karten:');
  for (const c of d.cards.values()) console.log(`  ${c.name.de.padEnd(13)} [${c.source}] ${describeCard(d, c)}`);
  console.log('\nTiere:');
  for (const a of d.animals.values())
    console.log(`  S${a.tier} ${a.name.de.padEnd(14)} ${a.conditions.map((c) => describeCondition(d, c)).join(', ')}`);
} catch (e) {
  if (e instanceof DataError) {
    console.error(`✗ ${e.message}`);
    process.exit(1);
  }
  throw e;
}
