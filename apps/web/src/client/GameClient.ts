import type { Action, CampPreviewView, HerdeData, HerdeView, Pos } from '@being-god/herde';
import type { Locale } from '../i18n/locale.ts';
import type { Fx, Notice } from '../logic/events.ts';
import type { PlayPreview } from '../logic/preview.ts';
import type { LogEntry } from './SaveStore.ts';

export type { Fx, Notice, PlayPreview, LogEntry };

/** Was ein Schritt gebracht hat: Meldungen (Toasts, Protokoll) und Effekte für die Szene. */
export interface StepReport {
  action: Action['type'] | 'newGame';
  notices: Notice[];
  fx: Fx[];
}

/** Hinweis beim Start: ein alter (Konzept 0.4), ein älterer (frühere STATE_VERSION) oder unpassender Stand wurde verworfen. */
export type StartupNotice = 'legacy' | 'incompatible' | 'outdated' | null;

/**
 * Adapter zwischen App und Engine. Die App kennt nur dieses Interface:
 * Zustand lesen (`getView`), Aktionen schicken (`dispatch`), auf Änderungen hören (`subscribe`).
 */
export interface GameClient {
  /** Spieldaten (Namen, Symbole, Parameter) für die Anzeige */
  readonly data: HerdeData;
  readonly locale: Locale;
  /** Lesemodell der Engine; dasselbe Objekt, bis sich der Zustand ändert. */
  getView(): HerdeView;
  /** Geschehen-Protokoll, neueste zuerst */
  getLog(): readonly LogEntry[];
  /** Seed der laufenden Partie */
  getSeed(): string;
  /** Führt eine Aktion aus; false, wenn die Engine sie ablehnt (Zustand unverändert, Meldung „geht nicht“). */
  dispatch(action: Action): boolean;
  /** Vorschau eines Kartenzugs ohne Ausführung; null, wenn er nicht möglich ist. */
  preview(action: Action): PlayPreview | null;
  /** Vorschau eines Lagers an einem Feld (Engine `campPreview`); null, wenn die Stufe kein Lager kennt. */
  campPreview(pos: Pos): CampPreviewView | null;
  /** Meldet jede neue View; gibt eine Abmelde-Funktion zurück. */
  subscribe(listener: () => void): () => void;
  /** Meldungen und Effekte je Schritt; gibt eine Abmelde-Funktion zurück. */
  subscribeReports(listener: (report: StepReport) => void): () => void;
  /** Neue Partie (neuer Seed, außer er ist fest vorgegeben); setzt den Spielstand zurück. */
  newGame(): void;
  /** Wurde beim Start ein alter Spielstand verworfen? (einmalig, danach null) */
  takeStartupNotice(): StartupNotice;
}
