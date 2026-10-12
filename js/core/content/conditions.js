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
    params: { org: 's_aureus', size: [1, 5], dirt: [0.2, 0.8], I0: [0, 1.5], days: 7 },
    complaint: ['{who} cut {refl} with a panga {ago}.', 'A cut on the leg from a thorn, {ago}.', 'Fell on the rocks {ago}. The knee is torn open.'],
    teach: { treat: ['clean'], helps: ['honey', 'aloe_gel'], harms: [], refer: 'Deep wound with spurting blood, or a wound from a dirty nail in someone never vaccinated (tetanus).' },
    learn: 'Clean is everything. Wash the wound and the skin around it with soap and boiled water, take out every bit of dirt, cover it with a clean cloth. Honey on a dressing helps clean wounds heal and keeps germs down.',
    ref: 'WTND pp.84–87', icon: 'bandage-roll', color: '#d07060',
  },
  {
    id: 'wound_infected', name: 'Infected wound', local: ['a sore with pus'], model: 'wound',
    epi: { w: 2.5, age: [[0, 5, 1], [5, 15, 2], [15, 99, 1.2]], season: { cool_dry: 0.9, hot_dry: 1, rains: 1.4, late_rains: 1.4 } },
    params: { org: 's_aureus', size: [1.5, 6], dirt: [0.5, 1], I0: [3, 4.5], days: 4 },
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
    params: { worms: [4, 40], life: 365 / COMPRESS, target: 'worms_ascaris', heavy: 50 },
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
    // It worsens over the weeks left (rise per gestational day, compressed calendar). Once severe, fits may begin
    // (eclampsia, disease.js): ~2% of all pre-eclampsia untreated (Magpie Trial Collaborative Group. Lancet
    // 2002;359:1877), ~9% of the severe walk-ins here. hazard (stroke, abruption) and perH are estimates: ~3% of these
    // walk-ins die of it untreated, ~6% with eclampsia and the birth (test/birth.test.mjs).
    params: { weeks: [28, 38], sev: [0.2, 0.5], rise: 0.008, hazard: 0.0003, fits: { at: 0.65, perH: 0.001 } },
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
    params: { org: 's_pneumoniae', L0: [6, 7], r: 0.04, Lsym: 4, Lmax: 9, imm: 0.02, onset: 200, hazard: 0.002, mastoid: true, fever: [1, 2.2] },
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
    params: { worms: [40, 250], life: 730 / COMPRESS, target: 'worms_hookworm', heavy: 1e9, bloodLoss: 0.03 },
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

  // ——— chronic illness and emergencies (WTND chapters 10, 11, 13, 22). Months and years run COMPRESS times faster
  // (time.js: a game year is 40 days), so `tau`, recovery and complication rates of slow processes are given in real
  // time and divided down here; attacks, fits, bites and poisonings run in real hours.
  {
    id: 'asthma', name: 'Asthma attack', local: ['the tight chest', 'whistling chest'], model: 'asthma',
    epi: { w: 2, age: [[0, 2, 0.3], [2, 15, 1.4], [15, 60, 1], [60, 99, 0.8]], season: { cool_dry: 1.4, hot_dry: 1.3, rains: 0.8, late_rains: 0.9 } },
    // Attacks of 12–60 h. Oral steroids cut relapse after an attack by ~60% (Rowe BH et al. Cochrane 2007;CD000195):
    // steroidFewer. hazard is calibrated so ~2–5% of untreated attacks in those who walk in kill (an estimate: asthma
    // deaths are mostly untreated severe attacks, Global Asthma Report 2018).
    params: { since: [2, 30], base: [0.1, 0.4], attack: [0.45, 1.15], hours: [12, 60], perWeek: 0.4, steroidFaster: 2, steroidFewer: 0.6, hazard: 0.012, calibrated: true },
    complaint: ['{who} cannot get breath {when}, and the chest whistles.', 'The chest is tight and {pron} fights for air, {when}. It has happened before.', 'Wheezing and coughing {when}, worse at night.'],
    teach: { treat: ['salbutamol', 'prednisolone'], helps: ['adrenaline'], harms: ['codeine', 'diazepam'], refer: 'Lips or nails turning blue, too breathless to speak, or no better after salbutamol: refer at once.' },
    learn: 'Attacks of hard breathing with a whistle (wheeze) on breathing out; the skin between the ribs sucks in. Usually no fever. Often from childhood, worse in some months, at night, with colds, smoke or dust. Calm the person, give plenty to drink, clean air. Salbutamol opens the airways; for a severe attack add prednisolone by mouth for 3–7 days. If there is nothing else, adrenaline under the skin.',
    ref: 'WTND pp.167, 384–385', icon: 'sun-cloud', color: '#80a0c0',
  },
  {
    id: 'hypertension', name: 'High blood pressure', local: ['pressure', 'high blood'], model: 'chronic',
    epi: { w: 1.5, age: [[0, 30, 0], [30, 45, 0.6], [45, 60, 1.5], [60, 99, 2.5]] },
    // level: systolic pressure above normal (mmHg). Stroke and heart disease double with every 20 mmHg (Lewington S et al.
    // Lancet 2002;360:1903); 10 mmHg lower cuts strokes ~40% (Law MR et al. BMJ 2009;338:b1665). perYear (game years) at
    // normal pressure is an estimate for rural Africa. The pressure settles on a new medicine over ~2 weeks (tau,
    // compressed with its years). Less salt lowers it ~5 mmHg (He FJ et al. BMJ 2013;346:f1325).
    params: { since: [72, 400], level: [22, 70], by: ['bp'], instr: 'low_salt', instrCut: 0.12, tau: 14 / COMPRESS, full: 60,
      risk: [{ to: 'stroke', perYear: 0.006, per: 2, step: 20 }, { to: 'heart_failure', perYear: 0.004, per: 2, step: 20 }] },
    complaint: ['My head pains often and I get dizzy, {when}.', 'My heart pounds and I am short of breath on the path, {when}.', 'I came for my pressure. They measured it high at the mission once.'],
    teach: { treat: ['amlodipine', 'hydrochlorothiazide'], helps: ['low_salt'], harms: [], refer: 'Sudden weakness, chest pain or pressure above 180: refer.' },
    learn: 'At first high blood pressure has no signs; it is found with a cuff. Later: headaches, pounding heart, breathless on effort, dizziness. Over years it brings stroke, heart failure and kidney disease. Little salt, less fat, no smoking, lose weight if fat. If it stays high, a medicine every day for life lowers it: the danger falls with it.',
    ref: 'WTND pp.125, 326, 410', icon: 'heart-beats', color: '#c03040',
  },
  {
    id: 'stroke', name: 'Stroke', local: ['the falling sickness of the old', 'one side dead'], model: 'pain',
    epi: { w: 0.4, age: [[0, 40, 0], [40, 60, 0.6], [60, 99, 2]] },
    // Early case fatality ~20–35% in poorer countries, most in the first week (Feigin VL et al. Lancet Neurol 2009;8:355):
    // hazard calibrated. The damage mends partly over months (halfDays, compressed).
    params: { since: [3, 48], pain: [0.5, 1], halfDays: 90 / COMPRESS, hazard: 0.0086, early: 7 * 24, calibrated: true },
    complaint: ['{who} fell down {ago} and one side will not move. The words come out wrong.', 'My father\'s face is pulled to one side and his arm is dead, since {ago}.'],
    teach: { treat: [], helps: [], harms: [], refer: 'Refer if it can be done: there is little a village clinic can do. Unconscious: on the side, nothing by mouth.' },
    learn: 'Sudden weakness or paralysis of one side, a face pulled to one side, slurred speech, sometimes unconsciousness. Lay the person with the head a little raised, on the side if unconscious, nothing by mouth while unconscious. Afterwards some movement often returns over months; help them walk with a stick. Lowering high blood pressure prevents most strokes.',
    ref: 'WTND pp.327, 326', icon: 'person', color: '#806080',
  },
  {
    id: 'epilepsy', name: 'Epilepsy', local: ['the falling sickness', 'fits'], model: 'fits',
    epi: { w: 1, age: [[0, 1, 0.3], [1, 30, 1.2], [30, 99, 0.6]] },
    // 1 to ~15 fits a month. A few run on (status, ~3%) and kill some; falls into the cooking fire burn many with
    // epilepsy in rural Africa. Rates are estimates (Ngugi AK et al. Neurology 2011;77:1005; WTND p.178).
    params: { since: [4, 72], perDay: [0.03, 0.5], status: 0.03, stop: 0.35, hazard: 0.02, arrive: 0.05, injure: { to: 'burn_minor', per: 0.01 } },
    complaint: ['{who} falls down and shakes, the eyes roll back. It happened again {ago}.', 'Fits come and go, {when}. Last one {ago}.'],
    teach: { treat: ['phenobarbital'], helps: ['diazepam'], harms: [], refer: 'A fit lasting more than 15 minutes that diazepam does not stop: refer.' },
    learn: 'Fits in someone otherwise healthy, hours to months apart: falls, jerks, eyes roll back, then sleeps. Not catching. Phenobarbital every night prevents most fits; it does not cure, often for life, at the lowest dose that works. During a fit move hard things away and put nothing in the mouth. A fit over 15 minutes: diazepam solution into the anus.',
    ref: 'WTND pp.178, 389–390', icon: 'person', color: '#a080c0',
  },
  {
    id: 'febrile_fits', name: 'Fits with fever', local: ['fever fits'], model: 'fits',
    epi: { w: 1, age: [[0, 0.5, 0], [0.5, 5, 3], [5, 99, 0]], season: { cool_dry: 1, hot_dry: 0.8, rains: 1.3, late_rains: 1.3 } },
    // ~1 in 5 fit again in the same illness; ~5% last over 30 minutes (Berg AT, Shinnar S. Neurology 1996;47:562).
    // Fever medicine does not prevent them (Offringa M et al. Cochrane 2017;CD003031): nothing here acts on it.
    params: { since: [1, 10], days: [1, 2.5], perDay: [0.1, 0.4], status: 0.05, stop: 0.35, hazard: 0.005, arrive: 0.05, fever: [1.3, 2.3] },
    complaint: ['{who} was hot with fever and then shook all over and did not answer, {ago}.', 'The child had a fit with the fever this morning.'],
    teach: { treat: ['diazepam'], helps: ['paracetamol'], harms: [], refer: 'Stiff neck, very drowsy long after the fit, a baby under 6 months, or a fit that will not stop: meningitis or malaria of the brain — refer.' },
    learn: 'A young child with high fever may have a short fit; most stop by themselves and do no harm. Cool the child with water, look for the cause of the fever (malaria, meningitis). Fever medicine makes the child comfortable but does not stop fits coming. If a fit lasts more than 15 minutes, diazepam into the anus.',
    ref: 'WTND pp.178, 75–76, 389', icon: 'thermometer-hot', color: '#d08060',
  },
  {
    id: 'marasmus', name: 'Severe malnutrition (marasmus)', local: ['the wasting', 'skin and bones'], model: 'chronic',
    epi: { w: 1.1, age: [[0, 0.5, 0.2], [0.5, 5, 3], [5, 99, 0]], season: { cool_dry: 1, hot_dry: 1.1, rains: 1.1, late_rains: 1.3 } },
    // level: missing nourishment (patient.nutrition = 0.95 − level; MUAC < 11.5 cm below ~0.7). Untreated ~10–20% die
    // within two months, with RUTF ~3–5% (WHO 2013 SAM guideline; Ciliberto 2005): hazard calibrated; recovery with
    // RUTF takes 6–8 weeks (tau, compressed). Advice to feed often with oil and sugar (WTND p.110) helps less.
    params: { since: [200, 700], level: [0.27, 0.45], nut: 0.95, by: ['feed'], instr: 'feeding', instrCut: 0.55, tau: 48 / COMPRESS, full: 0.4, safe: 0.12, hazard: 0.02, heal: 0.15, calibrated: true },
    complaint: ['{who} is getting thinner and thinner {when} and will not play.', '{who} stopped the breast and now is only skin and bones.'],
    teach: { treat: ['rutf', 'feeding'], helps: ['vitamin_a'], harms: [], refer: 'Will not eat, very drowsy, or with fever, cough or diarrhoea as well: refer.' },
    learn: 'Dry malnutrition: the child is starved, small, wasted, skin and bones, the arm under 11.5 cm round. Feed more food, more often: 5 times a day and between, with oil, nuts or sugar added to the main food, beans, eggs, milk. Therapeutic peanut paste (RUTF) at home is the surest. Infections are worse and longer in these children.',
    ref: 'WTND pp.107–113, 297', icon: 'bowl-of-rice', color: '#b09060',
  },
  {
    id: 'kwashiorkor', name: 'Severe malnutrition (kwashiorkor)', local: ['the swelling sickness', 'wet malnutrition'], model: 'chronic',
    epi: { w: 0.6, age: [[0, 1, 0.3], [1, 5, 3], [5, 99, 0]], season: { cool_dry: 1, hot_dry: 1.1, rains: 1.1, late_rains: 1.3 } },
    // Swollen from hunger, not fat. Deaths higher than in marasmus (WHO 2013): hazard calibrated.
    params: { since: [150, 500], level: [0.15, 0.3], nut: 0.95, by: ['feed'], instr: 'feeding', instrCut: 0.55, tau: 40 / COMPRESS, full: 0.25, safe: 0.04, hazard: 0.03, heal: 0.06, oedema: true, calibrated: true },
    complaint: ['{poss} feet and face are swollen {when}, and the skin peels.', '{who} is swollen and sad, will not eat, {when}.'],
    teach: { treat: ['rutf', 'feeding'], helps: ['vitamin_a'], harms: ['cornsilk_k'], refer: 'Will not eat, very drowsy, cold, or with fever or diarrhoea: refer.' },
    learn: 'Wet malnutrition: feet, hands and face swollen, thin arms under the swelling, peeling or dark patches on the skin, thin pale hair, a sad child who will not play. It needs more food more often: energy foods (oil, sugar) and body-building foods (beans, milk, eggs). The swelling goes first.',
    ref: 'WTND pp.112–114', icon: 'bowl-of-rice', color: '#c0a070',
  },
  {
    id: 'anaemia', name: 'Anaemia (thin blood)', local: ['little blood', 'weak blood'], model: 'chronic',
    epi: { w: 2, age: [[0, 0.5, 0], [0.5, 5, 1], [5, 15, 0.5], [15, 50, 1.3], [50, 99, 0.6]], sex: { f: 1, m: 0.35 }, pregnant: 3 },
    // level: haemoglobin missing (g/dL); they walk in with Hb 4.5–9.5 (hbTo). Mostly too little iron (from food, monthly bleeding, pregnancy); some lack
    // folate (need). With the right one Hb rises ~1–2 g/dL in 3 weeks and is whole in ~3 months (tau, compressed).
    // Death in very severe anaemia as for hookworm.
    params: { since: [200, 700], hbTo: [4.5, 9.5], hb: true, by: ['iron', 'folate'], need: 0.85, tau: 40 / COMPRESS, full: 6, hazard: 0.0006, heal: 0.6 },
    complaint: ['I am tired all the time and breathless on the hill, {when}.', '{who} is pale and weak {when}, no strength.'],
    teach: { treat: ['iron'], helps: ['folic_acid'], harms: [], refer: 'Very pale, breathless at rest, swollen, or pregnant and very pale: refer.' },
    learn: 'Thin blood: pale skin, inner eyelids, gums and nails; tired, weak, breathless; very severe, a swollen face and feet and a racing heart. Eat iron-rich foods (meat, liver, beans, dark leaves), cook in iron pots. Iron tablets for moderate or severe anaemia, above all in pregnancy; folic acid as well in pregnancy. Treat what causes it (worms, malaria, dysentery).',
    ref: 'WTND pp.124, 392', icon: 'water-drop', color: '#e0a0a0',
  },
  {
    id: 'diabetes', name: 'Diabetes', local: ['sugar sickness', 'sweet urine'], model: 'chronic',
    epi: { w: 0.8, age: [[0, 30, 0.05], [30, 45, 0.5], [45, 99, 1.5]] },
    // level: fasting blood sugar above normal (mmol/L). The book gives diet only; diet lowers it a little (estimate,
    // HbA1c −0.5 to −1%). Foot sores come at ~2–6% a year in diabetics (Boulton AJ et al. Lancet 2005;366:1719), more
    // with higher sugar; per game year.
    params: { since: [200, 1000], level: [4, 14], instr: 'diet', instrCut: 0.25, tau: 30 / COMPRESS, full: 12,
      risk: [{ to: 'wound_infected', perYear: 0.02, per: 1.6, step: 4 }] },
    complaint: ['I am always thirsty and pass much urine, {when}, and I grow thin.', 'I am tired and hungry all the time {when}. The ants come to my urine.'],
    teach: { treat: ['diet'], helps: [], harms: [], refer: 'A child or young adult with these signs needs insulin: refer. Unconscious: refer at once.' },
    learn: 'Too much sugar in the blood: always thirsty, passing much urine, hungry, tired, losing weight; later itchy skin, blurred sight, numb feet, sores that do not heal. Test: taste the urine (with others) or use strips. Over 40, a strict diet for life: no sugar or sweets, plenty of fibre, lose weight if fat. Shoes always; look after the feet.',
    ref: 'WTND p.127', icon: 'salt-shaker', color: '#e0e0a0',
  },
  {
    id: 'goitre', name: 'Goitre', local: ['the neck lump'], model: 'chronic',
    epi: { w: 0.8, age: [[0, 8, 0.2], [8, 99, 1]], sex: { f: 1, m: 0.4 } },
    // level: size (0.5 just felt … 2.5 large). Iodine shrinks young soft goitres over months (tau, compressed), old hard
    // ones little (Zimmermann MB et al. Lancet 2008;372:1251).
    params: { since: [500, 2000], level: [0.6, 2.5], by: ['iodine'], tau: 180 / COMPRESS, full: 2, heal: 0.4 },
    complaint: ['A lump has grown on my throat {when}.', 'My neck is swelling in front, {when}. My mother had the same.'],
    teach: { treat: ['iodine'], helps: [], harms: [], refer: 'Trembling, nervous, eyes bulging (a different goitre), or it presses on the breathing: refer.' },
    learn: 'A swelling on the front of the throat from lack of iodine, common in the hills. Iodized salt prevents it and shrinks many; iodized oil if there is no iodized salt. Old hard goitres only shrink with surgery. Lack of iodine in pregnancy can harm the baby.',
    ref: 'WTND p.130', icon: 'salt-shaker', color: '#d0b080',
  },
  {
    id: 'ulcer', name: 'Stomach ulcer (acid indigestion)', local: ['burning stomach', 'heartburn'], model: 'chronic',
    epi: { w: 1.5, age: [[0, 15, 0.05], [15, 99, 1]] },
    // Weeks, not years: real time. ~30–40% heal by themselves in a month (self), omeprazole ~80–90% (G&G ch.49); NSAIDs
    // and steroids make them worse and bleed (gi_harm). hazard: bleeding to death, ~0.1–0.4% a year in active ulcers
    // (estimate), several times that on aspirin.
    params: { since: [24, 120], level: [0.4, 1], self: [0.35, 0.95], by: ['acid'], worse: 'gi_harm', tau: 8, full: 1, heal: 0.15, hazard: 2e-6 },
    complaint: ['A burning pain in the pit of my stomach {when}, worse at night and when I am hungry.', 'My stomach burns after I eat {when}. Food and water calm it.'],
    teach: { treat: ['omeprazole', 'antacid'], helps: ['amoxicillin', 'metronidazole'], harms: ['aspirin', 'ibuprofen', 'prednisolone'], refer: 'Vomiting blood or coffee grounds, black tarry stools, or a hard very painful belly: refer at once.' },
    learn: 'A burning pain in the pit of the stomach or chest, often eased by food or water, worse when hungry, at night, after alcohol, coffee, spicy or fatty food. Small frequent meals, much water, no tobacco. Antacids (aluminium and magnesium hydroxide) calm it; omeprazole heals the sore, with two antibiotics against the germ that causes most ulcers. Aspirin and ibuprofen make ulcers worse: use paracetamol.',
    ref: 'WTND pp.128–129, 380–381', icon: 'fire-bowl', color: '#c06040',
  },
  {
    id: 'snakebite', name: 'Snakebite', local: ['the snake'], model: 'venom',
    epi: { w: 0.6, age: [[0, 5, 0.5], [5, 15, 1], [15, 60, 1.3], [60, 99, 0.7]], season: { cool_dry: 0.6, hot_dry: 0.8, rains: 1.6, late_rains: 1.3 } },
    // ~30% of bites carry no venom. Untreated envenoming kills ~10–20% in Africa; antivenom given early cuts that several
    // fold (WHO snakebite guidelines for Africa 2010): hazard calibrated. Splinting slows the venom (WTND p.105; estimate).
    params: { since: [1, 8], dry: 0.3, dose: [0.4, 2], absorb: 0.15, half: 30, v1: 1, ratio50: 0.08, bind: 'snake_antivenom', slow: 'splint', neuro: 0.25, hazard: 0.015, calibrated: true },
    complaint: ['{who} was bitten by a snake in the field {ago}.', 'A snake bit {poss} foot on the path {ago}. It is swelling.'],
    teach: { treat: ['snake_antivenom', 'splint'], helps: ['adrenaline', 'paracetamol'], harms: ['aspirin'], refer: 'Any bleeding, drooping eyelids, trouble breathing or swallowing, or swelling spreading up the limb: antivenom at the health centre — carry them, do not let them walk.' },
    learn: 'Fang marks mean a poisonous snake. Keep still, do not walk; take off rings; wrap the limb and splint it; carry to help. Do not cut, suck, tie tight, or put ice. Antivenom, as early as possible — but it is horse serum: have adrenaline ready for allergic shock. Bleeding gums, blood in the urine, drooping eyelids or weak breathing are danger signs.',
    ref: 'WTND pp.104–105, 387', icon: 'curling-vines', color: '#608040',
  },
  {
    id: 'scorpion_sting', name: 'Scorpion sting', local: ['the scorpion'], model: 'venom',
    epi: { w: 0.5, age: [[0, 5, 1], [5, 99, 1]], season: { cool_dry: 0.8, hot_dry: 1.5, rains: 1, late_rains: 0.9 } },
    // Rarely dangerous to adults; to children under 5 sometimes deadly (WTND p.106). Venom per kg does it; hazard calibrated
    // to ~1–4% of stung small children dying untreated (estimate, Chippaux JP, Goyffon M. Acta Trop 2008;107:71).
    params: { since: [1, 3], dose: [0.05, 0.4], absorb: 1.5, half: 4, v1: 0.5, ratio50: 0.08, bind: 'scorpion_antivenom', hazard: 0.012, calibrated: true },
    complaint: ['A scorpion stung {who} {ago}. {pron} is crying with pain.', 'I was stung by a scorpion in the firewood {ago}. It burns.'],
    teach: { treat: ['paracetamol'], helps: ['scorpion_antivenom'], harms: [], refer: 'A small child stung on the body or head, sweating, drooling, jerking or breathing badly: refer fast.' },
    learn: 'Most stings only hurt: paracetamol and something cold on the sting. Small children can die of it, above all when stung on the body or head: antivenom within 2 hours if there is any, and help fast. If breathing stops, mouth-to-mouth.',
    ref: 'WTND pp.106, 387', icon: 'spider-web', color: '#a08040',
  },
  {
    id: 'kerosene', name: 'Kerosene swallowed', local: ['drank paraffin'], model: 'venom',
    epi: { w: 0.4, age: [[0, 1, 0.3], [1, 5, 3], [5, 99, 0.1]] },
    // The harm is kerosene breathed into the lungs (pneumonitis) over 1–3 days; ~1–3% of children brought in die
    // (Lucas GN. Ceylon Med J 1994;39:59): hazard calibrated. Nothing neutralises it; vomiting puts more in the lungs.
    params: { since: [1, 6], dose: [0.03, 0.3], absorb: 0.2, half: 36, v1: 1, hazard: 0.004, fever: [0.4, 1.4], calibrated: true },
    complaint: ['{who} drank kerosene from a bottle {ago}. Now {pron} coughs.', '{who} swallowed paraffin {ago} and is breathing fast.'],
    teach: { treat: [], helps: ['oral_fluid'], harms: [], refer: 'Breathing fast or hard, blue lips, or drowsy: refer.' },
    learn: 'Keep kerosene, petrol and poisons out of reach and never in soft-drink bottles. Do not make the child vomit after kerosene: it goes into the lungs. Give water or milk to drink if awake. Watch the breathing for 3 days; fast breathing and cough mean the lungs are hurt.',
    ref: 'WTND p.103', icon: 'water-bottle', color: '#c0a060',
  },
  {
    id: 'fracture', name: 'Broken arm or wrist', local: ['a broken bone'], model: 'pain',
    epi: { w: 0.8, age: [[0, 5, 0.5], [5, 15, 1.5], [15, 60, 1], [60, 99, 1.3]] },
    // Weeks, not years: real time. A cast for a month (WTND p.98); splinting eases the pain (instrCut, estimate).
    params: { since: [1, 30], pain: [0.6, 0.95], halfDays: 12, instr: 'splint', instrCut: 0.6, limb: 'broken' },
    complaint: ['{who} fell from a tree {ago} and the arm is bent and swollen.', 'I fell on my hand {ago}. The wrist is swollen and I cannot move it.'],
    teach: { treat: ['splint'], helps: ['paracetamol', 'ibuprofen', 'diazepam'], harms: [], refer: 'The bone through the skin, a broken thigh, hip, neck or back, or the hand cold and numb: refer.' },
    learn: 'Keep the bone still: splint it before moving the person, then a cast for about a month and no force for another. If the bones are far out of place and the break is recent it can be set, gently, best with someone experienced; diazepam or codeine first. Never rub a broken limb. Children mend fast, old people slowly.',
    ref: 'WTND pp.98–99, 14', icon: 'bandaged', color: '#c0c0b0',
  },
  {
    id: 'sprain', name: 'Sprain', local: ['a twisted ankle'], model: 'pain',
    epi: { w: 1.5, age: [[0, 5, 0.3], [5, 60, 1], [60, 99, 0.6]] },
    params: { since: [2, 48], pain: [0.4, 0.8], halfDays: 5, instr: 'splint', instrCut: 0.75, limb: 'sprain' },
    complaint: ['I twisted my ankle on the path {ago}. It is swollen.', '{who} turned {poss} foot playing {ago} and limps.'],
    teach: { treat: ['splint'], helps: ['paracetamol', 'ibuprofen', 'aspirin'], harms: [], refer: 'No better after 2 days, or the foot floppy and the toes will not move: refer.' },
    learn: 'Rest the joint, wrap it firmly, keep it raised; cold soaks the first day, then hot soaks. Aspirin or paracetamol. A bad sprain takes 3–4 weeks. Never rub or massage it.',
    ref: 'WTND p.102', icon: 'bandaged', color: '#b0a090',
  },
  {
    id: 'arthritis', name: 'Arthritis (painful joints)', local: ['the old joints'], model: 'pain',
    epi: { w: 1.5, age: [[0, 40, 0.05], [40, 60, 1], [60, 99, 2.5]] },
    // Chronic: does not mend. Hot compresses and rest ease it (instrCut, estimate).
    params: { since: [200, 2000], pain: [0.4, 0.8], halfDays: 3650, instr: 'hot_compress', instrCut: 0.85, arthritis: true },
    complaint: ['My knees pain and are stiff {when}, worse after work.', 'The joints of my hands and knees ache {when}.'],
    teach: { treat: ['aspirin'], helps: ['paracetamol', 'ibuprofen', 'hot_compress'], harms: ['prednisolone'], refer: 'One joint suddenly hot and swollen with fever: infected — needs an antibiotic and help.' },
    learn: 'Most joint pain of older people cannot be cured but can be eased: rest, hot cloths on the joints, gentle exercises to keep them moving. Aspirin at a higher dose than for other pain (adults 3 tablets 4 times a day, with food; less if the ears ring).',
    ref: 'WTND p.173', icon: 'weight-lifting-up', color: '#a08070',
  },
  // ——— childbirth and the newborn (WTND chapter 19, pp.247–282; tetanus pp.182–184; small babies p.405)
  // Complications of labour come from people.js `LABOUR` (a woman the clinic holds); some also walk in. `urgent`: when
  // one begins at home, the family brings her (clinic.js). `mustRefer`: only a hospital can end it (judged in hindsight).
  {
    id: 'obstructed_labour', name: 'Obstructed labour', local: ['the stuck labour'], model: 'labour',
    epi: { w: 2, onlyPregnant: true, weeks: [39, 43] },
    // Untreated, the baby often dies, the womb may tear after a day or so, and infection follows (Dolea C, AbouZahr C.
    // Global burden of obstructed labour in the year 2000. WHO 2003; Neilson JP et al. Br Med Bull 2003;67:191). Hourly
    // rates are estimates calibrated to ~40% of babies and a few % of mothers dying (test/birth.test.mjs).
    params: { since: [12, 30], foetal: 0.03, resolve: 0.03, hazard: 0.0015, loss: 1.5, after: { id: 'puerperal_sepsis', odds: 0.25 }, blocksBirth: true, urgent: true },
    complaint: ['I have been in labour {when} and the baby will not come.', 'The waters broke and the pains have gone on {when}, but the baby does not come down.'],
    teach: { treat: [], helps: ['oral_fluid'], harms: ['oxytocin', 'misoprostol', 'ergometrine'], refer: 'Refer at once: she needs an operation (caesarean).', mustRefer: true },
    learn: 'Labour that goes on long after strong pains or after the waters broke, the baby not moving down: the head may be too big for her hips (a young girl, a first birth), or the baby lies sideways. Help her drink, pass urine and change position, and feel how the baby lies. Never give injections to hurry the birth: they can tear the womb and kill mother and baby. Get her to a hospital.',
    ref: 'WTND pp.256, 266–268', icon: 'heart-beats', color: '#b05070',
  },
  {
    id: 'pph', name: 'Bleeding after birth (postpartum haemorrhage)', local: ['the flood after birth'], model: 'bleeding',
    epi: { w: 0 },
    // A womb that fails to clamp down bleeds ~250 ml/h at first (log-normal spread 0.6), slowing with a half-life of
    // ~1.5 h by itself: 2 in 3 of these women lose ≥500 ml, a quarter ≥1000 ml. Death rises steeply past ~40% of
    // the blood volume, sooner in anaemia. Estimates, calibrated so untreated ~2% of them die (haemorrhage is ~27% of
    // maternal deaths: Say L et al. Lancet Glob Health 2014;2:e323) and an oxytocic soon after cuts that several-fold.
    // ~70% is the womb (atony), which uterotonics help; the rest is tears or a retained placenta (estimate).
    params: { since: [0, 1], rate: [250, 0.6], half: 1.5, drug: 0.85, atony: 0.7, shock: 0.38, hazard: 0.1, urgent: true },
    complaint: ['I gave birth an hour ago and the blood will not stop.', 'Since the baby came the blood pours out, and I feel faint.'],
    teach: { treat: ['oxytocin', 'misoprostol', 'ergometrine'], helps: ['oral_fluid'], harms: [], refer: 'If the bleeding does not stop quickly, or she grows faint with a fast weak pulse, she may need blood: hospital.' },
    learn: 'A little bleeding after the placenta comes is normal, a cup at most. More than that, or a steady trickle, or a soft big womb, is dangerous: she can bleed to death within hours. Put the baby to the breast, rub the womb until it is hard, and inject 10 units of oxytocin (again in 15 minutes if needed), or give 600 micrograms of misoprostol by mouth; ergometrine only once the placenta is out. Let her drink; legs up if faint. Anaemic women die of less blood: iron in pregnancy, and 3 misoprostol tablets to take as soon as the baby is born, prevent much of it.',
    ref: 'WTND pp.264–266, 390–391', icon: 'water-drop', color: '#c02030',
  },
  {
    id: 'eclampsia', name: 'Eclampsia (fits of pregnancy)', local: ['the fits of pregnancy'], model: 'spasm',
    epi: { w: 0.3, onlyPregnant: true, late: true },
    // Fits recur until the birth (which they often bring on) and for about a day after; each risks her life
    // (aspiration, bleeding in the brain) and the baby's. Hourly rates are estimates calibrated so ~15% die untreated
    // (up to 14% even in hospitals of poor countries: Duley L. Semin Perinatol 2009;33:130) and magnesium sulfate leaves
    // about half the recurrent fits that diazepam does (Eclampsia Trial Collaborative Group. Lancet 1995;345:1455).
    params: { since: [1, 6], sev: [0.6, 1], rise: 0.01, half: 12, labour: 0.025, fits: 0.12, perFit: 0.025, foetal: 0.08, hosp: 0.2, urgent: true },
    complaint: ['I am near my time. My head pains, I see spots, and this morning I fell down shaking.', 'I had a fit: they say I went stiff, then shook all over, and would not wake for a while.'],
    teach: { treat: ['magnesium'], helps: ['diazepam'], harms: ['ergometrine'], refer: 'Refer at once: she must give birth in hospital. Give magnesium sulfate (or diazepam) before the journey.', mustRefer: true },
    learn: 'Fits in late pregnancy, in labour or just after the birth, usually after the signs of pre-eclampsia: swollen face and hands, headache, blurred vision, high blood pressure. Lay her on her side with nothing in her mouth. Magnesium sulfate into both buttocks stops and prevents fits better and more safely than diazepam; diazepam into the anus if there is nothing else. The cure is the birth: get her to a hospital.',
    ref: 'WTND pp.178, 249, 389–390', icon: 'heart-beats', color: '#8030a0',
  },
  {
    id: 'puerperal_sepsis', name: 'Childbirth fever (infection after giving birth)', local: ['the fever after birth'], model: 'bacterial',
    epi: { w: 25, postpartum: [2, 14] },
    // E. coli stands for the mix of gut germs, streptococci and anaerobes (one germ per infection here). Hazard calibrated
    // so ~10% die untreated (sepsis ~11% of maternal deaths: Say L et al. Lancet Glob Health 2014;2:e323) and the
    // book's antibiotics cut that several-fold.
    params: { org: 'e_coli', since: [12, 48], L0: [6, 7], r: 0.06, Lsym: 4, Lmax: 9, imm: 0.08, onset: 120, hazard: 0.02, fever: [1.2, 2.6], puerperal: true, urgent: true },
    complaint: ['Since the birth I have fever and chills, and the discharge smells bad.', 'I gave birth {ago}. Now I burn with fever and my belly pains low down.'],
    teach: { treat: ['ampicillin', 'gentamicin', 'metronidazole'], helps: ['paracetamol', 'oral_fluid'], harms: [], refer: 'If she is not better the next day, or is very weak, confused or faint: hospital.' },
    learn: 'Fever or chills in the days after a birth or miscarriage, headache or low back pain, pain low in the belly, and a foul-smelling or bloody discharge: an infection of the womb, often from unclean hands or a hand put inside her. Ampicillin and gentamicin injections and metronidazole by mouth, until two days after the fever is gone. It kills: if she is no better the next day, get help.',
    ref: 'WTND pp.276, 352, 358, 368', icon: 'thermometer-hot', color: '#c06040',
  },
  {
    id: 'miscarriage', name: 'Miscarriage with heavy bleeding', local: ['losing the pregnancy'], model: 'bleeding',
    epi: { w: 1.5, onlyPregnant: true, early: true },
    // An incomplete miscarriage bleeds until the womb is empty. Rates are estimates: most lose under a litre and live;
    // a few bleed to danger. Misoprostol or oxytocin clamp the womb and help it empty.
    params: { since: [1, 8], rate: [60, 0.5], half: 6, drug: 0.8, shock: 0.33, hazard: 0.15, lose: true, urgent: true },
    complaint: ['I missed my monthly bleeding twice, and now I bleed heavily with clots and cramps, {when}.'],
    teach: { treat: ['misoprostol', 'oxytocin', 'ergometrine'], helps: ['ibuprofen', 'paracetamol'], harms: [], refer: 'Heavy bleeding for days, or fever and a bad smell: hospital, to clean out the womb.' },
    learn: 'Heavy bleeding with clots and cramps after missing one or more periods: a miscarriage, most often in the first 3 months. Rest, ibuprofen for the pain. If the bleeding is heavy or goes on, a medicine to clamp the womb, and medical help to empty it. Fever or a bad-smelling discharge afterwards means infection: treat as childbirth fever.',
    ref: 'WTND pp.266, 281', icon: 'water-drop', color: '#a03040',
  },
  {
    id: 'ectopic', name: 'Pregnancy outside the womb (ectopic)', local: ['the pregnancy in the tube'], model: 'bleeding',
    epi: { w: 0.4, onlyPregnant: true, early: true },
    // 1–2% of pregnancies. The tube bursts (rupture per hour) unless it settles (resolve); then the bleeding inside is
    // fast and slow to stop (no womb to clamp it), and without an operation many die. Rates are estimates.
    params: { since: [24, 96], rupture: 0.01, resolve: 0.002, rate: [300, 0.5], half: 4, drug: 0, shock: 0.33, hazard: 0.15, endsPregnancy: true, urgent: true },
    complaint: ['My monthly bleeding is late, and I have a sharp pain low on one side, with a little dark bleeding.'],
    teach: { treat: [], helps: [], harms: ['misoprostol'], refer: 'Refer soon, before it bursts: she needs an operation. Sudden terrible pain, fainting, a fast weak pulse: it has burst — at once.', mustRefer: true },
    learn: 'Signs of early pregnancy with odd bleeding, cramps low in the belly and a painful lump to one side of the womb: the baby has begun to grow in the tube. It cannot live, and when the tube bursts she can bleed to death inside without much blood showing. Only an operation helps.',
    ref: 'WTND pp.249, 280', icon: 'water-drop', color: '#902040',
  },
  {
    id: 'newborn_sepsis', name: 'Blood infection of the newborn (septicaemia)', local: ['the sleepy baby'], model: 'bacterial',
    epi: { w: 6, age: [[0, 0.077, 20]] },
    // Newborns barely fight infection. Hazard calibrated so ~40% die untreated and ampicillin with gentamicin cut that
    // several-fold (home treatment brought case fatality from 16.6% to 2.8%: Bang AT et al. Lancet 1999;354:1955).
    params: { org: 'e_coli', since: [12, 48], L0: [6, 7], r: 0.07, Lsym: 4, Lmax: 9, imm: 0.14, onset: 80, hazard: 0.025, fever: [0, 1.5], newborn: true, urgent: true },
    complaint: ['The baby will not suck since yesterday, and sleeps all the time.', 'The baby has stopped feeding {when}; floppy and hot.'],
    teach: { treat: ['ampicillin', 'gentamicin'], helps: ['oral_fluid'], harms: ['chloramphenicol', 'cotrimoxazole'], refer: 'Try to get medical help; start the injections first.' },
    learn: 'In a baby under a month: will not suck, very sleepy or floppy, too hot or too cold (below 35 °C), vomiting, a swollen belly, yellow skin, fits, turning blue. Any of these, and above all several together, may be an infection in the blood. Ampicillin and gentamicin injections by weight; keep giving breast milk, by spoon if need be. Chloramphenicol and cotrimoxazole are dangerous at this age.',
    ref: 'WTND pp.272–275', icon: 'thermometer-hot', color: '#d08060',
  },
  {
    id: 'cord_infection', name: 'Infected cord (navel)', local: ['the rotten navel'], model: 'bacterial',
    epi: { w: 3, age: [[0, 0.04, 20]] },
    // Staphylococcus mostly; it spreads to the blood in some (ascend; perH an estimate).
    params: { org: 's_aureus', since: [24, 72], L0: [5, 6.5], r: 0.05, Lsym: 4, Lmax: 9, imm: 0.12, onset: 72, hazard: 0.0005, fever: [0, 1], cord: true, ascend: { to: 'newborn_sepsis', perH: 0.002, minS: 0.4 } },
    complaint: ['The baby\'s navel is red and smells bad.', 'Pus comes from my baby\'s cord, {when}.'],
    teach: { treat: ['ampicillin', 'gentamicin', 'dicloxacillin'], helps: [], harms: [], refer: 'If the baby stops sucking, is floppy, hot or cold: blood infection — get help.' },
    learn: 'Pus or a bad smell from the cord is a danger sign: watch for tetanus and for infection in the blood. Clean it with alcohol and leave it open to the air. If the skin around it is red and hot, ampicillin (or penicillin with gentamicin). Prevent it: clean hands, a new blade, a short cord kept dry, nothing (never dung) put on it.',
    ref: 'WTND pp.263, 272', icon: 'bandage-roll', color: '#c09060',
  },
  {
    id: 'newborn_tetanus', name: 'Tetanus of the newborn', local: ['the seven-day sickness'], model: 'spasm',
    epi: { w: 1, age: [[0.008, 0.06, 20]] },
    // Spasms worsen for ~5 days, then ease over ~3 weeks. Untreated nearly all die; with care 10–60% (Roper MH et al.
    // Lancet 2007;370:1947); "half die even in the best hospitals" (WTND p.184). Rates calibrated to that.
    params: { since: [12, 48], sev: [0.6, 1], course: [5, 21], fits: 1.5, perFit: 0.005, foetal: 0, hosp: 0.4 },
    complaint: ['My baby cries all the time and cannot suck, {when}. Now he goes stiff.', 'The baby\'s jaw is locked and he stiffens when we touch him.'],
    teach: { treat: ['diazepam'], helps: ['benzylpenicillin'], harms: [], refer: 'Refer at once.', mustRefer: true },
    learn: 'Begins 3 to 10 days after birth: the baby cries all the time and cannot suck, then the jaw locks and the body stiffens in spasms when touched or at a noise. It comes from a cord cut with a dirty blade, left long, or covered with dung. Diazepam for the spasms, penicillin, breast milk by tube, quiet and dark, and a hospital. Prevent it: two tetanus injections in pregnancy, a new blade, a short dry cord.',
    ref: 'WTND pp.182–184, 263, 389–390', icon: 'spider-web', color: '#806060',
  },
  {
    id: 'newborn_jaundice', name: 'Yellow newborn (jaundice)', local: ['the yellow baby'], model: 'viral',
    epi: { w: 4, age: [[0.003, 0.03, 20]] },
    // Peaks at 3–5 days and fades by two weeks; in a few the bilirubin climbs high enough to harm the brain
    // (kernicterus). Filtered sunlight lowers it about as well as phototherapy (Slusher TM et al. N Engl J Med
    // 2015;373:1115). Hazard an estimate (~1% untreated die).
    params: { since: [24, 72], days: [10, 3], peak: 4, hazard: 0.00002, jaundice: true, cut: [{ instr: 'sunlight', by: 0.5 }] },
    complaint: ['My baby has turned yellow, {when}.', 'The whites of the baby\'s eyes are yellow.'],
    teach: { treat: [], helps: [], harms: ['cotrimoxazole'], refer: 'Yellow on the first day, after the fifth, or the baby will not feed or is floppy: get medical help.' },
    learn: 'Some yellow colour between the 2nd and 5th day is common and usually not serious. Give plenty of breast milk (by spoon if needed), undress the baby and lay him in bright light by a window, not in direct sun. Yellow on the first day of life or after the fifth day is serious.',
    ref: 'WTND p.274', icon: 'sun-cloud', color: '#e0c040',
  },
  {
    id: 'cold_baby', name: 'Cold, small baby (low temperature)', local: ['the cold baby'], model: 'viral',
    epi: { w: 3, age: [[0, 0.06, 20]], season: { cool_dry: 1.6, hot_dry: 0.7, rains: 1, late_rains: 1.1 } },
    // A small or early baby loses heat; below 35 °C it stops feeding and may die. Skin-to-skin ("kangaroo") care at
    // home cut deaths in small babies by ~30% (Mazumder S et al. Lancet 2019;393:1876). Hazard an estimate.
    params: { since: [6, 36], days: [14, 4], peak: 1, hazard: 0.00008, cold: 3, cut: [{ instr: 'kangaroo', by: 0.6 }] },
    complaint: ['My baby was born small and is cold, and sucks weakly.', 'The baby feels cold and will hardly feed, {when}.'],
    teach: { treat: [], helps: [], harms: [], refer: 'Very small (under 2 kg), will not feed at all, or cold and floppy despite warming: hospital.' },
    learn: 'A baby born small or early cannot keep himself warm. Below 35 °C is dangerous, and low temperature can also mean infection. Keep him naked against his mother\'s skin, between her breasts, inside her clothes, day and night, with his head covered; breastfeed at least every 2 hours. This "kangarooing" keeps him warm and saves many small babies.',
    ref: 'WTND pp.270, 273, 405', icon: 'sun-cloud', color: '#80a0c0',
  },
  {
    id: 'mastitis', name: 'Breast infection (mastitis)', local: ['the hot breast'], model: 'bacterial',
    epi: { w: 6, postpartum: [7, 180] },
    // Mostly Staphylococcus aureus; WTND gives dicloxacillin. Rarely dangerous.
    params: { org: 's_aureus', since: [24, 72], L0: [5.5, 6.5], r: 0.05, Lsym: 4, Lmax: 9, imm: 0.06, onset: 72, hazard: 0, fever: [0.8, 2], breast: true },
    complaint: ['My breast is hot, red and so painful I cannot feed the baby, {when}.'],
    teach: { treat: ['dicloxacillin', 'erythromycin', 'cotrimoxazole'], helps: ['paracetamol'], harms: [], refer: 'A soft swelling full of pus (an abscess) may need opening.' },
    learn: 'Part of the breast hot, red, swollen and very painful, with fever, and a sore lump in the armpit: usually after cracked nipples or a breast left too full. Keep feeding from that breast (or milk it by hand), hot cloths before feeds, rest and drink; dicloxacillin for 7 days, acetaminophen for the pain.',
    ref: 'WTND pp.277–278', icon: 'heart-beats', color: '#e08080',
  },
];

export const COND = new Map(CONDITIONS.map((c) => [c.id, c]));
