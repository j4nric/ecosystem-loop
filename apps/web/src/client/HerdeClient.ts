import {
  campPreview,
  newGame,
  STATE_VERSION,
  step,
  validateState,
  view,
  type Action,
  type CampPreviewView,
  type HerdeData,
  type HerdeState,
  type HerdeView,
  type Pos,
} from '@being-god/herde';
import type { Strings } from '../i18n/de.ts';
import type { Locale } from '../i18n/locale.ts';
import { describeEvents } from '../logic/events.ts';
import { previewPlay, type PlayPreview } from '../logic/preview.ts';
import type { GameClient, StartupNotice, StepReport } from './GameClient.ts';
import type { LogEntry, SaveStore } from './SaveStore.ts';

export interface HerdeClientOptions {
  data: HerdeData;
  locale: Locale;
  strings: Strings;
  store: SaveStore;
  /** fester Seed für jede neue Partie (`?seed=`); sonst ein neuer je Partie */
  seed?: string;
  /** Quelle für neue Seeds (Tests) */
  randomSeed?: () => string;
}

/** So viele Einträge behält das Protokoll. */
export const LOG_MAX = 80;

const defaultSeed = () => Math.floor(Math.random() * 0xffffffff).toString(36);

/**
 * Die App spricht über diesen Client mit der Engine `@being-god/herde`: Zustand halten, `step` ausführen,
 * Ereignisse in Meldungen und Effekte übersetzen, Spielstand speichern und beim Start prüfen (`validateState`).
 */
export class HerdeClient implements GameClient {
  readonly data: HerdeData;
  readonly locale: Locale;
  private readonly t: Strings;
  private readonly store: SaveStore;
  private readonly fixedSeed: string | undefined;
  private readonly randomSeed: () => string;
  private state: HerdeState;
  private seed: string;
  private log: LogEntry[] = [];
  private cachedView: HerdeView | null = null;
  private startup: StartupNotice = null;
  private readonly listeners = new Set<() => void>();
  private readonly reportListeners = new Set<(r: StepReport) => void>();

  constructor(options: HerdeClientOptions) {
    this.data = options.data;
    this.locale = options.locale;
    this.t = options.strings;
    this.store = options.store;
    this.fixedSeed = options.seed;
    this.randomSeed = options.randomSeed ?? defaultSeed;

    const loaded = this.store.load();
    if (loaded.kind === 'game') {
      const check = validateState(this.data, loaded.game.state);
      if (check.ok) {
        this.state = loaded.game.state;
        this.seed = loaded.game.seed;
        this.log = loaded.game.log.slice(0, LOG_MAX);
        return;
      }
      console.warn(`Spielstand verworfen: ${check.reason}`);
      // Ein Stand einer früheren Engine-Version (z. B. vor der Entwicklung der Herde) bekommt einen eigenen Hinweis.
      const version = (loaded.game.state as { version?: unknown }).version;
      this.startup = typeof version === 'number' && version < STATE_VERSION ? 'outdated' : 'incompatible';
    } else if (loaded.kind === 'legacy') this.startup = 'legacy';
    else if (loaded.kind === 'broken') this.startup = 'incompatible';
    this.seed = this.fixedSeed ?? this.randomSeed();
    this.state = newGame(this.data, { seed: this.seed });
    this.persist();
  }

  getView(): HerdeView {
    this.cachedView ??= view(this.data, this.state);
    return this.cachedView;
  }

  getLog(): readonly LogEntry[] {
    return this.log;
  }

  getSeed(): string {
    return this.seed;
  }

  takeStartupNotice(): StartupNotice {
    const notice = this.startup;
    this.startup = null;
    return notice;
  }

  dispatch(action: Action): boolean {
    const before = this.state;
    let result;
    try {
      result = step(this.data, before, action);
    } catch (e) {
      console.warn('Aktion abgelehnt:', e instanceof Error ? e.message : e);
      this.emitReport({
        action: action.type,
        notices: [{ text: this.t.evRejected, tone: 'bad', toast: true }],
        fx: [],
      });
      return false;
    }
    this.state = result.state;
    this.cachedView = null;
    const packsAt = new Map<number, Pos>(before.packs.map((p) => [p.id, { x: p.x, y: p.y }]));
    const herdAt = { x: this.state.herd.x, y: this.state.herd.y };
    const width = this.getView().width;
    const grown = this.state.cells.flatMap((c, i) =>
      c.food > (before.cells[i]?.food ?? 0) ? [{ x: i % width, y: Math.floor(i / width) }] : [],
    );
    const preyAt = new Map<number, Pos>(before.prey.map((p) => [p.id, { x: p.x, y: p.y }]));
    const { notices, fx } = describeEvents(
      this.data,
      this.locale,
      this.t,
      result.events,
      herdAt,
      packsAt,
      grown,
      preyAt,
    );
    const entries = notices.map((n) => ({ month: before.month + (n.next ? 1 : 0), text: n.text, tone: n.tone }));
    this.log = [...entries.reverse(), ...this.log].slice(0, LOG_MAX);
    this.persist();
    this.emitChange();
    this.emitReport({ action: action.type, notices, fx });
    return true;
  }

  preview(action: Action): PlayPreview | null {
    return previewPlay(this.data, this.state, action);
  }

  campPreview(pos: Pos): CampPreviewView | null {
    return campPreview(this.data, this.state, pos);
  }

  newGame(): void {
    this.seed = this.fixedSeed ?? this.randomSeed();
    this.state = newGame(this.data, { seed: this.seed });
    this.log = [];
    this.cachedView = null;
    this.store.clear();
    this.persist();
    this.emitChange();
    this.emitReport({ action: 'newGame', notices: [], fx: [] });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeReports(listener: (report: StepReport) => void): () => void {
    this.reportListeners.add(listener);
    return () => this.reportListeners.delete(listener);
  }

  private persist(): void {
    this.store.save({ version: 2, seed: this.seed, savedAt: Date.now(), state: this.state, log: this.log });
  }

  private emitChange(): void {
    for (const l of this.listeners) l();
  }

  private emitReport(report: StepReport): void {
    for (const l of this.reportListeners) l(report);
  }
}
