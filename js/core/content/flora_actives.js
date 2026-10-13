// flora_actives.js — the compound CLASSES of the world's flora (content/flora.js), plus the non-plant
// materia medica. Each class is written once, here, with real pharmacology and references; no species
// is ever rated by hand. A plant's strength is its measured content (% of the dry part, from Duke)
// × the extraction method (preparations.js) × these numbers. Merged into ACTIVES by actives.js.
//
// Classes whose benefit this simulation has no target for carry no `effects` — only their real
// toxicity. That is deliberate: an untreatable-here compound must not pretend to work.

import { localize } from '../i18n.js';

export const FLORA_ACTIVES = [
  // ——— the gut: astringents and laxatives
  {
    id: 'tannin', name: 'Tannins', channel: 'gut', class: 'astringent',
    // Oak bark and other tannin-rich barks are traditional for diarrhoea: tannins precipitate mucosal
    // protein and slow secretion. Trials are old and small; the effect here is modest, and large
    // amounts nauseate and bind iron.
    gut: { duration: 6, effects: [{ on: 'stool', per: 0.18, perMg: 1 / 500 }, { on: 'cramp', per: 0.12, perMg: 1 / 500 }, { on: 'nausea', per: -0.3, perMg: 1 / 4000 }] },
    note: 'Dries and tightens the gut lining. It does not replace the water lost, and a strong brew turns the stomach.',
    cautions: ['Strong tannin brews cause nausea and vomiting, and block iron from food — bad in anaemia.'],
    ref: 'EMA/HMPC assessment report on Quercus cortex, 2010; Chung K-T et al. Crit Rev Food Sci Nutr 1998;38:421',
  },
  {
    id: 'berberine', name: 'Berberine-type alkaloids', channel: 'gut', class: 'antidiarrhoeal · antimicrobial',
    // calibrated: 400 mg berberine as a single dose cut stool volume by ~40% in enterotoxigenic E. coli
    // diarrhoea (Rabbani 1987). Oral bioavailability is almost nil, so it works in the lumen.
    gut: { duration: 12, effects: [{ on: 'stool', per: 0.4, perMg: 1 / 250, calibrated: true }, { on: 'cramp', per: 0.3, perMg: 1 / 250 }] },
    note: 'Goldthread, barberry, tree turmeric. Works in the bowel, not in the blood: it eases secretory diarrhoea but will not reach an infection elsewhere.',
    cautions: ['Not for newborns: berberine displaces bilirubin and can worsen jaundice.'],
    ref: 'Rabbani GH et al. J Infect Dis 1987;155:979; Chen C et al. Clin Gastroenterol Hepatol 2015;13:1724',
  },
  {
    id: 'emodin', name: 'Anthraquinone aglycones (emodin, rhein)', channel: 'gut', class: 'laxative',
    // The free aglycones are the weaker end of the anthranoid laxatives: the glycosides (aloin) need gut
    // flora to release them and act harder. Both make stools looser and cramp.
    gut: { duration: 10, effects: [{ on: 'stool', per: -0.5, perMg: 1 / 60 }, { on: 'cramp', per: -0.3, perMg: 1 / 60 }] },
    note: 'Rhubarb and dock roots, senna pods, cascara. A purge, not a cure — dangerous in anyone already dry from diarrhoea.',
    cautions: ['Purging a dehydrated patient, or a child with diarrhoea, makes the water loss worse.', 'Months of daily use stop the bowel working on its own.'],
    ref: 'EMA/HMPC assessment report on Rhei radix, 2007; EMA public statement on anthranoid laxatives, 2018',
  },
  {
    id: 'saponin', name: 'Saponins', channel: 'gut', class: 'expectorant (weak) · gut irritant',
    // Saponin expectorants (ivy, primula, soapwort) have small trials in acute bronchitis; the same
    // surface activity irritates the stomach.
    gut: { duration: 6, effects: [{ on: 'cough', per: 0.15, perMg: 1 / 300 }, { on: 'nausea', per: -0.35, perMg: 1 / 1500 }] },
    note: 'Soapy glycosides: they foam in water, thin phlegm a little, and upset the stomach readily.',
    cautions: ['Nausea and vomiting are the usual price of a strong saponin brew.'],
    ref: 'EMA/HMPC assessment report on Hederae folium, 2017; Hostettmann K, Marston A. Saponins, CUP 1995',
  },
  {
    id: 'oxalate', name: 'Oxalates', channel: 'gut', class: 'irritant',
    // Soluble oxalate burns the mouth and gut and, in quantity, precipitates in the kidney. Rhubarb
    // leaves are the classic poisoning; deaths are rare but the kidney injury is real.
    gut: { duration: 8, effects: [{ on: 'nausea', per: -0.4, perMg: 1 / 4000 }, { on: 'cramp', per: -0.3, perMg: 1 / 4000 }] },
    note: 'No medicinal effect. In ordinary food amounts it only binds calcium; in quantity (rhubarb leaves, some arums) it burns the mouth and can injure the kidneys.',
    cautions: ['Burning mouth and throat, vomiting and belly pain; a large dose can shut the kidneys down.'],
    ref: 'Noonan SC, Savage GP. Asia Pac J Clin Nutr 1999;8:64; Sanz P, Reig R. Vet Hum Toxicol 1992;34:342',
  },

  // ——— the heart
  {
    id: 'cardenolide', name: 'Cardiac glycosides (digoxin-type)', channel: 'systemic', class: 'cardiac',
    // Modelled on digoxin: F ~0.7, t½ ~36–48 h, Vd ~6–7 L/kg. Therapeutic 0.0008–0.002 mg/L; toxicity
    // climbs above ~0.002 and is common above 0.0035. Oleander, lily of the valley, squill, strophanthus
    // all act this way, and their leaves vary far more than a tablet.
    pk: { F: 0.7, ka: 1, half: 40, vd: 6.5, spread: 0.35 },
    effects: [{ on: 'heart', emax: 0.6, ec50: 0.001, hill: 2 }],
    toxic: [
      { at: 0.002, sign: 'digitalis_gi', text: 'nausea, vomiting, yellow-green vision (cardiac glycoside excess)', harm: 0.03 },
      { at: 0.0035, sign: 'digitalis_arrhythmia', text: 'slow, irregular pulse (cardiac glycoside poisoning)', harm: 0.4 },
    ],
    lowPotassiumWorse: true,
    cautions: ['A narrow margin and a long half-life: a mistake takes days to wear off.', 'Oleander and lily of the valley have killed people, children most often.'],
    ref: 'Goodman & Gilman 13e ch.29; Bandara V et al. Clin Toxicol 2010;48:389 (oleander poisoning); Lanoxin SmPC',
  },

  // ——— strong alkaloids
  {
    id: 'aconitine', name: 'Aconitine-type alkaloids', channel: 'systemic', class: 'poison (no safe dose here)',
    // Aconite roots. Aconitine opens sodium channels: tingling and numbness first, then a heart rhythm
    // that no village clinic can treat. 2 mg of pure alkaloid can kill an adult. Chinese medicine uses
    // only long-boiled, processed root, which destroys much of the alkaloid; raw root poisons.
    pk: { F: 0.6, ka: 2, half: 3, vd: 4, spread: 0.4 },
    toxic: [
      { at: 0.0005, sign: 'aconite_tingle', text: 'tingling and numbness of the mouth and hands, then of the whole body', harm: 0.05 },
      { at: 0.0015, sign: 'aconite_heart', text: 'vomiting, a racing irregular pulse, weakness (aconite poisoning)', harm: 0.6 },
    ],
    cautions: ['There is no antidote and no safe home dose. The traditional "processing" exists because the raw root kills.'],
    ref: 'Chan TYK. Clin Toxicol 2009;47:279; Singhuber J et al. J Ethnopharmacol 2009;126:18',
  },
  {
    id: 'aristolochic', name: 'Aristolochic acids', channel: 'systemic', class: 'kidney poison · carcinogen',
    // Birthworts (Aristolochia, Asarum). The damage is silent and cumulative: interstitial fibrosis
    // ending in kidney failure, and urothelial cancer years later (IARC group 1). Thousands of cases in
    // the Balkans and in Taiwan, and the Belgian slimming-clinic outbreak of 1992.
    pk: { F: 0.5, ka: 1.5, half: 4, vd: 1.5, spread: 0.35 },
    // There is no cumulative-damage model here, so the threshold stands for an ordinary dose of the
    // root and the hazard is spread over the course: roughly one in twenty people who take a week of it
    // end in kidney failure, which is about what the Belgian outbreak showed (105 of ~1800 exposed).
    toxic: [{ at: 0.008, sign: 'aa_kidney', text: 'passing little urine, swollen and sick (the kidneys failing)', harm: 0.1, calibrated: true }],
    note: 'The worst of the herbal harms: it feels like nothing at the time. Most of the damage shows months or years later as kidney failure or bladder cancer.',
    cautions: ['No dose is safe. Banned from medicine in most countries.', 'Often taken by mistake: several Chinese and Indian herbs share a name or a look with birthwort.'],
    ref: 'Debelle FD, Vanherweghem J-L, Nortier JL. Kidney Int 2008;74:158; Grollman AP et al. PNAS 2007;104:12129; IARC Monographs vol.100A',
  },
  {
    id: 'pyrrolizidine', name: 'Pyrrolizidine alkaloids', channel: 'systemic', class: 'liver poison',
    // Comfrey, ragwort, heliotrope, borage, coltsfoot. The liver turns them into pyrroles that block the
    // small hepatic veins (sinusoidal obstruction syndrome): a big tender liver, fluid in the belly,
    // sometimes death. Outbreaks have come from contaminated grain and from herbal teas; unborn and
    // breastfed babies are hit hardest.
    pk: { F: 0.5, ka: 1.5, half: 5, vd: 1.2, spread: 0.4 },
    // Again no cumulative model: the threshold sits where it takes several strong cups a day, or a
    // tincture, to reach — a single cup of comfrey tea does not close the hepatic veins.
    toxic: [{ at: 0.02, sign: 'pa_liver', text: 'a swollen tender belly, yellow eyes, dark urine (the liver veins blocking)', harm: 0.15, calibrated: true }],
    note: 'Damage adds up over weeks of tea. Comfrey on unbroken skin is a different matter from comfrey drunk.',
    cautions: ['Never by mouth in pregnancy or for a nursing mother or a baby.', 'There is no treatment once the liver veins close.'],
    ref: 'EMA public statement on pyrrolizidine alkaloids, 2014 (EMA/HMPC/893108/2011); Chen Z, Huo JR. Neth J Med 2010;68:252; WHO/IPCS EHC 80',
  },
  {
    id: 'ephedrine', name: 'Ephedrine alkaloids', channel: 'systemic', class: 'stimulant · bronchodilator',
    // Ma huang. A real bronchodilator and decongestant, but this clinic has no asthma model yet, so no
    // benefit is claimed here — only the harm that sent it off the shelves: raised blood pressure,
    // palpitations, stroke and heart attack in young people.
    pk: { F: 0.85, ka: 1.5, half: 5, vd: 3, spread: 0.3 },
    toxic: [
      { at: 0.08, sign: 'ephedra_jitter', text: 'pounding heart, trembling, cannot sleep, headache', harm: 0.02 },
      { at: 0.3, sign: 'ephedra_bp', text: 'a crushing headache with a racing heart (dangerous blood pressure)', harm: 0.15 },
    ],
    cautions: ['Not for anyone with high blood pressure or heart disease, and not with the heart herbs.'],
    ref: 'Haller CA, Benowitz NL. N Engl J Med 2000;343:1833; Shekelle PG et al. JAMA 2003;289:1537; Goodman & Gilman 13e ch.12',
  },
  {
    id: 'caffeine', name: 'Caffeine and methylxanthines', channel: 'systemic', class: 'stimulant · pain adjuvant',
    // F ~1, t½ ~5 h in adults (far longer in newborns), Vd ~0.6 L/kg: 200 mg gives a peak of ~4 mg/L.
    // calibrated: 100–130 mg added to a simple analgesic helps a small extra fraction of people
    // (Cochrane 2014) — a small Emax, not a painkiller on its own.
    pk: { F: 1, ka: 2, half: 5, vd: 0.6, spread: 0.3 },
    effects: [{ on: 'pain', emax: 0.12, ec50: 4, hill: 1.2, calibrated: true }],
    toxic: [
      { at: 25, sign: 'caffeine_jitter', text: 'trembling, vomiting, a racing heart (too much caffeine)', harm: 0.02 },
      { at: 80, sign: 'caffeine_toxic', text: 'fits and a wild pulse (caffeine poisoning)', harm: 0.3 },
    ],
    cautions: ['Coffee, tea, kola, cocoa, guarana — easy to take far too much of as a powder or a strong extract.'],
    ref: 'Derry CJ et al. Cochrane 2014;CD009281; Benowitz NL. Annu Rev Med 1990;41:277',
  },

  // ——— slow poisons and irritants
  {
    id: 'cyanogenic', name: 'Cyanogenic glycosides', channel: 'systemic', class: 'cyanide poison',
    // Bitter almond, apricot kernels, cassava, some stone fruits. Gut enzymes and flora split the
    // glycoside and release hydrogen cyanide: ~6% of the glycoside's weight. F below stands for that
    // conversion, so the concentration here is cyanide, not the glycoside. Blood cyanide above ~0.5
    // mg/L is symptomatic, ~2.5–3 mg/L lethal.
    pk: { F: 0.06, ka: 0.8, half: 1.2, vd: 1.5, spread: 0.4 },
    toxic: [
      { at: 0.5, sign: 'cyanide_early', text: 'headache, dizziness, breathlessness and a smell of bitter almonds', harm: 0.08 },
      { at: 2, sign: 'cyanide_severe', text: 'gasping, fits, collapse (cyanide poisoning)', harm: 0.8 },
    ],
    note: 'Soaking, fermenting and long cooking drive most of it off — that is why cassava is processed. Raw bitter roots and kernels poison, children first.',
    cautions: ['A handful of bitter apricot kernels has killed children.', 'Badly processed bitter cassava causes both sudden poisoning and crippling nerve disease.'],
    ref: 'EFSA CONTAM Panel. EFSA J 2016;14:4424 (cyanogenic glycosides in apricot kernels); WHO/FAO 2012, konzo and cassava; Goodman & Gilman 13e ch.68',
  },
  {
    id: 'thujone', name: 'Thujone', channel: 'systemic', class: 'nerve poison',
    // Wormwood, sage, tansy, white cedar. A GABA-A antagonist: at high doses, fits. The regulatory limit
    // is 0.5 mg/kg body weight a day, which is where the first threshold sits in this model.
    pk: { F: 0.7, ka: 1.5, half: 5, vd: 2, spread: 0.35 },
    toxic: [
      { at: 0.4, sign: 'thujone_restless', text: 'restless, giddy, vomiting', harm: 0.03 },
      { at: 1.5, sign: 'thujone_fits', text: 'fits (thujone poisoning)', harm: 0.3 },
    ],
    note: 'No benefit of its own. Wormwood tea for worms and fever is an old use with a thin margin.',
    cautions: ['Not in pregnancy. Not for anyone who has had fits.'],
    ref: 'EMA public statement on thujone, 2012 (EMA/HMPC/732886/2010); Lachenmeier DW, Uebelacker M. Forensic Sci Int 2010;200:1',
  },
  {
    id: 'coumarin', name: 'Coumarin', channel: 'systemic', class: 'liver (no benefit)',
    // Sweet woodruff, tonka bean, cassia cinnamon. Coumarin itself does not thin blood (that is
    // dicoumarol, made by mould in spoiled hay). A small share of people get a reversible hepatitis;
    // the tolerable daily intake is 0.1 mg/kg body weight.
    pk: { F: 0.9, ka: 2, half: 1.5, vd: 0.8, spread: 0.4 },
    toxic: [{ at: 3, sign: 'coumarin_liver', text: 'sick, no appetite, yellow eyes (liver upset)', harm: 0.05 }],
    note: 'Smells of new-mown hay and vanilla. Pleasant, and of no medicinal use.',
    ref: 'EFSA AFC Panel. EFSA J 2004;104:1 (coumarin); Abraham K et al. Mol Nutr Food Res 2010;54:228',
  },
  {
    id: 'glycyrrhizin', name: 'Glycyrrhizin (licorice)', channel: 'gut', class: 'demulcent · cough',
    // Soothes a sore throat and a dry cough a little. Its real sting is slow: glycyrrhetinic acid blocks
    // 11β-HSD2, so the body behaves as if flooded with aldosterone — potassium falls, blood pressure
    // rises, and digitalis poisoning gets easier. 100 mg a day for weeks is enough in sensitive people.
    gut: { duration: 8, effects: [{ on: 'cough', per: 0.2, perMg: 1 / 400 }] },
    note: 'Licorice root. Weeks of daily licorice raise the blood pressure and drop the potassium: weakness, cramps, swollen ankles.',
    cautions: ['Not in pregnancy, high blood pressure or heart failure.', 'With foxglove or any heart herb, the low potassium makes poisoning likelier.'],
    ref: 'EMA/HMPC assessment report on Liquiritiae radix, 2013; Omar HR et al. Ther Adv Endocrinol Metab 2012;3:125',
  },

  // ——— essential-oil antiseptics and counter-irritants
  {
    id: 'thymol', name: 'Thymol and carvacrol', channel: 'topical', class: 'antiseptic',
    // Thyme and oregano oils kill bacteria on contact in the laboratory, and thymol has been a wound and
    // mouth antiseptic for a century. Clinical trials on wounds are poor, so the effect here is small.
    topical: { on: 'wound', infect: 0.25, perApply: 1 },
    cautions: ['Undiluted oil burns the skin and must never be swallowed, least of all by a child.'],
    ref: 'Marchese A et al. Food Chem 2016;210:402; ESCOP monograph Thymi herba',
  },
  {
    id: 'eugenol', name: 'Eugenol (clove)', channel: 'topical', class: 'antiseptic · local anaesthetic',
    // Clove oil on a toothache is one of the oldest remedies that works at all: eugenol is a weak local
    // anaesthetic and antiseptic. On a wound, little more than mild antisepsis.
    topical: { on: 'wound', infect: 0.2, perApply: 1 },
    note: 'A drop on a cotton wool plug against an aching tooth is the use that survives.',
    cautions: ['Swallowed clove oil has caused liver failure and fits in small children.'],
    ref: 'EMA/HMPC assessment report on Caryophylli floris aetheroleum, 2011; Hartnoll G et al. Lancet 1993;341:1186',
  },
  {
    id: 'menthol', name: 'Menthol', channel: 'topical', class: 'feels clearer (no real decongestion)',
    // Menthol on cold receptors makes the nose feel open while measured airflow barely changes. Honest
    // bookkeeping: a small comfort, not a decongestant.
    topical: { on: 'congestion', relief: 0.15, perApply: 1 },
    cautions: ['Menthol or camphor rubs under a baby\'s nose can stop the breathing: never on infants.'],
    ref: 'Eccles R. J Pharm Pharmacol 1994;46:618; Kenia P et al. Arch Dis Child 2008;93:701',
  },

  // ——— non-plant materia medica (content/materia.js). Imported, never found in the valley.
  {
    id: 'mercury_sulfide', name: 'Cinnabar (mercuric sulfide)', channel: 'systemic', class: 'heavy-metal poison',
    // Cinnabar (zhu sha) is mercury sulfide: barely soluble, so most of a dose passes through — but some
    // is absorbed, and mercury leaves the brain and kidneys slowly (t½ ~60 days). Repeated courses have
    // caused kidney damage, tremor and nerve damage. There is no condition it treats.
    // F is tiny because mercuric sulfide hardly dissolves: a fraction of a percent of a dose is taken
    // up. That is why people survive it at all, and why the harm comes from months of pills.
    pk: { F: 0.002, ka: 0.3, half: 1400, vd: 0.5, spread: 0.5 },
    toxic: [
      { at: 0.03, sign: 'mercury_early', text: 'metal taste, sore gums, trembling hands, pins and needles', harm: 0.03 },
      { at: 0.1, sign: 'mercury_severe', text: 'shaking, confusion, passing little urine (mercury poisoning)', harm: 0.3 },
    ],
    note: 'Used in some traditional pills as a sedative. It has no proven effect and the mercury accumulates.',
    cautions: ['Heated, cinnabar releases mercury vapour, which is far worse than swallowing it.'],
    ref: 'Liu J et al. J Ethnopharmacol 2008;119:3; WHO Guidance on mercury in traditional medicines, 2017; Goodman & Gilman 13e ch.69',
  },
  {
    id: 'arsenic_sulfide', name: 'Realgar (arsenic sulfide)', channel: 'systemic', class: 'heavy-metal poison',
    // Realgar (xiong huang) is arsenic disulfide. Little dissolves, but what does is arsenic: vomiting
    // and diarrhoea acutely, then skin changes, nerve damage and cancer with long use. Arsenic trioxide
    // does treat one rare leukaemia — in a hospital, by drip, nothing like this.
    // Realgar is also poorly soluble (F ~1%), so a pinch gives the early signs and a spoonful is a
    // lethal dose of arsenic.
    pk: { F: 0.01, ka: 0.5, half: 60, vd: 0.2, spread: 0.5 },
    toxic: [
      { at: 0.02, sign: 'arsenic_early', text: 'burning mouth, vomiting, watery stools, garlic breath', harm: 0.05 },
      { at: 0.06, sign: 'arsenic_severe', text: 'rice-water stools, collapse, the heart failing (arsenic poisoning)', harm: 0.5 },
    ],
    cautions: ['No safe dose by mouth. Long use causes dark and thickened skin, nerve damage and cancer.'],
    ref: 'Liu J et al. J Ethnopharmacol 2008;119:3; IARC Monographs vol.100C (arsenic); WHO fact sheet on arsenic, 2022',
  },
  {
    id: 'antler_protein', name: 'Deer antler velvet (collagen, growth factors)', channel: 'gut', class: 'no measurable effect',
    // Staghorn / lu rong. Sold as a tonic for weakness, ageing and joints. Controlled trials of velvet
    // antler in strength, endurance and osteoarthritis found no benefit over placebo. Modelled honestly:
    // nothing happens. The antler is also among the most adulterated goods in the trade.
    gut: { duration: 24, effects: [] },
    note: 'Ground antler is collagen and minerals. Trials show no effect; what is sold is often cattle bone or gelatine.',
    ref: 'Sleivert G et al. Int J Sport Nutr Exerc Metab 2003;13:251; Moreau M et al. Can Vet J 2004;45:133; Wu F et al. J Ethnopharmacol 2013;145:403',
  },
];

// Shown text translates on read (i18n.js); the Korean lives in i18n/ko/actives.js. `ref` is a citation (cite()).
localize(FLORA_ACTIVES, ['name', 'class', 'toxic[].text', 'idio[].text', 'dependence.text', 'cautions[]', 'note']);
