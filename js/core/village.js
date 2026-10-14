// village.js — the valley lives. Every game day each household grows, stores, buys and eats (food.js); every body makes
// its blood and gains or loses weight (blood.js); germs pass at home, in the hamlet, on the paths (contagion.js); people
// fall ill, get better, conceive, give birth and die; and the sick decide whether to walk to your clinic. Pure.
//
// Three kinds of people (people.js keeps them all):
//   • well, or carrying only a slow illness (high blood pressure, worms, HIV, TB…): stepped once a day here; their slow
//     illnesses (P.ill) a few hours at a time (disease.js stepSlow);
//   • with a live record (P.rec): an acute illness or a pregnancy. The record is a patient record like the clinic's, run
//     hour by hour by disease.js simulate, so what they have when they walk in is exactly what they have;
//   • held by the clinic (q.held): their patient record is the clinic's (clinic.js), and runs there.
// Everyone eats with their household, and everyone counts toward what is going round.
// Every per-person roll is hashed on (seed, id, day, purpose) (rng.js STREAM), so the order people are visited in never
// matters and nothing reshuffles when something new is added.
import { population, bodyOf, traitsOf, personNow, die, addBaby, endPregnancy, touch, deathRate, conceiveRate, FP_FAIL, weeksOf, storeBody, hamletRow, householdKey, partnerOf, wealthOf, ttProtected, ntRisk, parityOf } from './people.js';
import { residentRecord, voice, conditionWeight, medianWeight, fillPkv } from './patient.js';
import { simulate, addCondition, stepSlow, inflamOf, bleedOf } from './disease.js';
import { COND, CONDITIONS } from './content/conditions.js';
import { BACKGROUND, CHRONIC, NONE, FROM_BODY, WINDOW, SLOW_MODELS, SEEK, ELSEWHERE, RARE, HOME_ORS } from './content/village.js';
import { CONTAGIOUS } from './content/contagion.js';
import { householdDay, newHousehold, dietOf, seasonOf, yday, rainOf, yearOf, share } from './food.js';
import { WILD_FOOD, TOXIC_CLASSES, FORAGE_KG, MISPICK_FOOD, MEAL_G } from './content/wild_foods.js';
import { lookalikes } from './flora.js';
import { HABITATS } from './region.js';
import { HERB } from './content/herbs.js';
import { ACTIVE } from './content/actives.js';
import { inSeason } from './time.js';
import { bloodStep, absorbIron, basalLoss, hbSet, cellLife, bloodVolume, MENSES_MG, menstruating, FOLATE_BIO, sickle } from './blood.js';
import { kcalNeed, KCAL_PER_KG, starveHazard, fertilityOf, nutritionOf } from './content/food.js';
import { infectious, immune, IDX } from './contagion.js';
import { DAY, HOUR, YEAR_DAYS, COMPRESS, day, minuteOfDay } from './time.js';
import { hashf, strHash, STREAM, makeRng } from './rng.js';
import { msg, person, en } from './i18n.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rate = (table, x) => (table.find(([b]) => x < b) || [0, 0])[1];
const ageOf = (q, d) => Math.max(0, (d - q.born) / YEAR_DAYS);
const roll = (seed, id, d, salt) => hashf(seed, strHash(id), d, salt);
const modelOf = (id) => COND.get(id).model;

// How each condition arises (content/village.js): split once.
const CHRONIC_IDS = Object.keys(CHRONIC);
const ACUTE = CONDITIONS.filter((c) => !NONE.includes(c.id) && !FROM_BODY.includes(c.id) && !CHRONIC[c.id] && !WINDOW[c.id] && c.epi.w > 0 && !c.epi.onlyPregnant && !c.epi.postpartum);
const SALT = Object.fromEntries(CONDITIONS.map((c, i) => [c.id, STREAM.inf + 10 + i]));

// ————————————————————————————————————————————— the day
/** Live every whole day since the last tick, then run every live record to now. Returns the valley's news so far. */
export function tickVillage(G) {
  const { P } = population(G), now = G.W.time, today = day(now);
  if (!P.started) { seedIllness(G, P.day); P.started = 1; }
  for (; P.day < today; P.day++) {
    villageDay(G, P.day + 1);
    advanceRecords(G, Math.min(now, (P.day + 1) * DAY));
  }
  advanceRecords(G, now);
  return P.news; // read and cleared by the clinic (clinic.js villageNews)
}

/** The slow illnesses already in the valley when it begins (or when an old save first sees the living valley): each
 *  chronic illness at its prevalence for the person's age (content/village.js CHRONIC), part-way through. */
function seedIllness(G, d) {
  const { P, L } = population(G), seed = G.meta.seed, t = (d - 1) * DAY;
  for (const q of L.values()) {
    if (q.held) continue;
    const age = ageOf(q, d);
    for (const id of CHRONIC_IDS) {
      if (roll(seed, q.id, 0, SALT[id]) >= rate(CHRONIC[id].prev, age)) continue;
      const host = hostOf(G, q, t);
      const c = addCondition(host, id, makeRng(seed, 'seed-ill', q.id, id), 0);
      if (id === 'hiv') c.cd4 = 200 + 700 * roll(seed, q.id, 1, SALT[id]); // most carry it for years before AIDS
      if (c.left != null) { c.left = 0; c.att = c.base; } // asthma between attacks (the model starts mid-attack, as patients come)
      if (CONTAGIOUS.get(id)?.route === 'sex' || id === 'tb' || id === 'leprosy') c.t0 = t - 400 * DAY * roll(seed, q.id, 2, SALT[id]);
      keepHost(G, q, host);
    }
  }
}
/** Someone's body to step or to add an illness to: their live record or the clinic's, else a stand-in record for the
 *  day built from their saved body and slow illnesses (keepHost puts it back). */
function hostOf(G, q, t) {
  const { P } = population(G);
  if (q.held) return G.meta.clinic.patients[q.held];
  if (P.rec[q.id]) return P.rec[q.id];
  const p = residentRecord({ seed: G.meta.seed, who: personNow(G, q, t), t, hamlet: hamletRow(G.W.R, q.h) });
  p.conds = P.ill[q.id] || [];
  p.stand = true;
  return p;
}
function keepHost(G, q, p) {
  const { P } = population(G);
  if (!p.stand) return;
  if (p.conds.length) P.ill[q.id] = p.conds; else delete P.ill[q.id];
  P.body[q.id][0] = p.blood.hb;
}

/** One game day for the whole valley (at its start). */
function villageDay(G, d) {
  const { P, L } = population(G), seed = G.meta.seed, cl = G.meta.clinic, R = G.W.R, t0 = (d - 1) * DAY, season = seasonOf(d);
  const people = [...L.values()];
  // ——— who is ill, and how ill, and what is going round (from the start of the day)
  const bodyNow = (q) => (q.held ? cl.patients[q.held] : P.rec[q.id]) || (P.ill[q.id] ? { conds: P.ill[q.id] } : null);
  const go = goingRound(G, people, bodyNow, t0, d);
  // ——— households: the farm, the money, the pot
  const homes = new Map();
  for (const q of people) { const k = householdKey(q); if (!homes.has(k)) homes.set(k, []); homes.get(k).push(q); }
  const meals = new Map(), hamletFood = {};
  // kin and neighbours share grain with a house that has run out (food.js share)
  const byHamlet = {};
  for (const [key, members] of homes) if (P.hh[key]) (byHamlet[members[0].h] ||= []).push({ key, hh: P.hh[key], need: members.reduce((a, q) => a + kcalNeed(ageOf(q, d), q.sex), 0) * COMPRESS });
  for (const list of Object.values(byHamlet)) share(list, d);
  // the wild food each settlement's land gives today, shared among the houses that have run short (foraging)
  const forage = {};
  for (const [hid, list] of Object.entries(byHamlet)) {
    const pool = wildPool(G, hid, t0), short = list.filter((h) => stockKcal(h.hh) < h.need);
    if (pool.kcal > 0 && short.length) for (const h of short) forage[h.key] = pool;
    forage[hid + ':n'] = short.length;
  }
  for (const [key, members] of homes) {
    const info = members.map((q) => {
      const age = ageOf(q, d), b = bodyNow(q);
      return { q, age, sex: q.sex, weeks: q.conc != null ? weeksOf(q, d) : 0, lact: q.lastBirth != null && d - q.lastBirth < YEAR_DAYS / 2, sick: sickness(b), ano: feverish(b), kgRel: bodyOf(G, q, d)[3], bf: !!q.bf && age < 2, diet: traitsOf(G, q).diet };
    });
    const hh = (P.hh[key] ||= newHousehold(seed, key, wealthOf(G, members[0]), d, info.reduce((a, m) => a + kcalNeed(m.age, m.sex), 0) * 365, members.length));
    const staff = (cl.staff || []).filter((s) => members.some((q) => q.id === s.who));
    // staff are paid straight into the house (staff.js); their days at your work are days away from the field
    // foraging: the hamlet's day of wild food split among the houses that ran short, up to what their hands can carry
    const pool = forage[key];
    const hands = info.filter((m) => m.age >= 8 && m.age < 65).reduce((a, m) => a + (1 - m.sick), 0);
    const wild = pool ? { kcal: Math.min(pool.kcal / Math.max(1, forage[members[0].h + ':n']), hands * pool.perHand * COMPRESS), dens: pool.dens } : null;
    const notes = householdDay(hh, info, { seed, d, key, away: staff.length * 0.5, meat: hh.meat || 0, wild });
    if (notes.foraged) mispick(G, members, d, t0);
    hh.meat = 0;
    meals.set(key, { hh, info });
    const hf = (hamletFood[members[0].h] ||= { r: 0, n: 0, harvest: null, rain: null });
    hf.r += hh.r * members.length; hf.n += members.length;
    if (notes.harvest === 'maize') { hf.harvest = 'maize'; hf.rain = notes.rain; }
  }
  foodNews(G, d, hamletFood);
  // ——— each person
  for (const q of people) {
    if (!L.has(q.id)) continue; // died earlier today (a mother's death can come before her baby's turn)
    const age = ageOf(q, d), key = householdKey(q), meal = meals.get(key), m = meal.info.find((x) => x.q === q);
    const mother = q.mother && L.get(q.mother), motherR = mother ? meals.get(householdKey(mother))?.hh.r : null;
    const diet = dietOf(meal.hh, m, q.bf ? motherR : null);
    const rec = q.held ? cl.patients[q.held] : P.rec[q.id];
    if (rec) {
      rec.diet = diet;
      if (!q.held) rec.conds = curedElsewhere(seed, q, d, age, rec.conds);
      // a record's body ages with the person: a child's weight grows with the median for age
      if (!q.held && age - rec.age > 0.004) { rec.weight = Math.round(rec.weight * (medianWeight(age, q.sex) / medianWeight(rec.age, q.sex)) * 100) / 100; rec.age = Math.round(age * 1000) / 1000; }
    }
    else if (!wellDay(G, q, d, age, diet)) continue; // died of a slow illness or starving
    catchSomething(G, q, d, age, go, meal);
    if (!L.has(q.id)) continue;
    lifeAndDeath(G, q, d, age, diet);
  }
  P.stats.days = (P.stats.days || 0) + 1;
}
// ————————————————————————————————————————————— wild food
const stockKcal = (hh) => hh.maize * 3650 + hh.beans * 3330 + hh.cass * 1600;
const nearCache = new WeakMap();
/**
 * The wild land within a walk of a settlement (20 tiles), as tiles of each habitat, and the species of this valley that
 * grow there (region.js floraHere, by their habitat weights): the plants on the map are the notable ones; the bush holds
 * many more of the same. Cached per region. Without a world (tests) there is none.
 */
function bushNear(G, hid) {
  const R = G.W.R;
  if (!R?.hab || !R.floraHere) return null;
  let m = nearCache.get(R);
  if (!m) nearCache.set(R, (m = new Map()));
  if (m.has(hid)) return m.get(hid);
  const s = hamletRow(R, hid), tiles = {};
  for (let y = Math.max(0, s.y - 20); y <= Math.min(R.N - 1, s.y + 20); y++) for (let x = Math.max(0, s.x - 20); x <= Math.min(R.N - 1, s.x + 20); x++) {
    const hab = HABITATS[R.hab[y * R.N + x]];
    if (hab !== 'village' && hab !== 'field') tiles[hab] = (tiles[hab] || 0) + 1;
  }
  const grows = (id) => { const h = HERB.get(id); return h ? Object.entries(h.habitat || {}).reduce((a, [hab, w]) => a + (tiles[hab] || 0) * w, 0) : 0; };
  const species = R.floraHere.map((id) => ({ id, n: grows(id) })).filter((x) => x.n > 0);
  const out = { tiles, species, ids: new Set(species.map((x) => x.id)) };
  m.set(hid, out);
  return out;
}
// How many plants of an edible species a tile of its habitat holds, at its habitat weight (an estimate, set so that the
// bush around a hamlet can feed a tenth or two of its people in a hungry season, as wild foods do in East Africa)
const WILD_DENSITY = 0.25;
/** A settlement's wild food for a game day: each edible species in season gives its plants' picking (`harvest` kg each)
 *  over its regrowth (game days). Returns { kcal, dens (per 1000 kcal), perHand (kcal a forager carries a real day) }. */
function wildPool(G, hid, t) {
  let kcal = 0, fe = 0, haem = 0, folate = 0, hand = 0;
  const bush = bushNear(G, hid);
  for (const s of bush?.species || []) {
    const w = WILD_FOOD.get(s.id), h = HERB.get(s.id);
    if (!w || !h || !inSeason(h.seasons, t)) continue;
    const kg = (s.n * WILD_DENSITY * w.harvest) / Math.max(1, h.regrowDays), kc = kg * w.food.kcal;
    kcal += kc; fe += kg * w.food.fe; haem += kg * w.food.fe * w.food.haem; folate += kg * w.food.folate;
    hand = Math.max(hand, FORAGE_KG[w.part] * w.food.kcal);
  }
  return { kcal, dens: kcal ? { fe: (fe * 1000) / kcal, haem: (haem * 1000) / kcal, folate: (folate * 1000) / kcal } : null, perHand: hand };
}
/**
 * Hunger makes foragers less careful: now and then someone in a house that foraged eats a poisonous plant mistaken for
 * a food (a same-genus or same-family lookalike growing nearby, flora.js lookalikes, with a dangerous compound class).
 * A meal (MEAL_G of the fresh plant) goes into their body as doses of its real compounds (content/flora_actives.js), so
 * what follows is pharmacology, not a script.
 */
function mispick(G, members, d, t0) {
  const seed = G.meta.seed, q0 = members[0], bush = bushNear(G, q0.h);
  if (!bush || roll(seed, householdKey(q0), d, STREAM.gather + 50) >= MISPICK_FOOD) return;
  const here = bush.ids, foods = bush.species.filter((s) => WILD_FOOD.has(s.id));
  const bad = [];
  for (const f of foods) for (const l of lookalikes(f.id)) if (here.has(l.id) && Object.keys(HERB.get(l.id)?.contains || {}).some((k) => TOXIC_CLASSES.includes(k))) bad.push([f.id, l.id]);
  if (!bad.length) return;
  const [meant, ate] = bad[Math.floor(roll(seed, householdKey(q0), d, STREAM.gather + 51) * bad.length)];
  const who = members[Math.floor(roll(seed, householdKey(q0), d, STREAM.gather + 52) * members.length)];
  const cl = G.meta.clinic, t = t0 + 12 * HOUR, h = HERB.get(ate);
  const p = who.held ? cl.patients[who.held] : recordFor(G, who, t0);
  for (const [cls, [lo, hi]] of Object.entries(h.contains)) {
    const a = ACTIVE.get(cls);
    if (!a) continue;
    const mg = ((lo + hi) / 2) * 10 * h.dry * MEAL_G; // % of dry weight → mg in a meal of fresh plant
    if (a.channel === 'systemic') (p.doses.sys[cls] ||= []).push([t, mg]);
    else if (a.channel === 'gut') p.doses.gut.push([t, cls, mg]);
  }
  (p.ate ||= []).push({ t, ate, meant });
}

/** How much a feverish acute illness takes off the appetite now, 0..1 (long, mild illness does not: disease.js). */
function feverish(b) {
  let s = 0;
  for (const c of b?.conds || []) if (ANOREXIC(c)) s = Math.max(s, clamp(c.s || 0, 0, 1));
  return s;
}
export const ANOREXIC = (c) => { const def = COND.get(c.id); return ['viral', 'malaria'].includes(def.model) || (def.model === 'bacterial' && !def.params.pace); };
/** How much illness takes from someone's work, 0..1. */
function sickness(b) {
  if (!b?.conds?.length) return 0;
  let s = 0;
  for (const c of b.conds) s = Math.max(s, clamp(c.s || 0, 0, 1) * (SLOW_MODELS.has(modelOf(c.id)) ? 0.5 : 1));
  return s;
}

// ————————————————————————————————————————————— a well body, a day
/** A day of someone up and about: slow illness, blood, weight, and what the body itself turns into an illness (low
 *  blood, wasting). Returns false if they died. */
function wellDay(G, q, d, age, diet) {
  const { P, L } = population(G), seed = G.meta.seed, t0 = (d - 1) * DAY;
  const B = bodyOf(G, q, d), tr = traitsOf(G, q);
  let bleed = 0, inflam = 0;
  if (P.ill[q.id]?.length) {
    const host = hostOf(G, q, t0);
    const instr = new Set(Object.keys(q.advice || {}).filter((k) => q.advice[k] > t0));
    const res = stepSlow(host, t0, 24, instr);
    for (const id of res.done) immunise(G, q, id, d);
    host.conds = curedElsewhere(seed, q, d, age, host.conds);
    bleed = bleedOf(host); inflam = inflamOf(host);
    const flare = host.conds.some((c) => (c.s || 0) >= 0.4 && ['asthma', 'fits'].includes(modelOf(c.id))); // an attack or a fit
    if (roll(seed, q.id, d, STREAM.slowDeath) < res.die) { villageDeath(G, q, host, res.killer); return false; }
    keepHost(G, q, host);
    // a complication (a stroke, TB with HIV) or a flare (an asthma attack, fits): the body now runs hour by hour
    if (host.pending?.length || flare) { const r = recordFor(G, q, t0); for (const x of host.pending || []) (r.pending ||= []).push(x); }
  }
  if (P.rec[q.id]) return true; // a record runs the body from now on
  // blood: a day of marrow work (COMPRESS real days)
  const kg = medianWeight(age, q.sex) * B[3], b = { hb: B[0], fe: B[1], fol: B[2], mcv: B[4], r: B[5] };
  const sinceBirth = q.lastBirth != null ? (d - q.lastBirth) * COMPRESS : null;
  const menses = menstruating(q.sex, age, 0, sinceBirth, (q.fpUntil || 0) > d) ? MENSES_MG * tr.menses : 0;
  const grow = age < 18 ? (bloodVolume(medianWeight(age + 1 / YEAR_DAYS, q.sex) * B[3], age, q.sex) - bloodVolume(kg, age, q.sex)) / COMPRESS : 0;
  bloodStep(b, { set: hbSet(age, q.sex, 0, tr.g), life: cellLife(tr.g), bv: bloodVolume(kg, age, q.sex), feIn: absorbIron(diet, b.fe, inflam, 0) + (diet.abs || 0), feOut: basalLoss(kg, b.fe) + menses, bleed, inflam, folIn: diet.folate * FOLATE_BIO, g: tr.g, age, grow: Math.max(0, grow) }, COMPRESS);
  // weight: energy in against energy out; children grow with the median as long as they are fed
  // the household's share over COMPRESS real days, less a real day of a feverish appetite. Energy needs follow body
  // weight, so a steady short ration leaves people thin rather than starving (adaptation; the weight a ration settles
  // at is about the ration: an estimate after Hall KD et al. Lancet 2011;378:826)
  const dk = (((diet.r - B[3]) * COMPRESS - (diet.ano || 0)) * kcalNeed(age, q.sex)) / KCAL_PER_KG(age);
  const kgRel = clamp(B[3] + dk / medianWeight(age, q.sex), 0.5, diet.r > 1 ? Math.max(B[3], 1.03) : 1.25);
  P.body[q.id] = [b.hb, b.fe, b.fol, kgRel, b.mcv, b.r].map((v) => Math.round(v * 1000) / 1000);
  // starving
  if (roll(seed, q.id, d, STREAM.starve) < 1 - Math.exp(-starveHazard(kgRel) * COMPRESS)) { villageDeath(G, q, null, 'starvation'); return false; }
  // what the body turns into an illness: blood well below where it should be; a small child wasting away
  const set = hbSet(age, q.sex, 0, tr.g), has = (id) => P.ill[q.id]?.some((c) => c.id === id);
  if (b.hb < set - 2 && !has('anaemia')) addSlow(G, q, 'anaemia', t0);
  const nut = nutritionOf(kgRel);
  if (age >= 0.5 && age < 5 && nut < 0.45 && !has('marasmus') && !has('kwashiorkor') && roll(seed, q.id, d, SALT.marasmus) < 0.3) {
    const kw = age >= 1 && roll(seed, q.id, d, SALT.kwashiorkor) < 0.3; // oedema in about a third (estimate)
    addSlow(G, q, kw ? 'kwashiorkor' : 'marasmus', t0);
  }
  return true;
}
/** Cured somewhere other than your clinic: school deworming, a tube of cream or tablets from the shop (content/village.js
 *  ELSEWHERE). Returns the illnesses that remain. */
function curedElsewhere(seed, q, d, age, conds) {
  return conds.filter((c) => { const k = ELSEWHERE[c.id]; const hz = k ? (typeof k === 'number' ? k : age < 15 ? k.child : k.adult) : 0; return !(hz && roll(seed, q.id, d, SALT[c.id] + 500) < hz); });
}
/** Add a slow illness to someone up and about (it may need a record if it is not slow after all). */
function addSlow(G, q, id, t) {
  const host = hostOf(G, q, t);
  const c = addCondition(host, id, makeRng(G.meta.seed, 'ill', q.id, id, Math.floor(t)), 0);
  if (c.left != null) { c.left = 0; c.att = c.base; } // asthma begins between attacks
  if (host.stand) keepHost(G, q, host);
}

// ————————————————————————————————————————————— what is going round
/**
 * Infectious people today: per hamlet and per household, each germ; and each hamlet's usual number (a slow average),
 * against which today's makes the local force of infection (content/contagion.js). Also the valley's totals.
 */
function goingRound(G, people, bodyNow, t, d) {
  const { P, L } = population(G);
  const H = {}, HH = {}, V = { N: 0, I: {} };
  for (const q of people) {
    const h = (H[q.h] ||= { N: 0, I: {} });
    h.N++; V.N++;
    const b = bodyNow(q);
    if (!b) continue;
    for (const c of b.conds || []) {
      const row = CONTAGIOUS.get(c.id);
      if (!row || !infectious(c, t, row)) continue;
      h.I[c.id] = (h.I[c.id] || 0) + 1; V.I[c.id] = (V.I[c.id] || 0) + 1;
      const k = householdKey(q);
      ((HH[k] ||= {})[c.id] ||= []).push(q.id);
    }
  }
  // the usual number: a slow average over ~2 game years (an outbreak is today's count well above it)
  for (const [hid, h] of Object.entries(H)) {
    const E = (P.epi[hid] ||= {});
    for (const row of CONTAGIOUS.values()) {
      const I = h.I[row.id] || 0;
      E[row.id] = E[row.id] == null ? I : E[row.id] + (I - E[row.id]) / 80;
    }
  }
  return { H, HH, V };
}

// ————————————————————————————————————————————— catching something
/**
 * The day's risk of each illness for this person, summed; at most one new illness begins (at a hashed hour). Germs that
 * pass between people take their share from what is going round (content/contagion.js); the rest from the
 * conditions table's weights (BACKGROUND), the chronic incidences and the windows of pregnancy and infancy.
 */
function catchSomething(G, q, d, age, go, meal) {
  const { P, L } = population(G), seed = G.meta.seed, cl = G.meta.clinic, t0 = (d - 1) * DAY;
  const host = q.held ? cl.patients[q.held] : P.rec[q.id];
  const have = new Set([...(host?.conds || P.ill[q.id] || []).map((c) => c.id), ...(host?.pending || []).map((x) => x.id)]);
  const weeks = host?.pregnant ?? (q.conc != null ? weeksOf(q, d) : 0);
  const who = { sex: q.sex, age, pregnant: weeks, pp: q.lastBirth != null ? (d - q.lastBirth) * COMPRESS : null, advice: q.advice && Object.fromEntries(Object.entries(q.advice).filter(([, u]) => u > t0)) };
  const hamlet = hamletRow(G.W.R, q.h), season = seasonOf(d), h = go.H[q.h], E = P.epi[q.h] || {}, mine = go.HH[householdKey(q)] || {};
  const age0 = q.id.startsWith('b') ? 0 : Math.max(0, (P.day0 - q.born) / YEAR_DAYS), imm = P.imm[q.id], g = traitsOf(G, q).g;
  const risks = [];
  const add = (id, hz) => { if (hz > 0 && !have.has(id)) risks.push([id, hz]); };
  // germs that pass between people
  const passed = (row, base) => {
    if (immune(seed, q.id, row, d, age, age0, imm)) return 0;
    const inHouse = (mine[row.id] || []).filter((x) => x !== q.id).length;
    let hz;
    if (row.sir) {
      const beta = row.sir.r0 / row.sir.days;
      hz = beta * (0.7 * (h.I[row.id] || 0) / h.N + 0.3 * (go.V.I[row.id] || 0) / go.V.N) + (row.import || 0);
    } else {
      const rho = clamp(((h.I[row.id] || 0) + 0.5) / ((E[row.id] || 0) + 0.5), 0, 6);
      hz = base * ((1 - row.alpha) + row.alpha * rho) + (row.import || 0);
    }
    if (inHouse && row.sar) {
      const days = row.inf ? Math.max(1, row.inf[1] - row.inf[0]) : 30;
      const perDay = row.slow ? row.sar / YEAR_DAYS : 1 - (1 - row.sar) ** (1 / days);
      hz += -Math.log(1 - perDay) * inHouse;
    }
    if (row.route === 'sex' && row.partner) {
      const pt = partnerOf(G, q), pb = pt && (pt.held ? cl.patients[pt.held] : P.rec[pt.id] || (P.ill[pt.id] ? { conds: P.ill[pt.id] } : null));
      if (pb?.conds?.some((c) => c.id === row.id && infectious(c, t0, row))) hz += row.partner * (row.slow ? COMPRESS : 1);
    }
    if (row.trait && sickle(g) === 1) hz *= row.trait;
    return hz;
  };
  for (const def of ACUTE) {
    const w = conditionWeight(def, who, season, hamlet);
    const row = CONTAGIOUS.get(def.id);
    // a first pregnancy has no immunity to the parasites that hide in the placenta: they catch it more, later ones
    // less (Desai M et al. Lancet Infect Dis 2007;7:93; the split of the table's ×2 is an estimate)
    const base = BACKGROUND * w * (RARE[def.id] ?? 1) * (def.id === 'malaria' && weeks ? (parityOf(G, q) ? 0.8 : 1.5) : 1);
    add(def.id, row ? passed(row, base) : base);
  }
  // lifelong and years-long illness: incidence a game year, with the same season, place and prevention as the table
  for (const id of CHRONIC_IDS) {
    const def = COND.get(id), C = CHRONIC[id], row = CONTAGIOUS.get(id);
    const plain = conditionWeight(def, { ...who, advice: null }, null, null), env = plain > 0 ? conditionWeight(def, who, season, hamlet) / plain : 1;
    const base = (rate(C.inc, age) / YEAR_DAYS) * env;
    add(id, row ? passed(row, base) : base);
  }
  // windows: a share of pregnancies, mothers, newborns
  for (const [id, W] of Object.entries(WINDOW)) {
    let span = 0;
    if (W.weeks && weeks >= W.weeks[0] && weeks < W.weeks[1]) span = ((W.weeks[1] - W.weeks[0]) * 7) / COMPRESS;
    else if (W.pp && who.pp != null && who.pp >= W.pp[0] && who.pp < W.pp[1]) span = (W.pp[1] - W.pp[0]) / COMPRESS;
    else if (W.age && age >= W.age[0] && age < W.age[1]) span = (W.age[1] - W.age[0]) * YEAR_DAYS;
    if (!span) continue;
    const p = W.tetanus ? (q.ntp ?? W.p) : W.p;
    add(id, -Math.log(1 - Math.min(0.99, p)) / span);
  }
  const total = risks.reduce((a, [, hz]) => a + hz, 0);
  if (!total || roll(seed, q.id, d, STREAM.inf) >= 1 - Math.exp(-total)) return;
  let u = roll(seed, q.id, d, STREAM.inf + 1) * total, id = risks[risks.length - 1][0];
  for (const [k, hz] of risks) { u -= hz; if (u < 0) { id = k; break; } }
  const when = t0 + Math.floor(roll(seed, q.id, d, STREAM.inf + 2) * DAY);
  const def = COND.get(id);
  if (!host && SLOW_MODELS.has(def.model) && !def.params.urgent) { addSlow(G, q, id, when); return; }
  const rec = host || recordFor(G, q, t0);
  // most episodes in the community are milder than those that reach a clinic (the table's severities are a clinic's):
  // a share of the clinic's severity, mostly well below it (an estimate)
  const m = roll(seed, q.id, d, STREAM.inf + 3);
  (rec.pending ||= []).push({ id, t: when, mild: Math.round((0.35 + 0.65 * m * m) * 100) / 100 });
}

// ————————————————————————————————————————————— births, deaths, conception
function lifeAndDeath(G, q, d, age, diet) {
  const { P, L } = population(G), seed = G.meta.seed, cl = G.meta.clinic, t0 = (d - 1) * DAY;
  if (q.held) return;
  // what no illness in the game covers: cancers, accidents, old age
  if (roll(seed, q.id, d, STREAM.death) < deathRate(age) / YEAR_DAYS) { villageDeath(G, q, P.rec[q.id], 'other'); return; }
  const rec = P.rec[q.id];
  if (q.conc != null) { if (!rec) recordFor(G, q, t0); return; } // every pregnancy runs as a record
  if (q.sex !== 'f' || d < (q.pp || 0) || rec?.pregnant) return;
  const chance = (conceiveRate(age) / YEAR_DAYS) * (q.fpUntil > d ? FP_FAIL : 1) * fertilityOf(nutritionOf(bodyOf(G, q, d)[3]));
  if (roll(seed, q.id, d, STREAM.conceive) >= chance) return;
  q.conc = d; touch(P, q);
  const r = recordFor(G, q, t0);
  r.pregnant = 2; delete r.foetus; delete r.delivered;
}

// ————————————————————————————————————————————— records
/** The live record of a resident, made now if need be: their body, makings, and slow illnesses move into it. */
export function recordFor(G, q, t) {
  const { P } = population(G);
  if (P.rec[q.id]) return P.rec[q.id];
  const p = residentRecord({ seed: G.meta.seed, who: personNow(G, q, t), t, hamlet: hamletRow(G.W.R, q.h) });
  if (P.ill[q.id]) { p.conds.push(...P.ill[q.id]); delete P.ill[q.id]; }
  P.rec[q.id] = p;
  return p;
}
/** Run every live record to toT, and act on what happens: deaths, births, emergencies, getting better. */
function advanceRecords(G, toT) {
  const { P, L } = population(G);
  for (const id of Object.keys(P.rec)) {
    const p = P.rec[id], q = L.get(id);
    if (!q || q.held) { delete P.rec[id]; continue; }
    if (p.t + HOUR > toT) continue;
    const ev = simulate(p, toT);
    if (recordEvents(G, q, p, ev) === 'dead') continue;
    settle(G, q, p);
  }
}
/** Events from a resident's record. Returns 'dead' if they died. */
function recordEvents(G, q, p, ev) {
  const { P, L } = population(G), d = day(G.W.time);
  for (const e of ev) {
    if (e.kind === 'died') { villageDeath(G, q, p, null); return 'dead'; }
    if (e.kind === 'healed') immunise(G, q, e.id, d);
    if (e.kind === 'birth' || e.kind === 'stillbirth' || e.kind === 'miscarriage') {
      const bd = Math.floor(e.t / DAY) + 1;
      if (e.kind === 'birth') {
        const b = addBaby(G, P, L, q, e.baby, bd, makeRng(p.seed, 'nn', Math.floor(e.t)), p.blood?.fe);
        // tetanus of the newborn comes as an illness (content/village.js WINDOW): its chance, from the mother's
        // injections and a clean birth (people.js ntRisk), ~85% of cases fatal untreated
        if (b) { b.ntp = ntRisk(ttProtected(q.vacc, q.id), !!e.baby.clean) / 0.85; touch(P, b); }
        q.pp = bd + (b ? YEAR_DAYS : 3);
      } else q.pp = bd + 3;
      if (e.kind !== 'miscarriage') { q.lastBirth = bd; q.parity = parityOf(G, q) + 1; }
      endPregnancy(q); touch(P, q);
      if (e.kind === 'stillbirth') P.stats.stillbirths = (P.stats.stillbirths || 0) + 1;
    }
    if (e.kind === 'onset' && COND.get(e.id).params.urgent) urgent(G, q, p, e);
    if (e.kind === 'onset' && COND.get(e.id).params.stool && roll(G.meta.seed, q.id, Math.floor(e.t), STREAM.urgent + 100) < HOME_ORS) homeFluids(p, e.t);
  }
  return null;
}
/** The family makes up the WHO rehydration drink from a sachet bought at the shop, for three days (content/village.js
 *  HOME_ORS): a small child ~75 ml a time, older ~150–250, six times a day (WTND pp.152–155). */
function homeFluids(p, t) {
  if (p.rx.some((r) => r.fluid && !r.stopped && r.start + r.days * DAY > t)) return;
  const ml = p.age < 2 ? 75 : p.age < 5 ? 150 : 250;
  p.rx.push({ item: 'ors_who', name: 'Rehydration drink (WHO sachet)', q: 1, left: ml * 6 * 3, amount: ml, perDay: 6, days: 3, start: t, route: 'oral', fluid: { na: 75 }, counselled: false, bought: true });
}
/** A record with nothing left to run is let go; one with only slow illness, not pregnant, goes back to the daily step. */
function settle(G, q, p) {
  const { P } = population(G);
  if (p.dead || p.pregnant || p.pending?.length) return;
  if (p.rx?.some((r) => !r.stopped && r.start + r.days * DAY > p.t)) return; // a home remedy being taken
  if (Object.values(p.doses?.sys || {}).some((l) => l.some(([t]) => p.t - t < 72 * HOUR)) || (p.doses?.gut || []).some(([t]) => p.t - t < 72 * HOUR)) return; // something swallowed still acting
  if (!p.conds.length) { storeBody(G, q, p); delete P.rec[q.id]; return; }
  const attack = (c) => ['asthma', 'fits'].includes(modelOf(c.id)) && (c.s || 0) >= 0.35;
  if (p.conds.every((c) => SLOW_MODELS.has(modelOf(c.id)) && !attack(c))) { storeBody(G, q, p); P.ill[q.id] = p.conds; delete P.rec[q.id]; }
}
/** An emergency at home (a birth gone wrong, fits, a baby's infection): the family carries them to you, if they think
 *  of it (more often as your name grows; an estimate). */
function urgent(G, q, p, e) {
  const cl = G.meta.clinic;
  if (roll(G.meta.seed, q.id, Math.floor(e.t), STREAM.urgent) > 0.5 + 0.4 * (cl.rep ?? 0.3)) return;
  const what = en(COND.get(e.id), 'name');
  (cl.urgent ||= []).push({ who: q.id, t: e.t + HOUR, why: { ...msg('brought in: {what}', { what }), en: `brought in: ${what.toLowerCase()}` } });
}
/** Immunity after an illness, if it leaves any (content/contagion.js imm, in game days; -1 for life). */
export function immunise(G, q, condId, d) {
  const row = CONTAGIOUS.get(condId);
  if (!row?.imm) return;
  const { P } = population(G);
  (P.imm[q.id] ||= {})[condId] = row.imm === -1 ? -1 : Math.round(d + row.imm);
}

/** A death in the valley, not in your care: the news, and the valley's count by cause. */
function villageDeath(G, q, p, cause) {
  const { P, L } = population(G), d = day(G.W.time);
  const why = cause === 'starvation' ? msg('hunger') : cause === 'other' || !cause && !p ? msg('old age or an accident') : p?.causeMsg ?? (cause && COND.has(cause) ? en(COND.get(cause), 'name') : msg('an illness'));
  const key = cause === 'starvation' ? 'starvation' : cause === 'other' ? 'other' : p?.cause || cause || 'illness';
  (P.stats.causes ||= {})[key] = (P.stats.causes[key] || 0) + 1;
  const age = ageOf(q, d), place = hamletRow(G.W.R, q.h).name;
  const name = personNameOf(G, q);
  if (cause !== 'other' || age < 50) P.news.push({ kind: 'village', who: q.id, text: null, msg: age < 13 ? msg('A child of {place} died at home: {cause}.', { place: person(place), cause: why }) : msg('{name} of {place} died at home: {cause}.', { name: person(name), place: person(place), cause: why }) });
  die(P, L, q);
}
const personNameOf = (G, q) => personNow(G, q, G.W.time).name;

// ————————————————————————————————————————————— news of the harvest and of hunger
function foodNews(G, d, hamletFood) {
  const { P } = population(G);
  for (const [hid, f] of Object.entries(hamletFood)) {
    const place = hamletRow(G.W.R, hid).name, r = f.r / Math.max(1, f.n);
    const E = (P.epi[hid] ||= {});
    if (f.harvest && f.rain != null && hid === 'village') P.news.push({ kind: 'harvest', msg: f.rain < 0.6 ? msg('The rains failed: the maize harvest is poor across the valley.') : f.rain > 1.1 ? msg('A good maize harvest across the valley this year.') : msg('The maize is in: an ordinary harvest.') });
    // hunger, once it starts and once it ends (the hamlet's households eat less than they need)
    if (r < 0.85 && !E.hungry) { E.hungry = d; P.news.push({ kind: 'hunger', msg: msg('In {place} families are eating once a day.', { place: person(place) }) }); }
    else if (r > 0.95 && E.hungry) { delete E.hungry; P.news.push({ kind: 'hunger', msg: msg('In {place} there is enough to eat again.', { place: person(place) }) }); }
    E.food = Math.round(r * 100) / 100;
  }
}

// ————————————————————————————————————————————— coming to the clinic
// Each ill person's daily chance of coming: H0 × how ill they feel^1.5, more for a small child, less for the far
// hamlets, with your fee, your name, their means and what they think of you. H0 makes ~3–4 a day at the start, as the
// clinic used to see (calibrated estimate: test/arrivals.test.mjs).
export const H0 = 0.35;
const feeFactor = (fee) => clamp(1.15 - fee * 0.07, 0.4, 1.15);
/** Who comes today, and when: [{ who, t, hamlet }]. Decided once, at the day's start (clinic.js dayPlan). */
export function seekers(G, d, open, last) {
  const { P, L } = population(G), seed = G.meta.seed, cl = G.meta.clinic, out = [];
  const consider = (q, conds) => {
    if (q.held || !conds?.length) return;
    let s = 0;
    for (const c of conds) s = Math.max(s, clamp(c.s || 0, 0, 1) * (SEEK[c.id] ?? 1));
    if (s < 0.08) return;
    const age = ageOf(q, d), h = hamletRow(G.W.R, q.h);
    const hz = H0 * s ** 1.5 * (age < 5 ? 1.5 : 1) / (1 + (h.dist || 0) / 35) * feeFactor(cl.fee) * ((0.3 + cl.rep) / 0.6) * (0.6 + 0.6 * wealthOf(G, q)) * (0.5 + (q.trust ?? 0.5));
    if (roll(seed, q.id, d, STREAM.seek) >= 1 - Math.exp(-hz)) return;
    out.push({ who: q.id, hamlet: q.h, t: (d - 1) * DAY + open + roll(seed, q.id, d, STREAM.seekAt) * (last - open) });
  };
  for (const [id, p] of Object.entries(P.rec)) { const q = L.get(id); if (q) consider(q, p.conds); }
  for (const [id, conds] of Object.entries(P.ill)) { const q = L.get(id); if (q && !P.rec[id]) consider(q, conds); }
  return out;
}
/**
 * A resident walks in: the clinic takes over their record (made now from their slow illness if they had none). Returns
 * the patient record, or null if they are no longer ill or no longer alive.
 */
export function walkIn(G, whoId, t) {
  const { P, L } = population(G), q = L.get(whoId);
  if (!q || q.held) return null;
  const p = P.rec[whoId] || (P.ill[whoId]?.length ? recordFor(G, q, Math.min(t, G.W.time)) : null);
  if (!p || p.dead) return null;
  if (p.t < t) { const ev = simulate(p, t); if (recordEvents(G, q, p, ev) === 'dead') return null; }
  if (!p.conds.length || !voice(p, Math.max(p.t, t))) return null;
  fillPkv(p, G.meta.seed, q.id);
  delete P.rec[whoId];
  return p;
}
export { seasonOf, yday, rainOf, yearOf };
