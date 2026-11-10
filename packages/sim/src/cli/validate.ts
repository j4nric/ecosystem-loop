/** Prüft die Spieldaten (Schema + Querverweise). Exit-Code 1 bei Fehlern. */
import { DataError } from '@being-god/core';
import { loadGameData } from '@being-god/core/node';

try {
  const d = loadGameData();
  const forms = [...d.geographies.values()].reduce((n, g) => n + g.forms.length, 0);
  console.log(
    `Spieldaten ok: ${d.geographies.size} Geografien, ${forms} Formen, ${d.zones.length} Zonen, ` +
      `${d.seasons.length} Jahreszeiten, ${d.couplings.length} Kopplungen, ${d.cards.size} Karten, ${d.species.size} Arten, ` +
      `${d.scenarios.size} Szenarien, ${d.events.size} Ereignisse, ${d.meta.milestones.length} Meilensteine · Pipeline: ${d.config.pipeline.join(' → ')}`,
  );
} catch (e) {
  if (e instanceof DataError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
