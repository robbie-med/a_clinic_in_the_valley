// Households and their food (js/core/food.js): an ordinary year feeds them; a failed harvest brings the hungry months.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { householdDay, newHousehold, rainOf, priceMult, yday } from '../js/core/food.js';
import { kcalNeed } from '../js/core/content/food.js';
import { YEAR_DAYS } from '../js/core/time.js';

const family = () => [{ age: 32, sex: 'm' }, { age: 28, sex: 'f' }, { age: 9, sex: 'f' }, { age: 5, sex: 'm' }, { age: 2, sex: 'f' }].map((m) => ({ ...m, weeks: 0, lact: false, sick: 0, kgRel: 1, bf: false }));
const kYear = (ms) => ms.reduce((a, m) => a + kcalNeed(m.age, m.sex), 0) * 365;
/** A seed whose year 1 rains are as asked. */
function seedWith(test) { for (let s = 1; s < 5000; s++) if (test(rainOf(s, 1))) return s; throw new Error('no seed'); }

function year(seed, wealth) {
  const ms = family(), hh = newHousehold(seed, 'v.0', wealth, 1, kYear(ms));
  const rs = [];
  for (let d = 2; d <= 2 + 3 * YEAR_DAYS; d++) { householdDay(hh, ms, { seed, d, key: 'v.0' }); if (d > 1 + YEAR_DAYS * 2) rs.push({ d, r: hh.r }); }
  return rs;
}
test('in ordinary years a household eats about what it needs', () => {
  const seed = seedWith((r) => r > 0.85 && r < 1.1);
  const rs = year(seed, 0.5), mean = rs.reduce((a, x) => a + x.r, 0) / rs.length;
  assert.ok(mean > 0.9 && mean < 1.1, 'mean ' + mean);
});
test('a failed harvest eats into the reserves; two in a row leave a poor household hungry', () => {
  const run = (seed, years) => {
    const ms = family(), hh = newHousehold(seed, 'p', 0.1, 1, kYear(ms), 5), out = [];
    for (let d = 2; d <= (years + 1) * YEAR_DAYS; d++) { householdDay(hh, ms, { seed, d, key: 'p' }); out.push({ d, r: hh.r, cass: hh.cass, cash: hh.cash }); }
    return out;
  };
  // the crop of year y is lifted on day 1 of year y + 1 and eaten through it
  const once = seedWith((r) => r < 0.45 && rainOf(0, 0) >= 0); // year 1 fails
  const a = run(once, 2), peak = Math.max(...a.filter((x) => x.d <= 2 * YEAR_DAYS).map((x) => x.cass));
  const low = Math.min(...a.filter((x) => x.d > 2 * YEAR_DAYS).map((x) => x.cass));
  assert.ok(low < peak * 0.7, `the drought year digs into the cassava: ${low} of ${peak}`);
  let twice = 1; while (!(rainOf(twice, 1) < 0.5 && rainOf(twice, 2) < 0.5)) twice++;
  const c = run(twice, 3), lean = c.filter((x) => x.d > 3 * YEAR_DAYS + 20);
  const r = lean.reduce((s0, x) => s0 + x.r, 0) / lean.length;
  assert.ok(r < 0.9, 'after two failed harvests the ration is ' + r);
});
test('grain costs most in the hungry season and after a drought', () => {
  const ok = seedWith((r) => r > 0.85 && r < 1.1), bad = seedWith((r) => r < 0.45);
  assert.ok(priceMult(ok, YEAR_DAYS + 38) > priceMult(ok, YEAR_DAYS + 2));
  assert.ok(priceMult(bad, 2 * YEAR_DAYS + 10) > priceMult(ok, 2 * YEAR_DAYS + 10)); // year 2 eats year 1's crop
});
test('an empty house forages before it goes without, and food you give is eaten first', () => {
  const seed = seedWith((r) => r > 0.85 && r < 1.1), ms = family();
  const empty = () => Object.assign(newHousehold(seed, 'e', 0.2, 1, kYear(ms), 5), { maize: 0, beans: 0, cass: 0, cash: 0, chick: 0, goat: 0 });
  const a = empty(), b = empty(), c = empty();
  const wild = { kcal: 30000, dens: { fe: 60, haem: 0, folate: 1.5 } };
  householdDay(a, ms, { seed, d: 12, key: 'e' });
  householdDay(b, ms, { seed, d: 12, key: 'e', wild });
  c.gift = { kcal: 40000, fe: 200, haem: 0, folate: 2 };
  householdDay(c, ms, { seed, d: 12, key: 'e', wild });
  assert.ok(b.r > a.r, `foraging ${b.r} vs none ${a.r}`);
  assert.ok(b.dens.fe > a.dens.fe || a.r === 0, 'wild leaves bring iron');
  assert.ok(c.r > b.r, `a gift ${c.r} vs foraging alone ${b.r}`);
});
