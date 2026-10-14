// clinic.js — the practice: who comes when, the people you have seen living their lives at home (and
// getting better, worse, or dying), who comes back, what you are paid, and what the valley thinks of you.
import { makeRng, weighted } from './rng.js';
import { DAY, HOUR, day, season, minuteOfDay } from './time.js';
import { makePatient } from './patient.js';
import { simulate } from './disease.js';
import { COND } from './content/conditions.js';
import { addItem } from './inventory.js';
import { deliverOrders } from './economy.js';
import { ORGANISMS, baseResistance } from './content/organisms.js';
import { tickPeople, drawResident, personNow, hold, patientEvents, population, householdKey } from './people.js';
import { seekers, walkIn } from './village.js';
import { benchExposure, immune } from './contagion.js';
import { kindFrom } from './food.js';
import { staffDay } from './staff.js';
import { homeRemedyOnArrival } from './homecare.js';
import { t, tc, tm, msg, person, en } from './i18n.js';
import { say, withEn, withCtx } from './patient.js';
export { say };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const OPEN = 7 * 60, CLOSE = 18 * 60, LAST_ARRIVAL = 15.5 * 60;

export function newClinic() {
  return { rep: 0.3, fee: 1, markup: 1.3, patients: {}, sched: {}, returns: [], seq: 0, resist: baseResistance(), stats: { seen: 0, recovered: 0, died: 0, referred: 0, income: 0, harmed: 0 } };
}

// ——— the valley's resistance index: { org: { drug: share of strains resistant } }
// Every course of an antibiotic selects resistant strains among the bacteria people carry, and resistant
// strains bred inside a patient spread from their household. Without the drug, resistance costs the
// germ fitness and slowly fades. One clinic is a small share of a valley's antibiotic use, so this moves
// over decades, not seasons: sustained heavy use (a few courses a day) shifts a drug by ~0.1–0.2 over
// ~20 game years. Bacterial resistance barely fades once established (trimethoprim stayed put after an
// 85% cut in use: Sundqvist M et al. J Antimicrob Chemother 2010;65:350); malaria's fades within about a
// decade (chloroquine came back in Malawi ~12 years after withdrawal: Laufer MK et al. N Engl J Med
// 2006;355:1959). Rates are estimates (Goossens H et al. Lancet 2005;365:579; Andersson DI, Hughes D.
// Nat Rev Microbiol 2010;8:260).
export const resistance = (cl) => (cl.resist ||= baseResistance());
/** A course of the drug selects every germ it touches; pass orgId to select one (a strain spreading from a household). */
export function selectPressure(cl, activeId, k = 1, orgId = null) {
  const R = resistance(cl);
  for (const o of ORGANISMS) if (activeId in o.mic && (!orgId || o.id === orgId)) { const r = R[o.id][activeId] ?? 0; R[o.id][activeId] = r + 0.00007 * k * (1 - r); }
}
/** Fade resistance once for every day passed since the last fade (whether or not the clinic was open). */
export function fadeResistance(cl, today) {
  cl.fadedTo ??= today;
  for (; cl.fadedTo < today; cl.fadedTo++) resistanceDay(cl);
}
function resistanceDay(cl) {
  const R = resistance(cl);
  for (const o of ORGANISMS) {
    const fade = o.parasite ? 0.004 : 0.0012; // per day: half-life ~4 years for malaria, ~15 for bacteria
    for (const d of Object.keys(o.mic)) { const r = R[o.id][d] ?? 0, r0 = o.resist0[d] ?? 0; R[o.id][d] = r + (r0 - r) * fade; }
  }
}
/** The season's lab bulletin: the valley's real resistance, sampled (n isolates each), fixed once issued. */
export function healthReport(G) {
  const cl = G.meta.clinic, s = Math.floor((day(G.W.time) - 1) / 10);
  if (cl.report?.s === s) return cl.report;
  const R = resistance(cl), rng = makeRng(G.meta.seed, 'report', s), n = 40, data = {};
  for (const o of ORGANISMS) { data[o.id] = {}; for (const d of Object.keys(o.mic)) { let k = 0; for (let i = 0; i < n; i++) if (rng() < (R[o.id][d] ?? 0)) k++; data[o.id][d] = k / n; } }
  cl.report = { s, day: s * 10 + 1, season: season(G.W.time), n, data };
  return cl.report;
}
const feeFactor = (fee) => clamp(1.15 - fee * 0.07, 0.4, 1.15);
/** What the valley has told of since the last look: deaths at home, the harvest, hunger (village.js), as news lines. */
export function villageNews(G) {
  const { P } = population(G), cl = G.meta.clinic, out = P.news.map((n) => ({ kind: n.kind, text: say(n.msg), msg: n.msg }));
  P.news = [];
  // the valley's own news, kept for the ledger (last 60 lines)
  if (out.length) cl.vlog = [...(cl.vlog || []), ...out.map((n) => ({ t: G.W.time, kind: n.kind, msg: n.msg }))].slice(-60);
  return out;
}
/** The waiting bench since the last look: what passes between those sitting there (contagion.js). The scene says
 *  whether the bench is under a roof (G.benchIndoor). */
function bench(G) {
  const cl = G.meta.clinic, t = G.W.time, mins = Math.min(120, t - (cl.benchT ?? t));
  cl.benchT = t;
  const sitting = Object.values(cl.patients).filter((p) => p.status === 'waiting');
  if (mins <= 0 || sitting.length < 2) return;
  // a neighbour from the valley may be immune already (an earlier bout, the measles vaccine): contagion.js immune
  const { P } = population(G), d = day(t);
  const isProtected = (p, row) => !!p.who && immune(G.meta.seed, p.who, row, d, p.age, p.who.startsWith('b') ? 0 : Math.max(0, p.age - (d - P.day0) / 40), P.imm[p.who]);
  benchExposure(G.meta.seed, sitting, t, mins, !!G.benchIndoor?.(), isProtected);
}

// People from beyond the valley (travellers, a visiting relative) who come in a day: an estimate, so a healthy valley
// still sees the odd stranger.
const STRANGERS = 0.4;
/** Today's arrivals, decided once at the day's start: the valley's sick who decide to come (village.js seekers) and a
 *  few strangers, in the order they reach the clinic. More than the bench can hold do not come today. */
export function dayPlan(G, d) {
  const cl = G.meta.clinic;
  if (cl.sched[d]) return cl.sched[d];
  tickPeople(G); // the valley up to the start of today
  const R = G.W.R;
  const rng = makeRng(G.meta.seed, 'arrivals', d);
  const seats = G.seats?.() ?? 3;
  const list = seekers(G, d, OPEN + 20, LAST_ARRIVAL).map((s) => ({ key: `${d}-${s.who}`, t: s.t, hamlet: s.hamlet, who: s.who, spawned: false }));
  const lam = STRANGERS * ((0.3 + cl.rep) / 0.6) * feeFactor(cl.fee);
  let n = 0, L = Math.exp(-lam), pr = 1;
  do { n++; pr *= rng(); } while (pr > L && n < 30);
  const places = [[R.village, 2.2], ...R.hamlets.map((h) => [h, 1 / (1 + h.dist / 35)])];
  for (let k = 0; k < n - 1; k++) {
    const h = weighted(places, rng());
    list.push({ key: `${d}-s${k}`, t: (d - 1) * DAY + OPEN + 20 + rng() * (LAST_ARRIVAL - OPEN - 20), hamlet: h.id, stranger: true, spawned: false });
  }
  list.sort((a, b) => a.t - b.t);
  list.length = Math.min(list.length, 3 + seats * 2);
  cl.sched[d] = list;
  for (const k of Object.keys(cl.sched)) if (+k < d - 1) delete cl.sched[k];
  return list;
}
export const hamletOf = (G, id) => (id === 'village' ? G.W.R.village : G.W.R.hamlets.find((h) => h.id === id)) || G.W.R.village;

/** New arrivals, emergencies carried in, and returning patients who should be on their way now. Returns patient ids. */
export function dueArrivals(G) {
  const cl = G.meta.clinic, t = G.W.time, d = day(t);
  const out = [];
  if (minuteOfDay(t) < OPEN || minuteOfDay(t) > CLOSE) return out;
  const arrive = (p, at) => {
    if (p.who) hold(G, p);
    p.status = 'arriving'; p.firstSeen = at;
    if (G.W.obj) homeRemedyOnArrival(G, p);
    cl.patients[p.id] = p;
    out.push(p.id);
  };
  for (const a of dayPlan(G, d)) {
    if (a.spawned || a.t > t) continue;
    a.spawned = true;
    if (t - a.t > 3 * HOUR) { cl.missed = (cl.missed || 0) + 1; continue; } // came while you were away, went home
    let p;
    if (a.who) p = walkIn(G, a.who, a.t); // someone from the valley, with what they have (village.js)
    else if (a.stranger) p = makePatient({ seed: G.meta.seed, key: a.key, t: a.t, season: season(a.t), hamlet: hamletOf(G, a.hamlet), resist: resistance(cl) });
    else { // a save from before the living valley: someone who lives there, with an illness drawn for them
      const q = drawResident(G, a.hamlet, a.key);
      p = makePatient({ seed: G.meta.seed, key: a.key, t: a.t, season: season(a.t), hamlet: hamletOf(G, a.hamlet), resist: resistance(cl), who: q && personNow(G, q, a.t) });
    }
    if (p) arrive(p, a.t);
  }
  // an emergency at home: the family carries them in (village.js urgent); at night they wait for the morning
  for (const u of [...(cl.urgent || [])]) {
    if (u.t > t) continue;
    cl.urgent.splice(cl.urgent.indexOf(u), 1);
    const p = walkIn(G, u.who, t);
    if (!p) continue;
    p.urgent = u.why;
    arrive(p, t);
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
  fadeResistance(cl, day(t));
  tickPeople(G);
  news.push(...villageNews(G));
  bench(G);
  // a working day for your staff, once a day (staff.js)
  for (cl.staffDay ??= day(t); cl.staffDay < day(t); cl.staffDay++) for (const n of staffDay(G, cl.staffDay + 1)) news.push({ kind: n.kind, text: say(n.msg), msg: n.msg });
  for (const p of Object.values(cl.patients)) {
    if (!['home', 'leaving', 'hospital'].includes(p.status)) continue;
    const ev = simulate(p, t);
    patientEvents(G, p, ev);
    for (const e of ev) {
      if (e.kind === 'died') {
        p.status = 'dead';
        const ours = p.visits.length > 0;
        const poison = p.cause.startsWith('poisoned');
        cl.stats.died++;
        if (poison) cl.stats.harmed++;
        cl.rep = clamp(cl.rep - (poison ? 0.12 : ours ? 0.04 : 0.01), 0, 1);
        const cause = p.causeMsg ?? p.cause, place = hamletOf(G, p.hamlet).name;
        news.push({ kind: 'death', pid: p.id, text: say(withEn(msg('{who} from {place} died — {cause}.', { who: whoMsg(p), place: person(place), cause }), `${whoEn(p)} from ${place} died — ${p.cause}.`)), poison });
        const text = `${whoEn(p)} died (${p.cause}).`;
        G.meta.ledger.push({ t: e.t, kind: 'death', pid: p.id, text, msg: withEn(msg('{who} died ({cause}).', { who: whoMsg(p), cause }), text) });
      } else if (e.kind === 'tox' && !p.toxReturn) {
        p.toxReturn = true;
        scheduleReturn(G, p, e.t + 6 * HOUR, withEn(msg('complains: {what}', { what: e.msg ?? e.text }), `complains: ${e.text}`));
      } else if (e.kind === 'onset' && COND.get(e.id).params.urgent) {
        // an emergency at home (bleeding after the birth, fits, a stuck labour): the family carries her in
        const what = en(COND.get(e.id), 'name');
        scheduleReturn(G, p, e.t + HOUR, withEn(msg('brought in: {what}', { what }), `brought in: ${what.toLowerCase()}`));
      } else if (e.kind === 'birth' || e.kind === 'stillbirth' || e.kind === 'miscarriage') {
        const place = hamletOf(G, p.hamlet).name;
        news.push({ kind: 'birth', pid: p.id, text: say(withEn(msg('{name} of {place}: {what}.', { name: person(p.name), place: person(place), what: e.msg ?? e.text }), `${p.name} of ${place}: ${e.text}.`)) });
      }
    }
    if (p.status === 'dead') continue;
    // a resistant strain bred in this patient spreads through the household
    for (const c of p.conds) for (const id of Object.keys(c.res || {})) if (!c.spread?.[id]) { (c.spread ||= {})[id] = 1; selectPressure(cl, id, 6, c.org); }
    if (p.status === 'hospital' && t > p.hospital.until) { p.status = 'home'; G.meta.ledger.push({ t, kind: 'note', pid: p.id, text: `${whoEn(p)} is back from the health centre.`, msg: msg('{who} is back from the health centre.', { who: whoMsg(p) }) }); }
    // recovered?
    if (!p.conds.length && !p.recovered) {
      p.recovered = t;
      cl.stats.recovered++;
      if (p.visits.length) {
        cl.rep = clamp(cl.rep + 0.025, 0, 1);
        news.push({ kind: 'recovered', pid: p.id, text: t('{who} from {place} is well again.', { who: whoMsg(p), place: person(hamletOf(G, p.hamlet).name) }) });
        G.meta.ledger.push({ t, kind: 'recovered', pid: p.id, text: `${whoEn(p)} recovered.`, msg: msg('{who} recovered.', { who: whoMsg(p) }) });
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
      // told the danger signs (IMCI counselling), they notice a turn for the worse sooner and come at once (estimates)
      const warned = p.rx.some((r) => r.instr === 'danger_signs' && !r.stopped && r.until > t);
      if ((b > left * (warned ? 1.15 : 1.35) && b > (warned ? 0.25 : 0.35)) || back || ranOut) {
        if (rngR() < 0.35 + p.trust * 0.5 + (warned ? 0.35 : 0)) scheduleReturn(G, p, t + DAY * (warned ? 0.1 : 0.3), back ? msg('the fever came back') : ranOut ? msg('still unwell, the medicine is finished') : msg('getting worse'));
        else p.leftBurden = b; // gives up on you for now
      }
    }
  }
  if (G.W.shelves) news.push(...deliverOrders(G));
  return news;
}

/** why: 'thanks', or what they say brought them back: a msg (saved; `en` when its English is not the plain key). */
export function scheduleReturn(G, p, t, why) {
  const cl = G.meta.clinic;
  if (cl.returns.some((r) => r.pid === p.id)) return;
  // nobody walks in at night: shift to the next morning
  let tt = t;
  const m = minuteOfDay(tt);
  if (m < OPEN + 30) tt += OPEN + 30 - m; else if (m > LAST_ARRIVAL) tt += DAY - m + OPEN + 30;
  cl.returns.push({ pid: p.id, t: tt, why });
}

/** The patient as named in lists: "Name (3 years)" for a child. whoMsg: the same as a msg (for saved text); who: shown now. */
export const whoMsg = (p) => (p.age < 13 ? msg('{name} ({age})', { name: person(p.name), age: ageMsg(p.age) }) : person(p.name));
export const who = (p) => tm(whoMsg(p));
const ageMsg = (a) => (a < 1 ? msg('{n} months', { n: Math.max(1, Math.round(a * 12)) }) : withCtx(msg('{n} years', { n: Math.floor(a) }), 'age'));
export function ageWords(a) { return tm(ageMsg(a)); }
// English for the `text` kept beside each saved msg
export const whoEn = (p) => (p.age < 13 ? `${p.name} (${p.age < 1 ? `${Math.max(1, Math.round(p.age * 12))} months` : `${Math.floor(p.age)} years`})` : p.name);

/** The household a valley patient lives in (food.js), or null for a stranger. */
export function householdOf(G, p) {
  if (!p.who || !G.W?.R) return null;
  const { P, L } = population(G), q = L.get(p.who);
  return q ? P.hh[householdKey(q)] || null : null;
}
/** What the visit costs, and how it is paid: { total, cash, kind:[[id,n]], debt }. Payment comes out of the family's
 *  money and stores at once. */
export function payment(G, p, charges) {
  const cl = G.meta.clinic;
  const total = Math.round((cl.fee + charges * cl.markup) * 10) / 10;
  // a family from the valley pays from its own money and stores (food.js): a hungry house has little of either
  const hh = householdOf(G, p);
  const wallet = Math.round(Math.min(p.wealth * 14 + 1, hh ? Math.max(0, hh.cash) : Infinity) * 10) / 10;
  const cash = Math.min(total, wallet);
  let rest = Math.round((total - cash) * 10) / 10;
  const kind = [];
  const rng = makeRng(p.seed, 'pay', p.visits.length);
  if (hh) { const k = kindFrom(hh, p.wealth < 0.6 ? rest : 0, rng); kind.push(...k.kind); rest = k.left; }
  else while (rest > 0.2 && p.wealth < 0.6 && kind.length < 3) {
    const [id, worth] = rest >= 6 && rng() < 0.4 ? ['chicken', 6] : rest >= 1.2 && rng() < 0.5 ? ['beans', 1.2] : rng() < 0.5 ? ['eggs', 0.4] : ['maize', 0.3];
    const n = Math.max(1, Math.min(id === 'chicken' ? 1 : 12, Math.floor(rest / worth)));
    kind.push([id, n]); rest = Math.round((rest - n * worth) * 10) / 10;
  }
  if (hh) hh.cash = Math.round((hh.cash - cash) * 10) / 10;
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
  return { name: who(p), cond: cond?.name, status: statusWord(p.dead ? 'died' : p.recovered ? 'well' : p.status), visits: p.visits.length, cause: p.cause && say(p.causeMsg ?? p.cause) };
}
/** A patient's status in words (status ids: arriving, waiting, consult, leaving, home, hospital, dead; died, well). */
export function statusWord(s) {
  const W = {
    died: () => tc('status', 'died'), dead: () => tc('status', 'died'), well: () => tc('status', 'well'), arriving: () => tc('status', 'arriving'),
    waiting: () => tc('status', 'waiting'), consult: () => tc('status', 'consult'), leaving: () => tc('status', 'leaving'), home: () => tc('status', 'home'),
    hospital: () => tc('status', 'hospital'),
  };
  return W[s] ? W[s]() : s;
}
