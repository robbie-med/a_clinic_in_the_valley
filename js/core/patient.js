// patient.js — who walks in. A patient is a seeded person (age, sex, weight, nutrition, pregnancy,
// how well they take medicine, how much they can pay) carrying one illness, already some hours in.
import { makeRng, weighted, pickBy } from './rng.js';
import { expand } from './lore.js';
import { COND, CONDITIONS } from './content/conditions.js';
import { ACTIVES } from './content/actives.js';
import { addCondition } from './disease.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Rural population pyramid (young): share of people per age band.
const PYRAMID = [[0, 1, 0.035], [1, 5, 0.13], [5, 15, 0.28], [15, 45, 0.4], [45, 60, 0.09], [60, 85, 0.065]];
// Median weight (kg) by age, roughly WHO growth standards; adults are rural averages.
const WEIGHT = [[0, 3.3], [0.5, 7.5], [1, 9.6], [2, 12.2], [3, 14.3], [4, 16.3], [5, 18.3], [6, 20.5], [8, 25.5], [10, 31.5], [12, 39], [14, 48], [16, 54], [18, 58], [60, 58], [85, 52]];
export function medianWeight(age, sex) {
  let i = 0;
  while (i < WEIGHT.length - 2 && WEIGHT[i + 1][0] <= age) i++;
  const [a0, w0] = WEIGHT[i], [a1, w1] = WEIGHT[i + 1];
  const w = lerp(w0, w1, clamp((age - a0) / (a1 - a0), 0, 1));
  return age >= 15 ? w * (sex === 'm' ? 1.1 : 0.94) : w;
}

const NAMES = {
  female: ['#a##b#', '#a##c#', '#d##b#'], male: ['#a##e#', '#d##e#', '#a##f#'],
  a: ['A', 'Ba', 'Ce', 'Da', 'E', 'Fa', 'Ha', 'I', 'Ja', 'Ka', 'Ki', 'Lu', 'Ma', 'Mi', 'Na', 'Ne', 'O', 'Pa', 'Ra', 'Sa', 'Se', 'Ta', 'Tu', 'Wa', 'Ya', 'Za', 'Zu'],
  b: ['mina', 'risa', 'lani', 'yana', 'shi', 'nde', 'ela', 'ira', 'una', 'wari', 'tima', 'ena', 'liya'],
  c: ['ko', 'ma', 'ni', 'ri', 'la'], d: ['Bo', 'Do', 'Go', 'Jo', 'Ko', 'Mo', 'No', 'To'],
  e: ['ru', 'to', 'mon', 'jani', 'kosi', 'ndo', 'bari', 'lo', 'shon', 'dumo', 'tasi', 'ngo'], f: ['ko', 'ni', 'mo', 'ri', 'to', 'ka'],
};
export function personName(rng, sex) {
  const n = expand(pickBy(NAMES[sex === 'f' ? 'female' : 'male'], rng()), NAMES, rng);
  return n.charAt(0).toUpperCase() + n.slice(1);
}

/** Relative chance of a condition for a person of this age/sex/pregnancy in this season and hamlet. */
export function conditionWeight(def, person, season, hamlet) {
  const E = def.epi;
  if (E.onlyPregnant && !person.pregnant) return 0;
  if (E.early && person.pregnant > 14) return 0;
  if (E.late && person.pregnant < 26) return 0;
  let w = E.w * (E.season?.[season] ?? 1);
  if (E.age) {
    const band = E.age.find(([a, b]) => person.age >= a && person.age < b);
    w *= band ? band[2] : 0;
  }
  if (person.pregnant && E.pregnant) w *= E.pregnant;
  if (hamlet) {
    if (E.mosquito) w *= lerp(1, E.mosquito, hamlet.mosquito ?? 0.5) / ((E.mosquito + 1) / 2);
    if (E.water) w *= lerp(1, E.water, hamlet.water ?? 0.5) / ((E.water + 1) / 2);
    if (E.crowd) w *= lerp(1, E.crowd, hamlet.crowd ?? 0.5) / ((E.crowd + 1) / 2);
  }
  return w;
}

/**
 * A new patient. opts: { seed, key, t (game min), season, hamlet:{id,name,mosquito,water,crowd,wealth}, cond? }
 * Picks age/sex from the population, then an illness that fits them, then how long they have had it.
 */
export function makePatient({ seed, key, t, season, hamlet, cond: forceCond, age: forceAge, sex: forceSex }) {
  const rng = makeRng(seed, 'patient', key);
  let person, condId, tries = 0;
  do {
    const sex = forceSex || (rng() < 0.52 ? 'f' : 'm');
    const band = weighted(PYRAMID.map((b) => [b, b[2]]), rng());
    const age = forceAge ?? lerp(band[0], band[1], rng());
    const pregnant = sex === 'f' && age >= 16 && age < 42 && rng() < 0.16 ? Math.floor(lerp(5, 39, rng())) : 0;
    person = { sex, age, pregnant };
    if (forceCond) { condId = forceCond; if (COND.get(forceCond).epi.onlyPregnant && !pregnant) { person.sex = 'f'; person.age = 24; person.pregnant = COND.get(forceCond).epi.late ? 32 : 9; } break; }
    const ws = CONDITIONS.map((c) => [c.id, conditionWeight(c, person, season, hamlet)]).filter(([, w]) => w > 0);
    if (ws.length) { condId = weighted(ws, rng()); break; }
  } while (++tries < 20);
  const { sex, age, pregnant } = person;
  const nutrition = clamp((age < 5 ? 0.82 : 0.9) + (rng() - 0.5) * 0.35 + ((hamlet?.wealth ?? 0.5) - 0.5) * 0.2, 0.45, 1.1);
  const weight = Math.round(medianWeight(age, sex) * lerp(0.82, 1, nutrition) * (1 + (rng() - 0.5) * 0.12) * 10 + (pregnant ? pregnant * 3 : 0)) / 10;
  const hb = age < 5 ? lerp(9.5, 12, rng()) : sex === 'f' ? lerp(10.5, 13.5, rng()) - (pregnant ? 1 : 0) : lerp(12.5, 15.5, rng());
  const pkv = {};
  for (const a of ACTIVES) if (a.pk) pkv[a.id] = [Math.exp(gauss(rng) * a.pk.spread), Math.exp(gauss(rng) * a.pk.spread * 0.6)];
  const wealth = clamp((hamlet?.wealth ?? 0.5) + (rng() - 0.5) * 0.5, 0.02, 1);
  const p = {
    id: 'p' + key, key, seed: (seed ^ hashKey(key)) >>> 0,
    name: personName(rng, sex), sex, age: Math.round(age * 10) / 10, weight, nutrition, hb, pregnant,
    hamlet: hamlet?.id || null, wealth, adh: clamp(lerp(0.6, 0.95, rng()) + (age < 12 ? 0.03 : 0), 0.4, 0.98), trust: 0.5,
    nauseaSev: lerp(0.5, 1, rng()), pkv, allergy: rng() < 0.03 ? 'aspirin' : null,
    t, conds: [], hyd: 0, doses: { sys: {}, gut: [] }, rx: [], healed: [], flags: {}, toxSeen: {}, visits: [],
  };
  p.immMalaria = clamp((0.1 + (age - 0.5) / 13) * (pregnant ? 0.7 : 1) * lerp(0.6, 1.2, hamlet?.mosquito ?? 0.5) * lerp(0.35, 1.45, rng()), 0.08, 0.85);
  const def = COND.get(condId);
  const sinceH = def.model === 'pain' || def.model === 'scabies' || def.model === 'worms' || def.model === 'heart' ? Math.round(lerp(72, 400, rng()))
    : def.model === 'wound' || def.model === 'burn' ? Math.round(lerp(def.id === 'wound_infected' ? 60 : 2, def.id === 'wound_infected' ? 140 : 30, rng()))
      : Math.round(lerp(12, 72, rng()));
  addCondition(p, condId, makeRng(seed, 'cond', key), sinceH);
  p.mainCond = condId;
  p.since = sinceH;
  p.complaint = complaintText(p, def, rng);
  return p;
}

const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
const hashKey = (k) => { let h = 2166136261; for (const ch of String(k)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** Words for how long: "this morning", "yesterday", "three days", "two weeks". */
export function sinceWords(h) {
  if (h < 10) return 'since this morning';
  const d = Math.round(h / 24);
  if (h < 30 || d < 2) return 'since yesterday';
  if (d < 8) return 'for ' + ['', '', 'two days', 'three days', 'four days', 'five days', 'six days', 'a week'][d];
  if (d < 18) return 'for two weeks';
  return 'for ' + Math.round(d / 7) + ' weeks';
}

export function agoWords(h) { if (h < 10) return 'this morning'; const d = Math.round(h / 24); if (h < 30 || d < 2) return 'yesterday'; return d < 8 ? ['', '', 'two', 'three', 'four', 'five', 'six', 'seven'][d] + ' days ago' : 'weeks ago'; }

/** What the patient (or the parent) says first. */
export function complaintText(p, def, rng) {
  const child = p.age < 13;
  const kid = p.sex === 'f' ? 'my daughter' : 'my son';
  const vars = {
    who: child ? cap(kid) : 'I', pron: child ? (p.sex === 'f' ? 'she' : 'he') : 'I', poss: child ? (p.sex === 'f' ? 'her' : 'his') : 'my',
    refl: child ? (p.sex === 'f' ? 'herself' : 'himself') : 'myself', when: sinceWords(p.since), ago: agoWords(p.since),
  };
  let s = pickBy(def.complaint, rng()).replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  if (!child) s = s.replace(/\bI has\b/g, 'I have').replace(/\bI is\b/g, 'I am').replace(/\bI itches\b/g, 'I itch').replace(/\bI scratches\b/g, 'I scratch').replace(/\bI passed\b/g, 'I passed').replace(/\bI was\b/g, 'I was').replace(/\bI cut myself\b/, 'I cut myself').replace(/\bI fell\b/, 'I fell');
  return cap(s).replace(/([.!?] )([a-z])/g, (_, a, c) => a + c.toUpperCase());
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Who brought them: a child comes with a parent. */
export function companion(p) {
  if (p.age >= 13) return null;
  return p.age < 5 ? 'carried by the mother' : 'with the mother';
}
