// people.js — the valley's people, kept very basic on purpose: the foetus inside a pregnant patient, birth,
// the newborn, and the households of each hamlet, who age, conceive, give birth and die.
// later upgrade: full pregnancy/foetus/newborn physiology (placenta and foetal growth, preterm labour, labour
// itself, breast milk carrying drugs, a newborn's slow drug clearance in pk.js, bilirubin, partners).
//
// Two clocks. Illness runs in real hours (disease.js: a week of pregnancy takes 7 game days). The calendar runs
// a 40-day year (time.js), and people outside the clinic's records live on it: they age a year every 40 days
// and a pregnancy there lasts ~29 days. While the clinic holds someone's record (`held`), the record owns the
// body and runs on the real clock; the daily tick leaves that person alone.
import { ACTIVE } from './content/actives.js';
import { makeRng, hashf } from './rng.js';
import { DAY, HOUR, YEAR_DAYS, day } from './time.js';
import { vitals } from './signs.js';
import { PYRAMID, personName } from './patient.js';

const lerp = (a, b, t) => a + (b - a) * t;
const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
const rate = (table, x) => (table.find(([b]) => x < b) || [0, 0])[1];

// ————————————————————————————————————————————— the foetus
// p.foetus = { alive, harm: { kind: cumulative hazard } }; its gestational age is p.pregnant (weeks).
// Drugs write harm through `foetal` data on actives, illness through ILLNESS below, in the same shape:
//   { weeks: [from, to), at, harm, per, ref } — while exposure x ≥ at, harm += per · x / at each hour.
// x is the plasma level (mg/L) for systemic actives, mg/kg taken within the active's gut duration for gut ones.
// At birth a harm H becomes a mark with chance 1 − e^−H; `loss` is rolled every hour (the foetus dies).

/** Baseline chance per hour that a pregnancy is lost, by week: ~15% of recognised pregnancies miscarry, most
 *  before 13 weeks (Quenby S et al. Lancet 2021;397:1658); ~2% of births in sub-Saharan Africa are stillborn
 *  (UN IGME, A neglected tragedy: the global burden of stillbirths, 2020). */
const baseLoss = (w) => (w < 4 ? 0 : w < 13 ? 9.2e-5 : w < 22 ? 1.3e-5 : 7e-6);

const para = (p) => p.conds.find((c) => c.id === 'malaria')?.para || 0;
const hbNow = (p) => Math.min(p.hb, ...p.conds.filter((c) => c.hb !== undefined).map((c) => c.hb));
// Illness in the mother. x is 1 while `when` holds. Rates are calibrated estimates against the cited effect sizes.
const ILLNESS = [
  // one episode of malaria in the first trimester: miscarriage aOR 2.7 (silent) to 4 (with fever), less as
  // pregnancy advances (McGready R et al. Lancet Infect Dis 2012;12:388)
  { weeks: [4, 13], at: 1, harm: 'loss', per: 1e-3, when: (p) => para(p) > 100, ref: 'McGready R et al. Lancet Infect Dis 2012;12:388' },
  // later on, placental malaria roughly doubles low birth weight and stillbirth (Desai M et al. Lancet Infect Dis 2007;7:93)
  { weeks: [13, 41], at: 1, harm: 'loss', per: 1e-4, when: (p) => para(p) > 100, ref: 'Desai M et al. Lancet Infect Dis 2007;7:93' },
  { weeks: [13, 41], at: 1, harm: 'growth', per: 1e-4, when: (p) => para(p) > 100, ref: 'Desai M et al. Lancet Infect Dis 2007;7:93' },
  // severe anaemia (Hb < 7 g/dL): more low birth weight and stillbirth (Young MF et al. Ann N Y Acad Sci 2019;1450:47)
  { weeks: [13, 41], at: 1, harm: 'growth', per: 5e-5, when: (p) => hbNow(p) < 7, ref: 'Young MF et al. Ann N Y Acad Sci 2019;1450:47' },
  { weeks: [13, 41], at: 1, harm: 'loss', per: 1e-5, when: (p) => hbNow(p) < 7, ref: 'Young MF et al. Ann N Y Acad Sci 2019;1450:47' },
  // high fever in the first trimester: neural tube defects ~3×, heart defects and clefts ~1.5× (Dreier JW et al. Pediatrics 2014;133:e674)
  { weeks: [3, 13], at: 1, harm: 'malformation', per: 1e-4, when: (p, t) => p.conds.length && vitals(p, t).temp >= 38.5, ref: 'Dreier JW et al. Pediatrics 2014;133:e674' },
  // ——— infections: untreated syphilis kills ~1 in 4 babies before or at birth (Gomez GB et al. Bull World Health
  // Organ 2013;91:217); per calibrated to ~25% over weeks 13–40
  { weeks: [13, 41], at: 1, harm: 'loss', per: 6e-5, when: (p) => p.conds.some((c) => c.id === 'syphilis'), ref: 'Gomez GB et al. Bull World Health Organ 2013;91:217; WTND p.237' },
];

/** One hour of pregnancy: the foetus grows a week per 168 h and takes in what the mother's blood carries.
 *  Returns events (labour, when it comes). Randomness is hashed per hour, so it never shifts the patient's
 *  other rolls. */
export function pregnancyHour(p, ds, t) {
  const f = (p.foetus ||= { alive: true, harm: {} });
  const w = (p.pregnant += 1 / 168);
  const loss0 = f.harm.loss || 0;
  const add = (e, x) => { if (w >= e.weeks[0] && w < e.weeks[1] && x >= e.at) f.harm[e.harm] = (f.harm[e.harm] || 0) + (e.per * x) / e.at; };
  for (const [id, C] of Object.entries(ds.conc)) for (const e of ACTIVE.get(id).foetal || []) add(e, C);
  const gut = {};
  for (const [td, id, mg] of p.doses?.gut || []) { const a = ACTIVE.get(id); if (a?.foetal && td <= t && t - td < a.gut.duration * HOUR) gut[id] = (gut[id] || 0) + mg / p.weight; }
  for (const [id, x] of Object.entries(gut)) for (const e of ACTIVE.get(id).foetal) add(e, x);
  for (const e of ILLNESS) if (w >= e.weeks[0] && w < e.weeks[1] && e.when(p, t)) add(e, 1);
  if (hashf(p.seed, Math.floor(t / HOUR), 0, 4021) < baseLoss(w) + (f.harm.loss || 0) - loss0) f.alive = false;
  return !f.alive || w >= 40 ? onLabour(p, t) : [];
}

// Median birth weight (kg) by gestational week (INTERGROWTH-21st: Villar J et al. Lancet 2014;384:857; East
// African term babies a little lighter); spread ±14% (1 SD).
const BW = [[22, 0.5], [28, 1.1], [32, 1.8], [36, 2.7], [40, 3.2], [43, 3.5]];
function medianBW(w) {
  let i = 0;
  while (i < BW.length - 2 && BW[i + 1][0] <= w) i++;
  const [w0, b0] = BW[i], [w1, b1] = BW[i + 1];
  return Math.max(0.3, lerp(b0, b1, (w - w0) / (w1 - w0)));
}
// Of babies so marked, the share who die in the first weeks without a hospital (estimates; persistent pulmonary
// hypertension kills ~10% even with intensive care: Walsh-Sukys MC et al. Pediatrics 2000;105:14).
const MARK_DEATH = { ductus: 0.1, jaundice: 0.05 };
/** Chance a harm shows as a mark at birth. Major anomalies affect ~3% of births anyway (CDC MMWR 2008;57:1). */
export const markRisk = (f, kind) => 1 - (kind === 'malformation' ? 0.97 : 1) * Math.exp(-(f.harm[kind] || 0));

/** What is born: { kind: 'birth'|'stillbirth'|'miscarriage', baby?: { sex, bw (kg), weeks, marks, nn } }.
 *  nn = chance of dying in the first weeks: ~1.2% for a term baby of normal size, ×1.8 small for dates, ×6.8
 *  preterm (Katz J et al. Lancet 2013;382:417). */
export function birthOutcome(f, w, rng) {
  if (!f.alive) return { kind: w < 22 ? 'miscarriage' : 'stillbirth' };
  const med = medianBW(w), bw = Math.round(med * Math.exp(-(f.harm.growth || 0) + gauss(rng) * 0.14) * 100) / 100;
  const marks = ['malformation', 'teeth', 'jaundice', 'ductus'].filter((k) => rng() < markRisk(f, k));
  let nn = 0.012 * (w < 37 ? 6.8 : 1) * (bw < med * 0.84 ? 1.8 : 1);
  for (const k of marks) nn += MARK_DEATH[k] || 0;
  return { kind: 'birth', baby: { sex: rng() < 0.51 ? 'm' : 'f', bw, weeks: Math.floor(w), marks, nn } };
}

/** Labour. Trivial for now: the baby (or the loss) comes and the pregnancy ends. Returns events.
 *  later upgrade: the childbirth chapter (obstructed labour, bleeding, eclampsia, the birth attendant). */
export function onLabour(p, t) {
  const out = birthOutcome(p.foetus || { alive: true, harm: {} }, p.pregnant, makeRng(p.seed, 'birth', Math.floor(t)));
  p.pregnant = 0; p.delivered = t; delete p.foetus;
  const text = out.kind === 'birth' ? `gave birth to a ${out.baby.sex === 'm' ? 'boy' : 'girl'}` : out.kind === 'stillbirth' ? 'the baby was born dead' : 'lost the pregnancy';
  return [{ t, kind: out.kind, text, baby: out.baby }];
}

// ————————————————————————————————————————————— the newborn
/** Drugs in a baby under ~2 months (actives' `newborn` data: { days, at, harm, per, ref }). These harms
 *  (kernicterus, grey baby) kill, so each hour's harm is also that hour's added death hazard. */
export function newbornHazard(p, ds) {
  const days = p.age * 365;
  if (days >= 60) return 0;
  let hz = 0;
  for (const [id, C] of Object.entries(ds.conc)) for (const e of ACTIVE.get(id).newborn || []) {
    if (days >= e.days || C < e.at) continue;
    const v = (e.per * C) / e.at;
    (p.harm ||= {})[e.harm] = (p.harm[e.harm] || 0) + v;
    hz += v;
  }
  return hz;
}

// ————————————————————————————————————————————— households and the population
// Annual chance of dying by age, rural East Africa (rounded from WHO Global Health Observatory life tables,
// Uganda and Tanzania 2019). Deaths in the first weeks are rolled at birth (birthOutcome's nn).
const DEATH = [[1, 0.025], [5, 0.006], [15, 0.0015], [50, 0.004], [65, 0.012], [80, 0.04], [90, 0.12], [Infinity, 0.3]];
// Births per woman per year by age (rural Uganda, Uganda DHS 2016, rounded: total fertility ~6).
const ASFR = [[15, 0], [20, 0.14], [25, 0.28], [30, 0.27], [35, 0.23], [40, 0.17], [45, 0.08], [50, 0.03], [Infinity, 0]];
// A woman can conceive only when neither pregnant (0.73 y) nor in postpartum amenorrhoea (~1 y while breastfeeding,
// Uganda DHS 2016): the chance per available year that gives these birth rates.
const conceive = (asfr) => (asfr > 0 ? 1 / (1 / asfr - 1.75) : 0);
const GEST = (38 / 52) * YEAR_DAYS; // calendar days from conception (week 2) to term (week 40)
export const weeksOf = (q, d) => 2 + ((d - q.conc) * 38) / GEST;
/** The week a pregnancy will be lost at (baseline hazard, inverted), or 0 if it reaches term. */
function lossWeek(u) {
  const target = -Math.log(1 - u);
  let H = 0;
  for (let w = 4; w < 40; w++) { H += baseLoss(w) * 168; if (H > target) return w + 1; }
  return 0;
}

/** Everyone the seed puts in the valley on day d0. Households of 2–7 (mean ~4.5; Uganda census 2014: 4.7),
 *  ages from the young rural pyramid (patient.js). Some women are already pregnant. */
function seeded(seed, R, d0) {
  const out = [];
  for (const s of [R.village, ...R.hamlets]) {
    const rng = makeRng(seed, 'households', s.id);
    const nh = s.id === 'village' ? 30 : 4 * s.houses.length;
    for (let hh = 0; hh < nh; hh++) {
      const size = 2 + Math.floor(rng() * 6);
      for (let i = 0; i < size; i++) {
        const sex = rng() < 0.51 ? 'f' : 'm', b = PYRAMID[pick(PYRAMID, rng())], age = lerp(b[0], b[1], rng());
        const q = { id: `${s.id}.${hh}.${i}`, h: s.id, hh, sex, born: Math.round((d0 - age * YEAR_DAYS) * 10) / 10 };
        if (sex === 'f' && rng() < rate(ASFR, age) * 0.73) { q.conc = Math.round(d0 - rng() * GEST); q.lossW = lossWeek(rng()); }
        out.push(q);
      }
    }
  }
  return out;
}
const pick = (bands, r) => { let t = r; for (let i = 0; i < bands.length; i++) { t -= bands[i][2]; if (t < 0) return i; } return bands.length - 1; };

// Saved: clinic.pop = { day0, day, seq, diff, stats }. The seeded people are regenerated on load; diff holds
// each changed or new person by id (0 for a seeded person who has died). The living are cached per pop object.
const cache = new WeakMap();
export function population(G) {
  const cl = G.meta.clinic, d = day(G.W.time);
  const P = (cl.pop ||= { day0: d, day: d, seq: 0, diff: {}, stats: { births: 0, deaths: 0 } });
  let L = cache.get(P);
  if (!L) {
    L = new Map();
    for (const q of seeded(G.meta.seed, G.W.R, P.day0)) if (!(q.id in P.diff)) L.set(q.id, q);
    for (const [id, q] of Object.entries(P.diff)) if (q) L.set(id, q);
    cache.set(P, L);
  }
  return { P, L };
}
const touch = (P, q) => { P.diff[q.id] = q; };
const endPregnancy = (q) => { delete q.conc; delete q.lossW; };
function die(P, L, q) {
  L.delete(q.id);
  if (q.id.startsWith('b')) delete P.diff[q.id]; else P.diff[q.id] = 0;
  P.stats.deaths++;
  for (const k of L.values()) if (k.mother === q.id && k.bf) { k.bf = false; touch(P, k); } // no mother, no breast milk
}
/** A baby joins the mother's household (or dies in the first weeks, with chance baby.nn). */
function addBaby(P, L, mother, baby, d, rng) {
  P.stats.births++;
  if (rng() < baby.nn) { P.stats.deaths++; return null; }
  const b = { id: 'b' + P.seq++, h: mother.h, hh: mother.hh, sex: baby.sex, born: d, mother: mother.id, bw: baby.bw, bf: true };
  if (baby.marks.length) b.marks = baby.marks;
  L.set(b.id, b); touch(P, b);
  return b;
}

/** Live every whole day since the last tick: age, conceive, give birth, die. Cheap: one pass a day. */
export function tickPeople(G) {
  const { P, L } = population(G), today = day(G.W.time);
  for (; P.day < today; P.day++) {
    const d = P.day + 1, rng = makeRng(G.meta.seed, 'people', d);
    for (const q of [...L.values()]) {
      if (q.held) continue;
      const age = (d - q.born) / YEAR_DAYS;
      if (rng() < rate(DEATH, age) / YEAR_DAYS) { die(P, L, q); continue; }
      if (q.conc != null) {
        const w = weeksOf(q, d);
        if (q.lossW && w >= q.lossW) { endPregnancy(q); q.pp = d + 3; touch(P, q); }
        else if (w >= 40) {
          const b = addBaby(P, L, q, birthOutcome({ alive: true, harm: {} }, 40, rng).baby, d, rng);
          endPregnancy(q); q.pp = d + (b ? YEAR_DAYS : 3); touch(P, q);
        }
      } else if (q.sex === 'f' && d >= (q.pp || 0) && rng() < conceive(rate(ASFR, age)) / YEAR_DAYS) {
        q.conc = d; q.lossW = lossWeek(rng()); touch(P, q);
      }
    }
  }
}

/** Someone from this hamlet who is not already in the clinic's hands (null if nobody). Its own stream per arrival. */
export function drawResident(G, hamletId, key) {
  const here = [...population(G).L.values()].filter((q) => q.h === hamletId && !q.held);
  return here.length ? here[Math.floor(makeRng(G.meta.seed, 'who', key)() * here.length)] : null;
}
/** The person as makePatient wants them at time t. */
export function personNow(G, q, t) {
  const d = t / DAY + 1;
  return { id: q.id, sex: q.sex, age: (d - q.born) / YEAR_DAYS, pregnant: q.conc != null ? weeksOf(q, d) : 0, name: personName(makeRng(G.meta.seed, 'name', q.id), q.sex), bw: q.bw, mother: q.mother, bf: q.bf, marks: q.marks };
}
/** The clinic now holds this person's body (their patient record runs it, hour by hour). */
export function hold(G, p) {
  const { P, L } = population(G), q = L.get(p.who);
  if (q) { q.held = p.id; touch(P, q); }
}

/** Keep the population in step with a held patient's events: births, deaths, and letting go when done. */
export function patientEvents(G, p, ev) {
  if (!p.who) return;
  const { P, L } = population(G), q = L.get(p.who);
  if (!q) return;
  const d = day(G.W.time);
  for (const e of ev) {
    if (e.kind === 'died') return die(P, L, q);
    if (e.kind === 'birth') q.pp = d + (addBaby(P, L, q, e.baby, d, makeRng(p.seed, 'nn', Math.floor(e.t))) ? YEAR_DAYS : 3);
    if (e.kind === 'stillbirth' || e.kind === 'miscarriage') q.pp = d + 3;
  }
  if (q.held && p.recovered && !p.pregnant) { q.held = null; endPregnancy(q); touch(P, q); }
}
