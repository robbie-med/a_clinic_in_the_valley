// Real consequences: complications that follow untreated infection, poisoning by gut-acting medicines, allergic
// shock and its rescue, dependence, the dehydrated kidney, and resistance bred inside one patient.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { simulate, HOUR } from '../js/core/disease.js';
import { conc } from '../js/core/pk.js';
import { COND } from '../js/core/content/conditions.js';

const DAY = 24 * HOUR;
const person = (cond, i, o = {}) => makePatient({ seed: 909, key: cond + (o.tag || '') + i, t: 0, season: 'rains', hamlet: { mosquito: 0.6, water: 0.5 }, cond, ...o });
function cohort(cond, n, { days, rx, setup, ...o }) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = person(cond, i, o);
    setup?.(p);
    if (rx) p.rx = rx(p);
    simulate(p, days * DAY);
    out.push(p);
  }
  return out;
}
const share = (ps, f) => ps.filter(f).length / ps.length;
const line = (active, mg, perDay, days, extra = {}) => ({ name: active, item: active, start: 0, amount: 1, perDay, days, left: 999, counselled: true, actives: { [active]: mg }, q: 1, ...extra });
const had = (id) => (p) => p.conds.some((c) => c.id === id) || p.healed.some((h) => h.id === id);

test('strep throat: penicillin for 10 days prevents most rheumatic fever; 3 days much less', () => {
  const sq = COND.get('strep_throat').params.sequel, odds = sq.odds;
  sq.odds = 1; // make every untreated case go on to it, to measure the protection
  try {
    const opts = { age: 9, days: 50 };
    const none = cohort('strep_throat', 150, opts);
    const ten = cohort('strep_throat', 150, { ...opts, rx: (p) => [line('penicillin_v', 12.5 * p.weight, 4, 10)] });
    const three = cohort('strep_throat', 150, { ...opts, rx: (p) => [line('penicillin_v', 12.5 * p.weight, 4, 3)] });
    const rf = had('rheumatic_fever');
    assert.ok(share(none, rf) > 0.9, 'untreated ' + share(none, rf));
    assert.ok(share(ten, rf) < 0.45 && share(ten, rf) > 0.15, '10 days ' + share(ten, rf));
    assert.ok(share(three, rf) > share(ten, rf) + 0.2, `3 days ${share(three, rf)} vs 10 days ${share(ten, rf)}`);
  } finally { sq.odds = odds; }
});

test('bladder infections sometimes climb to the kidneys untreated; treated, they do not', () => {
  const none = cohort('uti', 600, { age: 30, sex: 'f', days: 21 });
  const cipro = cohort('uti', 600, { age: 30, sex: 'f', days: 21, rx: () => [line('ciprofloxacin', 500, 2, 3)] });
  const py = had('pyelonephritis');
  assert.ok(share(none, py) > 0.002 && share(none, py) < 0.06, 'untreated ' + share(none, py));
  assert.ok(share(cipro, py) < share(none, py), `ciprofloxacin ${share(cipro, py)} vs none ${share(none, py)}`); // some climb before the first dose works
});

test('iron tablets: the anaemia dose is safe; a handful kills small children', () => {
  const iron = (mgkg, perDay, days) => (p) => [{ name: 'iron', item: 'iron_200', start: 0, amount: 1, perDay, days, left: 999, actives: { iron: mgkg * p.weight }, q: 1 }];
  const dose = cohort('back_pain', 200, { age: 3, days: 6, tag: 'fe', rx: iron(2, 3, 5) });
  const fist = cohort('back_pain', 200, { age: 3, days: 6, tag: 'fe', rx: iron(180, 1, 1) });
  assert.equal(share(dose, (p) => p.dead), 0);
  assert.ok(share(fist, (p) => p.dead) > 0.3, 'swallowed 180 mg/kg: ' + share(fist, (p) => p.dead));
});

test('allergic shock from injected penicillin: adrenaline at once mostly saves them', () => {
  const allergic = (p) => { p.allergy = 'penicillin'; };
  const pen = () => line('benzylpenicillin', 600, 1, 1, { route: 'inj', inj: { ka: 3 } });
  const adr = () => line('adrenaline', 0.5, 1, 1, { start: 5, route: 'inj', inj: { ka: 3 } });
  const bare = cohort('strep_throat', 1500, { age: 25, days: 1, tag: 'ana', setup: allergic, rx: () => [pen()] });
  const ready = cohort('strep_throat', 1500, { age: 25, days: 1, tag: 'ana', setup: allergic, rx: () => [pen(), adr()] });
  const shock = share(bare, (p) => p.ana !== undefined), died = share(bare, (p) => p.dead), saved = share(ready, (p) => p.dead);
  assert.ok(shock > 0.05 && shock < 0.15, 'shock after injection ' + shock);
  assert.ok(died > 0.005, 'untreated shock kills some ' + died);
  assert.ok(saved < died / 3, `with adrenaline ${saved} vs without ${died}`);
});

test('codeine: two weeks every day brings withdrawal on stopping; three days does not', () => {
  const long = cohort('back_pain', 40, { age: 40, sex: 'm', days: 24, rx: () => [line('codeine', 60, 4, 18)] });
  const brief = cohort('back_pain', 40, { age: 40, sex: 'm', days: 24, rx: () => [line('codeine', 60, 4, 3)] });
  assert.ok(share(long, (p) => p.toxSeen.opioid_withdrawal) > 0.5, 'long ' + share(long, (p) => p.toxSeen.opioid_withdrawal));
  assert.equal(share(brief, (p) => p.toxSeen.opioid_withdrawal), 0);
});

test('ibuprofen in a dehydrated child injures the kidney; in a well one it does not', () => {
  const ibu = (p) => [line('ibuprofen', 10 * p.weight, 3, 3)];
  const dry = cohort('watery_diarrhea', 200, { age: 1, days: 4, rx: ibu });
  const well = cohort('back_pain', 200, { age: 6, days: 4, rx: ibu });
  assert.ok(share(dry, (p) => p.toxSeen.kidney_injury) > 0.05, 'dehydrated ' + share(dry, (p) => p.toxSeen.kidney_injury));
  assert.equal(share(well, (p) => p.toxSeen.kidney_injury), 0);
});

test('benzathine penicillin: one injection cures strep throat and lingers for weeks', () => {
  const depot = cohort('strep_throat', 150, { age: 20, days: 21, tag: 'bz', rx: () => [line('benzylpenicillin', 1440, 1, 1, { route: 'inj', inj: { ka: 0.0017 } })] });
  assert.ok(share(depot, (p) => !p.conds.some((c) => c.id === 'strep_throat')) > 0.95);
  const p = depot[0];
  assert.ok(conc(p, 'benzylpenicillin', 21 * DAY) > 0.02, 'level at 3 weeks ' + conc(p, 'benzylpenicillin', 21 * DAY));
});

test('malaria: too little drug against a heavy infection breeds a resistant parasite in some', () => {
  // a hyperparasitaemic adult (~10^12.5 parasites) given a little chloroquine a day: partial suppression for days
  const heavy = (p) => { p.conds[0].P = 12.5; p.conds[0].mic.chloroquine = 1; };
  const low = cohort('malaria', 2000, { age: 25, sex: 'm', days: 4, setup: heavy, rx: () => [line('chloroquine', 75, 1, 3)] });
  const res = share(low, (p) => [...p.conds, ...p.healed].some((c) => c.res?.chloroquine));
  assert.ok(res > 0.001 && res < 0.1, 'resistance bred ' + res); // rare, as de novo resistance is
});

test('an injection in the clinic: needs a syringe, is charged, and an allergic patient reacts in front of you', async () => {
  const { buildContent } = await import('../js/core/content/index.js');
  const { makeInv, addItem } = await import('../js/core/inventory.js');
  const { newClinic } = await import('../js/core/clinic.js');
  const { startEncounter, injectNow, finishEncounter } = await import('../js/core/encounter.js');
  const C = buildContent();
  const G = { C, p: { inv: makeInv(20), coins: 0, skills: {} }, W: { time: 600, shelves: () => [] }, meta: { seed: 3, clinic: newClinic(), ledger: [], time: 600 }, stations: new Set(['hearth']) };
  Object.defineProperty(G.W, 'time', { get: () => G.meta.time });
  const p = person('strep_throat', 0, { age: 25, tag: 'enc', t: 600 });
  p.allergy = 'penicillin';
  G.meta.clinic.patients[p.id] = p;
  addItem(G.p.inv, C, 'benzathine_pen', 2);
  const enc = startEncounter(G, p.id);
  assert.equal(injectNow(G, enc, 'benzathine_pen', 1).ok, false, 'no syringe');
  addItem(G.p.inv, C, 'syringe', 1);
  const r = injectNow(G, enc, 'benzathine_pen', 1);
  assert.ok(r.ok && /welts|allergic shock/.test(r.text), r.text);
  const res = finishEncounter(G, enc);
  assert.ok(res.pay.total > C.items.get('benzathine_pen').price, 'the vial is charged');
  assert.equal(p.rx.filter((x) => x.route === 'inj').length, 1);
});

test('home remedies: families give teas of what grows near them; sent to gather, most find it, a few bring a lookalike', async () => {
  const { buildContent } = await import('../js/core/content/index.js');
  const { createRegion } = await import('../js/core/region.js');
  const { floraNear } = await import('../js/core/flora.js');
  const { gather, homeRemedyOnArrival, teaOf } = await import('../js/core/homecare.js');
  const { makeRng } = await import('../js/core/rng.js');
  const C = buildContent(), R = createRegion(7, C);
  const G = { C, W: { R, obj: (x, y) => (R.obj[y * R.N + x] ? R.oKeys[R.obj[y * R.N + x]] : null) } };
  const h = R.hamlets[0], near = floraNear(G, h.id).filter((s) => teaOf(C, s.id));
  const p = { hamlet: h.id, seed: 1 };
  const picks = Array.from({ length: 400 }, (_, i) => gather(G, p, near[0].id, makeRng(1, 'g', i)));
  const right = picks.filter((x) => x === near[0].id).length / 400, none = picks.filter((x) => !x).length / 400;
  assert.ok(right > 0.6 && right < 0.85, 'found the right plant ' + right);
  assert.ok(none > 0.1 && none < 0.3, 'found nothing ' + none);
  let home = 0;
  for (let i = 0; i < 300; i++) {
    const q = person('malaria', i, { tag: 'home', hamlet: h, age: 20 });
    q.hamlet = h.id;
    if (homeRemedyOnArrival(G, q)) home++;
  }
  assert.ok(home / 300 > 0.05 && home / 300 < 0.45, 'home remedies ' + home / 300); // only where something used for it grows near
});
