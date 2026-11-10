/** UI-Texte (Deutsch). Spieltexte (Karten, Zonen, Formen) kommen lokalisiert aus der GameView. */
export const de = {
  appTitle: 'Being God',
  harmony: 'Harmonie',
  breath: 'Odem',
  breathIncome: (n: number) => `+${n} nächste Runde`,
  round: (n: number) => `Runde ${n}`,
  year: (n: number) => `Jahr ${n}`,
  forecast: 'Vorschau',
  endTurn: 'Runde beenden',
  playsInfo: (done: number, min: number) => `Karten gespielt: ${done}/${min}`,
  drawPile: (n: number) => `Stapel ${n}`,
  discardPile: (n: number) => `Ablage ${n}`,
  cost: 'Kosten',
  free: 'gratis',
  notPlayable: 'Nicht spielbar',
  chooseTarget: (label: string) => `Ziel wählen: ${label}`,
  cancel: 'Abbrechen',
  close: 'Schließen',
  unsupportedSlot: (kind: string) => `Zielart „${kind}“ wird in der App noch nicht unterstützt.`,
  level: 'Stufe',
  levelProgress: 'Fortschritt zur nächsten Stufe',
  values: 'Werte',
  populations: 'Bestände',
  noPopulations: 'Noch kein Leben in dieser Zone.',
  warnings: 'Gefahren',
  neighbors: 'Nachbarn',
  formKind: {
    ideal: 'Idealform',
    normal: 'Form',
    degraded: 'verödet',
    disturbance: 'Störung',
  },
  tier: (n: number) => `Stufe ${n}`,
  toastRound: (round: number, season: string) => `Runde ${round} · ${season}`,
  toastHarmony: (delta: number) => `Harmonie ${delta > 0 ? '+' : ''}${delta}`,
  toastForm: (zone: string, from: string, to: string) => `${zone}: ${from} → ${to}`,
  toastLevel: (zone: string, level: number) => `${zone} erreicht Stufe ${level}`,
  toastLevelDown: (zone: string, level: number) => `${zone} fällt auf Stufe ${level}`,
  toastPlayed: (card: string) => `${card} gespielt`,
  toastTrigger: (icon: string, name: string, zone: string) => `${icon} ${name} in ${zone}`,
  toastDisturbance: (zone: string, form: string) => `Störung in ${zone}: ${form}`,
  toastCollapsed: 'Kollaps – die Harmonie ist erschöpft',
  toastEmergedFirst: (species: string, zone: string) => `Neues Leben: ${species} entsteht in ${zone}`,
  toastEmerged: (species: string, zone: string) => `${species} entsteht in ${zone}`,
  toastExtinct: (species: string) => `${species} ist ausgestorben`,
  toastMigrated: (species: string, from: string, to: string) => `${species} wandert von ${from} nach ${to}`,
  toastHunger: (species: string, zone: string) => `${species} hungert in ${zone}`,
  toastGift: (species: string, card: string) => `Gabe von ${species}: ${card}`,
  play: 'Spielen',
  previewTitle: 'Wirkung',
  previewNone: 'Keine sichtbare Wirkung auf die Werte.',
  previewForm: (zone: string, from: string, to: string) => `${zone}: ${from} → ${to}`,
  previewTrigger: (zone: string) => `löst aus in ${zone}`,
  notAffordable: 'Zu wenig Odem',
  changeTarget: 'Andere Zone antippen, um das Ziel zu ändern.',
  gameOverTitle: 'Die Welt ist kollabiert',
  gameOverText: 'Die Harmonie ist auf 0 gefallen. Das Leben auf der Insel kommt zur Ruhe.',
  score: 'Punkte',
  roundsSurvived: 'Runden',
  highestTier: 'Höchste Entwicklungsstufe',
  newGame: 'Neue Partie',
  newGameConfirm: 'Neue Partie beginnen? Der aktuelle Spielstand geht verloren.',
  mockBadge: 'Vorschau-Daten',
  popDelta: (species: string, delta: number) => `${species} ${delta > 0 ? '+' : '−'}${Math.abs(delta)}`,
  toastOvergrazed: (zone: string, foods: string) => `Übernutzung in ${zone}: ${foods} leergefressen`,
  toastHunted: (zone: string, losses: string) => `Menschen jagen in ${zone}: ${losses}`,
  toastPopulationShift: (card: string, zone: string, changes: string) => `${card} in ${zone}: ${changes}`,
  toastRejected: 'Zug nicht möglich',
  incompatibleTitle: 'Spielstand passt nicht',
  incompatibleText:
    'Dieser Spielstand passt nicht zur aktuellen Version des Spiels. Eine neue Partie behebt das; der alte Stand geht verloren.',
  later: 'Später',
  // Zielwahl
  chooseSpecies: (label: string) => `Art wählen: ${label}`,
  chooseOption: (label: string) => `Wählen: ${label}`,
  // Ereignis-Vorschau
  forecastWhen: (inRounds: number) =>
    inRounds <= 0 ? 'diese Runde' : inRounds === 1 ? 'nächste Runde' : `in ${inRounds} Runden`,
  forecastZone: (zone: string) => `in ${zone}`,
  forecastShowText: 'Angekündigtes Ereignis – antippen für Details',
  eventShield: (n: number) =>
    `Stille: ${n === 1 ? 'das nächste Ereignis entfällt' : `die nächsten ${n} Ereignisse entfallen`}`,
  noForecast: 'Kein Ereignis angekündigt',
  // Vorschau
  previewPopulation: (zone: string, species: string, from: number, to: number) =>
    `${zone} · ${species} ${from} → ${to}`,
  previewEvent: (change: 'cancelled' | 'delayed' | 'shielded', name: string | null, round: number | null) =>
    change === 'cancelled'
      ? `${name ?? 'Ereignis'} wird abgewendet`
      : change === 'delayed'
        ? `${name ?? 'Ereignis'} wird verschoben${round !== null ? ` auf Runde ${round}` : ''}`
        : 'Das nächste Ereignis entfällt',
  // Menü und Schöpfungsbuch
  menu: 'Menü',
  book: 'Schöpfungsbuch',
  bookGames: (n: number) => (n === 1 ? '1 Partie gespielt' : `${n} Partien gespielt`),
  bookSpecies: (found: number, total: number) => `Entdeckte Arten (${found} von ${total})`,
  bookNoSpecies: 'Noch keine Partie beendet – entdeckte Arten erscheinen hier.',
  bookMilestones: 'Meilensteine',
  bookBest: 'Bestwerte',
  bookTotals: 'Summen',
  bookTotalRounds: 'Runden',
  bookTotalExtinctions: 'Aussterben',
  bookTotalEvents: 'Ereignisse',
  bookFirstGame: (n: number) => `seit Partie ${n}`,
  // Spiel-Ende
  resultDiscovered: 'Neu entdeckt',
  resultMilestones: 'Meilensteine erreicht',
  resultUnlocked: 'Freigeschaltet',
  resultRecords: 'Neuer Bestwert',
  recordName: { score: 'Punkte', rounds: 'Runden', tier: 'Entwicklungsstufe' },
  // Ziehen
  dragHint: 'Auf eine leuchtende Zone ziehen',
  dragInvalid: (zone: string) => `${zone}: hier nicht möglich`,
  dragMoreTargets: 'Nach dem Loslassen folgen weitere Ziele.',
  dragCardLabel: (name: string) => `${name} – antippen oder auf die Insel ziehen, lange drücken für Details`,
  // Weltkarten (Wetter): wirken ohne Zielwahl auf alle Zonen
  worldShort: 'wirkt überall',
  worldHint: 'Wetter wirkt überall – jede Zone reagiert anders.',
  worldCardLabel: (name: string) =>
    `${name} – Wetter, wirkt überall. Antippen für die Vorschau oder auf die Insel ziehen zum Ausspielen`,
  worldDragHint: 'Auf die Insel ziehen und loslassen, um auszuspielen',
  worldDragArmed: 'Loslassen spielt die Karte',
  worldDragCancel: 'Zurück auf die Hand ziehen bricht ab.',
  worldDragChoice: 'Nach dem Loslassen wählst du noch eine Option.',
  worldNone: 'Keine Zone verändert sich.',
  worldBalance: (b: { better: number; worse: number; neutral: number }) => {
    const zones = (n: number) => (n === 1 ? '1 Zone' : `${n} Zonen`);
    const parts = [
      b.better > 0 ? `${zones(b.better)} näher` : '',
      b.worse > 0 ? `${b.better > 0 ? b.worse : zones(b.worse)} weiter weg` : '',
      b.neutral > 0 ? `${b.better + b.worse > 0 ? b.neutral : zones(b.neutral)} gleich` : '',
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : 'Keine Zone verändert sich.';
  },
  worldDistance: (before: number, after: number) => `Ideal ${before} → ${after}`,
  worldEffectsTitle: 'Wirkung je Zone',
  playWorld: 'Ausspielen',
  cardDetails: 'Kartendetails',
  cardDetailsHint: 'Lange drücken zeigt den ganzen Kartentext.',
  deckTitle: 'Startdeck',
  deckIntro: (min: number, max: number, copies: number) =>
    `Stelle ${min}–${max} Karten für die nächste Partie zusammen, jede höchstens ${copies}×.`,
  deckCount: (n: number, min: number, max: number) => `${n} Karten · erlaubt ${min}–${max}`,
  deckStandard: 'Standarddeck',
  deckCustom: 'Eigenes Deck',
  deckReset: 'Standard',
  deckQuickStart: 'Schnellstart',
  deckQuickHint: 'Schnellstart beginnt sofort mit dem Standarddeck.',
  deckStart: 'Starten',
  deckAdd: (name: string) => `${name} hinzufügen`,
  deckRemove: (name: string) => `${name} entfernen`,
  deckInDeck: (n: number) => `${n}× im Deck`,
  deckPool: (n: number) => `Kartenpool (${n})`,
  deckOk: 'Das Deck ist bereit.',
  deckSize: (count: number, min: number, max: number) =>
    `Das Deck hat ${count} ${count === 1 ? 'Karte' : 'Karten'} – erlaubt sind ${min}–${max}.`,
  deckCopies: (name: string, count: number, max: number) => `${name} ist ${count}× im Deck – höchstens ${max}×.`,
  deckUnknown: (name: string) => `Unbekannte Karte: ${name}.`,
  deckLocked: (name: string) => `${name} ist noch nicht freigeschaltet.`,
  // Idealform und Zielbereiche
  idealGoal: (name: string) => `Ziel: ${name}`,
  idealReached: 'Idealform erreicht',
  idealSteps: (n: number) => (n === 1 ? '1 Schritt bis zur Idealform' : `${n} Schritte bis zur Idealform`),
  targetShort: (range: string) => `Ziel ${range}`,
  targetRange: (range: string) => `Zielbereich ${range}`,
  targetStatus: { low: 'zu niedrig', ok: 'passt', high: 'zu hoch' },
  toward: { better: 'näher ans Ideal', worse: 'weiter weg', neutral: 'gleich weit' },
  towardShort: { better: 'näher', worse: 'weiter weg', neutral: 'gleich' },
  previewIdeal: (zone: string, before: number, after: number) =>
    after < before
      ? `${zone}: näher ans Ideal (${before} → ${after} Schritte)`
      : after > before
        ? `${zone}: weiter weg vom Ideal (${before} → ${after} Schritte)`
        : `${zone}: Abstand zum Ideal bleibt ${before} Schritte`,
  fxMore: (n: number) => `+${n} weitere`,
  fxDelta: (delta: number, stat: string) => `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${stat}`,
  helpIdeal: 'Zielbereiche statt Maximum',
  helpIdealText:
    'Werte gehen von 0 bis 5 – höher ist nicht besser. Jede Geografie hat eine Idealform mit Zielbereichen (z. B. Aue: Wasserstand genau 3; Urwald: Vegetation 5, Feuchte ≥ 4, Totholz 2–3). In der Zonenansicht ist der Zielbereich auf jedem Balken umrandet; daneben steht „zu niedrig“ ▾, „passt“ ✓ oder „zu hoch“ ▴.',
  helpIdealTools:
    'Senkende Karten wie Dürre, Sturm oder Frost sind Werkzeuge, wenn ein Wert über dem Zielbereich liegt. Du musst jede Runde mindestens eine Karte spielen – auch eine unbequeme.',
  helpIdealTint:
    'Beim Zielen leuchten Zonen grün (▲ näher ans Ideal), rot (▼ weiter weg) oder gelb (gleich). So siehst du sofort, wo eine Karte hilft.',
  helpWorld: 'Wetter wirkt überall',
  helpWorldText:
    'Wetter wirkt überall – jede Zone reagiert anders. Gaben, Wunder und Arten legst du gezielt. Wetterkarten (🌍) wählen kein Ziel: Zieh sie auf die Insel oder tippe sie an. Alle betroffenen Zonen leuchten zugleich grün, rot oder gelb, die Vorschau zeigt jede Zone mit ihrem Abstand zum Ideal vorher → nachher. Ob sich der Tausch lohnt, entscheidest du.',
  // Hilfe
  help: 'Hilfe',
  helpTitle: 'Kurz erklärt',
  helpForms: 'Formen einer Zone',
  helpFormText: {
    ideal: 'Die beste Lebensgrundlage. Bringt jede Runde Harmonie und lässt die Zone bis Stufe 5 wachsen.',
    normal: 'Eine gewöhnliche Form mit eigenem Lebensraum für bestimmte Arten.',
    degraded: 'Verödet: kaum Leben, kostet jede Runde Harmonie. Mit Gaben zurück ins Gleichgewicht bringen.',
    disturbance: 'Störung: ein Ausnahmezustand (z. B. Gletscher, Hochwasser). Erzeugt Druck – Chance und Risiko.',
  },
  helpSymbols: 'Symbole',
  helpSymbolList: [
    ['✦', 'Odem – bezahlt Karten. Fließt jede Runde zu, mehr bei hoher Harmonie.'],
    ['★', 'Zonenstufe 1–5. Steigt, wenn eine Zone stabil bleibt; Stufe 4–5 nur in Idealform.'],
    ['▲ ▼', 'Trend der Harmonie seit der letzten Runde.'],
    ['🔥', 'Gefahr auf einer Zone: eine Handkarte würde dort eine Schwelle auslösen.'],
    ['◯', 'Leuchtender Ring: gültiges Ziel der gewählten Karte.'],
    ['🌍', 'Wetterkarte: wirkt ohne Zielwahl auf alle Zonen, jede Zone reagiert anders.'],
  ] as [string, string][],
  helpCreatures: 'Figuren auf der Insel',
  helpCreaturesText: 'Jede Figur steht für einen Teil des Bestands einer Art.',
  groups: {
    water: 'Wasserleben',
    insect: 'Insekten',
    amphibian: 'Amphibien',
    reptile: 'Reptilien',
    bird: 'Vögel',
    mammal: 'Säugetiere',
    human: 'Menschen',
  },
  helpFog: 'Sinkt die Harmonie, wird die Insel blasser und Nebel zieht auf.',
  showTutorial: 'Einführung zeigen',
  // Einführung
  tutorialSkip: 'Überspringen',
  tutorialNext: 'Weiter',
  tutorialBack: 'Zurück',
  tutorialDone: 'Los geht’s',
  tutorialStep: (n: number, total: number) => `Schritt ${n} von ${total}`,
  tutorial: [
    {
      icon: '🏝',
      title: 'Du bist der Gott dieser Insel',
      text: 'Du setzt keine Tiere und Pflanzen – du formst Licht, Wasser und Boden. Das Leben folgt von selbst. Halte die Welt so lange wie möglich im Gleichgewicht.',
    },
    {
      icon: '✦',
      title: 'Odem',
      text: 'Karten kosten Odem (oben links). Jede Runde fließt neuer Odem zu – mehr, je gesünder die Welt ist. Wetter kostet wenig, trifft aber alle Zonen zugleich.',
    },
    {
      icon: '🂠',
      title: 'Karten spielen',
      text: 'Gaben, Wunder und Arten legst du gezielt: Tippe die Karte und dann eine leuchtende Zone – oder zieh sie direkt auf die Zone. Vor dem Bestätigen siehst du die Wirkung.',
    },
    {
      icon: '🌍',
      title: 'Wetter wirkt überall',
      text: 'Wetter wirkt überall – jede Zone reagiert anders. Gaben, Wunder und Arten legst du gezielt. Zieh eine Wetterkarte auf die Insel oder tippe sie an: Alle betroffenen Zonen leuchten zugleich auf. Ob der Tausch sich lohnt, entscheidest du.',
    },
    {
      icon: '⛰',
      title: 'Formen',
      text: 'Aus den Werten einer Zone ergibt sich ihre Form: Idealformen bringen Harmonie und Lebensraum, verödete Formen kosten Harmonie. Tippe eine Zone für Details.',
    },
    {
      icon: '🎯',
      title: 'Nicht maximieren – Zielbereich treffen',
      text: 'Jede Zone hat eine Idealform mit Zielbereichen (z. B. Aue: Wasserstand genau 3). Zu viel ist so schlecht wie zu wenig. Du musst jede Runde mindestens eine Karte spielen – auch eine unbequeme. Senkende Karten sind Werkzeuge, wenn ein Wert über dem Zielbereich liegt. Beim Zielen zeigt Grün „näher ans Ideal“, Rot „weiter weg“.',
    },
    {
      icon: '⏭',
      title: 'Runde beenden',
      text: 'Spiel mindestens eine Karte, dann „Runde beenden“. Jetzt wirkt die Natur: Jahreszeit, Heilung, Fressen, Wachsen, Evolution.',
    },
    {
      icon: '♥',
      title: 'Harmonie',
      text: 'Der Balken oben ist das Lebenszeichen der Welt. Fällt er auf 0, kollabiert sie. Bei niedriger Harmonie wird die Insel blass und neblig. Hilfe findest du jederzeit unter „?“.',
    },
  ],
};

export type Strings = typeof de;
