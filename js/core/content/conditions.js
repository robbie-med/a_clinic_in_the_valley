// conditions.js — the illnesses that walk in. Each row says who gets it and when (epi), how it runs
// in the body (model + params, simulated by disease.js hour by hour), what it shows (findings come
// from the model's state, see signs.js), what the patient says, and what the book teaches about it.
//
// Nothing here says "item X cures Y". Cures happen because a compound reaches the right place at the
// right concentration for long enough (pk.js), or because lost water is put back. `teach` is only for
// the handbook and for judging care afterwards.
//
// Page refs: Where There Is No Doctor (Hesperian, 2011 printing). Paraphrased, never copied.

import { COMPRESS } from '../time.js';

// Time: illness runs in real hours, but anything taking months or years (a worm's lifespan, a pregnancy, chronic
// damage) runs COMPRESS (~9) times faster, on the game's 40-day year. Such numbers are written as real time / COMPRESS.

export const CONDITIONS = [
  {
    id: 'watery_diarrhea', name: 'Watery diarrhoea', local: ['the runs', 'loose belly'], model: 'viral',
    epi: { w: 10, age: [[0, 2, 6], [2, 5, 4], [5, 15, 1.2], [15, 99, 0.6]], season: { cool_dry: 0.8, hot_dry: 1.3, rains: 1.5, late_rains: 1.1 }, water: 1.5 },
    params: { days: [4, 1.5], peak: 1.5, stool: { perDay: 9, mlKg: [90, 60, 30, 15] }, vomit: 0.6, fever: [0.4, 0.8], cramp: 0.4 },
    complaint: ['{who} has had watery stools {when}.', 'Runny stools, many times, {when}. {pron} won\'t eat.', 'The belly is running like water {when}.'],
    teach: { treat: ['oral_fluid'], helps: ['zinc', 'guava_flavonoid'], harms: ['aloin', 'tropane', 'codeine'], refer: 'Severe dehydration, cannot drink, or blood in stool with high fever.' },
    learn: 'Most children who die of diarrhoea die of lost water, not of the germ. Give the rehydration drink (or any liquid) often in sips, keep feeding, keep breastfeeding. Watch for thirst, little dark urine, dry mouth, sunken eyes and a skin pinch that is slow to fall back. Medicine is rarely needed.',
    ref: 'WTND pp.151–160', icon: 'water-drop', color: '#7ab0d0',
  },
  {
    id: 'dysentery', name: 'Bacillary dysentery (Shigella)', local: ['bloody flux'], model: 'bacterial',
    epi: { w: 2.5, age: [[0, 5, 3], [5, 15, 1.5], [15, 99, 1]], season: { cool_dry: 0.7, hot_dry: 1.2, rains: 1.6, late_rains: 1.1 }, water: 2 },
    params: { org: 'shigella', L0: [5.5, 7], r: 0.06, Lsym: 4, Lmax: 10, imm: 0.11, onset: 60, hazard: 0.006, stool: { perDay: 12, mlKg: [25, 20, 12, 8] }, blood: true, fever: [1.3, 2.2], cramp: 0.8 },
    complaint: ['There is blood and slime in {poss} stools {when}, and fever.', 'Belly cramps, blood in the stool, many small stools {when}.'],
    teach: { treat: ['oral_fluid', 'ciprofloxacin'], helps: ['guava_flavonoid'], harms: ['tropane'], refer: 'Needs an antibiotic: ciprofloxacin for 3 days where Shigella still responds to it. If there is none, or it is no better in 2 days, send to the health centre — sooner for small or thin children.' },
    learn: 'Many small stools with blood and mucus, cramps and fever: think bacterial dysentery. Fluids as for any diarrhoea, and it usually needs an antibiotic — home remedies only ease the cramps. Shigella has learned to resist most of the old ones (cotrimoxazole, ampicillin); use what still works here.',
    ref: 'WTND pp.156–158', icon: 'water-drop', color: '#c05050',
  },
  {
    id: 'common_cold', name: 'Common cold', local: ['catarrh', 'a cold'], model: 'viral',
    epi: { w: 8, age: [[0, 5, 2], [5, 15, 1.5], [15, 99, 1]], season: { cool_dry: 1.8, hot_dry: 0.7, rains: 1.1, late_rains: 1.3 } },
    params: { days: [7, 2], peak: 2.5, runny: 0.9, congestion: 0.8, throat: 0.6, cough: 0.5, fever: [0.2, 0.7] },
    complaint: ['Runny nose and a cough {when}.', '{who} has a blocked nose and sore throat {when}.'],
    teach: { treat: [], helps: ['eucalyptol', 'honey', 'paracetamol'], harms: ['codeine'], refer: 'Fast breathing or chest drawing in: that is pneumonia, not a cold.' },
    learn: 'A cold goes away by itself in about a week. Drink plenty, rest, breathe steam for a blocked nose. Antibiotics and "cold medicines" do not help and cost money.',
    ref: 'WTND pp.163–164', icon: 'sun-cloud', color: '#a0b0c0',
  },
  {
    id: 'cough_child', name: 'Cough after a cold (bronchitis)', local: ['chest cough'], model: 'viral',
    epi: { w: 4, age: [[0, 2, 1], [2, 12, 2], [12, 99, 0.4]], season: { cool_dry: 1.7, hot_dry: 0.8, rains: 1, late_rains: 1.2 } },
    params: { days: [14, 4], peak: 3, cough: 1, nightCough: 0.8, runny: 0.3, fever: [0, 0.4] },
    complaint: ['{who} has coughed {when}, worst at night.', 'A cough that will not stop, {when} now.'],
    teach: { treat: [], helps: ['honey'], harms: ['codeine'], refer: 'Fast breathing, chest drawing in, or a cough longer than 3 weeks with weight loss (TB).' },
    learn: 'Most coughs in children follow a cold and last up to 2–3 weeks. Honey in warm water eases night cough (not under 1 year). Count the breathing: fast breathing means pneumonia.',
    ref: 'WTND pp.168–170', icon: 'sun-cloud', color: '#90a0b0',
  },
  {
    id: 'pneumonia', name: 'Pneumonia', local: ['chest fever'], model: 'bacterial',
    epi: { w: 2.2, age: [[0, 5, 4], [5, 15, 1], [15, 60, 0.6], [60, 99, 2]], season: { cool_dry: 1.8, hot_dry: 0.8, rains: 1, late_rains: 1.2 } },
    params: { org: 's_pneumoniae', L0: [6, 7.5], r: 0.05, Lsym: 4, Lmax: 10, imm: 0.08, onset: 120, hazard: 0.003, chest: true, fever: [1.6, 2.8], cough: 1 },
    complaint: ['{who} is hot and breathing fast {when}.', 'Cough and high fever {when}, and the breathing is hard.'],
    teach: { treat: ['amoxicillin'], helps: ['honey'], harms: [], refer: 'Chest drawing in, grunting, cannot drink, or no better after 2 days of amoxicillin: refer now.' },
    learn: 'Fast shallow breathing (a young child over 40–50 breaths a minute), the skin between the ribs sucking in, high fever, sometimes grunting. Pneumonia kills more children than any other infection; it needs an antibiotic — amoxicillin by mouth for 5 days for most children.',
    ref: 'WTND p.171', icon: 'heart-beats', color: '#c07050',
  },
  {
    id: 'malaria', name: 'Malaria (falciparum)', local: ['fever with shaking', 'homa'], model: 'malaria',
    epi: { w: 8, age: [[0, 1, 2], [1, 5, 4], [5, 15, 2], [15, 99, 1]], season: { cool_dry: 0.5, hot_dry: 0.35, rains: 1.6, late_rains: 2.4 }, mosquito: 2.5, pregnant: 2 },
    params: { org: 'p_falciparum', P0: [10.2, 11.4], mf: 12, pyro: [50, 3000], hbDrop: 0.6, hazard: 0.001 },
    complaint: ['Fever with shaking {when}, and headache.', '{who} was very hot last night and shivering, then sweating. It started {ago}.', 'Fevers come and go {when}. Weak, no appetite.'],
    teach: { treat: ['quinine', 'lumefantrine'], helps: ['salicin', 'paracetamol'], harms: ['artemisinin_alone'], refer: 'Fits, confusion, cannot drink, very pale, very weak: severe malaria — refer at once.' },
    learn: 'Chills, then high fever, then sweating, often every second or third day; headache; in children vomiting and fast breathing. Where malaria is common and there is no test, treat unexplained high fever as malaria with the medicine that works locally. Artemether with lumefantrine for 3 days (with food) is the standard cure; quinine cures if taken for the full 7 days. Chloroquine only where the parasites still respect it. Artemisia tea or artesunate alone clears the fever but the parasites come back.',
    ref: 'WTND pp.186–187, 363–367', icon: 'thermometer-hot', color: '#d0a040',
  },
  {
    id: 'wound_minor', name: 'Cut or scrape', local: ['a cut'], model: 'wound',
    epi: { w: 5, age: [[0, 5, 1], [5, 15, 2], [15, 60, 1.6], [60, 99, 0.8]], season: { cool_dry: 1, hot_dry: 1, rains: 1.3, late_rains: 1.4 } },
    params: { org: 's_aureus', size: [1, 5], dirt: [0.2, 0.8], I0: [0, 1.5], days: 7, tetanus: 6e-5 }, // tetanus: spores per hour × dirt in the unvaccinated (estimate)
    complaint: ['{who} cut {refl} with a panga {ago}.', 'A cut on the leg from a thorn, {ago}.', 'Fell on the rocks {ago}. The knee is torn open.'],
    teach: { treat: ['clean'], helps: ['honey', 'aloe_gel'], harms: [], refer: 'Deep wound with spurting blood, or a wound from a dirty nail in someone never vaccinated (tetanus).' },
    learn: 'Clean is everything. Wash the wound and the skin around it with soap and boiled water, take out every bit of dirt, cover it with a clean cloth. Honey on a dressing helps clean wounds heal and keeps germs down.',
    ref: 'WTND pp.84–87', icon: 'bandage-roll', color: '#d07060',
  },
  {
    id: 'wound_infected', name: 'Infected wound', local: ['a sore with pus'], model: 'wound',
    epi: { w: 2.5, age: [[0, 5, 1], [5, 15, 2], [15, 99, 1.2]], season: { cool_dry: 0.9, hot_dry: 1, rains: 1.4, late_rains: 1.4 } },
    params: { org: 's_aureus', size: [1.5, 6], dirt: [0.5, 1], I0: [3, 4.5], days: 4, tetanus: 6e-5 },
    complaint: ['The cut on {poss} foot is swollen and full of pus {when}.', 'An old wound, now hot and red and paining, {when}.'],
    teach: { treat: ['clean', 'hot_compress'], helps: ['honey', 'dicloxacillin'], harms: [], refer: 'Red streaks up the limb, swollen glands with fever: the infection is spreading — it needs an antibiotic that works on staph (dicloxacillin), and help if it keeps spreading.' },
    learn: 'Swollen, red, hot, painful, pus, bad smell. Raise the limb, hot compresses 20 minutes 4 times a day, clean out the pus. If red lines run up the arm or leg or there is fever, it is spreading: antibiotics.',
    ref: 'WTND pp.88–89, 195', icon: 'bandage-roll', color: '#b08040',
  },
  {
    id: 'burn_minor', name: 'Burn', local: ['a burn'], model: 'burn',
    epi: { w: 2, age: [[0, 5, 3], [5, 15, 1.2], [15, 99, 0.7]], season: { cool_dry: 1.4, hot_dry: 1, rains: 1, late_rains: 1 } },
    params: { org: 's_aureus', tbsa: [0.5, 6], deep: 0.15, days: 14 },
    complaint: ['{who} fell against the cooking pot {ago}. It is blistered.', 'Hot porridge spilled on {poss} arm {ago}.'],
    teach: { treat: ['clean'], helps: ['aloe_gel', 'honey'], harms: [], refer: 'Burns larger than the palm ×10 in a child (10% of body), on face/hands/genitals, or deep (white, no feeling).' },
    learn: 'Cool the burn in cold water at once. Do not break blisters. Keep it very clean; aloe gel or honey on clean cloth help small burns heal. Large burns lose much water — give plenty to drink and get help.',
    ref: 'WTND pp.96–97, 13', icon: 'fire-bowl', color: '#e07040',
  },
  {
    id: 'scabies', name: 'Scabies', local: ['the itch'], model: 'scabies',
    epi: { w: 4, age: [[0, 15, 2.5], [15, 99, 1]], season: { cool_dry: 1.3, hot_dry: 1.2, rains: 0.9, late_rains: 0.8 }, crowd: 1.5 },
    params: { mites: [8, 30], growth: 0.004, sens: [0.6, 1] },
    complaint: ['{who} itches all over, worst at night, {when}.', 'Little itchy bumps between the fingers, {when}. The brothers have it too.'],
    teach: { treat: ['permethrin', 'sulfur', 'benzyl_benzoate'], helps: ['azadirachtin'], harms: [], refer: null },
    learn: 'Tiny itchy bumps, worst at night, between fingers, on wrists, waist, genitals. Treat the whole family at once, boil or sun the clothes and bedding. Sulfur mixed with lard (1 to 10) rubbed over the whole body 3 times a day for 3 days; not for babies under 1. The itch can last 2 weeks after the mites are dead.',
    ref: 'WTND p.199', icon: 'spider-web', color: '#c0a080',
  },
  {
    id: 'ascaris', name: 'Roundworm', local: ['worms'], model: 'worms',
    epi: { w: 4, age: [[0, 2, 0.6], [2, 15, 3], [15, 99, 0.6]], season: { cool_dry: 1, hot_dry: 0.9, rains: 1.2, late_rains: 1.1 }, water: 1.4 },
    params: { worms: [4, 40], life: 365, target: 'worms_ascaris', heavy: 50 },
    complaint: ['{who} passed a long worm {ago}.', 'The belly is big and paining, and {pron} is thin. Worms, I think.'],
    teach: { treat: ['mebendazole', 'albendazole'], helps: ['papain_bitc'], harms: [], refer: 'Swollen hard belly with vomiting and no stool: blocked gut — refer.' },
    learn: 'Long white worms in the stool or vomit; swollen belly; poor growth; sometimes a dry cough when the young worms pass through the lungs. Latrines, washing hands and clean food prevent them. Dried papaya seed powder helps; modern worm medicine works better.',
    ref: 'WTND pp.140, 13', icon: 'curling-vines', color: '#e0d0b0',
  },
  {
    id: 'pinworm', name: 'Pinworm', local: ['threadworm'], model: 'worms',
    epi: { w: 2.5, age: [[0, 3, 0.5], [3, 12, 3], [12, 99, 0.6]], season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 }, crowd: 1.3 },
    params: { worms: [20, 120], life: 40, target: 'worms_pinworm', reinfect: 0.025, heavy: 1e9 },
    complaint: ['{who} scratches the bottom all night, {when} now.', 'Little white threads in the stool, and itching at night.'],
    teach: { treat: ['hygiene'], helps: ['mebendazole', 'albendazole', 'allicin'], harms: [], refer: null },
    learn: 'Itching around the anus at night; tiny white thread worms. They pass from bottom to fingers to mouth: cut nails, wash hands and bottom every morning, wash bedding. Garlic is the book\'s home remedy; hygiene is the real cure.',
    ref: 'WTND pp.141, 12', icon: 'curling-vines', color: '#f0f0e0',
  },
  {
    id: 'back_pain', name: 'Back pain', local: ['the back'], model: 'pain',
    epi: { w: 4, age: [[0, 15, 0.05], [15, 40, 1], [40, 99, 1.8]], season: { cool_dry: 1, hot_dry: 1, rains: 1.2, late_rains: 1.3 } },
    params: { pain: [0.4, 0.8], halfDays: 18 },
    complaint: ['My back has been paining {when}, from digging.', 'The low back is stiff and paining {when}.'],
    teach: { treat: [], helps: ['paracetamol', 'ibuprofen', 'aspirin', 'salicin'], harms: [], refer: 'Back pain with fever, weight loss, or legs going weak: TB of the spine or worse.' },
    learn: 'Most back pain from work gets better in a few weeks. Keep moving gently, sleep on a firm surface, lift with the legs. A pain remedy helps the days pass.',
    ref: 'WTND pp.173–174', icon: 'weight-lifting-up', color: '#a08060',
  },
  {
    id: 'heart_failure', name: 'Heart failure (dropsy)', local: ['swollen legs', 'water in the body'], model: 'heart',
    epi: { w: 1.2, age: [[0, 45, 0], [45, 60, 1], [60, 99, 3]], season: { cool_dry: 1.2, hot_dry: 1, rains: 1, late_rains: 1 } },
    params: { V0: [2.5, 5], c: [0.35, 0.6], hazard: 0.004 },
    complaint: ['My feet are swollen and I am short of breath on the path, {when}.', 'I cannot sleep lying flat, I must sit up to breathe — {when} now.'],
    teach: { treat: ['digitoxin'], helps: ['cornsilk_k'], harms: [], refer: 'Breathless at rest, coughing pink froth: refer at once.' },
    learn: 'Weak heart: swollen feet worse in the evening, breathless walking and when lying flat, fast pulse. Less salt, sleep propped up. Digitalis (foxglove) strengthens the beat but the poisonous dose is close to the useful one — small doses, count the pulse every day, stop if under 60 or if nausea or yellow vision comes.',
    ref: 'WTND pp.325, 176', icon: 'heart-beats', color: '#c04060',
  },
  {
    id: 'nausea_pregnancy', name: 'Morning sickness', local: ['sickness of pregnancy'], model: 'pregnancy',
    epi: { w: 2, pregnant: 6, onlyPregnant: true, early: true, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    params: { weeks: [6, 13], peak: 10, end: 17 },
    complaint: ['I am expecting and I vomit every morning, {when} now.', 'I cannot keep food down. My monthly has stopped.'],
    teach: { treat: [], helps: ['gingerol'], harms: ['tropane', 'digitoxin'], refer: 'Vomiting everything for days, no urine, weight falling: refer.' },
    learn: 'Common in the 2nd and 3rd month. Small dry meals often, eat before getting up. Ginger tea helps many women. Avoid medicines in pregnancy unless truly needed.',
    ref: 'WTND p.248', icon: 'vomiting', color: '#c0c070',
  },
  {
    id: 'pre_eclampsia', name: 'Pre-eclampsia', local: ['swelling of pregnancy'], model: 'preeclampsia',
    epi: { w: 0.6, pregnant: 6, onlyPregnant: true, late: true, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    params: { weeks: [28, 38], sev: [0.2, 0.5], rise: 0.008, hazard: 0.004 },
    complaint: ['My face and hands are swollen and my head is paining, {when}.', 'I am 8 months gone. My feet and face swell, and I see spots.'],
    teach: { treat: [], helps: [], harms: ['cornsilk_k'], refer: 'Refer at once: she needs a hospital before fits begin.' },
    learn: 'In late pregnancy, sudden swelling of the face and hands, headache, blurred vision, high blood pressure: toxaemia of pregnancy. It can turn to fits and kill mother and baby. A diuretic tea hides the swelling and treats nothing. Get her to a hospital.',
    ref: 'WTND p.249', icon: 'heart-beats', color: '#a04080',
  },

  // ——— phase 2: more of the book
  {
    id: 'uti', name: 'Bladder infection (urinary tract infection)', local: ['burning water', 'hot urine'], model: 'bacterial',
    epi: { w: 3, age: [[0, 2, 0.4], [2, 15, 0.5], [15, 50, 1.6], [50, 99, 1.2]], sex: { f: 1, m: 0.12 }, pregnant: 2, season: { cool_dry: 1, hot_dry: 1.1, rains: 1, late_rains: 1 } },
    // ~1% of untreated bladder infections climb to the kidney (Ferry SA et al. Scand J Prim Health Care 2007;25:49: 3/288 on placebo); perH an estimate
    params: { org: 'e_coli', L0: [5.5, 7], r: 0.05, Lsym: 4, Lmax: 9, imm: 0.05, onset: 96, hazard: 0.0006, urinary: true, fever: [0, 1.6], ascend: { to: 'pyelonephritis', perH: 0.0001, minS: 0.4 } },
    complaint: ['{who} has had burning when passing water {when}, again and again.', 'Passing urine burns, and {pron} must go again and again, {when}.', 'Pain low in the belly, and the urine burns, {when}.'],
    teach: { treat: ['cotrimoxazole', 'amoxicillin', 'ciprofloxacin'], helps: [], harms: [], refer: 'Fever with pain in the side of the back and vomiting: the kidneys are infected. Men and children with urine infections need to be checked for a cause.' },
    learn: 'Burning when passing urine, passing urine often, pain low in the belly, sometimes cloudy or bloody urine. Far more common in women. Drink plenty of water. The book suggests cotrimoxazole or amoxicillin; where the germ resists both, ciprofloxacin. Pain in the side of the back with fever means the kidneys.',
    ref: 'WTND pp.234–235', icon: 'water-drop', color: '#e0d060',
  },
  {
    id: 'ear_infection', name: 'Ear infection (otitis media)', local: ['ear pain', 'a running ear'], model: 'bacterial',
    epi: { w: 3.5, age: [[0, 0.5, 0.5], [0.5, 5, 4], [5, 12, 1.5], [12, 99, 0.2]], season: { cool_dry: 1.5, hot_dry: 0.8, rains: 1, late_rains: 1.2 } },
    // mastoiditis follows ~1 in 1000 untreated ear infections (Van Zuijlen DA et al. Pediatrics 2001;107:1); perH an estimate
    params: { org: 's_pneumoniae', since: [6, 36], L0: [5, 6.5], r: 0.05, Lsym: 4, Lmax: 9, imm: 0.08, onset: 48, hazard: 0.0002, ear: true, fever: [0.6, 2], ascend: { to: 'mastoiditis', perH: 0.00002, minS: 0.5 } },
    complaint: ['The ear is paining {when}, and {pron} is hot.', '{poss} ear has been paining {when}, worse at night.'],
    teach: { treat: ['amoxicillin'], helps: ['paracetamol'], harms: [], refer: 'A painful swelling behind the ear, a stiff neck, or very drowsy: refer at once.' },
    learn: 'Common in small children after a cold: fever, ear pain, crying, pulling at the ear; sometimes pus runs out when the eardrum bursts, and the pain eases. Most get better by themselves; the book gives amoxicillin, and something for the pain. Keep a running ear clean with a twist of clean cloth; never put grass or sticks in it.',
    ref: 'WTND p.309', icon: 'talk', color: '#d0a080',
  },
  {
    id: 'strep_throat', name: 'Strep throat (tonsillitis)', local: ['sore throat', 'the tonsils'], model: 'bacterial',
    epi: { w: 3, age: [[0, 3, 0.3], [3, 15, 3], [15, 40, 0.8], [40, 99, 0.3]], season: { cool_dry: 1.6, hot_dry: 0.8, rains: 1, late_rains: 1.2 }, crowd: 1.3 },
    // Rheumatic fever follows ~0.3–3% of untreated strep throats, 1–3 weeks later (Siegel AC et al. N Engl J Med 1961;265:559;
    // 0.5% used). Penicillin started early and kept up for 10 days cuts it by ~70% (Robertson KA et al. BMC Cardiovasc
    // Disord 2005;5:11): protection grows with the hours that free drug sits above the strain's MIC over the first 19 days;
    // fullH is calibrated so 10 days of penicillin V four times a day (~40% of the time above MIC) gives the full effect.
    params: { org: 's_pyogenes', L0: [5.5, 7], r: 0.05, Lsym: 4, Lmax: 9, imm: 0.1, onset: 48, hazard: 0, strep: true, fever: [1, 2.2],
      sequel: { to: 'rheumatic_fever', odds: 0.005, within: 456, fullH: 100, protect: 0.7, days: [7, 21] } },
    complaint: ['{who} has a very sore throat and will not swallow, with fever, {when}.', '{poss} throat burns and it hurts to swallow, {when}.'],
    teach: { treat: ['penicillin_v', 'amoxicillin'], helps: ['paracetamol'], harms: [], refer: 'Cannot open the mouth or swallow spit, or a swelling pushes one tonsil across: an abscess — refer.' },
    learn: 'A sudden sore throat, pain on swallowing, fever, swollen tonsils with white spots of pus, tender lumps under the jaw, and usually no cough or runny nose. Most sore throats are colds; this one is strep. Penicillin for 10 full days guards against rheumatic fever, which can scar the heart for life.',
    ref: 'WTND pp.309–310', icon: 'thermometer-hot', color: '#e06060',
  },
  // ——— complications: they arise from the illnesses above (disease.js `ascend` / `sequel`), never walk in on their own
  {
    id: 'rheumatic_fever', name: 'Rheumatic fever', local: ['joint fever'], model: 'pain',
    epi: { w: 0 },
    // About 60% of attacks scar the heart valves; a share of those fail years later (heart failure; 1 game year = 40 days).
    // Monthly benzathine penicillin would prevent the return attacks that add the damage; return attacks are not modelled yet.
    params: { pain: [0.5, 0.9], halfDays: 10, fever: [0.6, 1.8], joints: true, sequel: { to: 'heart_failure', odds: 0.3, within: 0, fullH: 1, protect: 0, days: [200, 800] } },
    complaint: ['{poss} wrists and ankles are swollen and hot, and the pain moves from joint to joint, with fever.'],
    teach: { treat: ['penicillin_v', 'benzylpenicillin', 'aspirin'], helps: ['ibuprofen'], harms: [], refer: 'Breathless, chest pain or a fast weak pulse: the heart is involved — refer. Anyone who has had it needs penicillin at every sore throat, or monthly benzathine injections.' },
    learn: 'Begins 1 to 3 weeks after a strep throat: fever, painful swollen hot joints (wrists and ankles, then knees and elbows), sometimes lumps under the skin or jerking movements. The danger is the heart. Penicillin, and aspirin in large doses for the joints. Prevent it by treating strep throat early with penicillin for 10 full days.',
    ref: 'WTND p.310', icon: 'heart-beats', color: '#c05050',
  },
  {
    id: 'pyelonephritis', name: 'Kidney infection (pyelonephritis)', local: ['kidney fever'], model: 'bacterial',
    epi: { w: 0 },
    // untreated it can spread to the blood; the hazard is an estimate
    params: { org: 'e_coli', L0: [6, 7], r: 0.06, Lsym: 4, Lmax: 9, imm: 0.03, onset: 120, hazard: 0.003, kidney: true, fever: [1.5, 2.6] },
    complaint: ['High fever with shaking, pain in the side of the back, and vomiting.'],
    teach: { treat: ['ciprofloxacin', 'ceftriaxone', 'cotrimoxazole'], helps: ['paracetamol'], harms: [], refer: 'Vomiting everything, very weak or confused, or no better after 2 days of treatment: refer.' },
    learn: 'When a bladder infection climbs to the kidneys: high fever and chills, pain in the side of the back (tap gently over the kidney), often vomiting. It needs an antibiotic that the germ does not resist, for 10–14 days, and plenty to drink.',
    ref: 'WTND pp.234–235, 357', icon: 'water-drop', color: '#d0a040',
  },
  {
    id: 'mastoiditis', name: 'Mastoiditis', local: ['the swelling behind the ear'], model: 'bacterial',
    epi: { w: 0 },
    // can spread inward to the brain (meningitis, abscess); the hazard is an estimate
    params: { org: 's_pneumoniae', L0: [6, 7], r: 0.04, Lsym: 4, Lmax: 9, imm: 0.02, onset: 200, hazard: 0.002, mastoid: true, fever: [1, 2.2], ascend: { to: 'meningitis', perH: 1e-4, minS: 0.5 } }, // ~2% reach the brain untreated (estimate)
    complaint: ['A painful swelling has come up behind {poss} ear, with fever.'],
    teach: { treat: ['ceftriaxone'], helps: ['paracetamol'], harms: [], refer: 'Refer at once: it needs injected antibiotics and often an operation.' },
    learn: 'An ear infection that spreads into the bone behind the ear: a hot, painful swelling behind the ear that pushes the ear forward, fever, a very sick child. It can spread to the brain. Injected antibiotics and the hospital.',
    ref: 'WTND p.309', icon: 'talk', color: '#c08060',
  },
  {
    id: 'typhoid', name: 'Typhoid fever', local: ['the slow fever'], model: 'bacterial',
    epi: { w: 1.2, age: [[0, 2, 0.3], [2, 5, 0.8], [5, 40, 1.5], [40, 99, 0.6]], season: { cool_dry: 0.7, hot_dry: 1.2, rains: 1.5, late_rains: 1.1 }, water: 2.2 },
    // untreated ~10–20% die, treated ~1% (Crump JA, Mintz ED. Clin Infect Dis 2010;50:241); hazard calibrated to that
    params: { org: 's_typhi', since: [96, 240], L0: [5.5, 6.5], r: 0.03, Lsym: 4.5, Lmax: 8.5, imm: 0.04, onset: 260, hazard: 0.05, typhoid: true, fever: [1.5, 2.8], cramp: 0.4 },
    complaint: ['A fever that climbs higher every day, {when}, and a headache.', '{who} has had a fever {when} that will not break, and the belly pains.'],
    teach: { treat: ['ciprofloxacin', 'chloramphenicol'], helps: ['oral_fluid', 'paracetamol'], harms: [], refer: 'The belly hard and very painful, blood in the stool, confusion, or no better after 3 days of treatment: the gut may have burst — refer at once.' },
    learn: 'Starts like flu; the fever rises a little each day for a week, with headache and a pulse slower than such a fever should give. Belly pain, constipation or diarrhoea; in the second week confusion, sometimes faint rose-pink spots. In the third week the gut can bleed or burst. Ciprofloxacin where it still works, or chloramphenicol. Plenty to drink, soft food.',
    ref: 'WTND pp.188–189', icon: 'thermometer-hot', color: '#c08040',
  },
  {
    id: 'amoebiasis', name: 'Amoebic dysentery', local: ['bloody flux', 'amoebas'], model: 'bacterial',
    epi: { w: 1.5, age: [[0, 5, 0.8], [5, 99, 1]], season: { cool_dry: 0.8, hot_dry: 1, rains: 1.4, late_rains: 1.1 }, water: 2 },
    params: { org: 'e_histolytica', since: [72, 336], L0: [5.5, 6.5], r: 0.03, Lsym: 4, Lmax: 9, imm: 0.012, onset: 240, hazard: 0.0004, stool: { perDay: 6, mlKg: [12, 10, 6, 4] }, blood: true, fever: [0, 0.6], cramp: 0.6 },
    complaint: ['Stools with blood and slime, on and off {when}, and the belly cramps.', '{who} has had loose stools with mucus and a little blood {when}.'],
    teach: { treat: ['metronidazole'], helps: ['oral_fluid'], harms: ['tropane'], refer: 'Pain and swelling under the right ribs with fever: an abscess in the liver — refer.' },
    learn: 'Diarrhoea that comes and goes, with mucus and sometimes blood, cramps, but little or no fever, unlike the high fever of Shigella. It can drag on for weeks. Metronidazole kills the amoebas. Clean water and latrines prevent it.',
    ref: 'WTND p.144', icon: 'water-drop', color: '#a06050',
  },
  {
    id: 'giardia', name: 'Giardia', local: ['the rotten-egg belly'], model: 'bacterial',
    epi: { w: 1.8, age: [[0, 5, 1.6], [5, 15, 1], [15, 99, 0.6]], season: { cool_dry: 1, hot_dry: 1, rains: 1.2, late_rains: 1.1 }, water: 1.8 },
    params: { org: 'g_lamblia', since: [72, 336], L0: [5.5, 6.5], r: 0.03, Lsym: 4, Lmax: 9, imm: 0.034, onset: 400, hazard: 0, stool: { perDay: 5, mlKg: [15, 10, 6, 4] }, giardia: true },
    complaint: ['Yellow, frothy, stinking stools {when}, and the belly swells with gas.', '{who} has had loose, smelly stools {when}, and burps that taste of rotten eggs.'],
    teach: { treat: ['metronidazole'], helps: ['oral_fluid'], harms: [], refer: null },
    learn: 'Yellow, bubbly, foul-smelling diarrhoea without blood or mucus, a swollen gassy belly, burps that smell of rotten eggs, and weight loss. It can last weeks. Metronidazole cures it. Boil drinking water.',
    ref: 'WTND p.145', icon: 'water-drop', color: '#d0c060',
  },
  {
    id: 'hookworm', name: 'Hookworm (with anaemia)', local: ['weak blood'], model: 'worms',
    epi: { w: 3, age: [[0, 3, 0.3], [3, 15, 2], [15, 99, 1.3]], season: { cool_dry: 0.9, hot_dry: 0.8, rains: 1.3, late_rains: 1.2 }, water: 1.2 },
    // Necator americanus takes ~0.03 ml of blood per worm per day (Ancylostoma ~0.15). Worm counts are those of
    // people ill enough to walk to a clinic, not of everyone infected.
    params: { worms: [40, 250], life: 730, target: 'worms_hookworm', heavy: 1e9, bloodLoss: 0.03 },
    complaint: ['{who} has been tired and weak {when}, with no strength for work or play.', '{who} gets breathless on the path and has no strength, {when} now.'],
    teach: { treat: ['albendazole', 'mebendazole'], helps: ['iron'], harms: [], refer: 'Very pale, breathless at rest, or swollen: severe anaemia — refer.' },
    learn: 'Hookworms suck blood from the gut wall: many worms, slowly, make thin weak blood. Pale inner eyelids and palms, tiredness, children eating earth, sometimes a swollen face and feet. The young worms come in through bare feet. Albendazole kills them; iron tablets for 3 months rebuild the blood. Shoes and latrines prevent them.',
    ref: 'WTND pp.142, 124', icon: 'curling-vines', color: '#c09080',
  },
  {
    id: 'measles', name: 'Measles', local: ['the rash with fever'], model: 'viral',
    epi: { w: 1.5, age: [[0, 0.75, 0.3], [0.75, 5, 3], [5, 15, 1.2], [15, 99, 0.05]], season: { cool_dry: 1, hot_dry: 1.6, rains: 0.8, late_rains: 0.8 }, crowd: 1.5 },
    // Case fatality ~3–6% in poor rural toddlers, far higher in the thin and the very young (hazard calibrated).
    params: { since: [72, 140], days: [10, 2], peak: 5, measles: true, fever: [1.5, 2.6], cough: 0.8, runny: 0.7, hazard: 0.00008 },
    complaint: ['{who} has had a high fever, red eyes and a cough {when}, and now a rash.', 'A rash that started on the face and is spreading down, with fever, {when}.'],
    teach: { treat: ['vitamin_a'], helps: ['paracetamol', 'oral_fluid'], harms: [], refer: 'Fast breathing, fits, very drowsy, unable to drink, or bloody diarrhoea: refer at once.' },
    learn: 'Begins like a bad cold with high fever, red watery eyes and cough. On the 3rd or 4th day tiny white spots like grains of salt appear inside the cheeks, then a blotchy rash spreads from the face down. Dangerous in thin children: pneumonia, diarrhoea, blindness. Give vitamin A (two doses, a day apart), keep feeding and giving drinks. Vaccination prevents it.',
    ref: 'WTND pp.311–312', icon: 'spider-web', color: '#d05050',
  },

  // ——— infections (WTND chapters 13–18, 21 and pp.399–403)
  // `pace: COMPRESS`: an infection of months or years (TB, leprosy, syphilis, trachoma, HIV) runs on the game calendar,
  // and the treatment that cures it with it: six months of TB treatment is ~20 game days. Their other times (`since`,
  // rates) are written in real time and divided or multiplied by COMPRESS.
  {
    id: 'tb', name: 'Tuberculosis of the lungs', local: ['the long cough', 'consumption'], model: 'mycobacterial',
    epi: { w: 1.4, age: [[0, 5, 0.3], [5, 15, 0.4], [15, 35, 1.6], [35, 60, 1.3], [60, 99, 1]], sex: { m: 1.5, f: 1 }, season: { cool_dry: 1.1, hot_dry: 1, rains: 1, late_rains: 1 }, crowd: 1.5 },
    // ~10^9 bacilli in a lung cavity, doubling in ~22 h (r log10/h); 1 in 100 semi-dormant (sleep/wake per hour).
    // Untreated smear-positive TB kills ~70% within 10 years, most in the first 3 (Tiemersma EW et al. PLoS One 2011;
    // 6:e17601): ~20% a year; hazard calibrated to that. Walks in after 4–12 weeks of cough.
    params: { org: 'm_tuberculosis', pace: COMPRESS, since: [28 * 24 / COMPRESS, 84 * 24 / COMPRESS], A0: [8, 9.5], r: 0.0137, Asym: 6, Amax: 9.5, imm: 0.012,
      sleep: 1e-5, wake: 1e-3, hazard: 1.5e-5, waste: 7e-5, hosp: 0.02, tb: true, fever: [0.3, 1.2] },
    complaint: ['I have coughed for weeks now, and I sweat at night.', '{who} has a cough that will not go, for more than a month, and is getting thin.', 'A long cough, and this week some blood in the spit.'],
    teach: { treat: ['isoniazid', 'rifampicin', 'pyrazinamide', 'ethambutol'], helps: [], harms: [], refer: 'The health centre can test the sputum and gives TB medicine free. Coughing much blood, or very weak: refer.' },
    learn: 'A cough of more than 3 weeks, often worst on waking; slight fever in the evening, night sweats, chest or back pain, slow weight loss and weakness; later blood in the spit. Four medicines together (isoniazid, rifampicin, pyrazinamide, ethambutol) for 2 months, then two for 4 more — every day, never stopping early, or it comes back and learns to resist. One medicine alone breeds resistant TB. Eat well and rest; the family should be checked.',
    ref: 'WTND pp.179–180, 359–361', icon: 'heart-beats', color: '#a07070',
  },
  {
    id: 'tb_nodes', name: 'Tuberculosis of the neck glands (scrofula)', local: ['the neck lumps'], model: 'mycobacterial',
    epi: { w: 0.4, age: [[0, 5, 0.8], [5, 35, 1.2], [35, 99, 0.6]], season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 }, crowd: 1.3 },
    // fewer bacilli than a lung cavity; rarely fatal on its own (hazard an estimate)
    params: { org: 'm_tuberculosis', pace: COMPRESS, since: [42 * 24 / COMPRESS, 120 * 24 / COMPRESS], A0: [6, 7.5], r: 0.0137, Asym: 4.5, Amax: 7.5, imm: 0.012,
      sleep: 1e-5, wake: 1e-3, hazard: 2e-6, waste: 3e-5, hosp: 0.02, nodes: true, fever: [0, 0.6] },
    complaint: ['There are lumps in {poss} neck that have grown for months; one broke open and drains.', 'Swellings under the jaw and above the collar bone, for months, not painful.'],
    teach: { treat: ['isoniazid', 'rifampicin', 'pyrazinamide', 'ethambutol'], helps: [], harms: [], refer: 'Any chronic swollen glands or sore: tests at the health centre.' },
    learn: 'Big, painless lymph nodes in the neck or above the collar bone that open, drain pus, close and open again. The same germ as TB of the lungs, treated the same way, often longer.',
    ref: 'WTND pp.180, 212', icon: 'person', color: '#b08070',
  },
  {
    id: 'leprosy', name: 'Leprosy (Hansen\'s disease)', local: ['the numb patches'], model: 'mycobacterial',
    epi: { w: 0.15, age: [[0, 10, 0.5], [10, 99, 1]], season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 }, crowd: 1.5 },
    // M. leprae doubles in ~13 days; from a few patches (10^5) to the lumpy form (10^10). Nerve damage builds over years
    // untreated and stays after cure. Rates are estimates; it hardly ever kills by itself.
    params: { org: 'm_leprae', pace: COMPRESS, since: [180 * 24 / COMPRESS, 720 * 24 / COMPRESS], A0: [5, 10], r: 0.001, Asym: 4, Amax: 11, imm: 0.0009,
      sleep: 1e-5, wake: 1e-4, hazard: 0, waste: 0, hosp: 0, nerve: 1.1e-5, leprosy: true },
    complaint: ['There is a pale patch on my arm that has grown for months. I cannot feel a thorn in it.', 'My hands tingle and are numb, and I burned my fingers on the pot without feeling it.'],
    teach: { treat: ['dapsone', 'rifampicin'], helps: [], harms: [], refer: 'Pain along the nerves, sudden weakness, red painful eyes (a lepra reaction): refer, but keep the medicine.' },
    learn: 'A slowly growing pale patch that does not itch or hurt, and later loses feeling; thick nerves at the elbow, knee and neck; numb hands and feet that get burned and cut without pain; in the lumpy form, thick ear lobes and lost eyebrows. Dapsone every day with rifampicin, for 6 months (patches only) to a year (lumps). Damage already done stays: protect numb hands, feet and eyes.',
    ref: 'WTND pp.191–192, 362–363', icon: 'hand', color: '#c0a080',
  },
  {
    id: 'tetanus', name: 'Tetanus (lockjaw)', local: ['lockjaw'], model: 'tetanus',
    epi: { w: 0.3, age: [[0, 0.05, 6], [0.05, 5, 0.3], [5, 99, 1]], season: { cool_dry: 1, hot_dry: 1, rains: 1.3, late_rains: 1.2 } },
    // Germs grow in a dirty wound, toxin binds over a week or two, then stiffness and spasms for weeks. Walks in 1–4 days
    // into the spasms. Without intensive care ~half die even in hospital (WTND p.184); in African hospitals ~43%
    // (Woldeamanuel YW et al. J Neurol Sci 2016;368:292). Hazard calibrated: untreated ~55%, newborns far more.
    params: { org: 'c_tetani', since: [190, 300], L0: [1, 2], r: 0.05, Lmax: 6.5, imm: 0.06, heal: 336, toxin: 0.008, bind: 0.02, recover: 340, hazard: 0.006, tetanus: true, fever: [0.3, 1.2] },
    complaint: ['{who} cannot open the mouth, the neck is stiff, and the body jerks in painful spasms.', 'My jaw is locked and swallowing is hard; I stepped on a nail two weeks ago.'],
    teach: { treat: ['tetanus_ig', 'tetanus_antitoxin', 'metronidazole', 'benzylpenicillin', 'diazepam'], helps: [], harms: [], refer: 'Tetanus is deadly: refer at once. Meanwhile clean the wound, antitoxin, penicillin or metronidazole, diazepam for the spasms, quiet and dark.' },
    learn: 'A stiff jaw (lockjaw), then a stiff neck and body, and painful spasms set off by touch, noise or light; the knee jerk jumps high. In newborns: stops sucking and cries all the time, 3–10 days after birth, from a dirty cord. Clean the wound, give penicillin (or metronidazole), human immune globulin (or horse antitoxin, with adrenaline ready), diazepam for the spasms; touch and move the person little. Vaccination prevents it; so does a clean wound and a clean cord.',
    ref: 'WTND pp.182–184, 388–390', icon: 'person', color: '#806060',
  },
  {
    id: 'meningitis', name: 'Meningitis', local: ['the stiff-neck fever'], model: 'bacterial',
    epi: { w: 0.7, age: [[0, 1, 3], [1, 5, 2], [5, 30, 1.2], [30, 99, 0.4]], season: { cool_dry: 1, hot_dry: 2.2, rains: 0.6, late_rains: 0.7 }, crowd: 1.4 },
    // Untreated bacterial meningitis nearly always kills; treated, ~10% (meningococcal) to ~30% (pneumococcal) die in
    // Africa (WHO 2015). The germ must be killed in the CSF (`csf`: only the CSF share of the blood level reaches it).
    params: { org: 'n_meningitidis', csf: true, since: [6, 36], L0: [6, 7.5], r: 0.08, Lsym: 4, Lmax: 10, imm: 0.02, onset: 48, hazard: 0.025, meningitis: true, fever: [1.5, 3] },
    complaint: ['{who} has a terrible headache, high fever and a stiff neck since {ago}, and vomits.', '{who} is hot, very sleepy and will not bend the neck. It started {ago}.'],
    teach: { treat: ['ceftriaxone', 'benzylpenicillin', 'chloramphenicol'], helps: ['paracetamol'], harms: [], refer: 'Every minute counts: start an injected antibiotic and take the person to hospital.' },
    learn: 'Fever, severe headache, a stiff neck (cannot put the head between the knees), vomiting; in babies a bulging soft spot, a strange cry, sleepiness; later fits and unconsciousness. It can follow measles, an ear infection or TB. Injected antibiotics at once (ceftriaxone, or ampicillin/penicillin with chloramphenicol) and hospital.',
    ref: 'WTND pp.185, 351–359', icon: 'thermometer-hot', color: '#b04060',
  },
  {
    id: 'cholera', name: 'Cholera', local: ['the rice-water sickness'], model: 'bacterial',
    epi: { w: 0.6, age: [[0, 2, 0.5], [2, 15, 1], [15, 99, 1.2]], season: { cool_dry: 0.4, hot_dry: 0.8, rains: 1.8, late_rains: 1.2 }, water: 3 },
    // Severe cholera loses up to ~1 L an hour in an adult; untreated up to half die, with fluids <1% (WHO 2017). Most
    // deaths are dehydration (the water model). Doxycycline halves the stool and its duration (Leibovici-Weissman Y et al.
    // Cochrane 2014;CD008625).
    params: { org: 'v_cholerae', since: [4, 24], L0: [6.5, 8], r: 0.1, Lsym: 4, Lmax: 9, imm: 0.07, onset: 40, hazard: 0, stool: { perDay: 20, mlKg: [160, 160, 170, 170] }, cholera: true, fever: [0, 0.3] },
    complaint: ['{who} has poured out watery stools like rice water since {ago}, and vomits.', 'Stool like rice water, again and again, since {ago}. I am so weak and thirsty.'],
    teach: { treat: ['oral_fluid'], helps: ['doxycycline', 'ciprofloxacin', 'erythromycin'], harms: ['tropane'], refer: 'Cannot drink, no urine, or the pulse is weak: needs a drip at the health centre. Report cholera to the health authorities.' },
    learn: 'Huge amounts of watery stool like rice water, often vomiting, and dehydration within hours, worst in older children and adults. Give the rehydration drink almost without stopping, as much as the person can take. Doxycycline (erythromycin for children) only in severe cases shortens it. Clean water and latrines prevent it.',
    ref: 'WTND pp.158, 152, 355', icon: 'water-drop', color: '#e0e0d0',
  },
  {
    id: 'hepatitis', name: 'Hepatitis (viral)', local: ['the yellow sickness'], model: 'viral',
    epi: { w: 1, age: [[0, 5, 0.6], [5, 40, 1.4], [40, 99, 0.6]], season: { cool_dry: 1, hot_dry: 1, rains: 1.2, late_rains: 1.1 }, water: 1.5 },
    // Very sick 2–3 weeks; liver failure in ~0.1% of children and ~1% of adults (hepatitis A: Jeong SH, Lee HS. World J
    // Gastroenterol 2010;16:5463); hazard and per-age vulnerability (vuln, by age band) calibrated to that.
    params: { since: [72, 200], days: [21, 5], peak: 9, jaundice: true, vomit: 0.3, fever: [0, 0.8], hazard: 0.00006, vuln: [0.1, 0.1, 0.3, 2] },
    complaint: ['{who} is so tired and will not eat {when}, and now the eyes are yellow.', 'My urine is dark like tea and my eyes have gone yellow. I feel sick at the smell of food.'],
    teach: { treat: [], helps: ['oral_fluid'], harms: [], refer: 'Confused, very drowsy, bleeding, or the belly swells: the liver is failing — refer.' },
    learn: 'Tired, no appetite, sick at the smell of food, pain under the right ribs; after a few days yellow eyes and skin, urine dark like cola, pale stools. No medicine cures it. The book warns that medicines such as paracetamol add to the damage; at ordinary doses trials found little harm, but keep doses low. Rest, plenty to drink, fruit and soup; no alcohol for 6 months. Hepatitis A spreads by stool and dirty water; B and C by sex, blood and unboiled needles.',
    ref: 'WTND p.172', icon: 'eye-target', color: '#e0c040',
  },
  {
    id: 'gonorrhoea', name: 'Gonorrhoea', local: ['the drip', 'the clap'], model: 'bacterial',
    epi: { w: 1.2, age: [[0, 15, 0], [15, 25, 1.6], [25, 45, 1], [45, 99, 0.2]], sex: { m: 1.6, f: 1 }, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    // Untreated it lingers for months; in women it climbs to the tubes (PID) in ~10–20% (Haggerty CL et al. J Infect Dis
    // 2010;201 Suppl 2:S134: perH an estimate). An untreated partner gives it back.
    params: { org: 'n_gonorrhoeae', since: [48, 200], L0: [5.5, 7], r: 0.05, Lsym: 4, Lmax: 9, imm: 0.004, onset: 400, hazard: 0, sti: 'drip',
      ascend: { to: 'pid', perH: 1e-4, minS: 0.2, sex: 'f' }, reinfect: { instr: 'treat_partner', odds: 0.5, days: [3, 20] } },
    complaint: ['Pus drips from down below and it burns like fire when I pass water, since {ago}.', 'There is a yellow discharge and it burns to pass water, {when}.'],
    teach: { treat: ['ceftriaxone', 'ciprofloxacin'], helps: ['doxycycline'], harms: [], refer: 'Fever with pain low in the belly in a woman: pelvic infection — treat and refer.' },
    learn: 'In men pus drips from the penis and passing urine burns, 2–5 days after sex with someone infected; women often have no signs, or a yellow discharge and pain low in the belly. Penicillin no longer works in most places; ceftriaxone does. Treat for chlamydia at the same time. The partner must be treated too, or it comes straight back. Untreated it can leave women and men unable to have children.',
    ref: 'WTND pp.236–237, 359', icon: 'water-drop', color: '#d0c050',
  },
  {
    id: 'chlamydia', name: 'Chlamydia', local: ['the quiet drip'], model: 'bacterial',
    epi: { w: 1, age: [[0, 15, 0], [15, 25, 1.8], [25, 45, 0.9], [45, 99, 0.1]], sex: { m: 1, f: 1.3 }, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    params: { org: 'c_trachomatis', since: [96, 400], L0: [5, 6.5], r: 0.03, Lsym: 4, Lmax: 8, imm: 0.002, onset: 600, hazard: 0, sti: 'drip',
      ascend: { to: 'pid', perH: 6e-5, minS: 0.15, sex: 'f' }, reinfect: { instr: 'treat_partner', odds: 0.5, days: [3, 20] } },
    complaint: ['It burns a little when I pass water, and there is some discharge, {when}.', 'A thin discharge and a dull ache low in the belly, {when}.'],
    teach: { treat: ['doxycycline', 'erythromycin', 'amoxicillin'], helps: [], harms: [], refer: null },
    learn: 'Like a mild gonorrhoea, or no signs at all, so it spreads quietly and can scar a woman\'s tubes. Doxycycline for 7 days (erythromycin or amoxicillin in pregnancy). Treat the partner too.',
    ref: 'WTND pp.236–237, 359', icon: 'water-drop', color: '#c0c070',
  },
  {
    id: 'pid', name: 'Pelvic infection (PID)', local: ['the low-belly fever'], model: 'bacterial',
    epi: { w: 0 },
    // complication of gonorrhoea or chlamydia in women (the strain carries over); abscess or peritonitis now and then
    params: { org: 'n_gonorrhoeae', L0: [5.5, 7], r: 0.05, Lsym: 4, Lmax: 9, imm: 0.01, onset: 96, hazard: 0.0004, pelvic: true, fever: [1, 2.2] },
    complaint: ['Pain low in my belly, fever, and a bad-smelling discharge.'],
    teach: { treat: ['ceftriaxone', 'doxycycline', 'metronidazole'], helps: ['paracetamol'], harms: [], refer: 'Very ill, a hard belly, or no better in 2 days: refer.' },
    learn: 'Fever, pain low in the belly and on moving the cervix, a discharge, pain during sex: the infection has climbed to the womb and tubes. Ceftriaxone, then doxycycline and metronidazole for 2 weeks; treat the partner. It can leave a woman unable to have children.',
    ref: 'WTND pp.237, 243', icon: 'thermometer-hot', color: '#b07050',
  },
  {
    id: 'syphilis', name: 'Syphilis', local: ['the bad blood'], model: 'bacterial',
    epi: { w: 0.8, age: [[0, 15, 0], [15, 45, 1.4], [45, 99, 0.4]], sex: { m: 1, f: 1 }, pregnant: 1.5, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    // Chronic, so on the game calendar. A painless sore 2–5 weeks after sex, gone in weeks; a rash for months; then it
    // hides for years. It has never resisted penicillin. In pregnancy it kills many babies (people.js).
    params: { org: 't_pallidum', pace: COMPRESS, since: [14 * 24 / COMPRESS, 70 * 24 / COMPRESS], L0: [5.5, 6.5], r: 0.01, Lsym: 3, Lmax: 9, imm: 0.004, onset: 2000, hazard: 0, sti: 'chancre',
      reinfect: { instr: 'treat_partner', odds: 0.4, days: [5, 25] } },
    complaint: ['There is a sore on my private parts. It does not hurt.', 'A rash all over, even on the palms and soles, and a sore throat. Some weeks ago there was a sore down below that went away.'],
    teach: { treat: ['benzylpenicillin'], helps: ['doxycycline', 'erythromycin'], harms: [], refer: 'Signs for more than a year: three weekly injections. Pregnant women need treatment at once.' },
    learn: 'A painless sore on the genitals (or lips, anus) 2–5 weeks after sex; it goes by itself but the disease does not. Weeks or months later a rash (often on palms and soles), sore throat, mild fever, mouth sores. Then years of nothing, until heart, brain or nerves fail. In pregnancy it kills or damages the baby. One injection of 2.4 million units benzathine penicillin cures early syphilis; doxycycline or erythromycin for 15 days if allergic. Treat the partner.',
    ref: 'WTND pp.237–238, 351', icon: 'spider-web', color: '#a05070',
  },
  {
    id: 'trichomonas', name: 'Trichomonas (vaginal discharge)', local: ['the itching discharge'], model: 'bacterial',
    epi: { w: 1.5, age: [[0, 15, 0], [15, 50, 1], [50, 99, 0.2]], sex: { f: 1, m: 0.08 }, pregnant: 1.3, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    params: { org: 't_vaginalis', since: [96, 400], L0: [5, 6.5], r: 0.03, Lsym: 4, Lmax: 9, imm: 0.0015, onset: 600, hazard: 0, sti: 'froth',
      reinfect: { instr: 'treat_partner', odds: 0.6, days: [5, 25] } },
    complaint: ['A foamy, yellow-green discharge that smells bad and itches, {when}.', 'It itches down below and there is a bad-smelling discharge, {when}.'],
    teach: { treat: ['metronidazole'], helps: [], harms: [], refer: null },
    learn: 'A thin, foamy, greenish-yellow or white discharge with a bad smell and itching, sometimes burning on passing urine. Keep clean; vinegar-water washes help. Metronidazole cures it, and the husband must take it at the same time, even without signs.',
    ref: 'WTND pp.241–242, 368', icon: 'water-drop', color: '#b0d080',
  },
  {
    id: 'chancroid', name: 'Chancroid (painful genital sores)', local: ['the soft sores'], model: 'bacterial',
    epi: { w: 0.4, age: [[0, 15, 0], [15, 45, 1], [45, 99, 0.2]], sex: { m: 1.6, f: 0.6 }, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    params: { org: 'h_ducreyi', since: [72, 300], L0: [5.5, 7], r: 0.04, Lsym: 4, Lmax: 9, imm: 0.004, onset: 400, hazard: 0, sti: 'ulcer',
      reinfect: { instr: 'treat_partner', odds: 0.4, days: [5, 25] } },
    complaint: ['Soft, painful sores on my private parts {when}, and a swelling in the groin.'],
    teach: { treat: ['ciprofloxacin', 'erythromycin', 'ceftriaxone'], helps: ['benzylpenicillin'], harms: [], refer: null },
    learn: 'Soft, painful sores on the genitals or anus, often with a swollen, bursting lymph node (bubo) in the groin. Several painful sores: chancroid (or herpes); one painless sore: syphilis. Erythromycin for 7 days, ciprofloxacin for 3, or one injection of ceftriaxone; treat for syphilis too. Sores let HIV in.',
    ref: 'WTND pp.238, 402–403', icon: 'spider-web', color: '#c06060',
  },
  {
    id: 'hiv', name: 'HIV and AIDS', local: ['slim disease'], model: 'hiv',
    epi: { w: 0.6, age: [[0, 15, 0.05], [15, 25, 0.8], [25, 50, 1.4], [50, 99, 0.5]], sex: { f: 1.2, m: 1 }, season: { cool_dry: 1, hot_dry: 1, rains: 1, late_rains: 1 } },
    // Years, on the game calendar. CD4 falls ~60/µL a year; with AIDS (CD4 < 200) untreated median survival ~1 year in
    // Africa (Morgan D et al. AIDS 2002;16:597), ~10%/year get TB (Lawn SD, Zumla AI. Lancet 2011;378:57). Per real hour.
    params: { pace: COMPRESS, since: [60 * 24 / COMPRESS, 200 * 24 / COMPRESS], cd4: [40, 380], decline: 60 / 8760, hazard: 7e-5, tb: 1.5e-5, waste: 3e-5,
      stool: { perDay: 4, mlKg: [12, 10, 6, 4] }, aids: true, fever: [0.4, 1.4] },
    complaint: ['I keep getting thinner, the diarrhoea has not stopped for over a month, and I have fevers.', 'I am always tired and losing weight; my mouth is full of white patches.'],
    teach: { treat: [], helps: ['oral_fluid'], harms: [], refer: 'An HIV test and the antiretroviral programme at the health centre; test for TB too.' },
    learn: 'HIV spreads by sex, blood, unboiled needles, and from mother to baby; years later AIDS: weight loss, diarrhoea or fever for more than a month, a long cough, thrush in the mouth, swollen glands, shingles, TB. No cure; antiretroviral medicines from the HIV programme keep people well for years. Daily cotrimoxazole prevents many infections. Treat each illness as it comes; condoms and boiled needles prevent it.',
    ref: 'WTND pp.399–401', icon: 'heart-plus', color: '#a06080',
  },
  {
    id: 'impetigo', name: 'Impetigo', local: ['the crusty sores'], model: 'wound',
    epi: { w: 2, age: [[0, 2, 0.8], [2, 12, 2.5], [12, 99, 0.4]], season: { cool_dry: 0.8, hot_dry: 1, rains: 1.4, late_rains: 1.3 }, crowd: 1.5 },
    // A wound-like skin infection: washing, gentian violet and (if widespread) dicloxacillin. Many clear in 2–3 weeks alone.
    params: { org: 's_aureus', size: [1, 4], dirt: [0.4, 0.9], I0: [2.5, 3.5], days: 5, impetigo: true },
    complaint: ['{who} has spreading sores with yellow crusts around the mouth, {when}.', 'Sores with shiny yellow crusts on {poss} face and arms, {when}. They itch.'],
    teach: { treat: ['gentian_violet'], helps: ['dicloxacillin', 'hygiene', 'honey'], harms: [], refer: null },
    learn: 'Spreading sores with shiny yellow crusts, often around a child\'s mouth and nose. Wash with soap and boiled water 3–4 times a day, soaking off the crusts, then paint with gentian violet. If it covers a large area or brings fever, dicloxacillin. Keep the child from sleeping with others.',
    ref: 'WTND p.202', icon: 'bandage-roll', color: '#e0b040',
  },
  {
    id: 'cellulitis', name: 'Cellulitis or erysipelas', local: ['St Anthony\'s fire'], model: 'bacterial',
    epi: { w: 1, age: [[0, 5, 0.6], [5, 40, 0.8], [40, 99, 1.6]], season: { cool_dry: 0.9, hot_dry: 1, rains: 1.2, late_rains: 1.2 } },
    // spreads to the blood now and then (hazard an estimate)
    params: { org: 's_pyogenes', since: [24, 72], L0: [6, 7], r: 0.05, Lsym: 4, Lmax: 9.5, imm: 0.035, onset: 96, hazard: 0.002, cellulitis: true, fever: [1, 2.3] },
    complaint: ['A hot, bright red, swollen patch on {poss} leg that spreads every day, with fever and chills.', 'The skin of my face by the nose is red, hot and very painful, spreading, since {ago}.'],
    teach: { treat: ['penicillin_v', 'benzylpenicillin'], helps: ['hot_compress', 'aspirin'], harms: [], refer: 'Very ill, the patch turning dark or blistering, or no better after 2 days: refer.' },
    learn: 'A painful, hot, bright red, swollen patch that spreads fast (with a sharp border in erysipelas), with fever, chills and swollen glands; often after a break in the skin. Penicillin until 2 days after the signs are gone, hot compresses, aspirin for the pain.',
    ref: 'WTND p.212', icon: 'fire-bowl', color: '#e05040',
  },
  {
    id: 'tinea', name: 'Ringworm (tinea)', local: ['ringworm'], model: 'scabies',
    epi: { w: 2.5, age: [[0, 5, 0.8], [5, 15, 2.5], [15, 99, 0.6]], season: { cool_dry: 0.8, hot_dry: 1, rains: 1.3, late_rains: 1.2 }, crowd: 1.3 },
    // The scabies model on another target: fungus (M, patches' worth) spreads slowly; antifungals on the skin kill a share
    // per application; children pass it to each other. Rates are estimates; untreated it lingers for months.
    params: { on: 'tinea', mites: [10, 40], growth: 0.0012, sens: [0.3, 0.7], spread: 0.0005, tinea: true },
    complaint: ['Round, itchy, scaly rings on {poss} skin, growing {when}.', 'Round patches on {poss} head where the hair falls out, {when}.'],
    teach: { treat: ['whitfield', 'sulfur'], helps: ['gentian_violet', 'hygiene'], harms: [], refer: null },
    learn: 'Itchy rings that grow outward, on the body, scalp (scaly patches with hair loss), between the toes or in the groin. Wash daily with soap, keep the skin dry and in the sun. Sulfur in lard (1 to 10), or creams with salicylic or benzoic acid (Whitfield\'s) for weeks. Bad scalp ringworm needs griseofulvin. Do not share combs or towels.',
    ref: 'WTND pp.205–206, 371', icon: 'spider-web', color: '#c0a060',
  },
  {
    id: 'conjunctivitis', name: 'Pink eye (conjunctivitis)', local: ['red eye', 'sticky eyes'], model: 'bacterial',
    epi: { w: 2.5, age: [[0, 5, 2], [5, 15, 1.2], [15, 99, 0.6]], season: { cool_dry: 1, hot_dry: 1.3, rains: 1, late_rains: 1 }, crowd: 1.4 },
    // Clears by itself in ~1 week in most; antibiotic ointment clears it sooner (cure by day 2–5: ~64% vs 41% on placebo;
    // Sheikh A et al. Cochrane 2012;CD001211). The ointment acts on the eye surface (`site`).
    params: { org: 'h_influenzae', site: 'eye', since: [12, 60], L0: [5, 6.5], r: 0.04, Lsym: 4, Lmax: 8, imm: 0.06, onset: 72, hazard: 0, pinkeye: true },
    complaint: ['{poss} eyes are red with pus, and the lids are stuck together in the morning, {when}.', 'Both eyes red and burning, with yellow crusts, {when}.'],
    teach: { treat: ['tetracycline_eye'], helps: [], harms: [], refer: 'Great pain, a grey spot on the cornea, or no better after 5–6 days of ointment: refer.' },
    learn: 'Red eyes with pus, burning, lids stuck together after sleep; common in children and very catching. Clean the pus with a cloth and boiled water, then put antibiotic eye ointment inside the lower lid 3–4 times a day. Do not share towels; wash hands.',
    ref: 'WTND pp.219, 378', icon: 'eye-target', color: '#e07070',
  },
  {
    id: 'trachoma', name: 'Trachoma', local: ['the rough eyelids'], model: 'bacterial',
    epi: { w: 0.8, age: [[0, 10, 2], [10, 99, 0.6]], season: { cool_dry: 1, hot_dry: 1.4, rains: 0.8, late_rains: 0.9 }, crowd: 2, water: 1.3 },
    // Chronic (months to years), on the game calendar; flies and fingers carry it round the household. Years of repeated
    // infection scar the lids and turn the lashes in (blindness): not modelled here. Clearance an estimate.
    params: { org: 'c_trachomatis', site: 'eye', pace: COMPRESS, since: [30 * 24 / COMPRESS, 150 * 24 / COMPRESS], L0: [5, 6.5], r: 0.01, Lsym: 3.5, Lmax: 7, imm: 0.0009, onset: 2000, hazard: 0, trachoma: true,
      reinfect: { instr: 'treat_family', odds: 0.5, days: [3, 15] } },
    complaint: ['{poss} eyes have been red and watery for months, and the lids feel rough.', 'My eyes are always red and itchy, and the light hurts them.'],
    teach: { treat: ['tetracycline_eye', 'doxycycline', 'erythromycin'], helps: ['hygiene'], harms: [], refer: 'Lashes turning in against the eye: an operation saves the sight.' },
    learn: 'Starts like pink eye; after a month or more, pinkish-grey lumps (follicles) inside the upper lid, and grey new vessels at the top of the cornea. After years, scars that thicken the lids and turn the lashes in to scratch the eye blind. Tetracycline eye ointment for 30 days, with tetracycline or erythromycin by mouth for 2–3 weeks. Wash faces daily; treat the whole household.',
    ref: 'WTND pp.220, 378', icon: 'eye-target', color: '#c08080',
  },
  {
    id: 'eye_injury', name: 'Eye injury (scratched cornea)', local: ['a hurt eye'], model: 'wound',
    epi: { w: 1, age: [[0, 5, 0.6], [5, 60, 1.2], [60, 99, 0.6]], season: { cool_dry: 1, hot_dry: 1.3, rains: 1, late_rains: 1 } },
    // A small scratch heals in a day or two if it stays clean; infected, it becomes a corneal ulcer that can blind
    // (WTND p.218). Antibiotic ointment acts on the eye surface (`site`).
    params: { org: 's_aureus', site: 'eye', since: [2, 30], size: [0.1, 0.5], dirt: [0.2, 0.7], I0: [0, 1.5], days: 2, eyeInjury: true },
    complaint: ['A thorn scratched {poss} eye {ago}. It waters and hurts in the light.', 'Something flew into my eye while cutting wood {ago}; it is red and paining.'],
    teach: { treat: ['tetracycline_eye'], helps: [], harms: [], refer: 'Cannot see well, a deep wound, blood behind the cornea, or no better in a day or two: refer at once.' },
    learn: 'Pain, watering, redness and fear of light after something hit or scratched the eye. If the person still sees well: antibiotic ointment inside the lid and a soft thick pad. A painful grey spot on the cornea is an ulcer; failing sight, a deep wound or blood inside the eye need help at once. Do not pull out things stuck in the eyeball.',
    ref: 'WTND pp.217–218, 224, 378', icon: 'eye-target', color: '#d08080',
  },
  {
    id: 'chickenpox', name: 'Chickenpox', local: ['the water blisters'], model: 'viral',
    epi: { w: 1.5, age: [[0, 1, 0.5], [1, 12, 3], [12, 99, 0.3]], season: { cool_dry: 1.2, hot_dry: 1.4, rains: 0.8, late_rains: 0.8 }, crowd: 1.5 },
    // mild in children; adults far more often get pneumonia (vuln by age band; hazard an estimate)
    params: { since: [24, 72], days: [8, 2], peak: 3, pox: true, fever: [0.5, 1.5], hazard: 0.00001, vuln: [0.5, 0.2, 0.2, 4] },
    complaint: ['{who} has little itchy water blisters all over, with a fever, {when}.'],
    teach: { treat: [], helps: ['paracetamol'], harms: ['aspirin'], refer: 'Fast breathing, or a blister that turns red, hot and swollen: refer.' },
    learn: 'Small itchy blisters like drops of water, first on the body, then the face and limbs, crusting over a week, with a mild fever. It passes by itself. Keep nails short and the skin clean so scratched blisters do not get infected. No aspirin for children with chickenpox (Reye syndrome).',
    ref: 'WTND p.311', icon: 'spider-web', color: '#e0a0a0',
  },
  {
    id: 'mumps', name: 'Mumps', local: ['the swollen jaw'], model: 'viral',
    epi: { w: 1, age: [[0, 2, 0.3], [2, 15, 2.5], [15, 99, 0.4]], season: { cool_dry: 1.2, hot_dry: 1.2, rains: 0.9, late_rains: 0.9 }, crowd: 1.4 },
    params: { since: [24, 72], days: [9, 2], peak: 3, mumps: true, fever: [0.5, 1.4] },
    complaint: ['{poss} face is swollen below the ears and it hurts to chew, {when}.'],
    teach: { treat: [], helps: ['paracetamol'], harms: [], refer: 'A stiff neck, severe headache or drowsiness (meningitis), or belly pain: refer.' },
    learn: 'Fever, then a painful swelling below and in front of one or both ears, at the angle of the jaw; it goes in about 10 days. Soft food, plenty to drink, paracetamol. In adults it sometimes swells the testicles or breasts.',
    ref: 'WTND p.312', icon: 'person', color: '#d0b080',
  },
];

export const COND = new Map(CONDITIONS.map((c) => [c.id, c]));
