// signs.js — what a patient shows right now, computed from the true state of their body. The encounter
// only ever sees these (never the hidden state): history answers, what you see, feel, hear, count and
// measure. Some findings are missed by chance — a mother may not have noticed, a crackle can be faint.
// Each finding: { v: text, pos: abnormal?, n?: number, m: the text as a msg }. `v` is in the language of the moment;
// `m` (JSON-safe: a msg, a string or an array of them) re-renders it in any language with say() (patient.js; tm() but for
// the exact English a msg may carry in `en`). A finding that does not
// apply is the literal '—' (never translated).
import { COND } from './content/conditions.js';
import { drugState } from './pk.js';
import { sinceMsg, sinceWords, say } from './patient.js';
import { makeRng, hashf } from './rng.js';
import { HERB } from './content/herbs.js';
import { ACTIVES } from './content/actives.js';
import { ttProtected } from './people.js';
import { tetanusVaccinated } from './disease.js';
import { msg, tm, raw, en } from './i18n.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const HOUR = 60;
// The same English said as an exam finding rather than an answer (dictionary key 'exam|…'): Korean words them differently.
const exam = (key) => ({ $: key, ctx: 'exam' });

export function normalRR(age) { return age < 1 ? 36 : age < 5 ? 28 : age < 12 ? 22 : 16; }
export function fastRR(age) { return age < 1 / 6 ? 60 : age < 1 ? 50 : age < 5 ? 40 : age < 12 ? 30 : 24; }
export function normalHR(age) { return age < 1 ? 125 : age < 5 ? 105 : age < 12 ? 90 : 76; }

/** Core physiological readings (also used by the HUD of an admitted patient). */
export function vitals(p, t) {
  const ds = drugState(p, t);
  const rng = makeRng(p.seed, 'vitals', Math.floor(t / 10));
  const cond = (id) => p.conds.find((c) => c.id === id);
  let fever = 0, cold = 0;
  for (const c of p.conds) {
    const P = COND.get(c.id).params;
    if (c.id === 'malaria') {
      const I = Math.min(0.95, (c.I || 0) + (c.acq || 0));
      const ph = ((t / HOUR + c.phase) % 48) / 48;
      const tertian = Math.max(0, Math.cos(2 * Math.PI * ph)) ** 4;
      fever = Math.max(fever, c.s * 2.8 * lerp(0.55 + 0.45 * tertian, 0.1 + 0.9 * tertian, I));
    } else if (P.fever && c.s) fever = Math.max(fever, lerp(P.fever[0], P.fever[1], clamp(c.s, 0, 1)));
    if ((c.id.startsWith('wound') || c.id === 'burn_minor') && c.I > 4.5) fever = Math.max(fever, (c.I - 4.5) * 0.9);
  }
  fever *= 1 - (ds.relief.fever || 0);
  if (p.lastTox?.includes('anticholinergic_severe')) fever += 1.5;
  for (const c of p.conds) { const k = COND.get(c.id).params.cold; if (k) cold = Math.max(cold, k * (c.s || 0)); } // a cold baby
  const temp = Math.round((36.8 + fever - cold + (rng() - 0.5) * 0.3) * 10) / 10;
  const d = p.hyd / p.weight;
  const hf = cond('heart_failure'), pn = cond('pneumonia'), mal = cond('malaria'), pe = cond('pre_eclampsia') || cond('eclampsia'), ty = cond('typhoid');
  const shock = Math.max(0, ...p.conds.map((c) => c.shock || 0)); // blood loss (disease.js bleeding)
  const hb = Math.min(p.hb, ...p.conds.filter((c) => c.hb !== undefined).map((c) => c.hb));
  let hr = normalHR(p.age) + fever * 10 + Math.max(0, d - 0.04) * 700 + Math.max(0, 8 - hb) * 6 + (hf ? hf.V * 6 - 18 * ds.heart : 0) - (ty?.s || 0) * 18; // typhoid: a pulse slow for the fever
  if (p.lastTox?.some((s) => s.startsWith('anticholinergic'))) hr += 35;
  if (p.lastTox?.includes('digitalis_arrhythmia')) hr = Math.min(hr, 48);
  let rr = normalRR(p.age) + fever * 2 + (pn ? pn.s * (p.age < 5 ? 34 : 16) : 0) + (d > 0.08 ? 10 : 0) + (mal ? mal.sev * 8 : 0) + (hf && hf.V > 3.5 ? (hf.V - 3.5) * 5 : 0);
  const cx = chronicVitals(p); hr += cx.hr; rr += cx.rr; // chronic illness and emergencies (below)
  hr += shock * 45; rr += (cond('newborn_sepsis')?.s || 0) * 25;
  hr = Math.round(hr + (rng() - 0.5) * 8); rr = Math.round(rr + (rng() - 0.5) * 4);
  const bpS = cx.bp + Math.round((p.age < 12 ? 98 : 118 + Math.max(0, p.age - 40) * 0.5) + (pe ? 25 + pe.sev * 45 : 0) - (d > 0.08 ? 20 : 0) - shock * 45 + (rng() - 0.5) * 8);
  const bpD = Math.round(cx.bp * 0.5) + Math.round((p.age < 12 ? 60 : 76) + (pe ? 14 + pe.sev * 25 : 0) - shock * 25 + (rng() - 0.5) * 6);
  return { temp, hr, rr, bpS, bpD, d, hb, ds, irregular: !!p.lastTox?.some((s) => s === 'digitalis_arrhythmia' || s === 'quinine_toxic') };
}

/** Every finding the patient has now. tools: Set of tool ids in reach (stethoscope, magnifier…). */
export function signs(p, t, tools = new Set()) {
  const V = vitals(p, t);
  const F = {};
  const rng = makeRng(p.seed, 'signs', Math.floor(t / (6 * HOUR)));
  const cond = (id) => p.conds.find((c) => c.id === id);
  const any = (fn) => p.conds.some(fn);
  const d = V.d, child = p.age < 13, infant = p.age < 1.5;
  const set = (k, m, pos, n) => { F[k] = { v: m === '—' ? '—' : say(m), m, pos: !!pos, n }; };

  const main = p.conds.find((c) => c.id === p.mainCond) || p.conds[0];
  if (main) {
    const h = ((t - main.t0) / HOUR) * (COND.get(main.id).params.pace || 1); // "since yesterday", "for two weeks"
    set('duration', { ...msg('{when}.', { when: sinceMsg(h) }), en: cap(sinceWords(h)) + '.' }, false); // en: the English as said, capitalized
  } else set('duration', msg('It is better now.'), false);

  // ——— stools, vomiting, water
  let stools = 0, blood = false;
  for (const c of p.conds) {
    const P = COND.get(c.id).params;
    if (P.stool) stools += P.stool.perDay * clamp(c.s, 0, 1.3) * (1 - (V.ds.relief.stool || 0)) * (1 + (V.ds.worse.stool || 0));
    if (P.blood && c.s > 0.15) blood = true;
  }
  stools += (V.ds.worse.stool || 0) * 6;
  stools = Math.round(stools);
  const gi = (cond('giardia')?.s || 0) > 0.2;
  if (stools >= 3) set('stools', blood ? msg('{n} loose stools a day, small, with blood and slime.', { n: stools }) : gi ? msg('{n} loose stools a day, yellow, frothy and foul.', { n: stools }) : msg('{n} loose stools a day, watery.', { n: stools }), true, stools);
  else set('stools', msg('Stools are normal.'), false);
  if (blood) set('blood_stool', msg('Yes — blood and mucus in the stool.'), true);
  const wd = cond('watery_diarrhea');
  const vom = (cond('pyelonephritis')?.s || 0) > 0.4 || (wd && wd.age < 48 && wd.s > 0.3) || (cond('malaria')?.s > 0.6 && child) || cond('nausea_pregnancy')?.s > 0.3 || p.lastTox?.includes('digitalis_gi') || p.lastTox?.includes('cinchonism');
  set('vomiting', vom ? msg('Yes, vomiting.') : msg('No vomiting.'), !!vom);
  set('drinking', d > 0.09 ? msg('Too weak to drink.') : d > 0.04 ? msg('Drinks eagerly, wants more.') : msg('Drinking normally.'), d > 0.04);
  set('thirst', d > 0.03 ? msg('Very thirsty.') : msg('Not especially thirsty.'), d > 0.03);
  set('urine', p.lastTox?.includes('kidney_injury') ? msg('Almost no urine, even after drinking.') : d > 0.09 ? msg('No urine since yesterday.') : d > 0.04 ? msg('Very little urine, dark yellow.') : msg('Passing urine normally.'), d > 0.04);
  set('sunken_eyes', d > 0.05 ? msg('Eyes look sunken.') : msg('Eyes normal.'), d > 0.05);
  set('dry_mouth', d > 0.04 || p.lastTox?.some((s) => s.startsWith('anticholinergic')) ? msg('Mouth and tongue are dry.') : msg('Mouth moist.'), d > 0.04);
  set('tears', d > 0.06 ? msg('No tears when crying.') : msg('Tears normal.'), d > 0.06);
  set('skin_pinch', d > 0.09 ? msg('Skin pinch goes back VERY slowly (more than 2 seconds).') : d > 0.055 ? msg('Skin pinch goes back slowly.') : msg('Skin pinch goes back at once.'), d > 0.055);
  if (infant) set('fontanel', d > 0.05 ? msg('The soft spot is sunken.') : msg('Soft spot is level.'), d > 0.05);

  // ——— general
  const mal = cond('malaria'), pn = cond('pneumonia');
  const ty = cond('typhoid');
  const sick = p.lastTox?.some((s) => ['reye', 'iron_severe', 'iron_lethal', 'opioid_resp', 'sjs', 'benzo_resp'].includes(s)) || (ty?.s || 0) > 0.85 || (mal?.sev || 0) > 0.9 || (pn?.s || 0) > 0.85 || d > 0.09 || any((c) => c.I > 6.5) || p.lastTox?.includes('anticholinergic_severe');
  set('alert', sick ? (p.lastTox?.includes('anticholinergic_severe') ? msg('Confused, picking at the air, agitated.') : msg('Very weak and drowsy, hard to wake.')) : msg('Awake and alert.'), sick);
  set('pallor', V.hb < 6 ? msg('Palms and inner eyelids very pale (white).') : V.hb < 8.5 ? msg('Palms and eyelids pale.') : msg('Good colour.'), V.hb < 8.5);
  set('thin', p.nutrition < 0.7 ? msg('Very thin, ribs and shoulder bones show.') : p.nutrition < 0.8 ? msg('Thin.') : msg('Well nourished.'), p.nutrition < 0.8);
  const anti = p.lastTox?.some((s) => s.startsWith('anticholinergic'));
  set('flushed', anti ? msg('Skin hot, dry and red.') : V.temp > 39 ? msg('Face flushed with fever.') : msg('Normal skin colour.'), anti || V.temp > 39);
  set('pupils', anti ? msg('Pupils wide, barely react to light.') : msg('Pupils normal.'), anti);
  set('yellow_vision', p.lastTox?.includes('digitalis_gi') ? msg('Says things look yellow-green.') : '—', !!p.lastTox?.includes('digitalis_gi'));

  // ——— fever
  set('feels_hot', V.temp > 38.8 ? msg('Hot to the touch.') : V.temp > 37.8 ? msg('Warm.') : V.temp < 35.5 ? msg('Cold to the touch.') : msg('Not hot.'), V.temp > 37.8 || V.temp < 35.5);
  const deg = raw(V.temp.toFixed(1));
  set('temp', V.temp < 35.5 ? msg('{deg} °C — too cold', { deg }) : msg('{deg} °C', { deg }), V.temp >= 37.6 || V.temp < 35.5, V.temp);
  const febrile = any((c) => (COND.get(c.id).params.fever && c.s > 0.1) || (c.id === 'malaria' && c.s > 0.1));
  set('fever_hx', febrile ? msg('Yes, fever.') : msg('No fever.'), febrile);
  if (mal && mal.s > 0.15) {
    set('chills', msg('Shaking chills, then burning fever, then sweating.'), true);
    const I = (mal.I || 0) + (mal.acq || 0);
    set('fever_pattern', I > 0.25 || rng() < 0.5 ? msg('The fever comes back every second day.') : msg('Fever most of the time, worse at night.'), true);
  }
  set('fever_rising', ty && ty.s > 0.2 ? msg('The fever has climbed a little higher every day.') : '—', !!(ty && ty.s > 0.2));
  const headache = (ty?.s || 0) > 0.3 || (mal?.s || 0) > 0.3 || ((cond('pre_eclampsia') || cond('eclampsia'))?.sev || 0) > 0.4 || (cond('common_cold')?.s || 0) > 0.6;
  set('headache', headache ? msg('Yes, the head is paining.') : msg('No headache.'), headache);

  // ——— breathing
  const cold = cond('common_cold'), cc = cond('cough_child'), hf = cond('heart_failure'), ms = cond('measles'), st = cond('strep_throat'), ear = cond('ear_infection');
  const cough = Math.max((cold?.s || 0) * COND.get('common_cold').params.cough, (ms?.s || 0) * 0.8, cc?.s || 0, pn?.s || 0, hf && hf.V > 4 ? 0.5 : 0) * (1 - (V.ds.relief.cough || 0));
  set('cough', cough > 0.15 ? (pn?.s > 0.2 ? msg('Cough, with yellow or rusty phlegm.') : msg('A dry cough.')) : msg('No cough.'), cough > 0.15);
  set('night_cough', (cc?.s || 0) > 0.3 && (V.ds.relief.cough || 0) < 0.5 ? msg('Coughs most at night, keeps the house awake.') : msg('Not worse at night.'), (cc?.s || 0) > 0.3);
  const runny = (cold?.s || 0) > 0.2 || (ms?.s || 0) > 0.3;
  set('runny', runny ? msg('Runny, blocked nose.') : msg('No runny nose.'), runny);
  set('throat', (st?.s || 0) > 0.15 ? msg('A very sore throat; it hurts to swallow.') : (cold?.s || 0) > 0.4 ? msg('Sore throat.') : msg('Throat fine.'), (st?.s || 0) > 0.15 || (cold?.s || 0) > 0.4);
  set('tonsils', (st?.s || 0) > 0.2 ? msg('Tonsils swollen and red, with white spots of pus.') : (cold?.s || 0) > 0.4 ? msg('The throat is a little red; no pus.') : msg('Throat looks normal.'), (st?.s || 0) > 0.2);
  set('neck_glands', (st?.s || 0) > 0.25 || (ear?.s || 0) > 0.5 ? msg('Tender swollen lumps under the jaw.') : msg('No swollen glands in the neck.'), (st?.s || 0) > 0.25 || (ear?.s || 0) > 0.5);
  set('ear_pain', (ear?.s || 0) > 0.05 ? (p.age < 4 ? msg('Cries, pulls and rubs at one ear, worse lying down.') : msg('A deep throbbing pain in one ear.')) : msg('No ear pain.'), (ear?.s || 0) > 0.05);
  const mst = cond('mastoiditis');
  set('mastoid', (mst?.s || 0) > 0.2 ? msg('A hot, tender swelling behind the ear pushes the ear forward.') : msg('Behind the ears normal.'), (mst?.s || 0) > 0.2);
  const burst = (ear?.s || 0) > 0.35 && makeRng(p.seed, 'eardrum')() < 0.35;
  set('ear_pus', burst ? msg('Yellow pus in the ear canal: the eardrum has burst.') : msg('No pus in the ears.'), burst);
  const eyes = (ms?.s || 0) > 0.3;
  set('red_eyes', eyes ? msg('Eyes red and watering; the light hurts them.') : '—', eyes);
  set('rr', V.rr >= fastRR(p.age) ? msg('{n} breaths a minute — FAST for this age.', { n: V.rr }) : msg('{n} breaths a minute.', { n: V.rr }), V.rr >= fastRR(p.age), V.rr);
  set('hr', V.irregular ? msg('{n} beats a minute, irregular.', { n: V.hr }) : msg('{n} beats a minute.', { n: V.hr }), V.hr > normalHR(p.age) + 25 || V.hr < 55 || V.irregular, V.hr);
  set('pulse_regular', V.irregular ? msg('Irregular, skipping beats.') : msg('Regular.'), V.irregular);
  set('indrawing', (pn?.s || 0) > 0.55 && p.age < 12 ? msg('The skin between the ribs sucks in with each breath.') : msg('No chest drawing in.'), (pn?.s || 0) > 0.55 && p.age < 12);
  set('grunting', (pn?.s || 0) > 0.8 && p.age < 5 ? msg('Grunts with each breath out.') : msg('No grunting.'), (pn?.s || 0) > 0.8 && p.age < 5);
  const crack = (pn?.s || 0) > 0.3 || (hf?.V || 0) > 4;
  const heard = crack && rng() < (tools.has('stethoscope') ? 0.92 : 0.6);
  set('crackles', heard ? ((pn?.s || 0) > 0.3 ? msg('Crackles over one side of the chest.') : msg('Fine crackles at the bottom of both lungs.')) : msg('Chest sounds clear.'), heard);
  set('breathless_walk', (hf?.V || 0) > 2 ? msg('Gets breathless on the path, must stop.') : msg('No.'), (hf?.V || 0) > 2);
  set('orthopnea', (hf?.V || 0) > 3.5 ? msg('Must sleep sitting up or wakes gasping.') : msg('Sleeps flat.'), (hf?.V || 0) > 3.5);

  // ——— belly, worms, skin
  const asc = cond('ascaris'), pin = cond('pinworm'), sc = cond('scabies');
  set('spleen', mal && (mal.age > 72 || (mal.I || 0) > 0.3) && mal.para > 800 && p.age > 1 ? msg('Spleen enlarged — felt below the left ribs.') : msg('No spleen felt.'), !!(mal && (mal.age > 72 || (mal.I || 0) > 0.3) && mal.para > 800 && p.age > 1));
  const tender = ['dysentery', 'amoebiasis', 'typhoid'].some((id) => (cond(id)?.s || 0) > 0.3);
  set('tender', tender ? msg('Belly tender all over, cramping.') : msg('Belly soft.'), tender);
  const ut = cond('uti');
  set('suprapubic', (ut?.s || 0) > 0.25 ? msg('Tender low in the belly, just above the bone.') : '—', (ut?.s || 0) > 0.25);
  const rs = (ty?.s || 0) > 0.5 && rng() < 0.3;
  set('rose_spots', rs ? msg('A few faint rose-pink spots on the belly that fade when pressed.') : '—', rs);
  const gb = cond('giardia');
  set('bloating', (gb?.s || 0) > 0.25 ? msg('The belly swells with gas.') : msg('No bloating.'), (gb?.s || 0) > 0.25);
  set('burps', (gb?.s || 0) > 0.3 ? msg('Burps that smell of rotten eggs.') : msg('No.'), (gb?.s || 0) > 0.3);
  const am = cond('amoebiasis');
  set('stool_on_off', am && am.age > 120 ? msg('The loose stools come and go, on and off for weeks.') : '—', !!(am && am.age > 120));
  set('stool_frothy', gi ? msg('Yes — frothy, greasy, they float and stink.') : '—', gi);
  set('constipation', (ty?.s || 0) > 0.3 && p.age >= 12 ? msg('Hard stools, few, for days.') : '—', (ty?.s || 0) > 0.3 && p.age >= 12);
  // urine
  set('dysuria', (ut?.s || 0) > 0.15 ? (p.age < 5 ? msg('Cries when passing urine.') : msg('Yes — it burns like fire when passing urine.')) : msg('No burning.'), (ut?.s || 0) > 0.15);
  set('frequency', (ut?.s || 0) > 0.2 ? msg('Passes urine very often, a little each time.') : msg('No.'), (ut?.s || 0) > 0.2);
  set('cloudy_urine', (ut?.s || 0) > 0.35 ? msg('The urine is cloudy and smells strong.') : msg('Urine looks clear.'), (ut?.s || 0) > 0.35);
  const py = cond('pyelonephritis');
  set('loin_pain', (py?.s || 0) > 0.2 ? msg('Sharp pain when the back over the kidney is tapped.') : msg('No pain over the kidneys.'), (py?.s || 0) > 0.2);
  set('pot_belly', (asc?.W || 0) > 18 && p.age < 12 ? msg('Swollen pot belly.') : msg('Belly normal size.'), (asc?.W || 0) > 18 && p.age < 12);
  const wr = makeRng(p.seed, 'wormseen')(), sawWorm = ((asc?.W || 0) > 4 && wr < 0.6) || ((pin?.W || 0) > 10 && wr < 0.45);
  set('worms_seen', sawWorm ? ((asc?.W || 0) > 4 ? msg('Yes, a long white worm came out in the stool.') : msg('Tiny white threads in the stool.')) : msg('No worms seen.'), sawWorm);
  const burrows = (sc?.M || 0) > 3 && rng() < (tools.has('magnifier') ? 0.85 : 0.5);
  set('burrows', burrows ? msg('Small bumps and fine wavy lines between the fingers and on the wrists.') : (sc?.s || 0) > 0.2 ? msg('Scratch marks, but no clear burrows seen.') : msg('Skin clear.'), burrows);
  set('skin_sores', (sc?.I || 0) > 1 ? msg('Scratched bumps with pus and crusts.') : '—', (sc?.I || 0) > 1);
  const mrash = !!ms && ms.age > 72 && ms.age < ms.D - 24;
  set('measles_rash', mrash ? msg('A blotchy red rash, from the face and behind the ears down over the body.') : '—', mrash);
  set('koplik', ms && ms.age > 36 && ms.age < 100 ? msg('Tiny white spots like grains of salt inside the cheeks.') : msg('Inside of the mouth normal.'), !!(ms && ms.age > 36 && ms.age < 100));
  set('rash_hx', mrash ? msg('Yes — it began on the face and went down the body.') : (p.allergicUntil || 0) > t ? msg('Yes — itchy lumps all over since the medicine.') : msg('No rash.'), mrash || (p.allergicUntil || 0) > t);

  // ——— wounds and burns
  const w = p.conds.find((c) => c.id.startsWith('wound')), b = cond('burn_minor');
  if (w) {
    const cm = raw(w.size.toFixed(1)), dirt = w.dirt > 0.4;
    set('wound_size', w.heal > 0.7 ? (dirt ? msg('A wound {cm} cm long, nearly closed, dirt in it.', { cm }) : msg('A wound {cm} cm long, nearly closed.', { cm }))
      : w.heal > 0.3 ? (dirt ? msg('A wound {cm} cm long, healing at the edges, dirt in it.', { cm }) : msg('A wound {cm} cm long, healing at the edges.', { cm }))
      : dirt ? msg('A wound {cm} cm long, open, dirt in it.', { cm }) : msg('A wound {cm} cm long, open.', { cm }), true);
    set('pus', w.I > 3 ? msg('Pus in the wound, bad smell.') : msg('No pus.'), w.I > 3);
    set('redness', w.I > 2 ? msg('Red, hot and swollen around it.') : msg('Little redness.'), w.I > 2);
    set('red_streaks', w.I > 5 ? msg('Red lines run up the limb from the wound.') : msg('No red streaks.'), w.I > 5);
    set('glands', w.I > 4.5 ? msg('Swollen tender lymph nodes above the wound.') : msg('No swollen glands.'), w.I > 4.5);
  }
  if (b) {
    set('burn_area', msg('Burn covering about {pct}% of the body ({palms} of the patient\'s palms).', { pct: raw(b.tbsa.toFixed(1)), palms: raw((b.tbsa).toFixed(0)) }), true, b.tbsa);
    set('blisters', b.deep ? msg('Part of it is white and leathery, with no feeling.') : msg('Red, wet and blistered.'), true);
    set('burn_deep', b.deep ? msg('Deep burn.') : msg('Partial-thickness burn.'), b.deep);
    if (b.I > 3) set('pus', msg('The burn is oozing pus and smells.'), true);
  }
  set('injury_how', w || b ? (p.complaint ? p.complaintMsg ?? p.complaint : msg('An accident at home.')) : msg('No injury.'), !!(w || b)); // the complaint as they said it (a msg)

  // ——— pain, swelling, pregnancy
  const rf = cond('rheumatic_fever');
  set('joints', (rf?.s || 0) > 0.15 ? msg('Wrists and ankles swollen, hot and red; the pain has moved from joint to joint.') : msg('Joints normal.'), (rf?.s || 0) > 0.15);
  const bp = cond('back_pain');
  const relief = V.ds.relief.pain || 0;
  set('pain_site', rf && rf.s > 0.15 ? msg('The joints — first the ankles, now the wrists.') : py && py.s > 0.2 ? msg('In the side of the back, one side.') : bp ? (bp.s * (1 - relief) > 0.4 ? msg('Low back, bad, worse bending and lifting.') : msg('Low back, aching, worse bending and lifting.')) : wd || cond('dysentery') ? msg('Cramps in the belly.') : w ? msg('The wound pains.') : b ? msg('The burn pains.') : msg('No particular pain.'), !!(rf?.s > 0.15 || py?.s > 0.2 || bp || wd || cond('dysentery') || w || b));
  set('cramp', (cond('amoebiasis')?.s || 0) > 0.2 || (cond('dysentery')?.s || 0) > 0.2 || (wd?.s || 0) > 0.4 ? ((V.ds.relief.cramp || 0) > 0.4 ? msg('Cramping belly pains (eased by the remedy).') : msg('Cramping belly pains.')) : msg('No cramps.'), (cond('dysentery')?.s || 0) > 0.2 || (wd?.s || 0) > 0.4);
  set('back_exam', bp ? msg('Tender muscles beside the lower spine; legs strong, feeling normal.') : msg('Back normal.'), !!bp);
  const pe = cond('pre_eclampsia') || cond('eclampsia');
  const ed = (hf?.V || 0) > 2 || (pe?.sev || 0) > 0.2 || (p.pregnant > 30) || V.hb < 5;
  set('edema', ed ? ((hf?.V || 0) > 4 ? msg('Pitting swelling up to the shins.') : (pe?.sev || 0) > 0.2 ? msg('Feet, hands and face swollen; finger press leaves a dent.') : msg('Mild ankle swelling.')) : exam('No swelling.'), (hf?.V || 0) > 2 || (pe?.sev || 0) > 0.2);
  if (p.sex === 'f' && p.age >= 13) set('pregnancy', p.pregnant ? msg('Yes — monthly bleeding stopped about {n} months ago.', { n: Math.round(p.pregnant / 4.3) }) : msg('Not pregnant.'), !!p.pregnant, p.pregnant);
  const np = cond('nausea_pregnancy');
  set('nausea_preg', (np?.s || 0) > 0.2 ? ((V.ds.relief.nausea || 0) > 0.3 ? msg('Sick every morning, a little better with the remedy.') : msg('Sick every morning.')) : '—', (np?.s || 0) > 0.2);
  set('vision', (pe?.sev || 0) > 0.5 ? msg('Sees spots and blurred.') : msg('Vision fine.'), (pe?.sev || 0) > 0.5);
  set('bp', msg('{sys}/{dia} mmHg', { sys: V.bpS, dia: V.bpD }), V.bpS >= 140 || V.bpD >= 90, V.bpS);

  // ——— childbirth and the newborn (WTND chapter 19)
  const ol = cond('obstructed_labour'), pph = cond('pph'), mc = cond('miscarriage'), ect = cond('ectopic'), ecl = cond('eclampsia'), ps = cond('puerperal_sepsis');
  const nsep = cond('newborn_sepsis'), cord = cond('cord_infection'), nt = cond('newborn_tetanus'), jd = cond('newborn_jaundice'), cb = cond('cold_baby'), mast = cond('mastitis');
  const woman = p.sex === 'f' && p.age >= 13 && p.age < 50, baby = p.age < 0.25;
  const since = p.delivered != null ? (t - p.delivered) / (24 * HOUR) : null;
  if (woman) {
    set('postpartum', since == null ? msg('No birth lately.') : since < 1 ? msg('Gave birth {n} hours ago.', { n: Math.max(1, Math.round(since * 24)) }) : msg('Gave birth {n} days ago.', { n: Math.round(since) }), since != null && since < 42);
    set('labour_hx', ol ? msg('Labour pains for {n} hours; the waters broke long ago, and the baby does not come down.', { n: Math.round(ol.age) }) : p.pregnant >= 37 ? msg('No labour pains yet.') : '—', !!ol);
    const bleed = [pph, mc, ect].filter(Boolean).reduce((a, c) => Math.max(a, c.rup || !c.id.startsWith('ect') ? c.rate : 0), 0);
    set('bleeding_pv', bleed > 150 ? msg('Blood pours from the birth opening, soaking cloth after cloth, with clots.') : bleed > 30 ? msg('Steady bleeding from the vagina, with clots.') : bleed > 10 ? msg('Bleeding with clots, less than before.') : ect ? msg('A little dark bleeding, on and off.') : msg('No heavy bleeding.'), bleed > 10 || !!ect);
    set('pelvic_pain', ect ? (ect.rup ? msg('Sudden terrible pain in the belly; feels faint.') : msg('A sharp pain low in the belly, on one side.')) : mc ? msg('Painful cramps with the bleeding.') : (ps?.s || 0) > 0.2 ? msg('Pain low in the belly.') : '—', !!(ect || mc || (ps?.s || 0) > 0.2));
    set('discharge', (ps?.s || 0) > 0.2 ? msg('A foul-smelling discharge from the birth opening.') : '—', (ps?.s || 0) > 0.2);
    set('womb', ol ? msg('The womb is hard and tight; the baby\'s head has not come down into the hips.')
      : pph && pph.rate > 30 ? msg('The womb is soft and big, above the navel; it firms a little when rubbed.')
      : ect ? msg('The womb is small; a tender lump to one side, low in the belly.')
      : (ps?.s || 0) > 0.2 ? msg('The womb is tender, soft and larger than it should be.')
      : p.pregnant > 12 ? (p.pregnant < 20 ? msg('The womb is below the navel: about {n} months.', { n: Math.round(p.pregnant / 4.3) })
        : p.pregnant < 24 ? msg('The womb is at the navel: about {n} months.', { n: Math.round(p.pregnant / 4.3) }) : msg('The womb is above the navel: about {n} months.', { n: Math.round(p.pregnant / 4.3) }))
      : since != null && since < 10 ? msg('The womb is hard, like a ball, below the navel.') : msg('Belly normal.'), !!(ol || (pph && pph.rate > 30) || ect || (ps?.s || 0) > 0.2));
    set('breast', (mast?.s || 0) > 0.15 ? msg('Part of one breast is hot, red, swollen and very tender; a sore lump in the armpit.') : msg('Breasts normal.'), (mast?.s || 0) > 0.15);
    const tt = ttProtected(p.vacc, p.who ?? p.seed);
    set('tt_hx', tt ? msg('Yes, two tetanus injections or more.') : msg('No tetanus injections that I know of.'), !tt);
  }
  const fitAgo = ecl?.last != null ? (t - ecl.last) / HOUR : Infinity;
  set('fits_hx', fitAgo < 24 ? msg('Yes — went stiff, then shook all over, and would not wake for a while.') : (nt?.s || 0) > 0.2 ? msg('Stiff spasms when touched or at a noise; the back arches.') : msg('No fits.'), fitAgo < 24 || (nt?.s || 0) > 0.2);
  if (baby) {
    const weak = (nsep?.s || 0) > 0.3 || (cb?.s || 0) > 0.4 || (jd?.s || 0) > 0.8;
    set('suck', (nt?.s || 0) > 0.2 ? msg('Wants to suck but cannot open the mouth.') : weak ? msg('Will not suck; sleepy and floppy.') : msg('Sucks well.'), weak || (nt?.s || 0) > 0.2);
    set('lockjaw', (nt?.s || 0) > 0.2 ? msg('The jaw is clamped shut; the face fixed in a grin; spasms when touched.') : msg('Jaw opens normally.'), (nt?.s || 0) > 0.2);
    set('cord', (cord?.s || 0) > 0.15 ? msg('The cord stump is red, swollen and hot around the navel, with pus and a bad smell.') : msg('The cord stump is clean and dry.'), (cord?.s || 0) > 0.15);
    const yellow = (jd?.s || 0) > 0.2 || (nsep?.s || 0) > 0.6;
    set('jaundice', yellow ? msg('Skin and the whites of the eyes are yellow.') : msg('No yellow colour.'), yellow);
  }
  if ((pph?.shock || 0) > 0.5 || (ect?.shock || 0) > 0.5 || (mc?.shock || 0) > 0.5 || fitAgo < 2 || (ps?.s || 0) > 0.8 || (nsep?.s || 0) > 0.6 || (cb?.s || 0) > 0.7 || (ol?.s || 0) > 0.9)
    set('alert', msg('Very weak and drowsy, hard to wake.'), true);

  // ——— medicines and their effects
  // allergy: most who are truly allergic remember a reaction; a few who are not believe they are
  const said = makeRng(p.seed, 'allergy-said')();
  const thinks = p.allergy ? said < 0.7 : said < 0.05;
  set('allergy_hx', thinks ? (p.allergy === 'aspirin' ? msg('Yes — aspirin once made it hard to breathe.') : msg('Yes — penicillin gave a rash and swelling once.')) : msg('No allergies that I know of.'), thinks);
  const hives = (p.allergicUntil || 0) > t;
  if (hives) set('itch', msg('Itchy lumps all over since the medicine.'), true);
  set('rash', p.lastTox?.includes('sjs') ? msg('Blisters and peeling skin over the body; raw sores in the mouth and red eyes.') : hives ? msg('Raised, itchy pale welts over the body (hives); the lips are a little swollen.') : exam('No rash.'), hives);
  // English names, looked up when shown (a home tea from an older save has no label: rebuild it)
  const nameOf = (r) => r.label ?? (r.home && HERB.get(r.meant) ? msg('{herb} tea (gathered at home)', { herb: en(HERB.get(r.meant), 'name') }) : r.name);
  const taking = (p.rx || []).filter((r) => !r.instr && !r.stopped && r.left > 0).map(nameOf);
  // the plant itself, if you ask to see it: what it really is, whatever they call it
  const home = (p.rx || []).find((r) => r.home && !r.stopped);
  const hb = home && HERB.get(home.home), herb = hb && en(hb, 'name');
  set('herb_seen', home ? (hb.latin ? msg('They show you the plant: {herb} ({latin}).', { herb, latin: raw(hb.latin) }) : msg('They show you the plant: {herb}.', { herb })) : '—', !!home && home.home !== home.meant);
  set('meds_taken', taking.length ? msg('Taking: {list}.', { list: seq(taking, ',') }) : msg('Nothing yet.'), false);
  const tox = [];
  if (hives) tox.push(msg('an itchy rash all over'));
  for (const s of p.lastTox || []) tox.push(toxWords(s));
  set('tox_symptoms', tox.length ? msg('Complains of: {list}.', { list: seq(tox, ';') }) : msg('No new complaints from the medicine.'), tox.length > 0);
  const poorly = p.conds.some((c) => (c.s || 0) > 0.35);
  set('appetite', poorly ? msg('Eating little.') : msg('Eating well.'), poorly);
  const hw = cond('hookworm');
  set('pica', p.age < 13 && (hw?.s || 0) > 0.3 ? msg('Yes — eats earth and clay when no one is looking.') : msg('No.'), p.age < 13 && (hw?.s || 0) > 0.3);
  set('fatigue', V.hb < 9 ? msg('Tired all the time; breathless going up the hill.') : msg('Not especially tired.'), V.hb < 9);
  set('weight_loss', p.nutrition < 0.75 || (asc?.W || 0) > 30 ? msg('Has become thinner.') : msg('No.'), p.nutrition < 0.75);
  set('weight', msg('{kg} kg', { kg: raw(p.weight.toFixed(1)) }), false, p.weight);
  if (p.age >= 0.5 && p.age < 5) {
    const muac = Math.round((13.6 + (p.nutrition - 0.85) * 14) * 10) / 10;
    const cm = raw(muac.toFixed(1));
    set('muac', muac < 11.5 ? msg('{cm} cm — SEVERE malnutrition (red)', { cm }) : muac < 12.5 ? msg('{cm} cm — moderate malnutrition (yellow)', { cm }) : msg('{cm} cm (green)', { cm }), muac < 12.5, muac);
  }
  // ——— chronic illness and emergencies (WTND chapters 10, 11, 13, 22)
  {
    const tox = p.lastTox || [];
    const as = cond('asthma'), fit = p.conds.find((c) => COND.get(c.id).model === 'fits'), str = cond('stroke'), ht = cond('hypertension');
    const mal = cond('marasmus'), kw = cond('kwashiorkor'), db = cond('diabetes'), go = cond('goitre'), ul = cond('ulcer'), ar = cond('arthritis');
    const sn = cond('snakebite'), sc = cond('scorpion_sting'), ke = cond('kerosene'), fr = cond('fracture'), sp = cond('sprain');
    // breathing
    const wz = (as?.s || 0) > 0.15, wzHeard = wz && (as.s > 0.4 || tools.has('stethoscope'));
    set('wheeze', wzHeard ? (as.s > 0.6 ? msg('Loud wheezing all over the chest; the breath out is long and whistling.') : msg('Wheezing on breathing out.')) : msg('No wheeze.'), wzHeard);
    set('attacks', as ? msg('Yes — attacks like this before, worse at night, with colds, smoke or dust.') : msg('No attacks like this before.'), !!as);
    if ((as?.s || 0) > 0.55) { set('indrawing', msg('The skin between the ribs and above the collar bones sucks in with each breath.'), true); set('cough', msg('Coughing, with a tight chest.'), true); }
    if ((as?.s || 0) > 0.95) set('alert', msg('Fighting for each breath, cannot finish a sentence; the lips are going blue.'), true);
    if ((ke?.s || 0) > 0.2) { set('cough', msg('A choking cough.'), true); if (ke.s > 0.5) set('crackles', msg('Crackles over both lungs.'), true); }
    set('swallowed', ke ? msg('Yes — kerosene, from a soda bottle.') : msg('Nothing like that.'), !!ke);
    set('breath_smell', ke && ke.age < 24 ? msg('The breath smells of kerosene.') : msg('No unusual smell on the breath.'), !!(ke && ke.age < 24));
    // fits
    if (fit) {
      const ep = fit.id === 'epilepsy', many = Math.max(1, Math.round(fit.rate * 30));
      set('fits_hx', ep ? msg('Yes — falls, stiffens and jerks, the eyes roll up, then sleeps. About {n} a month.', { n: many }) : msg('Yes — with the fever: stiff, then jerking, a few minutes, then slept.'), true);
      if (fit.status) set('alert', msg('Fitting now: jerking all over, eyes rolled back, does not answer.'), true);
      else if (fit.ago < 2) set('alert', msg('Dull and sleepy after the fit.'), true);
    } else if (!F.fits_hx?.pos) set('fits_hx', msg('No fits.'), false); // eclampsia and newborn tetanus set it above
    if (tox.includes('barb_drowsy') || tox.includes('benzo_drowsy')) set('alert', msg('Very sleepy and unsteady, words slurred.'), true);
    if (tox.includes('barb_resp') || tox.includes('benzo_resp')) set('alert', msg('Cannot be woken; breathing slow and shallow.'), true);
    // stroke
    const right = makeRng(p.seed, 'side')() < 0.5;
    if (str && str.s > 0.1) {
      set('weak_side', str.s > 0.5 ? (right ? msg('The right arm and leg are limp, cannot lift them; the other side strong.') : msg('The left arm and leg are limp, cannot lift them; the other side strong.'))
        : right ? msg('The right arm and leg are weak; the other side strong.') : msg('The left arm and leg are weak; the other side strong.'), true);
      set('face_droop', right ? msg('The right side of the face droops when smiling.') : msg('The left side of the face droops when smiling.'), str.s > 0.25);
      set('speech', str.s > 0.35 ? msg('The words come out slurred and wrong.') : msg('Speaks clearly.'), str.s > 0.35);
      set('stroke_hx', msg('Yes — it came suddenly, all at once.'), true);
      if (str.s > 0.8 && str.age < 72) set('alert', msg('Unconscious, breathing noisy, face reddish.'), true);
    } else {
      set('weak_side', msg('Both sides equally strong.'), false);
      set('stroke_hx', msg('No.'), false);
    }
    // high blood pressure, diabetes, goitre, ulcer
    if ((ht?.L || 0) > 45 && !F.headache?.pos) set('headache', msg('Yes, headaches often, and dizzy spells.'), true);
    const sugar = (db?.L || 0) > 4.5;
    set('polyuria', sugar ? msg('Yes — passes much urine, day and night, and is always thirsty.') : msg('No.'), sugar);
    if (sugar) set('thirst', msg('Always thirsty.'), true);
    set('hunger', (db?.L || 0) > 6 ? msg('Always hungry, yet losing weight.') : msg('Normal appetite.'), (db?.L || 0) > 6);
    if ((db?.L || 0) > 8) set('weight_loss', msg('Has become thinner.'), true);
    set('urine_sugar', sugar ? msg('Sweet! The others agree it is the sweetest urine.') : msg('Not sweet.'), sugar);
    set('foot_numb', (db?.L || 0) > 8 ? msg('The feet are numb and burn; a dry crack on one heel.') : msg('Feeling in the feet normal.'), (db?.L || 0) > 8);
    set('goitre', go ? (go.L > 1.6 ? msg('A large soft swelling on the front of the neck that moves up on swallowing.') : go.L > 0.8 ? msg('A swelling on the front of the neck, seen when the head is tilted back.') : msg('The thyroid is felt a little enlarged.')) : msg('No lump in the neck.'), !!go && go.L > 0.5);
    const burn = (ul?.s || 0) > 0.15;
    set('epigastric', burn ? ((V.ds.relief.acid || 0) > 0.3 ? msg('Yes — a burning in the pit of the stomach, eased by eating, worse at night and when hungry (the medicine calms it).') : msg('Yes — a burning in the pit of the stomach, eased by eating, worse at night and when hungry.')) : msg('No stomach pain.'), burn);
    const tar = (ul?.L || 0) > 0.8 && rng() < 0.3;
    set('black_stool', tar ? msg('Black, sticky stools like tar.') : msg('Stools a normal colour.'), tar);
    if ((ul?.s || 0) > 0.3 && !F.tender?.pos) set('tender', msg('Tender in the pit of the stomach.'), true);
    // malnutrition
    const thinHair = (kw?.s || 0) > 0.3 || (mal?.L || 0) > 0.35;
    set('hair', thinHair ? msg('Thin, straight, pale hair that pulls out easily.') : msg('Hair normal.'), thinHair);
    set('skin_patches', (kw?.s || 0) > 0.4 ? msg('Dark peeling patches on the legs, like old paint flaking.') : '—', (kw?.s || 0) > 0.4);
    if ((kw?.s || 0) > 0.25) set('edema', msg('Feet, hands and face swollen; a finger press leaves a dent.'), true);
    if (p.age < 6) set('diet_hx', mal || kw ? msg('Thin maize porridge, twice a day; stopped the breast early. Sad, does not play.') : msg('Eats with the family, three or more times a day.'), !!(mal || kw));
    // bites, stings, injuries
    set('bite_hx', sn ? msg('Yes — a snake, in the grass: brown and thick.') : sc ? msg('Yes — a scorpion, in the firewood.') : msg('No bite or sting.'), !!(sn || sc));
    set('fang_marks', sn ? msg('Two fang marks a finger-width apart.') : '—', !!sn);
    set('sting_mark', sc ? msg('A tiny red puncture, very tender to touch.') : '—', !!sc);
    if (sn) {
      const sw = sn.D0 > 0 && !sn.neuro;
      set('local_swelling', sw ? (sn.D0 > 1 ? msg('Swelling up past the knee, blistered and dark near the bite.') : msg('Swelling around the bite, spreading.')) : msg('Little swelling.'), sw);
      set('bleeding', !sn.neuro && sn.s > 0.4 ? msg('Blood oozes from the gums and the bite; the urine is red.') : msg('No bleeding.'), !sn.neuro && sn.s > 0.4);
      set('ptosis', sn.neuro && sn.s > 0.4 ? msg('The eyelids droop; cannot keep the eyes open; speech thick.') : msg('Eyelids normal.'), sn.neuro && sn.s > 0.4);
      set('pain_site', msg('The bite burns and throbs.'), true);
    }
    if (sc) {
      set('sting_systemic', sc.s > 0.4 ? msg('Sweating, drooling, restless jerking movements.') : msg('No sweating or drooling.'), sc.s > 0.4);
      set('pain_site', msg('Burning pain at the sting, spreading up the limb.'), true);
    }
    if (fr || sp) {
      const l = fr || sp, eased = 1 - (V.ds.relief.pain || 0);
      set('deformity', fr ? msg('The forearm is bent just above the wrist, swollen; it grates and hurts terribly when moved.') : msg('The bones lie straight.'), !!fr);
      set('swollen_joint', sp ? msg('The ankle is swollen and bruised; standing on it hurts.') : '—', !!sp);
      const bad = l.s * eased > 0.4;
      set('pain_site', fr ? (bad ? msg('The broken arm, bad.') : msg('The broken arm, aching.')) : bad ? msg('The twisted ankle, bad.') : msg('The twisted ankle, aching.'), true);
      set('injury_how', p.complaint ? p.complaintMsg ?? p.complaint : msg('A fall.'), true);
    }
    if (ar) {
      set('joints', msg('Knees and finger joints thick, stiff and creaking; little heat.'), true);
      set('pain_site', ar.s * (1 - (V.ds.relief.pain || 0)) > 0.4 ? msg('The knees and hands, bad, worse after work.') : msg('The knees and hands, aching, worse after work.'), true);
    }
  }
  infectionSigns(p, F, set);
  followUp(p, t, set);
  return F;
}

// ——— chronic illness and emergencies: what they add to pulse, breathing and blood pressure
function chronicVitals(p) {
  const c = (id) => p.conds.find((q) => q.id === id), tox = p.lastTox || [];
  const as = c('asthma'), ht = c('hypertension'), ke = c('kerosene'), sn = c('snakebite'), sc = c('scorpion_sting');
  let hr = 0, rr = 0, bp = 0;
  if (as) { rr += as.s * (p.age < 5 ? 30 : 18); hr += as.s * 30; }
  if (ht) bp += Math.round(ht.L);
  if (p.conds.some((q) => q.status)) hr += 30; // fitting
  if (ke) rr += ke.s * (p.age < 5 ? 35 : 18);
  if (sn) { hr += sn.s * 30; bp -= Math.round(sn.s * 25); } // bleeding into the limb: shock
  if (sc) { hr += sc.s * 40; bp += Math.round(sc.s * 20); } // the venom's adrenaline storm
  if (tox.includes('beta_tremor') || tox.includes('adrenaline_fast')) hr += 25;
  if (tox.includes('beta_toxic')) hr += 50;
  if (tox.includes('barb_resp') || tox.includes('benzo_resp')) rr -= 8;
  if (tox.includes('ccb_shock')) bp -= 40;
  return { hr, rr, bp };
}

// ——— infections (WTND chapters 13–18, 21 and pp.399–403). Each row: [finding, { condition: test(c, p) }, text, normal
// text]. The finding shows when any listed condition passes its test, overriding a normal answer from above; text may be
// a function of (c, p, F). Tests read only the condition's true state.
const above = (min) => (c) => (c.s || 0) > min;
const wk = 7 * 24; // real hours: the slow (paced) conditions keep their age in real-time hours
const STI = ['gonorrhoea', 'chlamydia', 'syphilis', 'trichomonas', 'chancroid'];
const SHOWN = [
  ['cough', { tb: above(0.1) }, msg('A cough for weeks, worst on waking, with thick spit.')],
  ['blood_sputum', { tb: above(0.55) }, msg('Yes — there has been blood in the spit.'), msg('No blood in the spit.')],
  ['night_sweats', { tb: above(0.15), tb_nodes: above(0.4), hiv: above(0.3) }, msg('Sweats soak the bed at night; a slight fever most evenings.'), msg('No night sweats.')],
  ['crackles', { tb: above(0.45) }, msg('Crackles high up in the chest, at the top of one lung.')],
  ['weight_loss', { tb: (c) => c.waste > 0.04, tb_nodes: (c) => c.waste > 0.04, hiv: (c) => c.waste > 0.04 }, msg('Yes — much thinner over the months; the clothes hang loose.')],
  ['thin', { tb: (c) => c.waste > 0.12, hiv: (c) => c.waste > 0.12 }, msg('Wasted: ribs, cheekbones and shoulder blades stand out.')],
  ['neck_glands', { tb_nodes: above(0.1), hiv: above(0.2), syphilis: (c) => c.age > 6 * wk && c.age < 24 * wk },
    (c) => (c.id === 'tb_nodes' ? msg('Big, firm, painless lumps in the neck; one has opened and drains pus.') : msg('Swollen glands in the neck, armpits and groin.'))],
  ['skin_patch', { leprosy: (c) => c.A > 4 }, msg('A pale patch with no clear border, not scaly, not itchy.'), msg('No odd patches on the skin.')],
  ['patch_feeling', { leprosy: (c) => c.A > 4.5 }, msg('Cannot feel the wisp of cotton or the pin inside the patch.'), msg('Feels the cotton everywhere.')],
  ['thick_nerves', { leprosy: (c) => c.A > 6 || c.nerve > 0.1 }, msg('The nerve at the elbow and the one behind the ear are thick like cords.'), msg('Nerves feel normal.')],
  ['numb_hands', { leprosy: (c) => c.nerve > 0.2 }, msg('Hands and feet numb; old burns and cuts that were never felt.'), msg('Feeling in hands and feet is normal.')],
  ['claw', { leprosy: (c, p) => (p.flags.nerve || 0) > 0.5 }, msg('The fingers are clawed and one foot drops.'), msg('Hands and feet move normally.')],
  ['nodules', { leprosy: (c) => c.A > 8.5 }, msg('Lumps on the face, thick lumpy ear lobes, eyebrows gone thin.'), msg('No lumps.')],
  ['lockjaw', { tetanus: above(0.12) }, msg('Cannot open the mouth more than a finger\'s width: the jaw is locked.'), msg('Opens the mouth normally.')],
  ['spasms', { tetanus: above(0.45) }, msg('Painful spasms arch the back and clench the fists at a touch or a noise.'), msg('No spasms.')],
  ['stiff_neck', { tetanus: above(0.3), meningitis: above(0.25) }, msg('The neck is stiff: the head will not bend forward to the chest.'), msg('The neck bends freely.')],
  ['knee_jerk', { tetanus: above(0.2), meningitis: above(0.5) }, msg('The leg jumps high.'), msg('A small, normal jump.')],
  ['injury_how', { tetanus: (c, p) => p.age >= 0.1 }, msg('Stepped on a nail about two weeks ago; the wound was not cleaned.')],
  ['tetanus_cord', { tetanus: (c, p) => p.age < 0.1 }, msg('The baby stopped sucking and cries all the time; the cord stump is dirty.'), '—'],
  ['headache', { meningitis: above(0.2), hiv: above(0.7) }, msg('Yes, a terrible headache.')],
  ['vomiting', { meningitis: above(0.3), cholera: above(0.3), hepatitis: above(0.4), pid: above(0.6) }, msg('Yes, vomiting.')],
  ['alert', { meningitis: above(0.6) }, msg('Very drowsy, confused, hard to wake.')],
  ['fontanel', { meningitis: (c, p) => p.age < 1.5 && c.s > 0.3 }, msg('The soft spot bulges.')],
  ['petechiae', { meningitis: (c) => c.org === 'n_meningitidis' && c.s > 0.5 }, msg('Small dark red spots on the skin that do not fade when pressed.'), msg('No spots.')],
  ['stools', { cholera: above(0.15) }, (c, p, F) => msg('{n} or more stools a day like rice water, pouring out.', { n: Math.max(10, F.stools?.n || 0) })],
  ['jaundice', { hepatitis: (c) => c.age > 72 && c.s > 0.2 }, msg('The whites of the eyes are yellow.'), msg('Whites of the eyes are white.')],
  ['urine', { hepatitis: (c) => c.age > 48 && c.s > 0.2 }, msg('The urine is dark, like tea or cola.')],
  ['pale_stool', { hepatitis: (c) => c.age > 72 && c.s > 0.3 }, msg('The stools have gone pale, almost white.'), msg('Stools a normal colour.')],
  ['liver_tender', { hepatitis: above(0.2) }, msg('Tender under the right ribs; the liver edge can be felt.'), msg('Nothing tender under the ribs.')],
  ['discharge', { gonorrhoea: above(0.1), chlamydia: above(0.25), trichomonas: above(0.1), pid: above(0.2) },
    (c, p) => (c.id === 'trichomonas' ? msg('A thin, foamy, greenish-yellow discharge that smells bad.') : c.id === 'gonorrhoea' && p.sex === 'm' ? msg('Drops of pus from the penis.') : c.id === 'chlamydia' ? msg('A little thin, clear discharge.') : msg('A yellow-green discharge.')),
    msg('No discharge.')],
  ['dysuria', { gonorrhoea: (c, p) => c.s > (p.sex === 'm' ? 0.1 : 0.4), chlamydia: above(0.35), trichomonas: above(0.4) }, msg('Yes — it burns when passing urine.')],
  ['genital_sore', { syphilis: (c) => c.age < 6 * wk, chancroid: above(0.15) },
    (c) => (c.id === 'syphilis' ? msg('One painless sore with a clean base and a hard edge.') : msg('Several soft, ragged, painful sores that bleed easily.')), msg('No sores.')],
  ['bubo', { chancroid: above(0.4) }, msg('A swollen, tender lump in the groin, ready to burst.'), msg('No lumps in the groin.')],
  ['syph_rash', { syphilis: (c) => c.age > 6 * wk && c.age < 24 * wk && c.s > 0 }, msg('A rash of copper-coloured spots, even on the palms and soles; sores in the mouth.'), '—'],
  ['partner_sx', Object.fromEntries(STI.map((id) => [id, (c, p) => hashf(p.seed, 0, 1, 7717) < 0.6])), msg('Yes — my partner has the same trouble.'), msg('No one I know of.')],
  ['pelvic_pain', { pid: above(0.2) }, msg('Tender low in the belly on both sides; pain on moving.'), '—'],
  ['thrush', { hiv: above(0.4) }, msg('White patches inside the mouth that scrape off, leaving it red (thrush).'), msg('Mouth clean.')],
  ['crusts', { impetigo: (c) => c.I > 1 }, msg('Sores with shiny honey-yellow crusts around the mouth and nose, and on the arms.'), msg('No crusted sores.')],
  ['red_patch', { cellulitis: above(0.15) }, msg('A hot, bright red, swollen, very tender patch that has spread since yesterday.'), msg('No red patch.')],
  ['rings', { tinea: (c) => c.M > 2 }, msg('Round scaly rings with a raised edge, clearing in the middle.'), msg('No rings.')],
  ['red_eyes', { conjunctivitis: above(0.1), trachoma: above(0.1), eye_injury: (c) => c.heal < 1 },
    (c) => (c.id === 'conjunctivitis' ? msg('Both eyes red with yellow pus; the lids stick together.') : c.id === 'trachoma' ? msg('Both eyes red and watering.') : msg('One eye red and watering, squeezed shut against the light.'))],
  ['follicles', { trachoma: (c) => c.age > 4 * wk && c.s > 0.1 }, msg('Under the turned-back upper lid: pinkish-grey lumps (follicles), and grey vessels at the top of the cornea.'), msg('Inside of the lids smooth.')],
  ['eye_scratch', { eye_injury: (c) => c.heal < 1 || c.I > 2 },
    (c) => (c.I > 3 ? msg('A painful grey spot on the clear front of the eye, red all round it: an ulcer.') : msg('A small scratch on the clear front of the eye.')), msg('The front of the eye is clear.')],
  ['vision', { eye_injury: (c) => c.I > 4 }, msg('Sight blurred in the hurt eye.')],
  ['pox', { chickenpox: above(0.1) }, msg('Small blisters like drops of water, some crusted, thickest on the body.'), '—'],
  ['parotid', { mumps: above(0.15) }, msg('A painful swelling below and in front of the ear, at the angle of the jaw.'), msg('No swelling by the jaw.')],
];
// what a patient calls a trouble from a medicine (a sign from pk.js / disease.js), in the order they are looked for:
// the older medicines, then the TB and other long courses, then the active's own words, then the newer medicines
const TOX_SAID = { tinnitus: msg('ears ringing'), cinchonism: msg('ears ringing, dizzy, sick'), quinine_toxic: msg('cannot see well'), digitalis_gi: msg('nausea, sees yellow'),
  digitalis_arrhythmia: msg('heart stumbling'), anticholinergic: msg('mouth dry as dust, heart racing'), anticholinergic_severe: msg('seeing things that are not there'),
  marrow: msg('tired, bruises easily'), grey_baby: msg('the baby is grey and floppy'), kidney_injury: msg('hardly any urine'), sjs: msg('blisters, peeling skin, sore mouth and eyes'),
  reye: msg('vomiting, then drowsy and confused'), iron_gi: msg('vomiting, belly pain'), iron_severe: msg('vomiting blood, very drowsy'), iron_lethal: msg('cannot be woken'),
  vita_acute: msg('headache and vomiting'), zinc_gi: msg('vomiting, cramps'), opioid_withdrawal: msg('aching, yawning, loose stools, sleepless') };
const TOX_WORDS = { orange_urine: msg('urine and tears orange'), tb_hepatitis: msg('yellow eyes, no appetite, vomiting'), pza_joints: msg('aching joints'), optic_neuritis: msg('colours fading, sight blurred'),
  ototoxic: msg('ears ringing, dizzy, hearing less'), methaemoglobin: msg('blue lips, breathless'), dapsone_syndrome: msg('fever and a spreading rash'), benzo_drowsy: msg('very sleepy'),
  benzo_resp: msg('cannot be woken'), benzo_withdrawal: msg('shaking, anxious, sleepless'), serum_sickness: msg('fever, rash, aching joints') };
const TOX_NEW = { beta_tremor: msg('hands trembling, heart racing'), beta_toxic: msg('heart racing and stumbling'), adrenaline_fast: msg('heart pounding'), steroid_mood: msg('cannot sleep, restless'),
  barb_drowsy: msg('very sleepy, unsteady'), barb_resp: msg('cannot be woken'), benzo_drowsy: msg('very sleepy'), benzo_resp: msg('cannot be woken'),
  barb_withdrawal: msg('shaking and sleepless since stopping the medicine'), benzo_withdrawal: msg('anxious, shaking, sleepless since stopping the medicine'),
  adrenal_crisis: msg('weak, faint, vomiting since stopping the medicine'), low_potassium: msg('weak, cramping muscles'), ankle_swelling: msg('swollen ankles'),
  ccb_shock: msg('faint and cold'), iodine_hyper: msg('shaky, sweating, losing weight'), serum_sickness: msg('fever, rash, aching joints') };
function toxWords(s) {
  const own = ACTIVES.flatMap((a) => [...(a.toxic || []), a.dependence || {}]).find((x) => x.sign === s);
  return TOX_SAID[s] || TOX_WORDS[s] || (own && en(own, 'text')) || TOX_NEW[s] || raw(s); // English content text: looked up when shown
}
/** A list as nested msgs ("a, b, c" / "a; b; c"), so it re-renders in any language. */
function seq(items, sep) {
  return items.reduce((a, b) => (a == null ? b : sep === ';' ? msg('{a}; {b}', { a, b }) : msg('{a}, {b}', { a, b })), null);
}
function infectionSigns(p, F, set) {
  for (const [k, on, v, no] of [...SHOWN, ...HISTORY]) {
    const c = p.conds.find((x) => on[x.id]?.(x, p, F));
    if (c) set(k, typeof v === 'function' ? v(c, p, F) : v, true);
    else if (!F[k] && no) set(k, no, false);
  }
  set('tetanus_vax', tetanusVaccinated(p) ? msg('Yes, all the tetanus injections.') : msg('Never had the tetanus injections.'), !tetanusVaccinated(p));
}

// ——— what the patient tells (history), across illnesses. Same rows as SHOWN; a row overrides a normal answer from above.
// Every claim in an opening complaint (conditions.js `says`) must be answered here or above (test/history.test.mjs).
const always = () => true;
const secondary = (c) => c.age > 6 * wk && c.age < 24 * wk && c.s > 0; // secondary syphilis
const HISTORY = [
  ['itch', { scabies: above(0.2), pinworm: (c) => c.W > 10, chickenpox: above(0.1), tinea: (c) => c.M > 2, impetigo: (c) => c.I > 1, trichomonas: above(0.1), trachoma: above(0.1) },
    (c) => ({ scabies: msg('Itching all over, much worse at night.'), pinworm: msg('The bottom itches at night; sleeps badly.'), chickenpox: msg('The blisters itch.'), tinea: msg('The rings itch.'),
      impetigo: msg('The sores itch a little.'), trichomonas: msg('It itches down below.'), trachoma: msg('The eyes itch.') })[c.id], msg('No itching.')],
  ['rash_hx', { chickenpox: above(0.1), impetigo: (c) => c.I > 1, tinea: (c) => c.M > 2, scabies: above(0.2), syphilis: secondary, leprosy: (c) => c.A > 4, kwashiorkor: above(0.4), cellulitis: above(0.15) },
    (c) => ({ chickenpox: msg('Yes — little water blisters, first on the body, then everywhere.'), impetigo: msg('Sores with yellow crusts that keep spreading.'), tinea: msg('Round scaly patches that grow outward.'),
      scabies: msg('Little bumps between the fingers and on the wrists.'), syphilis: msg('Spots all over, even on the palms and soles.'), leprosy: msg('A pale patch that has grown for months.'),
      kwashiorkor: msg('The skin of the legs peels in dark patches.'), cellulitis: msg('A red, hot patch that spreads.') })[c.id]],
  ['pain_site', { ascaris: (c) => c.W > 18, typhoid: above(0.3), uti: above(0.25), ulcer: above(0.15), mastoiditis: above(0.2), ear_infection: above(0.05), strep_throat: above(0.15), meningitis: above(0.2),
    malaria: above(0.3), hypertension: (c) => c.L > 45, pre_eclampsia: (c) => c.sev > 0.4, eclampsia: (c) => c.sev > 0.4, obstructed_labour: always, puerperal_sepsis: above(0.2), ectopic: always, miscarriage: always,
    pid: above(0.2), chlamydia: above(0.25), mastitis: above(0.15), chancroid: above(0.15), cellulitis: above(0.15), eye_injury: (c) => c.heal < 1, mumps: above(0.15), tetanus: above(0.3) },
    (c) => ({ ascaris: msg('The belly aches.'), typhoid: msg('All over the belly.'), uti: msg('Low in the belly, above the bone.'), ulcer: msg('A burning in the pit of the stomach.'), mastoiditis: msg('Behind the ear.'),
      ear_infection: msg('Deep in the ear.'), strep_throat: msg('The throat, worst on swallowing.'), meningitis: msg('The head, terribly, and the back of the neck.'), malaria: msg('The head, and the whole body aches.'),
      hypertension: msg('The head, often.'), pre_eclampsia: msg('The head.'), eclampsia: msg('The head.'), obstructed_labour: msg('Labour pains that never let up.'), puerperal_sepsis: msg('Low in the belly.'),
      ectopic: msg('Low in the belly, on one side.'), miscarriage: msg('Cramps low in the belly.'), pid: msg('Low in the belly, both sides.'), chlamydia: msg('A dull ache low in the belly.'),
      mastitis: msg('One breast; feeding hurts.'), chancroid: msg('The sores down below.'), cellulitis: msg('The red patch.'), eye_injury: msg('The eye, worse in the light.'), mumps: msg('Below the ear, when chewing.'),
      tetanus: msg('The jaw, the neck and the back, in spasms.') })[c.id]],
  ['swelling_hx', { wound_infected: (c) => c.I > 2, heart_failure: (c) => c.V > 2, pre_eclampsia: (c) => c.sev > 0.2, kwashiorkor: above(0.25), rheumatic_fever: above(0.15), mastoiditis: above(0.2),
    goitre: (c) => c.L > 0.5, snakebite: (c) => c.D0 > 0 && !c.neuro, fracture: always, sprain: always, tb_nodes: above(0.1), chancroid: above(0.4), cellulitis: above(0.15), mumps: above(0.15),
    mastitis: above(0.15), hiv: above(0.2), syphilis: secondary, strep_throat: above(0.25) },
    (c) => ({ wound_infected: msg('Around the wound: red, hot and swollen.'), heart_failure: msg('The feet and legs.'), pre_eclampsia: msg('Face, hands and feet.'), kwashiorkor: msg('Feet, hands and face.'),
      rheumatic_fever: msg('The wrists and ankles.'), mastoiditis: msg('A lump behind the ear.'), goitre: msg('The front of the neck.'), snakebite: msg('The bitten limb.'), fracture: msg('The arm, above the wrist.'),
      sprain: msg('The ankle.'), tb_nodes: msg('Lumps in the neck.'), chancroid: msg('A lump in the groin.'), cellulitis: msg('The red patch.'), mumps: msg('Below and in front of the ear.'), mastitis: msg('One breast.'),
      hiv: msg('Lumps in the neck and armpits.'), syphilis: msg('Lumps in the neck and the groin.'), strep_throat: msg('Under the jaw.') })[c.id], msg('No swelling.')],
  ['eyes_hx', { conjunctivitis: above(0.1), trachoma: above(0.1), eye_injury: (c) => c.heal < 1 || c.I > 2, measles: above(0.3), hepatitis: (c) => c.age > 72 && c.s > 0.2,
    newborn_jaundice: above(0.2), snakebite: (c) => c.neuro && c.s > 0.4 },
    (c) => ({ conjunctivitis: msg('Both eyes red, with pus; the lids stick together in the morning.'), trachoma: msg('Red, watering eyes for months; the light hurts them.'),
      eye_injury: msg('One eye red and watering; it hurts in the light.'), measles: msg('The eyes are red and watering; the light hurts them.'), hepatitis: msg('The whites of the eyes have gone yellow.'),
      newborn_jaundice: msg('The skin and the whites of the eyes are yellow.'), snakebite: msg('The eyelids droop.') })[c.id], msg('No trouble with the eyes.')],
  ['breath_hx', { pneumonia: above(0.3), asthma: above(0.15), kerosene: above(0.2), heart_failure: (c) => c.V > 2, anaemia: (c, p, F) => F.fatigue?.pos, hookworm: (c, p, F) => F.fatigue?.pos },
    (c) => ({ pneumonia: msg('Breathing hard and fast.'), asthma: msg('Fights for breath; the chest whistles.'), kerosene: msg('Breathing fast, choking.'), heart_failure: msg('Breathless on the path; worse lying flat.'),
      anaemia: msg('Breathless going up the hill.'), hookworm: msg('Breathless going up the hill.') })[c.id], msg('Breathing is easy.')],
  ['chills', { pyelonephritis: above(0.3), cellulitis: above(0.3), puerperal_sepsis: above(0.3) }, msg('Shaking chills with the fever.'), msg('No chills.')],
  ['throat', { syphilis: secondary }, msg('A sore throat, and sores in the mouth.')],
  ['stools', { hiv: above(0.5) }, msg('Loose stools, on and off for over a month.')],
  ['fever_hx', { hiv: above(0.5) }, msg('Fevers that come and go, for weeks.')],
  // household: scabies spreads to most of a family; the other catching skin and eye illnesses to about half (estimates)
  ['family_hx', { scabies: (c, p) => hashf(p.seed, 0, 2, 9001) < 0.7, ...Object.fromEntries(['impetigo', 'conjunctivitis', 'tinea', 'measles', 'chickenpox', 'mumps', 'trachoma'].map((id) => [id, (c, p) => hashf(p.seed, 0, 2, 9001) < 0.5])) },
    (c) => (c.id === 'scabies' ? msg('Yes — the brothers and sisters itch too.') : msg('Yes — other children at home have the same.')), msg('No one else at home.')],
];

// ——— since the last visit (asked when they come back), from their own record
function followUp(p, t, set) {
  const last = p.visits?.[p.visits.length - 1];
  if (!last) return;
  const now = p.conds.reduce((a, c) => a + (c.s || 0), 0), before = last.burden ?? now, r = before > 0.02 ? now / before : now > 0.05 ? 2 : 0;
  set('better', now < 0.03 ? msg('Well again.') : r < 0.5 ? msg('Much better.') : r < 0.85 ? msg('A little better.') : r < 1.15 ? msg('About the same.') : msg('Worse.'), now >= 0.03 && r >= 0.85);
  const short = (x) => raw(tm(x.name).split(' (')[0]); // the medicine's name without its strength (rx names are English)
  const days = (x) => Math.max(1, Math.round((x.stopped - x.start) / (24 * HOUR)));
  const meds = (p.rx || []).filter((x) => !x.instr && !x.home && x.route !== 'inj' && x.start >= last.t);
  const how = (x) => {
    if (x.stopped) {
      const n = days(x), rash = x.stopWhy === 'rash';
      return n > 1 ? (rash ? msg('stopped after {n} days, because of a rash', { n }) : msg('stopped after {n} days, when better', { n }))
        : rash ? msg('stopped after {n} day, because of a rash', { n }) : msg('stopped after {n} day, when better', { n });
    }
    if (x.missed) return x.missed > 1 ? msg('missed {n} doses', { n: x.missed }) : msg('missed {n} dose', { n: x.missed });
    return x.left <= 0 ? msg('all taken') : msg('taking every dose');
  };
  set('doses', meds.length ? meds.map((x) => msg('{med}: {how}.', { med: short(x), how: how(x) })) : msg('There was no medicine to take at home.'), meds.some((x) => x.stopped || x.missed));
  const adv = (p.rx || []).filter((x) => x.instr && x.start >= last.t && x.seen);
  const kept = (x) => x.kept / x.seen;
  set('advice_kept', adv.length ? adv.map((x) => (kept(x) > 0.85 ? msg('{advice}: yes, every day.', { advice: x.name }) : kept(x) > 0.5 ? msg('{advice}: most days.', { advice: x.name }) : msg('{advice}: only now and then.', { advice: x.name }))) : msg('You gave no advice.'),
    adv.some((x) => kept(x) <= 0.5));
}
