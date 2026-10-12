// actives.js — the compounds that do the work. Herbs carry them; preparations extract them; the
// pharmacology model (pk.js) turns a dose into a concentration curve and the curve into effects.
//
// Channels:
//   systemic — one-compartment PK (F, ka, t½, Vd per kg); effects by Emax on plasma concentration.
//   gut      — acts in the bowel lumen (worms, cramps, stool output). A dose of m mg gives exposure
//              E = 1 − exp(−m·perMg); for `duration` hours it changes its target by per·E (symptoms:
//              fraction relieved; worms: fraction killed per dose). Negative per = makes it worse.
//   topical  — strength is relative (1 = typical batch); acts per application.
//   fluid    — rehydration: water, sodium and glucose replace losses.
//
// Concentrations are mg/L. Every number has a ref; where the literature gives a range the middle is
// used and `spread` says how much it varies between people. Numbers marked `calibrated` are fitted to
// a clinical effect size rather than measured directly; the note says which trial.

import { FLORA_ACTIVES } from './flora_actives.js';

export const ACTIVES = [
  {
    id: 'salicin', name: 'Salicin (willow salicylates)', channel: 'systemic', class: 'analgesic', allergen: 'aspirin',
    // Salicin is a prodrug: gut flora and the liver turn it into salicylic acid. 240 mg salicin gave a
    // salicylate AUC like ~87 mg aspirin (Schmid 2001), so effective F as salicylate is low.
    pk: { F: 0.2, ka: 0.6, half: 2.5, vd: 0.15, spread: 0.3 },
    effects: [
      // calibrated: Chrubasik 2000 (240 mg salicin/day, low back pain): 39% pain-free vs 6% placebo.
      { on: 'pain', emax: 0.5, ec50: 1.2, hill: 1.5, calibrated: true },
      { on: 'fever', emax: 0.3, ec50: 2.0, hill: 1.2, calibrated: true },
    ],
    toxic: [{ at: 25, sign: 'tinnitus', text: 'ringing in the ears (salicylate excess)', harm: 0.02 }],
    cautions: ['Children with flu or chickenpox: salicylates are linked to Reye syndrome.', 'Allergy to aspirin.'],
    ref: 'ESCOP monograph Salicis cortex; Schmid B et al. Phytother Res 2001;15:344; Chrubasik S et al. Am J Med 2000;109:9',
  },
  {
    id: 'quinine', name: 'Quinine (cinchona alkaloids)', channel: 'systemic', class: 'antimalarial',
    // F 76–88%; t½ ~11 h in health, ~16 h in acute malaria; Vd ~1.8 L/kg in health, lower in malaria.
    pk: { F: 0.8, ka: 1.0, half: 14, vd: 1.5, spread: 0.25 },
    effects: [
      // Parasite reduction ratio (net, per 48 h cycle) ~10^3 at therapeutic levels (White 1997).
      { on: 'plasmodium', prr: 3.2, ec50: 3.0, hill: 2 },
    ],
    toxic: [
      { at: 7, sign: 'cinchonism', text: 'ringing ears, dizziness, nausea (cinchonism)', harm: 0 },
      { at: 22, sign: 'quinine_toxic', text: 'blurred vision, irregular heartbeat (quinine poisoning)', harm: 0.2 }, // total plasma; acute-phase protein binding protects in malaria
    ],
    lowSugar: true, // stimulates insulin release: hypoglycaemia, worse in pregnancy and children
    cautions: ['Can drop blood sugar — feed the patient.', 'Narrow margin: too little fails, too much blinds.'],
    ref: 'WTND p.365; White NJ. Antimicrob Agents Chemother 1997;41:1413; WHO Guidelines for malaria 2023 (quinine)',
  },
  {
    id: 'artemisinin', name: 'Artemisinin', channel: 'systemic', class: 'antimalarial',
    // t½ ~2–3 h; clearance rises ~5× over 5 days of dosing (auto-induction). Tea from 9 g herb gave
    // plasma peaks ~0.24 mg/L (Räth 2004).
    pk: { F: 0.3, ka: 1.5, half: 2.5, vd: 8, spread: 0.5, induce: { max: 5, days: 5 } },
    effects: [
      // calibrated: Artemisia tea for 7 days cured ~1 in 3 (Mueller 2004); prr 4 reproduces that here. The pure
      // artemisinins below needed a far higher kill rate to match their trials: in this one-compartment model a
      // drug only kills while it is in the blood, and each entry is fitted to its own evidence.
      { on: 'plasmodium', prr: 4, ec50: 0.01, hill: 1.5, calibrated: true },
    ],
    resistanceRisk: 'monotherapy',
    cautions: ['Alone, and especially as tea, the parasites come back (recrudescence). WHO advises against Artemisia tea.'],
    // foetal: none. Artemisinins kill embryos in animals, but in first-trimester human pregnancies they brought no
    // more miscarriage, stillbirth or malformation than quinine (Dellicour S et al. PLoS Med 2017;14:e1002290).
    ref: 'Räth K et al. Am J Trop Med Hyg 2004;70:128; Mueller MS et al. Trans R Soc Trop Med Hyg 2004;98:318; WHO position statement on non-pharmaceutical Artemisia, 2019',
  },
  {
    id: 'digitoxin', name: 'Digitoxin (foxglove glycosides)', channel: 'systemic', class: 'cardiac',
    // F ~95%; t½ ~6–7 days; Vd ~0.6 L/kg. Therapeutic 0.010–0.025 mg/L; toxic above ~0.035.
    pk: { F: 0.95, ka: 0.8, half: 160, vd: 0.6, spread: 0.3 },
    effects: [{ on: 'heart', emax: 0.6, ec50: 0.012, hill: 2 }],
    toxic: [
      { at: 0.03, sign: 'digitalis_gi', text: 'nausea, vomiting, yellow-green vision (digitalis excess)', harm: 0.03 },
      { at: 0.045, sign: 'digitalis_arrhythmia', text: 'slow, irregular pulse (digitalis poisoning)', harm: 0.4 },
    ],
    lowPotassiumWorse: true,
    cautions: ['A week-long half-life: a mistake takes days to wear off.', 'Withering (1785) titrated to nausea — the margin is that thin.'],
    ref: 'Withering W. An Account of the Foxglove, 1785; Goodman & Gilman 13e ch.29; WTND p.325 (heart trouble)',
  },
  {
    id: 'tropane', name: 'Tropane alkaloids (hyoscyamine, scopolamine)', channel: 'systemic', class: 'antispasmodic',
    // As atropine: F ~0.8 oral, t½ ~3 h, Vd ~2 L/kg. 0.5 mg atropine → ~0.004 mg/L.
    pk: { F: 0.8, ka: 1.2, half: 3, vd: 2, spread: 0.4 },
    effects: [{ on: 'cramp', emax: 0.7, ec50: 0.002, hill: 1.5 }],
    toxic: [
      { at: 0.006, sign: 'anticholinergic', text: 'dry mouth, fast pulse, big pupils, flushed skin', harm: 0 },
      { at: 0.02, sign: 'anticholinergic_severe', text: 'delirium, fever, cannot pass urine ("mad as a hatter, hot as a hare")', harm: 0.3 },
    ],
    cautions: ['WTND: adults only, 10–15 drops — "very poisonous if you take more than the recommended dose".'],
    ref: 'WTND p.12 (Angel\'s trumpet); Goodman & Gilman 13e ch.9',
  },
  {
    id: 'gingerol', name: 'Gingerols and shogaols', channel: 'gut', class: 'antiemetic',
    // ~1 g ginger root a day reduces nausea of pregnancy (Cochrane 2015: some evidence, low quality).
    gut: { duration: 6, effects: [{ on: 'nausea', per: 0.35, perMg: 1 / 20 }] },
    ref: 'Matthews A et al. Cochrane Database Syst Rev 2015;CD007575; WTND p.248',
  },
  {
    id: 'papain_bitc', name: 'Benzyl isothiocyanate (papaya seed)', channel: 'gut', class: 'anthelmintic',
    // Dried seeds with honey cleared stool of parasites in 71–76% of Nigerian children vs 0–17% placebo.
    gut: { duration: 8, effects: [{ on: 'worms_ascaris', per: 0.22, perMg: 1 / 30, calibrated: true }] },
    ref: 'WTND p.13; Okeniyi JA et al. J Med Food 2007;10:194',
  },
  {
    id: 'allicin', name: 'Allicin (garlic)', channel: 'gut', class: 'anthelmintic',
    gut: { duration: 6, effects: [{ on: 'worms_pinworm', per: 0.04, perMg: 1 / 45, calibrated: true }] },
    note: 'Evidence is thin: traditional use and in-vitro activity. Hygiene does most of the work.',
    ref: 'WTND p.12 (garlic for pinworm), p.141 (pinworm)',
  },
  {
    id: 'guava_flavonoid', name: 'Quercetin glycosides (guava leaf)', channel: 'gut', class: 'antidiarrhoeal',
    // Phytodrug of guava leaf shortened abdominal pain and reduced stool frequency (Lozoya 2002).
    gut: { duration: 8, effects: [{ on: 'stool', per: 0.25, perMg: 1 / 60, calibrated: true }, { on: 'cramp', per: 0.25, perMg: 1 / 60 }] },
    note: 'Fewer stools is comfort, not cure: the fluid lost still has to be replaced.',
    ref: 'Lozoya X et al. Arch Med Res 2002;33:55; Gutiérrez RMP et al. J Ethnopharmacol 2008;117:1',
  },
  {
    id: 'aloe_gel', name: 'Aloe gel (polysaccharides)', channel: 'topical', class: 'burn healing',
    // Burns healed ~9 days sooner with aloe (meta-analysis of 4 small trials, low quality).
    topical: { on: 'burn', heal: 0.35, infect: 0.15, perApply: 1 },
    ref: 'WTND p.13; Maenthaisong R et al. Burns 2007;33:713',
  },
  {
    id: 'aloin', name: 'Aloin (aloe latex)', channel: 'gut', class: 'laxative',
    gut: { duration: 10, effects: [{ on: 'stool', per: -0.8, perMg: 1 / 20 }, { on: 'cramp', per: -0.4, perMg: 1 / 20 }] },
    note: 'The yellow latex under the skin of the leaf is a strong purgative — peel it off before using the gel by mouth.',
    ref: 'European Medicines Agency, Aloe assessment report 2016',
  },
  {
    id: 'honey', name: 'Honey', channel: 'topical', class: 'wound dressing · cough',
    topical: { on: 'wound', heal: 0.25, infect: 0.5, perApply: 1 },
    // Honey eases night cough in children better than no treatment (Cochrane 2018: moderate evidence).
    gut: { duration: 8, effects: [{ on: 'cough', per: 0.3, perMg: 1 / 7000 }] },
    cautions: ['Never give honey by mouth to a baby under 1 year (botulism).'],
    ref: 'Oduwole O et al. Cochrane 2018;CD007094; Jull AB et al. Cochrane 2015;CD005083',
  },
  {
    id: 'sulfur', name: 'Precipitated sulfur', channel: 'topical', class: 'scabicide',
    // 1 part sulfur to 10 parts lard, 3 times a day for 3 days (WTND). Cure rates in trials ~70–90%.
    topical: { on: 'scabies', kill: 0.55, perApply: 1, irritate: 0.05 },
    cautions: ['Not for babies under 1 year (WTND).', 'Stop if the rash gets worse.'],
    ref: 'WTND p.199; Strong M, Johnstone P. Cochrane 2007;CD000320',
  },
  {
    id: 'azadirachtin', name: 'Neem limonoids', channel: 'topical', class: 'scabicide (weak)',
    // An uncontrolled field study of neem + turmeric paste reported 97% cure; there is no good trial.
    topical: { on: 'scabies', kill: 0.18, perApply: 1, irritate: 0.02 },
    cautions: ['Neem OIL by mouth has poisoned infants (Reye-like illness). Paste on skin only.'],
    ref: 'Charles V, Charles SX. Trop Geogr Med 1992;44:178; Sinniah D, Baskaran G. Lancet 1981;1:487',
  },
  {
    id: 'cornsilk_k', name: 'Corn silk (flavonoids, potassium)', channel: 'gut', class: 'mild diuretic',
    gut: { duration: 8, effects: [{ on: 'fluid_out', per: 0.15, perMg: 1 / 2000 }] },
    note: 'Mild. Swelling in pregnancy with headache or blurred vision is pre-eclampsia: refer, do not treat with tea.',
    ref: 'WTND p.12, p.176, p.248',
  },
  {
    id: 'eucalyptol', name: 'Eucalyptol (1,8-cineole) steam', channel: 'topical', class: 'decongestant',
    topical: { on: 'congestion', relief: 0.3, perApply: 1 },
    ref: 'WTND p.164 (steam for stuffy nose); Worth H et al. Respir Res 2009;10:69',
  },
  {
    id: 'oral_fluid', name: 'Rehydration drink', channel: 'fluid', class: 'rehydration',
    // Sugar–salt home mix: 1 L water, ½ level tsp salt, 8 level tsp sugar (WTND p.152).
    fluid: { sodium: 'per batch', target: [45, 90] }, // mmol/L sodium a safe home mix lands in
    ref: 'WTND pp.151–152; WHO/UNICEF reduced-osmolarity ORS 2002',
  },

  // ——— antibiotics (Green Pages). `abx`: kill of an organism by FREE drug (C·fu) relative to that strain's
  // MIC (organisms.js): log10 kill/h = kmax · hill(C·fu/MIC, ec50, hill). Beta-lactams are time-dependent
  // (steep, ec50 ≈ MIC); ciprofloxacin is concentration-dependent (shallow); the bacteriostatic drugs stop
  // growth and leave the killing to the body (low kmax). kmax values are calibrated to the cure rates of
  // the trials cited in test/sim.test.mjs. In-host resistance arises while free drug sits between the MIC
  // and the mutant-prevention level (`window`, × MIC) with a large population (disease.js).
  {
    id: 'amoxicillin', name: 'Amoxicillin', channel: 'systemic', class: 'antibiotic (penicillin)', allergen: 'penicillin',
    pk: { F: 0.8, ka: 1.5, half: 1.2, vd: 0.3, fu: 0.82, spread: 0.25 },
    abx: { kmax: 0.35, ec50: 1, hill: 3, window: 4, calibrated: true },
    cautions: ['Penicillin allergy: rash, and rarely swelling of the throat. Ask before giving.'],
    ref: 'WTND p.352; Goodman & Gilman 13e ch.57; Craig WA. Clin Infect Dis 1998;26:1 (time above MIC)',
  },
  {
    id: 'penicillin_v', name: 'Penicillin V', channel: 'systemic', class: 'antibiotic (penicillin)', allergen: 'penicillin',
    pk: { F: 0.6, ka: 2, half: 0.6, vd: 0.35, fu: 0.2, spread: 0.3 },
    abx: { kmax: 0.35, ec50: 1, hill: 3, window: 4, calibrated: true },
    cautions: ['Penicillin allergy.', 'Short half-life: it has to be taken 4 times a day.'],
    ref: 'WTND p.351; Goodman & Gilman 13e ch.57',
  },
  {
    id: 'dicloxacillin', name: 'Dicloxacillin', channel: 'systemic', class: 'antibiotic (anti-staph penicillin)', allergen: 'penicillin',
    pk: { F: 0.6, ka: 1.5, half: 0.8, vd: 0.15, fu: 0.04, spread: 0.3 },
    abx: { kmax: 0.35, ec50: 1, hill: 3, window: 4, calibrated: true },
    cautions: ['Penicillin allergy.', 'Resists the penicillinase that makes most staph immune to plain penicillin.'],
    ref: 'WTND pp.351, 195; Goodman & Gilman 13e ch.57',
  },
  {
    id: 'cotrimoxazole', name: 'Cotrimoxazole (trimethoprim part)', channel: 'systemic', class: 'antibiotic (sulfa)',
    // Dosed by its trimethoprim content: a 480 mg tablet has 80 mg trimethoprim + 400 mg sulfamethoxazole.
    pk: { F: 0.95, ka: 1, half: 10, vd: 1.6, fu: 0.56, spread: 0.3 },
    abx: { kmax: 0.15, ec50: 1, hill: 2, window: 8, calibrated: true },
    // Stevens–Johnson / toxic epidermal necrolysis: a few per 100 000 courses, mostly in the first 3 weeks; ~10–30% die
    // (Roujeau JC et al. N Engl J Med 1995;333:1600; per-course odds an estimate). harm 0.03 ≈ 1 in 10 die over 2 weeks.
    idio: [{ per: 3e-5, days: [5, 21], hours: 336, sign: 'sjs', text: 'blisters and peeling skin, sores in the mouth and eyes (severe reaction to the sulfa)', harm: 0.03 }],
    cautions: ['Not for babies under 2 months or in the last month of pregnancy (jaundice).', 'Rarely a severe blistering rash: stop at once.'],
    // Sulfonamides push bilirubin off albumin: near term (in the foetus) or in a baby under 2 months, jaundice and
    // kernicterus. In premature newborns sulfisoxazole raised deaths and kernicterus (Silverman WA et al. Pediatrics
    // 1956;18:614); from the mother near term the risk is mostly theoretical, so it is small here. Rates are estimates.
    foetal: [{ weeks: [36, 41], at: 1, harm: 'jaundice', per: 9e-5, ref: 'Silverman WA et al. Pediatrics 1956;18:614; WTND p.357' }],
    newborn: [{ days: 60, at: 1, harm: 'kernicterus', per: 2e-4, ref: 'Silverman WA et al. Pediatrics 1956;18:614' }],
    ref: 'WTND p.357; Goodman & Gilman 13e ch.56; Roujeau JC et al. N Engl J Med 1995;333:1600',
  },
  {
    id: 'erythromycin', name: 'Erythromycin', channel: 'systemic', class: 'antibiotic (macrolide)',
    pk: { F: 0.35, ka: 1, half: 1.6, vd: 0.7, fu: 0.3, spread: 0.4 },
    abx: { kmax: 0.15, ec50: 1, hill: 2, window: 8, calibrated: true },
    cautions: ['Upsets the stomach; take with food.'],
    ref: 'WTND p.354; Goodman & Gilman 13e ch.59',
  },
  {
    id: 'doxycycline', name: 'Doxycycline', channel: 'systemic', class: 'antibiotic (tetracycline)',
    pk: { F: 0.93, ka: 0.8, half: 18, vd: 0.8, fu: 0.12, spread: 0.25 },
    abx: { kmax: 0.15, ec50: 1, hill: 2, window: 8, calibrated: true },
    // Tetracyclines bind calcium in teeth calcifying from mid-pregnancy and stain them. Doxycycline binds far less:
    // a systematic review found no staining or malformation linked to it (Cross R et al. Expert Opin Drug Saf
    // 2016;15:367), so it is weak here: a week's course after 16 weeks marks ~1 baby in 100 (estimate).
    foetal: [{ weeks: [16, 41], at: 1, harm: 'teeth', per: 2e-5, ref: 'Cross R et al. Expert Opin Drug Saf 2016;15:367; Goodman & Gilman 13e ch.59' }],
    // Short courses of doxycycline did not stain children's teeth (Todd SR et al. J Pediatr 2015;166:1246), unlike
    // the old tetracycline the book warns about; so no harm is modelled for a child here. Pregnancy: see people.js.
    cautions: ['Not in pregnancy after the 4th month: the baby\'s teeth and bones.', 'Do not take with milk or antacids.', 'The book warns against it under 8 years; that was learned from old tetracycline — short courses of doxycycline did not stain teeth in later studies.'],
    ref: 'WTND p.355; Goodman & Gilman 13e ch.59; Todd SR et al. J Pediatr 2015;166:1246',
  },
  {
    id: 'chloramphenicol', name: 'Chloramphenicol', channel: 'systemic', class: 'antibiotic',
    // Newborns cannot clear it (glucuronidation): the "grey baby". Dose-related marrow suppression above ~25 mg/L.
    pk: { F: 0.8, ka: 1, half: 4, vd: 0.9, fu: 0.5, spread: 0.35 },
    abx: { kmax: 0.15, ec50: 1, hill: 2, window: 8, calibrated: true },
    toxic: [
      { at: 25, sign: 'marrow', text: 'pale and tired, bruises easily (chloramphenicol on the marrow)', harm: 0.02 },
      { at: 50, sign: 'grey_baby', text: 'grey, floppy, cold, will not feed (chloramphenicol poisoning)', harm: 0.4 },
    ],
    cautions: ['WTND: only for dangerous infections like typhoid, when nothing safer works.', 'Never for newborns.'],
    // The newborn liver barely clears it: levels climb and the baby goes grey and collapses (Burns LE et al. N Engl
    // J Med 1959;261:1318; Mulhall A et al. BMJ 1983;287:1424). per is a calibrated estimate.
    newborn: [{ days: 30, at: 25, harm: 'grey', per: 0.005, ref: 'Burns LE et al. N Engl J Med 1959;261:1318; Mulhall A et al. Br Med J 1983;287:1424' }],
    ref: 'WTND p.356; Goodman & Gilman 13e ch.59',
  },
  {
    id: 'ciprofloxacin', name: 'Ciprofloxacin', channel: 'systemic', class: 'antibiotic (quinolone)',
    pk: { F: 0.7, ka: 1.2, half: 4, vd: 2.5, fu: 0.7, spread: 0.3 },
    abx: { kmax: 0.5, ec50: 2, hill: 1.2, window: 8, calibrated: true },
    cautions: ['Traditionally avoided in children and pregnancy (joint cartilage); WHO accepts it for dysentery in children.', 'Do not take with milk or antacids.'],
    ref: 'WTND p.358; WHO Pocket book of hospital care for children 2013 (dysentery); Goodman & Gilman 13e ch.56',
  },

  // ——— pain and fever (Green Pages pp.378–379, 383)
  {
    id: 'paracetamol', name: 'Paracetamol (acetaminophen)', channel: 'systemic', class: 'analgesic · antipyretic',
    // F ~0.88 for tablets, peak at 30–60 min, t½ 2–2.5 h, Vd ~0.8–1 L/kg: 1 g gives a peak of ~15 mg/L (Rawlins 1977).
    pk: { F: 0.88, ka: 4, half: 2.5, vd: 0.8, spread: 0.25 },
    effects: [
      { on: 'pain', emax: 0.5, ec50: 10, hill: 1.5 },
      { on: 'fever', emax: 0.8, ec50: 5, hill: 1.5 },
    ],
    // Above the Rumack–Matthew line (~150 mg/L at 4 h) the liver dies over the next days. No antidote here.
    // calibrated: in overdose t½ lengthens (saturated conjugation), which this linear curve cannot do, so
    // ~150 mg/kg reads ~70 mg/L at 4 h here; the threshold sits there. Untreated above the line ~5% died (Prescott 1983).
    toxic: [{ at: 75, sign: 'paracetamol_liver', text: 'vomiting, then yellow eyes and pain under the right ribs (liver poisoning)', harm: 3, calibrated: true }],
    cautions: ['Safe at the right dose; a few times the dose destroys the liver, and the signs come only after a day or two.'],
    ref: 'WTND p.379; Anderson BJ. Paediatr Anaesth 2008;18:915; Rawlins MD et al. Eur J Clin Pharmacol 1977;11:283; Rumack BH, Matthew H. Pediatrics 1975;55:871; Prescott LF. Drugs 1983;25:290',
  },
  {
    id: 'ibuprofen', name: 'Ibuprofen', channel: 'systemic', class: 'analgesic · anti-inflammatory',
    pk: { F: 0.9, ka: 1.5, half: 2, vd: 0.15, spread: 0.25 },
    effects: [
      { on: 'pain', emax: 0.6, ec50: 10, hill: 1.5 },
      { on: 'fever', emax: 0.7, ec50: 6, hill: 1.5 },
      // NSAIDs strip the stomach's protection: ulcers flare and bleed (RR ~4: Lanas A et al. Gut 2005;54:1693). Scale an estimate.
      { on: 'gi_harm', emax: 1, ec50: 15, hill: 1 },
    ],
    // In a dehydrated child the kidney leans on prostaglandins; blocking them can tip it into failure (Misurac JM et
    // al. J Pediatr 2013;162:1153). Threshold and harm are estimates.
    toxic: [{ at: 5, dry: 0.05, sign: 'kidney_injury', text: 'passing almost no urine, even after drinking (kidney injury)', harm: 0.05 }],
    cautions: ['Not for someone who is dehydrated (the kidneys), has a stomach ulcer, or is in the last months of pregnancy.'],
    // After ~30 weeks NSAIDs can close the foetal ductus arteriosus early (OR ~15: Koren G et al. Ann Pharmacother
    // 2006;40:824; FDA Drug Safety Communication 2020). per is an estimate: ~3 days of full doses marks ~1 in 10.
    foetal: [{ weeks: [30, 41], at: 10, harm: 'ductus', per: 1.3e-3, ref: 'Koren G et al. Ann Pharmacother 2006;40:824; FDA Drug Safety Communication 2020 (NSAIDs in pregnancy)' }],
    ref: 'WTND p.379; Goodman & Gilman 13e ch.34; Misurac JM et al. J Pediatr 2013;162:1153',
  },
  {
    id: 'aspirin', name: 'Aspirin (as salicylate)', channel: 'systemic', class: 'analgesic · antipyretic', allergen: 'aspirin',
    // Salicylate t½ lengthens with dose (2–3 h at analgesic doses, up to 20 h in poisoning); the low end is used.
    pk: { F: 0.75, ka: 2, half: 3, vd: 0.17, spread: 0.3 },
    effects: [
      { on: 'pain', emax: 0.5, ec50: 40, hill: 1.5 },
      { on: 'fever', emax: 0.6, ec50: 30, hill: 1.5 },
      { on: 'gi_harm', emax: 1, ec50: 40, hill: 1 }, // as ibuprofen (Lanas 2005); scale an estimate
    ],
    toxic: [
      { at: 200, sign: 'tinnitus', text: 'ringing in the ears (salicylate excess)', harm: 0.02 },
      { at: 400, sign: 'salicylism', text: 'deep fast breathing, vomiting, confusion (aspirin poisoning)', harm: 0.35 },
      { at: 50, dry: 0.05, sign: 'kidney_injury', text: 'passing almost no urine, even after drinking (kidney injury)', harm: 0.05 },
    ],
    // Reye syndrome: a child with a viral illness given aspirin; rare, ~30% die (Belay ED et al. N Engl J Med
    // 1999;340:1377; per-course odds an estimate). harm 0.5 ≈ 3 in 10 die over 3 days.
    idio: [{ per: 1e-4, ageMax: 16, withModel: 'viral', days: [3, 6], hours: 72, sign: 'reye', text: 'vomiting again and again, then confused and drowsy (Reye syndrome)', harm: 0.5 }],
    cautions: ['Not for children with flu or chickenpox (Reye syndrome).', 'Not with stomach ulcers or in late pregnancy.'],
    // Analgesic doses only: low-dose aspirin (75–150 mg) stays far below this level. After ~30 weeks NSAIDs can close the foetal ductus arteriosus early (OR ~15: Koren G et al. Ann Pharmacother
    // 2006;40:824; FDA Drug Safety Communication 2020). per is an estimate: ~3 days of full doses marks ~1 in 10.
    foetal: [{ weeks: [30, 41], at: 30, harm: 'ductus', per: 1.3e-3, ref: 'Koren G et al. Ann Pharmacother 2006;40:824; FDA Drug Safety Communication 2020 (NSAIDs in pregnancy)' }],
    ref: 'WTND p.378; Goodman & Gilman 13e ch.34; Belay ED et al. N Engl J Med 1999;340:1377',
  },
  {
    id: 'codeine', name: 'Codeine', channel: 'systemic', class: 'opioid · cough suppressant',
    // The liver (CYP2D6) turns ~10% into morphine; some people turn far more, very fast — the wide spread.
    pk: { F: 0.9, ka: 1.5, half: 3, vd: 3, spread: 0.5 },
    effects: [
      { on: 'pain', emax: 0.5, ec50: 0.1, hill: 1.5 },
      { on: 'cough', emax: 0.5, ec50: 0.08, hill: 1.5 },
    ],
    toxic: [
      { at: 0.35, sign: 'opioid_drowsy', text: 'very sleepy, small pupils, constipated', harm: 0 },
      { at: 0.7, sign: 'opioid_resp', text: 'slow shallow breathing, pinpoint pupils, cannot be woken (opioid poisoning)', harm: 0.5 },
    ],
    // Daily use for ~2 weeks brings dependence and tolerance (needs twice the dose for the same effect, and tolerates
    // twice the level before breathing slows); stopping then brings withdrawal (Goodman & Gilman 13e ch.20; WHO
    // Guidelines for the psychosocially assisted pharmacological treatment of opioid dependence 2009). Estimates.
    dependence: { ec: 0.05, days: 14, tolerance: 1, sign: 'opioid_withdrawal', text: 'aching all over, yawning, runny nose, loose stools, cannot sleep (opioid withdrawal)' },
    cautions: ['Children have died of ordinary doses (fast converters). Not for children under 12.', 'Habit-forming.'],
    ref: 'WTND p.383; FDA Drug Safety Communication 2017 (codeine in children); Goodman & Gilman 13e ch.18',
  },

  // ——— malaria (Green Pages pp.363–367). Parasite strains carry a resistance factor on each drug's EC50
  // (organisms.js, p_falciparum).
  {
    id: 'chloroquine', name: 'Chloroquine', channel: 'systemic', class: 'antimalarial',
    // Terminal t½ is 1–2 months from a huge tissue store; one compartment with t½ 3 days and Vd 30 L/kg
    // fits the plasma levels of the first week (Cmax ~0.25 mg/L after 600 mg base).
    pk: { F: 0.8, ka: 0.8, half: 72, vd: 30, spread: 0.3 },
    effects: [{ on: 'plasmodium', prr: 3, ec50: 0.03, hill: 2 }],
    toxic: [
      { at: 0.25, sign: 'chloroquine_itch', text: 'itching all over, worst on dark skin (chloroquine)', harm: 0 },
      // calibrated: one compartment misses the early distribution-phase spike of a big single dose, so the
      // threshold is set where 40 mg/kg at once kills ~25% of children and 25 mg/kg over 3 days none (≥20–30 mg/kg
      // at once is often fatal in children: Riou 1988, Smith & Klein-Schwartz 2005).
      { at: 0.8, sign: 'chloroquine_heart', text: 'collapse, fits, the heart failing (chloroquine poisoning)', harm: 1, calibrated: true },
    ],
    cautions: ['A few tablets too many kill a child. Keep it out of reach.', 'Most valleys\' parasites now resist it.'],
    ref: 'WTND p.366; White NJ. Clin Pharmacokinet 1985;10:187; Riou B et al. N Engl J Med 1988;318:1; Smith ER, Klein-Schwartz W. J Emerg Med 2005;28:437; WHO Guidelines for malaria 2023',
  },
  {
    id: 'artemether', name: 'Artemether', channel: 'systemic', class: 'antimalarial',
    pk: { F: 0.4, ka: 1.5, half: 1.6, vd: 7, spread: 0.45, induce: { max: 3, days: 3 } },
    // calibrated: prr here is a kill rate while drug is present (only a few hours a day), fitted with artesunate's
    // so 3 days of artemether–lumefantrine cure ≥95% (WHO 2023) — about 10^4 per cycle overall (White 1997).
    effects: [{ on: 'plasmodium', prr: 30, ec50: 0.01, hill: 1.5, calibrated: true }],
    cautions: ['Fast and strong, gone in hours: always with a partner drug (lumefantrine).'],
    // foetal: none. Artemisinins kill embryos in animals, but in first-trimester human pregnancies they brought no
    // more miscarriage, stillbirth or malformation than quinine (Dellicour S et al. PLoS Med 2017;14:e1002290).
    ref: 'WTND p.364; Ezzet F et al. Br J Clin Pharmacol 1998;46:553; White NJ. Antimicrob Agents Chemother 1997;41:1413; WHO Guidelines for malaria 2023',
  },
  {
    id: 'lumefantrine', name: 'Lumefantrine', channel: 'systemic', class: 'antimalarial',
    // Absorbed only with fat (take with food or milk). t½ 26 h here approximates the first week: Cmax ~7 mg/L
    // and day-7 ~0.5 mg/L after 6 × 480 mg; day-7 levels above ~0.28 mg/L go with cure.
    pk: { F: 0.5, ka: 0.25, half: 26, vd: 1.5, spread: 0.45 },
    effects: [{ on: 'plasmodium', prr: 3, ec50: 0.25, hill: 2 }],
    cautions: ['Take with food or milk, or most of it passes straight through.'],
    ref: 'WTND p.364; Ezzet F et al. Br J Clin Pharmacol 1998;46:553; Checchi F et al. Trop Med Int Health 2006;11:1095 (day-7 level)',
  },
  {
    id: 'artesunate', name: 'Artesunate (as dihydroartemisinin)', channel: 'systemic', class: 'antimalarial',
    pk: { F: 0.6, ka: 3, half: 0.75, vd: 1.2, spread: 0.4 },
    // ec50: DHA IC50 ~1–2 nM, ~93% protein bound → ~0.006 mg/L total. calibrated: prr is a kill rate while drug is
    // present (a few hours a day), fitted so 4 mg/kg monotherapy cures ~90% at 7 days and ~half at 3 (White 1997;
    // WHO Guidelines for malaria 2023).
    effects: [{ on: 'plasmodium', prr: 30, ec50: 0.006, hill: 1.5, calibrated: true }],
    cautions: ['Alone, a 3-day course lets the parasites come back; WHO pairs it with a partner drug.'],
    resistanceRisk: 'monotherapy',
    // foetal: none. Artemisinins kill embryos in animals, but in first-trimester human pregnancies they brought no
    // more miscarriage, stillbirth or malformation than quinine (Dellicour S et al. PLoS Med 2017;14:e1002290).
    ref: 'WTND p.364; Batty KT et al. Br J Clin Pharmacol 1998;45:123; White NJ. Antimicrob Agents Chemother 1997;41:1413; WHO Guidelines for malaria 2023',
  },

  // ——— worms and scabies (Green Pages pp.372–374)
  {
    id: 'mebendazole', name: 'Mebendazole', channel: 'gut', class: 'anthelmintic',
    // Cure rates for one standard course: roundworm ~95%, pinworm ~90% (then reinfection unless hygiene).
    gut: { duration: 12, effects: [{ on: 'worms_ascaris', per: 0.997, perMg: 1 / 50, calibrated: true }, { on: 'worms_pinworm', per: 0.997, perMg: 1 / 20, calibrated: true },
      // hookworm: one 500 mg dose cures ~15%, 100 mg twice daily for 3 days ~80% (Keiser 2008)
      { on: 'worms_hookworm', per: 0.98, perMg: 0.01, calibrated: true }] },
    cautions: ['Not in the first 3 months of pregnancy.'],
    ref: 'WTND p.373; Keiser J, Utzinger J. JAMA 2008;299:1937',
  },
  {
    id: 'albendazole', name: 'Albendazole', channel: 'gut', class: 'anthelmintic',
    gut: { duration: 12, effects: [{ on: 'worms_ascaris', per: 0.992, perMg: 1 / 40, calibrated: true }, { on: 'worms_pinworm', per: 0.997, perMg: 1 / 40, calibrated: true },
      // hookworm: one 400 mg dose cures ~72% (Keiser 2008)
      { on: 'worms_hookworm', per: 0.9955, perMg: 1 / 40, calibrated: true }] },
    cautions: ['Not in the first 3 months of pregnancy.'],
    ref: 'WTND p.374; Keiser J, Utzinger J. JAMA 2008;299:1937',
  },
  {
    id: 'permethrin', name: 'Permethrin 5%', channel: 'topical', class: 'scabicide',
    // One overnight application, repeated after a week, cures ~90% (Cochrane: the most effective topical).
    topical: { on: 'scabies', kill: 0.93, perApply: 1, irritate: 0.02 },
    ref: 'WTND p.372; Strong M, Johnstone P. Cochrane 2007;CD000320; Rosumeck S et al. Cochrane 2018;CD012994',
  },
  {
    id: 'benzyl_benzoate', name: 'Benzyl benzoate 25%', channel: 'topical', class: 'scabicide',
    topical: { on: 'scabies', kill: 0.8, perApply: 1, irritate: 0.25 },
    cautions: ['Burns on broken skin. Dilute for children; not for babies.'],
    ref: 'WTND p.372; Strong M, Johnstone P. Cochrane 2007;CD000320',
  },

  // ——— diarrhoea (Green Pages p.381)
  {
    id: 'zinc', name: 'Zinc', channel: 'gut', class: 'antidiarrhoeal (mucosal repair)',
    // 10–14 days of zinc shortens diarrhoea by about half a day and lessens stool output in children over 6 months.
    gut: { duration: 24, effects: [{ on: 'stool', per: 0.15, perMg: 1 / 10, calibrated: true }] },
    toxic: [{ atMgKg: 15, sign: 'zinc_gi', text: 'vomiting and belly cramps (too much zinc)', harm: 0 }], // estimate; Fosmire GJ. Am J Clin Nutr 1990;51:225
    note: 'A help, not a cure: the rehydration drink still does the life-saving.',
    ref: 'WTND p.381; Lazzerini M, Wanzira H. Cochrane 2016;CD005436',
  },

  // ——— phase 2c
  {
    id: 'metronidazole', name: 'Metronidazole', channel: 'systemic', class: 'anti-amoebic · anti-giardia · anaerobes',
    pk: { F: 1, ka: 1.5, half: 8, vd: 0.8, fu: 0.9, spread: 0.25 },
    abx: { kmax: 0.3, ec50: 1, hill: 1.5, window: 8, calibrated: true },
    // The book's alcohol warning: a controlled trial found no reaction (Visapää JP et al. Ann Pharmacother 2002;36:971;
    // Williams CS, Woodcock KR. Ann Pharmacother 2000;34:255), so none is modelled.
    cautions: ['Avoid in the first 3 months of pregnancy if it can wait.', 'The book says no alcohol with it; trials found no reaction.'],
    ref: 'WTND p.368; Goodman & Gilman 13e ch.50; Visapää JP et al. Ann Pharmacother 2002;36:971',
  },
  {
    id: 'iron', name: 'Iron (ferrous sulfate)', channel: 'gut', class: 'for anaemia',
    // Taken daily, iron lets the marrow rebuild blood: Hb rises ~1–2 g/dL in 3 weeks (disease.js).
    gut: { duration: 24, effects: [{ on: 'iron', per: 1, perMg: 1 / 30 }] },
    // Elemental iron swallowed in a day: >20 mg/kg vomiting; >60 mg/kg shock, bleeding, liver failure; >150 mg/kg often
    // fatal (Manoguerra AS et al. Clin Toxicol 2005;43:553). Harms calibrated roughly to those bands.
    toxic: [
      { atMgKg: 20, sign: 'iron_gi', text: 'vomiting and belly pain, grey-black stools (too much iron)', harm: 0 },
      { atMgKg: 60, sign: 'iron_severe', text: 'vomiting blood, drowsy, cold and grey (iron poisoning)', harm: 0.6 },
      { atMgKg: 150, sign: 'iron_lethal', text: 'cannot be woken, barely breathing (iron poisoning)', harm: 3 },
    ],
    cautions: ['Turns the stool black. Can upset the stomach.', 'An overdose of iron tablets kills small children: keep them out of reach.'],
    ref: 'WTND pp.124, 392; WHO Guideline: daily iron supplementation in children 2016',
  },
  {
    id: 'vitamin_a', name: 'Vitamin A (retinol)', channel: 'gut', class: 'vitamin',
    // 200 000 IU (60 mg retinol) restores the liver store for weeks; in measles it cuts deaths in young children.
    gut: { duration: 14 * 24, effects: [{ on: 'vita', per: 1, perMg: 1 / 10 }] },
    // Acute excess: >~25 000 IU/kg (7.5 mg/kg) raises the pressure in the head — headache, vomiting, a bulging soft spot
    // in babies — and passes (Penniston KL, Tanumihardjo SA. Am J Clin Nutr 2006;83:191).
    toxic: [{ atMgKg: 7.5, sign: 'vita_acute', text: 'headache and vomiting; in a baby, a bulging soft spot (too much vitamin A)', harm: 0.02 }],
    cautions: ['Too much in early pregnancy harms the baby: not the big capsules for pregnant women.'],
    // Retinol is a teratogen in early pregnancy: above ~10 000 IU/day (3 mg) of supplements before week 7, ~1 extra
    // malformed baby in 57 (Rothman KJ et al. N Engl J Med 1995;333:1369). Exposure here is mg/kg taken in the last
    // 14 days; 0.75 mg/kg is 3 mg a day for two weeks. per is calibrated to Rothman's 1 in 57.
    foetal: [{ weeks: [3, 8], at: 0.75, harm: 'malformation', per: 1.4e-5, calibrated: true, ref: 'Rothman KJ et al. N Engl J Med 1995;333:1369; WHO Guideline: vitamin A supplementation in pregnant women 2011' }],
    ref: 'WTND pp.226, 311, 391; Huiming Y et al. Cochrane 2005;CD001479',
  },

  // ——— injections (route 'inj': the item gives absorption, see medicines.js `inj`; by mouth these are destroyed or useless)
  {
    id: 'benzylpenicillin', name: 'Benzylpenicillin (penicillin G)', channel: 'systemic', class: 'antibiotic (penicillin, injected)', allergen: 'penicillin',
    abxAs: 'penicillin_v', // the same molecule's family: a strain's penicillin MIC (organisms.js) is shared
    pk: { F: 0.2, ka: 2, half: 0.5, vd: 0.3, fu: 0.4, spread: 0.3 },
    abx: { kmax: 0.35, ec50: 1, hill: 3, window: 4, calibrated: true },
    cautions: ['Penicillin allergy: an injection can bring on allergic shock within minutes. Have adrenaline ready (WTND p.70).'],
    ref: 'WTND pp.350–351; Goodman & Gilman 13e ch.57',
  },
  {
    id: 'ceftriaxone', name: 'Ceftriaxone', channel: 'systemic', class: 'antibiotic (cephalosporin, injected)',
    pk: { F: 0.01, ka: 1.5, half: 8, vd: 0.15, fu: 0.1, spread: 0.3 },
    abx: { kmax: 0.35, ec50: 1, hill: 3, window: 4, calibrated: true },
    cautions: ['Into a big muscle; it stings (the book mixes it with lidocaine).', 'Rarely allergic shock.'],
    ref: 'WTND p.359; Goodman & Gilman 13e ch.57; Patel IH, Kaplan SA. Am J Med 1984;77:17',
  },
  {
    id: 'adrenaline', name: 'Adrenaline (epinephrine)', channel: 'systemic', class: 'for allergic shock',
    // Given into the muscle within ~30 minutes of the reaction it mostly stops anaphylaxis killing (disease.js).
    pk: { F: 0, ka: 3, half: 0.05, vd: 2, spread: 0.3 },
    // It also opens the airways in a severe asthma attack (WTND p.385), for about an hour. 0.3 mg into the muscle peaks
    // ~0.5 ng/ml here (Simons 1998); ec50 is calibrated so one dose still works an hour later (the body is sampled
    // hourly). Too much races the heart (WTND: stop if the pulse rises >30); 10 times the dose shows it.
    effects: [{ on: 'airway', emax: 0.7, ec50: 0.00005, hill: 1.5, calibrated: true }],
    toxic: [{ at: 0.0004, sign: 'adrenaline_fast', text: 'pounding racing heart, trembling, pale (too much adrenaline)', harm: 0.02 }],
    cautions: ['Into the muscle of the thigh or upper arm: ½ ml of 1:1000 for an adult, ¼ ml for a child 6–12, less for a baby. Repeat in 10 minutes if needed.'],
    ref: 'WTND pp.70, 385; Simons FE et al. J Allergy Clin Immunol 1998;101:33',
  },
  // ——— the world's flora: one entry per compound class, plus the non-plant materia medica
  ...FLORA_ACTIVES,

  // ——— chronic illness and emergencies (WTND chapters 10, 11, 13, 22; Green Pages pp.380–392)
  // New effect targets: airway (opens narrowed airways), steroid (calms airway inflammation), seizure (share of fits
  // prevented), bp (share of the pressure above normal removed), acid, feed, iodine, folate, gi_harm (stomach lining).
  {
    id: 'salbutamol', name: 'Salbutamol (albuterol)', channel: 'systemic', class: 'for asthma (opens the airways)',
    // By mouth: F ~0.5 (first pass), peak ~2 h, t½ ~5 h, Vd ~2.2 L/kg: 4 mg peaks ~13 ng/ml (G&G). The book's syrup and
    // tablets; the inhaler is not modelled (it needs a lung dose, not a blood level). ec50 an estimate.
    pk: { F: 0.5, ka: 1.5, half: 5, vd: 2.2, spread: 0.3 },
    effects: [{ on: 'airway', emax: 0.7, ec50: 0.006, hill: 1.5 }],
    toxic: [
      { at: 0.025, sign: 'beta_tremor', text: 'trembling hands, racing heart, nervous (salbutamol)', harm: 0 },
      // overdose: low potassium and fast irregular heartbeats; rarely fatal (estimate)
      { at: 0.12, sign: 'beta_toxic', text: 'heart racing and stumbling, weak, vomiting (salbutamol overdose)', harm: 0.05 },
    ],
    cautions: ['Trembling, nervousness and a fast heartbeat are common (WTND p.384).', 'Used very often, it works less well.'],
    ref: 'WTND pp.167, 384; Goodman & Gilman 13e ch.40',
  },
  {
    id: 'prednisolone', name: 'Prednisolone', channel: 'systemic', class: 'corticosteroid (severe asthma)',
    // F ~0.8, t½ ~3 h, Vd ~0.6 L/kg; its effect on the airways builds over ~6 h and outlasts the blood level (asthma
    // model). Oral steroids after an attack cut relapse by ~60% (Rowe BH et al. Cochrane 2007;CD000195); ec50 estimate.
    pk: { F: 0.8, ka: 2, half: 3, vd: 0.6, spread: 0.3 },
    effects: [
      { on: 'steroid', emax: 0.9, ec50: 0.08, hill: 1 },
      { on: 'gi_harm', emax: 0.4, ec50: 0.3, hill: 1 }, // WTND p.129: steroids make ulcers worse; weak alone (estimate)
    ],
    toxic: [{ at: 1.5, sign: 'steroid_mood', text: 'cannot sleep, restless and excited (too much prednisolone)', harm: 0 }],
    // Weeks of daily steroid shut down the body's own (adrenal suppression); stopping suddenly then can bring collapse.
    // Rare; harm an estimate (Dinsen S et al. Eur J Intern Med 2013;24:714).
    dependence: { ec: 0.05, days: 21, tolerance: 0, sign: 'adrenal_crisis', text: 'weak, dizzy, vomiting, faint after stopping the prednisolone (adrenal failure)', harm: 0.0005 },
    cautions: ['Only for severe asthma, 3 to 7 days (WTND p.385).', 'Longer use lowers the defences against infection and must not be stopped suddenly.'],
    ref: 'WTND pp.167, 385; Goodman & Gilman 13e ch.46; Rowe BH et al. Cochrane 2007;CD000195',
  },
  {
    id: 'phenobarbital', name: 'Phenobarbital', channel: 'systemic', class: 'for epilepsy',
    // F ~0.95, slow absorption, t½ ~100 h (children less), Vd ~0.6 L/kg: 2 mg/kg/day settles near 20 mg/L over 2–3 weeks.
    // Therapeutic 15–40 mg/L. calibrated: in rural trials about two in three had their fits at least halved and ~1 in 3
    // stopped fitting (Feksi AT et al. Lancet 1991;337:406; Wang WZ et al. Lancet Neurol 2006;5:46).
    pk: { F: 0.95, ka: 1, half: 100, vd: 0.6, spread: 0.3 },
    effects: [{ on: 'seizure', emax: 0.95, ec50: 9, hill: 2, calibrated: true }],
    toxic: [
      { at: 40, sign: 'barb_drowsy', text: 'sleepy, unsteady, slurred speech (phenobarbital)', harm: 0 },
      { at: 70, sign: 'barb_resp', text: 'deeply asleep, slow shallow breathing (phenobarbital poisoning)', harm: 0.3 },
    ],
    dependence: { ec: 10, days: 30, tolerance: 0.2, sign: 'barb_withdrawal', text: 'shaking, anxious and sleepless after stopping phenobarbital (withdrawal)', harm: 0.0005 },
    // Taken through the first trimester ~6.5% of babies are malformed vs ~2–3% (Tomson T et al. Lancet Neurol
    // 2018;17:530); per is an estimate that adds ~3% over the first trimester at a usual level.
    foetal: [{ weeks: [3, 13], at: 10, harm: 'malformation', per: 1.2e-5, ref: 'Tomson T et al. Lancet Neurol 2018;17:530' }],
    cautions: ['Too much slows or stops breathing; it works slowly and lasts long (WTND p.389).', 'Often for life; stopping suddenly can bring fits back.'],
    ref: 'WTND pp.178, 389; Goodman & Gilman 13e ch.17; Feksi AT et al. Lancet 1991;337:406',
  },
  {
    id: 'diazepam', name: 'Diazepam', channel: 'systemic', class: 'to stop a long fit · muscle relaxant',
    // F ~0.95 by mouth and ~0.9 as solution in the anus (peak 10–30 min; item `inj.ka`), t½ ~40 h, Vd ~1.1 L/kg.
    // ~0.2 mg/L stops most fits (G&G ch.17); ec50 an estimate.
    pk: { F: 0.95, ka: 2, half: 40, vd: 1.1, spread: 0.35 },
    // seizure: epilepsy and fever fits (fits model); fits: eclampsia and tetanus spasms (spasm model), where it holds
    // off fits less well than magnesium (calibrated: Duley L et al. Cochrane 2010;CD000127).
    effects: [{ on: 'seizure', emax: 0.95, ec50: 0.15, hill: 1.5 }, { on: 'fits', emax: 0.6, ec50: 0.15, hill: 1.5, calibrated: true }],
    toxic: [
      { at: 0.6, sign: 'benzo_drowsy', text: 'very sleepy and unsteady (diazepam)', harm: 0 },
      { at: 3, sign: 'benzo_resp', text: 'cannot be woken, slow shallow breathing (diazepam poisoning)', harm: 0.15 },
    ],
    // Daily use for a few weeks: tolerance (fits come back through it) and dependence; stopping brings withdrawal,
    // now and then fits (Ashton CH. Benzodiazepines: how they work and how to withdraw, 2002; G&G ch.17). Estimates.
    dependence: { ec: 0.15, days: 21, tolerance: 1, sign: 'benzo_withdrawal', text: 'anxious, shaking and sleepless after stopping diazepam (withdrawal)', harm: 0.0005 },
    cautions: ['Too much slows or stops breathing (WTND p.390).', 'Habit-forming: not for daily use. Keep it locked away.'],
    ref: 'WTND pp.178, 184, 389–390; Goodman & Gilman 13e ch.17; Duley L et al. Cochrane 2010;CD000127',
  },
  {
    id: 'hydrochlorothiazide', name: 'Hydrochlorothiazide', channel: 'systemic', class: 'for high blood pressure (diuretic)',
    // F ~0.7, t½ ~10 h; 12.5–25 mg lowers systolic pressure ~8–10 mmHg with a flat dose-response (Law MR et al. BMJ
    // 2003;326:1427). bp is the share of the pressure above normal it removes; ec50 an estimate.
    pk: { F: 0.7, ka: 1, half: 10, vd: 3, spread: 0.3 },
    effects: [
      { on: 'bp', emax: 0.35, ec50: 0.03, hill: 1 },
      { on: 'fluid_out', emax: 0.5, ec50: 0.03, hill: 1 },
    ],
    toxic: [
      { at: 0.05, dry: 0.05, sign: 'kidney_injury', text: 'passing almost no urine, even after drinking (kidney injury)', harm: 0.05 },
      { at: 0.25, sign: 'low_potassium', text: 'weak, cramping muscles (too little potassium)', harm: 0.01 },
    ],
    cautions: ['Stop it while there is diarrhoea or vomiting: it dries the body further.', 'Too much drains potassium.'],
    ref: 'WTND p.125; WHO HEARTS technical package 2018; Law MR et al. BMJ 2003;326:1427',
  },
  {
    id: 'amlodipine', name: 'Amlodipine', channel: 'systemic', class: 'for high blood pressure (calcium channel blocker)',
    // F ~0.7, peak 6–12 h, t½ ~40 h, Vd ~21 L/kg: 5 mg a day settles near 6–7 ng/ml (Abernethy DR. Am J Cardiol
    // 1989;64:101). 5 mg lowers systolic ~10–12 mmHg (Law 2003); ec50 an estimate.
    pk: { F: 0.7, ka: 0.15, half: 40, vd: 21, spread: 0.3 },
    effects: [{ on: 'bp', emax: 0.5, ec50: 0.004, hill: 1 }],
    toxic: [
      { at: 0.012, sign: 'ankle_swelling', text: 'swollen ankles (amlodipine)', harm: 0 },
      { at: 0.06, sign: 'ccb_shock', text: 'faint, cold, very low pressure (amlodipine poisoning)', harm: 0.3 },
    ],
    cautions: ['Swollen ankles are common at higher doses.'],
    ref: 'WTND p.125; WHO HEARTS technical package 2018; Abernethy DR. Am J Cardiol 1989;64:101',
  },
  {
    id: 'folic_acid', name: 'Folic acid', channel: 'gut', class: 'vitamin (for anaemia)',
    gut: { duration: 24, effects: [{ on: 'folate', per: 1, perMg: 1 }] },
    note: 'Builds blood only where folate is what is missing; most anaemia here is from too little iron.',
    ref: 'WTND pp.124, 392; WHO Guideline: daily iron and folic acid supplementation in pregnant women 2012',
  },
  {
    id: 'antacid', name: 'Aluminium/magnesium hydroxide', channel: 'gut', class: 'antacid',
    // Neutralises acid for 2–3 hours after a dose; eases the pain, helps an ulcer heal a little (estimate).
    gut: { duration: 3, effects: [{ on: 'acid', per: 0.5, perMg: 1 / 400 }] },
    cautions: ['Baking soda calms quickly but brings more acid after: not for ulcers (WTND p.129).'],
    ref: 'WTND pp.128–129, 380',
  },
  {
    id: 'omeprazole', name: 'Omeprazole', channel: 'gut', class: 'stops stomach acid',
    // Its blood t½ is ~1 h, but it blocks the acid pump for a day, so it is modelled by its day-long effect on acid
    // (estimate). 20 mg a day heals ~80–90% of ulcers in 4 weeks (G&G ch.49).
    gut: { duration: 24, effects: [{ on: 'acid', per: 0.9, perMg: 1 / 8 }] },
    ref: 'WTND pp.129, 381; Goodman & Gilman 13e ch.49',
  },
  {
    id: 'rutf', name: 'Ready-to-use therapeutic food (peanut paste)', channel: 'gut', class: 'food for severe malnutrition',
    // A 92 g sachet is 500 kcal; a thin child needs 150–200 kcal/kg a day (2–3 sachets). Treated at home with it, ~80–90%
    // of severely malnourished children recovered vs ~60–80% on the usual diet (Ciliberto MA et al. Am J Clin Nutr
    // 2005;81:864). mg here are mg of paste; a sachet covers about 8 hours.
    gut: { duration: 8, effects: [{ on: 'feed', per: 0.9, perMg: 1 / 30000 }] },
    ref: 'WTND pp.110–113; WHO Guideline: updates on the management of severe acute malnutrition in infants and children 2013; Ciliberto MA et al. Am J Clin Nutr 2005;81:864',
  },
  {
    id: 'iodine', name: 'Iodine (iodized oil)', channel: 'gut', class: 'for goitre',
    // One capsule (~200 mg iodine) stocks the thyroid for about a year: 960 h is one game year (time.js YEAR_DAYS × 24),
    // the slow-process compression. Goitres shrink ~30–50% within a year in the young, little when old and hard
    // (Zimmermann MB et al. Lancet 2008;372:1251); per an estimate.
    gut: { duration: 960, effects: [{ on: 'iodine', per: 0.45, perMg: 1 / 50 }] },
    // A sudden iodine load can push an old goitre into overactivity (iodine-induced hyperthyroidism); rare, estimate.
    idio: [{ per: 0.002, days: [5, 30], hours: 480, sign: 'iodine_hyper', text: 'shaky, sweating, heart racing, losing weight (overactive thyroid from the iodine)', harm: 0.0005 }],
    ref: 'WTND p.130; Zimmermann MB et al. Lancet 2008;372:1251',
  },
  {
    id: 'snake_antivenom', name: 'Snake antivenom (horse serum)', channel: 'systemic', class: 'antivenom',
    // Equine F(ab')2: t½ ~80 h, Vd ~0.2 L/kg; dosed in vials (1 'mg' = 1 vial). It neutralises venom in the blood in
    // proportion to how much of it there is against the venom (disease.js venom model; the ratio is an estimate).
    pk: { F: 0.01, ka: 20, half: 80, vd: 0.2, spread: 0.3 },
    // Horse serum sets off an early reaction in many who get it, allergic or not: ~10–50%, a few with shock (de Silva HA
    // et al. PLoS Med 2011;8:e1000435). Serum sickness follows in some a week later.
    reacts: 0.3,
    idio: [{ per: 0.1, days: [5, 14], hours: 96, sign: 'serum_sickness', text: 'fever, itchy rash and aching joints a week after the antivenom (serum sickness)', harm: 0 }],
    cautions: ['Into the vein, slowly. Have adrenaline drawn up first (WTND pp.70, 387).', 'The bigger the snake or the smaller the person, the more vials.'],
    ref: 'WTND pp.105, 387; WHO Guidelines for the prevention and clinical management of snakebite in Africa 2010; de Silva HA et al. PLoS Med 2011;8:e1000435',
  },
  {
    id: 'scorpion_antivenom', name: 'Scorpion antivenom (horse serum)', channel: 'systemic', class: 'antivenom',
    // Purified F(ab')2 (as Alacramyn); in a trial it ended the poisoning of stung children within hours (Boyer LV et al.
    // N Engl J Med 2009;360:2090), though for some scorpions trials found no benefit.
    pk: { F: 0.01, ka: 20, half: 60, vd: 0.2, spread: 0.3 },
    reacts: 0.1,
    idio: [{ per: 0.05, days: [5, 14], hours: 96, sign: 'serum_sickness', text: 'fever, itchy rash and aching joints a week after the antivenom (serum sickness)', harm: 0 }],
    cautions: ['Only for small children, within 2 hours of the sting (WTND pp.106, 387).'],
    ref: 'WTND pp.106, 387; Boyer LV et al. N Engl J Med 2009;360:2090',
  },

  // ——— childbirth and the newborn (WTND chapter 19; Green Pages pp.352, 358, 389–392). `uterus`: how hard the womb
  // is clamped (disease.js bleeding); `fits`: fits held off (disease.js fits). Before the birth a uterotonic squeezes
  // the baby: foetal `loss` (the book's warning, p.266); rates are estimates.
  {
    id: 'oxytocin', name: 'Oxytocin', channel: 'systemic', class: 'uterotonic (injected)',
    // Plasma t½ ~3–5 min; into the muscle it acts in 3–7 min for 30–60 min, so absorption from the muscle (the item's
    // inj.ka) sets the duration. Dosed in mg: 10 IU ≈ 0.0168 mg. ec50 an estimate: 10 IU IM clamps the womb ~1 h.
    // Prevents about half of PPH (RR 0.53: Westhoff G et al. Cochrane 2013;CD001808).
    pk: { F: 0, ka: 1.5, half: 0.07, vd: 0.3, spread: 0.3 },
    effects: [{ on: 'uterus', emax: 1, ec50: 0.00004, hill: 2 }],
    foetal: [{ weeks: [20, 43], at: 0.00004, harm: 'loss', per: 0.02, ref: 'WTND pp.266, 390 (estimate)' }],
    cautions: ['Only after the baby is born. Used to hurry labour it can tear the womb and kill the baby (WTND p.266).'],
    ref: 'WTND pp.266, 390; Goodman & Gilman 13e ch.44; Westhoff G et al. Cochrane 2013;CD001808',
  },
  {
    id: 'misoprostol', name: 'Misoprostol', channel: 'systemic', class: 'uterotonic (tablets)',
    // Misoprostol acid after 600 µg by mouth peaks at ~1.5 ng/ml in ~30 min, t½ 20–40 min; the womb stays contracted
    // ~2 h (Tang OS et al. Hum Reprod 2002;17:332). Vd chosen to give that peak. A little weaker than oxytocin (more
    // PPH ≥1000 ml, RR 1.33: Tunçalp Ö et al. Cochrane 2012;CD000494). Calibrated: 600 µg at birth halves PPH ≥500 ml
    // (12.0% → 6.4%: Derman RJ et al. Lancet 2006;368:1248).
    pk: { F: 0.9, ka: 3, half: 0.5, vd: 3, spread: 0.3 },
    effects: [{ on: 'uterus', emax: 0.85, ec50: 0.0003, hill: 2, calibrated: true }],
    // shivering in about half after 600 µg, sometimes fever (Derman RJ et al. 2006)
    toxic: [{ at: 0.0012, sign: 'shivering', text: 'shivering and a fever (misoprostol)', harm: 0 }],
    // it empties a pregnant womb at any stage (WHO Medical management of abortion 2018); the rate is an estimate
    foetal: [{ weeks: [4, 43], at: 0.0003, harm: 'loss', per: 0.02, ref: 'WHO Medical management of abortion 2018 (estimate)' }],
    cautions: ['Never during pregnancy: it brings on miscarriage.', 'Shivering and fever after it are common and pass.'],
    ref: 'WTND pp.266, 391; Tang OS et al. Hum Reprod 2002;17:332; Derman RJ et al. Lancet 2006;368:1248',
  },
  {
    id: 'ergometrine', name: 'Ergometrine (ergonovine)', channel: 'systemic', class: 'uterotonic (injected)',
    // Acts 2–7 min after IM injection and keeps the womb clamped ~3 h; t½ ~2 h (de Groot AN et al. Drugs 1998;56:523).
    // Vd and ec50 estimates giving ~3 h of effect from 0.2 mg. Nausea, vomiting and a rise in blood pressure are common
    // (Liabsuetrakul T et al. Cochrane 2018;CD005456).
    pk: { F: 0.6, ka: 2, half: 2, vd: 0.5, spread: 0.3 },
    effects: [{ on: 'uterus', emax: 0.9, ec50: 0.0015, hill: 2 }],
    toxic: [{ at: 0.004, sign: 'ergot', text: 'headache, vomiting, the blood pressure up (ergometrine)', harm: 0 }],
    foetal: [{ weeks: [20, 43], at: 0.0015, harm: 'loss', per: 0.02, ref: 'WTND pp.266, 390 (estimate)' }],
    cautions: ['Only after the placenta is out: before, it can trap it inside.', 'Not with high blood pressure or pre-eclampsia.'],
    ref: 'WTND pp.266, 390; de Groot AN et al. Drugs 1998;56:523; Liabsuetrakul T et al. Cochrane 2018;CD005456',
  },
  {
    id: 'magnesium', name: 'Magnesium (as sulfate, injected)', channel: 'systemic', class: 'for eclampsia',
    // Dosed as elemental Mg: 5 g magnesium sulfate (heptahydrate) = 493 mg. Vd ~0.4 L/kg, t½ ~4–5 h with working
    // kidneys; IM peaks in 1–2 h. Levels are what the injection adds to the body's own ~20 mg/L: the working range of
    // 4–7 mEq/L total is ~30–60 added; the knee jerks go near 10 mEq/L (~100 added) and breathing stops near 15 (~160)
    // (Lu JF, Nightingale CH. Clin Pharmacokinet 2000;38:305). By mouth (Epsom salts) it is barely absorbed.
    pk: { F: 0, ka: 1, half: 4.5, vd: 0.4, spread: 0.3 },
    // calibrated: recurrent fits ~13% on magnesium vs ~28% on diazepam (Eclampsia Trial Collaborative Group. Lancet 1995;345:1455)
    effects: [{ on: 'fits', emax: 0.92, ec50: 10, hill: 2, calibrated: true }],
    toxic: [
      { at: 100, sign: 'mg_reflex', text: 'knee jerks gone, drowsy and flushed (too much magnesium)', harm: 0 },
      { at: 160, sign: 'mg_breath', text: 'breathing slow and failing (magnesium poisoning)', harm: 0.5 },
    ],
    cautions: ['Too much stops the breathing: check the knee jerks and breathing before each dose (WTND p.390).', 'Not with kidney failure: it builds up.'],
    ref: 'WTND p.390; Lu JF, Nightingale CH. Clin Pharmacokinet 2000;38:305; Eclampsia Trial Collaborative Group. Lancet 1995;345:1455',
  },
  {
    id: 'ampicillin', name: 'Ampicillin (injected)', channel: 'systemic', class: 'antibiotic (penicillin, injected)', allergen: 'penicillin',
    abxAs: 'amoxicillin', // the same spectrum: judged by the strain's amoxicillin MIC
    pk: { F: 0.4, ka: 1.5, half: 1, vd: 0.3, fu: 0.8, spread: 0.3 },
    abx: { kmax: 0.35, ec50: 1, hill: 3, window: 4, calibrated: true },
    cautions: ['Penicillin allergy: have adrenaline ready.'],
    ref: 'WTND pp.275–276, 352; Goodman & Gilman 13e ch.57',
  },
  {
    id: 'gentamicin', name: 'Gentamicin', channel: 'systemic', class: 'antibiotic (aminoglycoside, injected)',
    // Not absorbed by mouth. t½ ~2–3 h in adults, longer in newborns (pk.js); Vd ~0.3 L/kg; 5 mg/kg peaks ~10–15 mg/L.
    // Kills by concentration, like ciprofloxacin (Goodman & Gilman 13e ch.58). MICs: organisms.js.
    pk: { F: 0, ka: 3, half: 2.5, vd: 0.3, fu: 0.9, spread: 0.3 },
    abx: { kmax: 0.5, ec50: 2, hill: 1.2, window: 8, calibrated: true },
    // levels held high harm the inner ear and the kidney (Moore RD et al. J Infect Dis 1984;149:23); thresholds estimates
    toxic: [
      { at: 20, sign: 'gent_ear', text: 'ringing ears, dizzy, the hearing going (gentamicin)', harm: 0 },
      { at: 30, sign: 'kidney_injury', text: 'hardly any urine (gentamicin on the kidneys)', harm: 0.05 },
    ],
    cautions: ['Once a day, by weight. Too much makes people deaf and harms the kidneys (WTND p.358).'],
    ref: 'WTND pp.275–276, 358; Goodman & Gilman 13e ch.58; Moore RD et al. J Infect Dis 1984;149:23',
  },
];

export const ACTIVE = new Map(ACTIVES.map((a) => [a.id, a]));
