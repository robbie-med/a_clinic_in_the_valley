// village.js (content) — how each illness arises among the valley's people (core/village.js). An illness is either:
//   • caught: a germ passed from person to person, from water, flies or mosquitoes (content/contagion.js);
//   • background: it simply happens to people at a steady rate (a cut, a burn, a bad back, an ear infection), in the
//     proportions the conditions table's `epi` weights give for that person, season and hamlet (patient.js
//     conditionWeight), scaled by BACKGROUND;
//   • chronic: lifelong or years long, present in a share of people of each age when the valley begins (`prev`) and
//     arising at `inc` a game year (a game year is a real year for slow illness: time.js COMPRESS);
//   • window: a share of pregnancies, births or newborns in a window of weeks or days;
//   • from the body: anaemia when the blood is low, wasting when the weight is (village.js);
//   • none: only ever a complication of another illness or of labour (disease.js, people.js LABOUR).
// `seek`: how strongly the illness sends people to a clinic for the same felt severity (silent high blood pressure
// hardly at all). Prevalences are rounded from the sources given; incidences are what keeps them steady (estimates).

// Background illness: episodes a real day per unit of `epi` weight. ~9 episodes a year in a child under 5 and ~2–3 in
// an adult with these weights: rural East African children have ~3–5 episodes of diarrhoea, ~1–2 of malaria and ~5 of
// cough or cold a year (Walker CLF et al. Lancet 2013;381:1405; Uganda Malaria Indicator Survey 2018); calibrated
// against the clinic's old arrival rate (an estimate, checked in test/arrivals.test.mjs).
export const BACKGROUND = 1.2e-4;

export const NONE = ['rheumatic_fever', 'pyelonephritis', 'mastoiditis', 'pid', 'pph', 'obstructed_labour', 'eclampsia', 'miscarriage', 'puerperal_sepsis'];
export const FROM_BODY = ['anaemia', 'marasmus', 'kwashiorkor'];

/** Lifelong and years-long illness: prevalence [[age to, share]] at the start, incidence [[age to, per game year]]. */
export const CHRONIC = {
  // ~30% of adults in sub-Saharan Africa have high blood pressure, rising with age (Ataklte F et al. Hypertension
  // 2015;65:291)
  hypertension: { prev: [[30, 0], [45, 0.15], [60, 0.3], [Infinity, 0.45]], inc: [[30, 0], [45, 0.012], [60, 0.02], [Infinity, 0.03]], ref: 'Ataklte F et al. Hypertension 2015;65:291' },
  // diabetes ~4.5% of African adults (IDF Diabetes Atlas, 10th ed., 2021)
  diabetes: { prev: [[30, 0.002], [45, 0.02], [Infinity, 0.05]], inc: [[30, 0.0001], [45, 0.002], [Infinity, 0.004]], ref: 'IDF Diabetes Atlas 2021' },
  // goitre where salt is not iodized: an estimate for a valley off the main roads (WTND p.130)
  goitre: { prev: [[8, 0.01], [Infinity, 0.05]], inc: [[8, 0.001], [Infinity, 0.002]], ref: 'WTND p.130 (estimate)' },
  // active convulsive epilepsy 7–15 per 1000 across five sub-Saharan sites, ~10 in Uganda (Ngugi AK et al. Lancet Neurol
  // 2013;12:253)
  epilepsy: { prev: [[1, 0.002], [Infinity, 0.009]], inc: [[1, 0.0005], [30, 0.0008], [Infinity, 0.0004]], ref: 'Ngugi AK et al. Lancet Neurol 2013;12:253' },
  // asthma ~5% of children, ~3% of adults in Africa (estimates; ISAAC phase III)
  asthma: { prev: [[2, 0.01], [15, 0.05], [Infinity, 0.03]], inc: [[15, 0.004], [Infinity, 0.001]], ref: 'ISAAC phase III (estimate)' },
  arthritis: { prev: [[40, 0], [60, 0.05], [Infinity, 0.15]], inc: [[40, 0], [60, 0.004], [Infinity, 0.01]], ref: 'estimate (knee osteoarthritis, symptomatic)' },
  heart_failure: { prev: [[45, 0], [60, 0.005], [Infinity, 0.02]], inc: [[45, 0], [60, 0.001], [Infinity, 0.004]], ref: 'estimate' },
  ulcer: { prev: [[15, 0], [Infinity, 0.03]], inc: [[15, 0], [Infinity, 0.004]], ref: 'estimate (symptomatic peptic ulcer)' },
  // HIV ~6% of adults in Uganda (UPHIA 2016–2017), highest at 25–49; new infections mostly through a partner
  // (content/contagion.js), the rest from outside the household
  hiv: { prev: [[1, 0.005], [15, 0.004], [25, 0.025], [50, 0.075], [Infinity, 0.04]], inc: [[15, 0], [25, 0.003], [50, 0.002], [Infinity, 0.0005]], ref: 'Uganda Population-based HIV Impact Assessment (UPHIA) 2016–2017' },
  // TB of the lungs: ~250 per 100 000 adults (Uganda National TB Prevalence Survey 2014–2015)
  tb: { prev: [[15, 0.0005], [Infinity, 0.0025]], inc: [[15, 0.0002], [Infinity, 0.001]], ref: 'Uganda National TB Prevalence Survey 2014–2015' },
  leprosy: { prev: [[Infinity, 0.0002]], inc: [[Infinity, 0.00002]], ref: 'WHO Weekly Epidemiological Record 2021 (rounded)' },
  // soil worms in rural East African children (Pullan RL et al. Parasit Vectors 2014;7:37): infections heavy enough to
  // matter; worms die and are caught again (content/contagion.js prevent: shoes, latrines)
  hookworm: { prev: [[3, 0.02], [15, 0.15], [Infinity, 0.1]], inc: [[3, 0.05], [15, 0.4], [Infinity, 0.06]], ref: 'Pullan RL et al. Parasit Vectors 2014;7:37' },
  ascaris: { prev: [[2, 0.03], [15, 0.2], [Infinity, 0.05]], inc: [[2, 0.1], [15, 0.6], [Infinity, 0.08]], ref: 'Pullan RL et al. Parasit Vectors 2014;7:37' },
  pinworm: { prev: [[3, 0.03], [12, 0.15], [Infinity, 0.03]], inc: [[3, 0.1], [12, 0.4], [Infinity, 0.05]], ref: 'estimate' },
};
// The slow models (disease.js) a person can carry while up and about, stepped a few times a day (core/village.js).
export const SLOW_MODELS = new Set(['chronic', 'hiv', 'mycobacterial', 'worms', 'scabies', 'asthma', 'fits']);

/** A share of pregnancies, births or babies, spread over a window: weeks of pregnancy, days since the birth (real), or
 *  the baby's age (years). */
export const WINDOW = {
  // severe enough to seek help: an estimate (most pregnant women feel sick in the first months, few that badly)
  nausea_pregnancy: { p: 0.15, weeks: [5, 14], ref: 'estimate' },
  // pre-eclampsia 2–8% of pregnancies (Abalos E et al. Eur J Obstet Gynecol Reprod Biol 2013;170:1)
  pre_eclampsia: { p: 0.05, weeks: [20, 40], ref: 'Abalos E et al. Eur J Obstet Gynecol Reprod Biol 2013;170:1' },
  ectopic: { p: 0.015, weeks: [5, 10], ref: 'estimate (1–2% of pregnancies)' },
  mastitis: { p: 0.05, pp: [3, 90], ref: 'estimate (3–10% of breastfeeding women)' },
  // newborn infection in sub-Saharan Africa: an estimate from neonatal sepsis incidence (Fleischmann C et al. Arch Dis
  // Child 2021;106:745: ~2.8% of live births)
  newborn_sepsis: { p: 0.028, age: [0, 0.077], ref: 'Fleischmann C et al. Arch Dis Child 2021;106:745' },
  cord_infection: { p: 0.03, age: [0, 0.04], ref: 'estimate' },
  newborn_jaundice: { p: 0.05, age: [0.003, 0.03], ref: 'estimate (needing care)' },
  cold_baby: { p: 0.05, age: [0, 0.06], ref: 'estimate' },
  // tetanus: ~1 in 100 babies of unprotected mothers born at home with unclean cord care died (people.js ntRisk); here
  // it is an illness, ~85% of it fatal untreated, so incidence = the death risk / 0.85 (protection and a clean birth
  // as in ntRisk)
  newborn_tetanus: { p: 0.0118, age: [0.008, 0.06], tetanus: true, ref: 'Roper MH et al. Lancet 2007;370:1947' },
};

/** Cured somewhere other than your clinic, a chance a game day: Uganda's school deworming reaches children twice a year
 *  (albendazole; WHO. Preventive chemotherapy to control soil-transmitted helminth infections, 2017), adults now and
 *  then buy mebendazole at the shop; scabies and ringworm creams from the shop or the health centre (estimates). */
export const ELSEWHERE = {
  hookworm: { child: 2 / 40, adult: 0.008 }, ascaris: { child: 2 / 40, adult: 0.008 }, pinworm: { child: 2 / 40, adult: 0.01 },
  scabies: 0.02, tinea: 0.01, trachoma: 0.005,
};

/** The conditions table's weights describe who arrives at a clinic, and the gravest illnesses nearly always come; so for
 *  them the weight overstates how often they happen. These scale the background back to their real incidence:
 *  meningitis ~10–50 per 100 000 a year outside epidemics, typhoid ~100–500, tetanus a few, cholera in outbreaks only,
 *  snakebite ~100–300 (WHO fact sheets on meningitis, typhoid, tetanus, cholera and snakebite envenoming; rounded,
 *  the multipliers estimates). */
export const RARE = { meningitis: 0.015, typhoid: 0.06, tetanus: 0.02, cholera: 0.1, snakebite: 0.1, scorpion_sting: 0.2, kerosene: 0.15, stroke: 0.3 };
/** Families who give the rehydration drink at home when a child has diarrhoea: about half (Uganda DHS 2016: ORS for ~47%
 *  of children with diarrhoea). */
export const HOME_ORS = 0.47;

/** How strongly an illness sends people to a clinic for the same felt severity (estimates). */
export const SEEK = { hypertension: 0.1, diabetes: 0.5, goitre: 0.3, hiv: 0.6, ascaris: 0.4, pinworm: 0.4, hookworm: 0.5, arthritis: 0.4, ulcer: 0.6, back_pain: 0.6, common_cold: 0.3, tinea: 0.4 };
