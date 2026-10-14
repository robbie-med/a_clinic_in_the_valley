// crafting.js — making remedies and building parts. Inputs come from your bag; stations must be within
// reach; tools must be in your bag. The strength of what comes out depends on the plants that went in
// (each has its own content), how fresh they were, and how steady your hand is (herbal skill).
import { countSpec, removeSpec, remove, addItem, count } from './inventory.js';
import { makeRng } from './rng.js';
import { DAY, HOUR } from './time.js';
import { STATION_RANGE } from './content/build.js';
import { HERB } from './content/herbs.js';
import { t, getLang } from './i18n.js';

/** Lower-case a mid-sentence noun in English only (other scripts have no case, or other rules). */
const lc = (s) => (getLang() === 'en' ? String(s).toLowerCase() : s);

export const level = (xp) => Math.floor(Math.sqrt((xp || 0) / 12));
export function gainXp(p, skill, n) {
  const before = level(p.skills[skill]);
  p.skills[skill] = (p.skills[skill] || 0) + n;
  return level(p.skills[skill]) > before ? level(p.skills[skill]) : 0;
}
const hasTool = (G, tool) => !tool || count(G.p.inv, tool) > 0;

/** Why a recipe cannot be made right now (or null). */
export function blocker(G, r, times = 1) {
  const { C, p } = G;
  if (r.station && !G.stations.has(r.station)) return t('Needs a {station} within {n} steps.', { station: stationName(r.station), n: STATION_RANGE });
  if (r.tool && !hasTool(G, r.tool)) return t('Needs a {tool}.', { tool: lc(C.items.get(r.tool).name) });
  for (const [spec, n] of r.in) if (countSpec(p.inv, C, spec) < n * times) return t('Not enough {item}.', { item: specName(C, spec) });
  if (r.hours) {
    const jar = G.nearJar?.();
    if (!jar) return t('Needs a free steeping jar within reach.');
  }
  return null;
}
/** A station as a mid-sentence noun in the current language ("a hearth"). */
export const stationName = (s) => ({ hearth: t('hearth'), rack: t('drying rack'), jar: t('steeping jar'), bench: t('workbench'), kiln: t('kiln'), lab: t('laboratory bench'), analyser: t('blood counter') }[s] || s);
/** A herb's gathered part, any form ("white willow bark"), capitalized as a name: English from the fresh item's name. */
export function herbPartName(C, herbId) {
  const h = HERB.get(herbId);
  if (getLang() !== 'en' && h) return t('{herb} {part}', { herb: h.name, part: h.part });
  return C.items.get('fresh_' + herbId).name.split(' (')[0];
}
export const specName = (C, spec) => (spec.startsWith('#herb_') ? lc(herbPartName(C, spec.slice(6))) : (C.items.get(spec) ? lc(C.items.get(spec).name) : spec));

/** Effective potency of a stack now (fresh herbs wilt after two days). */
export function stackPotency(C, st, now) {
  const it = C.items.get(st.id);
  let q = st.q ?? 1;
  if (it?.form === 'fresh' && st.t !== undefined) q *= Math.max(0.3, 1 - 0.15 * Math.max(0, (now - st.t) / DAY - 2));
  if (it?.shelfDays && st.t !== undefined && (now - st.t) / DAY > it.shelfDays) q *= 0.5;
  return q;
}

/**
 * Make a recipe `times` times. Returns { ok, ev:[…], out:{id,n,q}, why }.
 * Timed recipes (soaks, tinctures) go into a steeping jar and come out later.
 */
export function make(G, r, times = 1) {
  const { C, p, W } = G;
  const why = blocker(G, r, times);
  if (why) return { ok: false, why };
  const now = W.time;
  // take the inputs, remembering how strong the herb parts were
  let qSum = 0, qW = 0;
  const inQ = {};
  for (const [spec, n] of r.in) {
    const need = n * times;
    if (!spec.startsWith('#')) { let k = 0, w = 0; for (const sl of p.inv.slots) if (sl?.id === spec) { k += (sl.q ?? 1) * sl.n; w += sl.n; } inQ[spec] = w ? k / w : 1; }
    if (spec.startsWith('#') || C.items.get(spec)?.cat === 'herb') {
      // weighted potency of what we take
      let left = need;
      const order = p.inv.slots.map((s, i) => [s, i]).filter(([s]) => s && (spec.startsWith('#') ? C.items.get(s.id).tags.includes(spec.slice(1)) : s.id === spec));
      for (const [s] of order) {
        if (!left) break;
        const k = Math.min(left, s.n);
        const w = k * (C.items.get(s.id).dryG || 1);
        qSum += stackPotency(C, s, now) * w; qW += w; left -= k;
      }
    }
    removeSpec(p.inv, C, spec, need);
  }
  const lv = level(p.skills.herbal);
  const rng = makeRng(G.meta.seed, 'craft', Math.floor(now), r.id);
  const gauss = Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
  let q = qW ? qSum / qW : 1;
  if (r.herb) q *= Math.exp(gauss * Math.max(0.06, 0.22 - lv * 0.02));       // method, heat, timing
  // glasswork: a first melt is cloudy, bubbled and brittle; a practised hand makes clearer glass (estimate). Slides
  // keep the quality of the glass they were drawn from.
  if (r.skill === 'glass') {
    const glassQ = r.out === 'slide' ? inQ.glass ?? 1 : 1;
    q = Math.min(1, Math.max(0.2, 0.35 + 0.1 * level(p.skills.glass) + 0.12 * gauss));
    if (r.out === 'slide') q = Math.min(q, glassQ + 0.1);
  }
  if (r.out === 'ors_sugar' || r.out === 'ors_cereal') {
    // salt measured by hand vs a level spoon — the classic danger of home ORS
    const spoons = count(p.inv, 'spoons') > 0;
    q = Math.exp(gauss * (spoons ? 0.08 : 0.4));
    if (!spoons && rng() < 0.06) q *= 2.6; // a heaped tablespoon instead of half a level teaspoon
  }
  const n = Math.round(r.yields * times * 10) / 10;
  const out = { id: r.out, n: Math.max(1, Math.round(n)), q: Math.round(q * 1000) / 1000 };
  const ev = [];
  if (r.hours) {
    const jar = G.nearJar();
    jar.st.brew = { out: out.id, n: out.n, q: out.q, readyAt: now + r.hours * HOUR, startedAt: now };
    W.setState(jar.x, jar.y, jar.st);
    const item = C.items.get(out.id).name;
    ev.push(['msg', r.hours >= 48 ? t('Steeping: {item} will be ready in {n} days.', { item, n: Math.round(r.hours / 24) }) : t('Steeping: {item} will be ready in {n} hours.', { item, n: r.hours })]);
  } else {
    const left = addItem(p.inv, C, out.id, out.n, { q: out.q, t: now });
    if (left) ev.push(['drop', out.id, left, out.q]);
    ev.push(['gain', out.id, out.n - left]);
  }
  G.meta.time += r.min * times;
  const skill = r.build ? 'build' : r.skill || (r.work ? 'build' : 'herbal');
  const lvUp = gainXp(p, skill, r.build || r.work ? 2 * times : 3 * times);
  if (lvUp) ev.push(['level', skill, lvUp]);
  ev.push(['sound', 'craft']);
  return { ok: true, ev, out };
}

/** Collect a finished brew from a jar. */
export function collectBrew(G, x, y) {
  const st = G.W.state(x, y);
  if (!st?.brew) return { ok: false, why: t('Nothing steeping.') };
  if (G.W.time < st.brew.readyAt) return { ok: false, why: t('Not ready — {n} hours to go.', { n: Math.ceil((st.brew.readyAt - G.W.time) / HOUR) }) };
  const left = addItem(G.p.inv, G.C, st.brew.out, st.brew.n, { q: st.brew.q, t: G.W.time });
  if (left) { st.brew.n = left; return { ok: false, why: t('Bag full.') }; }
  const out = st.brew;
  delete st.brew;
  G.W.setState(x, y, st);
  return { ok: true, out };
}
