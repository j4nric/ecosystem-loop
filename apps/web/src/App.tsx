import { useCallback, useMemo, useRef, useState } from 'react';
import type { CardView, Targets } from '@core/api';
import type { GameClient } from './client/index.ts';
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
import { PlayPreview } from './ui/PlayPreview.tsx';
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

export function App({ client }: { client: GameClient }) {
  const { view, dispatch, newGame, toasts, incompatible, dismissIncompatible } = useGame(client);
  const reducedMotion = useReducedMotion();
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(initialTutorial);
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
    }, [cancelTargeting]),
    onDrop: useCallback((card: CardView, zoneId: string) => void startAt(card, zoneId), [startAt]),
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
      if (targeting.targeting?.card.uid === card.uid) {
        targeting.cancel();
        return;
      }
      setSelectedZone(null);
      targeting.start(card);
    },
    [targeting],
  );

  const startNewGame = useCallback(() => {
    setSelectedZone(null);
    targeting.cancel();
    newGame();
  }, [newGame, targeting]);

  const closeTutorial = useCallback(() => {
    markTutorialSeen();
    setTutorialOpen(false);
  }, []);

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
    <PlayPreview
      card={active.card}
      preview={targeting.preview}
      shownZone={zone?.id ?? null}
      onPlay={targeting.confirm}
      onCancel={targeting.cancel}
    >
      {chips}
    </PlayPreview>
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
            if (!window.confirm(t.newGameConfirm)) return;
            startNewGame();
          }}
        />
        <Toasts toasts={toasts} />
      </div>

      <footer className={`dock${dragging ? ' is-dragging' : ''}`}>
        {!dragging && active && targeting.complete && zone && (
          <ZoneSheet zone={zone} zones={view.zones} onClose={targeting.cancel} changes={targeting.preview?.changes}>
            {preview}
          </ZoneSheet>
        )}
        {!dragging && active && targeting.complete && !zone && (
          <section className="sheet" role="dialog" aria-label={active.card.name}>
            {preview}
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
        {!dragging && zone && !active && (
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
        <GameOver view={view} result={client.lastResult()} onNewGame={startNewGame} onBook={() => setBookOpen(true)} />
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
              <button type="button" className="btn btn--primary" onClick={startNewGame}>
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
    </div>
  );
}
