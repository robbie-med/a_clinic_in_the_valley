// homecare.js — what families do themselves: a tea of something gathered near home, before they come to you
// (they may still be giving it) and after, if you send them to gather it. The plant acts through its real
// compounds like any remedy; folk use only decides what people reach for. Now and then they pick a lookalike.
import { makeRng } from './rng.js';
import { HOUR } from './time.js';
import { floraNear, folkUses, lookalikes } from './flora.js';
import { HERB } from './content/herbs.js';
import { ACTIVE } from './content/actives.js';
import { msg, en } from './i18n.js';

// Estimates: a large share of rural patients try plant medicine at home before a clinic, and wild plants are
// misidentified now and then. No single study fits this valley; these are round middle values.
export const HOME_REMEDY = 0.4, MISPICK = 0.1, FIND = 0.8;
const CUP = 250;

/** The tea a family makes of a species: the item id (infusion, else decoction), or null if it is not drunk. */
export function teaOf(C, herbId) {
  const h = HERB.get(herbId);
  const m = (h?.methods || []).find((x) => x === 'infusion' || x === 'decoction');
  return m && C.items.has(m + '_' + herbId) ? m + '_' + herbId : null;
}

/** Someone goes to gather `herbId` near home. Returns the species they actually bring, or null. */
export function gather(G, p, herbId, rng) {
  const near = floraNear(G, p.hamlet);
  const here = near.some((s) => s.id === herbId);
  if (here && rng() < FIND) {
    if (rng() >= MISPICK) return herbId;
    const alike = lookalikes(herbId).filter((id) => near.some((s) => s.id === id));
    return alike.length ? alike[Math.floor(rng() * alike.length)] : herbId;
  }
  // not growing near home: they bring back whatever looks like it, or nothing
  const alike = lookalikes(herbId).filter((id) => near.some((s) => s.id === id));
  return alike.length && rng() < 0.5 ? alike[Math.floor(rng() * alike.length)] : null;
}

/** Put a home tea on the patient: a cup three times a day. `meant` is what they believe it is. */
export function giveTea(G, p, herbId, meant, start, days, pastDoses = 0) {
  const item = teaOf(G.C, herbId);
  if (!item) return null;
  const it = G.C.items.get(item), q = 0.5 + makeRng(p.seed, 'teaq', herbId)() * 0.8; // a wild batch, unknown strength
  const herb = en(HERB.get(meant), 'name'); // English: the rx is saved
  const name = `${herb} tea (gathered at home)`, label = msg('{herb} tea (gathered at home)', { herb }); // show tm(rx.label ?? rx.name)
  // doses already taken before they reached you, so the levels (and any poisoning) are there on arrival
  for (let k = 1; k <= pastDoses; k++) {
    const td = start - k * 8 * HOUR;
    for (const [id, per] of Object.entries(it.actives || {})) {
      const a = ACTIVE.get(id), mg = per * CUP * q;
      if (a.channel === 'systemic') (p.doses.sys[id] ||= []).push([td, mg]);
      else if (a.channel === 'gut') p.doses.gut.push([td, id, mg]);
    }
  }
  const rx = { item, name, label, q, left: CUP * 3 * days, amount: CUP, perDay: 3, days, start, route: 'oral', actives: it.actives, home: herbId, meant };
  p.rx.push(rx);
  return rx;
}

/** On arrival: has the family already been giving something from near home for this illness? */
export function homeRemedyOnArrival(G, p) {
  const rng = makeRng(p.seed, 'home');
  if (rng() >= HOME_REMEDY) return null;
  const near = floraNear(G, p.hamlet).filter((s) => folkUses(s.id).conditions.includes(p.mainCond) && teaOf(G.C, s.id));
  if (!near.length) return null;
  const meant = near[Math.floor(rng() * Math.min(3, near.length))].id; // one of the nearest that people use for it
  const got = rng() < MISPICK ? (lookalikes(meant).find((id) => floraNear(G, p.hamlet).some((s) => s.id === id) && teaOf(G.C, id)) || meant) : meant;
  return giveTea(G, p, got, meant, p.t, 5, Math.min(6, Math.floor((p.since || 24) / 8)));
}
