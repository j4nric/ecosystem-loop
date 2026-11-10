import { useCallback, useMemo, useRef, useState } from 'react';
import type { CardView, Targets } from '@core/api';
import type { DeckStore, GameClient } from './client/index.ts';
import { initialDeck } from './logic/deck.ts';
import { t } from './i18n/index.ts';
import { IslandScene } from './scene/IslandScene.tsx';
import type { ZonePicker } from './scene/registry.ts';
import { useReducedMotion } from './state/motion.ts';
import { hasSeenTutorial, markTutorialSeen } from './state/tutorialStore.ts';
import { useCardDrag } from './state/useCardDrag.ts';
import { useGame } from './state/useGame.ts';
import { useTargeting } from './state/useTargeting.ts';
import { DragOverlay } from './ui/DragOverlay.tsx';
import { GameOver } from './ui/GameOver.tsx';
import { Hand } from './ui/Hand.tsx';
import { Book } from './ui/Book.tsx';
import { Help } from './ui/Help.tsx';
import { Hud } from './ui/Hud.tsx';
import { CardDetail } from './ui/CardDetail.tsx';
import { DeckPicker } from './ui/DeckPicker.tsx';
import { PlayActions, PlayPreview } from './ui/PlayPreview.tsx';
import { ChoiceChips } from './ui/ChoiceChips.tsx';
import { Toasts } from './ui/Toasts.tsx';
import { Tutorial } from './ui/Tutorial.tsx';
import { ZoneSheet } from './ui/ZoneSheet.tsx';

/** `?tutorial` zeigt die Einführung erneut, `?notutorial` nie (Tests). */
function initialTutorial(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.has('notutorial')) return false;
  return params.has('tutorial') || !hasSeenTutorial();
}

/** Startdeck-Schritt: beim ersten Start nach der Einführung oder vor einer neuen Partie. */
type DeckStep = 'first' | 'new' | null;

export function App({ client, decks }: { client: GameClient; decks: DeckStore }) {
  const { view, dispatch, newGame, toasts, incompatible, dismissIncompatible } = useGame(client);
  const reducedMotion = useReducedMotion();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(initialTutorial);
  /** Nur die Einführung beim ersten Start führt danach zur Startdeck-Auswahl (nicht die aus der Hilfe). */
  const firstStart = useRef(tutorialOpen);
  const [deckStep, setDeckStep] = useState<DeckStep>(null);
  const [detailUid, setDetailUid] = useState<number | null>(null);
  const pickerRef = useRef<ZonePicker | null>(null);

  const play = useCallback((uid: number, targets: Targets) => dispatch({ type: 'play', uid, targets }), [dispatch]);
  const targeting = useTargeting(client, view, play);
  const { cancel: cancelTargeting, startAt } = targeting;

  const drag = useCardDrag({
    client,
    pickerRef,
    onStart: useCallback(() => {
      cancelTargeting();
      setSelectedZone(null);
      setDetailUid(null);
    }, [cancelTargeting]),
    onDrop: useCallback((card: CardView, zoneId: string) => void startAt(card, zoneId), [startAt]),
    onLongPress: useCallback(
      (card: CardView) => {
        cancelTargeting();
        setSelectedZone(null);
        setDetailUid(card.uid);
      },
      [cancelTargeting],
    ),
  });
  const dragging = drag.drag;

  const dragPreview = useMemo(() => {
    if (!dragging?.zone || !dragging.valid.has(dragging.zone) || dragging.card.slots.length !== 1) return null;
    const slot = dragging.card.slots[0]!;
    return client.preview(dragging.card.uid, { [slot.id]: dragging.zone });
  }, [client, dragging]);

  const onZoneTap = useCallback(
    (zoneId: string) => {
      if (targeting.targeting) targeting.pickZone(zoneId);
      else setSelectedZone((current) => (current === zoneId ? null : zoneId));
    },
    [targeting],
  );

  const onCardTap = useCallback(
    (card: CardView) => {
      setDetailUid(null);
      if (targeting.targeting?.card.uid === card.uid) {
        targeting.cancel();
        return;
      }
      setSelectedZone(null);
      // Nicht spielbare Karten zeigen beim Antippen ihren vollen Text.
      if (!card.playable) {
        targeting.cancel();
        setDetailUid(card.uid);
        return;
      }
      targeting.start(card);
    },
    [targeting],
  );

  const startNewGame = useCallback(
    (deck?: readonly string[]) => {
      setSelectedZone(null);
      setDetailUid(null);
      setDeckStep(null);
      targeting.cancel();
      newGame(deck);
    },
    [newGame, targeting],
  );

  const closeTutorial = useCallback(() => {
    markTutorialSeen();
    setTutorialOpen(false);
    if (firstStart.current) setDeckStep('first');
    firstStart.current = false;
  }, []);

  const deckSetup = useMemo(() => (deckStep ? client.deckSetup() : null), [client, deckStep]);
  const checkDeck = useCallback((deck: readonly string[]) => client.checkDeck(deck), [client]);
  const deckStart = useMemo(
    () => (deckSetup ? initialDeck(decks.load(), deckSetup.standard, checkDeck) : []),
    [deckSetup, decks, checkDeck],
  );
  const detailCard = detailUid === null ? undefined : view.hand.find((c) => c.uid === detailUid);

  const active = targeting.targeting;
  // Während eines Kartenzugs zeigt das Sheet die erste gewählte Zielzone, sonst die angetippte Zone.
  const firstSlot = active?.card.slots[0];
  const targetZoneId = active && firstSlot ? (active.targets[firstSlot.id] ?? null) : null;
  const focusZone = dragging ? dragging.zone : active ? targetZoneId : selectedZone;
  const zone = view.zones.find((z) => z.id === focusZone);
  const speciesSlot = targeting.editSlot?.kind === 'species';

  const chips = targeting.chipSlot && targeting.editSlot && (
    <ChoiceChips
      options={targeting.chipOptions}
      selected={targeting.chosenChip}
      onPick={targeting.pickChip}
      label={targeting.editSlot.label}
    />
  );
  const preview = active && targeting.complete && (
    <PlayPreview card={active.card} preview={targeting.preview} shownZone={zone?.id ?? null}>
      {chips}
    </PlayPreview>
  );
  const actions = active && targeting.complete && (
    <PlayActions
      card={active.card}
      preview={targeting.preview}
      onPlay={targeting.confirm}
      onCancel={targeting.cancel}
    />
  );

  return (
    <div className="app">
      <IslandScene
        zones={view.zones}
        round={view.round}
        harmony={view.harmony.value / Math.max(1, view.harmony.max)}
        season={view.season.id}
        selectedZone={focusZone}
        validTargets={dragging ? dragging.valid : active ? targeting.validZones : null}
        reducedMotion={reducedMotion}
        pickerRef={pickerRef}
        onZoneTap={onZoneTap}
        onBackgroundTap={() => setSelectedZone(null)}
      />

      <div className="top">
        <Hud
          view={view}
          isMock={client.isMock}
          reducedMotion={reducedMotion}
          onHelp={() => setHelpOpen(true)}
          onBook={() => setBookOpen(true)}
          onNewGame={() => {
            if (view.phase === 'play' && !window.confirm(t.newGameConfirm)) return;
            setDeckStep('new');
          }}
        />
        <Toasts toasts={toasts} />
      </div>

      <footer className={`dock${dragging ? ' is-dragging' : ''}`}>
        {!dragging && detailCard && !active && (
          <CardDetail
            card={detailCard}
            onClose={() => setDetailUid(null)}
            onPlay={() => {
              setDetailUid(null);
              targeting.start(detailCard);
            }}
          />
        )}
        {!dragging && active && targeting.complete && zone && (
          <ZoneSheet
            zone={zone}
            zones={view.zones}
            onClose={targeting.cancel}
            changes={targeting.preview?.changes}
            footer={actions}
          >
            {preview}
          </ZoneSheet>
        )}
        {!dragging && active && targeting.complete && !zone && (
          <section className="sheet sheet--compact" role="dialog" aria-label={active.card.name}>
            <div className="sheet__body">{preview}</div>
            <div className="sheet__footer">{actions}</div>
          </section>
        )}
        {!dragging && active && targeting.slot && (
          <div className="target-banner" role="status">
            <div>
              <b>{active.card.name}</b>
              <span>
                {!targeting.slotSupported
                  ? t.unsupportedSlot(targeting.slot.kind)
                  : speciesSlot
                    ? t.chooseSpecies(targeting.slot.label)
                    : targeting.chipSlot
                      ? t.chooseOption(targeting.slot.label)
                      : t.chooseTarget(targeting.slot.label)}
              </span>
              {chips || <small>{active.card.text}</small>}
            </div>
            <button type="button" className="btn" onClick={targeting.cancel}>
              {t.cancel}
            </button>
          </div>
        )}
        {!dragging && zone && !active && !detailCard && (
          <ZoneSheet zone={zone} zones={view.zones} onClose={() => setSelectedZone(null)} />
        )}
        <div className="dock__bar">
          <span className="dock__info">
            {t.playsInfo(view.playsThisTurn, view.minPlays)}
            <small>
              {t.drawPile(view.drawPile)} · {t.discardPile(view.discardPile)}
            </small>
          </span>
          <button
            type="button"
            className="btn btn--primary"
            disabled={!view.canEndTurn}
            onClick={() => {
              targeting.cancel();
              setSelectedZone(null);
              dispatch({ type: 'endTurn' });
            }}
          >
            {t.endTurn}
          </button>
        </div>
        <Hand
          cards={view.hand}
          activeUid={active?.card.uid ?? null}
          draggingUid={dragging?.card.uid ?? null}
          onCardTap={onCardTap}
          pointer={drag}
        />
      </footer>

      {dragging && <DragOverlay drag={dragging} zones={view.zones} preview={dragPreview} ghostRef={drag.ghostRef} />}

      {view.phase === 'over' && (
        <GameOver
          view={view}
          result={client.lastResult()}
          onNewGame={() => setDeckStep('new')}
          onBook={() => setBookOpen(true)}
        />
      )}

      {incompatible && (
        <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="incompatible-title">
          <div className="overlay__panel">
            <h2 id="incompatible-title">{t.incompatibleTitle}</h2>
            <p>{t.incompatibleText}</p>
            <div className="overlay__actions">
              <button type="button" className="btn" onClick={dismissIncompatible}>
                {t.later}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                autoFocus
                onClick={() => startNewGame(deckStartFor(client, decks))}
              >
                {t.newGame}
              </button>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <Help
          onClose={() => setHelpOpen(false)}
          onTutorial={() => {
            setHelpOpen(false);
            setTutorialOpen(true);
          }}
        />
      )}
      {bookOpen && <Book book={client.getBook()} onClose={() => setBookOpen(false)} />}
      {tutorialOpen && <Tutorial onDone={closeTutorial} />}
      {deckSetup && (
        <DeckPicker
          setup={deckSetup}
          initial={deckStart}
          check={checkDeck}
          onStart={(deck) => {
            decks.save(deck);
            startNewGame(deck);
          }}
          onQuickStart={() => startNewGame(deckSetup.standard)}
          onClose={() => setDeckStep(null)}
        />
      )}
    </div>
  );
}

/** Gemerktes Startdeck, wenn es noch gültig ist, sonst das Standarddeck. */
function deckStartFor(client: GameClient, decks: DeckStore): string[] {
  const setup = client.deckSetup();
  return initialDeck(decks.load(), setup.standard, (d) => client.checkDeck(d));
}
