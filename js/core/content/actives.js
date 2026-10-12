// actives.js — the compounds that do the work. Herbs carry them; preparations extract them; the
// pharmacology model (pk.js) turns a dose into a concentration curve and the curve into effects.
//
// Channels:
//   systemic — one-compartment PK (F, ka, t½, Vd per kg); effects by Emax on plasma concentration.
//   gut      — acts in the bowel lumen (worms, cramps, stool output). A dose of m mg gives exposure
//              E = 1 − exp(−m·perMg); for `duration` hours it changes its target by per·E (symptoms:
//              fraction relieved; worms: fraction killed per dose). Negative per = makes it worse.
//   topical  — strength is relative (1 = typical batch); acts per application.
//   topical  — acts where it is applied (skin, wound); effect per application.
//   fluid    — rehydration: water, sodium and glucose replace losses.
//
// Concentrations are mg/L. Every number has a ref; where the literature gives a range the middle is
// used and `spread` says how much it varies between people. Numbers marked `calibrated` are fitted to
// a clinical effect size rather than measured directly; the note says which trial.

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
    cautions: ['Not for babies under 2 months or in the last month of pregnancy (jaundice).', 'Rarely a severe blistering rash: stop at once.'],
    ref: 'WTND p.357; Goodman & Gilman 13e ch.56',
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
    cautions: ['Not for children under 8 or in pregnancy: it stains and weakens growing teeth and bones.', 'Do not take with milk or antacids.'],
    ref: 'WTND p.355; Goodman & Gilman 13e ch.59',
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
    ],
    cautions: ['Not for someone who is dehydrated (the kidneys), has a stomach ulcer, or is in the last months of pregnancy.'],
    ref: 'WTND p.379; Goodman & Gilman 13e ch.34',
  },
  {
    id: 'aspirin', name: 'Aspirin (as salicylate)', channel: 'systemic', class: 'analgesic · antipyretic', allergen: 'aspirin',
    // Salicylate t½ lengthens with dose (2–3 h at analgesic doses, up to 20 h in poisoning); the low end is used.
    pk: { F: 0.75, ka: 2, half: 3, vd: 0.17, spread: 0.3 },
    effects: [
      { on: 'pain', emax: 0.5, ec50: 40, hill: 1.5 },
      { on: 'fever', emax: 0.6, ec50: 30, hill: 1.5 },
    ],
    toxic: [
      { at: 200, sign: 'tinnitus', text: 'ringing in the ears (salicylate excess)', harm: 0.02 },
      { at: 400, sign: 'salicylism', text: 'deep fast breathing, vomiting, confusion (aspirin poisoning)', harm: 0.35 },
    ],
    cautions: ['Not for children with flu or chickenpox (Reye syndrome).', 'Not with stomach ulcers or in late pregnancy.'],
    ref: 'WTND p.378; Goodman & Gilman 13e ch.34',
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
    note: 'A help, not a cure: the rehydration drink still does the life-saving.',
    ref: 'WTND p.381; Lazzerini M, Wanzira H. Cochrane 2016;CD005436',
  },

  // ——— phase 2c
  {
    id: 'metronidazole', name: 'Metronidazole', channel: 'systemic', class: 'anti-amoebic · anti-giardia · anaerobes',
    pk: { F: 1, ka: 1.5, half: 8, vd: 0.8, fu: 0.9, spread: 0.25 },
    abx: { kmax: 0.3, ec50: 1, hill: 1.5, window: 8, calibrated: true },
    cautions: ['No alcohol while taking it, or for 2 days after: violent vomiting.', 'Avoid in the first 3 months of pregnancy if it can wait.'],
    ref: 'WTND p.368; Goodman & Gilman 13e ch.50',
  },
  {
    id: 'iron', name: 'Iron (ferrous sulfate)', channel: 'gut', class: 'for anaemia',
    // Taken daily, iron lets the marrow rebuild blood: Hb rises ~1–2 g/dL in 3 weeks (disease.js).
    gut: { duration: 24, effects: [{ on: 'iron', per: 1, perMg: 1 / 30 }] },
    cautions: ['Turns the stool black. Can upset the stomach.', 'An overdose of iron tablets kills small children: keep them out of reach.'],
    ref: 'WTND pp.124, 392; WHO Guideline: daily iron supplementation in children 2016',
  },
  {
    id: 'vitamin_a', name: 'Vitamin A (retinol)', channel: 'gut', class: 'vitamin',
    // 200 000 IU (60 mg retinol) restores the liver store for weeks; in measles it cuts deaths in young children.
    gut: { duration: 14 * 24, effects: [{ on: 'vita', per: 1, perMg: 1 / 10 }] },
    cautions: ['Too much in early pregnancy harms the baby: not the big capsules for pregnant women.'],
    ref: 'WTND pp.226, 311, 391; Huiming Y et al. Cochrane 2005;CD001479',
  },
];

export const ACTIVE = new Map(ACTIVES.map((a) => [a.id, a]));
