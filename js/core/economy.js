// economy.js — traders: when they are in the village, what they carry this visit, buying and selling.
// Stock is a pure function of (seed, vendor, visit); what you bought is remembered per visit.
import { VENDORS, VENDOR } from './content/vendors.js';
import { makeRng, hash } from './rng.js';
import { DAY, day, minuteOfDay } from './time.js';
import { addItem, count, remove } from './inventory.js';

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

export const LOT = (it) => (it.unit === 'g' ? (it.price * 100 >= 0.5 ? 100 : 500) : it.unit === 'ml' ? (it.price * 250 >= 0.5 ? 250 : 1000) : 1);
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
    if (left > 0) out.push({ id, n: left, price: lotPrice(it, mult), q });
  }
  return out;
}

export function buy(G, v, key, id) {
  const { C, p, meta } = G;
  const row = stock(G, v, key).find((s) => s.id === id);
  if (!row) return { ok: false, why: 'Sold out.' };
  if (p.coins < row.price) return { ok: false, why: `You need ${row.price} sh.` };
  const it = C.items.get(id);
  const left = addItem(p.inv, C, id, LOT(it), { q: row.q, t: G.W.time });
  if (left) { if (left < LOT(it)) remove(p.inv, id, LOT(it) - left); return { ok: false, why: 'Your bag is full.' }; }
  p.coins = Math.round((p.coins - row.price) * 10) / 10;
  meta.trade ||= {};
  const k = v.id + ':' + key;
  meta.trade[k] ||= {};
  meta.trade[k][id] = (meta.trade[k][id] || 0) + 1;
  meta.ledger.push({ t: G.W.time, kind: 'buy', text: `Bought ${it.name}${it.unit ? ` (${LOT(it)} ${it.unit})` : ''} from the ${v.name.toLowerCase()}`, amount: -row.price });
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
  if (price === null) return { ok: false, why: 'They do not buy that.' };
  if (count(p.inv, id) < LOT(it)) return { ok: false, why: `You need ${LOT(it)}${it.unit ? ' ' + it.unit : ''} to sell.` };
  remove(p.inv, id, LOT(it));
  p.coins = Math.round((p.coins + price) * 10) / 10;
  meta.ledger.push({ t: G.W.time, kind: 'sell', text: `Sold ${it.name} to the ${v.name.toLowerCase()}`, amount: price });
  return { ok: true, price };
}

export { VENDORS, VENDOR, DAY };
