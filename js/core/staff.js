// staff.js — people of the valley you hire: a hunter, a herb gatherer, a laboratory assistant. Pure. They are
// residents (people.js) with their own households: their wage goes home and feeds the family (food.js), their days away
// from the field cost the farm, they fall ill like anyone, and they get better at the work by doing it.
//   cl.staff = [{ who, role, wage, since, skill (0..1), n (days worked or slides read), task, unpaid }]
import { population, personNow, hamletRow, householdKey } from './people.js';
import { recordFor } from './village.js';
import { addItem } from './inventory.js';
import { plantYield } from './actions.js';
import { lookalikes } from './flora.js';
import { HERB } from './content/herbs.js';
import { DAY, YEAR_DAYS, day } from './time.js';
import { hashf, strHash, STREAM, makeRng } from './rng.js';
import { t, msg, person, en } from './i18n.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const roll = (seed, id, d, k) => hashf(seed, strHash(id), d, STREAM.staff * 10 + k);

// Wages a game day, in shillings: a little above casual farm work (content/food.js WAGE), more for the reading
// assistant who must be literate and careful (estimates).
export const ROLES = {
  hunter: { wage: 4, ages: [16, 50] },
  gatherer: { wage: 3, ages: [12, 60] },
  lab: { wage: 6, ages: [16, 45] },
};
// Wildlife the hunters live on, by habitat, as a share of what the land can carry: regrows ~half its gap a game year
// (logistic; an estimate), so a valley over-hunted is a valley without meat for years.
const WILD = ['forest', 'scrub', 'swamp', 'highland'];
export const wildOf = (G) => (G.meta.wild ||= Object.fromEntries(WILD.map((h) => [h, 1])));

/** Who would take the work: six of the valley's able people, best suited first (their own aptitude, a literate
 *  young person for the lab). */
export function candidates(G, role) {
  const { P, L } = population(G), d = day(G.W.time), R = ROLES[role], cl = G.meta.clinic;
  const out = [];
  for (const q of L.values()) {
    const age = (d - q.born) / YEAR_DAYS;
    if (age < R.ages[0] || age >= R.ages[1] || q.held || P.rec[q.id] || (cl.staff || []).some((s) => s.who === q.id)) continue;
    out.push({ q, age, apt: aptitude(G, q, role, age) });
  }
  return out.sort((a, b) => b.apt - a.apt || a.q.id.localeCompare(b.q.id)).slice(0, 6).map(({ q, age, apt }) => ({ who: q.id, name: personNow(G, q, G.W.time).name, age: Math.floor(age), hamlet: hamletRow(G.W.R, q.h).name, apt }));
}
/** How suited someone is, 0..1: their own makings; reading slides favours the young (who went to school). */
function aptitude(G, q, role, age) {
  const u = makeRng(G.meta.seed, 'aptitude', q.id, role)();
  return clamp(0.15 + 0.5 * u + (role === 'lab' ? 0.2 * clamp((35 - age) / 20, 0, 1) : 0) + (role === 'hunter' && q.sex === 'm' ? 0.1 : 0), 0, 0.85);
}
export function hire(G, who, role) {
  const cl = G.meta.clinic, { L } = population(G), q = L.get(who);
  if (!q || (cl.staff ||= []).some((s) => s.who === who)) return { ok: false };
  const apt = aptitude(G, q, role, (day(G.W.time) - q.born) / YEAR_DAYS);
  cl.staff.push({ who, role, wage: ROLES[role].wage, since: day(G.W.time), skill: Math.round(apt * 0.6 * 100) / 100, n: 0, task: null, unpaid: 0 });
  const name = personNow(G, q, G.W.time).name;
  G.meta.ledger.push({ t: G.W.time, kind: 'note', text: `Hired ${name} (${role}).`, msg: msg('Hired {name} ({role}).', { name: person(name), role: roleMsg(role) }) });
  return { ok: true };
}
export function dismiss(G, who) {
  const cl = G.meta.clinic;
  cl.staff = (cl.staff || []).filter((s) => s.who !== who);
}
export const roleMsg = (role) => ({ hunter: msg('hunter'), gatherer: msg('herb gatherer'), lab: msg('laboratory assistant') }[role]);

/**
 * A working day for everyone you employ (clinic.js tickHome, once a day). Pays wages from your coins into their
 * household's money (unpaid three days, they leave); the hunter brings meat (half to his own pot, half to your
 * shelf), the gatherer the plant you asked for (sometimes a lookalike, less as she learns), and each grows in skill.
 * Returns news.
 */
export function staffDay(G, d) {
  const cl = G.meta.clinic, { P, L } = population(G), seed = G.meta.seed, news = [];
  const wild = wildOf(G);
  for (const h of WILD) wild[h] = clamp(wild[h] + (0.5 / YEAR_DAYS) * wild[h] * (1 - wild[h]) + 0.0005, 0, 1); // regrowth
  for (const s of [...(cl.staff || [])]) {
    const q = L.get(s.who);
    const name = q ? personNow(G, q, G.W.time).name : '';
    if (!q) { dismiss(G, s.who); news.push({ kind: 'staff', msg: msg('One of your staff has died.') }); continue; }
    // wages: from your coins into their family's money
    const hh = P.hh[householdKey(q)];
    if (G.p.coins >= s.wage) { G.p.coins = Math.round((G.p.coins - s.wage) * 10) / 10; if (hh) hh.cash += s.wage; s.unpaid = 0; cl.wages = (cl.wages || 0) + s.wage; }
    else if (++s.unpaid >= 3) { dismiss(G, s.who); news.push({ kind: 'staff', msg: msg('{name} has gone back to the fields: three days without pay.', { name: person(name) }) }); continue; }
    const body = q.held ? cl.patients[q.held] : P.rec[q.id];
    if (body?.conds?.some((c) => (c.s || 0) > 0.4)) continue; // too ill to work today
    const learn = () => { s.n++; s.skill = Math.round(clamp(s.skill + (1 - s.skill) * 0.015, 0, 0.95) * 1000) / 1000; };
    if (s.role === 'hunter') {
      const hab = WILD[Math.floor(roll(seed, s.who, d, 1) * WILD.length)], w = wild[hab];
      // a day's hunting with snares, a bow or a dog: often nothing (estimates)
      if (roll(seed, s.who, d, 2) < (0.2 + 0.5 * s.skill) * w) {
        const kg = Math.max(1, Math.round((2 + 10 * roll(seed, s.who, d, 3)) * w));
        wild[hab] = clamp(w - kg / 600, 0, 1);
        if (hh) hh.meat = (hh.meat || 0) + Math.ceil(kg / 2);
        const yours = Math.floor(kg / 2);
        if (yours) { deliver(G, 'meat', yours, 1); news.push({ kind: 'staff', msg: msg('{name} came back from the hunt with {n} kg of meat for you.', { name: person(name), n: yours }) }); }
      }
      // the bush bites back: a cut, now and then a snake (estimates)
      const hurt = roll(seed, s.who, d, 4);
      if (hurt < 0.012) injure(G, q, hurt < 0.0015 ? 'snakebite' : 'wound_minor', (d - 1) * DAY + 15 * 60);
      learn();
    } else if (s.role === 'gatherer' && s.task) {
      const got = gather(G, q, s, d);
      if (got.n) news.push({ kind: 'staff', msg: msg('{name} brought {n} of {herb}.', { name: person(name), n: got.n, herb: en(HERB.get(got.herb), 'name') }) });
      learn();
    }
  }
  return news;
}
/** Someone hurt at work: the injury begins in their body (their record, or the clinic's if you hold them). */
function injure(G, q, condId, t) {
  const cl = G.meta.clinic;
  const p = q.held ? cl.patients[q.held] : recordFor(G, q, t);
  (p.pending ||= []).push({ id: condId, t });
}
/** Put goods where you will find them: the first shelf with room, else your bag. */
function deliver(G, id, n, q) {
  let left = n;
  for (const sh of G.W.shelves?.() || []) { left = addItem(sh.inv, G.C, id, left, { q, t: G.W.time }); if (!left) break; }
  if (left) left = addItem(G.p.inv, G.C, id, left, { q, t: G.W.time });
  return n - left;
}
/** A gatherer's day: the nearest ripe plants of the species she was asked for, around her home, up to four. Unsure of
 *  a plant, she takes its lookalike instead (a same-genus or same-family species, flora.js) with a chance that falls
 *  as she learns (estimate: 15% at first). Fresh herbs go to a drying rack with room, else a shelf. */
function gather(G, q, s, d) {
  const W = G.W, home = hamletRow(W.R, q.h), seed = G.meta.seed;
  if (!W.objDef) return { n: 0 };
  const want = 'plant_' + s.task, found = [];
  for (let r = 0; r <= 25 && found.length < 4; r++) for (let dy = -r; dy <= r && found.length < 4; dy++) for (let dx = -r; dx <= r && found.length < 4; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = home.x + dx, y = home.y + dy;
    if (W.obj(x, y) === want && W.plantReady(x, y)) found.push([x, y]);
  }
  let n = 0;
  for (const [x, y] of found) {
    const got = plantYield(W, x, y), herb = HERB.get(s.task);
    W.setState(x, y, { regrowAt: W.time + herb.regrowDays * DAY });
    let id = got.id;
    if (roll(seed, s.who, d * 31 + x * 7 + y, 5) < 0.15 * (1 - s.skill)) { const alt = lookalikes(s.task).find((l) => G.C.items.has('fresh_' + l.id)); if (alt) id = 'fresh_' + alt.id; }
    let left = got.n;
    for (const sh of rackSpots(G)) { left = addItem(sh.inv, G.C, id, left, { q: got.q, t: W.time }); if (!left) break; }
    if (left) left = addItem(G.p.inv, G.C, id, left, { q: got.q, t: W.time });
    n += got.n - left;
  }
  return { n, herb: s.task };
}
/** Drying racks first (fresh herbs should dry), then medicine shelves. */
function rackSpots(G) {
  const W = G.W, out = [];
  for (const [i, st] of W.st || []) {
    const x = i % W.N, y = Math.floor(i / W.N), od = W.objDef(x, y);
    if (od?.dries && st.inv) out.push({ inv: st.inv });
  }
  return [...out, ...(W.shelves?.() || [])];
}

/** The laboratory assistant(s), most skilled first. */
export const labStaff = (G) => (G.meta.clinic.staff || []).filter((s) => s.role === 'lab').sort((a, b) => b.skill - a.skill);
/** A slide read by an assistant: they learn from each, twice as fast when you re-read their slide and tell them. */
export function readBy(s, checked = false) {
  s.n += checked ? 2 : 1;
  s.skill = Math.round(clamp(s.skill + (1 - s.skill) * (checked ? 0.03 : 0.012), 0, 0.95) * 1000) / 1000;
}
/** Skill in words (the staff tab). */
export const skillMsg = (k) => (k < 0.3 ? msg('new to it') : k < 0.55 ? msg('getting steady') : k < 0.8 ? msg('skilled') : msg('expert'));
export { t };
