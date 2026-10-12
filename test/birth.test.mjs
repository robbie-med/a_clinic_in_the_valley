// Childbirth and the newborn (WTND chapter 19): what goes wrong at a birth kills at realistic rates when nothing is
// done, and the book's remedies cut that. Bands are broad; the numbers they stand on are cited in conditions.js,
// actives.js and people.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { simulate, HOUR } from '../js/core/disease.js';
import { population, tickPeople, ntRisk } from '../js/core/people.js';
import { newClinic } from '../js/core/clinic.js';
import { DAY, YEAR_DAYS } from '../js/core/time.js';

const person = (cond, i, o = {}) => makePatient({ seed: 404, key: cond + (o.tag || '') + i, t: 0, season: 'rains', hamlet: { mosquito: 0.5, water: 0.5 }, cond, ...o });
function cohort(cond, n, { days, rx, setup, ...o }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = person(cond, i, o);
    p.hb0 = p.hb;
    setup?.(p);
    if (rx) p.rx = rx(p);
    p.ev = simulate(p, days * DAY);
    out.push(p);
  }
  return out;
}
const share = (ps, f) => ps.filter(f).length / ps.length;
const dead = (p) => p.dead;
const line = (active, mg, perDay, days, extra = {}) => ({ name: active, item: active, start: 0, amount: 1, perDay, days, left: 999, counselled: true, actives: { [active]: mg }, q: 1, ...extra });
const inj = (active, mg, perDay = 1, days = 1, start = 0, ka = 3) => line(active, mg, perDay, days, { start, route: 'inj', inj: { ka } });
const had = (id) => (p) => p.conds.some((c) => c.id === id) || p.healed.some((h) => h.id === id);
const woman = { age: 25, sex: 'f' };
// women the clinic holds, a few hours before term: labour, the birth and what follows run through people.js onLabour
const atTerm = (tag, n, setup) => cohort('back_pain', n, { ...woman, days: 4, tag, setup: (p) => { p.pregnant = 39.9; setup?.(p); } });
const lost = (p) => p.conds.find((c) => c.id === 'pph')?.lost ?? (1 - p.hb / p.hb0) * p.weight * 80;

test('bleeding after birth: untreated some bleed to death; oxytocin at once cuts that', () => {
  const none = cohort('pph', 1500, { ...woman, days: 1 });
  const oxy = cohort('pph', 1500, { ...woman, days: 1, rx: () => [inj('oxytocin', 0.0168, 1, 1, 0, 1.5), inj('oxytocin', 0.0168, 1, 1, 15, 1.5)] });
  assert.ok(share(none, dead) > 0.01 && share(none, dead) < 0.06, 'untreated PPH ' + share(none, dead));
  assert.ok(share(oxy, dead) < share(none, dead) / 2, `oxytocin ${share(oxy, dead)} vs none ${share(none, dead)}`);
  assert.ok(share(oxy, (p) => lost(p) >= 1000) < share(none, (p) => lost(p) >= 1000) / 2, 'oxytocin stops the big bleeds');
});

test('births with no care: ~1 in 8 lose ≥500 ml, a few in 1000 mothers die; misoprostol at birth halves the bleeding', () => {
  const none = atTerm('t', 1200);
  const miso = atTerm('t', 1200, (p) => p.rx.push({ instr: 'miso_at_birth', name: 'miso', start: 0, until: 1e9, atBirth: { item: 'miso_200', name: 'miso', amount: 3, left: 3, actives: { misoprostol: 0.2 }, q: 1 } }));
  const born = (p) => p.ev.some((e) => e.kind === 'birth' || e.kind === 'stillbirth');
  assert.ok(share(none, born) > 0.97, 'births ' + share(none, born));
  const pph500 = (ps) => share(ps, (p) => lost(p) >= 500);
  assert.ok(pph500(none) > 0.08 && pph500(none) < 0.18, 'PPH ≥500 ml ' + pph500(none)); // 12% (Derman 2006)
  assert.ok(pph500(miso) < pph500(none) * 0.7, `misoprostol ${pph500(miso)} vs none ${pph500(none)}`); // RR 0.53
  // no-care maternal mortality ~1000/100 000 (Ronsmans & Graham 2006); Uganda today ~340
  assert.ok(share(none, dead) > 0.002 && share(none, dead) < 0.02, 'maternal deaths ' + share(none, dead));
  assert.ok(share(none, had('obstructed_labour')) > 0.02 && share(none, had('puerperal_sepsis')) > 0.02, 'obstructed labour and childbirth fever happen');
});

test('obstructed labour: at home many babies and some mothers die; at the hospital (referred) far fewer', () => {
  const home = cohort('obstructed_labour', 400, { ...woman, days: 6 });
  const hosp = cohort('obstructed_labour', 400, { ...woman, days: 6, setup: (p) => { p.hospital = { from: 6 * HOUR, until: 6 * DAY }; } });
  const still = (ps) => share(ps, (p) => p.ev.some((e) => e.kind === 'stillbirth'));
  assert.ok(still(home) > 0.2, 'stillbirths at home ' + still(home));
  assert.ok(still(hosp) < still(home) / 2, `stillbirths: hospital ${still(hosp)} vs home ${still(home)}`);
  assert.ok(share(home, dead) > 0.02 && share(hosp, dead) < share(home, dead) / 2, `mothers: home ${share(home, dead)} vs hospital ${share(hosp, dead)}`);
  assert.ok(share(home, (p) => p.pregnant > 0 && !p.dead) < 0.03, 'within days almost every labour ends, one way or another');
});

test('eclampsia: fits kill ~15% untreated; magnesium sulfate prevents more fits than diazepam, and deaths', () => {
  // until well after the birth (the fits bring on labour within ~1.5 days): magnesium 10 g then 5 g every 4 h; diazepam 20 mg then 10 mg every 6 h
  const mg = () => [inj('magnesium', 986, 1, 1, 0, 1), inj('magnesium', 493, 6, 5, 240, 1)];
  const dz = () => [inj('diazepam', 20, 1, 1), inj('diazepam', 10, 4, 5, 360)];
  const fresh = (p) => { p.fits = 0; }; // count only the fits after she reaches you
  const none = cohort('eclampsia', 600, { ...woman, days: 6, setup: fresh });
  const onMg = cohort('eclampsia', 600, { ...woman, days: 6, setup: fresh, rx: mg });
  const onDz = cohort('eclampsia', 600, { ...woman, days: 6, setup: fresh, rx: dz });
  const fits = (ps) => ps.reduce((a, p) => a + p.fits, 0) / ps.length;
  assert.ok(share(none, dead) > 0.06 && share(none, dead) < 0.3, 'untreated eclampsia ' + share(none, dead));
  assert.ok(share(onMg, dead) < share(none, dead) / 2, `magnesium ${share(onMg, dead)} vs none ${share(none, dead)}`);
  // recurrent fits: ~13% on magnesium vs ~28% on diazepam (Eclampsia Trial 1995)
  assert.ok(fits(onMg) < fits(onDz) * 0.65 && fits(onDz) < fits(none) * 0.7, `fits after arrival: magnesium ${fits(onMg)}, diazepam ${fits(onDz)}, none ${fits(none)}`);
  assert.equal(share(onMg, (p) => p.toxSeen.mg_breath), 0, 'the dose in the book does not stop the breathing');
});

test('pre-eclampsia untreated sometimes turns to fits (eclampsia)', () => {
  const ps = cohort('pre_eclampsia', 600, { days: 12 });
  const e = share(ps, had('eclampsia'));
  assert.ok(e > 0.03 && e < 0.25, 'eclampsia ' + e);
  assert.ok(share(ps, dead) < 0.15, 'deaths ' + share(ps, dead));
});

test('newborn blood infection: ampicillin with gentamicin cuts deaths several-fold', () => {
  const baby = { age: 0.02, days: 14 };
  const none = cohort('newborn_sepsis', 400, baby);
  const abx = cohort('newborn_sepsis', 400, { ...baby, rx: (p) => [inj('ampicillin', 50 * p.weight, 2, 7), inj('gentamicin', 5 * p.weight, 1, 7)] });
  assert.ok(share(none, dead) > 0.2 && share(none, dead) < 0.7, 'untreated ' + share(none, dead));
  assert.ok(share(abx, dead) < share(none, dead) / 3, `treated ${share(abx, dead)} vs none ${share(none, dead)}`);
  assert.equal(share(abx, (p) => p.toxSeen.kidney_injury), 0, 'the book\'s gentamicin dose does not poison');
});

test('childbirth fever: the book\'s three medicines cut deaths', () => {
  const none = cohort('puerperal_sepsis', 400, { days: 21 });
  const abx = cohort('puerperal_sepsis', 400, { days: 21, rx: () => [inj('ampicillin', 1000, 4, 7), inj('gentamicin', 60, 3, 7), line('metronidazole', 500, 3, 7)] });
  assert.ok(share(none, dead) > 0.04 && share(none, dead) < 0.25, 'untreated ' + share(none, dead));
  assert.ok(share(abx, dead) < share(none, dead) / 3, `treated ${share(abx, dead)} vs none ${share(none, dead)}`);
});

test('newborn tetanus kills most untreated; diazepam for the spasms saves some', () => {
  const baby = { age: 0.02, days: 25 };
  const none = cohort('newborn_tetanus', 300, baby);
  const dz = cohort('newborn_tetanus', 300, { ...baby, rx: () => [line('diazepam', 1, 4, 21)] });
  assert.ok(share(none, dead) > 0.6, 'untreated ' + share(none, dead));
  assert.ok(share(dz, dead) < share(none, dead) - 0.15, `diazepam ${share(dz, dead)} vs none ${share(none, dead)}`);
});

test('dirty cord care and an unvaccinated mother bring newborn tetanus; two TT doses and a clean cord prevent it', () => {
  assert.ok(ntRisk(false, false) >= 0.005, 'unprotected');
  assert.ok(ntRisk(true, false) < ntRisk(false, false) / 10, 'tetanus toxoid');
  assert.ok(ntRisk(false, true) < ntRisk(false, false), 'clean cord');
});

test('a cold small baby: skin-to-skin care cuts deaths', () => {
  const baby = { age: 0.01, days: 20 };
  const none = cohort('cold_baby', 800, baby);
  const kmc = cohort('cold_baby', 800, { ...baby, rx: () => [{ instr: 'kangaroo', name: 'k', start: 0, until: 1e9 }] });
  assert.ok(share(none, dead) > 0.03, 'untreated ' + share(none, dead));
  assert.ok(share(kmc, dead) < share(none, dead) * 0.75, `kangaroo ${share(kmc, dead)} vs none ${share(none, dead)}`);
});

test('iron in pregnancy builds up the blood', () => {
  const hb = (iron) => {
    const ps = cohort('back_pain', 40, { ...woman, days: 12, tag: 'fe', setup: (p) => { p.pregnant = 12; p.hb = p.hb0 = 9; if (iron) p.rx = [line('iron', 65, 1, 12)]; } });
    return ps.reduce((a, p) => a + p.hb - p.hb0, 0) / ps.length;
  };
  assert.ok(hb(true) > hb(false) + 0.4, `with iron ${hb(true)} vs without ${hb(false)}`);
});

test('family planning: DMPA for every woman lowers the valley\'s births', () => {
  const houses = (k) => Array.from({ length: k }, () => ({}));
  const R = { village: { id: 'village', houses: houses(6) }, hamlets: [3, 4, 5, 3, 4, 5].map((k, i) => ({ id: 'h' + i, houses: houses(k) })) };
  const births = (fp) => {
    const G = { meta: { seed: 42, clinic: newClinic() }, W: { R, time: 14 * DAY } };
    if (fp) for (const q of population(G).L.values()) if (q.sex === 'f') q.fpUntil = 1e9;
    G.W.time += 2 * YEAR_DAYS * DAY; tickPeople(G);
    const b0 = population(G).P.stats.births;
    G.W.time += 2 * YEAR_DAYS * DAY; tickPeople(G);
    return population(G).P.stats.births - b0; // births in years 3–4, after pregnancies under way have ended
  };
  const none = births(false), fp = births(true);
  assert.ok(fp < none * 0.25, `with DMPA ${fp} vs ${none}`);
});
