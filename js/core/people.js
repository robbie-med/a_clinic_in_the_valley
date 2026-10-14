// people.js — the valley's people, kept very basic on purpose: the foetus inside a pregnant patient, birth,
// the newborn, and the households of each hamlet, who age, conceive, give birth and die.
// later upgrade: full pregnancy/foetus/newborn physiology (placenta and foetal growth, preterm labour, labour
// itself, breast milk carrying drugs, a newborn's slow drug clearance in pk.js, bilirubin, partners).
//
// One clock. Slow processes (months, years) run on the game calendar, COMPRESS (365/40) times faster than real
// time: a pregnancy lasts ~31 game days whether the clinic holds the woman's record (disease.js steps her hour by
// hour) or not (tickPeople, once a day), and people age a year every 40 days. Hour- and day-scale physiology stays
// real: labour, bleeding, fits, infections, a drug's half-life. So a 7-day drug course spans ~9 gestational weeks,
// and harm to the foetus accrues per gestational hour. While the clinic holds someone's record (`held`), the
// record owns the body; the daily tick leaves that person alone.
import { ACTIVE } from './content/actives.js';
import { makeRng, hashf, strHash, STREAM } from './rng.js';
import { DAY, HOUR, YEAR_DAYS, COMPRESS, day } from './time.js';
import { COND } from './content/conditions.js';
import { vitals } from './signs.js';
import { PYRAMID, personName, medianWeight } from './patient.js';
import { seededGenes, inheritGenes, mensesOf, seedBlood } from './blood.js';
import { kcalNeed, nutritionOf } from './content/food.js';
import { densityOf } from './food.js';
import { tickVillage, immunise } from './village.js';
import { msg } from './i18n.js';

const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
const rate = (table, x) => (table.find(([b]) => x < b) || [0, 0])[1];

// ————————————————————————————————————————————— the foetus
// p.foetus = { alive, harm: { kind: cumulative hazard } }; its gestational age is p.pregnant (weeks).
// Drugs write harm through `foetal` data on actives, illness through ILLNESS below, in the same shape:
//   { weeks: [from, to), at, harm, per, ref } — while exposure x ≥ at, harm += per · x / at each gestational hour.
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

// Daily iron in pregnancy: Hb at term ~0.9 g/dL higher than without, over ~20 weeks (Peña-Rosas JP et al. Cochrane
// 2015;CD004736), so ~0.05 g/dL a gestational week at full effect.
const IRON_WEEK = 0.05;
/** One game hour of pregnancy: the foetus grows COMPRESS/168 of a week and takes in what the mother's blood carries.
 *  Returns events (labour, when it comes). Randomness is hashed per hour, so it never shifts the patient's
 *  other rolls. */
export function pregnancyHour(p, ds, t) {
  const f = (p.foetus ||= { alive: true, harm: {} });
  const w = (p.pregnant += COMPRESS / 168);
  const loss0 = f.harm.loss || 0;
  const add = (e, x) => { if (w >= e.weeks[0] && w < e.weeks[1] && x >= e.at) f.harm[e.harm] = (f.harm[e.harm] || 0) + (COMPRESS * e.per * x) / e.at; };
  for (const [id, C] of Object.entries(ds.conc)) for (const e of ACTIVE.get(id).foetal || []) add(e, C);
  const gut = {};
  for (const [td, id, mg] of p.doses?.gut || []) { const a = ACTIVE.get(id); if (a?.foetal && td <= t && t - td < a.gut.duration * HOUR) gut[id] = (gut[id] || 0) + mg / p.weight; }
  for (const [id, x] of Object.entries(gut)) for (const e of ACTIVE.get(id).foetal) add(e, x);
  for (const e of ILLNESS) if (w >= e.weeks[0] && w < e.weeks[1] && e.when(p, t)) add(e, 1);
  // a body with its own blood (blood.js) takes the tablets' iron through its store; the rest use the trial's net effect
  if (ds.relief.iron && !p.blood) p.hb = Math.min(12.5, p.hb + (ds.relief.iron * IRON_WEEK * COMPRESS) / 168);
  if (hashf(p.seed, Math.floor(t / HOUR), 0, 4021) < baseLoss(w) * COMPRESS + (f.harm.loss || 0) - loss0) f.alive = false;
  // obstructed labour (anything with blocksBirth) holds the birth back until it resolves or the hospital operates
  if (!f.alive || w >= 40 || p.induce) return p.conds.some((c) => COND.get(c.id).params.blocksBirth) ? [] : onLabour(p, t);
  return [];
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

// ——— childbirth and the newborn (WTND chapter 19, pp.256–282)
/** Complications of labour, rolled once each for a woman the clinic holds (own stream). `at`: 'labour' (as it
 *  begins: obstructed labour holds the birth back), 'birth' (a baby born live or dead) or 'loss' (a miscarriage);
 *  `delay` [h] until it shows. They are conditions (conditions.js), so her death, if it comes, comes through them.
 *  later upgrade: the birth attendant, retained placenta, tears, twins, breech. */
export const LABOUR = [
  // obstructed labour ~4.6% of births (Dolea C, AbouZahr C. Global burden of obstructed labour in the year 2000. WHO 2003)
  { id: 'obstructed_labour', at: 'labour', p: 0.046, ref: 'Dolea C, AbouZahr C. WHO 2003; WTND p.267' },
  // the womb fails to clamp down; 2 in 3 of these lose ≥500 ml (disease.js bleeding), ~12% of births without a uterotonic
  // (placebo arm: 12%, Derman RJ et al. Lancet 2006;368:1248; Africa 10.5%, Carroli G et al. Best Pract Res Clin
  // Obstet Gynaecol 2008;22:999)
  { id: 'pph', at: 'birth', p: 0.18, ref: 'Derman RJ et al. Lancet 2006;368:1248; Carroli G et al. Best Pract Res Clin Obstet Gynaecol 2008;22:999' },
  // childbirth fever ~4.4% of births in poor countries (Dolea C, Stein C. Global burden of maternal sepsis in the year 2000. WHO 2003)
  { id: 'puerperal_sepsis', at: 'birth', p: 0.044, delay: [24, 96], ref: 'Dolea C, Stein C. WHO 2003; WTND p.276' },
  // heavy bleeding that goes on after a miscarriage (incomplete): an estimate, ~1 in 10
  { id: 'miscarriage', at: 'loss', p: 0.1, ref: 'WTND p.281 (estimate)' },
];
// Maternal deaths: ~600 per 100 000 births in the valley, between Uganda's ~340 with today's partial care (WHO Trends in
// maternal mortality 2000–2017) and ~1000+ with none (Ronsmans C, Graham WJ. Lancet 2006;368:1189). Every pregnancy
// runs as a record (village.js), so they come through the complications above, untreated (test/birth.test.mjs); an
// anaemic woman dies of less bleeding (disease.js bleeding: severe anaemia aOR ~2.4 for maternal death, Daru J et al.
// Lancet Glob Health 2018;6:e548).
// Newborn tetanus: ~1 in 100 babies of unprotected mothers born at home with unclean cord care died of it (Roper MH et
// al. Lancet 2007;370:1947); two doses of tetanus toxoid in pregnancy prevent ~94% (Blencowe H et al. Int J Epidemiol
// 2010;39:i102), clean birth and cord care ~40% (Blencowe H et al. BMC Public Health 2011;11 Suppl 3:S11). About 3 in
// 4 of the valley's mothers are protected already (Uganda DHS 2016, rounded).
const NT = 0.01, TT_COVER = 0.75;
// ponytail: the baseline status is hashed on the person's id alone (the same in every valley); fine for a status flag.
export const ttProtected = (vacc, id) => (vacc?.tetanus || 0) >= 2 || makeRng('tt', id)() < TT_COVER;
export const ntRisk = (prot, clean) => NT * (prot ? 0.06 : 1) * (clean ? 0.6 : 1);

/** Labour: the complications that may come, then the baby (or the loss). Returns events. If obstructed labour is
 *  rolled it returns nothing yet: the birth waits for it (pregnancyHour). */
export function onLabour(p, t) {
  const f = p.foetus || { alive: true, harm: {} };
  const roll = (at) => {
    let n = 0;
    for (const L of LABOUR) {
      if (L.at !== at || p.conds.some((c) => c.id === L.id) || makeRng(p.seed, 'labour', L.id, Math.floor(t / DAY))() >= L.p) continue;
      const h = L.delay ? lerp(L.delay[0], L.delay[1], makeRng(p.seed, 'labour-delay', L.id)()) : 0;
      (p.pending ||= []).push({ id: L.id, t: t + h * HOUR }); n++;
    }
    return n;
  };
  if (!p.labour) { p.labour = t; if (f.alive && p.pregnant >= 28 && roll('labour')) return []; }
  const out = birthOutcome(f, p.pregnant, makeRng(p.seed, 'birth', Math.floor(t)));
  roll(out.kind === 'miscarriage' ? 'loss' : 'birth');
  if (out.baby) { out.baby.ntR = ntRisk(ttProtected(p.vacc, p.who ?? p.seed), !!p.rx?.some((r) => r.instr === 'clean_birth')); out.baby.nn += out.baby.ntR; } // ntR: tetanus's part (people in the valley: an illness instead, village.js)
  if (out.baby) out.baby.clean = !!p.rx?.some((r) => r.instr === 'clean_birth');
  p.pregnant = 0; p.delivered = t; delete p.foetus; delete p.labour; delete p.induce;
  // text: English; msg: the same, shown in any language
  const m = out.kind === 'birth' ? (out.baby.sex === 'm' ? msg('gave birth to a boy') : msg('gave birth to a girl')) : out.kind === 'stillbirth' ? msg('the baby was born dead') : msg('lost the pregnancy');
  return [{ t, kind: out.kind, text: m.$, msg: m, baby: out.baby }];
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
// Share of the deaths at each age that the game's own illnesses now cause in the valley (malaria, pneumonia, diarrhoea,
// measles, malnutrition, HIV, TB, childbirth, high blood pressure…): those come through bodies (village.js), so the age
// table keeps only the rest: cancers, accidents, old age (GBD 2019 cause fractions for Uganda, rounded; an estimate).
const MODELLED = [[1, 0.5], [5, 0.65], [15, 0.45], [50, 0.45], [65, 0.35], [Infinity, 0.3]];
/** The chance a year of dying of what no illness in the game covers. */
export const deathRate = (age) => rate(DEATH, age) * (1 - rate(MODELLED, age));
// Births per woman per year by age (rural Uganda, Uganda DHS 2016, rounded: total fertility ~6).
const ASFR = [[15, 0], [20, 0.14], [25, 0.28], [30, 0.27], [35, 0.23], [40, 0.17], [45, 0.08], [50, 0.03], [Infinity, 0]];
// A woman can conceive only when neither pregnant (0.73 y) nor in postpartum amenorrhoea (~1 y while breastfeeding,
// Uganda DHS 2016): the chance per available year that gives these birth rates.
const conceive = (asfr) => (asfr > 0 ? 1 / (1 / asfr - 1.75) : 0);
/** Births a woman had before the valley began: about the sum of the age-specific rates up to her age then (her own
 *  hashed share of it). Then each birth adds one (q.parity). */
export function parityOf(G, q) {
  if (q.parity != null || q.sex !== 'f') return q.parity || 0;
  const { P } = population(G), age0 = Math.max(0, (P.day0 - q.born) / YEAR_DAYS);
  let n = 0;
  for (let a = 15; a < age0; a++) n += rate(ASFR, a);
  return Math.floor(n * (0.5 + makeRng(G.meta.seed, 'parity', q.id)()) + 0.5);
}
/** Chance a year that a woman who could conceive does. */
export const conceiveRate = (age) => conceive(rate(ASFR, age));
const GEST = (38 * 7) / COMPRESS; // game days from conception (week 2) to term (week 40), as pregnancyHour runs
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
// Family planning (WTND pp.283–294, 395): a DMPA injection protects ~3 months (encounter.js sets fpUntil); typical
// use lets ~6 in 100 women a year conceive, against ~85 with no method (Trussell J. Contraception 2011;83:397).
export const FP_FAIL = 0.06 / 0.85;
const pick = (bands, r) => { let t = r; for (let i = 0; i < bands.length; i++) { t -= bands[i][2]; if (t < 0) return i; } return bands.length - 1; };

// Saved: clinic.pop = { v, day0, day, seq, diff, stats, body, ill, rec, imm, hh, epi, news }. The seeded people are
// regenerated on load; diff holds each changed or new person by id (0 for a seeded person who has died). Beside it, by
// person id: body (their blood and weight, blood.js), ill (slow illnesses of people otherwise up and about), rec (the
// record of anyone whose body the game runs hour by hour: an acute illness or a pregnancy; village.js), imm (immunity
// left by an illness), and by household: hh (food, money, animals; food.js). The living are cached per pop object.
const cache = new WeakMap();
export function population(G) {
  const cl = G.meta.clinic, d = day(G.W.time);
  const P = (cl.pop ||= { day0: d, day: d, seq: 0, diff: {}, stats: { births: 0, deaths: 0 } });
  let X = cache.get(P);
  if (!X) {
    const L = new Map();
    // the same order as when the people were live (seeded, then babies by birth), so a reload changes no index pick
    for (const q of seeded(G.meta.seed, G.W.R, P.day0)) { const v = q.id in P.diff ? P.diff[q.id] : q; if (v) L.set(q.id, v); }
    for (const [id, q] of Object.entries(P.diff)) if (q && !L.has(id)) L.set(id, q);
    // v2 (the living valley): bodies, slow illness, live records, immunity, households, the news the village makes
    P.v ??= 2; P.body ||= {}; P.ill ||= {}; P.rec ||= {}; P.imm ||= {}; P.hh ||= {}; P.epi ||= {}; P.news ||= [];
    X = { L, traits: new Map() };
    cache.set(P, X);
  }
  return { P, L: X.L, X };
}
export const touch = (P, q) => { P.diff[q.id] = q; };
export const endPregnancy = (q) => { delete q.conc; delete q.lossW; };
export function die(P, L, q) {
  L.delete(q.id);
  if (q.id.startsWith('b')) delete P.diff[q.id]; else P.diff[q.id] = 0;
  for (const m of [P.body, P.ill, P.rec, P.imm]) if (m) delete m[q.id];
  P.stats.deaths++;
  for (const k of L.values()) if (k.mother === q.id && k.bf) { k.bf = false; touch(P, k); } // no mother, no breast milk
}
// A newborn's death in the first weeks is rolled at birth (nn). Infections of the newborn (blood infection, a dirty
// cord, tetanus) now come as illnesses in the valley (village.js), so the roll keeps only the rest: prematurity, birth
// asphyxia, malformations. Infections are ~a quarter to a third of newborn deaths (Lawn JE et al. Lancet
// 2014;384:189), so 0.75 of the roll stays; tetanus at birth (ntR) is taken out whole.
const NN_REST = 0.75;
/** A baby joins the mother's household (or dies in the first weeks, with chance baby.nn). It inherits genes from its
 *  mother and her partner, and its iron store from her: an iron-poor mother has an iron-poor baby (estimate). */
export function addBaby(G, P, L, mother, baby, d, rng, motherFe) {
  P.stats.births++;
  if (rng() < Math.max(0, baby.nn - (baby.ntR || 0)) * NN_REST) { P.stats.deaths++; return null; }
  const b = { id: 'b' + P.seq++, h: mother.h, hh: mother.hh, sex: baby.sex, born: d, mother: mother.id, bw: baby.bw, bf: true };
  if (baby.marks.length) b.marks = baby.marks;
  const father = partnerOf(G, mother);
  b.g = inheritGenes(traitsOf(G, mother).g, father ? traitsOf(G, father).g : null, rng);
  if (father) b.father = father.id;
  const fe = (motherFe ?? (P.body[mother.id]?.[1] ?? 150)) < 50 ? 0.7 : 1;
  P.body[b.id] = [16.5, Math.round(50 * fe * (baby.bw / 3.2) * 10) / 10, 5, Math.round((baby.bw / medianWeight(0, b.sex)) * 1000) / 1000, 100, 1];
  L.set(b.id, b); touch(P, b);
  return b;
}

/** The household's key, and its partner: the first adult of the other sex in the house of an age to be one. */
export const householdKey = (q) => `${q.h}.${q.hh}`;
export function partnerOf(G, q) {
  const { L } = population(G), d = day(G.W.time), age = (d - q.born) / YEAR_DAYS;
  if (age < 15) return null;
  for (const k of L.values()) if (k.h === q.h && k.hh === q.hh && k.sex !== q.sex && k.id !== q.mother && k.mother !== q.id) {
    const a = (d - k.born) / YEAR_DAYS;
    if (a >= 15 && Math.abs(a - age) < 20) return k;
  }
  return null;
}
export const hamletRow = (R, id) => (id === 'village' ? R.village : R.hamlets.find((h) => h.id === id)) || R.village;

/** Each person's own makings, the same every time they are asked for (never saved): genes, how heavily she bleeds each
 *  month, how well they keep to medicine, allergy, how sick pregnancy makes her, malaria immunity, how much their diet
 *  varies from the household's. */
export function traitsOf(G, q) {
  const { P, X } = population(G);
  let tr = X.traits.get(q.id);
  if (tr) return tr;
  const seed = G.meta.seed, r = makeRng(seed, 'trait', q.id);
  const age0 = Math.max(0, (P.day0 - q.born) / YEAR_DAYS);
  tr = {
    g: q.g ?? seededGenes(seed, q.id, age0), menses: mensesOf(seed, q.id),
    adh: lerp(0.6, 0.95, r()), allergy: ((u) => (u < 0.02 ? 'penicillin' : u < 0.03 ? 'aspirin' : null))(r()),
    nausea: lerp(0.5, 1, r()), immF: lerp(0.35, 1.45, r()), diet: Math.exp(gauss(r) * 0.2), wealth: r(),
  };
  X.traits.set(q.id, tr);
  return tr;
}
/** How well off a household is (0..1): its hamlet, its own lot, and how much cash it holds now (food.js). */
export function wealthOf(G, q) {
  const { P } = population(G), h = hamletRow(G.W.R, q.h), hh = P.hh[householdKey(q)];
  const lot = makeRng(G.meta.seed, 'lot', householdKey(q))();
  const base = clamp((h?.wealth ?? 0.5) + (lot - 0.5) * 0.5, 0.02, 1);
  return hh ? clamp(0.6 * base + 0.4 * clamp(hh.cash / 150, 0, 1), 0.02, 1) : base;
}
/** The baseline diet: kcal shares of a maize-and-beans valley (FOODS in content/food.js); its iron and folate per
 *  1000 kcal. Households refine this every day (food.js). */
export const DIET0 = densityOf({ maize: 0.75, beans: 0.15, cassava: 0.08, greens: 0.02 });
/** A person's blood and weight [hb, fe, fol, kgRel, mcv, r], seeded the first time anyone asks (blood.js seedBlood). */
export function bodyOf(G, q, d) {
  const { P } = population(G);
  let B = P.body[q.id];
  if (B) return B;
  const tr = traitsOf(G, q), age = Math.max(0, (d - q.born) / YEAR_DAYS), r = makeRng(G.meta.seed, 'body', q.id);
  const kgRel = clamp(0.97 + gauss(r) * 0.07 + (wealthOf(G, q) - 0.5) * 0.08, 0.78, 1.2);
  const kg = medianWeight(age, q.sex) * kgRel, k = (kcalNeed(age, q.sex) / 1000) * tr.diet;
  const weeks = q.conc != null ? weeksOf(q, d) : 0;
  const b = age < 0.5 ? { hb: 12, fe: 40, fol: 5, mcv: 90, r: 1 } : seedBlood({ age, sex: q.sex, kg, weeks, g: tr.g, menses: tr.menses, diet: { nonHaem: DIET0.fe * k, haem: 0, folate: DIET0.folate * k } });
  B = P.body[q.id] = [b.hb, b.fe, b.fol, kgRel, b.mcv ?? 88, b.r].map((v) => Math.round(v * 1000) / 1000);
  return B;
}
/** Write a record's body back to the person (when the game stops running it hour by hour). */
export function storeBody(G, q, p) {
  const { P } = population(G);
  const b = p.blood;
  if (!b) return;
  // weight against the median at the age the record knew them by (a child grows on; kgRel carries over)
  const kgRel = (p.weight - 0.3 * (p.pregnant || 0)) / medianWeight(p.age, q.sex);
  P.body[q.id] = [b.hb, b.fe, b.fol, clamp(kgRel, 0.5, 1.3), b.mcv ?? 88, b.r ?? 1].map((v) => Math.round(v * 1000) / 1000);
}

/** Live every whole day since the last tick, and run every live record to now (village.js). Returns news. */
export function tickPeople(G) { return tickVillage(G); }

/** Someone from this hamlet who is not already in the clinic's hands (null if nobody). Its own stream per arrival. */
export function drawResident(G, hamletId, key) {
  const here = [...population(G).L.values()].filter((q) => q.h === hamletId && !q.held);
  return here.length ? here[Math.floor(makeRng(G.meta.seed, 'who', key)() * here.length)] : null;
}
/** The person as a patient record wants them at time t: who they are, their body and their own makings. */
export function personNow(G, q, t) {
  const d = t / DAY + 1, age = Math.max(0, (d - q.born) / YEAR_DAYS);
  const B = bodyOf(G, q, Math.floor(d)), tr = traitsOf(G, q);
  return { id: q.id, sex: q.sex, age, pregnant: q.conc != null ? weeksOf(q, d) : 0, name: personName(makeRng(G.meta.seed, 'name', q.id), q.sex), bw: q.bw, mother: q.mother, bf: q.bf, marks: q.marks,
    pp: q.lastBirth != null ? Math.max(0, (d - q.lastBirth) * COMPRESS) : null, vacc: q.vacc, fpUntil: q.fpUntil,
    advice: q.advice && Object.fromEntries(Object.entries(q.advice).filter(([, until]) => until > t)),
    kg: Math.round(medianWeight(age, q.sex) * B[3] * 10) / 10, kgRel: B[3], nutrition: nutritionOf(B[3]),
    blood: { hb: B[0], fe: B[1], fol: B[2], mcv: B[4], r: B[5], g: tr.g, menses: tr.menses },
    adh: clamp(tr.adh + (age < 12 ? 0.03 : 0), 0.4, 0.98), allergy: tr.allergy, nausea: tr.nausea, immF: tr.immF, wealth: wealthOf(G, q), trust: q.trust ?? 0.5 };
}
/** The clinic now holds this person's body (their patient record runs it, hour by hour). Their slow illnesses and any
 *  record the valley was running become the clinic's. */
export function hold(G, p) {
  const { P, L } = population(G), q = L.get(p.who);
  if (!q) return;
  q.held = p.id; touch(P, q);
  if (P.ill[q.id]) { for (const c of P.ill[q.id]) if (!p.conds.some((x) => x.id === c.id)) p.conds.push(c); delete P.ill[q.id]; }
  if (P.rec[q.id] && P.rec[q.id] !== p) delete P.rec[q.id];
  if (P.rec[q.id] === p) delete P.rec[q.id];
}

/** Keep the population in step with a held patient's events: births, deaths, and letting go when done. */
export function patientEvents(G, p, ev) {
  if (!p.who) return;
  const { P, L } = population(G), q = L.get(p.who);
  if (!q) return;
  const d = day(G.W.time);
  for (const e of ev) {
    if (e.kind === 'died') return die(P, L, q);
    if (e.kind === 'birth') q.pp = d + (addBaby(G, P, L, q, e.baby, d, makeRng(p.seed, 'nn', Math.floor(e.t)), p.blood?.fe) ? YEAR_DAYS : 3);
    if (e.kind === 'stillbirth' || e.kind === 'miscarriage') q.pp = d + 3;
    if (e.kind === 'birth' || e.kind === 'stillbirth') { q.lastBirth = d; q.parity = parityOf(G, q) + 1; }
    if (e.kind === 'healed') immunise(G, q, e.id, d);
  }
  if (p.vacc || p.fpUntil) { q.vacc = p.vacc; q.fpUntil = p.fpUntil; touch(P, q); }
  // advice they took home (a net, boiled water): kept until it lapses, it lowers what they catch next (patient.js)
  const adv = (p.rx || []).filter((r) => r.instr && !r.stopped);
  if (adv.length) { q.advice = { ...q.advice, ...Object.fromEntries(adv.map((r) => [r.instr, r.until])) }; touch(P, q); }
  if (q.held && p.recovered && !p.pregnant) { storeBody(G, q, p); q.held = null; q.trust = p.trust; endPregnancy(q); touch(P, q); }
}
