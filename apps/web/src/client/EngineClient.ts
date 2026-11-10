import {
  RuleError,
  cardPool,
  cardShort,
  cardText,
  describeEvent,
  legalPlays,
  newBook,
  newGame,
  preview,
  recordGame,
  slotOptions,
  step,
  validateDeck,
  validateState,
  view,
  type CreationBook,
  type GameData,
  type GameEvent,
  type GameState,
} from '@being-god/core';
import type { Action, DeckIssue, GameView, Locale, Targets } from '@core/api';
import type { DeckSetup } from '../logic/deck.ts';
import type { BookView, GameClient, GameResult, Notice, PreviewView } from './GameClient.ts';
import { MemoryBookStore, type BookStore, type SaveStore } from './SaveStore.ts';

export interface EngineClientOptions {
  data: GameData;
  locale: Locale;
  store: SaveStore;
  /** Ablage des Schöpfungsbuchs; Standard: flüchtig. */
  books?: BookStore;
  /** Fester Seed für jede neue Partie (Tests, `?seed=`); sonst zufällig. */
  seed?: string;
  /** Gemerktes Startdeck für eine frische Partie beim Start; ungültig ⇒ Standarddeck. */
  deck?: readonly string[] | null;
}

/** Echte Engine im Browser: Zustand in der App, Regeln ausschließlich über die Fassade von `@being-god/core`. */
export class EngineClient implements GameClient {
  readonly isMock = false;
  private readonly data: GameData;
  private readonly locale: Locale;
  private readonly store: SaveStore;
  private readonly books: BookStore;
  private book: CreationBook;
  private result: GameResult | null = null;
  private readonly fixedSeed: string | undefined;
  private seed: string;
  private state: GameState;
  private view: GameView;
  private readonly listeners = new Set<() => void>();
  private readonly noticeListeners = new Set<(notices: Notice[]) => void>();

  constructor(options: EngineClientOptions) {
    this.data = options.data;
    this.locale = options.locale;
    this.store = options.store;
    this.books = options.books ?? new MemoryBookStore();
    this.book = this.books.load() ?? newBook();
    this.fixedSeed = options.seed;
    const resumed = this.resume();
    if (resumed) {
      this.seed = resumed.seed;
      this.state = resumed.state;
      this.view = resumed.view;
    } else {
      this.seed = this.freshSeed();
      this.state = this.startState(options.deck);
      this.view = view(this.data, this.state, this.locale);
      this.persist();
    }
  }

  getView(): GameView {
    return this.view;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeNotices(listener: (notices: Notice[]) => void): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  dispatch(action: Action): void {
    if (this.state.phase !== 'play') return;
    let result: ReturnType<typeof step>;
    try {
      result = step(this.data, this.state, action);
    } catch (error) {
      // Ungültige Aktion (z. B. veraltete Ansicht): Zustand bleibt, die Oberfläche meldet „Zug nicht möglich“.
      // Wirft die Engine bei einem laut `legalPlays` gültigen Zug oder mit einem unerwarteten Fehler, passt der
      // Spielstand nicht zu den Daten – dann bietet die Oberfläche eine neue Partie an.
      const check = validateState(this.data, this.state);
      const incompatible = !(error instanceof RuleError) || !check.ok || this.isLegal(action);
      if (!check.ok) console.warn('Spielstand passt nicht zu den Spieldaten:', check.reason, error);
      else console.warn(incompatible ? 'Engine-Fehler bei gültigem Zug:' : 'Aktion abgelehnt:', error);
      this.emitNotices([{ type: incompatible ? 'incompatible' : 'rejected' }]);
      return;
    }
    this.state = result.state;
    // Partie-Ende meldet die Engine mit `gameOver` (genau einmal, im Kollaps-Schritt) ⇒ ins Buch eintragen.
    if (result.events.some((e) => e.type === 'gameOver')) this.record();
    this.persist();
    this.publish(this.toNotices(result.events));
  }

  legalTargets(uid: number, chosen: Targets): string[] {
    try {
      return slotOptions(this.data, this.state, uid, chosen);
    } catch {
      return [];
    }
  }

  speciesName(speciesId: string): string {
    return this.data.species.get(speciesId)?.name[this.locale] ?? speciesId;
  }

  preview(uid: number, targets: Targets): PreviewView | null {
    let p: ReturnType<typeof preview>;
    try {
      p = preview(this.data, this.state, { uid, targets }, this.locale);
    } catch {
      return null;
    }
    const named = <T extends { zone: string; zoneName?: string | null }>(x: T) => x.zoneName ?? x.zone;
    return {
      cost: p.cost,
      affordable: p.affordable,
      changes: p.changes.map((c) => ({ ...c, zoneName: named(c), statName: c.statName ?? c.stat })),
      triggers: p.triggers.map((x) => ({ zone: x.zone, zoneName: named(x), name: x.name, icon: x.icon })),
      formChanges: p.formChanges.map((f) => ({
        zone: f.zone,
        zoneName: named(f),
        from: f.fromName ?? f.from,
        to: f.toName ?? f.to,
        kind: f.kind ?? 'normal',
      })),
      populationChanges: p.populationChanges ?? [],
      eventChanges: (p.eventChanges ?? []).map((e) => ({ name: e.name, change: e.change, round: e.round ?? null })),
      ...(p.idealDistance ? { idealDistance: p.idealDistance.map((d) => ({ ...d })) } : {}),
    };
  }

  getBook(): BookView {
    const lc = this.locale;
    const b = this.book;
    return {
      games: b.games,
      species: Object.entries(b.species)
        .map(([id, rec]) => {
          const sp = this.data.species.get(id);
          return { id, name: sp?.name[lc] ?? id, tier: sp?.tier ?? 0, firstGame: rec.firstGame };
        })
        .sort((x, y) => x.tier - y.tier || x.name.localeCompare(y.name)),
      speciesTotal: this.data.species.size,
      milestones: this.data.meta.milestones.map((m) => ({
        id: m.id,
        name: m.name[lc],
        description: m.description[lc],
        reached: m.id in b.milestones,
      })),
      best: { ...b.best },
      totals: { ...b.totals },
    };
  }

  lastResult(): GameResult | null {
    return this.result;
  }

  newGame(deck?: readonly string[]): void {
    this.store.clear();
    this.seed = this.freshSeed();
    this.result = null;
    this.state = this.startState(deck);
    this.persist();
    this.publish([]);
  }

  deckSetup(): DeckSetup {
    const lc = this.locale;
    const { minSize: min, maxSize: max, maxCopies } = this.data.config.deck;
    const pool = cardPool(this.data, this.book).flatMap((id) => {
      const card = this.data.cards.get(id);
      if (!card) return [];
      return [
        {
          id,
          name: card.name[lc],
          category: card.category,
          cost: card.cost,
          text: cardText(this.data, card, lc),
          short: cardShort(this.data, card, lc),
        },
      ];
    });
    return { pool, standard: [...this.data.config.starterDeck], rules: { min, max, maxCopies } };
  }

  checkDeck(deck: readonly string[]): DeckIssue[] {
    return validateDeck(this.data, this.book, deck);
  }

  // --- intern -------------------------------------------------------------------------------------

  /** Beendete Partie ins Schöpfungsbuch eintragen (genau einmal, beim Übergang zu „over“). */
  private record(): void {
    const lc = this.locale;
    const update = recordGame(this.data, this.book, this.state);
    this.book = update.book;
    this.books.save(this.book);
    this.result = {
      discovered: update.discovered.map((id) => this.speciesName(id)),
      milestones: update.milestones.map((id) => this.data.meta.milestones.find((m) => m.id === id)?.name[lc] ?? id),
      unlocked: update.unlocked.map((id) => this.data.cards.get(id)?.name[lc] ?? id),
      records: update.records,
    };
  }

  /** Startzustand mit dem gewünschten Deck; ist es (laut Engine) ungültig, mit dem Standarddeck. */
  private startState(deck: readonly string[] | null | undefined): GameState {
    const usable = deck && this.checkDeck(deck).length === 0 ? [...deck] : undefined;
    if (deck && !usable) console.warn('Startdeck ungültig, Standarddeck wird benutzt:', this.checkDeck(deck));
    return newGame(this.data, { seed: this.seed, book: this.book, deck: usable });
  }

  private resume(): { seed: string; state: GameState; view: GameView } | null {
    const saved = this.store.load();
    if (!saved) return null;
    try {
      // Passt der Spielstand nicht mehr zu den Daten (neue Version), verwerfen statt abstürzen.
      const check = validateState(this.data, saved.state);
      if (!check.ok) throw new Error(check.reason);
      return { seed: saved.seed, state: saved.state, view: view(this.data, saved.state, this.locale) };
    } catch (error) {
      console.warn('Gespeicherter Spielstand passt nicht zu den Spieldaten und wird verworfen.', error);
      this.store.clear();
      return null;
    }
  }

  /** `?seed=` gilt für jede neue Partie (auch „Neue Partie“), sonst ein zufälliger Seed. */
  private freshSeed(): string {
    if (this.fixedSeed !== undefined) return this.fixedSeed;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0]!.toString(36);
  }

  private persist(): void {
    this.store.save({ version: 1, seed: this.seed, savedAt: Date.now(), state: this.state });
  }

  private publish(notices: Notice[]): void {
    this.view = view(this.data, this.state, this.locale);
    for (const listener of this.listeners) listener();
    this.emitNotices(notices);
  }

  private emitNotices(notices: Notice[]): void {
    if (notices.length > 0) for (const listener of this.noticeListeners) listener(notices);
  }

  /** Ist die Aktion laut Engine gültig? Wirft die Prüfung selbst, gilt der Zustand als unpassend. */
  private isLegal(action: Action): boolean {
    try {
      if (action.type !== 'play') return action.type === 'endTurn' && this.view.canEndTurn;
      return legalPlays(this.data, this.state).some(
        (p) =>
          p.uid === action.uid &&
          Object.keys(p.targets).length === Object.keys(action.targets).length &&
          Object.entries(p.targets).every(([k, v]) => action.targets[k] === v),
      );
    } catch {
      return true;
    }
  }

  private statOrSpeciesName(id: string): string {
    return this.data.species.has(id) ? this.speciesName(id) : (this.data.stats.get(id)?.name[this.locale] ?? id);
  }

  private zoneName(zoneId: string): string {
    const zone = this.state.zones.find((z) => z.id === zoneId);
    return (zone && this.data.geographies.get(zone.geography)?.name[this.locale]) ?? zoneId;
  }

  private formName(formId: string): string {
    return this.data.forms.get(formId)?.form.name[this.locale] ?? formId;
  }

  /** Engine-Ereignisse → Meldungen für Toasts. Wichtiges zuerst: Kollaps, Rundenbeginn, Harmonie, dann Details. */
  private toNotices(events: GameEvent[]): Notice[] {
    const lc = this.locale;
    const head: Notice[] = [];
    const body: Notice[] = [];
    // Zusammenfassungen je Zone (Reihenfolge des ersten Auftretens bleibt erhalten)
    const overgrazed = new Map<string, Set<string>>();
    const hunted = new Map<string, Map<string, number>>();
    const shifted = new Map<string, { zone: string; card: string; changes: Map<string, number> }>();
    const stats = new Map<string, Map<string, { from: number; to: number }>>();
    const add = (m: Map<string, number>, key: string, delta: number) => m.set(key, (m.get(key) ?? 0) + delta);
    for (const e of events) {
      switch (e.type) {
        case 'roundStarted': {
          const season = this.data.seasons.find((s) => s.id === e.season);
          head.push({ type: 'round', round: e.round, season: season?.name[lc] ?? e.season });
          break;
        }
        case 'cardPlayed':
          body.push({ type: 'played', card: this.data.cards.get(e.card)?.name[lc] ?? e.card });
          break;
        case 'triggered': {
          const trigger = this.data.cards.get(e.card)?.triggers.find((t) => t.id === e.trigger);
          body.push({
            type: 'trigger',
            zone: this.zoneName(e.zone),
            name: trigger?.name[lc] ?? e.trigger,
            icon: trigger?.icon ?? '⚡',
            disturbance: e.disturbance,
          });
          break;
        }
        case 'formChanged':
          body.push({
            type: 'form',
            zoneId: e.zone,
            zone: this.zoneName(e.zone),
            from: this.formName(e.from),
            to: this.formName(e.to),
            kind: this.data.forms.get(e.to)?.form.kind ?? 'normal',
          });
          break;
        case 'levelChanged':
          body.push({ type: 'level', zone: this.zoneName(e.zone), from: e.from, to: e.to });
          break;
        case 'harmonyChanged':
          if (e.to !== e.from) head.push({ type: 'harmony', delta: e.to - e.from });
          break;
        case 'collapsed':
          head.unshift({ type: 'collapsed' });
          break;
        case 'speciesEmerged':
          (e.first ? head : body).push({
            type: 'emerged',
            species: this.speciesName(e.species),
            zone: this.zoneName(e.zone),
            first: e.first,
          });
          break;
        case 'speciesExtinct':
          head.push({ type: 'extinct', species: this.speciesName(e.species) });
          break;
        case 'migrated':
          body.push({
            type: 'migrated',
            species: this.speciesName(e.species),
            from: this.zoneName(e.from),
            to: this.zoneName(e.to),
          });
          break;
        case 'hunger':
          body.push({ type: 'hunger', species: this.speciesName(e.species), zone: this.zoneName(e.zone) });
          break;
        case 'giftAdded':
          body.push({
            type: 'gift',
            species: this.speciesName(e.species),
            card: this.data.cards.get(e.card)?.name[lc] ?? e.card,
          });
          break;
        case 'overpopulation': {
          const foods = overgrazed.get(e.zone) ?? new Set<string>();
          foods.add(e.food);
          overgrazed.set(e.zone, foods);
          break;
        }
        case 'populationChanged': {
          // Hunger, Wanderung und Entstehung haben eigene Meldungen; hier nur Jagd durch Menschen und Karten.
          const delta = e.to - e.from;
          if (delta === 0) break;
          if (e.cause === 'hunted') {
            const m = hunted.get(e.zone) ?? new Map<string, number>();
            add(m, e.species, delta);
            hunted.set(e.zone, m);
          } else if (e.cause.startsWith('card:') || e.cause.startsWith('trigger:')) {
            const card = e.cause.slice(e.cause.indexOf(':') + 1).split('.')[0] ?? '';
            const key = `${e.zone}|${card}`;
            const entry = shifted.get(key) ?? { zone: e.zone, card, changes: new Map<string, number>() };
            add(entry.changes, e.species, delta);
            shifted.set(key, entry);
          }
          break;
        }
        case 'eventForecast':
        case 'eventOccurred':
        case 'eventCancelled':
        case 'eventDelayed': {
          const text = describeEvent(this.data, e, lc);
          if (text)
            (e.type === 'eventOccurred' ? head : body).push({
              type: 'text',
              text,
              tone: e.type === 'eventOccurred' ? 'bad' : 'info',
            });
          break;
        }
        case 'statChanged': {
          const zoneStats = stats.get(e.zone) ?? new Map<string, { from: number; to: number }>();
          const prev = zoneStats.get(e.stat);
          zoneStats.set(e.stat, { from: prev?.from ?? e.from, to: e.to });
          stats.set(e.zone, zoneStats);
          break;
        }
        case 'gameOver': // Partie-Ende: Buch-Eintrag in dispatch, Meldung kommt über 'collapsed'
        case 'scored':
        case 'cardDrawn':
        case 'deckReshuffled':
        case 'disturbance': // kommt immer zusammen mit 'triggered' oder einem Formwechsel zur Störungsform
        case 'breathChanged':
        case 'turnEnded':
        case 'seasonApplied':
        case 'couplingApplied':
          break;
      }
    }
    const losses = (m: Map<string, number>) =>
      [...m].filter(([, d]) => d !== 0).map(([species, delta]) => ({ species: this.speciesName(species), delta }));
    for (const { zone, card, changes } of shifted.values()) {
      const list = losses(changes);
      if (list.length > 0)
        body.push({
          type: 'populationShift',
          zone: this.zoneName(zone),
          card: this.data.cards.get(card)?.name[lc] ?? card,
          changes: list,
        });
    }
    for (const [zone, m] of hunted) {
      const list = losses(m);
      if (list.length > 0) body.push({ type: 'hunted', zone: this.zoneName(zone), losses: list });
    }
    for (const [zone, foods] of overgrazed)
      body.push({
        type: 'overgrazed',
        zone: this.zoneName(zone),
        foods: [...foods].map((f) => this.statOrSpeciesName(f)),
      });
    // Netto-Wertänderungen je Zone (für die aufsteigenden Zahlen); ein Schritt mit Rundenende zählt als Natur.
    const cause = events.some((e) => e.type === 'turnEnded') ? 'nature' : 'card';
    for (const [zone, m] of stats) {
      const changes = [...m]
        .filter(([, c]) => c.from !== c.to)
        .map(([stat, c]) => ({ stat, statName: this.data.stats.get(stat)?.name[lc] ?? stat, from: c.from, to: c.to }));
      if (changes.length > 0) body.push({ type: 'statShift', zone, cause, changes });
    }
    const rank: Partial<Record<Notice['type'], number>> = {
      collapsed: 0,
      extinct: 1,
      emerged: 2,
      round: 3,
      harmony: 4,
    };
    head.sort((a, b) => (rank[a.type] ?? 9) - (rank[b.type] ?? 9));
    return [...head, ...body];
  }
}
