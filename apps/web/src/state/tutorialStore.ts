/** Ob die Einführung schon gesehen wurde – in localStorage; Fehler (privater Modus) werden geschluckt. */
const KEY = 'being-god.herde.tutorial.v1';

export function hasSeenTutorial(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'done';
  } catch {
    return false;
  }
}

export function markTutorialSeen(): void {
  try {
    window.localStorage.setItem(KEY, 'done');
  } catch {
    // Speichern ist Komfort
  }
}
