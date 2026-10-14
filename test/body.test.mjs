// The blood of the valley (js/core/blood.js): iron balance, folate, worms, pregnancy, tablets. Bands are the physiology
// the model was built from (Bothwell 2000; Herbert 1962; Finch 1982); see the refs in blood.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedBlood, bloodStep, hbSet, cellLife, bloodVolume, absorbIron, basalLoss, pregnancyIron, MENSES_MG, FOLATE_BIO, inheritGenes } from '../js/core/blood.js';
import { kcalNeed } from '../js/core/content/food.js';
import { densityOf } from '../js/core/food.js';
import { COMPRESS, YEAR_DAYS } from '../js/core/time.js';
import { makeRng } from '../js/core/rng.js';

const D0 = densityOf({ maize: 0.75, beans: 0.15, cassava: 0.08, greens: 0.02 });
const diet = (age, sex, k = 1) => { const kk = (kcalNeed(age, sex) / 1000) * k; return { nonHaem: D0.fe * kk, haem: 0, folate: D0.folate * kk }; };
const woman = (o = {}) => seedBlood({ age: 25, sex: 'f', kg: 55, g: 0, menses: 1, diet: diet(25, 'f'), ...o });
/** Run a body for `days` real days with constant conditions. */
function run(b, { age = 25, sex = 'f', kg = 55, g = 0, weeks = 0, d = diet(age, sex), supp = 0, bleed = 0, menses = 1, inflam = 0, folIn } = {}, days) {
  for (let k = 0; k < days; k += 5) {
    const x = { set: hbSet(age, sex, weeks, g), life: cellLife(g), bv: bloodVolume(kg, age, sex), feIn: absorbIron({ ...d, supp }, b.fe, inflam, weeks), feOut: basalLoss(kg, b.fe) + (weeks ? pregnancyIron(weeks) : MENSES_MG * menses), bleed, inflam, folIn: folIn ?? d.folate * FOLATE_BIO, weeks, g, age };
    bloodStep(b, x, 5);
  }
  return b;
}

test('a woman on a maize-and-beans diet keeps her blood near normal, with a small iron store', () => {
  const b = woman();
  assert.ok(b.hb > 11.5 && b.hb < 13.8, 'Hb ' + b.hb);
  run(b, {}, 5 * 365);
  assert.ok(b.hb > 11.5 && b.hb < 13.8, 'after 5 years Hb ' + b.hb);
  assert.ok(b.fe > 20 && b.fe < 500, 'store ' + b.fe);
});
test('a man has a larger store than a woman on the same food', () => {
  const m = seedBlood({ age: 30, sex: 'm', kg: 64, g: 0, diet: diet(30, 'm') }), f = woman();
  assert.ok(m.fe > f.fe, `${m.fe} vs ${f.fe}`);
});
// ~100 Necator (~2500 eggs/g) lower a well-fed woman's Hb by a few g/L: most of the harm falls on the iron-poor (estimate)
test('a hundred hookworms take 0.3–3 g/dL over two game years', () => {
  const a = woman(), b = woman();
  run(a, {}, 2 * YEAR_DAYS * COMPRESS);
  run(b, { bleed: 100 * 0.03 }, 2 * YEAR_DAYS * COMPRESS);
  const drop = a.hb - b.hb;
  assert.ok(drop > 0.3 && drop < 3, 'drop ' + drop);
  assert.ok(b.mcv < a.mcv, 'iron-poor cells are smaller');
});
test('with no folate eaten, the marrow runs short after ~4 months (Herbert 1962)', () => {
  const b = woman();
  let days = 0;
  while (b.fol >= 4 && days < 1000) { run(b, { folIn: 0 }, 5); days += 5; }
  assert.ok(days > 90 && days < 220, 'days ' + days);
});
test('iron tablets raise the blood of an iron-starved woman ~1–2 g/dL in 3–4 weeks', () => {
  const b = { hb: 8, fe: 0, fol: 15, mcv: 75, r: 1 };
  run(b, { supp: 65 }, 28);
  assert.ok(b.hb > 9 && b.hb < 11, 'Hb ' + b.hb);
});
test('pregnancy draws the blood down; daily iron keeps more of it (Bothwell 2000)', () => {
  const none = woman(), iron = woman();
  for (let w = 2; w < 36; w += 1) { run(none, { weeks: w }, 7); run(iron, { weeks: w, supp: 60 }, 7); }
  assert.ok(none.hb > 9 && none.hb < 12.5, 'no iron: Hb ' + none.hb);
  assert.ok(iron.hb > none.hb + 0.3, `iron ${iron.hb} vs ${none.hb}`);
});
test('sickle cell disease runs low whatever is eaten; thalassaemia trait makes small cells with a full store', () => {
  const ss = seedBlood({ age: 10, sex: 'm', kg: 30, g: 6, diet: diet(10, 'm', 1.3) });
  assert.ok(ss.hb > 5 && ss.hb < 8.5, 'SS Hb ' + ss.hb);
  const th = seedBlood({ age: 25, sex: 'f', kg: 55, g: 2, menses: 0.5, diet: diet(25, 'f', 1.3) });
  assert.ok(th.mcv < 80 && th.fe > 50, `thal MCV ${th.mcv}, store ${th.fe}`);
});
test('genes pass by Mendel: two trait parents have an SS child about 1 in 4', () => {
  const rng = makeRng('mendel');
  let ss = 0;
  for (let i = 0; i < 4000; i++) if (Math.floor(inheritGenes(3, 3, rng) / 3) === 2) ss++;
  assert.ok(ss / 4000 > 0.22 && ss / 4000 < 0.28, 'SS ' + ss / 4000);
});
test('someone ill and starving can die of hunger itself', async () => {
  const { residentRecord } = await import('../js/core/patient.js');
  const { simulate } = await import('../js/core/disease.js');
  const { DAY } = await import('../js/core/time.js');
  let starved = 0;
  for (let i = 0; i < 30; i++) {
    const who = { id: 's' + i, sex: 'm', age: 30, pregnant: 0, name: 'A', kg: 39, kgRel: 0.62, nutrition: 0, blood: { hb: 13, fe: 100, fol: 15, mcv: 88, r: 1, g: 0, menses: 1 }, adh: 0.8, allergy: null, nausea: 0.8, immF: 1, wealth: 0.2, trust: 0.5 };
    const p = residentRecord({ seed: 5, who, t: 0, hamlet: null });
    p.diet = { r: 0.4, nonHaem: 5, haem: 0, folate: 0.1, abs: 0 };
    simulate(p, 10 * DAY);
    if (p.dead && p.cause === 'starvation') starved++;
  }
  assert.ok(starved > 15, 'starved ' + starved + '/30');
});
