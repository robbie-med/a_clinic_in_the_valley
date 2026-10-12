// The medicine behaves like medicine: untreated illness runs its course, the right treatment at the
// right dose beats none, too little or too short fails, too much poisons, and the same seed gives
// the same outcome. Outcome rates over many seeded patients must stay within broad, sensible bands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { simulate, HOUR } from '../js/core/disease.js';
import { conc, pkParams } from '../js/core/pk.js';
import { ACTIVE } from '../js/core/content/actives.js';

const DAY = 24 * HOUR;
function cohort(cond, n, { age, sex, days, rx, tag = '' }) {
  const r = { dead: 0, cured: 0, poisoned: 0 };
  for (let i = 0; i < n; i++) {
    const p = makePatient({ seed: 777, key: cond + tag + i, t: 0, season: 'rains', hamlet: { mosquito: 0.6, water: 0.5 }, cond, age, sex });
    if (rx) p.rx = rx(p);
    simulate(p, days * DAY);
    if (p.dead) { r.dead++; if (p.cause.startsWith('poisoned')) r.poisoned++; } else if (!p.conds.some((c) => c.id === cond)) r.cured++;
  }
  for (const k of Object.keys(r)) r[k] /= n;
  return r;
}
const quinine = (mgkg, days = 7) => (p) => [{ name: 'q', item: 'x', start: 0, amount: 1, perDay: 3, days, left: 99, counselled: true, actives: { quinine: mgkg * p.weight }, q: 1 }];
const ors = (na = 47) => (p) => [{ name: 'ors', item: 'o', start: 0, amount: 1000 / 6, perDay: 6, days: 5, left: 1e9, fluid: { na }, q: 1 }];

test('one-compartment PK matches the closed form for a single dose', () => {
  const p = makePatient({ seed: 1, key: 'pk', t: 0, season: 'rains', cond: 'back_pain', age: 40, sex: 'm' });
  p.doses.sys.quinine = [[0, 600]];
  const a = ACTIVE.get('quinine');
  const { F, ka, ke, V } = pkParams(p, a);
  for (const h of [1, 3, 8, 24]) {
    const expect = (F * 600 * ka) / (V * (ka - ke)) * (Math.exp(-ke * h) - Math.exp(-ka * h));
    assert.ok(Math.abs(conc(p, 'quinine', h * HOUR) - expect) < 1e-9, 'h=' + h);
  }
});
test('same seed, same course', () => {
  const run = () => { const p = makePatient({ seed: 5, key: 'det', t: 0, season: 'rains', cond: 'malaria', age: 3 }); p.rx = quinine(10)(p); simulate(p, 20 * DAY); return JSON.stringify(p.conds) + p.dead; };
  assert.equal(run(), run());
});
test('malaria: a full course of quinine beats a short one beats none; overdose poisons', () => {
  const none = cohort('malaria', 300, { age: 3, days: 30 });
  const full = cohort('malaria', 300, { age: 3, days: 30, rx: quinine(10) });
  const short = cohort('malaria', 300, { age: 3, days: 30, rx: quinine(10, 3) });
  const over = cohort('malaria', 300, { age: 3, days: 30, rx: quinine(25) });
  assert.ok(full.cured > 0.7, 'full course cures most: ' + full.cured);
  assert.ok(short.cured < full.cured * 0.3, 'short course mostly recrudesces: ' + short.cured);
  assert.ok(none.dead > full.dead, `untreated ${none.dead} vs treated ${full.dead}`);
  assert.ok(none.dead > 0.01 && none.dead < 0.2, 'untreated child malaria mortality plausible: ' + none.dead);
  assert.ok(over.poisoned > 0.08, 'overdose poisons: ' + over.poisoned);
  assert.ok(full.poisoned < 0.02, 'standard dose rarely poisons: ' + full.poisoned);
});
test('diarrhoea: rehydration drink prevents death from dehydration', () => {
  const none = cohort('watery_diarrhea', 300, { age: 1, days: 10 });
  const fluid = cohort('watery_diarrhea', 300, { age: 1, days: 10, rx: ors() });
  assert.ok(none.dead > 0.01 && none.dead < 0.15, 'untreated: ' + none.dead);
  assert.ok(fluid.dead < none.dead / 3, `ORS ${fluid.dead} vs none ${none.dead}`);
});
test('self-limiting and chronic illnesses behave', () => {
  assert.ok(cohort('common_cold', 100, { days: 14 }).cured > 0.95, 'colds pass');
  assert.equal(cohort('scabies', 60, { age: 8, days: 20 }).cured, 0, 'scabies does not cure itself');
  assert.equal(cohort('heart_failure', 60, { age: 70, days: 20 }).cured, 0, 'heart failure is chronic');
});
