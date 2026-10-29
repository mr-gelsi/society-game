// ---------------------------------------------------------------------------
// Game rules for the Zombie Apocalypse society game.
// Everything a teacher might want to tune lives in this one file:
// lists, events, bonuses, outcomes and point values.
// Scoring runs on the server so students can't change their own results.
// ---------------------------------------------------------------------------

export const EVENT_COUNT = 7;
export const START = { population: 100, food: 100, infrastructure: 100 };
export const MAX_MEMBERS = 8;
export const FOOD_CAP = 200; // keeps stockpiling from running away with the score
export const MAX_BONUS = 2; // most a roll can be boosted by jobs/supplies/buildings

export const POINTS = {
  action1: 6,
  build: { success: 12, partial: 8, fail: 2 },
  event: { success: 20, partial: 12, fail: 4 },
  conflictPenalty: 10, // choice doesn't match constitution and it wasn't amended
};

// Roll tiers: dice (1-6) + bonus. 5+ = success, 3-4 = partial, 1-2 = fail.
export const tierFor = (total) => (total >= 5 ? 'success' : total >= 3 ? 'partial' : 'fail');

// ---- Lists (from the Game Tracker spreadsheet) -----------------------------
export const JOBS = ['Agriculture', 'Medical Field', 'Tradesperson', 'Influencer', 'First Responder', 'Military', 'Professional'];
export const GOV_TYPES = ['Monarchy', 'Direct Democracy', 'Representative'];
export const ITEM_CATEGORIES = ['Food', 'Medicine', 'Tools', 'Iphone', 'First Aid / Defence', 'Weapons', 'Stationary', 'Hygiene'];
export const RESOURCES = ['Basic Resources', 'Food', 'Water', 'Building Materials'];
export const BACKPACK_ITEMS = [
  'Batteries', '1-gallon jug of water', 'Binoculars', 'Flashlight', 'Blanket', 'First aid kit', 'Wrench', 'Duct tape',
  'Zip ties', 'Scissors', 'Matches', '$100 cash', 'Utility knife', 'Gold/silver jewelry', 'Sleeping bag', 'Tarp',
  'Hammer and nails', 'Map', 'Walkie-talkies', 'Fishing pole', 'Bucket', 'Dog', 'Manual can opener', 'Foraging guidebook',
  '6ft long rope', 'Bungee cords', 'Vitamins', 'Painkillers/fever reducers', 'Firearm and ammo', 'Gloves', 'Hiking boots',
  'Coat', 'Tent', 'Bicycle', 'Umbrella', 'Crowbar', 'Ax', 'Emergency Radio', 'Canned Food', 'Seeds', 'Bleach',
];

// ---- Action 1 (from the Action 1 slide) ------------------------------------
export const ACTION1 = {
  gather: { label: 'Gather Resources', blurb: 'Select which resources to gather, enter it on your game form and announce it during the announcement time.' },
  explore: { label: 'Go Exploring', blurb: 'Draw a random Exploration card that can give you good or bad events. Enter the code from your card.' },
  barter: { label: 'Barter & Trade', blurb: 'Try to trade items with another group. Record what you gave and what you received.' },
  amend: { label: 'Amend Constitution', blurb: 'Fix any laws or process within your constitution.' },
};

// ---- Action 2 (from the Action 2 slide) ------------------------------------
// jobs / items / cats decide which team members and supplies help the build roll.
export const BUILDS = {
  hospital: {
    label: 'Build a hospital', blurb: 'Improves health of your society.',
    jobs: ['Medical Field'], items: ['First aid kit', 'Painkillers/fever reducers', 'Vitamins', 'Bleach'], cats: ['Medicine', 'First Aid / Defence'],
    effect: {},
  },
  houses: {
    label: 'Build houses', blurb: 'Gives places for more people to live.',
    jobs: ['Tradesperson'], items: ['Hammer and nails', 'Tarp', 'Tent', 'Wrench', 'Duct tape'], cats: ['Tools'],
    effect: { success: { popAdd: 10 }, partial: { popAdd: 5 } },
  },
  defences: {
    label: 'Build defences', blurb: 'Protects your society.',
    jobs: ['Military', 'First Responder', 'Tradesperson'], items: ['Crowbar', 'Ax', 'Zip ties', 'Duct tape', 'Firearm and ammo'], cats: ['Weapons', 'First Aid / Defence', 'Tools'],
    effect: {},
  },
  school: {
    label: 'Build a school', blurb: 'Helps your society learn & develop innovations.',
    jobs: ['Professional', 'Influencer'], items: ['Map', 'Foraging guidebook', 'Emergency Radio'], cats: ['Stationary'],
    effect: {},
  },
  crops: {
    label: 'Plant crops', blurb: 'Feeds your society.',
    jobs: ['Agriculture'], items: ['Seeds', 'Bucket', '1-gallon jug of water', 'Foraging guidebook'], cats: ['Food', 'Tools'],
    effect: { success: { foodAdd: 20 }, partial: { foodAdd: 10 } },
  },
  weapons: {
    label: 'Make weapons', blurb: 'Helps you fight, ensure safety, enforce laws.',
    jobs: ['Military', 'Tradesperson'], items: ['Utility knife', 'Ax', 'Hammer and nails', 'Firearm and ammo'], cats: ['Weapons', 'Tools'],
    effect: {},
  },
  civic: {
    label: 'Civic Infrastructure', blurb: 'Water systems, sewers, roads, community buildings.',
    jobs: ['Tradesperson', 'Professional'], items: ['Bucket', 'Wrench', 'Hammer and nails', 'Bleach'], cats: ['Tools'],
    effect: { success: { infraAdd: 20 }, partial: { infraAdd: 10 } },
  },
};

// ---- Exploration cards (from the Cards & Codes document) ---------------------
// kind: good | bad. points are added to the society's score. supplies are item
// categories added to the society's supply pool (they help event and build rolls).
// pick: 'choose' = student picks one option, 'drop' = student picks one backpack item to lose.
export const EXPLORE = {
  hsms: { kind: 'good', title: 'Abandoned hospital', text: 'You find an abandoned hospital fully stocked with medical supplies.', points: 10, supplies: ['Medicine'], gain: 'Your society gained medical supplies.' },
  hgsg: { kind: 'good', title: 'Untouched grocery store', text: 'You find a grocery store that has not yet been looted. The shelves are fully stocked with canned goods.', points: 10, supplies: ['Food'], foodAdd: 30, gain: 'Your society gained a big stock of canned goods.' },
  hdts: { kind: 'good', title: 'Untouched Home Depot', text: 'You find an abandoned Home Depot that has not yet been looted. The shelves are fully stocked with tools.', points: 10, supplies: ['Tools'], gain: 'Your society gained tools.' },
  hwta: { kind: 'good', title: 'The wise traveler', text: 'A wise traveler, who can foresee the future, makes a stop at your community but does not wish to join. You are able to get assistance on the best way to prepare for this round.', points: 10, foresight: true, gain: 'Ask your teacher how to prepare for this round. The traveler’s advice will help you with your event roll.' },
  xldz: { kind: 'bad', title: 'Looted Home Depot', text: 'You find an abandoned Home Depot, but it has been looted. As you walk up and down the aisles trying to find something useful, you spot a zombie. You turn to run, but another zombie is right behind you. Before you know it, he grabs your left hand and bites off your thumb.', points: -10, loss: 'A member of your society lost a thumb.' },
  xzms: { kind: 'bad', title: 'Ransacked hospital', text: 'You find an abandoned hospital, but it looks like it has been ransacked. You decide to take a chance to get medical supplies. When you walk through, you see a giant group of zombies. When you turn to run, you drop one of your supply items.', points: -5, pick: 'drop', prompt: 'Which supply item did you drop?', loss: 'You ran without finding any medical supplies.' },
  xegs: { kind: 'bad', title: 'Looted grocery store', text: 'You find a grocery store with the windows broken. It appears to have been looted, but you want to see if there is anything left inside. You walk in and are horrified by the filth and destruction. Worst of all, there is no food left on the shelves.', points: -5, loss: 'There was no food left. The trip was wasted.' },
  hcvs: {
    kind: 'good', title: 'Abandoned CVS', text: 'You find an abandoned CVS fully stocked with medical supplies, hygiene items, and food. However, you can’t carry everything.', points: 8,
    pick: 'choose', prompt: 'What will you choose to take? Choose one thing to add to your supply list.',
    options: [
      { id: 'medical', label: 'Medical supplies', supplies: ['Medicine'] },
      { id: 'hygiene', label: 'Hygiene items', supplies: ['Hygiene'] },
      { id: 'food', label: 'Food', supplies: ['Food'], foodAdd: 15 },
    ],
  },
};
export const exploreCode = (v) => String(v ?? '').trim().toLowerCase();

// Works out what a card does. `choice` is the option id (hcvs) or "memberId:index" (xzms).
export function resolveExplore(card, choice, members) {
  const out = { points: card.points || 0, supplies: [...(card.supplies || [])], foodAdd: card.foodAdd || 0, foresight: !!card.foresight, drop: null, notes: [] };
  if (card.gain) out.notes.push(card.gain);
  if (card.loss) out.notes.push(card.loss);
  if (card.pick === 'choose') {
    const o = card.options.find((x) => x.id === choice);
    out.supplies.push(...o.supplies);
    out.foodAdd += o.foodAdd || 0;
    out.notes.push(`You took ${o.label.toLowerCase()}.`);
  }
  if (card.pick === 'drop' && choice) {
    const [mid, idx] = String(choice).split(':');
    const m = members.find((x) => String(x.id) === mid);
    out.drop = { member_id: m.id, index: Number(idx) };
    out.notes.push(`You dropped ${m.backpack[Number(idx)]} (${m.name}’s backpack).`);
  }
  return out;
}
// Backpack items a student could drop, as pick options.
export const dropOptions = (members) => members.flatMap((m) => m.backpack.map((item, i) => ({ id: `${m.id}:${i}`, label: `${m.name}: ${item}` })));

// ---- Helpers ---------------------------------------------------------------
export function makeCtx(members, state) {
  return {
    members,
    buildings: state.buildings || {},
    food: state.food,
    jobs: new Set(members.map((m) => m.job)),
    items: new Set(members.flatMap((m) => m.backpack || [])),
    cats: new Set([...members.map((m) => m.profession_item), ...(state.supplies || [])]),
  };
}
const hasJob = (c, ...jobs) => jobs.some((j) => c.jobs.has(j));
const hasItem = (c, names = [], cats = []) => names.some((n) => c.items.has(n)) || cats.some((k) => c.cats.has(k));
const built = (c, k) => (c.buildings[k] || 0) > 0;

export function buildMods(key, ctx, flags = {}) {
  const b = BUILDS[key];
  const mods = [];
  const skilled = ctx.members.filter((m) => b.jobs.includes(m.job)).length;
  if (skilled >= 1) mods.push('Skilled team member');
  if (skilled >= 2) mods.push('Second skilled team member');
  if (hasItem(ctx, b.items, b.cats)) mods.push('Useful supplies');
  if (flags.materials) mods.push('Building materials gathered');
  return mods;
}

export function eventMods(ev, ctx, choice) {
  return ev.bonuses.filter((b) => (!b.only || b.only === choice) && b.test(ctx)).map((b) => b.label);
}

export function resolveRoll(dice, mods) {
  const bonus = Math.min(MAX_BONUS, mods.length);
  const total = dice + bonus;
  return { dice, bonus, total, tier: tierFor(total) };
}

// Percent values are applied to the current amount; *Add values are flat.
export function applyEffect(state, eff = {}) {
  const pct = (v, p) => Math.max(0, Math.round(v * (1 + p / 100)));
  if (eff.pop) state.population = pct(state.population, eff.pop);
  if (eff.food) state.food = pct(state.food, eff.food);
  if (eff.infra) state.infrastructure = pct(state.infrastructure, eff.infra);
  if (eff.popAdd) state.population += eff.popAdd;
  if (eff.foodAdd) state.food += eff.foodAdd;
  if (eff.infraAdd) state.infrastructure = Math.min(150, state.infrastructure + eff.infraAdd);
  state.food = Math.min(FOOD_CAP, state.food);
}

export const scoreOf = (s) => Math.round(s.population + s.food * 0.2 + s.infrastructure * 0.2 + s.points + (s.adjustment || 0));

// ---- Events (from the 904.04 Society Game slides) --------------------------
const J = (label, ...jobs) => ({ label, test: (c) => hasJob(c, ...jobs) });
const B = (label, key) => ({ label, test: (c) => built(c, key) });
const I = (label, names, cats) => ({ label, test: (c) => hasItem(c, names, cats) });
const only = (choice, b) => ({ ...b, only: choice });

export const EVENTS = [
  {
    n: 1, title: 'Zombies',
    description: 'You have escaped the original outbreak, but as a survivor gets to your society they let you know dozens of zombies are making their way to you.',
    activity: {
      title: 'Fight off the zombies',
      prompt: 'Now that you have prepared, roll your dice to see how well you fend off the zombies.',
      fail: 'You lose half of your population.',
      partial: 'You lose 10% of your population.',
      success: 'You fight them off with no deaths.',
      helps: 'Military or first responders, defences, weapons',
    },
    bonuses: [
      J('Military or first responder on your team', 'Military', 'First Responder'),
      B('Defences built', 'defences'),
      B('Weapons made', 'weapons'),
      I('Weapons or tools in your supplies', ['Firearm and ammo', 'Ax', 'Crowbar', 'Utility knife'], ['Weapons']),
    ],
    resolve: (t) => ({ fail: { pop: -50 }, partial: { pop: -10 }, success: {} }[t]),
  },
  {
    n: 2, title: 'Sickness',
    description: 'You are noticing that many people are becoming really sick. Some people have even started losing their hair!',
    activity: {
      title: 'Deal with sickness',
      prompt: 'How well does your society deal with sickness tearing through it?',
      fail: 'You lose 25% of your population (10% if you have a medical professional).',
      partial: 'You lose 5% of your population.',
      success: 'You effectively deal with the sickness.',
      helps: 'Medical professionals, a hospital',
    },
    bonuses: [
      J('Medical professional on your team', 'Medical Field'),
      B('Hospital built', 'hospital'),
      I('Medical supplies', ['First aid kit', 'Painkillers/fever reducers', 'Vitamins', 'Bleach'], ['Medicine', 'First Aid / Defence', 'Hygiene']),
    ],
    resolve: (t, c) => ({ fail: { pop: hasJob(c, 'Medical Field') ? -10 : -25 }, partial: { pop: -5 }, success: {} }[t]),
  },
  {
    n: 3, title: 'Survivors',
    description: 'More survivors have shown up at your gates and are asking to become citizens of your society…',
    note: 'If your choice doesn’t match your constitution, you will have to amend it.',
    choice: {
      prompt: 'What does your society do with the survivors?',
      options: [{ id: 'let_in', label: 'Let them become citizens' }, { id: 'turn_away', label: 'Turn them away' }],
    },
    activity: {
      let_in: {
        title: 'Deal with survivors: let them in',
        prompt: 'If you welcome the survivors in, roll to see what happens.',
        fail: 'They steal from you and take 25% of your food and resources.',
        partial: 'Some of the survivors help and others don’t.',
        success: 'They bring supplies and skills into your society.',
        helps: 'Houses, teachers (a school or professionals)',
      },
      turn_away: {
        title: 'Deal with survivors: turn them away',
        prompt: 'If you don’t let them in, roll to see how they respond.',
        fail: 'They raid your society at night and steal 25% of your food supply.',
        partial: 'A group raids you and you lose 10% of your food.',
        success: 'They turn away and walk off into the world without your help.',
        helps: 'Defences, military',
      },
    },
    bonuses: [
      only('let_in', B('Houses built', 'houses')),
      only('let_in', { label: 'Teachers: a school or a professional', test: (c) => built(c, 'school') || hasJob(c, 'Professional') }),
      only('let_in', I('Food to share', ['Canned Food'], ['Food'])),
      only('turn_away', B('Defences built', 'defences')),
      only('turn_away', J('Military on your team', 'Military')),
      only('turn_away', I('Weapons in your supplies', ['Firearm and ammo', 'Ax', 'Crowbar'], ['Weapons'])),
    ],
    resolve: (t, c, choice) => (choice === 'let_in'
      ? { fail: { food: -25 }, partial: { popAdd: 5 }, success: { popAdd: 10, foodAdd: 15 } }
      : { fail: { food: -25 }, partial: { food: -10 }, success: {} })[t],
  },
  {
    n: 4, title: 'Food Shortage',
    description: 'Your society is running into a food shortage.',
    activity: {
      title: 'Deal with the food shortage',
      prompt: 'Can your society keep up with the demand for food?',
      fail: '25% of your society starves and 10% more leave.',
      partial: 'You lose 10% of your population before you get food under control.',
      success: 'You get your food situation under control.',
      helps: 'Farmers, planted crops',
    },
    bonuses: [
      J('Farmer on your team', 'Agriculture'),
      B('Crops planted', 'crops'),
      I('Food supplies', ['Seeds', 'Canned Food', 'Fishing pole', 'Foraging guidebook'], ['Food']),
      { label: 'A well-stocked food supply', test: (c) => c.food >= 80 },
    ],
    resolve: (t) => ({ fail: { pop: -35 }, partial: { pop: -10 }, success: {} }[t]),
  },
  {
    n: 5, title: 'Crime',
    description: 'People in your society have noticed that things have been coming up missing. They believe there is a thief. You are also noticing people are beginning to break basic rules.',
    note: 'If your choice doesn’t match your constitution, you will have to amend it.',
    choice: {
      prompt: 'How does your society respond to the crime wave?',
      options: [{ id: 'martial_law', label: 'Martial law: limit everyone’s freedoms' }, { id: 'investigate', label: 'Investigate and hope you can find the criminals' }],
    },
    activity: {
      martial_law: {
        title: 'Solve the crime wave: martial law',
        prompt: 'Roll to see whether martial law keeps the peace.',
        fail: 'Everyone is upset about being punished when they aren’t the criminals. Protests turn violent and you lose 50% of your infrastructure.',
        partial: 'You lose only 10% of your infrastructure.',
        success: 'Your martial law works and the crime stops.',
        helps: 'First responders, weapons',
      },
      investigate: {
        title: 'Solve the crime wave: investigate',
        prompt: 'Roll to see whether you can find the criminal.',
        fail: 'You come up empty handed. Your people lose trust and begin to fight each other. You lose 20% of your population.',
        partial: 'You lose 10% of your population.',
        success: 'You solve the crime.',
        helps: 'First responders, weapons',
      },
    },
    bonuses: [
      J('First responder on your team', 'First Responder'),
      B('Weapons made', 'weapons'),
      I('Weapons in your supplies', ['Firearm and ammo', 'Utility knife'], ['Weapons']),
      I('Patrol gear', ['Walkie-talkies', 'Flashlight', 'Zip ties'], []),
    ],
    resolve: (t, c, choice) => (choice === 'martial_law'
      ? { fail: { infra: -50 }, partial: { infra: -10 }, success: {} }
      : { fail: { pop: -20 }, partial: { pop: -10 }, success: {} })[t],
  },
  {
    n: 6, title: 'Disagreements',
    description: 'Some people in your community have started fighting about how food and supplies are being shared. Some are trying to sell their extra food. Others don’t have enough to eat.',
    note: 'If your choice doesn’t match your constitution, you will have to amend it.',
    choice: {
      prompt: 'How does your society handle sharing food and supplies?',
      options: [{ id: 'regulate', label: 'Regulate food and supplies and how people sell them' }, { id: 'fend', label: 'Let everyone fend for themselves' }],
    },
    activity: {
      regulate: {
        title: 'Deal with disagreements: share more equitably',
        prompt: 'You chose to share food more equitably and limit hoarding. Roll to see how it goes.',
        fail: 'You can’t keep up with food demand. 25% of your society starves and 10% more leave.',
        partial: 'You lose 10% of your population before things calm down.',
        success: 'You get your food situation under control.',
        helps: 'Farmers',
      },
      fend: {
        title: 'Deal with disagreements: everyone for themselves',
        prompt: 'You chose to let people fend for themselves. Roll to see how it goes.',
        fail: 'You can’t keep up with food demand. 25% of your society starves and 10% more leave.',
        partial: 'You lose 10% of your population before things calm down.',
        success: 'You get your food situation under control.',
        helps: 'Farmers',
      },
    },
    bonuses: [
      J('Farmer on your team', 'Agriculture'),
      B('Crops planted', 'crops'),
      { label: 'A well-stocked food supply', test: (c) => c.food >= 80 },
    ],
    resolve: (t) => ({ fail: { pop: -35 }, partial: { pop: -10 }, success: {} }[t]),
  },
  {
    // Not in the slide deck, which ends at Event 6. Edit or replace freely.
    n: 7, title: 'Harsh Winter',
    description: 'Winter has arrived early. Temperatures are dropping fast and your society needs shelter, warmth and food to make it through.',
    activity: {
      title: 'Survive the winter',
      prompt: 'Roll to see how well your society handles the cold.',
      fail: 'You lose 20% of your population to the cold.',
      partial: 'You lose 10% of your population.',
      success: 'Your society gets through the winter safely.',
      helps: 'Houses, civic infrastructure, warm supplies',
    },
    bonuses: [
      B('Houses built', 'houses'),
      B('Civic infrastructure built', 'civic'),
      I('Warm supplies', ['Coat', 'Blanket', 'Sleeping bag', 'Tent', 'Gloves', 'Matches'], []),
      { label: 'A well-stocked food supply', test: (c) => c.food >= 80 },
    ],
    resolve: (t) => ({ fail: { pop: -20 }, partial: { pop: -10 }, success: {} }[t]),
  },
];

export function publicEvent(ev) {
  if (!ev) return null;
  return { n: ev.n, title: ev.title, description: ev.description, note: ev.note || null, choice: ev.choice || null, activity: ev.activity };
}
export function activityFor(ev, choice) {
  return ev.choice ? ev.activity[choice] : ev.activity;
}
