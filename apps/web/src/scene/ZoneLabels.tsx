import type { ZoneView } from '@core/api';
import type { SceneRegistry } from './registry.ts';
import type { Toward } from '../logic/ideal.ts';
import { t } from '../i18n/index.ts';

const TINT_ICON: Record<Toward, string> = { better: '▲', worse: '▼', neutral: '=' };

interface Props {
  zones: ZoneView[];
  registry: SceneRegistry;
  selectedZone: string | null;
  validTargets: Set<string> | null;
  tints: ReadonlyMap<string, Toward> | null;
}

/**
 * Zonen-Beschriftungen als eine gewöhnliche DOM-Schicht über der Szene. Die Position setzt `LabelProjector`
 * jedes Frame direkt am Element (kein React-Rendern pro Frame).
 *
 * Ersetzt drei `<Html>` (Fehler „Berge-Beschriftung fehlt“): `<Html>` legt je Beschriftung eine eigene
 * React-Wurzel an und baut sie neu an, sobald sich das Ereignis-Ziel der Szene nach dem Start ändert. Bei der
 * ersten Kachel (Berge) blieb der Container danach leer – reproduzierbar auch ohne StrictMode.
 */
export function ZoneLabels({ zones, registry, selectedZone, validTargets, tints }: Props) {
  return (
    <div className="zone-labels" aria-hidden>
      {zones.map((zone) => {
        const dimmed = validTargets !== null && !validTargets.has(zone.id);
        const tint = !dimmed && validTargets !== null ? tints?.get(zone.id) : undefined;
        return (
          <div
            key={zone.id}
            className="zone-label-pos"
            data-zone={zone.id}
            ref={(el) => registry.register(registry.labels, zone.id, el)}
          >
            <div
              className={`zone-label${zone.id === selectedZone ? ' is-selected' : ''}${dimmed ? ' is-dimmed' : ''}${tint ? ` is-${tint}` : ''}`}
            >
              {zone.warnings.map((w) => (
                <span key={`${w.card}-${w.trigger}`} className="zone-label__warn" title={w.name}>
                  {w.icon}
                </span>
              ))}
              <span>{zone.geographyName}</span>
              {tint && (
                <span className="zone-label__tint">
                  {TINT_ICON[tint]} {t.towardShort[tint]}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
