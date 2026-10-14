// blood.js — the blood of everyone in the valley: haemoglobin, the iron store, folate, red cell size and turnover, and
// the genes that shape them. One model serves the residents (people.js / village.js step it once a game day) and the
// bodies the game runs hour by hour (disease.js simulate steps it every hour). Pure.
//
// Red cells are made by the marrow, live ~120 days and are broken down; their iron goes back to the store. The marrow
// works toward a set point (age, sex, pregnancy, genes), faster the further below it the blood is, up to ~3× its basal
// rate; it needs iron for every gram of haemoglobin and folate to divide at all. Iron comes in from food (a few per cent
// of it from a maize-and-beans diet, more when the store is empty, less while inflammation raises hepcidin) and from
// tablets, and leaves with shed cells, monthly bleeding, worms, blood loss and the growing baby. So anaemia here has
// many causes, often several at once, and iron tablets mend only the part of it that was missing iron.
//
// These are slow processes: they run on the game calendar (time.js COMPRESS), so one game day is ~9 real days of
// marrow work. Acute losses (a malaria crisis, a haemorrhage) are applied where they happen (disease.js), in real hours.
import { makeRng, hashf, strHash } from './rng.js';
import { COMPRESS } from './time.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());

export const FE_PER_G_HB = 3.47; // mg of iron in a gram of haemoglobin
/** Ferritin (µg/L) from the iron store: 1 µg/L ≈ 8 mg of storage iron (Walters GO et al. J Clin Pathol 1973;26:770);
 *  inflammation raises it as an acute-phase protein, so a high ferritin does not rule out an empty store. */
export const ferritin = (fe, inflam = 0) => (fe / 8) * (1 + 2 * inflam);

// ————————————————————————————————————————————— genes
// g = s·3 + a. s: HbS alleles (0 AA, 1 AS sickle trait, 2 SS sickle cell disease); a: α+-thalassaemia deletions
// (0 αα/αα, 1 −α/αα, 2 −α/−α). At birth in Uganda 13.3% carry the trait and 0.7% have the disease (Ndeezi G et al.
// Lancet Glob Health 2016;4:e195); 50–90% of children born with SS disease in Africa die young (Grosse SD et al. Am J
// Prev Med 2011;41:S398). The −α allele runs at ~0.25 in East Africa (Williams TN, Weatherall DJ. Cold Spring Harb
// Perspect Med 2012;2:a011692), so ~37% carry one deletion and ~6% two.
export const GENES = { as: 0.133, ss: 0.007, alpha: 0.25 };
export const sickle = (g) => Math.floor((g ?? 0) / 3);
export const thal = (g) => (g ?? 0) % 3;
/** A person's genes from the seed (people already in the valley): an SS child seldom reaches adulthood. */
export function seededGenes(seed, id, age) {
  const r = makeRng(seed, 'genes', id);
  const u = r();
  const ssLive = GENES.ss * (age < 1 ? 1 : age < 5 ? 0.6 : 0.3 * Math.exp(-(age - 5) / 15));
  const s = u < ssLive ? 2 : u < ssLive + GENES.as ? 1 : 0;
  const v = r(), q = GENES.alpha;
  const a = v < q * q ? 2 : v < q * q + 2 * q * (1 - q) ? 1 : 0;
  return s * 3 + a;
}
/** A baby's genes from its mother's and father's (one allele from each, Mendel). father: genes or null (then the
 *  population's allele frequency stands in). */
export function inheritGenes(mother, father, rng) {
  const qS = 1 - Math.sqrt(1 - GENES.as - GENES.ss); // HbS allele frequency that gives the trait share
  const fromS = (g) => (g == null ? rng() < qS : rng() < sickle(g) / 2);
  const fromA = (g) => (g == null ? rng() < GENES.alpha : rng() < thal(g) / 2);
  return (+fromS(mother) + +fromS(father)) * 3 + (+fromA(mother) + +fromA(father));
}

// ————————————————————————————————————————————— set point
// Mean haemoglobin of healthy, iron-replete people, ~1.5 g/dL above the WHO anaemia cut-offs for each group (WHO.
// Haemoglobin concentrations for the diagnosis of anaemia and assessment of severity, 2011; the offset is an estimate).
const SET_CHILD = [[0.5, 11.3], [2, 12.0], [5, 12.3], [12, 12.9], [15, 13.3]];
function setByAge(age, sex) {
  if (age < 15) { const row = SET_CHILD.find(([a]) => age < a); return row ? row[1] : 13.3; }
  if (sex === 'm') return age >= 65 ? 14.5 : 15.0;
  return age >= 65 ? 13.2 : 13.5;
}
/** Plasma grows ~45% in pregnancy and red cells ~25%, so Hb falls ~1–1.2 g/dL by 28–34 weeks and rises a little before
 *  term: the reason WHO's cut-off is 11 in pregnancy against 12 (Bothwell TH. Am J Clin Nutr 2000;72:257S). */
export function dilution(weeks) {
  if (!weeks) return 0;
  const s = clamp((weeks - 8) / 22, 0, 1);
  return 1.2 * s * s * (3 - 2 * s) - (weeks > 34 ? 0.2 * clamp((weeks - 34) / 6, 0, 1) : 0);
}
/** The haemoglobin the marrow aims for (g/dL). α-thalassaemia trait sits a little lower (Williams & Weatherall 2012).
 *  Sickle cell disease aims as high as anyone but cannot get there: its cells die in ~2–3 weeks (life below). */
export function hbSet(age, sex, weeks, g) {
  return setByAge(age, sex) - [0, 0.3, 0.9][thal(g)] - dilution(weeks);
}
/** Red cell life in days: ~120 (Franco RS. Transfus Med Hemother 2012;39:302), sickle cells ~16 (estimate, 10–20). */
export const cellLife = (g) => (sickle(g) === 2 ? 16 : 120);
/** Blood volume (dL): ~80 ml/kg in children, ~75 in men, ~65 in women (estimates, standard physiology). */
export const bloodVolume = (kg, age, sex) => kg * (age < 15 ? 0.8 : sex === 'm' ? 0.75 : 0.65);
// The marrow's ceiling, as a multiple of basal output: ~3× with ample iron over weeks (Finch CA. Blood 1982;60:1241);
// SS marrow is chronically expanded and runs higher (estimate).
const CAP = (g) => (sickle(g) === 2 ? 6 : 3);
const DRIVE = 0.5; // extra output per g/dL below the set point (× basal): erythropoietin's response, an estimate

// ————————————————————————————————————————————— iron in and out (mg a real day)
/** Iron lost from the gut, skin and urine: ~14 µg/kg a day (Green R et al. Am J Med 1968;45:336); less once the store is
 *  empty. Monthly bleeding: median ~30 ml a cycle, ~0.45 mg a day, with a long tail (Hallberg L et al. Acta Obstet
 *  Gynecol Scand 1966;45:320); `menses` is each woman's own multiple. */
export const basalLoss = (kg, fe) => 0.014 * kg * (0.6 + 0.4 * clamp(fe / 150, 0, 1));
export const MENSES_MG = 0.45;
/** What the pregnancy takes beyond the basal loss, mg a day by week: ~0 in the first trimester (no monthly bleeding),
 *  4–5 a day in the second, >6 in the third, ~1000 mg in all (Bothwell 2000). Most of it is the baby, the placenta and
 *  the mother's own extra red cells; it is taken whether or not her store can spare it. */
export const pregnancyIron = (weeks) => (!weeks || weeks < 14 ? 0 : weeks < 28 ? 3.6 : 5.6);
/** Share of iron absorbed. Non-haem iron from a high-phytate maize-and-beans meal: ~1% with a full store, up to ~8% with
 *  an empty one (FAO/WHO. Vitamin and mineral requirements in human nutrition, 2004: the 5% bioavailability class is
 *  what people with no stores absorb from such a diet); rising through
 *  pregnancy (Bothwell 2000). Haem iron (meat): ~25% (FAO/WHO 2004). Inflammation (malaria, HIV, TB) raises hepcidin,
 *  which shuts both the gut and the store (Prentice AM et al. Blood 2012;119:1922). Tablets taken apart from meals are
 *  absorbed better (~15% of 60 mg in iron deficiency; estimate). */
export function absorbIron({ nonHaem = 0, haem = 0, supp = 0 }, fe, inflam, weeks) {
  const up = Math.exp(-fe / 200);
  const preg = !weeks ? 1 : weeks < 14 ? 0.8 : weeks < 28 ? 1.6 : 2.4;
  const hep = 1 - 0.6 * clamp(inflam, 0, 1);
  return nonHaem * Math.min(0.2, (0.01 + 0.07 * up) * preg) * hep
    + haem * 0.25 * (1 - 0.2 * clamp(inflam, 0, 1))
    + supp * Math.min(0.25, (0.03 + 0.12 * up) * preg) * hep;
}
/** Folate absorbed from food: about half of what the diet holds (estimate); folic acid tablets ~85% (IOM DRI 1998). */
export const FOLATE_BIO = 0.5, FOLIC_BIO = 0.85;
// Folate store: ~10–30 mg turned over in ~100 days, so with none eaten the marrow runs short after ~4 months, as in
// Herbert's own experiment (Herbert V. Trans Assoc Am Physicians 1962;75:307). Pregnancy and fast red cell turnover
// (sickle cell disease, haemolysis) use it faster (IOM DRI 1998: 600 µg a day in pregnancy against 400).
const FOL_TAU = 100, FOL_MIN = 4;

// ————————————————————————————————————————————— the step
/**
 * Advance a body's blood by `days` real days. b: { hb, fe, fol, mcv, r } (mutated). x:
 *   set, life, bv (dL), feIn (mg absorbed a day), feOut (mg lost a day, not with cells), bleed (ml of blood a day),
 *   inflam (0..1), folIn (mg absorbed a day), weeks (pregnant), g (genes), grow (dL of blood volume gained a day).
 * Returns the iron the marrow lacked (mg), for the record.
 */
export function bloodStep(b, x, days) {
  if (days <= 0) return 0;
  const n = Math.max(1, Math.ceil(days / (x.life < 30 ? 1 : 2.5))), h = days / n;
  const basal = x.set / 120, FE = FE_PER_G_HB * x.bv, inf = clamp(x.inflam || 0, 0, 1);
  let short = 0, made = 0;
  for (let k = 0; k < n; k++) {
    // cells die; their iron goes back to the store
    const die = (b.hb / x.life) * h;
    b.hb -= die; b.fe += die * FE;
    // blood lost (worms, bleeding): its iron leaves with it
    if (x.bleed) b.hb -= b.hb * ((x.bleed * h) / 100) / x.bv;
    // growth: a bigger child needs more haemoglobin for the same concentration
    if (x.grow) b.fe -= x.grow * h * b.hb * FE_PER_G_HB;
    b.fe += (x.feIn - x.feOut) * h;
    // the marrow: drive toward the set point, damped by inflammation, capped by folate
    const fcap = clamp(b.fol / FOL_MIN, 0, 1) ** 2 * CAP(x.g);
    const want = basal * clamp(1 + DRIVE * (x.set - b.hb), 0.2, CAP(x.g)) * (1 - 0.5 * inf);
    let prod = Math.min(want, basal * fcap) * h;
    const need = prod * FE;
    if (b.fe < need) { short += need - Math.max(0, b.fe); prod = Math.max(0, b.fe) / FE; }
    b.hb += prod; b.fe -= prod * FE; made += prod;
    // a store run dry: the rest is taken from the blood itself
    if (b.fe < 0) { b.hb += b.fe / FE; b.fe = 0; }
    const use = (1 + 0.5 * (x.weeks ? 1 : 0)) * (0.6 + 0.4 * clamp(prod / h / basal, 0, 6));
    b.fol = Math.max(0, b.fol + (x.folIn - (b.fol * use) / FOL_TAU) * h);
    b.hb = clamp(b.hb, 1.5, 20);
  }
  // output against basal (the reticulocyte response) and cell size: small when the marrow is starved of iron or with
  // thalassaemia, large when it lacks folate; red cells turn over in ~4 months, so size follows slowly
  b.r = made / days / basal;
  const target = mcvBase(x.age) - [0, 5, 12][thal(x.g)] - (short > 0.05 * days * basal * FE ? 14 : b.fe < 20 ? 5 : 0) + (b.fol < FOL_MIN ? 18 * clamp(1 - b.fol / FOL_MIN, 0, 1) : 0) + clamp(b.r - 1, 0, 4) * 2;
  b.mcv = (b.mcv ?? target) + (target - (b.mcv ?? target)) * Math.min(1, days / 120);
  return short;
}
/** Normal red cell size (fL) by age: smaller in young children (estimates, standard paediatric ranges). */
const mcvBase = (age) => (age == null || age >= 12 ? 88 : age < 2 ? 77 : age < 6 ? 80 : 84);

// ————————————————————————————————————————————— a body from the seed
/**
 * A resident's blood when the valley first sees them: run their own iron balance for a few years at their age, so the
 * store and haemoglobin start where their diet and losses would have put them. person: { age, sex, kg, weeks (pregnant),
 * g, menses (multiple), diet: { nonHaem, haem, folate (mg eaten a day) } }.
 */
export function seedBlood(person) {
  const { age, sex, kg, g } = person;
  const b = { hb: hbSet(age, sex, 0, g), fe: age < 1 ? 60 : sex === 'm' ? 300 : 120, fol: 15, mcv: undefined, r: 1 };
  const bv = bloodVolume(kg, age, sex);
  const menses = sex === 'f' && age >= 13 && age < 50 ? MENSES_MG * (person.menses ?? 1) : 0;
  for (let k = 0; k < 40; k++) {
    const x = { set: hbSet(age, sex, 0, g), life: cellLife(g), bv, feIn: absorbIron(person.diet, b.fe, 0, 0), feOut: basalLoss(kg, b.fe) + menses, inflam: 0, folIn: person.diet.folate * FOLATE_BIO, g, age };
    bloodStep(b, x, 30);
  }
  // already pregnant: the weeks so far, in steps of a fortnight
  for (let w = 2; w < (person.weeks || 0); w += 2) {
    const x = { set: hbSet(age, sex, w, g), life: cellLife(g), bv, feIn: absorbIron(person.diet, b.fe, 0, w), feOut: basalLoss(kg, b.fe) + pregnancyIron(w), inflam: 0, folIn: person.diet.folate * FOLATE_BIO, weeks: w, g, age };
    bloodStep(b, x, 14); // a fortnight of real marrow work
  }
  return b;
}

/** Each woman's own monthly loss, as a multiple of the median (log-normal; Hallberg 1966 found a long tail). */
export const mensesOf = (seed, id) => Math.min(3, Math.exp(gauss(makeRng(seed, 'menses', id)) * 0.55)); // the heaviest seek help or are anaemic already
/** Is she bleeding monthly? Women 13–49, not pregnant, not within a year of a birth while breastfeeding (lactational
 *  amenorrhoea, Uganda DHS 2016), not on DMPA (which mostly stops it). */
export function menstruating(sex, age, weeks, sinceBirthDays, fp) {
  return sex === 'f' && age >= 13 && age < 50 && !weeks && !(sinceBirthDays != null && sinceBirthDays < 365) && !fp;
}

/** The real days of marrow work in `hours` game hours (slow processes run COMPRESS times faster). */
export const slowDays = (hours) => (hours / 24) * COMPRESS;
/** Stable per-person hash roll in [0,1): hashf on the id (rng.js STREAM salts). */
export const roll = (seed, id, d, salt) => hashf(seed, strHash(id), d, salt);
export { lerp };
