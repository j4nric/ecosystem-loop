import type { Action, FormKind, GameView, Targets } from '@core/api';

/**
 * Meldung über etwas, das in einem Schritt passiert ist – mit bereits lokalisierten Namen aus den Daten.
 * Der Satzbau entsteht erst in der App (`src/i18n`), damit Engine und Oberfläche getrennt bleiben.
 */
export type Notice =
  | { type: 'round'; round: number; season: string }
  | { type: 'played'; card: string }
  | { type: 'trigger'; zone: string; name: string; icon: string; disturbance: boolean }
  | { type: 'form'; zone: string; from: string; to: string; kind: FormKind }
  | { type: 'level'; zone: string; from: number; to: number }
  | { type: 'harmony'; delta: number }
  | { type: 'collapsed' }
  | { type: 'emerged'; species: string; zone: string; first: boolean }
  | { type: 'extinct'; species: string }
  | { type: 'migrated'; species: string; from: string; to: string }
  | { type: 'hunger'; species: string; zone: string }
  | { type: 'gift'; species: string; card: string }
  /** Nahrungsquellen einer Zone wurden leergefressen (Überweidung bzw. zu viele Räuber), je Zone zusammengefasst. */
  | { type: 'overgrazed'; zone: string; foods: string[] }
  /** Menschen haben in einer Zone gejagt; Verluste je Art. */
  | { type: 'hunted'; zone: string; losses: { species: string; delta: number }[] }
  /** Bestandsänderungen durch eine Karte (inkl. ihrer Schwellen) in einer Zone. */
  | { type: 'populationShift'; zone: string; card: string; changes: { species: string; delta: number }[] }
  /** Eine Aktion wurde von der Engine abgelehnt; der Zustand ist unverändert. */
  | { type: 'rejected' }
  /** Der Spielstand passt nicht (mehr) zu den Spieldaten – die Oberfläche bietet eine neue Partie an. */
  | { type: 'incompatible' };

/** Vorschau eines Kartenzugs mit aufgelösten Namen (für das Zonen-Sheet vor dem Bestätigen). */
export interface PreviewView {
  cost: number;
  affordable: boolean;
  changes: { zone: string; zoneName: string; stat: string; statName: string; from: number; to: number }[];
  triggers: { zone: string; zoneName: string; name: string; icon: string }[];
  formChanges: { zone: string; zoneName: string; from: string; to: string; kind: FormKind }[];
}

/**
 * Adapter zwischen App und Engine. Die App kennt nur dieses Interface:
 * Zustand lesen (`getView`), Aktionen schicken (`dispatch`), auf Änderungen hören (`subscribe`).
 */
export interface GameClient {
  getView(): GameView;
  dispatch(action: Action): void;
  /** Meldet jede neue GameView; gibt eine Abmelde-Funktion zurück. */
  subscribe(listener: () => void): () => void;
  /** Meldungen je Schritt (Formwechsel, Stufen, Störungen, Kollaps …); gibt eine Abmelde-Funktion zurück. */
  subscribeNotices(listener: (notices: Notice[]) => void): () => void;
  /**
   * Gültige Ziele (Zonen- oder Art-Ids, je nach Slot-Art) für den nächsten noch offenen Slot der Karte `uid`,
   * gegeben die bisherige Auswahl `chosen` (Slot-Id → Ziel). Leer, wenn die Karte so nicht spielbar ist.
   */
  legalTargets(uid: number, chosen: Targets): string[];
  /** Lokalisierter Name einer Art (für Art-Slots wie bei „Jagd“); die Id, wenn unbekannt. */
  speciesName(speciesId: string): string;
  /** Vorschau eines vollständigen Kartenzugs ohne Ausführung; null, wenn keine Vorschau möglich ist. */
  preview(uid: number, targets: Targets): PreviewView | null;
  /** Neue Partie starten (setzt auch den gespeicherten Spielstand zurück). */
  newGame(): void;
  /** true, solange Vorschau-Daten statt der echten Engine laufen. */
  readonly isMock: boolean;
}
