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
  /** Zahl der Nachbarfelder, aus denen die Herde frisst (aus dem Umkreis der aktuellen Stufe) */
  neighbors: number;
  /** Felder je Monat der aktuellen Stufe */
  move: number;
  /** Jahreszeiten (Namen), in denen die aktuelle Stufe Wasser bzw. Schutz braucht */
  water: SeasonSet;
  shelter: SeasonSet;
  /** die so vielte Eiszeit ist die letzte Prüfung (null = unbegrenzt) */
  iceAges: number | null;
  /** Wildnis nach einer überstandenen Eiszeit ohne Sieg */
  wildAfter: number;
}

/** Regeln zu Wild, Jagd, Feuer und Lager für Hilfe-Texte (aus `data.params` und den Stufen, siehe `huntRules`). */
export interface HuntRules {
  /** Stufe, ab der Wild einwandert (Name) */
  preyFrom: string;
  /** Lebensraum des Wilds (Namen) */
  preyLands: string[];
  preyMax: number;
  /** so viele Felder Lebensraum braucht das Einwandern */
  spawnMinLand: number;
  spawnSize: number;
  /** Stufen, die jagen: Name, Futter je Tier, Tiere je Monat, mehr im Feuer */
  hunters: { name: string; food: number; kill: number; fire: number }[];
  /** Stufen, für die Wölfe Konkurrenten sind (Namen) */
  rivals: string[];
  /** Brandfläche gilt so lange als frisch (0 = nur in diesem Monat) */
  fresh: number;
  /**
   * Lager: Stufe, Umkreis, Landschafts-Gruppen (je Gruppe „Wald oder Altwald“), begehbare Landschaften, auf denen kein
   * Lager stehen darf (nicht in `camp.on`, z. B. Fluss), Rodung
   */
  camp: {
    stage: string;
    radius: number;
    near: string[];
    notOn: string[];
    clear: { lands: string[]; to: string; month: string } | null;
  } | null;
}

/** Jahreszeiten als Namen; `all`, wenn es alle Jahreszeiten sind. */
export interface SeasonSet {
  names: string[];
  all: boolean;
}

/** Was in einer Jahreszeit gilt (für den Hinweis im Jahreskreis). */
export interface SeasonNeeds {
  water: boolean;
  shelter: boolean;
  fire: boolean;
}

const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
const orList = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} oder ${names[names.length - 1]}`;
/** „im Sommer“, „im Frühling und Sommer“, „das ganze Jahr“, „nie“ */
const when = (s: SeasonSet) => (s.all ? 'das ganze Jahr' : s.names.length === 0 ? 'nie' : `im ${list(s.names)}`);
const fields = (n: number) => `${n} ${n === 1 ? 'Feld' : 'Felder'}`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const months = (n: number) => `${n} ${n === 1 ? 'Monat' : 'Monate'}`;
const stocks = (n: number) => `${n} ${n === 1 ? 'Bestand' : 'Bestände'}`;
const animals = (n: number) => `${n} ${n === 1 ? 'Tier' : 'Tiere'}`;
/** „in diesem Monat“, „in diesem oder im letzten Monat“, „in den letzten 3 Monaten“ */
const freshWhen = (n: number) =>
  n <= 0 ? 'in diesem Monat' : n === 1 ? 'in diesem oder im letzten Monat' : `in den letzten ${n + 1} Monaten`;
const iceAgeOf = (n: number, max: number | null) => (max === null ? `${n}. Eiszeit` : `Eiszeit ${n} von ${max}`);

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
  prey: 'Wild',
  preyLabel: (stockCount: number, animalCount: number) =>
    stockCount > 0 ? `Wild: ${stocks(stockCount)}, ${animals(animalCount)}` : 'Kein Wild auf der Insel',
  iceAgeOf,
  /** kurz am Jahreskreis */
  iceAgeChip: (n: number, max: number | null) => (max === null ? `❄ ${n}` : `❄ ${n}/${max}`),
  iceAgeNext: (n: number, max: number | null) =>
    `Nächste Prüfung: ${iceAgeOf(n, max)}${max !== null && n >= max ? ' – die letzte' : ''}`,
  // Jahreskreis
  date: (year: number, month: string) => `Jahr ${year} · ${month}`,
  /** Grundton der Jahreszeit (Gras), dazu die Bedürfnisse der aktuellen Stufe, Brandgefahr und Nachwuchs. */
  seasonHint: (season: string, r: RuleNumbers, needs: SeasonNeeds): string | undefined => {
    const base = (
      {
        spring: 'Gras wächst',
        summer: '',
        autumn: 'Das Gras wächst langsamer, Vorrat anfressen',
        winter: 'Kein Gras',
      } as Record<string, string>
    )[season];
    if (base === undefined) return undefined;
    const need = [needs.water ? 'Wasser' : '', needs.shelter ? 'Schutz' : ''].filter(Boolean);
    const parts = [
      base,
      need.length > 0 ? `die Herde braucht ${list(need)}` : '',
      needs.fire ? 'Altwald kann brennen' : '',
      r.birthSeason === season ? `Nachwuchs im ${r.birthMonth}. Monat` : '',
    ].filter(Boolean);
    return parts.length > 0 ? capitalize(parts.join(', ')) : undefined;
  },
  seasonHintFallback: 'Die Herde zieht weiter',
  iceHint: (n: number) => `Eiszeit: noch ${n} ${n === 1 ? 'Monat' : 'Monate'} Winter`,
  // Absicht
  intent: {
    avoidWolves: 'weicht den Wölfen aus',
    seekWater: 'sucht Wasser',
    seekShelter: 'sucht Schutz vor der Kälte',
    freshGrass: 'zieht zu frischem Futter',
    stay: 'grast hier weiter',
    settled: 'bleibt am Lager',
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
  infoWater: (s: SeasonSet) => `Wasser: Tränke für die Herde ${when(s)}.`,
  infoShelter: (s: SeasonSet) => `Schutz für die Herde ${when(s)}.`,
  infoWolves: 'Gehölz: Lebensraum der Wölfe.',
  infoBlocked: 'Die Herde kann hier nicht hin.',
  infoStageBlocked: (stage: string) => `Für diese Stufe unpassierbar (${stage}).`,
  infoNoFood: (stage: string) => `Kein Futter für die Stufe ${stage}.`,
  previewBlocked: 'Danach für diese Stufe unpassierbar.',
  previewWasBlocked: 'Bisher für diese Stufe unpassierbar.',
  previewStillBlocked: 'Für diese Stufe unpassierbar.',
  infoSparse: 'Karg: wächst nur im Frühling ein wenig.',
  infoHerd: (n: number) => `Hier steht die Herde (${n} Tiere).`,
  infoPack: (size: number, hungry: boolean) =>
    `Wolfsrudel der Stärke ${size}${hungry ? ', hungrig: zieht durchs Gehölz zu Wild oder Herde' : ''}.`,
  infoPrey: (size: number, max: number, hungry: boolean) =>
    `Wild: ${size} von ${max} Tieren${hungry ? ' – hungrig, zieht weiter und schrumpft bald' : ''}.`,
  infoPreyReach: 'In Jagdweite der Herde.',
  infoPreyLand: 'Lebensraum des Wilds.',
  infoCamp: 'Hier steht das Lager der Herde.',
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
  evPackMoved: 'Ein hungriges Rudel zieht durchs Gehölz – zum Wild oder zur Herde.',
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
  evLostLastIce: 'Die letzte Eiszeit ist vorbei – die Herde hat kein Lager als Mensch erreicht.',
  evIceSurvived: (count: number) => `${count}. Eiszeit überstanden – das Zeitalter geht weiter.`,
  // Wild und Lager
  evPreyGrew: 'Das Wild vermehrt sich.',
  evPreyFounded: 'Neues Wild auf der Weide.',
  evPreyStarved: (gone: boolean): string => (gone ? 'Ein Wildbestand ist verhungert.' : 'Das Wild hungert.'),
  evPreyGone: 'Das Wild ist verschwunden.',
  evPreyImmigrated: 'Wild wandert auf die Insel ein.',
  evPreyHunted: (n: number, fire: boolean) =>
    `Jagd: ${n} Wild erlegt${fire ? ' – das Feuer hat es aufgetrieben' : ''}.`,
  evPackAtePrey: 'Wölfe reißen Wild.',
  evCampFounded: 'Die Herde gründet ein Lager und wird sesshaft.',
  evFieldCleared: (from: string, to: string) => `Rodung am Lager: ${from} wird ${to}.`,
  evTraitOffered: (traits: string) => `Merkmale zur Wahl: ${traits}.`,
  evTraitPicked: (trait: string, effect: string) => `Die Herde entwickelt ${trait}: ${effect}`,
  evMatured: (next: string) => `Die Herde ist reif für den Sprung: ${next}.`,
  evEvolved: (from: string, to: string) => `Neue Stufe: ${to} (bisher ${from}).`,
  evRejected: 'Das geht hier nicht.',
  // Ende
  wonTitle: 'Geschafft',
  wonText: (n: number) =>
    `Die Herde ist Mensch geworden, hat ein Lager gegründet und die letzte Eiszeit überstanden. ${n} ${n === 1 ? 'Mensch hat' : 'Menschen haben'} überlebt.`,
  lostTitle: 'Die Herde ist ausgestorben',
  lostText: 'Die Insel lebt weiter – ohne sie. Versuch es mit einer neuen Herde.',
  lostIceTitle: 'Die letzte Eiszeit ist vorbei',
  lostIceText: (human: boolean, stage: string) =>
    human
      ? 'Die Herde hat überlebt und ist Mensch geworden – aber ohne Lager. Das Zeitalter ist verloren.'
      : `Die Herde hat überlebt, ist aber nicht Mensch geworden (zuletzt: ${stage}). Das Zeitalter ist verloren.`,
  survivors: 'Überlebende',
  duration: 'Dauer',
  durationValue: (years: number, months: number) =>
    years > 0 ? `${years} J. ${months} Mon.` : `${months} ${months === 1 ? 'Monat' : 'Monate'}`,
  stageReached: 'Stufe',
  traitsCount: 'Merkmale',
  iceAgesLabel: 'Eiszeiten',
  iceAgesValue: (n: number, max: number | null) => (max === null ? `${n}` : `${n} von ${max}`),
  viewIsland: 'Insel ansehen',
  overBar: (won: boolean): string => (won ? 'Die Partie ist gewonnen.' : 'Die Partie ist verloren.'),
  // Spielstand
  legacyTitle: 'Neues Spiel',
  legacyText:
    'Being God ist jetzt „Die Herde“. Dein alter Spielstand stammt aus der früheren Version und passt nicht mehr – er wurde verworfen. Viel Freude mit der neuen Partie!',
  incompatibleTitle: 'Spielstand passt nicht mehr',
  incompatibleText:
    'Dein gespeicherter Spielstand passt nicht zur aktuellen Version des Spiels und wurde verworfen. Eine neue Partie hat begonnen.',
  outdatedTitle: 'Die Herde entwickelt sich jetzt',
  outdatedText:
    'Neu: Die Herde sammelt Erfahrungen, bekommt Merkmale und kann sich weiterentwickeln. Dein Spielstand stammt aus einer älteren Version und passt nicht mehr – eine neue Partie hat begonnen.',
  ok: 'Weiter',
  // Einführung
  tutorial: (r: RuleNumbers) => [
    {
      icon: '🐑',
      title: 'Die Herde zieht selbst',
      text: `Jeden Monat zieht die Herde höchstens ${r.move === 1 ? 'ein Feld' : `${r.move} Felder`} weiter – zu Futter, ${when(r.water)} zu Wasser, ${when(r.shelter)} in den Schutz von Gehölz, weg von Wölfen. Der Pfeil auf der Insel zeigt, wohin sie als Nächstes will.`,
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
      icon: '✨',
      title: 'Die Herde entwickelt sich',
      text: 'Was die Herde erlebt, macht sie stärker: Kälte im Schutz, Wolfsangriffe, Brände, weite Wege. Zu Beginn einer Jahreszeit bietet sie dir Merkmale an – wähle eines oder warte. Mit genug Merkmalen ist sie reif für die nächste Stufe: Waldsammler, Wanderer, eines Tages Menschen. Jede Stufe braucht eine andere Insel, und der Sprung ist ohne Zurück. Bereite die Landschaft rechtzeitig vor – Wald wächst nicht über Nacht.',
    },
    {
      icon: '❄️',
      title: 'Wildnis und Eiszeit',
      text: `Jeder Monat und jede gelegte Karte lässt die Wildnis wachsen. Bei ${r.wildMax} beginnt eine Eiszeit: ${months(r.iceMonths)} Winter ohne Nachwuchs. Ziel: Werde Mensch und übersteh mit einem Lager die letzte${r.iceAges === null ? '' : `, die ${r.iceAges}.`} Eiszeit.`,
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
    `Entwickle die Herde bis zum Menschen, gründe ein Lager und übersteh die letzte${r.iceAges === null ? '' : `, die ${r.iceAges}.`} Eiszeit. Eine Eiszeit beginnt, wenn die Wildnis ${r.wildMax} erreicht – jeder Monat und jede Karte lässt sie wachsen. Wer viel eingreift, ist besser vorbereitet, ruft die Prüfung aber früher herbei.`,
  helpPrey: 'Wild und Jagd',
  helpPreyText: (h: HuntRules) =>
    `Wild lebt auf ${orList(h.preyLands)} in Beständen von 1 bis ${h.preyMax} Tieren und frisst dort Gras. Satt wächst ein Bestand und gründet neue, hungrig zieht er weiter und schrumpft. Sobald die Herde die Stufe ${h.preyFrom} erreicht hat, wandert Wild ein (${animals(h.spawnSize)}), wenn es mindestens ${h.spawnMinLand} Felder Lebensraum gibt. ${h.hunters.map((x) => `Als ${x.name} jagt die Herde im Umkreis: bis ${animals(x.kill)} je Monat, ${x.food} Futter je Tier.`).join(' ')} Wölfe fressen zuerst Wild${h.rivals.length > 0 ? ` – für ${list(h.rivals)} sind sie Konkurrenten, keine Feinde` : ''}.`,
  helpFire: 'Feuer als Werkzeug',
  helpFireText: (h: HuntRules) =>
    `Für Jäger ist Feuer kein Feind mehr: Liegt im Umkreis der Herde eine Brandfläche, die ${freshWhen(h.fresh)} gebrannt hat, treibt das Feuer Wild auf. ${h.hunters
      .filter((x) => x.fire > 0)
      .map((x) => `Als ${x.name} erlegt die Herde dann ${animals(x.fire)} mehr.`)
      .join(' ')} Der Blitz zählt mit – leg ihn gezielt neben die Herde.`,
  helpCamp: 'Lager',
  helpCampText: (h: HuntRules) =>
    h.camp
      ? `Als ${h.camp.stage} lässt sich die Herde nieder. Ein Lagerplatz braucht im Umkreis ${h.camp.radius} ${list(h.camp.near)} und muss in diesem Monat erreichbar sein.${h.camp.notOn.length > 0 ? ` Felder mit ${orList(h.camp.notOn)} sind kein Lagerplatz.` : ''} Die Plätze leuchten auf der Insel; antippen zeigt eine Vorschau. Danach zieht die Herde nicht mehr und lebt aus dem Umkreis des Lagers.${h.camp.clear ? ` Jedes Jahr im ${h.camp.clear.month} rodet das Lager ein Feld ${orList(h.camp.clear.lands)} zu ${h.camp.clear.to}.` : ''} In der Eiszeit wird kein Lager gegründet.`
      : 'Keine Stufe gründet ein Lager.',
  helpIce: 'Eiszeiten und Sieg',
  helpIceText: (r: RuleNumbers) =>
    `Jede Eiszeit ist eine Prüfung unterwegs: ${months(r.iceMonths)} Winter ohne Nachwuchs. Übersteht die Herde sie, fällt die Wildnis auf ${r.wildAfter} und die nächste kommt bei ${r.wildMax}. Gewonnen ist das Zeitalter, wenn die Herde eine Eiszeit als Mensch mit Lager übersteht.${r.iceAges === null ? '' : ` Die ${r.iceAges}. Eiszeit ist die letzte Prüfung: Wer sie nicht als Mensch mit Lager übersteht, verliert.`}`,
  helpHerd: 'Die Herde',
  helpHerdText: (r: RuleNumbers) =>
    `Sie zieht jeden Monat höchstens ${r.move === 1 ? 'ein Feld' : `${r.move} Felder`} und frisst aus dem eigenen und den ${r.neighbors} Nachbarfeldern. Überschuss wird Vorrat, Mangel zehrt ihn auf, danach sterben Tiere. ${capitalize(when(r.water))}: Durst ohne Wasser in der Nähe. ${capitalize(when(r.shelter))}: Kälte ohne Schutz in der Nähe. Nachwuchs gibt es je nach Vorrat. Was Futter, Wasser und Schutz ist, hängt von der Stufe ab (siehe unten).`,
  helpEvolution: 'Entwicklung',
  helpEvolutionText:
    'Die Herde zählt, was sie erlebt. Erreicht eine Erfahrung ihre Schwelle, wird ein Merkmal verfügbar; zu Beginn jeder Jahreszeit bietet die Herde einige an. Du wählst eines oder lässt das Angebot liegen – dann kommen zur nächsten Jahreszeit andere an die Reihe. Die Wirkung der Merkmale bleibt über alle Stufen. Hat die Herde auf ihrer Stufe genug neue Merkmale gewählt (darunter ein bestimmtes), ist sie reif – frühere Merkmale zählen dafür nicht: Dann entscheidest du, wann sie den Sprung zur nächsten Stufe macht. Kein Zurück – und jede Stufe braucht andere Landschaft. Tippe unten rechts auf das Symbol der Herde für den Stand und die Vorschau.',
  helpTraits: 'Merkmale',
  helpStages: 'Stufen',
  helpTraitFrom: (experience: string, at: number) => `ab ${at} × ${experience}`,
  helpStageMature: (traits: number, oneOf: string[]) =>
    `Reif mit ${traits} ${traits === 1 ? 'neuen Merkmal' : 'neuen Merkmalen'}${oneOf.length > 0 ? `, darunter ${orList(oneOf)}` : ''}.`,
  helpCards: 'Karten',
  helpCardsText: (r: RuleNumbers) =>
    `Zu Beginn jeder Jahreszeit ziehst du neue Karten, höchstens ${r.handMax} auf der Hand. Karte antippen, dann ein leuchtendes Feld – die Vorschau zeigt, was mit dem Feld geschieht und ob die Herde ihre Absicht ändert. Regen wirkt auf die ganze Insel.`,
  helpWorld: 'Die Welt lebt',
  helpWorldText:
    'Landschaft wandelt sich von selbst. Wölfe leben im Gehölz, fressen zuerst Wild, ziehen hungrig durch Waldkorridore zu Wild oder Herde und reißen sonst Tiere der Herde. Feuer und Fels vertreiben sie.',
  helpLands: 'Landschaften',
  helpControls: 'Steuerung',
  helpControlsText:
    '„Jahreszeit spielen“ lässt die Monate bis zur nächsten Jahreszeit ablaufen, „1 Monat“ nur einen. Ziehen dreht die Insel ein wenig.',
  // Herde und Entwicklung
  evoOpen: 'Herde und Entwicklung',
  evoTitle: 'Herde und Entwicklung',
  evoNeeds: 'Bedürfnisse',
  evoTraits: 'Merkmale',
  evoNoTraits: 'Noch keine Merkmale. Sie entstehen aus dem, was die Herde erlebt.',
  evoExperience: 'Erfahrung',
  evoExperienceNext: (trait: string) => `→ ${trait}`,
  evoExperienceDone: 'alles erreicht',
  evoInOffer: 'im Angebot',
  evoLater: 'erreicht – kommt in einem späteren Angebot',
  evoForMaturity: 'für die Reife',
  evoMaturity: 'Reife',
  evoCounted: (n: number, required: number) =>
    `Auf dieser Stufe gewählt: ${n} von ${required} ${required === 1 ? 'Merkmal' : 'Merkmalen'}. Frühere Merkmale wirken weiter, zählen aber nicht.`,
  evoCountsTag: 'zählt für die Reife',
  evoEarlierTag: 'frühere Stufe – wirkt, zählt nicht',
  evoMissing: (traits: number, oneOf: string[] | null) => {
    const parts: string[] = [];
    if (traits > 0) parts.push(`noch ${traits} ${traits === 1 ? 'Merkmal' : 'Merkmale'}`);
    if (oneOf && oneOf.length > 0)
      parts.push(oneOf.length === 1 ? `darunter ${oneOf[0]}` : `darunter ${orList(oneOf)}`);
    return parts.length > 0 ? `Zur Reife fehlen auf dieser Stufe ${parts.join(', ')}.` : 'Reif für den Sprung.';
  },
  evoMature: (next: string) => `Reif! Die Herde kann zu ${next} werden.`,
  evoLast: 'Höchste Stufe dieser Version. Weitere Stufen folgen.',
  evoNext: (stage: string) => `Nächste Stufe: ${stage}`,
  evoNextLabel: 'Nächste Stufe',
  evoCurrentLabel: 'Aktuelle Stufe',
  evoNextIntro: 'Was sie braucht – und was die Insel heute bietet:',
  evoNextReady: 'Die Insel bietet schon alles Nötige.',
  evoNextMissing: (what: string[]) => `Bereite die Insel vor: Es fehlt ${list(what)}.`,
  needFood: 'Futter',
  needWater: 'Wasser',
  needShelter: 'Schutz',
  needBlocked: 'Hindernis',
  needMove: 'Wege',
  needLost: 'Kein Futter mehr',
  needSeason: (lands: string, s: SeasonSet) => `${lands} · ${when(s)}`,
  needMoveText: (move: number, reach: number) =>
    `${move === 1 ? '1 Feld' : `${move} Felder`} je Monat, Umkreis ${reach}`,
  needNone: '–',
  needPrey: 'Beute',
  needPreyText: (food: number, kill: number, fire: number) =>
    `Wild: ${food} Futter je Tier, bis ${animals(kill)} je Monat${fire > 0 ? `, im Feuer +${fire}` : ''}`,
  preyOnIsland: (n: number, animalCount: number) =>
    n > 0 ? `${stocks(n)} (${animals(animalCount)}) auf der Insel` : 'kein Wild auf der Insel',
  needWolves: 'Wölfe',
  wolvesEnemy: 'Feinde – reißen Tiere der Herde',
  wolvesRival: 'Konkurrenten – jagen dasselbe Wild',
  packsOnIsland: (n: number) => (n > 0 ? `${n} Rudel auf der Insel` : 'keine auf der Insel'),
  needCamp: 'Lager',
  needCampText: (groups: string[], radius: number) => `${list(groups)} im Umkreis ${radius}`,
  campStanding: 'Lager steht',
  campSitesInReach: (n: number) =>
    n > 0 ? `${n} ${n === 1 ? 'Platz' : 'Plätze'} in Zugweite` : 'kein Platz in Zugweite',
  campSpotsOnIsland: (n: number) =>
    n > 0
      ? `${n} ${n === 1 ? 'möglicher Platz' : 'mögliche Plätze'} auf der Insel`
      : 'kein möglicher Platz auf der Insel',
  preyHintSome: (stage: string, n: number, animalCount: number) =>
    `Die Stufe ${stage} braucht Wild: zurzeit ${stocks(n)} auf der Insel (${animals(animalCount)}).`,
  preyHintNone: (stage: string, lands: string[], have: number, need: number, from: string | null) =>
    `Die Stufe ${stage} braucht Wild: zurzeit keines auf der Insel. Es wandert ${from ? `ab der Stufe ${from} ` : ''}ein, wenn mindestens ${need} Felder ${orList(lands)} da sind (zurzeit ${have}).`,
  // Lager gründen
  campBanner: '⛺ Lagerplatz wählen',
  campBannerIce: '❄ In der Eiszeit gründet die Herde kein Lager.',
  campBannerNone: (groups: string[], radius: number) =>
    `Kein Lagerplatz in Zugweite. Gesucht: ${list(groups)} im Umkreis ${radius}.`,
  campTitle: 'Lagerplatz',
  campAround: (radius: number) => `Im Umkreis ${radius}`,
  campGroup: (names: string, n: number) => `${names}: ${n > 0 ? fields(n) : 'fehlt'}`,
  campFood: (n: number, reach: number) => `Futter im Umkreis ${reach}: ${fields(n)}`,
  campShelter: (n: number) => `Schutz im Winter: ${n > 0 ? fields(n) : 'keiner'}`,
  campPrey: (n: number) => (n > 0 ? `Wild in Jagdweite: ${stocks(n)}` : 'Kein Wild in Jagdweite'),
  campSettled: 'Die Herde wird sesshaft: Sie zieht nicht mehr und lebt aus dem Umkreis des Lagers.',
  campMoves: 'Sie zieht sofort auf diesen Platz.',
  campClear: (lands: string[], to: string, month: string, radius: number, n: number) =>
    `Jedes Jahr im ${month} rodet das Lager ein Feld ${orList(lands)} im Umkreis ${radius} zu ${to}${n > 0 ? ` – hier ${fields(n)}, nach etwa ${n} ${n === 1 ? 'Jahr' : 'Jahren'} ist der Wald nah am Lager fort` : ''}.`,
  campChipFood: 'Futter',
  campChipShelter: 'Schutz',
  campChipPrey: 'Wild',
  campShort: (clear: { lands: string[]; month: string; fields: number } | null) =>
    `Die Herde wird hier sesshaft.${clear ? ` Rodet jedes Jahr im ${clear.month} ein Feld ${orList(clear.lands)}${clear.fields > 0 ? ` (hier ${fields(clear.fields)})` : ''}.` : ''}`,
  campOther: 'Zum Vergleich einen anderen Platz antippen.',
  campConfirmTitle: 'Lager gründen?',
  campConfirmWarning: 'Kein Zurück: Die Herde bleibt für immer an diesem Ort.',
  campConfirm: 'Lager gründen',
  campCancel: 'Noch nicht',
  onIsland: (n: number) => (n > 0 ? `${fields(n)} auf der Insel` : 'fehlt auf der Insel'),
  blockedOnIsland: (n: number) => (n > 0 ? `${fields(n)} unpassierbar` : 'keines auf der Insel'),
  evolveButton: (stage: string) => `Weiterentwickeln zu ${stage}`,
  evolveTitle: (stage: string) => `Weiterentwickeln zur Stufe ${stage}?`,
  evolveIntro: 'Danach gelten neue Bedürfnisse:',
  evolveWarning:
    'Kein Zurück: Der Sprung ist endgültig. Die Merkmale wirken weiter, für die nächste Reife zählen aber nur neue. Was der Herde bisher half, kann ihr jetzt schaden.',
  evolveConfirm: 'Weiterentwickeln',
  evolveCancel: 'Noch nicht',
  evolvedTitle: 'Eine neue Stufe',
  offerBanner: (n: number) => `✨ ${n === 1 ? 'Ein Merkmal' : `${n} Merkmale`} zur Wahl`,
  matureBanner: (stage: string) => `⬆ Bereit für ${stage}`,
  offerTitle: 'Ein Merkmal wählen',
  offerIntro: 'Die Herde hat genug erlebt. Wähle ein Merkmal – es bleibt für immer.',
  offerFrom: (experience: string, at: number) => `${experience}: ${at}`,
  offerHelpsMaturity: 'hilft zur Reife',
  offerPick: 'Merkmal annehmen',
  offerLater: 'Später',
  offerLeave:
    'Du kannst das Angebot liegen lassen. Zur nächsten Jahreszeit kommen dann andere erreichte Merkmale an die Reihe; was zur Reife fehlt, bleibt vorn. Höchstens ein Merkmal je Jahreszeit.',
};

export type Strings = typeof de;
