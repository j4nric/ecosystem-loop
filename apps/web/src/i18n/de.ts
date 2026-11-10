/**
 * UI-Texte (Deutsch). Namen von Landschaften, Karten, Jahreszeiten und Monaten stehen in den Spieldaten
 * (packages/herde/data, `name.de`); hier stehen nur Sätze und Beschriftungen der Oberfläche.
 */
/**
 * Regelzahlen für Texte (aus `data.params`, siehe `ruleNumbers` in `logic/format.ts`), damit die Oberfläche
 * nichts behauptet, was die Daten anders festlegen.
 */
export interface RuleNumbers {
  /** Jahreszeit mit Nachwuchs und Monat darin (1 = erster Monat der Jahreszeit) */
  birthSeason: string;
  birthMonth: number;
  /** Wildnis, bei der die Eiszeit beginnt */
  wildMax: number;
  /** Dauer der Eiszeit in Monaten */
  iceMonths: number;
  /** höchstens so viele Karten auf der Hand */
  handMax: number;
  /** Zahl der Nachbarfelder, aus denen die Herde frisst */
  neighbors: number;
}

const months = (n: number) => `${n} ${n === 1 ? 'Monat' : 'Monate'}`;

export const de = {
  appTitle: 'Die Herde',
  // Statusleiste
  herd: 'Herde',
  fat: 'Vorrat',
  wolves: 'Wölfe',
  wild: 'Wildnis',
  iceAge: 'Eiszeit',
  iceLeft: (n: number) => `noch ${n} Mon.`,
  statusLabel: (herd: number, fat: number, fatMax: number, wolves: number) =>
    `Herde ${herd}, Vorrat ${fat} von ${fatMax}, Wölfe ${wolves}`,
  // Jahreskreis
  date: (year: number, month: string) => `Jahr ${year} · ${month}`,
  seasonHint: (season: string, r: RuleNumbers): string | undefined => {
    const hint = (
      {
        spring: 'Gras wächst',
        summer: 'Die Herde braucht Wasser, Altwald kann brennen',
        autumn: 'Das Gras wächst langsamer, Vorrat anfressen',
        winter: 'Kein Gras, die Herde braucht Schutz',
      } as Record<string, string>
    )[season];
    return hint && r.birthSeason === season ? `${hint}, Nachwuchs im ${r.birthMonth}. Monat` : hint;
  },
  seasonHintFallback: 'Die Herde zieht weiter',
  iceHint: (n: number) => `Eiszeit: noch ${n} ${n === 1 ? 'Monat' : 'Monate'} Winter`,
  // Absicht
  intent: {
    avoidWolves: 'weicht den Wölfen aus',
    seekWater: 'sucht Wasser',
    seekShelter: 'sucht Schutz vor der Kälte',
    freshGrass: 'zieht zu frischem Gras',
    stay: 'grast hier weiter',
  } as Record<string, string>,
  intentLine: (reason: string) => `Die Herde ${reason}`,
  stays: '(bleibt)',
  intentSame: 'Die Absicht der Herde bleibt gleich.',
  // Hand und Steuerung
  hand: 'Hand',
  emptyHand: 'Keine Karten. Neue gibt es zu Beginn der nächsten Jahreszeit.',
  noTargets: 'Gerade kein passendes Feld',
  wildCost: (n: number) => `Wildnis +${n}`,
  pickField: 'Tippe ein hervorgehobenes Feld.',
  play: 'Ausspielen',
  place: 'Legen',
  cancel: 'Abbrechen',
  close: 'Schließen',
  playSeason: 'Jahreszeit spielen',
  playMonth: '1 Monat',
  stop: 'Anhalten',
  log: 'Geschehen',
  logEmpty: 'Noch ist nichts geschehen.',
  menu: 'Menü',
  help: 'Hilfe',
  newGame: 'Neue Partie',
  newGameConfirm: 'Die laufende Partie beenden und eine neue beginnen?',
  // Vorschau
  previewTitle: 'Vorschau',
  previewCell: (from: string, to: string) => `${from} → ${to}`,
  previewFood: (from: number, to: number) => `Futter ${from} → ${to}`,
  previewGrow: (n: number) => `Gras wächst auf ${n} ${n === 1 ? 'Feld' : 'Feldern'}.`,
  previewFire: 'Feuer kann auf benachbartes Gehölz überspringen.',
  previewPackGone: 'Das Wolfsrudel dort wird vertrieben.',
  previewIntentChanged: 'Neue Absicht:',
  // Feld-Info
  fertile: 'fruchtbar',
  food: (n: number, max: number) => `Futter ${n} von ${max}`,
  forecastUngrazedSoon: (to: string, n: number) =>
    `Wird in ${n} ${n === 1 ? 'Monat' : 'Monaten'} zu ${to}, wenn die Herde hier nicht grast.`,
  forecastUngrazedHold: (land: string) => `Bleibt ${land}, solange die Herde hier grast.`,
  forecastAge: (to: string, n: number, fertile: boolean) =>
    `Wird in ${n} ${n === 1 ? 'Monat' : 'Monaten'} zu ${fertile ? 'fruchtbarer ' : ''}${to}.`,
  infoWildfire: 'Trocken: kann in der Feuer-Jahreszeit von selbst brennen.',
  infoWater: 'Wasser: Tränke für die Herde im Sommer.',
  infoShelter: 'Gehölz: Schutz im Winter, Lebensraum der Wölfe.',
  infoBlocked: 'Die Herde kann hier nicht hin.',
  infoSparse: 'Karg: wächst nur im Frühling ein wenig.',
  infoHerd: (n: number) => `Hier steht die Herde (${n} Tiere).`,
  infoPack: (size: number, hungry: boolean) =>
    `Wolfsrudel der Stärke ${size}${hungry ? ', hungrig: zieht durchs Gehölz zur Herde' : ''}.`,
  // Meldungen (Toasts und Protokoll)
  evCardPlayed: (card: string) => `${card} gelegt.`,
  evCardsDrawn: (cards: string) => `Neue Karten: ${cards}.`,
  evSuccession: (from: string, to: string, n: number) => `${from} wird zu ${to}${n > 1 ? ` (${n} Felder)` : ''}.`,
  evRain: (n: number) => `Regen: Das Gras wächst auf ${n} Feldern.`,
  evLightning: (n: number) => `Blitz: ${n} ${n === 1 ? 'Feld brennt' : 'Felder brennen'} nieder.`,
  evWildfire: (n: number) => `Waldbrand! ${n} ${n === 1 ? 'Feld brennt' : 'Felder brennen'}.`,
  evHerdMoved: (reason: string, arrow: string) => `Die Herde ${reason} ${arrow}`,
  evHerdHungry: (eaten: number, need: number) => `Zu wenig Futter (${eaten} von ${need}), der Vorrat schwindet.`,
  evStarved: (n: number) => `Hunger: −${n} ${n === 1 ? 'Tier' : 'Tiere'}.`,
  evThirsted: (n: number) => `Durst: −${n} ${n === 1 ? 'Tier' : 'Tiere'}.`,
  evFroze: (n: number) => `Kälte ohne Schutz: −${n} ${n === 1 ? 'Tier' : 'Tiere'}.`,
  evBurned: (n: number) => `Das Feuer erfasst die Herde: −${n}.`,
  evBorn: (n: number) => `Nachwuchs: ${n} ${n === 1 ? 'Kalb' : 'Kälber'} geboren.`,
  evHunted: (n: number) => `Wölfe reißen ${n} ${n === 1 ? 'Tier' : 'Tiere'}.`,
  evPackMoved: 'Ein hungriges Rudel zieht durchs Gehölz zur Herde.',
  evPackGrew: (n: number) => `Ein Wolfsrudel wird stärker (${n}).`,
  evPackFounded: 'Ein neues Wolfsrudel gründet sich.',
  evPackStarved: 'Ein Wolfsrudel hungert und wird schwächer.',
  evPackGone: {
    starved: 'Ein Wolfsrudel ist verhungert.',
    fire: 'Das Feuer vertreibt ein Wolfsrudel.',
    driven: 'Ein Wolfsrudel hat seinen Lebensraum verloren.',
  } as Record<string, string>,
  evPackImmigrated: 'Wölfe wandern in die Wälder ein.',
  evSeason: (season: string, year: number) => `${season} im Jahr ${year}.`,
  evIceBegan: (n: number) => `Die Eiszeit beginnt: ${n} Monate Winter.`,
  evIceEnded: (n: number) => `Die Eiszeit ist vorbei. ${n} Tiere haben überlebt.`,
  evLost: 'Die Herde ist ausgestorben.',
  evTraitOffered: (traits: string) => `Die Herde kann ein Merkmal entwickeln: ${traits}.`,
  evTraitPicked: (trait: string) => `Neues Merkmal: ${trait}.`,
  evMatured: (next: string) => `Die Herde ist reif für die nächste Stufe: ${next}.`,
  evEvolved: (stage: string) => `Die Herde wird zu: ${stage}.`,
  evRejected: 'Das geht hier nicht.',
  // Ende
  wonTitle: 'Geschafft',
  wonText: (n: number) =>
    `Die Herde hat die Eiszeit überstanden. ${n} ${n === 1 ? 'Tier hat' : 'Tiere haben'} überlebt.`,
  lostTitle: 'Die Herde ist ausgestorben',
  lostText: 'Die Insel lebt weiter – ohne sie. Versuch es mit einer neuen Herde.',
  survivors: 'Überlebende',
  duration: 'Dauer',
  durationValue: (years: number, months: number) =>
    years > 0 ? `${years} J. ${months} Mon.` : `${months} ${months === 1 ? 'Monat' : 'Monate'}`,
  wildReached: 'Wildnis',
  viewIsland: 'Insel ansehen',
  overBar: (won: boolean): string => (won ? 'Die Partie ist gewonnen.' : 'Die Partie ist verloren.'),
  // Spielstand
  legacyTitle: 'Neues Spiel',
  legacyText:
    'Being God ist jetzt „Die Herde“. Dein alter Spielstand stammt aus der früheren Version und passt nicht mehr – er wurde verworfen. Viel Freude mit der neuen Partie!',
  incompatibleTitle: 'Spielstand passt nicht mehr',
  incompatibleText:
    'Dein gespeicherter Spielstand passt nicht zur aktuellen Version des Spiels und wurde verworfen. Eine neue Partie hat begonnen.',
  ok: 'Weiter',
  // Einführung
  tutorial: (r: RuleNumbers) => [
    {
      icon: '🐑',
      title: 'Die Herde zieht selbst',
      text: 'Jeden Monat zieht die Herde höchstens ein Feld weiter – zu Gras, im Sommer zu Wasser, im Winter in den Schutz von Gehölz, weg von Wölfen. Der Pfeil auf der Insel zeigt, wohin sie als Nächstes will.',
    },
    {
      icon: '🌱',
      title: 'Du formst die Landschaft',
      text: 'Du steuerst die Herde nie direkt. Tippe eine Karte und dann ein leuchtendes Feld: Säe Wiese, pflanze Bäume, lass eine Quelle entspringen, setze Fels oder Blitz. So lockst du die Herde – oder schreckst sie ab.',
    },
    {
      icon: '🌲',
      title: 'Die Welt verändert sich von selbst',
      text: 'Unbeweidete Wiese verbuscht, Busch wird Wald, Wald wird Altwald, Altwald kann im Sommer brennen, Brandfläche wird fruchtbare Wiese. Im Gehölz leben Wölfe – Waldkorridore sind Wolfswege. Tippe ein Feld, um zu sehen, was dort geschehen wird.',
    },
    {
      icon: '❄️',
      title: 'Wildnis und Eiszeit',
      text: `Jeder Monat und jede gelegte Karte lässt die Wildnis wachsen. Bei ${r.wildMax} beginnt die Eiszeit: ${months(r.iceMonths)} Winter ohne Nachwuchs. Bring die Herde hindurch, dann ist das Zeitalter gewonnen.`,
    },
    {
      icon: '▶',
      title: 'Jahreszeit spielen',
      text: 'Lege deine Karten und lass dann eine Jahreszeit ablaufen. Zu Beginn jeder Jahreszeit bekommst du neue Karten. Abgelegt wird nichts – was du nicht legst, bleibt auf der Hand.',
    },
  ],
  tutorialStep: (n: number, total: number) => `${n} von ${total}`,
  tutorialNext: 'Weiter',
  tutorialBack: 'Zurück',
  tutorialSkip: 'Überspringen',
  tutorialDone: 'Los geht’s',
  showTutorial: 'Einführung zeigen',
  // Hilfe
  helpTitle: 'So spielst du',
  helpGoal: 'Ziel',
  helpGoalText: (r: RuleNumbers) =>
    `Bring die Herde durch die Eiszeit. Sie beginnt, wenn die Wildnis ${r.wildMax} erreicht – jeder Monat und jede Karte lässt sie wachsen. Wer viel eingreift, ist besser vorbereitet, ruft die Prüfung aber früher herbei.`,
  helpHerd: 'Die Herde',
  helpHerdText: (r: RuleNumbers) =>
    `Sie zieht jeden Monat höchstens ein Feld und frisst aus dem eigenen und den ${r.neighbors} Nachbarfeldern. Überschuss wird Vorrat, Mangel zehrt ihn auf, danach sterben Tiere. Sommer: Durst ohne Wasser in der Nähe. Winter: Kälte ohne Gehölz in der Nähe. Frühling: Nachwuchs, je nach Vorrat.`,
  helpCards: 'Karten',
  helpCardsText: (r: RuleNumbers) =>
    `Zu Beginn jeder Jahreszeit ziehst du neue Karten, höchstens ${r.handMax} auf der Hand. Karte antippen, dann ein leuchtendes Feld – die Vorschau zeigt, was mit dem Feld geschieht und ob die Herde ihre Absicht ändert. Regen wirkt auf die ganze Insel.`,
  helpWorld: 'Die Welt lebt',
  helpWorldText:
    'Landschaft wandelt sich von selbst. Wölfe leben im Gehölz, ziehen hungrig durch Waldkorridore zur Herde und reißen Tiere in ihrer Nähe. Feuer und Fels vertreiben sie.',
  helpLands: 'Landschaften',
  helpControls: 'Steuerung',
  helpControlsText:
    '„Jahreszeit spielen“ lässt die Monate bis zur nächsten Jahreszeit ablaufen, „1 Monat“ nur einen. Ziehen dreht die Insel ein wenig.',
};

export type Strings = typeof de;
