// encounter.js — the consultation. Asking, examining and testing cost minutes (the clock runs while
// you work); what you learn comes only from signs.js. You commit to a working diagnosis, prescribe
// (what, how much, how often, how long, by which route), counsel, perhaps refer, and are paid.
import { QUESTIONS, EXAMS, POINTS } from './content/findings.js';
import { COND, CONDITIONS } from './content/conditions.js';
import { ACTIVE } from './content/actives.js';
import { ORGANISMS } from './content/organisms.js';
import { signs } from './signs.js';
import { count, remove, countSpec } from './inventory.js';
import { HOUR, DAY, COMPRESS, day } from './time.js';
import { payment, collect, scheduleReturn, whoMsg, whoEn, selectPressure } from './clinic.js';
import { say, withEn } from './patient.js';
import { t, tm, msg, person, raw, localize, en, getLang } from './i18n.js';
import { gainXp } from './crafting.js';
import { stackPotency } from './crafting.js';
import { makeRng } from './rng.js';
import { gather, giveTea } from './homecare.js';
import { reactsTo } from './disease.js';
import { LAB_TESTS, LAB_TEST, LAB_POINTS } from './content/lab.js';
import { takeSample, readSample, labBlocker, playerSkill } from './lab.js';
import { labStaff, readBy } from './staff.js';
import { anaemiaCauses } from './signs.js';
import { visitKind } from './metrics.js';

// Advice, one thing each, grouped. `for`: who it can apply to (age, sex, pregnancy, a newborn), never the diagnosis, so
// the list gives nothing away. `days`: how long it is kept (game days; prevention is a habit that lasts longer). What each
// does lives with the illness (conditions.js `instr`, `reinfect`, `epi.prevent`) and in disease.js and clinic.js.
const adult = (p) => p.age >= 13, pregnant = (p) => p.pregnant > 0, newborn = (p) => p.age < 0.25;
export const INSTRUCTIONS = [
  { id: 'finish', group: 'Medicine', label: 'Explain each medicine; take every dose to the end, even when better', min: 3 },
  { id: 'supporter', group: 'Medicine', label: 'Choose someone at home to keep the tablets and watch every dose', min: 3 },
  { id: 'stop_home', group: 'Medicine', label: 'Stop the tea you have been giving at home', min: 1, for: (p) => p.rx.some((r) => r.home && !r.stopped) },
  // IMCI: tell the carer which signs mean "come back at once"; those told come back sooner when it turns bad (clinic.js)
  { id: 'danger_signs', group: 'When to come back', label: 'Come back at once if worse: cannot drink, breathing fast, very sleepy, a fit, bleeding', min: 2 },
  { id: 'feeding', group: 'Care at home', label: 'Keep eating and breastfeeding; give drinks often', min: 2 },
  { id: 'rest_move', group: 'Care at home', label: 'Keep moving gently; lift with the legs', min: 1, for: adult },
  { id: 'hot_compress', group: 'Care at home', label: 'Hot compresses 20 minutes, 4 times a day; raise the limb', min: 2 },
  { id: 'dressing', group: 'Care at home', label: 'Keep it covered with a clean cloth, changed daily', min: 1, needs: [['cloth', 2]] },
  { id: 'splint', group: 'Care at home', label: 'Splint or bind it firmly; keep it still and raised', min: 4, needs: [['cloth', 1]] },
  { id: 'low_salt', group: 'Care at home', label: 'Eat little salt', min: 2, for: adult },
  { id: 'diet', group: 'Care at home', label: 'No sugar or sweets; beans, whole grains and vegetables; lose weight if heavy', min: 3, for: adult },
  { id: 'hygiene', group: 'Prevention', label: 'Wash hands with soap, and the bottom every morning; cut nails short', min: 2 },
  { id: 'boil_water', group: 'Prevention', label: 'Boil the drinking water', min: 1, days: 60 },
  { id: 'latrine', group: 'Prevention', label: 'Use a latrine, never the open ground', min: 1, days: 60 },
  { id: 'shoes', group: 'Prevention', label: 'Wear shoes or sandals outside', min: 1, days: 60 },
  { id: 'net', group: 'Prevention', label: 'Sleep under a mosquito net, every night', min: 1, days: 60 },
  { id: 'wash_face', group: 'Prevention', label: 'Wash the children\'s faces with clean water every day', min: 1, days: 60 },
  { id: 'no_smoke', group: 'Prevention', label: 'Keep away from smoke and dust; cook outside or by an open window', min: 1, days: 60 },
  { id: 'treat_family', group: 'Family', label: 'Treat the whole family at once; boil or sun the clothes and bedding', min: 2 },
  // ——— infections (WTND p.239)
  { id: 'treat_partner', group: 'Family', label: 'Bring your partner for the same medicine; no sex until both are cured', min: 2, for: adult },
  // ——— childbirth and the newborn (WTND pp.254, 262–263, 266, 274, 405). `atBirth`: medicine she takes home and
  // takes herself as soon as the baby is born (disease.js), as community misoprostol programmes do.
  { id: 'clean_birth', group: 'Birth and the baby', label: 'For the birth: washed hands, a new razor blade, tie and cut the cord short, keep it dry', min: 3, for: pregnant },
  { id: 'miso_at_birth', group: 'Birth and the baby', label: 'Take the 3 misoprostol tablets as soon as the baby is born (never before)', min: 2, needs: [['miso_200', 3]], atBirth: { item: 'miso_200', amount: 3 }, for: pregnant },
  { id: 'sunlight', group: 'Birth and the baby', label: 'Feed the baby often; lay it undressed in bright light by a window (not in the sun)', min: 2, for: newborn },
  { id: 'kangaroo', group: 'Birth and the baby', label: 'Carry the baby skin to skin inside your clothes; breastfeed every 2 hours', min: 3, for: newborn },
];
// Shown text translates on read (i18n.js; Korean in i18n/ko/clinic.js). Code that needs the English uses en(row, 'label').
localize(INSTRUCTIONS, ['group', 'label']);
export const adviceFor = (p) => INSTRUCTIONS.filter((x) => !x.for || x.for(p));
export const PROCEDURES = [
  { id: 'clean', label: 'Clean the wound with soap and boiled water, remove dirt', min: 12, needs: [['soap', 1], ['cloth', 1]], station: 'hearth',
    applies: (p) => p.conds.some((c) => c.id.startsWith('wound') || c.id === 'burn_minor') },
];
localize(PROCEDURES, ['label']);

// The consultation log: enc.log = [{ who, text }]. `who`: 'Mother' | 'You' | 'Exam' (English keys) or person(name);
// `text`: a msg, an English key, or an array of these (one line). Show both with say() (or tm()).
const MOTHER = msg('Mother').$, YOU = msg('You').$, EXAM = msg('Exam').$;
// a name in a sentence: lowercased in English only (other languages have no case, or keep it)
const lc = (s) => (getLang() === 'en' ? s.toLowerCase() : s);
// one text from several (findings), duplicates dropped; a single one stays as it is
const parts = (list) => { const seen = new Set(), out = list.filter((x) => { const k = JSON.stringify(x); return !seen.has(k) && seen.add(k); }); return out.length === 1 ? out[0] : out; };

export function startEncounter(G, pid) {
  const p = G.meta.clinic.patients[pid];
  const enc = { pid, t0: G.W.time, log: [], found: {}, done: new Set(), dx: [], rx: [], instr: new Set(), proc: new Set(), refer: false, returnDays: 0 };
  // for the metrics (metrics.js): why they came, and how long they sat waiting first
  enc.kind = visitKind(p);
  enc.wait = p.status === 'waiting' && p.arrivedAt != null ? Math.max(0, G.W.time - p.arrivedAt) : null;
  const opener = p.returnWhy && p.visits.length ? returnLine(p) : p.complaintMsg ?? p.complaint;
  enc.log.push({ who: speaker(p), text: opener });
  p.status = 'consult';
  return enc;
}
const speaker = (p) => (p.age < 13 ? MOTHER : person(p.name));
/** What a returning patient says first (a msg; `en` keeps the English exact). why: an English key or a msg with `en`. */
function returnLine(p) {
  if (p.returnWhy === 'thanks') return p.age < 13 ? msg('We came to thank you — the child is well now.') : msg('We came to thank you — I is well now.');
  const why = p.returnWhy, whyEn = typeof why === 'string' ? why : why.en ?? why.$; // old saves: an English string
  return withEn(msg('We came back. {why}.', { why }), `We came back. ${cap(whyEn)}.`);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tools in your bag, and those kept on the clinic's shelves (the microscope stays on its shelf). */
export function toolsAt(G) {
  const s = new Set();
  for (const sl of G.p.inv.slots) if (sl && G.C.items.get(sl.id).tool) s.add(sl.id);
  for (const sh of G.W.shelves?.() || []) for (const sl of sh.inv.slots) if (sl && G.C.items.get(sl.id).tool) s.add(sl.id);
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
  const said = new Set(p.visits.length ? [] : p.says || []);
  const pos = [], neg = [];
  for (const k of qid === 'q_story' ? storyOf(p, F) : q.reveals) {
    const f = F[k];
    if (!f || f.v === '—') continue;
    // small children cannot say; parents miss things sometimes — but not what they came about
    const missed = f.pos && !said.has(k) && makeRng(p.seed, 'miss', k, Math.floor(G.W.time / DAY))() < (p.age < 3 ? 0.15 : 0.07);
    if (missed) { neg.unshift(msg('I have not noticed.')); continue; }
    enc.found[k] = f;
    (f.pos || q.all ? pos : neg).push(f.m ?? f.v); // f.m: the finding as a msg (signs.js), re-rendered in any language
  }
  const answer = pos.length ? parts(pos) : neg[0] || msg('No, nothing like that.');
  enc.log.push({ who: YOU, text: en(q, 'label') });
  enc.log.push({ who: speaker(p), text: answer });
  enc.done.add(qid);
  return say(answer);
}
// every finding a question can ask about (history, not examination)
const HISTORY_KEYS = new Set(QUESTIONS.flatMap((q) => q.reveals));
/** The open question: the main illness as they tell it — what they came about, then what else it gives them that they
 * would mention unprompted (its strongest history findings), and how long. */
function storyOf(p, F) {
  const w = (k) => POINTS[k]?.[p.mainCond] || 0;
  const more = [...HISTORY_KEYS].filter((k) => F[k]?.pos && w(k) > 0 && !p.says?.includes(k)).sort((a, b) => w(b) - w(a)).slice(0, 2);
  return [...(p.visits.length ? ['better'] : p.says || []), ...more, 'duration'];
}

/** Examine. Returns { ok, text } (needs the right tool). */
export function examine(G, enc, xid) {
  const p = G.meta.clinic.patients[enc.pid];
  const x = EXAMS.find((e) => e.id === xid);
  const tools = toolsAt(G);
  if (x.tool && !tools.has(x.tool)) return { ok: false, text: t('You need a {tool}.', { tool: lc(G.C.items.get(x.tool).name) }) };
  G.meta.time += x.min;
  const F = signs(p, G.W.time, tools);
  const lines = [];
  for (const k of x.reveals) {
    const f = F[k];
    if (!f || f.v === '—') continue;
    enc.found[k] = f;
    lines.push(f.m ?? f.v);
  }
  const seen = lines.length ? parts(lines) : msg('Nothing remarkable.');
  enc.log.push({ who: EXAM, text: msg('{exam}: {text}', { exam: en(x, 'label'), text: seen }), exam: xid });
  enc.done.add(xid);
  return { ok: true, text: say(seen) };
}

// ——— the laboratory (content/lab.js, lab.js)
export const labTests = () => LAB_TESTS;
/** Can this test be done now (and by whom)? null, or why not. */
export const labWhyNot = (G, testId) => labBlocker(G, LAB_TEST.get(testId), stockOf, toolsAt(G));
/** The blood counter: a control run on its first test of the day (one more reagent pack), and now and then a fault
 *  that needs the repair kit by post (estimates). Returns why it cannot run, or null. */
function counterReady(G) {
  const cl = G.meta.clinic, d = day(G.W.time);
  if (cl.counterBroken) {
    if (stockOf(G, 'counter_repair') < 1) return t('The blood counter shows a fault. It needs the repair kit (by post).');
    dispense(G, 'counter_repair', 1); cl.counterBroken = false;
  }
  if (cl.counterQC !== d) { if (stockOf(G, 'fbc_pack') < 2) return t('The blood counter needs a control run first: two reagent packs today.'); dispense(G, 'fbc_pack', 1); cl.counterQC = d; }
  return null;
}
/**
 * Do a test. by: 'you' (it takes your minutes; you read it with your lab skill) or 'staff' (your best laboratory
 * assistant takes the sample and reads it in their own time; the result comes when ready: labReady). The sample is
 * kept on the encounter (enc.samples) so you can read it again (recheck).
 */
export function runLab(G, enc, testId, by = 'you') {
  const p = G.meta.clinic.patients[enc.pid], T = LAB_TEST.get(testId);
  const why = labBlocker(G, T, stockOf, toolsAt(G)) || (T.method === 'counter' ? counterReady(G) : null);
  if (why) return { ok: false, text: why };
  const staff = by === 'staff' ? labStaff(G)[0] : null;
  if (by === 'staff' && !staff) return { ok: false, text: t('You have no laboratory assistant.') };
  let slideQ = 1;
  for (const [id, n] of T.uses) { const got = dispense(G, id, n); if (id === 'slide') slideQ = got.q; }
  // glass breaks now and then (lab.js LAB_TOOLS `breaks`)
  for (const id of T.needs) { const it = G.C.items.get(id); if (it.breaks && makeRng(p.seed, 'break', id, Math.floor(G.W.time))() < it.breaks) { removeTool(G, id); enc.log.push({ who: EXAM, text: msg('The {tool} broke.', { tool: en(it, 'name') }) }); } }
  if (T.method === 'counter' && makeRng(p.seed, 'counter', Math.floor(G.W.time))() < 0.003) G.meta.clinic.counterBroken = true;
  const now = G.W.time, sample = takeSample(p, testId, now, slideQ);
  (enc.samples ||= []).push(sample);
  enc.done.add(testId);
  if (staff) {
    // the assistant works at their own pace, quicker as they learn (estimate)
    const ready = now + T.min * (1.4 - 0.6 * staff.skill);
    (enc.labQ ||= []).push({ sample, by: staff.who, ready });
    enc.log.push({ who: YOU, text: msg('{test}: sent to the laboratory.', { test: en(T, 'label') }) });
    return { ok: true, text: t('Sent to the laboratory. The result will come.'), pending: true };
  }
  G.meta.time += T.min;
  const lv = gainXp(G.p, 'lab', 2);
  return { ...showLab(G, enc, p, sample, playerSkill(G.p), 'you'), level: lv };
}
/** Results the assistant has finished by now (call while the encounter is open). Returns the texts. */
export function labReady(G, enc) {
  const p = G.meta.clinic.patients[enc.pid], out = [];
  for (const j of [...(enc.labQ || [])]) {
    if (G.W.time < j.ready) continue;
    enc.labQ.splice(enc.labQ.indexOf(j), 1);
    const s = (G.meta.clinic.staff || []).find((x) => x.who === j.by);
    const r = showLab(G, enc, p, j.sample, s ? s.skill : 0.3, j.by);
    j.sample.readBy = j.by;
    if (s) readBy(s);
    out.push(r.text);
  }
  return out;
}
/** Read a slide again yourself (quality control): your own reading of the same cells. If an assistant read it first,
 *  telling them what you found teaches them twice as fast (staff.js readBy). */
export function recheck(G, enc, i) {
  const p = G.meta.clinic.patients[enc.pid], sample = enc.samples?.[i];
  if (!sample || !LAB_TEST.get(sample.test).bench) return { ok: false, text: t('Nothing to look at again.') };
  G.meta.time += Math.round(LAB_TEST.get(sample.test).min / 2);
  const s = sample.readBy && (G.meta.clinic.staff || []).find((x) => x.who === sample.readBy);
  if (s) readBy(s, true);
  gainXp(G.p, 'lab', 1);
  return showLab(G, enc, p, sample, playerSkill(G.p), 'recheck');
}
function showLab(G, enc, p, sample, skill, who) {
  const F = readSample(p, sample, skill, who), T = LAB_TEST.get(sample.test), lines = [];
  for (const [k, f] of Object.entries(F)) { enc.found[k] = f; lines.push(f.m); }
  const seen = lines.length ? parts(lines) : msg('Nothing remarkable.');
  enc.log.push({ who: EXAM, text: msg('{exam}: {text}', { exam: en(T, 'label'), text: seen }), lab: sample.test });
  return { ok: true, text: say(seen) };
}
/** Take one instrument out of the bag or off a shelf (it broke). */
function removeTool(G, id) {
  if (count(G.p.inv, id)) { remove(G.p.inv, id, 1); return; }
  for (const sh of G.W.shelves()) if (count(sh.inv, id)) { remove(sh.inv, id, 1); return; }
}

/** Ranked differential from what you found so far: [{ id, name, score }]. */
export function differential(enc) {
  const score = {};
  for (const [k, f] of Object.entries(enc.found)) {
    if (!f.pos) continue;
    for (const [c, w] of Object.entries(POINTS[k] || LAB_POINTS[k] || {})) score[c] = (score[c] || 0) + w;
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
  if (!toolsAt(G).has('syringe')) return { ok: false, text: t('You need a syringe.') };
  if (stockOf(G, itemId) < amount) return { ok: false, text: t('Not enough {item}.', { item: lc(it.name) }) };
  const name = en(it, 'name'); // saved records keep the English name (shown with tm())
  const { q } = dispense(G, itemId, amount);
  G.meta.time += 3;
  const now = G.W.time;
  p.rx.push({ item: itemId, name, q, left: amount, amount, perDay: 1, days: 1, start: now, route: 'inj', actives: it.actives, inj: it.inj, counselled: true });
  enc.rx.push({ item: itemId, name: it.name, amount, perDay: 1, days: 1, route: 'inj', qty: amount, given: now });
  for (const a of Object.keys(it.actives || {})) { const m = ACTIVE.get(a).abxAs || a; if (ORGANISMS.some((o) => m in o.mic)) selectPressure(G.meta.clinic, m); }
  const boiled = G.stations.has('hearth'), rectal = !!it.inj?.rectal; // a solution squirted into the anus (diazepam) leaves no abscess
  if (!rectal && makeRng(p.seed, 'abscess', now)() < (boiled ? 0.001 : 0.02)) (p.pending ||= []).push({ id: 'wound_infected', t: now + 48 * HOUR });
  if (!boiled && !rectal) {
    p.flags.dirtyNeedle = now;
    // hepatitis B from a syringe last used on a carrier (~8% of adults in East Africa carry it, ~30% of exposures to
    // an e-antigen carrier infect; ~1% overall, an estimate), 2–5 months later on the game calendar (WTND p.172)
    const r = makeRng(p.seed, 'hbv', now);
    if (r() < 0.01) (p.pending ||= []).push({ id: 'hepatitis', t: now + (60 + r() * 90) * DAY / COMPRESS });
  }
  // status only: tetanus toxoid doses counted (people.js ttProtected); DMPA protects ~3 months, in game days (people.js)
  if (it.vaccine) (p.vacc ||= {})[it.vaccine] = (p.vacc[it.vaccine] || 0) + 1;
  if (it.fp) p.fpUntil = day(now) + it.fp.days / COMPRESS;
  const done = rectal
    ? withEn(msg('Gave {item} with a syringe without a needle.', { item: name }), `Gave ${name.toLowerCase()} with a syringe without a needle.`)
    : withEn(msg('Injected {item}.', { item: name }), `Injected ${name.toLowerCase()}.`);
  const al = Object.keys(it.actives || {}).find((id) => reactsTo(p, id, itemId, now));
  // same draw as disease.js, so what you see now is what the body does
  const said = !al ? done : [done, makeRng(p.seed, 'ana', itemId, now, 0)() < 0.1 ? msg('Within minutes: cold grey sweat, a weak fast pulse, wheezing, the lips swelling — allergic shock!') : msg('Soon itchy welts rise on the skin.')];
  enc.log.push({ who: YOU, text: said });
  return { ok: true, text: say(said) };
}

export function doProcedure(G, enc, procId) {
  const p = G.meta.clinic.patients[enc.pid];
  const pr = PROCEDURES.find((x) => x.id === procId);
  if (pr.station && !G.stations.has(pr.station)) return { ok: false, text: t('You need boiled water: a hearth within reach.') };
  for (const [id, n] of pr.needs) if (stockOf(G, id) < n) return { ok: false, text: t('You need {item}.', { item: lc(G.C.items.get(id).name) }) };
  for (const [id, n] of pr.needs) dispense(G, id, n);
  G.meta.time += pr.min;
  for (const c of p.conds) if (c.id.startsWith('wound') || c.id === 'burn_minor') { c.dirt = (c.dirt ?? 0.3) * 0.15; c.I = Math.max(0, (c.I ?? 0) - 0.7); }
  enc.proc.add(procId);
  enc.log.push({ who: YOU, text: msg('{what}.', { what: en(pr, 'label') }) });
  return { ok: true, text: t('Done. The wound is clean.') };
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
      item: line.item, name: en(it, 'name'), q, left: qty, amount: line.amount, perDay: line.perDay, days: line.days, start: now, route: line.route,
      actives: line.route === 'oral' ? it.actives : undefined, topical: line.route === 'topical' ? it.topical : undefined,
      fluid: it.fluid ? { na: it.fluid.na * q } : undefined, counselled, bitter: !!it.bitter,
    });
  }
  if (enc.instr.has('stop_home')) for (const r of p.rx) if (r.home && !r.stopped) r.stopped = now;
  // sent to gather a plant near home and give it as a tea (homecare.js): they may not find it, or bring a lookalike
  if (enc.gather) {
    const got = gather(G, p, enc.gather, makeRng(p.seed, 'gather', p.visits.length));
    if (got) giveTea(G, p, got, enc.gather, now + 4 * HOUR, 5);
    enc.log.push({ who: speaker(p), text: got ? msg('We will look for it on the way home.') : msg('We do not know where that grows.') });
  }
  for (const id of enc.instr) {
    if (id === 'finish' || id === 'stop_home') continue;
    const ins = INSTRUCTIONS.find((x) => x.id === id);
    const line = { instr: id, name: en(ins, 'label'), start: now, until: now + (ins.days ?? 21) * DAY };
    if (ins.needs) for (const [nid, n] of ins.needs) if (stockOf(G, nid) >= n) {
      const { q } = dispense(G, nid, n);
      if (ins.atBirth?.item === nid) { const it = C.items.get(nid); line.atBirth = { item: nid, name: en(it, 'name'), amount: ins.atBirth.amount, left: ins.atBirth.amount, actives: it.actives, q }; charges += n * it.price; }
    }
    p.rx.push(line);
  }
  G.meta.time += [...enc.instr].reduce((a, id) => a + INSTRUCTIONS.find((x) => x.id === id).min, 0);
  // referral: whether they go depends on money, how sick they feel, and whether they trust you
  if (enc.refer) {
    const rng = makeRng(p.seed, 'refer', p.visits.length);
    const sev = Math.min(1, p.conds.reduce((a, c) => a + (c.sev ?? c.s ?? 0), 0));
    const go = rng() < 0.2 + p.wealth * 0.4 + sev * 0.25 + p.trust * 0.15;
    if (go) { p.hospital = { from: now + (12 + rng() * 30) * HOUR, until: now + (5 + rng() * 3) * DAY }; G.meta.clinic.stats.referred++; }
    // near her time, she waits at the hospital until the baby comes (WTND p.252) and a few days after
    if (go && p.pregnant >= 34) p.hospital.until = Math.max(p.hospital.until, now + (((40 - p.pregnant) * 7) / COMPRESS + 3) * DAY);
    enc.referWent = go;
  }
  const pay = payment(G, p, charges);
  collect(G, p, pay);
  const judged = judge(G, p, enc);
  // rx: English lines (old saves have only these); rxMsg: the same as msgs, shown with tm() in any language
  const rxOf = (r) => ({ item: en(C.items.get(r.item), 'name'), amount: r.amount, unit: C.items.get(r.item).unit || '', perDay: r.perDay, days: r.days });
  const rxEn = (v) => `${v.item} ${v.amount}${v.unit} ×${v.perDay}/day ×${v.days}d`;
  // units: symbols stay (g, ml); words translate ('unit|vial')
  const unitMsg = (u) => (!u || u === 'g' || u === 'ml' ? raw(u) : { $: u, ctx: 'unit' });
  p.visits.push({ t: now, burden: p.conds.reduce((a, c) => a + (c.s || 0), 0), dx: enc.dx, rx: enc.rx.map((r) => rxEn(rxOf(r))), rxMsg: enc.rx.map((r) => { const v = rxOf(r); return msg('{item} {amount}{unit} ×{perDay}/day ×{days}d', { ...v, unit: unitMsg(v.unit) }); }), instr: [...enc.instr], refer: enc.refer, paid: pay.cash, judged,
    kind: enc.kind, min: Math.round(G.W.time - enc.t0), wait: enc.wait == null ? undefined : Math.round(enc.wait), billed: pay.total, back: enc.returnDays || undefined });
  p.trust = Math.min(1, p.trust + 0.1 + (counselled ? 0.05 : 0));
  p.leftBurden = p.conds.reduce((a, c) => a + (c.s || 0), 0);
  p.returnWhy = null;
  if (enc.returnDays) scheduleReturn(G, p, now + enc.returnDays * DAY, msg('come for the check-up as you asked'));
  p.status = enc.refer && enc.referWent ? 'hospital' : 'leaving';
  G.meta.clinic.stats.seen++;
  const xp = gainXp(G.p, 'diagnosis', judged.dxRight ? 6 : 2);
  G.meta.ledger.push({ t: now, kind: 'visit', pid: p.id, ...visitNote(G, p, enc, pay), amount: pay.cash });
  return { pay, judged, referWent: enc.referWent, levelUp: xp };
}

/** The ledger line for a visit: { text (English), msg (any language; `en` the exact English) }. */
function visitNote(G, p, enc, pay) {
  const { C } = G;
  const dxNames = enc.dx.map((d) => en(COND.get(d), 'name'));
  const kindEn = pay.kind.map(([id, n]) => `${n} ${en(C.items.get(id), 'name').toLowerCase()}`);
  const text = `Saw ${whoEn(p)}: ${dxNames.join(', ') || 'no diagnosis'}. Paid ${pay.cash} sh${kindEn.length ? ' and ' + kindEn.join(', ') : ''}${pay.debt ? `, owes ${pay.debt} sh` : ''}.`;
  const v = { who: whoMsg(p), dx: dxNames.length ? list(dxNames) : msg('no diagnosis'), cash: pay.cash, debt: pay.debt, kind: list(pay.kind.map(([id, n]) => msg('{n} {item}', { n, item: en(C.items.get(id), 'name') }))) };
  const m = pay.kind.length
    ? (pay.debt ? msg('Saw {who}: {dx}. Paid {cash} sh and {kind}, owes {debt} sh.', v) : msg('Saw {who}: {dx}. Paid {cash} sh and {kind}.', v))
    : pay.debt ? msg('Saw {who}: {dx}. Paid {cash} sh, owes {debt} sh.', v) : msg('Saw {who}: {dx}. Paid {cash} sh.', v);
  return { text, msg: { ...m, en: text } };
}
/** "a, b, c" as one msg (any language). */
const list = (xs) => xs.reduce((a, x) => (a === null ? x : msg('{a}, {b}', { a, b: x })), null);

/** Names of what judge() lists (helped, harmed, needless: actives, advice, procedures), shown in the current language. */
export function givenName(id) {
  const a = ACTIVE.get(id), ins = INSTRUCTIONS.find((x) => x.id === id), pr = PROCEDURES.find((x) => x.id === id);
  if (a) return a.name;
  if (ins) return ins.label;
  if (pr) return pr.label;
  if (id === 'oral_fluid') return t('rehydration drink');
  if (id === 'artemisinin_alone') return t('artemisinin given alone');
  return id;
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
  const needsRefer = (main.model === 'bacterial' && main.params.hazard >= 0.001 && !antibiotics.length) || main.id === 'pre_eclampsia' || !!T.mustRefer;
  // thin blood: why, in this body (signs.js anaemiaCauses); what they caught on your bench (contagion.js)
  const anaemic = main.id === 'anaemia' || main.id === 'hookworm' || p.hb < 9;
  const causes = anaemic ? anaemiaCauses(p) : undefined;
  const caught = (p.caught || []).filter((c) => c.where === 'bench').map((c) => c.cond);
  return { dxRight, truth: en(main, 'name'), helped, harmed, needless, referredRight: needsRefer ? enc.refer : null, causes, caught: caught.length ? caught : undefined };
}
