// schedule.js — where each villager is at any minute of the day, so the ones in view can be drawn (js/game/scene.js).
// Pure, and a function of (seed, person, day, what their life is now): nobody is moved off-screen, nothing is saved.
// A day: asleep at home; up at dawn to fetch water (women and girls, mostly) from the well or the river; out to the
// family's field in the farming months, or to the bush for firewood; home at midday to cook and eat (only if there is
// food: a hungry house lights no fire); the market square on market day; the yard in the evening. The sick stay in.
import { population, hamletRow, householdKey, weeksOf } from './people.js';
import { hashf, strHash, STREAM } from './rng.js';
import { DAY, YEAR_DAYS, day, minuteOfDay } from './time.js';
import { seasonOf } from './food.js';
import { VENDOR } from './content/vendors.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const r = (seed, id, d, k) => hashf(seed, strHash(id), d, STREAM.sched * 16 + k);
// walking speed in tiles a game minute: the scene's villagers walk 2.6 tiles a real second, a game minute is 0.45 s
export const WALK = 1.15;

/** Spots in a settlement: the door of a house, the well (village) or the river (hamlets), a field tile, the bush. */
function spots(G, q) {
  const R = G.W.R, h = hamletRow(R, q.h), seed = G.meta.seed;
  const houses = h.houses?.length ? h.houses : R.village.houses;
  const house = houses[q.hh % houses.length];
  const door = house ? { x: house.out.x, y: house.out.y } : { x: h.x, y: h.y };
  const water = h.id === 'village' ? { x: R.square.x + 1, y: R.square.y + 1 } : nearRiver(G, h);
  const fields = (R.fields || []).filter((f) => f.s === h.id);
  const f = fields.length ? fields[Math.floor(hashf(seed, strHash(householdKey(q)), 0, 77) * fields.length)] : null;
  const field = f ? { x: f.x + Math.floor(hashf(seed, strHash(q.id), 1, 77) * f.w), y: f.y + Math.floor(hashf(seed, strHash(q.id), 2, 77) * f.h) } : { x: h.x + 8, y: h.y + 8 };
  const a = hashf(seed, strHash(householdKey(q)), 3, 77) * Math.PI * 2;
  const bush = { x: Math.round(h.x + Math.cos(a) * 16), y: Math.round(h.y + Math.sin(a) * 16) };
  const market = { x: R.square.x - 2 + Math.floor(hashf(seed, strHash(q.id), 4, 77) * 5), y: R.square.y - 1 + Math.floor(hashf(seed, strHash(q.id), 5, 77) * 3) };
  return { door, water, field, bush, market };
}
const riverCache = new WeakMap();
/** The nearest river bank to a hamlet (computed once per region). */
function nearRiver(G, h) {
  const R = G.W.R;
  let m = riverCache.get(R);
  if (!m) riverCache.set(R, (m = new Map()));
  if (m.has(h.id)) return m.get(h.id);
  let best = { x: h.x, y: h.y }, bd = 1e9;
  for (let dy = -25; dy <= 25; dy++) for (let dx = -25; dx <= 25; dx++) {
    const x = h.x + dx, y = h.y + dy;
    if (x < 0 || y < 0 || x >= R.N || y >= R.N) continue;
    const rd = R.riverDist[y * R.N + x];
    if (rd >= 2.6 && rd < 4 && dx * dx + dy * dy < bd) { bd = dx * dx + dy * dy; best = { x, y }; }
  }
  m.set(h.id, best);
  return best;
}

/**
 * A person's day: [{ from, to (minutes of the day), at: {x,y} | null (indoors), act }], with walking legs between
 * places (act 'walk', from → to spots). ctx: { sick (0..1), fed (household eats), market (market day) }.
 */
export function dayOf(G, q, d, ctx) {
  const seed = G.meta.seed, age = (d - q.born) / YEAR_DAYS, S = spots(G, q), season = seasonOf(d);
  if (ctx.sick > 0.5 || age < 1) return [{ from: 0, to: DAY, at: null, act: 'home' }];
  const plan = [];
  const jitter = (k, span) => Math.floor(r(seed, q.id, d, k) * span);
  let t = 6 * 60 + jitter(1, 40), where = S.door;
  const go = (to, act, until) => {
    const dist = Math.hypot(to.x - where.x, to.y - where.y), walk = Math.ceil(dist / WALK);
    if (walk > 0) { plan.push({ from: t, to: t + walk, a: where, b: to, act: 'walk' }); t += walk; }
    if (until > t) plan.push({ from: t, to: until, at: to, act });
    t = Math.max(t, until); where = to;
  };
  plan.push({ from: 0, to: t, at: null, act: 'sleep' });
  const female = q.sex === 'f', child = age < 13, adult = age >= 15 && age < 65;
  // water first: women and girls mostly (WHO/UNICEF JMP 2017: women and girls fetch water in ~8 of 10 households)
  if ((female && age >= 8) || (child && age >= 8 && r(seed, q.id, d, 2) < 0.3)) go(S.water, 'water', t + 20);
  go(S.door, 'yard', t + 15);
  const farming = season !== 'hot_dry'; // sowing and weeding in the rains, the harvest in the cool dry months
  const morning = (adult || (age >= 10 && r(seed, q.id, d, 3) < 0.5)) ? (ctx.market && r(seed, q.id, d, 4) < 0.35 ? 'market' : farming ? 'field' : r(seed, q.id, d, 5) < 0.4 ? 'bush' : 'yard') : 'yard';
  go(S[morning === 'market' ? 'market' : morning === 'field' ? 'field' : morning === 'bush' ? 'bush' : 'door'], morning, 12 * 60 + jitter(6, 30));
  go(S.door, ctx.fed ? 'cook' : 'yard', 13 * 60 + 30 + jitter(7, 30));
  const afternoon = morning === 'market' ? 'market' : morning === 'field' && adult ? 'field' : 'yard';
  go(S[afternoon === 'field' ? 'field' : afternoon === 'market' ? 'market' : 'door'], afternoon, 17 * 60 + jitter(8, 40));
  go(S.door, ctx.fed ? 'cook' : 'yard', 19 * 60 + jitter(9, 60));
  plan.push({ from: t, to: DAY, at: null, act: 'sleep' });
  return plan;
}

/** Where someone is at minute m of their day: { x, y, act } (tile centre coordinates), or null indoors. */
export function whereIn(plan, m) {
  const seg = plan.find((s) => m >= s.from && m < s.to) || plan[plan.length - 1];
  if (seg.act === 'walk') {
    const f = clamp((m - seg.from) / Math.max(1, seg.to - seg.from), 0, 1);
    return { x: seg.a.x + (seg.b.x - seg.a.x) * f + 0.5, y: seg.a.y + (seg.b.y - seg.a.y) * f + 0.5, act: 'walk', goal: seg.b };
  }
  return seg.at ? { x: seg.at.x + 0.5, y: seg.at.y + 0.5, act: seg.act } : null;
}

/**
 * Everyone out and about now within a box of tiles (the camera's view), nearest the centre first: [{ id, x, y, act }].
 * Leaves out the clinic's patients (the scene walks them itself). Plans are cached per day.
 */
const planCache = new WeakMap();
export function villagersIn(G, box, now = G.W.time) {
  const { P, L } = population(G), d = day(now), m = minuteOfDay(now), cl = G.meta.clinic;
  let C = planCache.get(P);
  if (!C || C.d !== d) planCache.set(P, (C = { d, plans: new Map() }));
  const market = VENDOR.get('market') && (d % VENDOR.get('market').every) === VENDOR.get('market').offset;
  const out = [];
  for (const q of L.values()) {
    if (q.held) continue;
    let plan = C.plans.get(q.id);
    if (!plan) {
      const rec = P.rec[q.id], sick = Math.max(0, ...(rec?.conds || []).map((c) => c.s || 0));
      const hh = P.hh[householdKey(q)];
      plan = dayOf(G, q, d, { sick, fed: !hh || hh.r > 0.6, market, pregnant: q.conc != null ? weeksOf(q, d) : 0 });
      C.plans.set(q.id, plan);
    }
    const w = whereIn(plan, m);
    if (!w || w.x < box.x0 || w.y < box.y0 || w.x > box.x1 || w.y > box.y1) continue;
    out.push({ id: q.id, ...w });
  }
  const cx = (box.x0 + box.x1) / 2, cy = (box.y0 + box.y1) / 2;
  return out.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy));
}
