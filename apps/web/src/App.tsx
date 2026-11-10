import { useCallback, useMemo, useState } from 'react';
import type { Action, Pos } from '@being-god/herde';
import type { GameClient, StartupNotice } from './client/index.ts';
import { t } from './i18n/index.ts';
import { isPlayable, monthsToNextSeason } from './logic/format.ts';
import { IslandScene } from './scene/IslandScene.tsx';
import { haptic, useReducedMotion } from './state/motion.ts';
import { hasSeenTutorial, markTutorialSeen } from './state/tutorialStore.ts';
import { useGame } from './state/useGame.ts';
import { GameOver } from './ui/GameOver.tsx';
import { Hand } from './ui/Hand.tsx';
import { Help } from './ui/Help.tsx';
import {
  EvolutionBanner,
  EvolutionButton,
  EvolutionPanel,
  EvolveDialog,
  EvolvedCard,
  TraitOffer,
} from './ui/Evolution.tsx';
import { CardSheet, FieldSheet, LogSheet } from './ui/Sheets.tsx';
import { StatusBar } from './ui/StatusBar.tsx';
import { Toasts } from './ui/Toasts.tsx';
import { Tutorial } from './ui/Tutorial.tsx';

/** `?tutorial` zeigt die Einführung erneut, `?notutorial` nie (Tests). */
function initialTutorial(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.has('notutorial')) return false;
  return params.has('tutorial') || !hasSeenTutorial();
}

const samePos = (a: Pos | null, b: Pos | null) => !!a && !!b && a.x === b.x && a.y === b.y;

export function App({ client }: { client: GameClient }) {
  const reducedMotion = useReducedMotion();
  const { view, log, toasts, running, run, stop, dispatch, newGame } = useGame(client, reducedMotion);
  const data = client.data;
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [chosen, setChosen] = useState<Pos | null>(null);
  const [infoCell, setInfoCell] = useState<Pos | null>(null);
  const [logOpen, setLogOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(initialTutorial);
  const [overSeen, setOverSeen] = useState(false);
  const [startup, setStartup] = useState<StartupNotice>(() => client.takeStartupNotice());
  // Entwicklung: Panel, Merkmal-Angebot, Bestätigung des Sprungs, Einblendung der neuen Stufe
  const [evoOpen, setEvoOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [evolveOpen, setEvolveOpen] = useState(false);
  const [evolved, setEvolved] = useState<string | null>(null);

  const card = selectedCard === null ? undefined : view.hand[selectedCard];
  const clearSelection = useCallback(() => {
    setSelectedCard(null);
    setChosen(null);
  }, []);

  const subscribeReports = useCallback<GameClient['subscribeReports']>((l) => client.subscribeReports(l), [client]);

  const action: Action | null = useMemo(() => {
    if (!card) return null;
    if (card.global) return { type: 'play', hand: card.index };
    return chosen ? { type: 'play', hand: card.index, x: chosen.x, y: chosen.y } : null;
  }, [card, chosen]);
  // Vorschau: `step` auf dem Zustand (rein), danach `view` – nur wenn ein vollständiger Zug feststeht.
  const preview = useMemo(() => (action ? client.preview(action) : null), [client, action]);

  const onCardTap = useCallback(
    (index: number) => {
      if (running) return;
      haptic();
      setInfoCell(null);
      setChosen(null);
      setSelectedCard((current) => (current === index ? null : index));
    },
    [running],
  );

  const onCellTap = useCallback(
    (pos: Pos) => {
      if (card && !card.global) {
        if (card.targets.some((p) => samePos(p, pos))) {
          haptic();
          setChosen(pos);
        }
        return;
      }
      if (card) return;
      setInfoCell((current) => (samePos(current, pos) ? null : pos));
    },
    [card],
  );

  const play = useCallback(() => {
    if (!action) return;
    haptic(20);
    dispatch(action);
    clearSelection();
  }, [action, dispatch, clearSelection]);

  const runMonths = useCallback(
    (months: number) => {
      clearSelection();
      setInfoCell(null);
      run(months);
    },
    [run, clearSelection],
  );

  const startNewGame = useCallback(() => {
    clearSelection();
    setInfoCell(null);
    setLogOpen(false);
    setOverSeen(false);
    setEvoOpen(false);
    setOfferOpen(false);
    setEvolveOpen(false);
    setEvolved(null);
    newGame();
  }, [newGame, clearSelection]);

  const openOffer = useCallback(() => {
    if (running) return;
    clearSelection();
    setEvoOpen(false);
    setOfferOpen(true);
  }, [running, clearSelection]);

  const openEvolve = useCallback(() => {
    if (running) return;
    clearSelection();
    setEvoOpen(false);
    setEvolveOpen(true);
  }, [running, clearSelection]);

  const pickTrait = useCallback(
    (trait: string) => {
      haptic(20);
      dispatch({ type: 'pickTrait', trait });
      setOfferOpen(false);
    },
    [dispatch],
  );

  const evolve = useCallback(() => {
    haptic(40);
    setEvolveOpen(false);
    if (dispatch({ type: 'evolve' })) setEvolved(client.getView().herd.stage);
  }, [dispatch, client]);
  const closeEvolved = useCallback(() => setEvolved(null), []);

  const closeTutorial = useCallback(() => {
    markTutorialSeen();
    setTutorialOpen(false);
  }, []);

  const infoView = infoCell ? view.cells[infoCell.y * view.width + infoCell.x] : undefined;
  const over = view.over !== null;
  const targets = card && !card.global ? card.targets : null;

  return (
    <div className="app">
      <IslandScene
        data={data}
        view={view}
        targets={targets}
        grown={card?.global ? (preview?.grown ?? null) : null}
        selected={chosen ?? infoCell}
        previewIntent={preview?.intentChanged ? preview.intentAfter : null}
        running={running}
        reducedMotion={reducedMotion}
        subscribeReports={subscribeReports}
        onCellTap={onCellTap}
        onBackgroundTap={() => setInfoCell(null)}
      />

      <div className="top">
        <StatusBar
          data={data}
          view={view}
          onHelp={() => setHelpOpen(true)}
          onTutorial={() => setTutorialOpen(true)}
          onNewGame={() => {
            if (!over && !window.confirm(t.newGameConfirm)) return;
            startNewGame();
          }}
        />
        {!running && !card && <EvolutionBanner data={data} view={view} onOffer={openOffer} onMature={openEvolve} />}
        <Toasts toasts={toasts} />
      </div>

      <footer className="dock">
        {card && (
          <CardSheet
            data={data}
            card={card.card}
            wild={card.wild}
            global={card.global}
            playable={isPlayable(card)}
            chosen={chosen !== null}
            preview={preview}
            onCancel={clearSelection}
          />
        )}
        {!card && infoView && !logOpen && (
          <FieldSheet data={data} view={view} cell={infoView} onClose={() => setInfoCell(null)} />
        )}
        {!card && logOpen && <LogSheet data={data} log={log} onClose={() => setLogOpen(false)} />}

        <Hand data={data} cards={view.hand} selected={selectedCard} disabled={running || over} onTap={onCardTap} />

        <div className="controls">
          {card ? (
            <>
              <button type="button" className="btn" onClick={clearSelection}>
                {t.cancel}
              </button>
              <button type="button" className="btn btn--primary btn--wide" disabled={!preview} onClick={play}>
                {card.global ? t.play : t.place}
              </button>
            </>
          ) : over ? (
            <>
              <span className="controls__over">{t.overBar(view.over === 'won')}</span>
              <button type="button" className="btn btn--primary" onClick={startNewGame}>
                {t.newGame}
              </button>
            </>
          ) : running ? (
            <button type="button" className="btn btn--primary btn--wide" onClick={stop}>
              {t.stop}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn--primary btn--wide"
                onClick={() => runMonths(monthsToNextSeason(data, view.month))}
              >
                {t.playSeason} ▶▶
              </button>
              <button type="button" className="btn" onClick={() => runMonths(1)}>
                {t.playMonth}
              </button>
            </>
          )}
          <EvolutionButton
            view={view}
            active={evoOpen}
            onTap={() => {
              clearSelection();
              setInfoCell(null);
              setLogOpen(false);
              setEvoOpen((o) => !o);
            }}
          />
          <button
            type="button"
            className={`btn btn--icon${logOpen ? ' is-active' : ''}`}
            aria-label={t.log}
            aria-pressed={logOpen}
            onClick={() => {
              clearSelection();
              setInfoCell(null);
              setLogOpen((o) => !o);
            }}
          >
            📜
          </button>
        </div>
      </footer>

      {over && !overSeen && !running && (
        <GameOver data={data} view={view} onNewGame={startNewGame} onViewIsland={() => setOverSeen(true)} />
      )}

      {startup && (
        <div className="overlay" role="alertdialog" aria-modal="true" aria-labelledby="startup-title">
          <div className="overlay__panel">
            <h2 id="startup-title">
              {startup === 'legacy' ? t.legacyTitle : startup === 'outdated' ? t.outdatedTitle : t.incompatibleTitle}
            </h2>
            <p>{startup === 'legacy' ? t.legacyText : startup === 'outdated' ? t.outdatedText : t.incompatibleText}</p>
            <div className="overlay__actions">
              <button type="button" className="btn btn--primary" autoFocus onClick={() => setStartup(null)}>
                {t.ok}
              </button>
            </div>
          </div>
        </div>
      )}

      {evoOpen && (
        <EvolutionPanel
          data={data}
          view={view}
          busy={running || over}
          onClose={() => setEvoOpen(false)}
          onOffer={openOffer}
          onEvolve={openEvolve}
        />
      )}
      {offerOpen && !running && !over && view.evolution.offer.length > 0 && (
        <TraitOffer data={data} view={view} onPick={pickTrait} onClose={() => setOfferOpen(false)} />
      )}
      {evolveOpen && !running && !over && view.evolution.mature && view.evolution.next && (
        <EvolveDialog
          data={data}
          view={view}
          next={view.evolution.next}
          onConfirm={evolve}
          onCancel={() => setEvolveOpen(false)}
        />
      )}
      {evolved && <EvolvedCard data={data} stage={evolved} onDone={closeEvolved} />}

      {helpOpen && (
        <Help
          data={data}
          stage={view.evolution.stage}
          onClose={() => setHelpOpen(false)}
          onTutorial={() => {
            setHelpOpen(false);
            setTutorialOpen(true);
          }}
        />
      )}
      {tutorialOpen && !startup && <Tutorial data={data} stage={view.evolution.stage} onDone={closeTutorial} />}
    </div>
  );
}
