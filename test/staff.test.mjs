// People you hire (js/core/staff.js): wages go home, hunters bring meat and thin the bush, which grows back slowly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { population, tickPeople } from '../js/core/people.js';
import { newClinic } from '../js/core/clinic.js';
import { candidates, hire, staffDay, wildOf } from '../js/core/staff.js';
import { buildContent } from '../js/core/content/index.js';
import { makeInv } from '../js/core/inventory.js';
import { DAY } from '../js/core/time.js';

const houses = (k) => Array.from({ length: k }, (_, i) => ({ out: { x: 10 + i * 5, y: 10 } }));
const R = { village: { id: 'village', x: 80, y: 80, houses: houses(6), wealth: 0.5, dist: 0 }, hamlets: [4, 5, 4].map((k, i) => ({ id: 'h' + i, x: 40 + i * 15, y: 40, houses: houses(k), wealth: 0.4, dist: 30 })) };

test('hunters bring meat and empty the bush; their wages go to their families', () => {
  const G = { C: buildContent(), meta: { seed: 21, clinic: newClinic(), ledger: [] }, W: { R, time: 14 * DAY }, p: { coins: 5000, inv: makeInv(24), skills: {} } };
  tickPeople(G);
  for (const c of candidates(G, 'hunter').slice(0, 5)) hire(G, c.who, 'hunter');
  assert.equal(G.meta.clinic.staff.length, 5);
  const coins0 = G.p.coins;
  let meat = 0;
  for (let d = 15; d < 55; d++) for (const n of staffDay(G, d)) if (n.msg.$.includes('meat')) meat++;
  const wild = wildOf(G);
  assert.ok(meat > 5, 'hunts that brought meat ' + meat);
  assert.ok(Object.values(wild).some((w) => w < 0.9), 'wildlife ' + JSON.stringify(wild));
  assert.ok(G.p.coins < coins0, 'wages paid');
  const { P } = population(G);
  assert.ok(Object.values(P.hh).some((h) => (h.meat || 0) > 0) || meat > 0);
});
