// People, kept basic: the foetus takes what the mother's blood carries, births come out mostly well, and the
// valley's households grow at rural East African rates (UN World Population Prospects 2022: crude birth rate
// ~35–42 and death rate ~5–8 per 1000 a year in Uganda and Tanzania).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { simulate, HOUR } from '../js/core/disease.js';
import { markRisk, population, tickPeople } from '../js/core/people.js';
import { newClinic } from '../js/core/clinic.js';
import { DAY, YEAR_DAYS } from '../js/core/time.js';

const mother = (key, weeks) => {
  const p = makePatient({ seed: 11, key, t: 0, season: 'rains', cond: 'back_pain', age: 25, sex: 'f' });
  p.pregnant = weeks;
  return p;
};
const rx = (active, mg, perDay, days) => [{ name: active, item: 'x', start: 0, amount: 1, perDay, days, left: 999, counselled: true, actives: { [active]: mg }, q: 1 }];

test('a 200 000 IU vitamin A capsule in week 5 raises the odds of malformation; none in week 20', () => {
  const risk = (weeks, dose) => {
    let r = 0, n = 0;
    for (let i = 0; i < 20; i++) {
      const p = mother('va' + i, weeks);
      if (dose) p.rx = [{ name: 'vit A', item: 'x', start: 0, amount: 1, perDay: 1, days: 1, left: 1, counselled: true, actives: { vitamin_a: 60 }, q: 1 }];
      simulate(p, 3 * DAY); // ~4 gestational weeks on the compressed calendar (time.js COMPRESS)
      if (p.foetus) { r += markRisk(p.foetus, 'malformation'); n++; }
    }
    return r / n;
  };
  const base = risk(5, false), early = risk(5, true), late = risk(20, true);
  assert.ok(early > base * 1.15, `week 5: ${early} vs ${base}`);
  assert.equal(late, base, 'after the embryo is formed it does no such harm');
});
test('doxycycline after 16 weeks marks the teeth; started at 4 weeks it does not', () => {
  // a 7-day course spans ~9 gestational weeks on the compressed calendar, so the early course starts at week 4
  const teeth = (weeks) => { const p = mother('dx' + weeks, weeks); p.rx = rx('doxycycline', 100, 2, 7); simulate(p, 10 * DAY); return p.foetus?.harm.teeth || 0; };
  assert.ok(teeth(20) > 0.005, 'week 20: ' + teeth(20));
  assert.equal(teeth(4), 0);
});
test('a term pregnancy with nothing taken mostly ends in a live birth of normal weight', () => {
  let live = 0, normal = 0, n = 60;
  for (let i = 0; i < n; i++) {
    const p = mother('term' + i, 36);
    const b = simulate(p, 5 * 7 * DAY).find((e) => e.kind === 'birth');
    if (b) { live++; if (b.baby.bw >= 2.5) normal++; }
  }
  assert.ok(live / n > 0.95, 'live births ' + live);
  assert.ok(normal / live > 0.85, 'normal weight ' + normal + '/' + live);
});
test('the valley: households grow over 10 game years at rural East African rates; saves regenerate', () => {
  const houses = (k) => Array.from({ length: k }, () => ({}));
  const R = { village: { id: 'village', houses: houses(6) }, hamlets: [3, 4, 5, 3, 4, 5].map((k, i) => ({ id: 'h' + i, houses: houses(k) })) };
  const G = { meta: { seed: 42, clinic: newClinic() }, W: { R, time: 14 * DAY } };
  const n0 = population(G).L.size;
  let years = 0, sum = 0;
  for (let y = 1; y <= 10; y++) { G.W.time += YEAR_DAYS * DAY; tickPeople(G); sum += population(G).L.size; years++; }
  const { P, L } = population(G), mean = sum / years;
  const cbr = (P.stats.births / mean / years) * 1000, cdr = (P.stats.deaths / mean / years) * 1000;
  assert.ok(n0 > 400 && n0 < 900, 'people ' + n0);
  assert.ok(cbr > 28 && cbr < 50, 'crude birth rate ' + cbr);
  // Every illness now runs untreated in the valley (village.js) unless you treat it: with no health care at all, deaths
  // come near those of rural East Africa before clinics reached it (Uganda 1950–55 ~25 per 1000: UN World Population
  // Prospects 2022), above today's 5–8; drought years add a famine's toll. Births stay at rural rates.
  assert.ok(cdr > 4 && cdr < 35, 'crude death rate ' + cdr);
  assert.ok(L.size / n0 > 0.85 && L.size / n0 < 1.6, `grew ${n0} → ${L.size}`);
  // a save holds only the diff; loading regenerates the seeded people and lays the diff over them
  const saved = JSON.parse(JSON.stringify(G.meta.clinic));
  assert.ok(Object.keys(saved.pop.diff).length < L.size * 1.2, 'diff ' + Object.keys(saved.pop.diff).length);
  const G2 = { meta: { seed: 42, clinic: saved }, W: G.W };
  assert.deepEqual([...population(G2).L.keys()].sort(), [...L.keys()].sort());
});
test('a save and reload changes nothing about who lives, dies, conceives or walks in', async () => {
  const { drawResident } = await import('../js/core/people.js');
  const houses = (k) => Array.from({ length: k }, () => ({}));
  const R = { village: { id: 'village', houses: houses(6) }, hamlets: [3, 4, 5].map((k, i) => ({ id: 'h' + i, houses: houses(k) })) };
  const run = (reloadAt) => {
    let G = { meta: { seed: 7, clinic: newClinic() }, W: { R, time: 14 * DAY } };
    for (let y = 1; y <= 6; y++) {
      G.W.time += YEAR_DAYS * DAY; tickPeople(G);
      if (y === reloadAt) G = { meta: JSON.parse(JSON.stringify(G.meta)), W: G.W };
    }
    const { L } = population(G);
    return JSON.stringify([[...L.keys()].sort(), [...L.values()].map((q) => q.conc ?? null).sort(), drawResident(G, 'h1', 'k1')?.id]);
  };
  assert.equal(run(3), run(0));
});
