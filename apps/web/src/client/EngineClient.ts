import {
  RuleError,
  legalPlays,
  newGame,
  preview,
  step,
  view,
  type GameData,
  type GameEvent,
  type GameState,
} from '@being-god/core';
import type { Action, GameView, Locale, Targets } from '@core/api';
import type { GameClient, Notice, PreviewView } from './GameClient.ts';
import type { SaveStore } from './SaveStore.ts';

export interface EngineClientOptions {
  data: GameData;
  locale: Locale;
  store: SaveStore;
  /** Fester Seed für eine neue Partie (Tests, `?seed=`); sonst zufällig. */
  seed?: string;
}

/** Echte Engine im Browser: Zustand in der App, Regeln ausschließlich über die Fassade von `@being-god/core`. */
export class EngineClient implements GameClient {
  readonly isMock = false;
  private readonly data: GameData;
  private readonly locale: Locale;
  private readonly store: SaveStore;
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
    this.fixedSeed = options.seed;
    const resumed = this.resume();
    if (resumed) {
      this.seed = resumed.seed;
      this.state = resumed.state;
      this.view = resumed.view;
    } else {
      this.seed = this.freshSeed();
      this.state = newGame(this.data, { seed: this.seed });
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
      const incompatible = !(error instanceof RuleError) || !this.fitsData(this.state) || this.isLegal(action);
      console.warn(incompatible ? 'Spielstand passt nicht zu den Spieldaten:' : 'Aktion abgelehnt:', error);
      this.emitNotices([{ type: incompatible ? 'incompatible' : 'rejected' }]);
      return;
    }
    this.state = result.state;
    this.persist();
    this.publish(this.toNotices(result.events));
  }

  legalTargets(uid: number, chosen: Targets): string[] {
    const inst = this.state.hand.find((c) => c.uid === uid);
    const card = inst && this.data.cards.get(inst.card);
    if (!card) return [];
    const slot = card.slots.find((s) => chosen[s.id] === undefined);
    if (!slot) return [];
    const out = new Set<string>();
    for (const play of legalPlays(this.data, this.state)) {
      if (play.uid !== uid) continue;
      if (Object.entries(chosen).every(([k, v]) => play.targets[k] === v)) {
        const target = play.targets[slot.id];
        if (target !== undefined) out.add(target);
      }
    }
    return [...out];
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
    return {
      cost: p.cost,
      affordable: p.affordable,
      changes: p.changes.map((c) => ({
        ...c,
        zoneName: this.zoneName(c.zone),
        statName: this.data.stats.get(c.stat)?.name[this.locale] ?? c.stat,
      })),
      triggers: p.triggers.map((t) => ({ zone: t.zone, zoneName: this.zoneName(t.zone), name: t.name, icon: t.icon })),
      formChanges: p.formChanges.map((f) => ({
        zone: f.zone,
        zoneName: this.zoneName(f.zone),
        from: this.formName(f.from),
        to: this.formName(f.to),
        kind: this.data.forms.get(f.to)?.form.kind ?? 'normal',
      })),
    };
  }

  newGame(): void {
    this.store.clear();
    this.seed = this.freshSeed(true);
    this.state = newGame(this.data, { seed: this.seed });
    this.persist();
    this.publish([]);
  }

  // --- intern -------------------------------------------------------------------------------------

  private resume(): { seed: string; state: GameState; view: GameView } | null {
    const saved = this.store.load();
    if (!saved) return null;
    try {
      // Passt der Spielstand nicht mehr zu den Daten (neue Version), verwerfen statt abstürzen.
      if (!this.fitsData(saved.state)) throw new Error('Spielstand benutzt unbekannte Daten-Ids.');
      return { seed: saved.seed, state: saved.state, view: view(this.data, saved.state, this.locale) };
    } catch (error) {
      console.warn('Gespeicherter Spielstand passt nicht zu den Spieldaten und wird verworfen.', error);
      this.store.clear();
      return null;
    }
  }

  private freshSeed(ignoreFixed = false): string {
    if (this.fixedSeed !== undefined && !ignoreFixed) return this.fixedSeed;
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

  /** Grobe Prüfung, ob ein Zustand nur Karten, Geografien, Formen und Arten der geladenen Daten benutzt. */
  private fitsData(state: GameState): boolean {
    const d = this.data;
    return (
      [...state.hand, ...state.drawPile, ...state.discardPile].every((c) => d.cards.has(c.card)) &&
      state.zones.every(
        (z) =>
          d.geographies.has(z.geography) &&
          d.forms.has(z.form) &&
          Object.keys(z.populations).every((s) => d.species.has(s)),
      )
    );
  }

  /** Ist die Aktion laut Engine gültig? Wirft die Prüfung selbst, gilt der Zustand als unpassend. */
  private isLegal(action: Action): boolean {
    try {
      if (action.type === 'endTurn') return this.view.canEndTurn;
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
        case 'scored':
        case 'cardDrawn':
        case 'deckReshuffled':
        case 'disturbance': // kommt immer zusammen mit 'triggered' oder einem Formwechsel zur Störungsform
        case 'statChanged':
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
