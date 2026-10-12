// Trade and the post: orders are paid when posted, arrive on the shelf days later, and wait when
// there is no room; traders' medicine can be falsified.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildContent } from '../js/core/content/index.js';
import { makeInv, count } from '../js/core/inventory.js';
import { placeOrder, deliverOrders, orderTotal, stock, CATALOGUE } from '../js/core/economy.js';
import { VENDOR } from '../js/core/content/vendors.js';
import { DAY } from '../js/core/time.js';

const C = buildContent();
function game(coins = 50) {
  const shelf = makeInv(20);
  const meta = { seed: 9, time: 10 * DAY + 9 * 60, ledger: [], trade: {} };
  return { C, meta, p: { coins, inv: makeInv(24) }, W: { get time() { return meta.time; }, shelves: () => [{ inv: shelf }] }, shelf };
}

test('an order is paid when posted and lands on the shelf 4–8 days later', () => {
  const G = game();
  const cart = { amox_250: 2, ors_packet: 1 };
  const r = placeOrder(G, cart);
  assert.ok(r.ok);
  assert.equal(G.p.coins, Math.round((50 - orderTotal(C, cart)) * 10) / 10);
  const days = (r.due - G.meta.time) / DAY;
  assert.ok(days >= CATALOGUE.days[0] - 1 && days <= CATALOGUE.days[1] + 1, 'due in ' + days);
  assert.equal(deliverOrders(G).length, 0, 'nothing before it is due');
  G.meta.time = r.due;
  assert.equal(deliverOrders(G).length, 1);
  assert.equal(count(G.shelf, 'amox_250'), 200);
  assert.equal(count(G.shelf, 'ors_packet'), 50);
  assert.equal(G.meta.orders.length, 0);
});
test('you cannot order what you cannot pay for; a parcel with no room waits a day', () => {
  const G = game(1);
  assert.equal(placeOrder(G, { amox_250: 1 }).ok, false);
  const H = game(500);
  const r = placeOrder(H, { para_500: 1 });
  H.shelf.slots.fill({ id: 'salt', n: 2000 });
  H.p.inv.slots.fill({ id: 'salt', n: 2000 });
  H.meta.time = r.due;
  deliverOrders(H);
  assert.equal(H.meta.orders.length, 1);
  assert.ok(H.meta.orders[0].due > r.due);
});
test('market tablets are sometimes fake; mission stores almost never', () => {
  const fakes = (v) => {
    let n = 0, bad = 0;
    for (let d = 0; d < 400; d++) for (const s of stock({ C, meta: { seed: 3, trade: {} } }, VENDOR.get(v), 'k' + d)) if (C.items.get(s.id).cat === 'medicine') { n++; if (s.q !== undefined && s.q < 0.8) bad++; }
    return bad / n;
  };
  const market = fakes('market'), stores = fakes('stores');
  assert.ok(market > 0.08 && market < 0.25, 'market ' + market);
  assert.ok(stores < 0.03, 'stores ' + stores);
});
