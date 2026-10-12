// Chronic illness and emergencies (WTND chapters 10, 11, 13, 22): one outcome band per major condition, against the
// published effect sizes cited in conditions.js / actives.js. Bands are broad on purpose. A game year is 40 days, and
// slow processes run COMPRESS times faster (time.js), so "months" below are game days.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { simulate, HOUR } from '../js/core/disease.js';
import { COMPRESS } from '../js/core/time.js';

const DAY = 24 * HOUR;
const LOG = process.env.CHRONIC_LOG ? console.log : () => {};
function cohort(cond, n, { days, rx, setup, tag = '', ...o }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = makePatient({ seed: 4242, key: cond + tag + i, t: 0, season: 'rains', hamlet: { mosquito: 0.5, water: 0.5 }, cond, ...o });
    setup?.(p);
    if (rx) p.rx = rx(p);
    simulate(p, days * DAY);
    out.push(p);
  }
  return out;
}
const share = (ps, f) => ps.filter(f).length / ps.length;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const dead = (p) => p.dead;
const cured = (id) => (p) => !p.dead && !p.conds.some((c) => c.id === id);
const had = (id) => (p) => p.conds.some((c) => c.id === id) || p.healed.some((h) => h.id === id) || p.pending?.some((q) => q.id === id);
const line = (active, mg, perDay, days, extra = {}) => ({ name: active, item: active + (extra.tag || ''), start: 0, amount: 1, perDay, days, left: 1e6, counselled: true, actives: { [active]: mg }, q: 1, ...extra });
const instr = (id, days) => ({ instr: id, name: id, start: 0, until: days * DAY });

test('asthma: salbutamol with prednisolone cuts deaths from an attack', () => {
  const o = { age: 25, sex: 'm', days: 6 };
  const none = cohort('asthma', 400, o);
  const both = cohort('asthma', 400, { ...o, rx: () => [line('salbutamol', 4, 3, 6), line('prednisolone', 40, 1, 5)] });
  const salb = cohort('asthma', 400, { ...o, rx: () => [line('salbutamol', 4, 3, 6)] });
  LOG('asthma dead', share(none, dead), share(salb, dead), share(both, dead));
  assert.ok(share(none, dead) > 0.01 && share(none, dead) < 0.1, 'untreated attack ' + share(none, dead));
  assert.ok(share(both, dead) < share(none, dead) / 3, `treated ${share(both, dead)} vs none ${share(none, dead)}`);
  assert.ok(share(salb, dead) <= share(none, dead), 'salbutamol alone helps too');
});

test('high blood pressure: amlodipine lowers it 8–20 mmHg and prevents a third or more of strokes and heart failure', () => {
  const o = { age: 55, sex: 'm', days: 3 * 40 }; // three game years
  const none = cohort('hypertension', 400, o);
  const amlo = cohort('hypertension', 400, { ...o, rx: () => [line('amlodipine', 5, 1, 3 * 40)] });
  const lvl = (ps) => mean(ps.filter((p) => !p.dead).map((p) => p.conds.find((c) => c.id === 'hypertension').L));
  const harm = (p) => had('stroke')(p) || had('heart_failure')(p);
  LOG('htn drop', lvl(none) - lvl(amlo), 'complications', share(none, harm), share(amlo, harm));
  assert.ok(lvl(none) - lvl(amlo) > 8 && lvl(none) - lvl(amlo) < 20, 'pressure drop ' + (lvl(none) - lvl(amlo)));
  assert.ok(share(none, harm) > 0.06 && share(none, harm) < 0.35, 'untreated complications over 3 years ' + share(none, harm));
  assert.ok(share(amlo, harm) < share(none, harm) * 0.8, `amlodipine ${share(amlo, harm)} vs none ${share(none, harm)}`);
});

test('stroke: a fifth to a third die within a month', () => {
  const s = cohort('stroke', 400, { age: 70, days: 30 });
  LOG('stroke 30-day', share(s, dead));
  assert.ok(share(s, dead) > 0.15 && share(s, dead) < 0.4, 'case fatality ' + share(s, dead));
});

test('epilepsy: phenobarbital at least halves the fits in most, and stops them in some', () => {
  const o = { age: 20, sex: 'f', days: 60 };
  const none = cohort('epilepsy', 300, o);
  const pb = cohort('epilepsy', 300, { ...o, rx: (p) => [line('phenobarbital', 2 * p.weight, 1, 60)] });
  const idx = none.map((p, i) => i).filter((i) => none[i].conds[0]?.n >= 4 && !pb[i].dead);
  const n = (p) => p.conds.find((c) => c.id === 'epilepsy').n - 1; // the fit that brought them is before treatment
  const halved = idx.filter((i) => n(pb[i]) <= n(none[i]) / 2).length / idx.length;
  const free = idx.filter((i) => n(pb[i]) <= 1).length / idx.length;
  LOG('epilepsy halved', halved, 'nearly free', free, idx.length, 'poisoned', share(pb, (p) => p.cause?.startsWith('poisoned')));
  assert.ok(halved > 0.5 && halved < 0.9, 'halved ' + halved);
  assert.ok(free > 0.1 && free < 0.6, 'fit-free ' + free);
  assert.equal(share(pb, (p) => p.cause?.startsWith('poisoned')), 0);
});

test('a fever fit that will not stop: diazepam into the anus stops it and saves lives', () => {
  const fitting = (p) => { const c = p.conds[0]; c.status = 1; c.hold = c.age; delete c.pre; };
  const o = { age: 2, days: 3, setup: fitting };
  const none = cohort('febrile_fits', 600, o);
  const dz = cohort('febrile_fits', 600, { ...o, rx: (p) => [line('diazepam', 0.5 * p.weight, 1, 1, { route: 'inj', inj: { ka: 4, rectal: true } })] });
  LOG('status dead', share(none, dead), share(dz, dead));
  assert.ok(share(none, dead) > 0.005 && share(none, dead) < 0.1, 'untreated status ' + share(none, dead));
  assert.ok(share(dz, dead) < share(none, dead) / 2, `diazepam ${share(dz, dead)} vs none ${share(none, dead)}`);
  const plain = cohort('febrile_fits', 300, { age: 2, days: 4 });
  LOG('febrile fits overall dead', share(plain, dead), 'cured', share(plain, cured('febrile_fits')));
  assert.ok(share(plain, cured('febrile_fits')) > 0.9, 'most fever fits pass');
});

test('severe malnutrition: therapeutic food saves most; feeding advice helps less; untreated many die', () => {
  const o = { age: 2, days: 70 / COMPRESS * 1.4 }; // ~3 months
  const none = cohort('marasmus', 400, o);
  const advice = cohort('marasmus', 400, { ...o, rx: () => [instr('feeding', 99)] });
  const rutf = cohort('marasmus', 400, { ...o, rx: () => [line('rutf', 92000, 3, 99)] });
  const c = cured('marasmus');
  LOG('marasmus dead', share(none, dead), share(advice, dead), share(rutf, dead), 'cured', share(none, c), share(advice, c), share(rutf, c));
  assert.ok(share(none, dead) > 0.06 && share(none, dead) < 0.3, 'untreated ' + share(none, dead));
  assert.ok(share(rutf, dead) < share(none, dead) / 2.5, `RUTF ${share(rutf, dead)} vs none ${share(none, dead)}`);
  assert.ok(share(rutf, c) > 0.7 && share(rutf, c) > share(advice, c) && share(advice, c) > share(none, c), `recovered: RUTF ${share(rutf, c)}, advice ${share(advice, c)}, none ${share(none, c)}`);
  const kw = cohort('kwashiorkor', 300, o), kwR = cohort('kwashiorkor', 300, { ...o, rx: () => [line('rutf', 92000, 3, 99)] });
  LOG('kwashiorkor dead', share(kw, dead), share(kwR, dead));
  assert.ok(share(kw, dead) > share(none, dead) && share(kwR, dead) < share(kw, dead) / 2.5, `kwashiorkor ${share(kw, dead)} → ${share(kwR, dead)}`);
});

test('anaemia: iron raises haemoglobin 1–2 g/dL in three weeks where iron is missing; folate where folate is', () => {
  const at = 21 / COMPRESS;
  const o = { age: 25, sex: 'f', days: at };
  const none = cohort('anaemia', 300, o);
  const iron = cohort('anaemia', 300, { ...o, rx: () => [line('iron', 65, 1, 99)] });
  const base = (ps) => mean(ps.filter((p) => p.conds[0]?.by === 'iron').map((p) => p.conds[0].L0 - p.conds[0].L));
  LOG('anaemia rise', base(none), base(iron));
  assert.ok(base(iron) > 1 && base(iron) < 2.5, 'iron 3 weeks ' + base(iron));
  assert.ok(base(none) < 0.2, 'none ' + base(none));
  const folate = cohort('anaemia', 300, { ...o, rx: () => [line('folic_acid', 5, 1, 99)] });
  const fol = (ps) => mean(ps.filter((p) => p.conds[0]?.by === 'folate').map((p) => p.conds[0].L0 - p.conds[0].L));
  LOG('folate need: iron', fol(iron), 'folic acid', fol(folate));
  assert.ok(fol(folate) > 1 && fol(iron) < 0.2, `folate-short: folic acid ${fol(folate)}, iron ${fol(iron)}`);
});

test('diabetes: diet lowers the sugar a little; foot sores come with years of it', () => {
  const o = { age: 55, sex: 'f', days: 2 * 40 };
  const none = cohort('diabetes', 400, o);
  const diet = cohort('diabetes', 400, { ...o, rx: () => [instr('diet', 999)] });
  const lv = (ps) => mean(ps.map((p) => p.conds.find((c) => c.id === 'diabetes').L / p.conds.find((c) => c.id === 'diabetes').L0));
  LOG('diabetes level', lv(none), lv(diet), 'foot sores', share(none, had('wound_infected')), share(diet, had('wound_infected')));
  assert.ok(lv(diet) < 0.9 && lv(diet) > 0.7, 'diet ' + lv(diet));
  assert.ok(share(none, had('wound_infected')) > 0.03 && share(none, had('wound_infected')) < 0.3, 'foot sores in 2 years ' + share(none, had('wound_infected')));
});

test('goitre: iodized oil shrinks it over a year', () => {
  const o = { age: 20, sex: 'f', days: 40 };
  const none = cohort('goitre', 200, o), oil = cohort('goitre', 200, { ...o, rx: () => [line('iodine', 200, 1, 1)] });
  const size = (ps) => mean(ps.map((p) => { const c = p.conds.find((q) => q.id === 'goitre'); return c ? c.L / c.L0 : 0; }));
  LOG('goitre', size(none), size(oil));
  assert.ok(size(none) > 0.95 && size(oil) < 0.75 && size(oil) > 0.4, `none ${size(none)}, iodine ${size(oil)}`);
});

test('stomach ulcer: omeprazole heals most in a month; antacids some; aspirin makes it worse', () => {
  const o = { age: 40, sex: 'm', days: 28 };
  const none = cohort('ulcer', 300, o);
  const ome = cohort('ulcer', 300, { ...o, rx: () => [line('omeprazole', 20, 1, 28)] });
  const ant = cohort('ulcer', 300, { ...o, rx: () => [line('antacid', 1000, 4, 28)] });
  const asa = cohort('ulcer', 300, { ...o, rx: () => [line('aspirin', 900, 4, 28)] });
  const c = cured('ulcer');
  LOG('ulcer healed', share(none, c), share(ant, c), share(ome, c), share(asa, c));
  assert.ok(share(none, c) > 0.15 && share(none, c) < 0.5, 'untreated ' + share(none, c));
  assert.ok(share(ome, c) > 0.75, 'omeprazole ' + share(ome, c));
  assert.ok(share(ant, c) > share(none, c) && share(ant, c) < share(ome, c), 'antacid ' + share(ant, c));
  assert.ok(share(asa, c) < share(none, c), 'aspirin ' + share(asa, c));
});

test('snakebite: antivenom cuts deaths; the horse serum brings reactions, sometimes shock', () => {
  const o = { age: 30, sex: 'm', days: 6 };
  const none = cohort('snakebite', 600, o);
  const av = cohort('snakebite', 600, { ...o, rx: () => [line('snake_antivenom', 2, 1, 1, { route: 'inj', inj: { ka: 20 } })] });
  LOG('snake dead', share(none, dead), share(av, dead), 'reacted', share(av, (p) => p.toxSeen.allergy !== undefined), 'shock', share(av, (p) => p.ana !== undefined));
  assert.ok(share(none, dead) > 0.03 && share(none, dead) < 0.2, 'untreated ' + share(none, dead));
  assert.ok(share(av, dead) < share(none, dead) / 2, `antivenom ${share(av, dead)} vs none ${share(none, dead)}`);
  assert.ok(share(av, (p) => p.toxSeen.allergy !== undefined) > 0.15 && share(av, (p) => p.toxSeen.allergy !== undefined) < 0.45, 'early reactions ' + share(av, (p) => p.toxSeen.allergy !== undefined));
  assert.ok(share(av, (p) => p.ana !== undefined) > 0.005 && share(av, (p) => p.ana !== undefined) < 0.08, 'shock ' + share(av, (p) => p.ana !== undefined));
});

test('scorpion sting: dangerous to small children, rarely to adults; kerosene kills a few children', () => {
  const kid = cohort('scorpion_sting', 800, { age: 3, days: 2 });
  const adult = cohort('scorpion_sting', 800, { age: 30, days: 2 });
  const ker = cohort('kerosene', 800, { age: 2, days: 6 });
  LOG('scorpion', share(kid, dead), share(adult, dead), 'kerosene', share(ker, dead));
  assert.ok(share(kid, dead) > 0.005 && share(kid, dead) < 0.08, 'child ' + share(kid, dead));
  assert.ok(share(adult, dead) < share(kid, dead) / 4, 'adult ' + share(adult, dead));
  assert.ok(share(ker, dead) > 0.003 && share(ker, dead) < 0.06, 'kerosene ' + share(ker, dead));
});

test('diazepam daily for weeks brings withdrawal on stopping; phenobarbital overdose stops breathing', () => {
  const long = cohort('back_pain', 60, { age: 40, sex: 'm', days: 34, tag: 'dz', rx: () => [line('diazepam', 10, 1, 28)] });
  const brief = cohort('back_pain', 60, { age: 40, sex: 'm', days: 10, tag: 'dz', rx: () => [line('diazepam', 10, 1, 3)] });
  LOG('benzo withdrawal', share(long, (p) => p.toxSeen.benzo_withdrawal), share(brief, (p) => p.toxSeen.benzo_withdrawal));
  assert.ok(share(long, (p) => p.toxSeen.benzo_withdrawal) > 0.5);
  assert.equal(share(brief, (p) => p.toxSeen.benzo_withdrawal), 0);
  const over = cohort('back_pain', 200, { age: 30, days: 6, tag: 'pb', rx: (p) => [line('phenobarbital', 15 * p.weight, 1, 5)] });
  LOG('pheno overdose', share(over, (p) => p.toxSeen.barb_resp), share(over, dead));
  assert.ok(share(over, (p) => p.toxSeen.barb_resp) > 0.5 && share(over, dead) > 0.02, `overdose ${share(over, (p) => p.toxSeen.barb_resp)}, dead ${share(over, dead)}`);
});
