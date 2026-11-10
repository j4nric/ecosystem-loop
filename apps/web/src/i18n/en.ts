import type { SeasonSet, Strings } from './de.ts';

const ordinal = (n: number): string => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
};
const months = (n: number) => `${n} ${n === 1 ? 'month' : 'months'}`;
const list = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
const orList = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
/** “in summer”, “in spring and summer”, “all year”, “never” */
const when = (s: SeasonSet) =>
  s.all ? 'all year' : s.names.length === 0 ? 'never' : `in ${list(s.names.map((n) => n.toLowerCase()))}`;
const fields = (n: number) => `${n} ${n === 1 ? 'field' : 'fields'}`;
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** UI strings (English). Names of landscapes, cards, seasons and months come from the game data (`name.en`). */
export const en: Strings = {
  appTitle: 'The Herd',
  herd: 'Herd',
  fat: 'Reserve',
  wolves: 'Wolves',
  wild: 'Wildness',
  iceAge: 'Ice age',
  iceLeft: (n) => `${n} mo. left`,
  statusLabel: (herd, fat, fatMax, wolves) => `Herd ${herd}, reserve ${fat} of ${fatMax}, wolves ${wolves}`,
  date: (year, month) => `Year ${year} · ${month}`,
  seasonHint: (season, r, needs) => {
    const base = (
      {
        spring: 'Grass grows',
        summer: '',
        autumn: 'Grass grows slower, build up reserves',
        winter: 'No grass',
      } as Record<string, string>
    )[season];
    if (base === undefined) return undefined;
    const need = [needs.water ? 'water' : '', needs.shelter ? 'shelter' : ''].filter(Boolean);
    const parts = [
      base,
      need.length > 0 ? `the herd needs ${list(need)}` : '',
      needs.fire ? 'old forest may burn' : '',
      r.birthSeason === season ? `calves in the ${ordinal(r.birthMonth)} month` : '',
    ].filter(Boolean);
    return parts.length > 0 ? capitalize(parts.join(', ')) : undefined;
  },
  seasonHintFallback: 'The herd moves on',
  iceHint: (n) => `Ice age: ${n} more ${n === 1 ? 'month' : 'months'} of winter`,
  intent: {
    avoidWolves: 'avoids the wolves',
    seekWater: 'is looking for water',
    seekShelter: 'seeks shelter from the cold',
    freshGrass: 'heads for fresh food',
    stay: 'keeps grazing here',
  },
  intentLine: (reason) => `The herd ${reason}`,
  stays: '(stays)',
  intentSame: 'The herd keeps its intention.',
  hand: 'Hand',
  emptyHand: 'No cards. New ones arrive at the start of the next season.',
  noTargets: 'No fitting field right now',
  wildCost: (n) => `Wildness +${n}`,
  pickField: 'Tap a highlighted field.',
  play: 'Play',
  place: 'Place',
  cancel: 'Cancel',
  close: 'Close',
  playSeason: 'Play season',
  playMonth: '1 month',
  stop: 'Stop',
  log: 'Chronicle',
  logEmpty: 'Nothing has happened yet.',
  menu: 'Menu',
  help: 'Help',
  newGame: 'New game',
  newGameConfirm: 'End the current game and start a new one?',
  previewTitle: 'Preview',
  previewCell: (from, to) => `${from} → ${to}`,
  previewFood: (from, to) => `Food ${from} → ${to}`,
  previewGrow: (n) => `Grass grows on ${n} ${n === 1 ? 'field' : 'fields'}.`,
  previewFire: 'Fire may spread to neighbouring woodland.',
  previewPackGone: 'The wolf pack there will be driven out.',
  previewIntentChanged: 'New intention:',
  fertile: 'fertile',
  food: (n, max) => `Food ${n} of ${max}`,
  forecastUngrazedSoon: (to, n) =>
    `Turns into ${to} in ${n} ${n === 1 ? 'month' : 'months'} unless the herd grazes here.`,
  forecastUngrazedHold: (land) => `Stays ${land} as long as the herd grazes here.`,
  forecastAge: (to, n, fertile) =>
    `Turns into ${fertile ? 'fertile ' : ''}${to} in ${n} ${n === 1 ? 'month' : 'months'}.`,
  infoWildfire: 'Dry: may catch fire by itself in the fire season.',
  infoWater: (s) => `Water: the herd drinks here ${when(s)}.`,
  infoShelter: (s) => `Shelter for the herd ${when(s)}.`,
  infoWolves: 'Woodland: home of the wolves.',
  infoBlocked: 'The herd cannot go here.',
  infoStageBlocked: (stage) => `Impassable for this stage (${stage}).`,
  infoNoFood: (stage) => `No food for the stage ${stage}.`,
  previewBlocked: 'Afterwards impassable for this stage.',
  previewWasBlocked: 'So far impassable for this stage.',
  previewStillBlocked: 'Impassable for this stage.',
  infoSparse: 'Barren: grows only a little in spring.',
  infoHerd: (n) => `The herd stands here (${n} animals).`,
  infoPack: (size, hungry) =>
    `Wolf pack of strength ${size}${hungry ? ', hungry: moves through woodland towards the herd' : ''}.`,
  evCardPlayed: (card) => `${card} placed.`,
  evCardsDrawn: (cards) => `New cards: ${cards}.`,
  evSuccession: (from, to, n) => `${from} turns into ${to}${n > 1 ? ` (${n} fields)` : ''}.`,
  evRain: (n) => `Rain: grass grows on ${n} fields.`,
  evLightning: (n) => `Lightning: ${n} ${n === 1 ? 'field burns' : 'fields burn'} down.`,
  evWildfire: (n) => `Wildfire! ${n} ${n === 1 ? 'field burns' : 'fields burn'}.`,
  evHerdMoved: (reason, arrow) => `The herd ${reason} ${arrow}`,
  evHerdHungry: (eaten, need) => `Not enough food (${eaten} of ${need}), the reserve shrinks.`,
  evStarved: (n) => `Hunger: −${n} ${n === 1 ? 'animal' : 'animals'}.`,
  evThirsted: (n) => `Thirst: −${n} ${n === 1 ? 'animal' : 'animals'}.`,
  evFroze: (n) => `Cold without shelter: −${n} ${n === 1 ? 'animal' : 'animals'}.`,
  evBurned: (n) => `The fire reaches the herd: −${n}.`,
  evBorn: (n) => `${n} ${n === 1 ? 'calf' : 'calves'} born.`,
  evHunted: (n) => `Wolves kill ${n} ${n === 1 ? 'animal' : 'animals'}.`,
  evPackMoved: 'A hungry pack moves through the woodland towards the herd.',
  evPackGrew: (n) => `A wolf pack grows stronger (${n}).`,
  evPackFounded: 'A new wolf pack forms.',
  evPackStarved: 'A wolf pack starves and grows weaker.',
  evPackGone: {
    starved: 'A wolf pack has starved.',
    fire: 'The fire drives off a wolf pack.',
    driven: 'A wolf pack has lost its home.',
  },
  evPackImmigrated: 'Wolves move into the forests.',
  evSeason: (season, year) => `${season} of year ${year}.`,
  evIceBegan: (n) => `The ice age begins: ${n} months of winter.`,
  evIceEnded: (n) => `The ice age is over. ${n} animals survived.`,
  evLost: 'The herd has died out.',
  evTraitOffered: (traits) => `New trait to choose: ${traits}.`,
  evTraitPicked: (trait, effect) => `The herd develops ${trait}: ${effect}`,
  evMatured: (next) => `The herd is ready for the leap: ${next}.`,
  evEvolved: (from, to) => `New stage: ${to} (was ${from}).`,
  evRejected: 'That is not possible here.',
  wonTitle: 'You made it',
  wonText: (n) => `The herd survived the ice age. ${n} ${n === 1 ? 'animal' : 'animals'} made it.`,
  lostTitle: 'The herd has died out',
  lostText: 'The island lives on – without it. Try again with a new herd.',
  survivors: 'Survivors',
  duration: 'Duration',
  durationValue: (years, months) =>
    years > 0 ? `${years} y ${months} mo` : `${months} ${months === 1 ? 'month' : 'months'}`,
  wildReached: 'Wildness',
  viewIsland: 'View island',
  overBar: (won) => (won ? 'This game is won.' : 'This game is lost.'),
  legacyTitle: 'A new game',
  legacyText:
    'Being God is now “The Herd”. Your old save is from the previous version and no longer fits – it has been discarded. Enjoy the new game!',
  incompatibleTitle: 'Save no longer fits',
  incompatibleText:
    'Your saved game does not match the current version of the game and has been discarded. A new game has started.',
  outdatedTitle: 'The herd evolves now',
  outdatedText:
    'New: the herd gathers experience, gains traits and can evolve. Your save is from an older version and no longer fits – a new game has started.',
  ok: 'Continue',
  tutorial: (r) => [
    {
      icon: '🐑',
      title: 'The herd moves by itself',
      text: `Every month the herd moves at most ${r.move === 1 ? 'one field' : `${r.move} fields`} – towards food, to water ${when(r.water)}, into the shelter of woodland ${when(r.shelter)}, away from wolves. The arrow on the island shows where it wants to go next.`,
    },
    {
      icon: '🌱',
      title: 'You shape the land',
      text: 'You never steer the herd directly. Tap a card, then a glowing field: sow meadow, plant trees, raise a spring, place rock or lightning. That is how you lure the herd – or scare it away.',
    },
    {
      icon: '🌲',
      title: 'The world changes by itself',
      text: 'Ungrazed meadow turns to bush, bush to forest, forest to old forest, old forest may burn in summer, burnt land becomes fertile meadow. Wolves live in the woodland – forest corridors are wolf paths. Tap a field to see what will happen there.',
    },
    {
      icon: '✨',
      title: 'The herd evolves',
      text: 'What the herd lives through makes it stronger: cold in shelter, wolf attacks, fires, long walks. At the start of a season it offers you traits – pick one or wait. With enough traits it is ready for the next stage: forest gatherers, wanderers, one day humans. Every stage needs a different island, and there is no way back. Prepare the land in time – forests do not grow overnight.',
    },
    {
      icon: '❄️',
      title: 'Wildness and the ice age',
      text: `Every month and every card makes the wildness grow. At ${r.wildMax} the ice age begins: ${months(r.iceMonths)} of winter without calves. Bring the herd through it and the age is won.`,
    },
    {
      icon: '▶',
      title: 'Play a season',
      text: 'Place your cards, then let a season run. At the start of every season you get new cards. Nothing is discarded – what you do not play stays in your hand.',
    },
  ],
  tutorialStep: (n, total) => `${n} of ${total}`,
  tutorialNext: 'Next',
  tutorialBack: 'Back',
  tutorialSkip: 'Skip',
  tutorialDone: 'Let’s go',
  showTutorial: 'Show introduction',
  helpTitle: 'How to play',
  helpGoal: 'Goal',
  helpGoalText: (r) =>
    `Bring the herd through the ice age. It begins when the wildness reaches ${r.wildMax} – every month and every card makes it grow. Intervening a lot prepares you better, but calls the trial sooner.`,
  helpHerd: 'The herd',
  helpHerdText: (r) =>
    `It moves at most ${r.move === 1 ? 'one field' : `${r.move} fields`} per month and feeds on its own and the ${r.neighbors} neighbouring fields. Surplus becomes reserve, shortage eats into it, then animals die. ${capitalize(when(r.water))}: thirst without water nearby. ${capitalize(when(r.shelter))}: cold without shelter nearby. Calves are born depending on the reserve. What counts as food, water and shelter depends on the stage (see below).`,
  helpEvolution: 'Evolution',
  helpEvolutionText:
    'The herd counts what it lives through. When an experience reaches its threshold, a trait becomes available; at the start of every season the herd offers some. Pick one or leave the offer – it comes again next season. Traits stay through all stages. With enough traits (including a specific one) the herd is mature: then you decide when it takes the leap to the next stage. No way back – and every stage needs different land. Tap the herd symbol at the bottom right for progress and a preview.',
  helpTraits: 'Traits',
  helpStages: 'Stages',
  helpTraitFrom: (experience, at) => `from ${at} × ${experience}`,
  helpStageMature: (traits, oneOf) =>
    `Mature with ${traits} ${traits === 1 ? 'trait' : 'traits'}${oneOf.length > 0 ? `, including ${orList(oneOf)}` : ''}.`,
  helpCards: 'Cards',
  helpCardsText: (r) =>
    `At the start of every season you draw new cards, at most ${r.handMax} in hand. Tap a card, then a glowing field – the preview shows what happens to the field and whether the herd changes its intention. Rain works on the whole island.`,
  helpWorld: 'The world is alive',
  helpWorldText:
    'Land changes by itself. Wolves live in woodland, move hungry through forest corridors towards the herd and kill animals nearby. Fire and rock drive them away.',
  helpLands: 'Landscapes',
  helpControls: 'Controls',
  helpControlsText:
    '“Play season” runs the months until the next season, “1 month” just one. Drag to turn the island a little.',
  evoOpen: 'Herd and evolution',
  evoTitle: 'Herd and evolution',
  evoNeeds: 'Needs',
  evoTraits: 'Traits',
  evoNoTraits: 'No traits yet. They grow from what the herd lives through.',
  evoExperience: 'Experience',
  evoExperienceNext: (trait) => `→ ${trait}`,
  evoExperienceDone: 'all reached',
  evoAvailable: 'to choose',
  evoForMaturity: 'for maturity',
  evoMaturity: 'Maturity',
  evoMissing: (traits, oneOf) => {
    const parts: string[] = [];
    if (traits > 0) parts.push(`${traits} more ${traits === 1 ? 'trait' : 'traits'}`);
    if (oneOf && oneOf.length > 0) parts.push(`including ${orList(oneOf)}`);
    return parts.length > 0 ? `Still needed for maturity: ${parts.join(', ')}.` : 'Ready for the leap.';
  },
  evoMature: (next) => `Mature! The herd can become ${next}.`,
  evoLast: 'Highest stage of this version. More stages will follow.',
  evoNext: (stage) => `Next stage: ${stage}`,
  evoNextLabel: 'Next stage',
  evoCurrentLabel: 'Current stage',
  evoNextIntro: 'What it needs – and what the island offers today:',
  evoNextReady: 'The island already offers everything needed.',
  evoNextMissing: (what) => `Prepare the island: ${list(what)} missing.`,
  needFood: 'Food',
  needWater: 'Water',
  needShelter: 'Shelter',
  needBlocked: 'Obstacle',
  needMove: 'Range',
  needLost: 'No longer food',
  needSeason: (lands, s) => `${lands} · ${when(s)}`,
  needMoveText: (move, reach) => `${move === 1 ? '1 field' : `${move} fields`} per month, radius ${reach}`,
  needNone: '–',
  onIsland: (n) => (n > 0 ? `${fields(n)} on the island` : 'missing on the island'),
  blockedOnIsland: (n) => (n > 0 ? `${fields(n)} impassable` : 'none on the island'),
  evolveButton: (stage) => `Evolve into ${stage}`,
  evolveTitle: (stage) => `Evolve into ${stage}?`,
  evolveIntro: 'Afterwards new needs apply:',
  evolveWarning: 'No way back: the leap is final. The traits stay, but what helped the herd so far may harm it now.',
  evolveConfirm: 'Evolve',
  evolveCancel: 'Not yet',
  evolvedTitle: 'A new stage',
  offerBanner: (n) => `✨ ${n === 1 ? 'A trait' : `${n} traits`} to choose`,
  matureBanner: (stage) => `⬆ Ready for ${stage}`,
  offerTitle: 'Choose a trait',
  offerIntro: 'The herd has lived through enough. Choose a trait – it stays forever.',
  offerFrom: (experience, at) => `${experience}: ${at}`,
  offerHelpsMaturity: 'helps towards maturity',
  offerPick: 'Take trait',
  offerLater: 'Later',
  offerLeave: 'You can leave the offer. It is renewed next season – at most one trait per season.',
};
