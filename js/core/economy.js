// economy.js — traders: when they are in the village, what they carry this visit, buying and selling.
// Stock is a pure function of (seed, vendor, visit); what you bought is remembered per visit.
import { VENDORS, VENDOR } from './content/vendors.js';
import { PLACEABLES } from './content/build.js';
import { makeRng, hash } from './rng.js';
import { DAY, day, minuteOfDay } from './time.js';
import { addItem, count, remove } from './inventory.js';
import { t, tc, msg, en, raw, thing } from './i18n.js';

/** An item unit as a word in the current language (g and ml stay symbols). */
export const unitWord = (u) => ({ app: tc('unit', 'app'), vial: tc('unit', 'vial'), ampoule: tc('unit', 'ampoule'), sachet: tc('unit', 'sachet'), dose: tc('unit', 'dose') }[u] ?? u);
/** The same, as a saved msg var (rendered later by tm()). */
const unitVar = (u) => (u === 'g' || u === 'ml' ? raw(u) : { $: u, ctx: 'unit' });
/** Vendor names as they read mid-sentence ("from the village shop"), as saved msg vars. */
const VENDOR_MID = { duka: msg('village shop'), market: msg('market day'), herbalist: msg('travelling herb seller'), peddler: msg('tool peddler'), stores: msg('mission medical stores') };
const vendorVar = (v) => VENDOR_MID[v.id] ?? en(v, 'name').toLowerCase();

/** Visits of a wandering vendor: [{ from: day, to: day }], deterministic per seed. */
export function visits(seed, v, uptoDay) {
  const out = [];
  if (!v.wander) return out;
  let d = 1 + (hash(seed, v.id.length, 1, 77) % v.wander[1]);
  for (let k = 0; d <= uptoDay + v.wander[1]; k++) {
    out.push({ from: d, to: d + v.stay - 1, k });
    d += v.stay + v.wander[0] + (hash(seed, k, v.id.length, 78) % (v.wander[1] - v.wander[0] + 1));
  }
  return out;
}

/** Is the vendor in the village now? Returns a visit key (for stock) or null. */
export function presence(seed, v, t) {
  const m = minuteOfDay(t), d = day(t);
  if (m < v.open[0] || m > v.open[1]) return null;
  if (v.fixed) return 'd' + d;
  if (v.every) return (d % v.every) === v.offset ? 'm' + d : null;
  const vis = visits(seed, v, d).find((x) => d >= x.from && d <= x.to);
  return vis ? 'w' + vis.k : null;
}
/** When does the vendor come next? (for the notice board) */
export function nextVisit(seed, v, t) {
  const d = day(t);
  if (v.fixed) return d;
  if (v.every) { for (let k = 0; k < v.every; k++) if (((d + k) % v.every) === v.offset) return d + k; }
  const vis = visits(seed, v, d + 20).find((x) => x.to >= d);
  return vis ? Math.max(d, vis.from) : null;
}

export const LOT = (it) => it.pack || (it.unit === 'g' ? (it.price * 100 >= 0.5 ? 100 : 500) : it.unit === 'ml' ? (it.price * 250 >= 0.5 ? 250 : 1000) : 1);
export const lotPrice = (it, mult) => Math.max(0.1, Math.round(it.price * LOT(it) * mult * 10) / 10);

/** This visit's goods: [{ id, n (lots), price, q }]. */
export function stock(G, v, key) {
  const { C, meta } = G;
  const rng = makeRng(meta.seed, 'stock', v.id, key);
  const bought = meta.trade?.[v.id + ':' + key] || {};
  const out = [];
  for (const [id, [a, b], mult] of v.sells) {
    const it = C.items.get(id);
    if (!it) continue;
    const amount = a + Math.floor(rng() * (b - a + 1));
    const lots = Math.floor(amount / LOT(it)) || (amount > 0 ? 1 : 0);
    const left = lots - (bought[id] || 0);
    // herbs from a trader: strength varies; sometimes it is not what they say
    let q = it.cat === 'herb' || it.cat === 'remedy' ? 0.55 + rng() * 0.8 : undefined;
    if (q !== undefined && v.adulterate && rng() < v.adulterate) q *= 0.2;
    // falsified (no drug at all) or substandard (too little) medicine: ~1 in 10 in low-income markets (WHO 2017)
    if (it.cat === 'medicine' && v.fakes && rng() < v.fakes) q = rng() < 0.5 ? 0 : 0.3 + rng() * 0.4;
    if (left > 0) out.push({ id, n: left, price: lotPrice(it, mult), q });
  }
  return out;
}

export function buy(G, v, key, id) {
  const { C, p, meta } = G;
  const row = stock(G, v, key).find((s) => s.id === id);
  if (!row) return { ok: false, why: t('Sold out.') };
  if (p.coins < row.price) return { ok: false, why: t('You need {n} sh.', { n: row.price }) };
  const it = C.items.get(id);
  const left = addItem(p.inv, C, id, LOT(it), { q: row.q, t: G.W.time });
  if (left) { if (left < LOT(it)) remove(p.inv, id, LOT(it) - left); return { ok: false, why: t('Your bag is full.') }; }
  p.coins = Math.round((p.coins - row.price) * 10) / 10;
  if (it.herb || it.plant) (p.known ||= {})[it.herb || it.plant] = 1;   // you have met the plant now
  meta.trade ||= {};
  const k = v.id + ':' + key;
  meta.trade[k] ||= {};
  meta.trade[k][id] = (meta.trade[k][id] || 0) + 1;
  const itemEn = en(it, 'name');
  meta.ledger.push({ t: G.W.time, kind: 'buy', text: `Bought ${itemEn}${it.unit ? ` (${LOT(it)} ${it.unit})` : ''} from the ${en(v, 'name').toLowerCase()}`,
    msg: it.unit ? msg('Bought {item} ({n} {unit}) from the {vendor}', { item: thing('item', it.id), n: LOT(it), unit: unitVar(it.unit), vendor: vendorVar(v) }) : msg('Bought {item} from the {vendor}', { item: thing('item', it.id), vendor: vendorVar(v) }),
    amount: -row.price });
  return { ok: true, price: row.price };
}

/** What a vendor pays for one lot of an item you carry (half its worth, if they buy that kind). */
export function offer(G, v, id) {
  const it = G.C.items.get(id);
  if (!it || !v.buys.includes(it.cat)) return null;
  return Math.max(0.1, Math.round(it.price * LOT(it) * 0.5 * 10) / 10);
}
export function sell(G, v, id) {
  const { C, p, meta } = G;
  const it = C.items.get(id);
  const price = offer(G, v, id);
  if (price === null) return { ok: false, why: t('They do not buy that.') };
  if (count(p.inv, id) < LOT(it)) return { ok: false, why: it.unit ? t('You need {n} {unit} to sell.', { n: LOT(it), unit: unitWord(it.unit) }) : t('You need {n} to sell.', { n: LOT(it) }) };
  remove(p.inv, id, LOT(it));
  p.coins = Math.round((p.coins + price) * 10) / 10;
  meta.ledger.push({ t: G.W.time, kind: 'sell', text: `Sold ${en(it, 'name')} to the ${en(v, 'name').toLowerCase()}`, msg: msg('Sold {item} to the {vendor}', { item: thing('item', it.id), vendor: vendorVar(v) }), amount: price });
  return { ok: true, price };
}

// ——— the catalogue: order by post from the city wholesaler. Paid when posted; the runner brings it to the
// clinic shelf in 4–8 days. Sealed stock, but now and then a falsified box gets through the supply chain.
export const CATALOGUE = { mult: 1.05, postage: 2, days: [4, 8], fakes: 0.03 };
// The town import house: dried herbs, seed and animal or mineral goods from the far traditions. Zone 1
// is the next district, zone 5 the other side of the world; the bill and the wait both follow it. DNA
// studies of the herbal trade keep finding the wrong species in the bag — about a quarter to a third of
// samples (Newmaster 2013; Ichim 2019) — and for antler and ginseng far more (materia.js `fake`).
export const IMPORT = { mult: 1.1, postage: 6, baseDays: 14, perZone: 7, adulterate: 0.3,
  ref: 'Newmaster SG et al. BMC Med 2013;11:222; Ichim MC. Front Pharmacol 2019;10:1227' };
const round1 = (n) => Math.round(n * 10) / 10;
export const catalogueItems = (C) => [...C.items.values()].filter((it) => it.cat === 'medicine' || it.cat === 'lab' || (it.cat === 'tool' && it.price >= 2) || (it.cat === 'build' && PLACE.get(it.id)?.post));
const PLACE = new Map(PLACEABLES.map((b) => [b.id, b]));
export const importItems = (C) => [...C.items.values()].filter((it) => it.import);
const multOf = (it) => (it.import ? IMPORT.mult : CATALOGUE.mult);
export const orderTotal = (C, cart) => {
  const lines = Object.entries(cart).filter(([, n]) => n > 0);
  const postage = lines.some(([id]) => C.items.get(id).import) ? IMPORT.postage : CATALOGUE.postage;
  return round1(lines.reduce((a, [id, n]) => a + lotPrice(C.items.get(id), multOf(C.items.get(id))) * n, 0) + postage);
};

/** Post an order. cart: { itemId: lots }. */
export function placeOrder(G, cart) {
  const { C, p, meta } = G;
  const lines = Object.entries(cart).filter(([, n]) => n > 0);
  if (!lines.length) return { ok: false, why: t('Nothing in the order.') };
  const total = orderTotal(C, Object.fromEntries(lines));
  if (p.coins < total) return { ok: false, why: t('The order comes to {n} sh with postage.', { n: total }) };
  meta.orders ||= [];
  meta.orderSeq = (meta.orderSeq || 0) + 1;
  const rng = makeRng(meta.seed, 'post', meta.orderSeq);
  const far = lines.reduce((z, [id]) => Math.max(z, C.items.get(id).import ? C.items.get(id).zone || 1 : 0), 0);
  const [a, b] = far ? [IMPORT.baseDays + IMPORT.perZone * far, IMPORT.baseDays + IMPORT.perZone * far + 10] : CATALOGUE.days;
  const due = (day(G.W.time) - 1 + a + Math.floor(rng() * (b - a + 1))) * DAY + 11 * 60;
  const goods = lines.map(([id, n]) => {
    const it = C.items.get(id);
    let q;
    if (it.cat === 'medicine' && rng() < CATALOGUE.fakes) q = rng() < 0.5 ? 0 : 0.3 + rng() * 0.4;
    else if (it.import && it.cat !== 'seed' && rng() < (it.fake ?? IMPORT.adulterate)) q = 0.05 + rng() * 0.25; // another species in the sack
    else if (it.cat === 'herb' || it.cat === 'remedy' || it.cat === 'materia') q = 0.6 + rng() * 0.7;           // batches vary
    return [id, n * LOT(it), q];
  });
  meta.orders.push({ n: meta.orderSeq, goods, due, total, posted: G.W.time });
  p.coins = round1(p.coins - total);
  meta.ledger.push({ t: G.W.time, kind: 'buy', text: `Posted order no. ${meta.orderSeq} to the ${far ? 'town import house' : 'city wholesaler'} (due about day ${day(due)})`,
    msg: far ? msg('Posted order no. {n} to the town import house (due about day {day})', { n: meta.orderSeq, day: day(due) }) : msg('Posted order no. {n} to the city wholesaler (due about day {day})', { n: meta.orderSeq, day: day(due) }),
    amount: -total });
  return { ok: true, total, due };
}

/** Parcels that have arrived go onto the first medicine shelf, then into your bag. Returns news. */
export function deliverOrders(G) {
  const news = [];
  const orders = G.meta.orders || [];
  for (const o of [...orders]) {
    if (G.W.time < o.due) continue;
    const shelf = G.W.shelves()[0]?.inv;
    o.goods = o.goods.map(([id, n, q]) => {
      const it = G.C.items.get(id);
      if (it.herb || it.plant) (G.p.known ||= {})[it.herb || it.plant] = 1;
      let left = shelf ? addItem(shelf, G.C, id, n, { q, t: G.W.time }) : n;
      if (left) left = addItem(G.p.inv, G.C, id, left, { q, t: G.W.time });
      return [id, left, q];
    }).filter(([, n]) => n > 0);
    if (!o.goods.length) { orders.splice(orders.indexOf(o), 1); news.push({ kind: 'post', text: t('The post runner brought order no. {n}. It is on the medicine shelf.', { n: o.n }) }); }
    else { o.due = G.W.time + DAY; news.push({ kind: 'post', text: t('The post runner came with order no. {n}, but there is no room on the shelf or in your bag. He will come back tomorrow.', { n: o.n }) }); }
  }
  return news;
}

export { VENDORS, VENDOR, DAY };
