import { useCallback, useState } from 'react';
import type { CardView, Targets } from '@core/api';
import type { GameClient } from './client/index.ts';
import { t } from './i18n/index.ts';
import { IslandScene } from './scene/IslandScene.tsx';
import { useGame } from './state/useGame.ts';
import { useTargeting } from './state/useTargeting.ts';
import { GameOver } from './ui/GameOver.tsx';
import { Hand } from './ui/Hand.tsx';
import { Hud } from './ui/Hud.tsx';
import { Toasts } from './ui/Toasts.tsx';
import { ZoneSheet } from './ui/ZoneSheet.tsx';

export function App({ client }: { client: GameClient }) {
  const { view, dispatch, newGame, toasts } = useGame(client);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);

  const play = useCallback((uid: number, targets: Targets) => dispatch({ type: 'play', uid, targets }), [dispatch]);
  const targeting = useTargeting(view, play);

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

  const zone = view.zones.find((z) => z.id === selectedZone);
  const active = targeting.targeting;

  return (
    <div className="app">
      <IslandScene
        zones={view.zones}
        selectedZone={selectedZone}
        validTargets={active ? targeting.validZones : null}
        onZoneTap={onZoneTap}
        onBackgroundTap={() => setSelectedZone(null)}
      />

      <div className="top">
        <Hud view={view} isMock={client.isMock} />
        <Toasts toasts={toasts} />
      </div>

      <footer className="dock">
        {active && targeting.slot && (
          <div className="target-banner" role="status">
            <div>
              <b>{active.card.name}</b>
              <span>
                {targeting.slotSupported
                  ? t.chooseTarget(targeting.slot.label)
                  : t.unsupportedSlot(targeting.slot.kind)}
              </span>
              <small>{active.card.text}</small>
            </div>
            <button type="button" className="btn" onClick={targeting.cancel}>
              {t.cancel}
            </button>
          </div>
        )}
        {zone && !active && <ZoneSheet zone={zone} zones={view.zones} onClose={() => setSelectedZone(null)} />}
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
              dispatch({ type: 'endTurn' });
            }}
          >
            {t.endTurn}
          </button>
        </div>
        <Hand cards={view.hand} activeUid={active?.card.uid ?? null} onCardTap={onCardTap} />
      </footer>

      {view.phase === 'over' && (
        <GameOver
          view={view}
          onNewGame={() => {
            setSelectedZone(null);
            targeting.cancel();
            newGame();
          }}
        />
      )}
    </div>
  );
}
