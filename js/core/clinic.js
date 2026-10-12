// clinic.js — the practice: who comes when, the people you have seen living their lives at home (and
// getting better, worse, or dying), who comes back, what you are paid, and what the valley thinks of you.
import { makeRng, weighted } from './rng.js';
import { DAY, HOUR, day, season, minuteOfDay } from './time.js';
import { makePatient } from './patient.js';
import { simulate } from './disease.js';
import { COND } from './content/conditions.js';
import { addItem } from './inventory.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const OPEN = 7 * 60, CLOSE = 18 * 60, LAST_ARRIVAL = 15.5 * 60;

export function newClinic() {
  return { rep: 0.3, fee: 1, markup: 1.3, patients: {}, sched: {}, returns: [], seq: 0, stats: { seen: 0, recovered: 0, died: 0, referred: 0, income: 0, harmed: 0 } };
}
const feeFactor = (fee) => clamp(1.15 - fee * 0.07, 0.4, 1.15);

/** Today's arrivals (decided once, at the start of the day). */
export function dayPlan(G, d) {
  const cl = G.meta.clinic;
  if (cl.sched[d]) return cl.sched[d];
  const R = G.W.R;
  const rng = makeRng(G.meta.seed, 'arrivals', d);
  const seats = G.seats?.() ?? 3;
  const lam = (1.6 + 5.5 * cl.rep) * feeFactor(cl.fee);
  let n = 0, L = Math.exp(-lam), pr = 1;
  do { n++; pr *= rng(); } while (pr > L && n < 30);
  n = Math.min(n - 1, 3 + seats * 2);
  const places = [[R.village, 2.2], ...R.hamlets.map((h) => [h, 1 / (1 + h.dist / 35)])];
  const list = [];
  for (let k = 0; k < n; k++) {
    const h = weighted(places, rng());
    list.push({ key: `${d}-${k}`, t: (d - 1) * DAY + OPEN + 20 + rng() * (LAST_ARRIVAL - OPEN - 20), hamlet: h.id, spawned: false });
  }
  list.sort((a, b) => a.t - b.t);
  cl.sched[d] = list;
  for (const k of Object.keys(cl.sched)) if (+k < d - 1) delete cl.sched[k];
  return list;
}
export const hamletOf = (G, id) => (id === 'village' ? G.W.R.village : G.W.R.hamlets.find((h) => h.id === id)) || G.W.R.village;

/** New arrivals and returning patients who should be on their way now. Returns patient ids. */
export function dueArrivals(G) {
  const cl = G.meta.clinic, t = G.W.time, d = day(t);
  const out = [];
  if (minuteOfDay(t) < OPEN || minuteOfDay(t) > CLOSE) return out;
  for (const a of dayPlan(G, d)) {
    if (a.spawned || a.t > t) continue;
    a.spawned = true;
    if (t - a.t > 3 * HOUR) { cl.missed = (cl.missed || 0) + 1; continue; } // came while you were away, went home
    const p = makePatient({ seed: G.meta.seed, key: a.key, t: a.t, season: season(a.t), hamlet: hamletOf(G, a.hamlet) });
    p.status = 'arriving'; p.firstSeen = a.t;
    cl.patients[p.id] = p;
    out.push(p.id);
  }
  for (const r of [...cl.returns]) {
    if (r.t > t) continue;
    cl.returns.splice(cl.returns.indexOf(r), 1);
    const p = cl.patients[r.pid];
    if (!p || p.dead || p.status !== 'home') continue;
    simulate(p, t);
    if (p.dead) continue;
    p.status = 'arriving'; p.returnWhy = r.why;
    out.push(p.id);
  }
  return out;
}

/** Bring everyone at home up to now; report deaths, recoveries, and decide who comes back. */
export function tickHome(G) {
  const cl = G.meta.clinic, t = G.W.time;
  const news = [];
  for (const p of Object.values(cl.patients)) {
    if (!['home', 'leaving', 'hospital'].includes(p.status)) continue;
    const ev = simulate(p, t);
    for (const e of ev) {
      if (e.kind === 'died') {
        p.status = 'dead';
        const ours = p.visits.length > 0;
        const poison = p.cause.startsWith('poisoned');
        cl.stats.died++;
        if (poison) cl.stats.harmed++;
        cl.rep = clamp(cl.rep - (poison ? 0.12 : ours ? 0.04 : 0.01), 0, 1);
        news.push({ kind: 'death', pid: p.id, text: `${who(p)} from ${hamletOf(G, p.hamlet).name} died — ${p.cause}.`, poison });
        G.meta.ledger.push({ t: e.t, kind: 'death', pid: p.id, text: `${who(p)} died (${p.cause}).` });
      } else if (e.kind === 'tox' && !p.toxReturn) {
        p.toxReturn = true;
        scheduleReturn(G, p, e.t + 6 * HOUR, `complains: ${e.text}`);
      } else if (e.kind === 'birth') {
        news.push({ kind: 'birth', pid: p.id, text: `${p.name} of ${hamletOf(G, p.hamlet).name} has given birth.` });
      }
    }
    if (p.status === 'dead') continue;
    if (p.status === 'hospital' && t > p.hospital.until) { p.status = 'home'; G.meta.ledger.push({ t, kind: 'note', pid: p.id, text: `${who(p)} is back from the health centre.` }); }
    // recovered?
    if (!p.conds.length && !p.recovered) {
      p.recovered = t;
      cl.stats.recovered++;
      if (p.visits.length) {
        cl.rep = clamp(cl.rep + 0.025, 0, 1);
        news.push({ kind: 'recovered', pid: p.id, text: `${who(p)} from ${hamletOf(G, p.hamlet).name} is well again.` });
        G.meta.ledger.push({ t, kind: 'recovered', pid: p.id, text: `${who(p)} recovered.` });
        // the grateful (and those who owe) bring something
        if (p.debt > 0 || p.wealth < 0.4) scheduleReturn(G, p, t + DAY * (0.5 + Math.random()), 'thanks');
      }
      continue;
    }
    // worse, or the fever came back, or the medicine ran out while still ill?
    if (p.conds.length && p.status === 'home' && !cl.returns.some((r) => r.pid === p.id)) {
      const b = p.conds.reduce((a, c) => a + (c.s || 0), 0);
      const left = p.leftBurden ?? b;
      const ranOut = p.rx.length && p.rx.every((r) => r.instr || r.left <= 0 || r.stopped) && b > 0.3;
      const fever = p.conds.find((c) => c.id === 'malaria');
      const back = fever && fever.s > 0.35 && p.lowSince;
      if (fever && fever.s < 0.1) p.lowSince ||= t;
      const rngR = makeRng(p.seed, 'ret', Math.floor(t / DAY));
      if ((b > left * 1.35 && b > 0.35) || back || ranOut) {
        if (rngR() < 0.35 + p.trust * 0.5) scheduleReturn(G, p, t + DAY * 0.3, back ? 'the fever came back' : ranOut ? 'still unwell, the medicine is finished' : 'getting worse');
        else p.leftBurden = b; // gives up on you for now
      }
    }
  }
  return news;
}

export function scheduleReturn(G, p, t, why) {
  const cl = G.meta.clinic;
  if (cl.returns.some((r) => r.pid === p.id)) return;
  // nobody walks in at night: shift to the next morning
  let tt = t;
  const m = minuteOfDay(tt);
  if (m < OPEN + 30) tt += OPEN + 30 - m; else if (m > LAST_ARRIVAL) tt += DAY - m + OPEN + 30;
  cl.returns.push({ pid: p.id, t: tt, why });
}

export const who = (p) => (p.age < 13 ? `${p.name} (${ageWords(p.age)})` : p.name);
export function ageWords(a) { return a < 1 ? `${Math.max(1, Math.round(a * 12))} months` : `${Math.floor(a)} years`; }

/** What the visit costs, and how it is paid: { total, cash, kind:[[id,n]], debt }. */
export function payment(G, p, charges) {
  const cl = G.meta.clinic;
  const total = Math.round((cl.fee + charges * cl.markup) * 10) / 10;
  const wallet = Math.round((p.wealth * 14 + 1) * 10) / 10;
  const cash = Math.min(total, wallet);
  let rest = Math.round((total - cash) * 10) / 10;
  const kind = [];
  const rng = makeRng(p.seed, 'pay', p.visits.length);
  while (rest > 0.2 && p.wealth < 0.6 && kind.length < 3) {
    const [id, worth] = rest >= 6 && rng() < 0.4 ? ['chicken', 6] : rest >= 1.2 && rng() < 0.5 ? ['beans', 1.2] : rng() < 0.5 ? ['eggs', 0.4] : ['maize', 0.3];
    const n = Math.max(1, Math.min(id === 'chicken' ? 1 : 12, Math.floor(rest / worth)));
    kind.push([id, n]); rest = Math.round((rest - n * worth) * 10) / 10;
  }
  return { total, cash, kind, debt: Math.max(0, rest) };
}

export function collect(G, p, pay) {
  const { C } = G;
  G.p.coins = Math.round((G.p.coins + pay.cash) * 10) / 10;
  for (const [id, n] of pay.kind) {
    const left = addItem(G.p.inv, C, id, n);
    if (left) { const sh = G.W.shelves()[0]; if (sh) addItem(sh.inv, C, id, left); }
  }
  p.debt = (p.debt || 0) + pay.debt;
  G.meta.clinic.stats.income += pay.cash;
}

/** One line per patient for the ledger. */
export function patientSummary(p) {
  const cond = COND.get(p.mainCond);
  return { name: who(p), cond: cond?.name, status: p.dead ? 'died' : p.recovered ? 'well' : p.status, visits: p.visits.length, cause: p.cause };
}
