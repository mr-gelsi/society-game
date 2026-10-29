// One catch-all Pages Function that handles every /api/* request.
// Needs a D1 binding named DB and a secret named ADMIN_PASSWORD.
import {
  EVENT_COUNT, EVENTS, FOOD_CAP, START, MAX_MEMBERS, POINTS, JOBS, GOV_TYPES, ITEM_CATEGORIES, RESOURCES, BACKPACK_ITEMS,
  ACTION1, BUILDS, EXPLORE, exploreCode, resolveExplore, dropOptions, makeCtx, buildMods, eventMods, resolveRoll, applyEffect, scoreOf, publicEvent, activityFor,
} from '../_lib/game.js';

class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
const fail = (status, msg) => { throw new HttpError(status, msg); };
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const clean = (v, max = 80) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const rand = (n) => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % n; };
const parse = (s, d) => { try { return JSON.parse(s); } catch { return d; } };
const WORDS = ['WOLF', 'CROW', 'FERN', 'ASH', 'OAK', 'FOX', 'HAWK', 'MOSS', 'REED', 'STONE', 'EMBER', 'RAVEN'];

export async function onRequest({ request, env, params }) {
  try {
    if (!env.DB) fail(500, 'The database is not connected yet. Add a D1 binding named DB in your Cloudflare Pages settings.');
    const path = (Array.isArray(params.path) ? params.path : [params.path]).filter(Boolean);
    const method = request.method;
    let body = {};
    if (method !== 'GET' && method !== 'HEAD') body = await request.json().catch(() => ({}));
    const [a, b, c] = path;

    if (a === 'config' && method === 'GET') return json(config());
    if (a === 'societies' && method === 'POST') return json(await createSociety(env, body));
    if (a === 'login' && method === 'POST') return json(await login(env, body));
    if (a === 'leaderboard' && method === 'GET') return json(await leaderboard(env, request));
    if (a === 'society' && b) {
      const soc = await authSociety(env, request, b);
      if (!c && method === 'GET') return json({ society: await publicSociety(env, soc) });
      if (c === 'setup' && method === 'PUT') return json({ society: await updateSetup(env, soc, body) });
      if (c === 'unlock' && method === 'POST') return json({ society: await unlock(env, soc, body) });
      if (c === 'decisions' && method === 'POST') return json({ society: await postDecisions(env, soc, body) });
      if (c === 'explore' && method === 'POST') return json({ society: await postExplore(env, soc, body) });
      if (c === 'continue' && method === 'POST') return json({ society: await continueExplore(env, soc) });
      if (c === 'activity' && method === 'POST') return json({ society: await postActivity(env, soc, body) });
    }
    if (a === 'admin') {
      requireAdmin(env, request);
      if (b === 'overview' && method === 'GET') return json(await adminOverview(env));
      if (b === 'passcode' && method === 'POST') return json(await adminPasscode(env, body));
      if (b === 'reveal' && method === 'POST') { await setSetting(env, 'reveal', body.on ? '1' : '0'); return json({ ok: true }); }
      if (b === 'adjust' && method === 'POST') return json(await adminAdjust(env, body));
      if (b === 'unlock' && method === 'POST') return json(await adminUnlock(env, body));
      if (b === 'delete' && method === 'POST') return json(await adminDelete(env, body));
      if (b === 'reset-all' && method === 'POST') return json(await adminResetAll(env, body));
    }
    fail(404, 'Not found.');
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Something went wrong on the server. Try again in a moment.' }, 500);
  }
}

// ---- Config for dropdowns ---------------------------------------------------
function config() {
  return {
    eventCount: EVENT_COUNT, maxMembers: MAX_MEMBERS, jobs: JOBS, govTypes: GOV_TYPES, itemCategories: ITEM_CATEGORIES,
    resources: RESOURCES, backpackItems: BACKPACK_ITEMS,
    action1: Object.entries(ACTION1).map(([id, v]) => ({ id, ...v })),
    builds: Object.entries(BUILDS).map(([id, v]) => ({ id, label: v.label, blurb: v.blurb })),
    eventTitles: EVENTS.map((e) => e.title),
  };
}

// ---- Database helpers -------------------------------------------------------
async function getSetting(env, key, def = '') {
  const r = await env.DB.prepare('SELECT value FROM settings WHERE key=?').bind(key).first();
  return r ? r.value : def;
}
async function setSetting(env, key, value) {
  await env.DB.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key, value).run();
}
function hydrate(s) {
  if (!s) return s;
  return { ...s, buildings: parse(s.buildings, {}), supplies: parse(s.supplies, []), flags: parse(s.flags, {}) };
}
async function loadMembers(env, id) {
  const { results } = await env.DB.prepare('SELECT id,name,job,profession_item,backpack FROM members WHERE society_id=? ORDER BY id').bind(id).all();
  return results.map((m) => ({ ...m, backpack: parse(m.backpack, []) }));
}
async function ensurePasscodes(env) {
  const { results } = await env.DB.prepare('SELECT event_no,code FROM passcodes').all();
  const have = new Set(results.map((r) => r.event_no));
  const ins = [];
  for (let n = 1; n <= EVENT_COUNT; n++) {
    if (!have.has(n)) ins.push(env.DB.prepare('INSERT OR IGNORE INTO passcodes(event_no,code) VALUES(?,?)').bind(n, String(1000 + rand(9000))));
  }
  if (ins.length) await env.DB.batch(ins);
  const again = await env.DB.prepare('SELECT event_no,code FROM passcodes ORDER BY event_no').all();
  return again.results;
}
async function authSociety(env, request, id) {
  const soc = hydrate(await env.DB.prepare('SELECT * FROM societies WHERE id=?').bind(id).first());
  if (!soc) fail(404, 'That society wasn’t found. It may have been removed.');
  const code = clean(request.headers.get('x-society-code'), 30).toUpperCase();
  if (code !== soc.code) fail(401, 'Your society code didn’t match. Sign in again.');
  return soc;
}
function requireAdmin(env, request) {
  if (!env.ADMIN_PASSWORD) fail(500, 'ADMIN_PASSWORD is not set. Add it as a secret in your Cloudflare Pages settings.');
  if (request.headers.get('x-admin-password') !== env.ADMIN_PASSWORD) fail(401, 'Teacher password is not correct.');
}
const isAdmin = (env, request) => !!env.ADMIN_PASSWORD && request.headers.get('x-admin-password') === env.ADMIN_PASSWORD;

// ---- Society setup ----------------------------------------------------------
function validateMembers(list) {
  if (!Array.isArray(list)) fail(400, 'Add at least one society member.');
  const out = [];
  for (const m of list.slice(0, MAX_MEMBERS)) {
    const name = clean(m?.name, 40);
    if (!name) continue; // blank rows are skipped
    if (!JOBS.includes(m.job)) fail(400, `Choose a job category for ${name}.`);
    if (!ITEM_CATEGORIES.includes(m.profession_item)) fail(400, `Choose a profession item for ${name}.`);
    const bp = (Array.isArray(m.backpack) ? m.backpack : []).filter(Boolean).slice(0, 3);
    for (const item of bp) if (!BACKPACK_ITEMS.includes(item)) fail(400, `“${clean(item, 30)}” isn’t a backpack item.`);
    out.push({ name, job: m.job, profession_item: m.profession_item, backpack: bp });
  }
  if (!out.length) fail(400, 'Add at least one society member with a name, job and profession item.');
  return out;
}
function validateSetup(body) {
  const name = clean(body.name, 40);
  if (name.length < 2) fail(400, 'Give your society a name (at least 2 characters).');
  const gov = body.gov_type;
  if (!GOV_TYPES.includes(gov)) fail(400, 'Choose a government type.');
  const goal = clean(body.goal, 200);
  if (!goal) fail(400, 'Write the goal of your society.');
  return { name, recorder: clean(body.recorder, 40), gov, goal, members: validateMembers(body.members) };
}
const memberInserts = (env, id, members) => members.map((m) =>
  env.DB.prepare('INSERT INTO members(society_id,name,job,profession_item,backpack) VALUES(?,?,?,?,?)')
    .bind(id, m.name, m.job, m.profession_item, JSON.stringify(m.backpack)));

async function createSociety(env, body) {
  const v = validateSetup(body);
  const id = crypto.randomUUID();
  const code = `${WORDS[rand(WORDS.length)]}-${1000 + rand(9000)}`;
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO societies(id,name,code,recorder,gov_type,goal) VALUES(?,?,?,?,?,?)').bind(id, v.name, code, v.recorder, v.gov, v.goal),
      ...memberInserts(env, id, v.members),
    ]);
  } catch (e) {
    if (String(e.message || e).includes('UNIQUE')) fail(409, 'That society name is already taken. Pick a different one.');
    throw e;
  }
  return { id, code };
}
async function login(env, body) {
  const name = clean(body.name, 40);
  const code = clean(body.code, 30).toUpperCase();
  const s = await env.DB.prepare('SELECT id,code FROM societies WHERE lower(name)=lower(?)').bind(name).first();
  if (!s || s.code !== code) fail(401, 'We couldn’t find a society with that name and code.');
  return { id: s.id, code: s.code };
}
async function updateSetup(env, soc, body) {
  if (!(soc.current_event === 1 && soc.stage === 'locked')) fail(409, 'Your census is locked once Event 1 begins.');
  const v = validateSetup(body);
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE societies SET name=?,recorder=?,gov_type=?,goal=? WHERE id=?').bind(v.name, v.recorder, v.gov, v.goal, soc.id),
      env.DB.prepare('DELETE FROM members WHERE society_id=?').bind(soc.id),
      ...memberInserts(env, soc.id, v.members),
    ]);
  } catch (e) {
    if (String(e.message || e).includes('UNIQUE')) fail(409, 'That society name is already taken. Pick a different one.');
    throw e;
  }
  return publicSociety(env, hydrate(await env.DB.prepare('SELECT * FROM societies WHERE id=?').bind(soc.id).first()));
}

// ---- What a student is allowed to see --------------------------------------
async function publicSociety(env, soc) {
  const reveal = (await getSetting(env, 'reveal', '0')) === '1';
  const members = await loadMembers(env, soc.id);
  const ev = EVENTS[soc.current_event - 1];
  const { results: subs } = await env.DB.prepare('SELECT event_no,step,data,result FROM submissions WHERE society_id=? ORDER BY event_no, CASE step WHEN \'decisions\' THEN 1 WHEN \'explore\' THEN 2 ELSE 3 END').bind(soc.id).all();
  const thisDecision = subs.find((s) => s.event_no === soc.current_event && s.step === 'decisions');
  const choice = thisDecision ? parse(thisDecision.data, {}).eventChoice || null : null;

  const out = {
    id: soc.id, name: soc.name, code: soc.code, recorder: soc.recorder, gov_type: soc.gov_type, goal: soc.goal,
    stage: soc.stage, current_event: soc.current_event, reveal, members,
    canEditSetup: soc.current_event === 1 && soc.stage === 'locked',
    completed: [...new Set(subs.filter((s) => s.step === 'activity').map((s) => s.event_no))],
    event: soc.stage === 'decisions' || soc.stage === 'activity' ? publicEvent(ev) : null,
    eventChoice: choice,
    activity: soc.stage === 'activity' && ev ? activityFor(ev, choice) : null,
    lockedEvent: soc.stage === 'locked' ? soc.current_event : null,
    lockedUntil: soc.flags.until || 0,
  };
  if (soc.stage === 'explore') out.explore = publicExplore(subs, soc.current_event, members);
  if (reveal) {
    out.stats = { population: soc.population, food: soc.food, infrastructure: soc.infrastructure, score: scoreOf(soc) };
    out.results = subs.map((s) => ({ event_no: s.event_no, title: EVENTS[s.event_no - 1].title, step: s.step, result: parse(s.result, {}) }));
  }
  return out;
}

function publicExplore(subs, eventNo, members) {
  const row = subs.find((x) => x.event_no === eventNo && x.step === 'explore');
  if (!row) return null;
  const r = parse(row.result, {});
  const card = EXPLORE[r.code];
  let pick = null;
  if (!r.resolved && card.pick === 'choose') pick = { prompt: card.prompt, options: card.options.map((o) => ({ id: o.id, label: o.label })) };
  if (!r.resolved && card.pick === 'drop') {
    const options = dropOptions(members);
    if (options.length) pick = { prompt: card.prompt, options };
  }
  return { title: card.title, text: card.text, kind: card.kind, resolved: !!r.resolved, pick, notes: r.notes || [] };
}

// ---- Passcode gate ----------------------------------------------------------
async function unlock(env, soc, body) {
  if (soc.stage !== 'locked') return publicSociety(env, soc);
  const now = Date.now();
  if (soc.flags.until && soc.flags.until > now) fail(429, `Too many wrong tries. Wait ${Math.ceil((soc.flags.until - now) / 1000)} seconds and try again.`);
  const codes = await ensurePasscodes(env);
  const want = codes.find((r) => r.event_no === soc.current_event)?.code || '';
  const given = clean(body.passcode, 30);
  if (!given || given.toLowerCase() !== want.toLowerCase()) {
    const fails = (soc.flags.fails || 0) + 1;
    const flags = { ...soc.flags, fails: fails >= 5 ? 0 : fails, until: fails >= 5 ? now + 30000 : 0 };
    await env.DB.prepare('UPDATE societies SET flags=? WHERE id=?').bind(JSON.stringify(flags), soc.id).run();
    fail(403, 'That passcode isn’t right. Ask your teacher.');
  }
  const flags = { ...soc.flags, fails: 0, until: 0 };
  await env.DB.prepare("UPDATE societies SET stage='decisions', flags=? WHERE id=? AND stage='locked'").bind(JSON.stringify(flags), soc.id).run();
  return publicSociety(env, hydrate(await env.DB.prepare('SELECT * FROM societies WHERE id=?').bind(soc.id).first()));
}

// ---- Step 1: decisions (Action 1 + Action 2 + dice) -------------------------
const stateOf = (soc) => ({
  population: soc.population, food: soc.food, infrastructure: soc.infrastructure,
  buildings: { ...soc.buildings }, supplies: [...soc.supplies], flags: { ...soc.flags },
});
const diceOf = (v, what) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > 6) fail(400, `Enter the number you rolled for ${what} (1 to 6).`);
  return n;
};

async function postDecisions(env, soc, body) {
  if (soc.stage !== 'decisions') fail(409, 'This step isn’t open right now.');
  const ev = EVENTS[soc.current_event - 1];
  const members = await loadMembers(env, soc.id);
  const st = stateOf(soc);
  let points = soc.points;
  const notes = [];
  const data = {};
  let code = null;

  // Action 1
  const a1 = body.action1 || {};
  if (!ACTION1[a1.type]) fail(400, 'Choose an Action 1.');
  data.action1 = { type: a1.type };
  points += POINTS.action1;
  if (a1.type === 'gather') {
    if (!RESOURCES.includes(a1.resource)) fail(400, 'Choose which resource to gather.');
    data.action1.resource = a1.resource;
    if (a1.resource === 'Food') { st.food += 25; notes.push('Gathered food (+25 food).'); }
    else if (a1.resource === 'Water') { st.food += 10; notes.push('Gathered water (+10 food supply).'); }
    else if (a1.resource === 'Building Materials') { st.flags.materials = true; notes.push('Gathered building materials (+1 to the Action 2 roll).'); }
    else { points += 4; notes.push('Gathered basic resources (+4 points).'); }
  } else if (a1.type === 'explore') {
    code = exploreCode(a1.code);
    if (!EXPLORE[code]) fail(400, 'That code isn’t on any Exploration card. Check your card and try again.');
    const used = await env.DB.prepare('SELECT 1 AS x FROM explore_used WHERE society_id=? AND code=?').bind(soc.id, code).first();
    if (used) fail(409, 'Your society already used that code. Draw a different card.');
    data.action1.code = code;
  } else if (a1.type === 'barter') {
    if (!ITEM_CATEGORIES.includes(a1.given) || !ITEM_CATEGORIES.includes(a1.received)) fail(400, 'Choose the item you gave and the item you received.');
    data.action1 = { type: 'barter', partner: clean(a1.partner, 40), given: a1.given, received: a1.received };
    st.supplies = [...st.supplies, a1.received].slice(-20);
    notes.push(`Traded ${a1.given} for ${a1.received}.`);
  } else if (a1.type === 'amend') {
    const text = clean(a1.text, 300);
    if (!text) fail(400, 'Describe what you are changing in your constitution.');
    data.action1.text = text;
    st.flags.amendedEvent = ev.n;
    notes.push('Amended the constitution.');
  }

  st.food = Math.min(FOOD_CAP, st.food);

  // Event choice (events 3, 5, 6)
  if (ev.choice) {
    if (!ev.choice.options.some((o) => o.id === body.eventChoice)) fail(400, 'Choose how your society responds to this event.');
    if (body.matches !== 'yes' && body.matches !== 'no') fail(400, 'Say whether your choice matches your constitution.');
    data.eventChoice = body.eventChoice;
    data.matches = body.matches;
    if (body.matches === 'no' && a1.type !== 'amend') {
      points -= POINTS.conflictPenalty;
      notes.push(`Choice didn’t match the constitution and it wasn’t amended (-${POINTS.conflictPenalty} points).`);
    }
  }

  // Action 2
  const a2 = body.action2 || {};
  if (!BUILDS[a2.build]) fail(400, 'Choose an Action 2.');
  const dice = diceOf(a2.dice, 'Action 2');
  const ctx = makeCtx(members, st);
  const mods = buildMods(a2.build, ctx, st.flags);
  delete st.flags.materials;
  const r = resolveRoll(dice, mods);
  points += POINTS.build[r.tier];
  if (r.tier !== 'fail') {
    st.buildings[a2.build] = (st.buildings[a2.build] || 0) + 1;
    applyEffect(st, BUILDS[a2.build].effect[r.tier]);
  }
  data.action2 = { build: a2.build, dice };
  const result = { action1: notes, action2: { label: BUILDS[a2.build].label, ...r, mods, built: r.tier !== 'fail' }, pointsEarned: points - soc.points };

  const writes = [];
  let nextStage = 'activity';
  if (code) {
    // Cards with no choice are resolved right away; the student then sees the result.
    const card = EXPLORE[code];
    nextStage = 'explore';
    const base = { code, title: card.title, kind: card.kind };
    let exploreResult;
    if (card.pick === 'choose' || (card.pick === 'drop' && dropOptions(members).length)) {
      exploreResult = { ...base, resolved: false };
    } else {
      const out = resolveExplore(card, null, members);
      points += out.points;
      st.supplies = [...st.supplies, ...out.supplies].slice(-20);
      st.food = Math.min(FOOD_CAP, st.food + out.foodAdd);
      if (out.foresight) st.flags.foresight = true;
      exploreResult = { ...base, resolved: true, notes: out.notes, pointsEarned: out.points };
    }
    writes.push(
      env.DB.prepare('INSERT INTO explore_used(society_id,code,event_no) VALUES(?,?,?)').bind(soc.id, code, ev.n),
      env.DB.prepare("INSERT INTO submissions(society_id,event_no,step,data,result) VALUES(?,?,'explore',?,?)").bind(soc.id, ev.n, JSON.stringify({ code }), JSON.stringify(exploreResult)),
    );
  }
  try {
    await env.DB.batch([
      env.DB.prepare('UPDATE societies SET population=?,food=?,infrastructure=?,points=?,buildings=?,supplies=?,flags=?,stage=? WHERE id=? AND stage=\'decisions\'')
        .bind(st.population, st.food, st.infrastructure, points, JSON.stringify(st.buildings), JSON.stringify(st.supplies), JSON.stringify(st.flags), nextStage, soc.id),
      env.DB.prepare("INSERT INTO submissions(society_id,event_no,step,data,result) VALUES(?,?,'decisions',?,?)").bind(soc.id, ev.n, JSON.stringify(data), JSON.stringify(result)),
      ...writes,
    ]);
  } catch (e) {
    if (String(e.message || e).includes('UNIQUE')) fail(409, 'That was already submitted, or the code was just used. Refresh and try again.');
    throw e;
  }
  return publicSociety(env, hydrate(await env.DB.prepare('SELECT * FROM societies WHERE id=?').bind(soc.id).first()));
}

// ---- Exploration result: pick an option (if the card needs one), then continue ----
async function postExplore(env, soc, body) {
  if (soc.stage !== 'explore') fail(409, 'There is nothing to resolve right now.');
  const row = await env.DB.prepare("SELECT result FROM submissions WHERE society_id=? AND event_no=? AND step='explore'").bind(soc.id, soc.current_event).first();
  const res = parse(row?.result, {});
  if (!res.code || res.resolved) fail(409, 'This card is already resolved.');
  const card = EXPLORE[res.code];
  const members = await loadMembers(env, soc.id);
  const choice = String(body.choice ?? '');
  if (card.pick === 'choose' && !card.options.some((o) => o.id === choice)) fail(400, 'Choose one of the options.');
  if (card.pick === 'drop' && !dropOptions(members).some((o) => o.id === choice)) fail(400, 'Choose the item you dropped.');
  const out = resolveExplore(card, choice, members);
  const st = stateOf(soc);
  st.supplies = [...st.supplies, ...out.supplies].slice(-20);
  st.food = Math.min(FOOD_CAP, st.food + out.foodAdd);
  if (out.foresight) st.flags.foresight = true;
  const writes = [
    env.DB.prepare("UPDATE societies SET food=?,points=?,supplies=?,flags=? WHERE id=? AND stage='explore'").bind(st.food, soc.points + out.points, JSON.stringify(st.supplies), JSON.stringify(st.flags), soc.id),
    env.DB.prepare("UPDATE submissions SET result=? WHERE society_id=? AND event_no=? AND step='explore'").bind(JSON.stringify({ ...res, resolved: true, notes: out.notes, pointsEarned: out.points, choice }), soc.id, soc.current_event),
  ];
  if (out.drop) {
    const m = members.find((x) => x.id === out.drop.member_id);
    const bp = m.backpack.filter((_, i) => i !== out.drop.index);
    writes.push(env.DB.prepare('UPDATE members SET backpack=? WHERE id=?').bind(JSON.stringify(bp), m.id));
  }
  await env.DB.batch(writes);
  return publicSociety(env, hydrate(await env.DB.prepare('SELECT * FROM societies WHERE id=?').bind(soc.id).first()));
}
async function continueExplore(env, soc) {
  if (soc.stage !== 'explore') return publicSociety(env, soc);
  const row = await env.DB.prepare("SELECT result FROM submissions WHERE society_id=? AND event_no=? AND step='explore'").bind(soc.id, soc.current_event).first();
  if (!parse(row?.result, {}).resolved) fail(409, 'Finish the exploration choice first.');
  await env.DB.prepare("UPDATE societies SET stage='activity' WHERE id=? AND stage='explore'").bind(soc.id).run();
  return publicSociety(env, hydrate(await env.DB.prepare('SELECT * FROM societies WHERE id=?').bind(soc.id).first()));
}

// ---- Step 2: event activity roll -------------------------------------------
async function postActivity(env, soc, body) {
  if (soc.stage !== 'activity') fail(409, 'This step isn’t open right now.');
  const ev = EVENTS[soc.current_event - 1];
  const dec = await env.DB.prepare("SELECT data FROM submissions WHERE society_id=? AND event_no=? AND step='decisions'").bind(soc.id, ev.n).first();
  const choice = dec ? parse(dec.data, {}).eventChoice || null : null;
  const dice = diceOf(body.dice, 'the event');

  const members = await loadMembers(env, soc.id);
  const st = stateOf(soc);
  const ctx = makeCtx(members, st);
  const mods = eventMods(ev, ctx, choice);
  if (st.flags.foresight) { mods.push('The wise traveler’s advice'); delete st.flags.foresight; }
  const r = resolveRoll(dice, mods);
  const effect = ev.resolve(r.tier, ctx, choice) || {};
  const before = { population: st.population, food: st.food, infrastructure: st.infrastructure };
  applyEffect(st, effect);
  const points = soc.points + POINTS.event[r.tier];
  const last = ev.n >= EVENT_COUNT;
  const result = {
    ...r, mods, outcome: activityFor(ev, choice)[r.tier], pointsEarned: POINTS.event[r.tier],
    changes: {
      population: st.population - before.population, food: st.food - before.food, infrastructure: st.infrastructure - before.infrastructure,
    },
  };

  await env.DB.batch([
    env.DB.prepare('UPDATE societies SET population=?,food=?,infrastructure=?,points=?,flags=?,stage=?,current_event=? WHERE id=? AND stage=\'activity\'')
      .bind(st.population, st.food, st.infrastructure, points, JSON.stringify(st.flags), last ? 'finished' : 'locked', last ? ev.n : ev.n + 1, soc.id),
    env.DB.prepare("INSERT INTO submissions(society_id,event_no,step,data,result) VALUES(?,?,'activity',?,?)").bind(soc.id, ev.n, JSON.stringify({ dice }), JSON.stringify(result)),
  ]);
  return publicSociety(env, hydrate(await env.DB.prepare('SELECT * FROM societies WHERE id=?').bind(soc.id).first()));
}

// ---- Leaderboard ------------------------------------------------------------
async function leaderboard(env, request) {
  const admin = isAdmin(env, request);
  const reveal = (await getSetting(env, 'reveal', '0')) === '1';
  if (!admin && !reveal) return json_locked();
  const { results } = await env.DB.prepare('SELECT * FROM societies').all();
  const { results: counts } = await env.DB.prepare('SELECT society_id, COUNT(*) AS n FROM members GROUP BY society_id').all();
  const memberCount = new Map(counts.map((c) => [c.society_id, c.n]));
  const rows = results.map(hydrate).map((s) => ({
    name: s.name, score: scoreOf(s), population: s.population, food: s.food, infrastructure: s.infrastructure,
    members: memberCount.get(s.id) || 0, buildings: Object.values(s.buildings).reduce((a, b) => a + b, 0),
    event: s.current_event, stage: s.stage,
  })).sort((x, y) => y.score - x.score || x.name.localeCompare(y.name));
  return { visible: true, teacherView: admin, reveal, societies: rows };
}
const json_locked = () => ({ visible: false, reveal: false, societies: [] });

// ---- Teacher tools ----------------------------------------------------------
async function adminOverview(env) {
  const passcodes = await ensurePasscodes(env);
  const reveal = (await getSetting(env, 'reveal', '0')) === '1';
  const { results } = await env.DB.prepare('SELECT * FROM societies ORDER BY created_at').all();
  const societies = [];
  for (const raw of results) {
    const s = hydrate(raw);
    const members = await loadMembers(env, s.id);
    const { results: subs } = await env.DB.prepare('SELECT event_no,step,data,result FROM submissions WHERE society_id=? ORDER BY event_no, CASE step WHEN \'decisions\' THEN 1 WHEN \'explore\' THEN 2 ELSE 3 END').bind(s.id).all();
    const { results: adj } = await env.DB.prepare('SELECT points,note,created_at FROM adjustments WHERE society_id=? ORDER BY id').bind(s.id).all();
    societies.push({
      id: s.id, name: s.name, code: s.code, recorder: s.recorder, gov_type: s.gov_type, goal: s.goal, stage: s.stage, current_event: s.current_event,
      population: s.population, food: s.food, infrastructure: s.infrastructure, points: s.points, adjustment: s.adjustment, score: scoreOf(s),
      buildings: s.buildings, supplies: s.supplies, members,
      submissions: subs.map((x) => ({ event_no: x.event_no, step: x.step, data: parse(x.data, {}), result: parse(x.result, {}) })), adjustments: adj,
    });
  }
  return { reveal, passcodes, eventTitles: EVENTS.map((e) => e.title), societies };
}
async function adminPasscode(env, body) {
  const n = Number(body.event);
  const code = clean(body.code, 30);
  if (!Number.isInteger(n) || n < 1 || n > EVENT_COUNT) fail(400, 'Unknown event.');
  if (code.length < 3) fail(400, 'A passcode needs at least 3 characters.');
  await env.DB.prepare('INSERT INTO passcodes(event_no,code) VALUES(?,?) ON CONFLICT(event_no) DO UPDATE SET code=excluded.code').bind(n, code).run();
  return { ok: true };
}
async function adminAdjust(env, body) {
  const pts = Math.round(Number(body.points));
  if (!Number.isFinite(pts) || pts === 0 || Math.abs(pts) > 500) fail(400, 'Enter a point amount between -500 and 500 (not 0).');
  const id = clean(body.society_id, 60);
  const s = await env.DB.prepare('SELECT id FROM societies WHERE id=?').bind(id).first();
  if (!s) fail(404, 'Society not found.');
  await env.DB.batch([
    env.DB.prepare('UPDATE societies SET adjustment=adjustment+? WHERE id=?').bind(pts, id),
    env.DB.prepare('INSERT INTO adjustments(society_id,points,note) VALUES(?,?,?)').bind(id, pts, clean(body.note, 120)),
  ]);
  return { ok: true };
}
async function adminUnlock(env, body) {
  await env.DB.prepare("UPDATE societies SET stage='decisions' WHERE id=? AND stage='locked'").bind(clean(body.society_id, 60)).run();
  return { ok: true };
}
async function adminDelete(env, body) {
  const id = clean(body.society_id, 60);
  await env.DB.batch([
    env.DB.prepare('DELETE FROM submissions WHERE society_id=?').bind(id),
    env.DB.prepare('DELETE FROM explore_used WHERE society_id=?').bind(id),
    env.DB.prepare('DELETE FROM members WHERE society_id=?').bind(id),
    env.DB.prepare('DELETE FROM adjustments WHERE society_id=?').bind(id),
    env.DB.prepare('DELETE FROM societies WHERE id=?').bind(id),
  ]);
  return { ok: true };
}
async function adminResetAll(env, body) {
  if (body.confirm !== 'RESET') fail(400, 'Type RESET to confirm.');
  await env.DB.batch([
    env.DB.prepare('DELETE FROM submissions'), env.DB.prepare('DELETE FROM explore_used'), env.DB.prepare('DELETE FROM members'),
    env.DB.prepare('DELETE FROM adjustments'), env.DB.prepare('DELETE FROM societies'),
  ]);
  await setSetting(env, 'reveal', '0');
  return { ok: true };
}
