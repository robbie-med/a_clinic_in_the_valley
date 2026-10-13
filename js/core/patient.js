// patient.js — who walks in. A patient is a seeded person (age, sex, weight, nutrition, pregnancy,
// how well they take medicine, how much they can pay) carrying one illness, already some hours in.
import { makeRng, weighted, pickBy } from './rng.js';
import { expand } from './lore.js';
import { COND, CONDITIONS } from './content/conditions.js';
import { ACTIVES } from './content/actives.js';
import { addCondition } from './disease.js';
import { signs } from './signs.js';
import { t, tm, msg, en, getLang } from './i18n.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

// Rural population pyramid (young): share of people per age band.
export const PYRAMID = [[0, 1, 0.035], [1, 5, 0.13], [5, 15, 0.28], [15, 45, 0.4], [45, 60, 0.09], [60, 85, 0.065]];
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
  if (E.weeks && !(person.pregnant >= E.weeks[0] && person.pregnant < E.weeks[1])) return 0;
  if (E.postpartum && !(person.pp >= E.postpartum[0] && person.pp < E.postpartum[1])) return 0; // pp: days since a birth
  let w = E.w * (E.season?.[season] ?? 1) * (E.sex?.[person.sex] ?? 1);
  if (E.age) {
    const band = E.age.find(([a, b]) => person.age >= a && person.age < b);
    w *= band ? band[2] : 0;
  }
  if (person.pregnant && E.pregnant) w *= E.pregnant;
  for (const [a, by] of Object.entries(E.prevent || {})) if (person.advice?.[a]) w *= 1 - by;
  if (hamlet) {
    if (E.mosquito) w *= lerp(1, E.mosquito, hamlet.mosquito ?? 0.5) / ((E.mosquito + 1) / 2);
    if (E.water) w *= lerp(1, E.water, hamlet.water ?? 0.5) / ((E.water + 1) / 2);
    if (E.crowd) w *= lerp(1, E.crowd, hamlet.crowd ?? 0.5) / ((E.crowd + 1) / 2);
  }
  return w;
}

/**
 * A new patient. opts: { seed, key, t (game min), season, hamlet:{id,name,mosquito,water,crowd,wealth}, cond?,
 * resist? (the valley's resistance index, for the strain of a bacterial infection), who? (a person from the
 * valley, people.js personNow: { id, sex, age, pregnant, name, bw, mother, bf, marks }) }
 * Takes `who` (or picks age/sex from the pyramid), then an illness that fits them, then how long they have had it.
 */
export function makePatient({ seed, key, t, season, hamlet, cond: forceCond, age: forceAge, sex: forceSex, resist, who }) {
  const rng = makeRng(seed, 'patient', key);
  let person, condId, tries = 0;
  do {
    if (who && !tries) {
      person = { sex: who.sex, age: who.age, pregnant: who.pregnant, pp: who.pp, advice: who.advice };
      const ws = CONDITIONS.map((c) => [c.id, conditionWeight(c, person, season, hamlet)]).filter(([, w]) => w > 0);
      // what their advice prevents, they do not catch: they stay well and someone else comes
      const sum = (l) => l.reduce((a, [, w]) => a + w, 0), all = sum(CONDITIONS.map((c) => [c.id, conditionWeight(c, { ...person, advice: null }, season, hamlet)]));
      if (ws.length && makeRng(seed, 'prevent', key)() < sum(ws) / all) { condId = weighted(ws, rng()); break; }
      tries++;
    }
    const sex = forceSex || (rng() < 0.52 ? 'f' : 'm');
    const band = weighted(PYRAMID.map((b) => [b, b[2]]), rng());
    const age = forceAge ?? lerp(band[0], band[1], rng());
    const pregnant = sex === 'f' && age >= 16 && age < 42 && rng() < 0.16 ? Math.floor(lerp(5, 39, rng())) : 0;
    // a woman who gave birth in the last two months (own stream, so it never reshuffles who walks in)
    const ppR = makeRng(seed, 'pp', key, tries);
    person = { sex, age, pregnant, pp: sex === 'f' && age >= 16 && age < 42 && !pregnant && ppR() < 0.06 ? ppR() * 60 : null };
    if (forceCond) {
      condId = forceCond;
      const E = COND.get(forceCond).epi;
      if (E.onlyPregnant && !pregnant) { person.sex = 'f'; person.age = 24; person.pregnant = E.late ? 32 : 9; }
      if (E.weeks) person.pregnant = E.weeks[0];
      if (E.postpartum) Object.assign(person, { sex: 'f', age: 24, pregnant: 0, pp: E.postpartum[0] });
      break;
    }
    const ws = CONDITIONS.map((c) => [c.id, conditionWeight(c, person, season, hamlet)]).filter(([, w]) => w > 0);
    if (ws.length) { condId = weighted(ws, rng()); break; }
  } while (++tries < 20);
  const { sex, age, pregnant } = person;
  if (who && tries) who = null; // nothing this person could have: a stranger came instead
  const nutrition = clamp((age < 5 ? 0.82 : 0.9) + (rng() - 0.5) * 0.35 + ((hamlet?.wealth ?? 0.5) - 0.5) * 0.2, 0.45, 1.1);
  const weight = Math.round(medianWeight(age, sex) * (who?.bw && age < 2 ? who.bw / 3.2 : 1) * lerp(0.82, 1, nutrition) * (1 + (rng() - 0.5) * 0.12) * 10 + (pregnant ? pregnant * 3 : 0)) / 10;
  const hb = age < 5 ? lerp(9.5, 12, rng()) : sex === 'f' ? lerp(10.5, 13.5, rng()) - (pregnant ? 1 : 0) : lerp(12.5, 15.5, rng());
  const pkv = {};
  // each drug draws from its own stream, so adding a drug to the game never reshuffles who walks in
  for (const a of ACTIVES) if (a.pk) { const r = makeRng(seed, 'pkv', key, a.id); pkv[a.id] = [Math.exp(gauss(r) * a.pk.spread), Math.exp(gauss(r) * a.pk.spread * 0.6)]; }
  const wealth = clamp((hamlet?.wealth ?? 0.5) + (rng() - 0.5) * 0.5, 0.02, 1);
  let p = {
    id: 'p' + key, key, seed: (seed ^ hashKey(key)) >>> 0,
    name: who?.name || personName(rng, sex), sex, age: Math.round(age * 10) / 10, weight, nutrition, hb, pregnant,
    hamlet: hamlet?.id || null, wealth, adh: clamp(lerp(0.6, 0.95, rng()) + (age < 12 ? 0.03 : 0), 0.4, 0.98), trust: 0.5,
    // true penicillin allergy ~2% (far fewer than the ~10% who say so); aspirin ~1%
    nauseaSev: lerp(0.5, 1, rng()), pkv, allergy: ((r) => (r < 0.02 ? 'penicillin' : r < 0.03 ? 'aspirin' : null))(rng()),
    t, conds: [], hyd: 0, doses: { sys: {}, gut: [] }, rx: [], healed: [], flags: {}, toxSeen: {}, visits: [],
  };
  if (who) Object.assign(p, { who: who.id, mother: who.mother, bf: who.bf, marks: who.marks, vacc: who.vacc, fpUntil: who.fpUntil });
  if (person.pp != null) p.delivered = t - person.pp * 24 * 60; // when she gave birth (game minutes)
  p.immMalaria = clamp((0.1 + (age - 0.5) / 13) * (pregnant ? 0.7 : 1) * lerp(0.6, 1.2, hamlet?.mosquito ?? 0.5) * lerp(0.35, 1.45, rng()), 0.08, 0.85);
  // People come when they feel ill: draw how long they have had it until what they would say is true now (a
  // semi-immune adult carrying silent parasites does not walk in with a fever). If this illness would not bring them
  // today, they come with another that would; a forced illness (tests) keeps its best try.
  const base = structuredClone(p);
  const pick = (id) => {
    const def = COND.get(id);
    let best = null;
    for (let k = 0; k < 8; k++) {
      const q = structuredClone(base);
      const sinceH = sinceFor(def, k ? makeRng(seed, 'since', key, id, k) : rng);
      addCondition(q, id, makeRng(seed, 'cond', key), sinceH, resist);
      const F = signs(q, t);
      const said = def.complaint.map((c) => ({ t: en(c, 't'), says: c.says.filter((x) => F[x]?.pos), all: c.says.every((x) => F[x]?.pos) }));
      const ok = said.filter((c) => c.all);
      if (ok.length) return { q, sinceH, def, list: ok };
      best ||= { q, sinceH, def, list: said, partial: true };
    }
    return best;
  };
  let got = pick(condId);
  if (got.partial && !forceCond) {
    const ws = CONDITIONS.map((c) => [c.id, c.id === condId ? 0 : conditionWeight(c, person, season, hamlet)]).filter(([, w]) => w > 0);
    for (let k = 0; k < 4 && ws.length && got.partial; k++) {
      const id = weighted(ws, makeRng(seed, 'repick', key, k)());
      const g = pick(id);
      if (!g.partial) got = g; else ws.splice(ws.findIndex(([x]) => x === id), 1);
    }
  }
  p = got.q;
  p.mainCond = got.def.id;
  p.since = got.sinceH;
  const said = pickBy(got.list, rng());
  p.complaint = complaintText(p, said.t); // English (old code, tests)
  p.complaintMsg = complaintMsg(p, said.t); // any language: say(p.complaintMsg) / complaintOf(p)
  p.says = said.says; // what the opening complaint claims (finding keys): never "not noticed" on this visit
  return p;
}

/** Hours they have been ill when they come (conditions.js params.since, or by the kind of illness). */
function sinceFor(def, rng) {
  if (def.params.since) return Math.round(lerp(def.params.since[0], def.params.since[1], rng()));
  if (['pain', 'scabies', 'worms', 'heart'].includes(def.model)) return Math.round(lerp(72, 400, rng()));
  if (def.model === 'wound' || def.model === 'burn') return Math.round(lerp(def.id === 'wound_infected' ? 60 : 2, def.id === 'wound_infected' ? 140 : 30, rng()));
  return Math.round(lerp(12, 72, rng()));
}

const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
const hashKey = (k) => { let h = 2166136261; for (const ch of String(k)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; };

/** Words for how long: "this morning", "yesterday", "three days", "two weeks". sinceWords/agoWords give the English;
 *  sinceMsg/agoMsg the same as msgs (render with tm(), any language). */
export function sinceMsg(h) {
  if (h < 10) return msg('since this morning');
  const d = Math.round(h / 24);
  if (h < 30 || d < 2) return msg('since yesterday');
  if (d < 8) return [msg('for two days'), msg('for three days'), msg('for four days'), msg('for five days'), msg('for six days'), msg('for a week')][d - 2];
  if (d < 18) return msg('for two weeks');
  if (d < 100) return msg('for {n} weeks', { n: Math.round(d / 7) });
  return d < 730 ? msg('for {n} months', { n: Math.round(d / 30) }) : msg('for {n} years', { n: Math.round(d / 365) }); // slow illnesses (paced) last that long
}
export function agoMsg(h) {
  if (h < 10) return msg('this morning');
  const d = Math.round(h / 24);
  if (h < 30 || d < 2) return msg('yesterday');
  return d < 8 ? [msg('two days ago'), msg('three days ago'), msg('four days ago'), msg('five days ago'), msg('six days ago'), msg('seven days ago')][d - 2] : msg('weeks ago');
}
const enFill = (m) => m.$.replace(/\{(\w+)\}/g, (_, k) => m.v[k]);
export const sinceWords = (h) => enFill(sinceMsg(h));
export const agoWords = (h) => enFill(agoMsg(h));
/** A msg with its exact English (`en`, used by say() in English) or a context (`ctx`: dictionary key 'ctx|English'). */
export const withEn = (m, text) => ({ ...m, en: text });
export const withCtx = (m, ctx) => ({ ...m, ctx });

/**
 * Show a saved or logged text in the current language. x: a msg, a plain English string, a person marker, or an
 * array of these (joined by spaces). A msg may carry `en`, its exact English (capitals, verb forms, lowercased names
 * that a template cannot make): English shows that, other languages render the msg.
 */
export function say(x) {
  if (getLang() !== 'en') return tm(x);
  if (Array.isArray(x)) return x.map(say).join(' ');
  if (x && typeof x === 'object' && x.en != null) return x.en;
  return tm(x);
}

/** What the patient (or the parent) says first, from a complaint template (English, as said). */
export function complaintText(p, template) {
  const child = p.age < 13;
  const kid = p.sex === 'f' ? 'my daughter' : 'my son';
  const vars = {
    who: child ? cap(kid) : 'I', pron: child ? (p.sex === 'f' ? 'she' : 'he') : 'I', poss: child ? (p.sex === 'f' ? 'her' : 'his') : 'my',
    refl: child ? (p.sex === 'f' ? 'herself' : 'himself') : 'myself', when: sinceWords(p.since), ago: agoWords(p.since),
  };
  let s = template.replace(/\{(\w+)\}/g, (_, k) => vars[k]);
  const firstPerson = { has: 'have', is: 'am', itches: 'itch', scratches: 'scratch', falls: 'fall', coughs: 'cough', gets: 'get', fights: 'fight', vomits: 'vomit', limps: 'limp' };
  if (!child) s = s.replace(/\bI (\w+)\b/g, (m, v) => (firstPerson[v] ? 'I ' + firstPerson[v] : m));
  return cap(s).replace(/([.!?] )([a-z])/g, (_, a, c) => a + c.toUpperCase());
}
/** The same complaint as a msg (saved; JSON-safe), so it reads in any language: the English template (its key) with
 *  the speaker's words as msgs, and `en`, the exact English. Render with say() (or complaintOf). */
export function complaintMsg(p, template) {
  const child = p.age < 13, f = p.sex === 'f', I = { $: 'I', ctx: 'complaint' }; // tc('complaint', 'I'): the adult speaking of themselves
  return {
    $: template,
    v: {
      who: child ? (f ? msg('my daughter') : msg('my son')) : I, pron: child ? (f ? msg('she') : msg('he')) : I,
      poss: child ? (f ? msg('her') : msg('his')) : msg('my'), refl: child ? (f ? msg('herself') : msg('himself')) : msg('myself'),
      when: sinceMsg(p.since), ago: agoMsg(p.since),
    },
    en: complaintText(p, template),
  };
}
/** The opening complaint in the current language (old saves: the English, looked up). */
export const complaintOf = (p) => say(p.complaintMsg ?? p.complaint);
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Who brought them: a child comes with a parent. */
export function companion(p) {
  if (p.age >= 13) return null;
  return p.age < 5 ? t('carried by the mother') : t('with the mother');
}
