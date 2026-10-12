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
    id: 'salicin', name: 'Salicin (willow salicylates)', channel: 'systemic', class: 'analgesic',
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
      // PRR ~10^4 per cycle — the fastest-acting antimalarials, but gone from the blood in hours.
      { on: 'plasmodium', prr: 4, ec50: 0.01, hill: 1.5 },
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
];

export const ACTIVE = new Map(ACTIVES.map((a) => [a.id, a]));
