import { useState } from 'react';
import { t } from '../i18n/index.ts';

/** Geführte erste Partie: kurze Hinweis-Karten, jederzeit überspringbar. */
export function Tutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const steps = t.tutorial;
  const card = steps[step];
  if (!card) return null;
  const last = step === steps.length - 1;
  return (
    <div className="overlay overlay--tutorial" role="dialog" aria-modal="true" aria-labelledby="tutorial-title">
      <div className="overlay__panel tutorial" key={step}>
        <div className="tutorial__icon" aria-hidden>
          {card.icon}
        </div>
        <p className="tutorial__step">{t.tutorialStep(step + 1, steps.length)}</p>
        <h2 id="tutorial-title">{card.title}</h2>
        <p>{card.text}</p>
        <div className="tutorial__dots" aria-hidden>
          {steps.map((_, i) => (
            <i key={i} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="tutorial__actions">
          <button type="button" className="btn btn--ghost" onClick={onDone}>
            {t.tutorialSkip}
          </button>
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              {t.tutorialBack}
            </button>
          )}
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => (last ? onDone() : setStep(step + 1))}
            autoFocus
          >
            {last ? t.tutorialDone : t.tutorialNext}
          </button>
        </div>
      </div>
    </div>
  );
}
