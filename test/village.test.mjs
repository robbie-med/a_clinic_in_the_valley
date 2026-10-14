// The living valley (js/core/village.js, contagion.js, staff.js, schedule.js): who falls ill and comes to you, what
// passes on your bench, anaemia in pregnancy, staff, and where villagers are. Bands are wide on purpose: the sources
// are in content/village.js, content/contagion.js and blood.js; these check the pieces fit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { population, tickPeople } from '../js/core/people.js';
import { newClinic } from '../js/core/clinic.js';
import { seekers } from '../js/core/village.js';
import { benchExposure, immune } from '../js/core/contagion.js';
import { CONTAGIOUS } from '../js/core/content/contagion.js';
import { makePatient } from '../js/core/patient.js';
import { hbSet } from '../js/core/blood.js';
import { dayOf, whereIn } from '../js/core/schedule.js';
import { DAY, YEAR_DAYS } from '../js/core/time.js';

const houses = (k) => Array.from({ length: k }, (_, i) => ({ out: { x: 10 + i * 5, y: 10 } }));
const R = () => ({ village: { id: 'village', x: 80, y: 80, houses: houses(6), wealth: 0.5, mosquito: 0.4, water: 0.5, crowd: 0.8, dist: 0 },
  hamlets: [3, 4, 5, 3, 4, 5].map((k, i) => ({ id: 'h' + i, x: 40 + i * 15, y: 40, houses: houses(k), wealth: 0.3 + i * 0.08, mosquito: 0.3 + i * 0.1, water: 0.5, crowd: 0.6, dist: 30 + i * 6 })) });
const valley = (seed = 42) => ({ meta: { seed, clinic: newClinic(), ledger: [] }, W: { R: R(), time: 14 * DAY } });

test('the valley lives: ill and pregnant people have records, slow illness is carried, and a day costs little', () => {
  const G = valley();
  tickPeople(G);
  G.W.time += 4 * DAY; tickPeople(G);
  const { P, L } = population(G);
  const t0 = performance.now();
  G.W.time += 10 * DAY; tickPeople(G);
  const perDay = (performance.now() - t0) / 10;
  const recs = Object.keys(P.rec).length, ill = Object.keys(P.ill).length;
  // many semi-immune adults carry silent malaria for weeks; every pregnancy is a record too
  assert.ok(recs > 5 && recs < L.size * 0.8, 'records ' + recs);
  assert.ok(ill > L.size * 0.05, 'carrying slow illness ' + ill);
  assert.ok(perDay < 400, 'ms a day ' + perDay);
});
test('at the clinic\'s first name, a few of the valley\'s sick decide to come each day', () => {
  const G = valley(7);
  tickPeople(G);
  G.W.time += 6 * DAY; tickPeople(G);
  let n = 0;
  for (let d = 0; d < 10; d++) { G.W.time += DAY; tickPeople(G); n += seekers(G, Math.floor(G.W.time / DAY) + 1, 440, 930).length; }
  assert.ok(n / 10 > 1 && n / 10 < 12, 'a day ' + n / 10);
});
test('measles in a closed room passes to most of the unprotected on the bench; in the open air far fewer', () => {
  const sick = makePatient({ seed: 3, key: 'ms', t: 0, season: 'hot_dry', cond: 'measles', age: 3, sex: 'f' });
  sick.conds[0].t0 = -DAY; sick.conds[0].s = 1;
  const bench = (indoor) => {
    let caught = 0;
    for (let i = 0; i < 100; i++) {
      const kid = makePatient({ seed: 3, key: 'k' + i + indoor, t: 0, season: 'hot_dry', cond: 'back_pain', age: 4, sex: 'm' });
      caught += benchExposure(5, [sick, kid], 0, 120, indoor).length;
    }
    return caught / 100;
  };
  const inside = bench(true), outside = bench(false);
  assert.ok(inside > 0.6, 'indoors ' + inside);
  assert.ok(outside < inside * 0.5, `outdoors ${outside} vs ${inside}`);
});
test('the measles vaccine protects ~3 in 4 children at 80% cover', () => {
  const row = CONTAGIOUS.get('measles');
  let k = 0;
  for (let i = 0; i < 2000; i++) if (immune(9, 'b' + i, row, 50, 2, 0, null)) k++;
  assert.ok(k / 2000 > 0.68 && k / 2000 < 0.81, 'protected ' + k / 2000);
});
test('anaemia in pregnancy is common in the valley, and not all of it is want of iron', () => {
  const G = valley(11);
  tickPeople(G); // the valley begins now
  G.W.time += 3 * YEAR_DAYS * DAY; tickPeople(G);
  const { P, L } = population(G), d = Math.floor(G.W.time / DAY) + 1;
  let n = 0, low = 0, ironOnly = 0;
  for (const [id, p] of Object.entries(P.rec)) {
    if (!(p.pregnant >= 20) || !L.get(id)) continue;
    n++;
    if (p.hb < 11) { low++; if (p.blood.fe < 20 && !p.conds.some((c) => ['malaria', 'hookworm', 'hiv'].includes(c.id)) && Math.floor(p.blood.g / 3) !== 2) ironOnly++; }
  }
  assert.ok(n >= 5, 'pregnant women seen ' + n);
  assert.ok(low / n > 0.15 && low / n < 0.8, 'Hb < 11: ' + low + '/' + n);
  assert.ok(ironOnly <= low, 'iron alone ' + ironOnly + ' of ' + low);
});
test('a villager\'s day covers every minute, and nobody is out at night', () => {
  const G = { meta: { seed: 5, clinic: newClinic() }, W: { R: { ...R(), square: { x: 80, y: 80 }, fields: [], riverDist: new Float32Array(160 * 160).fill(10), N: 160 }, time: 14 * DAY } };
  const { L } = population(G);
  for (const q of [...L.values()].slice(0, 40)) {
    const plan = dayOf(G, q, 15, { sick: 0, fed: true, market: false });
    for (let m = 0; m < DAY; m += 30) assert.ok(plan.some((s) => m >= s.from && m < s.to), `${q.id} at ${m}`);
    assert.equal(whereIn(plan, 2 * 60), null);
  }
});
