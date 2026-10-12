// encounter.js — the consultation. Asking, examining and testing cost minutes (the clock runs while
// you work); what you learn comes only from signs.js. You commit to a working diagnosis, prescribe
// (what, how much, how often, how long, by which route), counsel, perhaps refer, and are paid.
import { QUESTIONS, EXAMS, POINTS } from './content/findings.js';
import { COND, CONDITIONS } from './content/conditions.js';
import { ACTIVE } from './content/actives.js';
import { ORGANISMS } from './content/organisms.js';
import { signs } from './signs.js';
import { count, remove, countSpec } from './inventory.js';
import { HOUR, DAY } from './time.js';
import { payment, collect, scheduleReturn, who, selectPressure } from './clinic.js';
import { gainXp } from './crafting.js';
import { stackPotency } from './crafting.js';
import { makeRng } from './rng.js';
import { gather, giveTea } from './homecare.js';

export const INSTRUCTIONS = [
  { id: 'finish', label: 'Explain the medicine, and to finish every dose even when better', min: 3 },
  { id: 'hygiene', label: 'Wash hands and bottom, cut nails, wash bedding', min: 2 },
  { id: 'treat_family', label: 'Treat the whole family; boil or sun clothes and bedding', min: 2 },
  { id: 'feeding', label: 'Keep feeding and breastfeeding; give drinks often', min: 2 },
  { id: 'low_salt', label: 'Eat little salt; sleep propped up', min: 2 },
  { id: 'rest_move', label: 'Keep moving gently; lift with the legs', min: 1 },
  { id: 'hot_compress', label: 'Hot compresses 20 minutes, 4 times a day; raise the limb', min: 2 },
  { id: 'dressing', label: 'Keep it covered with a clean cloth, change daily', min: 1, needs: [['cloth', 2]] },
  { id: 'stop_home', label: 'Stop the tea you have been giving at home', min: 1, only: (p) => p.rx.some((r) => r.home && !r.stopped) },
];
export const PROCEDURES = [
  { id: 'clean', label: 'Clean the wound with soap and boiled water, remove dirt', min: 12, needs: [['soap', 1], ['cloth', 1]], station: 'hearth',
    applies: (p) => p.conds.some((c) => c.id.startsWith('wound') || c.id === 'burn_minor') },
];

export function startEncounter(G, pid) {
  const p = G.meta.clinic.patients[pid];
  const enc = { pid, t0: G.W.time, log: [], found: {}, done: new Set(), dx: [], rx: [], instr: new Set(), proc: new Set(), refer: false, returnDays: 0 };
  const opener = p.returnWhy && p.visits.length ? returnLine(p) : p.complaint;
  enc.log.push({ who: speaker(p), text: opener });
  p.status = 'consult';
  return enc;
}
const speaker = (p) => (p.age < 13 ? 'Mother' : p.name);
function returnLine(p) {
  if (p.returnWhy === 'thanks') return `We came to thank you — ${p.age < 13 ? 'the child' : 'I'} is well now.`;
  return `We came back. ${cap(p.returnWhy)}.`;
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tools in your bag + those built into the clinic. */
export function toolsAt(G) {
  const s = new Set();
  for (const sl of G.p.inv.slots) if (sl && G.C.items.get(sl.id).tool) s.add(sl.id);
  return s;
}

export function questionsFor(p) { return QUESTIONS.filter((q) => !q.only || q.only(p)); }
export function examsFor(p) { return EXAMS.filter((x) => !x.only || x.only(p)); }

/** Ask a history question. Returns the answer line. */
export function ask(G, enc, qid) {
  const p = G.meta.clinic.patients[enc.pid];
  const q = QUESTIONS.find((x) => x.id === qid);
  G.meta.time += q.min;
  const F = signs(p, G.W.time, toolsAt(G));
  const parts = [];
  for (const k of q.reveals) {
    const f = F[k];
    if (!f || f.v === '—') continue;
    // small children cannot say; parents miss things sometimes
    const missed = f.pos && makeRng(p.seed, 'miss', k, Math.floor(G.W.time / DAY))() < (p.age < 3 ? 0.15 : 0.07);
    if (missed) { parts.push(['I have not noticed.', false]); continue; }
    parts.push([f.v, f.pos]);
    enc.found[k] = f;
  }
  const text = parts.length ? parts.map((x) => x[0]).filter((v, i, a) => a.indexOf(v) === i).join(' ') : 'No, nothing like that.';
  enc.log.push({ who: 'You', text: q.label });
  enc.log.push({ who: speaker(p), text });
  enc.done.add(qid);
  return text;
}

/** Examine. Returns { ok, text } (needs the right tool). */
export function examine(G, enc, xid) {
  const p = G.meta.clinic.patients[enc.pid];
  const x = EXAMS.find((e) => e.id === xid);
  const tools = toolsAt(G);
  if (x.tool && !tools.has(x.tool)) return { ok: false, text: `You need a ${G.C.items.get(x.tool).name.toLowerCase()}.` };
  G.meta.time += x.min;
  const F = signs(p, G.W.time, tools);
  const lines = [];
  for (const k of x.reveals) {
    const f = F[k];
    if (!f || f.v === '—') continue;
    enc.found[k] = f;
    lines.push(f.v);
  }
  const text = lines.length ? lines.join(' ') : 'Nothing remarkable.';
  enc.log.push({ who: 'Exam', text: `${x.label}: ${text}`, exam: xid });
  enc.done.add(xid);
  return { ok: true, text };
}

/** Ranked differential from what you found so far: [{ id, name, score }]. */
export function differential(enc) {
  const score = {};
  for (const [k, f] of Object.entries(enc.found)) {
    if (!f.pos) continue;
    for (const [c, w] of Object.entries(POINTS[k] || {})) score[c] = (score[c] || 0) + w;
  }
  return Object.entries(score).map(([id, s]) => ({ id, name: COND.get(id).name, score: s })).sort((a, b) => b.score - a.score).slice(0, 6);
}

/** Stock you can dispense from: your bag and the medicine shelves. */
export function stockOf(G, id) {
  let n = count(G.p.inv, id);
  for (const sh of G.W.shelves()) n += count(sh.inv, id);
  return n;
}
export function remedies(G) {
  const ids = new Set();
  for (const s of G.p.inv.slots) if (s) ids.add(s.id);
  for (const sh of G.W.shelves()) for (const s of sh.inv.slots) if (s) ids.add(s.id);
  return [...ids].map((id) => G.C.items.get(id)).filter((it) => it.route?.length);
}

/** A prescription line from the form. route: 'oral'|'topical'. */
export function rxLine(G, itemId, amount, perDay, days, route) {
  const it = G.C.items.get(itemId);
  const qty = Math.ceil(amount * perDay * days * 100) / 100;
  return { item: itemId, name: it.name, amount, perDay, days, route, qty };
}

/** Nominal dose of each active for this patient (mg and mg/kg). */
export function doseInfo(G, p, line, weight = p.weight) {
  const it = G.C.items.get(line.item);
  const out = [];
  if (line.route === 'oral' || line.route === 'inj') for (const [id, mg] of Object.entries(it.actives || {})) {
    const a = ACTIVE.get(id);
    const per = mg * line.amount;
    out.push({ id, name: a.name, mg: per, mgkg: per / weight, perDayKg: (per * line.perDay) / weight });
  }
  return out;
}

/** Take a dispensed quantity from bag/shelves; returns the weighted potency of what was taken. */
function dispense(G, id, qty) {
  let left = qty, qSum = 0, got = 0;
  const invs = [G.p.inv, ...G.W.shelves().map((s) => s.inv)];
  for (const inv of invs) {
    for (const s of inv.slots) {
      if (!left) break;
      if (!s || s.id !== id) continue;
      const k = Math.min(left, s.n);
      qSum += stackPotency(G.C, s, G.W.time) * k; got += k; left -= k;
    }
  }
  left = qty;
  for (const inv of invs) { const have = count(inv, id); const k = Math.min(left, have); if (k > 0) { remove(inv, id, k); left -= k; } }
  return { q: got ? qSum / got : 1, got };
}

/**
 * Give an injection now, by your hand: one dose into the muscle. Needs a syringe. Boiled (a hearth in reach) it is
 * clean; otherwise skin germs ride in and an abscess may follow days later (WTND pp.65–67; odds are estimates).
 * An allergic reaction shows within minutes, while they are still with you (WTND pp.70–71).
 */
export function injectNow(G, enc, itemId, amount) {
  const p = G.meta.clinic.patients[enc.pid], it = G.C.items.get(itemId);
  if (!toolsAt(G).has('syringe')) return { ok: false, text: 'You need a syringe.' };
  if (stockOf(G, itemId) < amount) return { ok: false, text: `Not enough ${it.name.toLowerCase()}.` };
  const { q } = dispense(G, itemId, amount);
  G.meta.time += 3;
  const now = G.W.time;
  p.rx.push({ item: itemId, name: it.name, q, left: amount, amount, perDay: 1, days: 1, start: now, route: 'inj', actives: it.actives, inj: it.inj, counselled: true });
  enc.rx.push({ item: itemId, name: it.name, amount, perDay: 1, days: 1, route: 'inj', qty: amount, given: now });
  for (const a of Object.keys(it.actives || {})) { const m = ACTIVE.get(a).abxAs || a; if (ORGANISMS.some((o) => m in o.mic)) selectPressure(G.meta.clinic, m); }
  const boiled = G.stations.has('hearth');
  if (makeRng(p.seed, 'abscess', now)() < (boiled ? 0.001 : 0.02)) (p.pending ||= []).push({ id: 'wound_infected', t: now + 48 * HOUR });
  if (!boiled) p.flags.dirtyNeedle = now; // for blood-borne infections later (hepatitis B)
  let text = `Injected ${it.name.toLowerCase()}.`;
  const al = Object.keys(it.actives || {}).find((id) => p.allergy && ACTIVE.get(id).allergen === p.allergy);
  // same draw as disease.js, so what you see now is what the body does
  if (al) text += makeRng(p.seed, 'ana', itemId, now, 0)() < 0.1 ? ' Within minutes: cold grey sweat, a weak fast pulse, wheezing, the lips swelling — allergic shock!' : ' Soon itchy welts rise on the skin.';
  enc.log.push({ who: 'You', text });
  return { ok: true, text };
}

export function doProcedure(G, enc, procId) {
  const p = G.meta.clinic.patients[enc.pid];
  const pr = PROCEDURES.find((x) => x.id === procId);
  if (pr.station && !G.stations.has(pr.station)) return { ok: false, text: 'You need boiled water: a hearth within reach.' };
  for (const [id, n] of pr.needs) if (stockOf(G, id) < n) return { ok: false, text: `You need ${G.C.items.get(id).name.toLowerCase()}.` };
  for (const [id, n] of pr.needs) dispense(G, id, n);
  G.meta.time += pr.min;
  for (const c of p.conds) if (c.id.startsWith('wound') || c.id === 'burn_minor') { c.dirt = (c.dirt ?? 0.3) * 0.15; c.I = Math.max(0, (c.I ?? 0) - 0.7); }
  enc.proc.add(procId);
  enc.log.push({ who: 'You', text: pr.label + '.' });
  return { ok: true, text: 'Done. The wound is clean.' };
}

/** Finish: dispense, counsel, refer, get paid, send home. Returns a summary for the UI. */
export function finishEncounter(G, enc) {
  const { C } = G;
  const p = G.meta.clinic.patients[enc.pid];
  const now = G.W.time;
  let charges = 0;
  const counselled = enc.instr.has('finish');
  for (const line of enc.rx) {
    const it = C.items.get(line.item);
    if (line.given) { charges += line.qty * it.price; continue; } // injected during the visit
    const have = stockOf(G, line.item);
    const qty = Math.min(line.qty, have);
    if (qty <= 0) continue;
    const { q } = dispense(G, line.item, qty);
    charges += qty * it.price;
    if (line.route === 'oral') for (const a of Object.keys(it.actives || {})) if (ORGANISMS.some((o) => a in o.mic)) selectPressure(G.meta.clinic, a);
    p.rx.push({
      item: line.item, name: it.name, q, left: qty, amount: line.amount, perDay: line.perDay, days: line.days, start: now, route: line.route,
      actives: line.route === 'oral' ? it.actives : undefined, topical: line.route === 'topical' ? it.topical : undefined,
      fluid: it.fluid ? { na: it.fluid.na * q } : undefined, counselled, bitter: !!it.bitter,
    });
  }
  if (enc.instr.has('stop_home')) for (const r of p.rx) if (r.home && !r.stopped) r.stopped = now;
  // sent to gather a plant near home and give it as a tea (homecare.js): they may not find it, or bring a lookalike
  if (enc.gather) {
    const got = gather(G, p, enc.gather, makeRng(p.seed, 'gather', p.visits.length));
    if (got) giveTea(G, p, got, enc.gather, now + 4 * HOUR, 5);
    enc.log.push({ who: speaker(p), text: got ? 'We will look for it on the way home.' : 'We do not know where that grows.' });
  }
  for (const id of enc.instr) {
    if (id === 'finish' || id === 'stop_home') continue;
    const ins = INSTRUCTIONS.find((x) => x.id === id);
    if (ins.needs) for (const [nid, n] of ins.needs) if (stockOf(G, nid) >= n) dispense(G, nid, n);
    p.rx.push({ instr: id, name: ins.label, start: now, until: now + 21 * DAY });
  }
  G.meta.time += [...enc.instr].reduce((a, id) => a + INSTRUCTIONS.find((x) => x.id === id).min, 0);
  // referral: whether they go depends on money, how sick they feel, and whether they trust you
  if (enc.refer) {
    const rng = makeRng(p.seed, 'refer', p.visits.length);
    const sev = Math.min(1, p.conds.reduce((a, c) => a + (c.sev ?? c.s ?? 0), 0));
    const go = rng() < 0.2 + p.wealth * 0.4 + sev * 0.25 + p.trust * 0.15;
    if (go) { p.hospital = { from: now + (12 + rng() * 30) * HOUR, until: now + (5 + rng() * 3) * DAY }; G.meta.clinic.stats.referred++; }
    enc.referWent = go;
  }
  const pay = payment(G, p, charges);
  collect(G, p, pay);
  const judged = judge(G, p, enc);
  p.visits.push({ t: now, dx: enc.dx, rx: enc.rx.map((r) => `${r.name} ${r.amount}${C.items.get(r.item).unit || ''} ×${r.perDay}/day ×${r.days}d`), instr: [...enc.instr], refer: enc.refer, paid: pay.cash, judged });
  p.trust = Math.min(1, p.trust + 0.1 + (counselled ? 0.05 : 0));
  p.leftBurden = p.conds.reduce((a, c) => a + (c.s || 0), 0);
  p.returnWhy = null;
  if (enc.returnDays) scheduleReturn(G, p, now + enc.returnDays * DAY, 'come for the check-up as you asked');
  p.status = enc.refer && enc.referWent ? 'hospital' : 'leaving';
  G.meta.clinic.stats.seen++;
  const xp = gainXp(G.p, 'diagnosis', judged.dxRight ? 6 : 2);
  G.meta.ledger.push({ t: now, kind: 'visit', pid: p.id, text: `Saw ${who(p)}: ${enc.dx.map((d) => COND.get(d).name).join(', ') || 'no diagnosis'}. Paid ${pay.cash} sh${pay.kind.length ? ' and ' + pay.kind.map(([id, n]) => `${n} ${C.items.get(id).name.toLowerCase()}`).join(', ') : ''}${pay.debt ? `, owes ${pay.debt} sh` : ''}.`, amount: pay.cash });
  return { pay, judged, referWent: enc.referWent, levelUp: xp };
}

/** How the visit looks with hindsight (shown later in the ledger, never during the visit). */
export function judge(G, p, enc) {
  const main = COND.get(p.mainCond);
  const dxRight = enc.dx.includes(p.mainCond);
  const given = new Set();
  for (const r of enc.rx) {
    const it = G.C.items.get(r.item);
    for (const a of Object.keys((r.route === 'topical' ? it.topical : it.actives) || {})) given.add(a);
    if (it.fluid) given.add('oral_fluid');
  }
  for (const pr of enc.proc) given.add(pr);
  for (const i of enc.instr) given.add(i);
  const T = main.teach;
  const helped = [...T.treat, ...T.helps].filter((a) => given.has(a));
  const harmed = T.harms.filter((a) => given.has(a) || (a === 'artemisinin_alone' && ['artemisinin', 'artemether', 'artesunate'].some((x) => given.has(x)) && !['quinine', 'lumefantrine'].some((x) => given.has(x))));
  const antibiotics = [...given].filter((a) => ACTIVE.get(a)?.abx);
  // an antibiotic for an illness no bacterium causes helps no one and breeds resistance for everyone
  const needless = main.params.org ? [] : antibiotics;
  // a dangerous bacterial illness (dysentery, pneumonia, typhoid) sent home without an antibiotic needed the health centre
  const needsRefer = (main.model === 'bacterial' && main.params.hazard >= 0.001 && !antibiotics.length) || main.id === 'pre_eclampsia';
  return { dxRight, truth: main.name, helped, harmed, needless, referredRight: needsRefer ? enc.refer : null };
}
