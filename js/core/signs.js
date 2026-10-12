// signs.js — what a patient shows right now, computed from the true state of their body. The encounter
// only ever sees these (never the hidden state): history answers, what you see, feel, hear, count and
// measure. Some findings are missed by chance — a mother may not have noticed, a crackle can be faint.
// Each finding: { v: text, pos: abnormal?, n?: number }.
import { COND } from './content/conditions.js';
import { drugState } from './pk.js';
import { sinceWords } from './patient.js';
import { makeRng } from './rng.js';

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const HOUR = 60;

export function normalRR(age) { return age < 1 ? 36 : age < 5 ? 28 : age < 12 ? 22 : 16; }
export function fastRR(age) { return age < 1 / 6 ? 60 : age < 1 ? 50 : age < 5 ? 40 : age < 12 ? 30 : 24; }
export function normalHR(age) { return age < 1 ? 125 : age < 5 ? 105 : age < 12 ? 90 : 76; }

/** Core physiological readings (also used by the HUD of an admitted patient). */
export function vitals(p, t) {
  const ds = drugState(p, t);
  const rng = makeRng(p.seed, 'vitals', Math.floor(t / 10));
  const cond = (id) => p.conds.find((c) => c.id === id);
  let fever = 0;
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
  const temp = Math.round((36.8 + fever + (rng() - 0.5) * 0.3) * 10) / 10;
  const d = p.hyd / p.weight;
  const hf = cond('heart_failure'), pn = cond('pneumonia'), mal = cond('malaria'), pe = cond('pre_eclampsia'), ty = cond('typhoid');
  const hb = Math.min(p.hb, ...p.conds.filter((c) => c.hb !== undefined).map((c) => c.hb));
  let hr = normalHR(p.age) + fever * 10 + Math.max(0, d - 0.04) * 700 + Math.max(0, 8 - hb) * 6 + (hf ? hf.V * 6 - 18 * ds.heart : 0) - (ty?.s || 0) * 18; // typhoid: a pulse slow for the fever
  if (p.lastTox?.some((s) => s.startsWith('anticholinergic'))) hr += 35;
  if (p.lastTox?.includes('digitalis_arrhythmia')) hr = Math.min(hr, 48);
  let rr = normalRR(p.age) + fever * 2 + (pn ? pn.s * (p.age < 5 ? 34 : 16) : 0) + (d > 0.08 ? 10 : 0) + (mal ? mal.sev * 8 : 0) + (hf && hf.V > 3.5 ? (hf.V - 3.5) * 5 : 0);
  hr = Math.round(hr + (rng() - 0.5) * 8); rr = Math.round(rr + (rng() - 0.5) * 4);
  const bpS = Math.round((p.age < 12 ? 98 : 118 + Math.max(0, p.age - 40) * 0.5) + (pe ? 25 + pe.sev * 45 : 0) - (d > 0.08 ? 20 : 0) + (rng() - 0.5) * 8);
  const bpD = Math.round((p.age < 12 ? 60 : 76) + (pe ? 14 + pe.sev * 25 : 0) + (rng() - 0.5) * 6);
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
  const set = (k, v, pos, n) => { F[k] = { v, pos: !!pos, n }; };

  const main = p.conds.find((c) => c.id === p.mainCond) || p.conds[0];
  set('duration', main ? cap(sinceWords((t - main.t0) / HOUR)) + '.' : 'It is better now.', false);

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
  if (stools >= 3) set('stools', `${stools} loose stools a day${blood ? ', small, with blood and slime' : gi ? ', yellow, frothy and foul' : ', watery'}.`, true, stools);
  else set('stools', 'Stools are normal.', false);
  if (blood) set('blood_stool', 'Yes — blood and mucus in the stool.', true);
  const wd = cond('watery_diarrhea');
  const vom = (cond('pyelonephritis')?.s || 0) > 0.4 || (wd && wd.age < 48 && wd.s > 0.3) || (cond('malaria')?.s > 0.6 && child) || cond('nausea_pregnancy')?.s > 0.3 || p.lastTox?.includes('digitalis_gi') || p.lastTox?.includes('cinchonism');
  set('vomiting', vom ? 'Yes, vomiting.' : 'No vomiting.', !!vom);
  set('drinking', d > 0.09 ? 'Too weak to drink.' : d > 0.04 ? 'Drinks eagerly, wants more.' : 'Drinking normally.', d > 0.04);
  set('thirst', d > 0.03 ? 'Very thirsty.' : 'Not especially thirsty.', d > 0.03);
  set('urine', p.lastTox?.includes('kidney_injury') ? 'Almost no urine, even after drinking.' : d > 0.09 ? 'No urine since yesterday.' : d > 0.04 ? 'Very little urine, dark yellow.' : 'Passing urine normally.', d > 0.04);
  set('sunken_eyes', d > 0.05 ? 'Eyes look sunken.' : 'Eyes normal.', d > 0.05);
  set('dry_mouth', d > 0.04 || p.lastTox?.some((s) => s.startsWith('anticholinergic')) ? 'Mouth and tongue are dry.' : 'Mouth moist.', d > 0.04);
  set('tears', d > 0.06 ? 'No tears when crying.' : 'Tears normal.', d > 0.06);
  set('skin_pinch', d > 0.09 ? 'Skin pinch goes back VERY slowly (more than 2 seconds).' : d > 0.055 ? 'Skin pinch goes back slowly.' : 'Skin pinch goes back at once.', d > 0.055);
  if (infant) set('fontanel', d > 0.05 ? 'The soft spot is sunken.' : 'Soft spot is level.', d > 0.05);

  // ——— general
  const mal = cond('malaria'), pn = cond('pneumonia');
  const ty = cond('typhoid');
  const sick = p.lastTox?.some((s) => ['reye', 'iron_severe', 'iron_lethal', 'opioid_resp', 'sjs'].includes(s)) || (ty?.s || 0) > 0.85 || (mal?.sev || 0) > 0.9 || (pn?.s || 0) > 0.85 || d > 0.09 || any((c) => c.I > 6.5) || p.lastTox?.includes('anticholinergic_severe');
  set('alert', sick ? (p.lastTox?.includes('anticholinergic_severe') ? 'Confused, picking at the air, agitated.' : 'Very weak and drowsy, hard to wake.') : 'Awake and alert.', sick);
  set('pallor', V.hb < 6 ? 'Palms and inner eyelids very pale (white).' : V.hb < 8.5 ? 'Palms and eyelids pale.' : 'Good colour.', V.hb < 8.5);
  set('thin', p.nutrition < 0.7 ? 'Very thin, ribs and shoulder bones show.' : p.nutrition < 0.8 ? 'Thin.' : 'Well nourished.', p.nutrition < 0.8);
  const anti = p.lastTox?.some((s) => s.startsWith('anticholinergic'));
  set('flushed', anti ? 'Skin hot, dry and red.' : V.temp > 39 ? 'Face flushed with fever.' : 'Normal skin colour.', anti || V.temp > 39);
  set('pupils', anti ? 'Pupils wide, barely react to light.' : 'Pupils normal.', anti);
  set('yellow_vision', p.lastTox?.includes('digitalis_gi') ? 'Says things look yellow-green.' : '—', !!p.lastTox?.includes('digitalis_gi'));

  // ——— fever
  set('feels_hot', V.temp > 38.8 ? 'Hot to the touch.' : V.temp > 37.8 ? 'Warm.' : 'Not hot.', V.temp > 37.8);
  set('temp', `${V.temp.toFixed(1)} °C`, V.temp >= 37.6, V.temp);
  const febrile = any((c) => (COND.get(c.id).params.fever && c.s > 0.1) || (c.id === 'malaria' && c.s > 0.1));
  set('fever_hx', febrile ? 'Yes, fever.' : 'No fever.', febrile);
  if (mal && mal.s > 0.15) {
    set('chills', 'Shaking chills, then burning fever, then sweating.', true);
    const I = (mal.I || 0) + (mal.acq || 0);
    set('fever_pattern', I > 0.25 || rng() < 0.5 ? 'The fever comes back every second day.' : 'Fever most of the time, worse at night.', true);
  }
  set('fever_rising', ty && ty.s > 0.2 ? 'The fever has climbed a little higher every day.' : '—', !!(ty && ty.s > 0.2));
  const headache = (ty?.s || 0) > 0.3 || (mal?.s || 0) > 0.3 || (cond('pre_eclampsia')?.sev || 0) > 0.4 || (cond('common_cold')?.s || 0) > 0.6;
  set('headache', headache ? 'Yes, the head is paining.' : 'No headache.', headache);

  // ——— breathing
  const cold = cond('common_cold'), cc = cond('cough_child'), hf = cond('heart_failure'), ms = cond('measles'), st = cond('strep_throat'), ear = cond('ear_infection');
  const cough = Math.max((cold?.s || 0) * COND.get('common_cold').params.cough, (ms?.s || 0) * 0.8, cc?.s || 0, pn?.s || 0, hf && hf.V > 4 ? 0.5 : 0) * (1 - (V.ds.relief.cough || 0));
  set('cough', cough > 0.15 ? (pn?.s > 0.2 ? 'Cough, with yellow or rusty phlegm.' : 'A dry cough.') : 'No cough.', cough > 0.15);
  set('night_cough', (cc?.s || 0) > 0.3 && (V.ds.relief.cough || 0) < 0.5 ? 'Coughs most at night, keeps the house awake.' : 'Not worse at night.', (cc?.s || 0) > 0.3);
  const runny = (cold?.s || 0) > 0.2 || (ms?.s || 0) > 0.3;
  set('runny', runny ? 'Runny, blocked nose.' : 'No runny nose.', runny);
  set('throat', (st?.s || 0) > 0.15 ? 'A very sore throat; it hurts to swallow.' : (cold?.s || 0) > 0.4 ? 'Sore throat.' : 'Throat fine.', (st?.s || 0) > 0.15 || (cold?.s || 0) > 0.4);
  set('tonsils', (st?.s || 0) > 0.2 ? 'Tonsils swollen and red, with white spots of pus.' : (cold?.s || 0) > 0.4 ? 'The throat is a little red; no pus.' : 'Throat looks normal.', (st?.s || 0) > 0.2);
  set('neck_glands', (st?.s || 0) > 0.25 || (ear?.s || 0) > 0.5 ? 'Tender swollen lumps under the jaw.' : 'No swollen glands in the neck.', (st?.s || 0) > 0.25 || (ear?.s || 0) > 0.5);
  set('ear_pain', (ear?.s || 0) > 0.05 ? (p.age < 4 ? 'Cries, pulls and rubs at one ear, worse lying down.' : 'A deep throbbing pain in one ear.') : 'No ear pain.', (ear?.s || 0) > 0.05);
  const mst = cond('mastoiditis');
  set('mastoid', (mst?.s || 0) > 0.2 ? 'A hot, tender swelling behind the ear pushes the ear forward.' : 'Behind the ears normal.', (mst?.s || 0) > 0.2);
  const burst = (ear?.s || 0) > 0.35 && makeRng(p.seed, 'eardrum')() < 0.35;
  set('ear_pus', burst ? 'Yellow pus in the ear canal: the eardrum has burst.' : 'No pus in the ears.', burst);
  const eyes = (ms?.s || 0) > 0.3;
  set('red_eyes', eyes ? 'Eyes red and watering; the light hurts them.' : '—', eyes);
  set('rr', `${V.rr} breaths a minute${V.rr >= fastRR(p.age) ? ' — FAST for this age' : ''}.`, V.rr >= fastRR(p.age), V.rr);
  set('hr', `${V.hr} beats a minute${V.irregular ? ', irregular' : ''}.`, V.hr > normalHR(p.age) + 25 || V.hr < 55 || V.irregular, V.hr);
  set('pulse_regular', V.irregular ? 'Irregular, skipping beats.' : 'Regular.', V.irregular);
  set('indrawing', (pn?.s || 0) > 0.55 && p.age < 12 ? 'The skin between the ribs sucks in with each breath.' : 'No chest drawing in.', (pn?.s || 0) > 0.55 && p.age < 12);
  set('grunting', (pn?.s || 0) > 0.8 && p.age < 5 ? 'Grunts with each breath out.' : 'No grunting.', (pn?.s || 0) > 0.8 && p.age < 5);
  const crack = (pn?.s || 0) > 0.3 || (hf?.V || 0) > 4;
  const heard = crack && rng() < (tools.has('stethoscope') ? 0.92 : 0.6);
  set('crackles', heard ? ((pn?.s || 0) > 0.3 ? 'Crackles over one side of the chest.' : 'Fine crackles at the bottom of both lungs.') : 'Chest sounds clear.', heard);
  set('breathless_walk', (hf?.V || 0) > 2 ? 'Gets breathless on the path, must stop.' : 'No.', (hf?.V || 0) > 2);
  set('orthopnea', (hf?.V || 0) > 3.5 ? 'Must sleep sitting up or wakes gasping.' : 'Sleeps flat.', (hf?.V || 0) > 3.5);

  // ——— belly, worms, skin
  const asc = cond('ascaris'), pin = cond('pinworm'), sc = cond('scabies');
  set('spleen', mal && (mal.age > 72 || (mal.I || 0) > 0.3) && mal.para > 800 && p.age > 1 ? 'Spleen enlarged — felt below the left ribs.' : 'No spleen felt.', !!(mal && (mal.age > 72 || (mal.I || 0) > 0.3) && mal.para > 800 && p.age > 1));
  const tender = ['dysentery', 'amoebiasis', 'typhoid'].some((id) => (cond(id)?.s || 0) > 0.3);
  set('tender', tender ? 'Belly tender all over, cramping.' : 'Belly soft.', tender);
  const ut = cond('uti');
  set('suprapubic', (ut?.s || 0) > 0.25 ? 'Tender low in the belly, just above the bone.' : '—', (ut?.s || 0) > 0.25);
  const rs = (ty?.s || 0) > 0.5 && rng() < 0.3;
  set('rose_spots', rs ? 'A few faint rose-pink spots on the belly that fade when pressed.' : '—', rs);
  const gb = cond('giardia');
  set('bloating', (gb?.s || 0) > 0.25 ? 'The belly swells with gas.' : 'No bloating.', (gb?.s || 0) > 0.25);
  set('burps', (gb?.s || 0) > 0.3 ? 'Burps that smell of rotten eggs.' : 'No.', (gb?.s || 0) > 0.3);
  const am = cond('amoebiasis');
  set('stool_on_off', am && am.age > 120 ? 'The loose stools come and go, on and off for weeks.' : '—', !!(am && am.age > 120));
  set('stool_frothy', gi ? 'Yes — frothy, greasy, they float and stink.' : '—', gi);
  set('constipation', (ty?.s || 0) > 0.3 && p.age >= 12 ? 'Hard stools, few, for days.' : '—', (ty?.s || 0) > 0.3 && p.age >= 12);
  // urine
  set('dysuria', (ut?.s || 0) > 0.15 ? (p.age < 5 ? 'Cries when passing urine.' : 'Yes — it burns like fire when passing urine.') : 'No burning.', (ut?.s || 0) > 0.15);
  set('frequency', (ut?.s || 0) > 0.2 ? 'Passes urine very often, a little each time.' : 'No.', (ut?.s || 0) > 0.2);
  set('cloudy_urine', (ut?.s || 0) > 0.35 ? 'The urine is cloudy and smells strong.' : 'Urine looks clear.', (ut?.s || 0) > 0.35);
  const py = cond('pyelonephritis');
  set('loin_pain', (py?.s || 0) > 0.2 ? 'Sharp pain when the back over the kidney is tapped.' : 'No pain over the kidneys.', (py?.s || 0) > 0.2);
  set('pot_belly', (asc?.W || 0) > 18 && p.age < 12 ? 'Swollen pot belly.' : 'Belly normal size.', (asc?.W || 0) > 18 && p.age < 12);
  const sawWorm = ((asc?.W || 0) > 4 && rng() < 0.6) || ((pin?.W || 0) > 10 && rng() < 0.45);
  set('worms_seen', sawWorm ? ((asc?.W || 0) > 4 ? 'Yes, a long white worm came out in the stool.' : 'Tiny white threads in the stool.') : 'No worms seen.', sawWorm);
  set('anal_itch', (pin?.W || 0) > 10 ? 'Scratches the bottom at night, sleeps badly.' : 'No.', (pin?.W || 0) > 10);
  set('itch_night', (sc?.s || 0) > 0.2 ? 'Itching all over, much worse at night.' : 'No itching.', (sc?.s || 0) > 0.2);
  set('itch_family', sc && rng() < 0.7 ? 'Yes, the brothers and sisters itch too.' : 'No one else.', !!sc);
  const burrows = (sc?.M || 0) > 3 && rng() < (tools.has('magnifier') ? 0.85 : 0.5);
  set('burrows', burrows ? 'Small bumps and fine wavy lines between the fingers and on the wrists.' : (sc?.s || 0) > 0.2 ? 'Scratch marks, but no clear burrows seen.' : 'Skin clear.', burrows);
  set('skin_sores', (sc?.I || 0) > 1 ? 'Scratched bumps with pus and crusts.' : '—', (sc?.I || 0) > 1);
  const mrash = !!ms && ms.age > 72 && ms.age < ms.D - 24;
  set('measles_rash', mrash ? 'A blotchy red rash, from the face and behind the ears down over the body.' : '—', mrash);
  set('koplik', ms && ms.age > 36 && ms.age < 100 ? 'Tiny white spots like grains of salt inside the cheeks.' : 'Inside of the mouth normal.', !!(ms && ms.age > 36 && ms.age < 100));
  set('rash_hx', mrash ? 'Yes — it began on the face and went down the body.' : (p.allergicUntil || 0) > t ? 'Yes — itchy lumps all over since the medicine.' : 'No rash.', mrash || (p.allergicUntil || 0) > t);

  // ——— wounds and burns
  const w = p.conds.find((c) => c.id.startsWith('wound')), b = cond('burn_minor');
  if (w) {
    set('wound_size', `A wound ${w.size.toFixed(1)} cm long, ${w.heal > 0.7 ? 'nearly closed' : w.heal > 0.3 ? 'healing at the edges' : 'open'}${w.dirt > 0.4 ? ', dirt in it' : ''}.`, true);
    set('pus', w.I > 3 ? 'Pus in the wound, bad smell.' : 'No pus.', w.I > 3);
    set('redness', w.I > 2 ? 'Red, hot and swollen around it.' : 'Little redness.', w.I > 2);
    set('red_streaks', w.I > 5 ? 'Red lines run up the limb from the wound.' : 'No red streaks.', w.I > 5);
    set('glands', w.I > 4.5 ? 'Swollen tender lymph nodes above the wound.' : 'No swollen glands.', w.I > 4.5);
  }
  if (b) {
    set('burn_area', `Burn covering about ${b.tbsa.toFixed(1)}% of the body (${(b.tbsa).toFixed(0)} of the patient\'s palms).`, true, b.tbsa);
    set('blisters', b.deep ? 'Part of it is white and leathery, with no feeling.' : 'Red, wet and blistered.', true);
    set('burn_deep', b.deep ? 'Deep burn.' : 'Partial-thickness burn.', b.deep);
    if (b.I > 3) set('pus', 'The burn is oozing pus and smells.', true);
  }
  set('injury_how', w || b ? (p.complaint || 'An accident at home.') : 'No injury.', !!(w || b));

  // ——— pain, swelling, pregnancy
  const rf = cond('rheumatic_fever');
  set('joints', (rf?.s || 0) > 0.15 ? 'Wrists and ankles swollen, hot and red; the pain has moved from joint to joint.' : 'Joints normal.', (rf?.s || 0) > 0.15);
  const bp = cond('back_pain');
  const relief = V.ds.relief.pain || 0;
  set('pain_site', rf && rf.s > 0.15 ? 'The joints — first the ankles, now the wrists.' : py && py.s > 0.2 ? 'In the side of the back, one side.' : bp ? `Low back, ${bp.s * (1 - relief) > 0.4 ? 'bad' : 'aching'}, worse bending and lifting.` : wd || cond('dysentery') ? 'Cramps in the belly.' : w || b ? 'The wound/burn pains.' : 'No particular pain.', !!bp);
  set('cramp', (cond('amoebiasis')?.s || 0) > 0.2 || (cond('dysentery')?.s || 0) > 0.2 || (wd?.s || 0) > 0.4 ? `Cramping belly pains${(V.ds.relief.cramp || 0) > 0.4 ? ' (eased by the remedy)' : ''}.` : 'No cramps.', (cond('dysentery')?.s || 0) > 0.2 || (wd?.s || 0) > 0.4);
  set('back_exam', bp ? 'Tender muscles beside the lower spine; legs strong, feeling normal.' : 'Back normal.', !!bp);
  const pe = cond('pre_eclampsia');
  const ed = (hf?.V || 0) > 2 || (pe?.sev || 0) > 0.2 || (p.pregnant > 30) || V.hb < 5;
  set('edema', ed ? ((hf?.V || 0) > 4 ? 'Pitting swelling up to the shins.' : (pe?.sev || 0) > 0.2 ? 'Feet, hands and face swollen; finger press leaves a dent.' : 'Mild ankle swelling.') : 'No swelling.', (hf?.V || 0) > 2 || (pe?.sev || 0) > 0.2);
  if (p.sex === 'f' && p.age >= 13) set('pregnancy', p.pregnant ? `Yes — monthly bleeding stopped about ${Math.round(p.pregnant / 4.3)} months ago.` : 'Not pregnant.', !!p.pregnant, p.pregnant);
  const np = cond('nausea_pregnancy');
  set('nausea_preg', (np?.s || 0) > 0.2 ? `Sick every morning${(V.ds.relief.nausea || 0) > 0.3 ? ', a little better with the remedy' : ''}.` : '—', (np?.s || 0) > 0.2);
  set('vision', (pe?.sev || 0) > 0.5 ? 'Sees spots and blurred.' : 'Vision fine.', (pe?.sev || 0) > 0.5);
  set('face_swelling', (pe?.sev || 0) > 0.3 ? 'Face and hands swollen.' : 'No.', (pe?.sev || 0) > 0.3);
  set('bp', `${V.bpS}/${V.bpD} mmHg`, V.bpS >= 140 || V.bpD >= 90, V.bpS);

  // ——— medicines and their effects
  // allergy: most who are truly allergic remember a reaction; a few who are not believe they are
  const said = makeRng(p.seed, 'allergy-said')();
  const thinks = p.allergy ? said < 0.7 : said < 0.05;
  set('allergy_hx', thinks ? (p.allergy === 'aspirin' ? 'Yes — aspirin once made it hard to breathe.' : 'Yes — penicillin gave a rash and swelling once.') : 'No allergies that I know of.', thinks);
  const hives = (p.allergicUntil || 0) > t;
  set('rash', p.lastTox?.includes('sjs') ? 'Blisters and peeling skin over the body; raw sores in the mouth and red eyes.' : hives ? 'Raised, itchy pale welts over the body (hives); the lips are a little swollen.' : 'No rash.', hives);
  const taking = (p.rx || []).filter((r) => !r.instr && !r.stopped && r.left > 0).map((r) => r.name);
  set('meds_taken', taking.length ? 'Taking: ' + taking.join(', ') + '.' : 'Nothing yet.', false);
  const tox = [];
  if (hives) tox.push('an itchy rash all over');
  for (const s of p.lastTox || []) tox.push({ tinnitus: 'ears ringing', cinchonism: 'ears ringing, dizzy, sick', quinine_toxic: 'cannot see well', digitalis_gi: 'nausea, sees yellow', digitalis_arrhythmia: 'heart stumbling', anticholinergic: 'mouth dry as dust, heart racing', anticholinergic_severe: 'seeing things that are not there', marrow: 'tired, bruises easily', grey_baby: 'the baby is grey and floppy', kidney_injury: 'hardly any urine', sjs: 'blisters, peeling skin, sore mouth and eyes', reye: 'vomiting, then drowsy and confused', iron_gi: 'vomiting, belly pain', iron_severe: 'vomiting blood, very drowsy', iron_lethal: 'cannot be woken', vita_acute: 'headache and vomiting', zinc_gi: 'vomiting, cramps', opioid_withdrawal: 'aching, yawning, loose stools, sleepless' }[s] || s);
  set('tox_symptoms', tox.length ? 'Complains of: ' + tox.join('; ') + '.' : 'No new complaints from the medicine.', tox.length > 0);
  const poorly = p.conds.some((c) => (c.s || 0) > 0.35);
  set('appetite', poorly ? 'Eating little.' : 'Eating well.', poorly);
  const hw = cond('hookworm');
  set('pica', p.age < 13 && (hw?.s || 0) > 0.3 ? 'Yes — eats earth and clay when no one is looking.' : 'No.', p.age < 13 && (hw?.s || 0) > 0.3);
  set('fatigue', V.hb < 9 ? 'Tired all the time; breathless going up the hill.' : 'Not especially tired.', V.hb < 9);
  set('weight_loss', p.nutrition < 0.75 || (asc?.W || 0) > 30 ? 'Has become thinner.' : 'No.', p.nutrition < 0.75);
  set('weight', `${p.weight.toFixed(1)} kg`, false, p.weight);
  if (p.age >= 0.5 && p.age < 5) {
    const muac = Math.round((13.6 + (p.nutrition - 0.85) * 14) * 10) / 10;
    set('muac', `${muac.toFixed(1)} cm${muac < 11.5 ? ' — SEVERE malnutrition (red)' : muac < 12.5 ? ' — moderate malnutrition (yellow)' : ' (green)'}`, muac < 12.5, muac);
  }
  return F;
}
