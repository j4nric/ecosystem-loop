/** Prüft die Spieldaten der Herde (Schema + Querverweise). Exit-Code 1 bei Fehlern. */
import { DataError } from '../../index.ts';
import { loadData } from '../load.ts';

try {
  const d = loadData();
  console.log(
    `Spieldaten (herde) ok: ${d.landscapes.size} Landschaften, ${d.cards.size} Karten, ${d.seasons.length} Jahreszeiten, ` +
      `${d.stages.size} Stufe(n), ${d.islands.size} Insel(n)`,
  );
} catch (e) {
  if (e instanceof DataError) {
    console.error(e.message);
    process.exit(1);
  }
  throw e;
}
