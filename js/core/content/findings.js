// findings.js — what you can learn about a patient, and how. History questions (ask), examination
// (look / feel / listen / count) and measurements that need a tool. Each costs game minutes. The
// values come from the patient's real state (signs.js); this table says how to get at them.
import { localize } from '../i18n.js';

// One topic per question, grouped as a history is taken. The answer gives what is there; if nothing is, the first
// finding's "no". `only` limits a question to who could answer it (a woman, a baby's mother), never to a diagnosis.
const woman = (p) => p.sex === 'f' && p.age >= 13 && p.age < 50, baby = (p) => p.age < 0.25, adult = (p) => p.age >= 13;
const back = (p) => p.visits.length > 0;
export const QUESTIONS = [
  // ——— since the last visit
  { id: 'q_better', group: 'Since last time', label: 'Is it better or worse since you were here?', min: 1, reveals: ['better'], only: back },
  { id: 'q_doses', group: 'Since last time', label: 'Did you take all the medicine? Any doses missed?', min: 2, reveals: ['doses'], only: back },
  { id: 'q_side', group: 'Since last time', label: 'Any trouble from the medicine?', min: 1, reveals: ['tox_symptoms'], only: back },
  { id: 'q_kept', group: 'Since last time', label: 'Could you do what I advised?', min: 1, reveals: ['advice_kept'], only: back },
  // ——— the story: an open question; what they tell is filled per patient (encounter.js storyOf)
  { id: 'q_story', group: 'The story', label: 'Tell me about it from the start.', min: 3, reveals: [] },
  { id: 'q_duration', group: 'The story', label: 'How long has this been going on?', min: 1, reveals: ['duration'] },
  // ——— fever
  { id: 'q_fever', group: 'Fever', label: 'Any fever? Does it come and go?', min: 1, reveals: ['fever_hx', 'fever_pattern', 'fever_rising'] },
  { id: 'q_chills', group: 'Fever', label: 'Shaking chills?', min: 1, reveals: ['chills'] },
  { id: 'q_sweats', group: 'Fever', label: 'Sweats at night?', min: 1, reveals: ['night_sweats'] },
  // ——— head and senses
  { id: 'q_headache', group: 'Head, eyes, ears', label: 'Headache?', min: 1, reveals: ['headache'] },
  { id: 'q_eyes', group: 'Head, eyes, ears', label: 'Any trouble with the eyes or the sight?', min: 1, reveals: ['eyes_hx', 'vision', 'yellow_vision'] },
  { id: 'q_ears', group: 'Head, eyes, ears', label: 'Ear pain?', min: 1, reveals: ['ear_pain'] },
  { id: 'q_throat', group: 'Head, eyes, ears', label: 'Sore throat? Does it hurt to swallow?', min: 1, reveals: ['throat'] },
  { id: 'q_nose', group: 'Head, eyes, ears', label: 'Runny or blocked nose?', min: 1, reveals: ['runny'] },
  { id: 'q_fits', group: 'Head, eyes, ears', label: 'Any fits: falling, stiffening, jerking, not answering?', min: 1, reveals: ['fits_hx'] },
  { id: 'q_weak', group: 'Head, eyes, ears', label: 'Did weakness or trouble speaking come suddenly?', min: 1, reveals: ['stroke_hx'] },
  // ——— chest
  { id: 'q_cough', group: 'Chest', label: 'Cough? Worse at night?', min: 1, reveals: ['cough', 'night_cough'] },
  { id: 'q_spit', group: 'Chest', label: 'Any blood in the spit?', min: 1, reveals: ['blood_sputum'] },
  { id: 'q_breath', group: 'Chest', label: 'Hard to breathe? Walking, or lying flat?', min: 1, reveals: ['breath_hx', 'breathless_walk', 'orthopnea'] },
  { id: 'q_attacks', group: 'Chest', label: 'Attacks like this before? What brings them on?', min: 1, reveals: ['attacks'] },
  // ——— belly
  { id: 'q_stool', group: 'Belly and stools', label: 'Loose stools? How many, what do they look like?', min: 2, reveals: ['stools', 'blood_stool', 'stool_frothy', 'stool_on_off', 'pale_stool', 'black_stool', 'constipation'] },
  { id: 'q_worms', group: 'Belly and stools', label: 'Any worms seen?', min: 1, reveals: ['worms_seen'] },
  { id: 'q_vomit', group: 'Belly and stools', label: 'Vomiting? Can drinks stay down?', min: 1, reveals: ['vomiting', 'drinking'] },
  { id: 'q_belly', group: 'Belly and stools', label: 'Belly swollen with gas? Burping?', min: 1, reveals: ['bloating', 'burps'] },
  { id: 'q_stomach', group: 'Belly and stools', label: 'Burning in the pit of the stomach?', min: 1, reveals: ['epigastric'] },
  { id: 'q_eat', group: 'Belly and stools', label: 'Eating? Losing weight?', min: 1, reveals: ['appetite', 'weight_loss'] },
  // ——— urine and private parts
  { id: 'q_urine', group: 'Urine and private parts', label: 'Passing urine: how much, what colour?', min: 1, reveals: ['urine', 'cloudy_urine'] },
  { id: 'q_burn', group: 'Urine and private parts', label: 'Does it burn to pass urine? Going often?', min: 1, reveals: ['dysuria', 'frequency'] },
  { id: 'q_thirst', group: 'Urine and private parts', label: 'Very thirsty? Passing much urine? Always hungry?', min: 1, reveals: ['thirst', 'polyuria', 'hunger'] },
  { id: 'q_private', group: 'Urine and private parts', label: 'Any discharge or sores in the private parts?', min: 2, reveals: ['discharge', 'genital_sore'], only: adult },
  { id: 'q_partner', group: 'Urine and private parts', label: 'Does your partner have the same trouble?', min: 1, reveals: ['partner_sx'], only: adult },
  // ——— skin
  { id: 'q_rash', group: 'Skin', label: 'Any rash, spots, blisters or sores? Where did it start?', min: 1, reveals: ['rash_hx'] },
  { id: 'q_itch', group: 'Skin', label: 'Does anything itch? Where, and when is it worst?', min: 1, reveals: ['itch'] },
  { id: 'q_numb', group: 'Skin', label: 'Any patches without feeling? Numb hands or feet?', min: 1, reveals: ['numb_hands'] },
  // ——— pain, swelling, injuries
  { id: 'q_pain', group: 'Pain and swelling', label: 'Where is the pain? What makes it worse?', min: 1, reveals: ['pain_site', 'cramp', 'pelvic_pain'] },
  { id: 'q_swelling', group: 'Pain and swelling', label: 'Any swelling or lump? Where?', min: 1, reveals: ['swelling_hx'] },
  { id: 'q_injury', group: 'Pain and swelling', label: 'How did it happen? Was it cleaned?', min: 1, reveals: ['injury_how'] },
  { id: 'q_bite', group: 'Pain and swelling', label: 'Bitten or stung by anything?', min: 1, reveals: ['bite_hx'] },
  { id: 'q_swallow', group: 'Pain and swelling', label: 'Swallowed kerosene, medicine or poison?', min: 1, reveals: ['swallowed'] },
  // ——— women
  { id: 'q_preg', group: 'Pregnancy and birth', label: 'Could you be pregnant? When was your last monthly bleeding?', min: 1, reveals: ['pregnancy', 'nausea_preg'], only: woman },
  { id: 'q_birth', group: 'Pregnancy and birth', label: 'A birth lately? Labour pains now?', min: 1, reveals: ['postpartum', 'labour_hx'], all: true, only: woman },
  { id: 'q_bleed', group: 'Pregnancy and birth', label: 'Any bleeding from the birth opening?', min: 1, reveals: ['bleeding_pv'], only: woman },
  { id: 'q_tt', group: 'Pregnancy and birth', label: 'Have you had tetanus injections, in this pregnancy or before?', min: 1, reveals: ['tt_hx'], only: woman },
  // ——— children
  { id: 'q_suck', group: 'The child', label: 'Does the baby suck well?', min: 1, reveals: ['suck'], only: baby },
  { id: 'q_food', group: 'The child', label: 'What does the child eat, how often? Still breastfed?', min: 2, reveals: ['diet_hx'], only: (p) => p.age < 6 },
  { id: 'q_pica', group: 'The child', label: 'Does the child eat earth or clay?', min: 1, reveals: ['pica'], only: (p) => p.age >= 1 && p.age < 13 },
  // ——— background
  { id: 'q_tired', group: 'Background', label: 'Tired all the time? No strength?', min: 1, reveals: ['fatigue'] },
  { id: 'q_meds', group: 'Background', label: 'Any medicines or remedies taken already?', min: 1, reveals: ['meds_taken', 'tox_symptoms'], all: true, only: (p) => !back(p) },
  { id: 'q_herb', group: 'Background', label: 'Show me the plant you have been giving.', min: 1, reveals: ['herb_seen'], only: (p) => p.rx.some((r) => r.home) },
  { id: 'q_allergy', group: 'Background', label: 'Has any medicine ever given you a rash or swelling?', min: 1, reveals: ['allergy_hx'] },
  { id: 'q_vax', group: 'Background', label: 'Had the tetanus injections?', min: 1, reveals: ['tetanus_vax', 'tetanus_cord'] },
  { id: 'q_family', group: 'Background', label: 'Anyone at home with the same?', min: 1, reveals: ['family_hx'] },
];

export const EXAMS = [
  { id: 'x_general', label: 'Look: general condition', min: 1, reveals: ['alert', 'pallor', 'thin', 'flushed'] },
  { id: 'x_eyes', label: 'Look: eyes and mouth', min: 1, reveals: ['sunken_eyes', 'dry_mouth', 'tears', 'pupils', 'yellow_vision', 'red_eyes', 'ptosis', 'breath_smell', 'jaundice', 'follicles', 'eye_scratch'] },
  { id: 'x_throat', label: 'Look in the throat and mouth (say "aah")', min: 1, reveals: ['tonsils', 'koplik', 'lockjaw', 'thrush'] },
  { id: 'x_ears', label: 'Look in and behind the ears', min: 1, reveals: ['ear_pus', 'mastoid'] },
  { id: 'x_neck', label: 'Feel the neck glands', min: 1, reveals: ['neck_glands', 'goitre', 'parotid'] },
  { id: 'x_pinch', label: 'Skin pinch on the belly', min: 1, reveals: ['skin_pinch'] },
  { id: 'x_fontanel', label: 'Feel the soft spot (baby)', min: 1, reveals: ['fontanel'], only: (p) => p.age < 1.5 },
  { id: 'x_forehead', label: 'Feel the forehead', min: 0.5, reveals: ['feels_hot'] },
  { id: 'x_thermo', label: 'Take the temperature', min: 3, tool: 'thermometer', reveals: ['temp'] },
  { id: 'x_rr', label: 'Count breaths for a minute', min: 1, tool: 'watch', reveals: ['rr'] },
  { id: 'x_pulse', label: 'Count the pulse for a minute', min: 1, tool: 'watch', reveals: ['hr', 'pulse_regular'] },
  { id: 'x_chest', label: 'Look at the chest breathing', min: 1, reveals: ['indrawing', 'grunting'] },
  { id: 'x_listen', label: 'Listen to the chest', min: 2, reveals: ['crackles', 'wheeze'], better: 'stethoscope' },
  { id: 'x_belly', label: 'Feel the belly', min: 2, reveals: ['spleen', 'tender', 'pot_belly', 'suprapubic', 'rose_spots', 'bloating', 'liver_tender', 'pelvic_pain'] },
  { id: 'x_skin', label: 'Look at the skin (hands, wrists, waist)', min: 2, reveals: ['burrows', 'skin_sores', 'rash', 'measles_rash', 'hair', 'skin_patches', 'skin_patch', 'nodules', 'petechiae', 'syph_rash', 'crusts', 'red_patch', 'rings', 'pox'], better: 'magnifier' },
  { id: 'x_wound', label: 'Examine the wound / burn', min: 2, reveals: ['wound_size', 'pus', 'redness', 'red_streaks', 'glands', 'burn_area', 'blisters', 'burn_deep'] },
  { id: 'x_feet', label: 'Press on the feet and shins', min: 1, reveals: ['edema', 'foot_numb'] },
  { id: 'x_joints', label: 'Look at and feel the joints', min: 1, reveals: ['joints'] },
  { id: 'x_weigh', label: 'Weigh', min: 2, tool: 'scale', reveals: ['weight'] },
  { id: 'x_muac', label: 'Arm circumference tape', min: 1, tool: 'muac_tape', reveals: ['muac'], only: (p) => p.age >= 0.5 && p.age < 5 },
  { id: 'x_bp', label: 'Blood pressure', min: 3, tool: 'bp_cuff', reveals: ['bp'] },
  { id: 'x_back', label: 'Examine the back, bend and lift; tap over the kidneys', min: 2, reveals: ['back_exam', 'loin_pain'] },
  // ——— chronic illness and emergencies (WTND pp.37, 98–106, 127)
  { id: 'x_strength', label: 'Test strength of arms and legs, the smile and the speech', min: 2, reveals: ['weak_side', 'face_droop', 'speech'] },
  { id: 'x_urine_taste', label: 'Taste the urine for sugar (and have two others taste)', min: 3, reveals: ['urine_sugar'] },
  { id: 'x_limb', label: 'Look at and gently feel the hurt limb', min: 1, reveals: ['deformity', 'swollen_joint'] },
  { id: 'x_bite', label: 'Look at the bite or sting', min: 1, reveals: ['fang_marks', 'sting_mark', 'local_swelling', 'bleeding', 'sting_systemic'] },
  // ——— infections (WTND chapters 13–18, 21)
  { id: 'x_stiffneck', label: 'Bend the head forward to the chest (stiff neck?)', min: 1, reveals: ['stiff_neck', 'spasms'] },
  { id: 'x_reflex', label: 'Tap just below the kneecap (knee jerk)', min: 1, reveals: ['knee_jerk'] },
  { id: 'x_feeling', label: 'Test feeling in the patches with a wisp of cotton; feel the nerves', min: 2, reveals: ['skin_patch', 'patch_feeling', 'thick_nerves', 'claw'] },
  { id: 'x_genitals', label: 'Look at the private parts and groin (with permission)', min: 2, reveals: ['discharge', 'genital_sore', 'bubo', 'pelvic_pain'], only: (p) => p.age >= 13 },
];

/** How strongly each finding points toward each condition (for the differential helper). */
export const POINTS = {
  stools: { watery_diarrhea: 3, dysentery: 2, cholera: 3 }, blood_stool: { dysentery: 6, amoebiasis: 4 }, worms_seen: { ascaris: 6, pinworm: 3 },
  vomiting: { watery_diarrhea: 1, malaria: 1, nausea_pregnancy: 3 }, sunken_eyes: { watery_diarrhea: 2 }, skin_pinch: { watery_diarrhea: 2 },
  fever_hx: { malaria: 2, pneumonia: 2, dysentery: 1, typhoid: 2, measles: 1 }, chills: { malaria: 3 }, fever_pattern: { malaria: 4 }, headache: { malaria: 1, pre_eclampsia: 2, typhoid: 2, meningitis: 2 },
  temp: { malaria: 2, pneumonia: 2, dysentery: 1, typhoid: 2, measles: 1, strep_throat: 1 }, feels_hot: { malaria: 1, pneumonia: 1 },
  cough: { common_cold: 2, cough_child: 3, pneumonia: 2, measles: 1, tb: 2 }, night_cough: { cough_child: 3 }, runny: { common_cold: 4, measles: 1 }, throat: { common_cold: 2, strep_throat: 3 },
  rr: { pneumonia: 4 }, indrawing: { pneumonia: 5 }, grunting: { pneumonia: 4 }, crackles: { pneumonia: 3, heart_failure: 2 },
  spleen: { malaria: 3 }, pallor: { malaria: 2, hookworm: 3 }, burrows: { scabies: 6 },
  pot_belly: { ascaris: 3 }, wound_size: { wound_minor: 3, wound_infected: 1 }, pus: { wound_infected: 5 }, redness: { wound_infected: 2 }, red_streaks: { wound_infected: 4 },
  burn_area: { burn_minor: 6 }, blisters: { burn_minor: 3 }, pain_site: { back_pain: 2 }, back_exam: { back_pain: 4 },
  edema: { heart_failure: 3, pre_eclampsia: 3 }, orthopnea: { heart_failure: 5 }, breathless_walk: { heart_failure: 3 },
  pregnancy: { nausea_pregnancy: 3, pre_eclampsia: 2 }, nausea_preg: { nausea_pregnancy: 5 }, vision: { pre_eclampsia: 4 }, bp: { pre_eclampsia: 6, heart_failure: 1 },
  cramp: { dysentery: 1, watery_diarrhea: 1, amoebiasis: 1 },
  dysuria: { uti: 6, gonorrhoea: 3, chlamydia: 1, trichomonas: 1 }, frequency: { uti: 3 }, cloudy_urine: { uti: 3 }, suprapubic: { uti: 3 }, loin_pain: { pyelonephritis: 6, uti: 1 },
  joints: { rheumatic_fever: 7 }, mastoid: { mastoiditis: 9 },
  ear_pain: { ear_infection: 5 }, ear_pus: { ear_infection: 6 }, tonsils: { strep_throat: 6 }, neck_glands: { strep_throat: 3, ear_infection: 1, tb_nodes: 5, hiv: 2 },
  fever_rising: { typhoid: 5 }, constipation: { typhoid: 2 }, rose_spots: { typhoid: 5 }, tender: { typhoid: 1, dysentery: 1, amoebiasis: 1 },
  stool_frothy: { giardia: 5 }, stool_on_off: { amoebiasis: 6 }, bloating: { giardia: 3 }, burps: { giardia: 4 },
  pica: { hookworm: 4 }, fatigue: { hookworm: 2 },
  measles_rash: { measles: 6 }, rash_hx: { measles: 3 }, koplik: { measles: 7 }, red_eyes: { measles: 3, conjunctivitis: 4, trachoma: 2, eye_injury: 2 },
  // ——— infections (WTND chapters 13–18, 21)
  night_sweats: { tb: 4, hiv: 2, tb_nodes: 1 }, blood_sputum: { tb: 6 }, weight_loss: { tb: 2, hiv: 3, tb_nodes: 1 }, thin: { tb: 1, hiv: 1 },
  skin_patch: { leprosy: 4 }, patch_feeling: { leprosy: 8 }, thick_nerves: { leprosy: 7 }, numb_hands: { leprosy: 4 }, claw: { leprosy: 4 }, nodules: { leprosy: 4 },
  lockjaw: { tetanus: 9 }, spasms: { tetanus: 8 }, stiff_neck: { meningitis: 7, tetanus: 3 }, knee_jerk: { tetanus: 3, meningitis: 1 }, tetanus_cord: { tetanus: 8 }, tetanus_vax: { tetanus: 1 },
  petechiae: { meningitis: 5 }, jaundice: { hepatitis: 7 }, pale_stool: { hepatitis: 4 }, liver_tender: { hepatitis: 3 },
  discharge: { gonorrhoea: 5, chlamydia: 3, trichomonas: 5, pid: 2 }, genital_sore: { syphilis: 5, chancroid: 5 }, bubo: { chancroid: 5 }, syph_rash: { syphilis: 6 },
  partner_sx: { gonorrhoea: 2, chlamydia: 2, trichomonas: 2, syphilis: 1, chancroid: 1 }, pelvic_pain: { pid: 7 }, thrush: { hiv: 5 },
  crusts: { impetigo: 8 }, red_patch: { cellulitis: 8 }, rings: { tinea: 8 }, follicles: { trachoma: 8 }, eye_scratch: { eye_injury: 8 }, pox: { chickenpox: 8 }, parotid: { mumps: 8 },
};

// what the patient tells of, across illnesses (signs.js HISTORY): where it itches, swells, hurts says more than whether
Object.assign(POINTS, {
  itch: { scabies: 3, pinworm: 3, chickenpox: 1, tinea: 1, impetigo: 1, trichomonas: 1 },
  rash_hx: { measles: 3, chickenpox: 2, impetigo: 2, tinea: 2, scabies: 1, syphilis: 2, leprosy: 2, cellulitis: 2, kwashiorkor: 1 },
  eyes_hx: { conjunctivitis: 4, trachoma: 3, eye_injury: 4, measles: 2, hepatitis: 4, newborn_jaundice: 4 },
  swelling_hx: { goitre: 3, mumps: 3, tb_nodes: 3, heart_failure: 2, pre_eclampsia: 4, kwashiorkor: 2, mastoiditis: 3, fracture: 2, sprain: 2, mastitis: 3, cellulitis: 2, rheumatic_fever: 2, snakebite: 2, chancroid: 2, wound_infected: 2 },
  breath_hx: { pneumonia: 3, asthma: 4, heart_failure: 2, anaemia: 1, hookworm: 1, kerosene: 2 },
  family_hx: { scabies: 3, impetigo: 1, conjunctivitis: 1, tinea: 1, measles: 1, chickenpox: 1, mumps: 1 },
});
// ——— chronic illness and emergencies (WTND chapters 10, 11, 13, 22)
Object.assign(POINTS, {
  wheeze: { asthma: 6 }, attacks: { asthma: 4 }, fits_hx: { epilepsy: 4, febrile_fits: 4 }, weak_side: { stroke: 8 }, face_droop: { stroke: 4 }, speech: { stroke: 3 }, stroke_hx: { stroke: 3 },
  polyuria: { diabetes: 5 }, hunger: { diabetes: 2 }, urine_sugar: { diabetes: 8 }, foot_numb: { diabetes: 2 }, goitre: { goitre: 9 }, epigastric: { ulcer: 6 }, black_stool: { ulcer: 3 },
  hair: { kwashiorkor: 3, marasmus: 2 }, skin_patches: { kwashiorkor: 5 }, diet_hx: { marasmus: 2, kwashiorkor: 2 }, muac: { marasmus: 5, kwashiorkor: 2 }, thin: { marasmus: 3 },
  bite_hx: { snakebite: 3, scorpion_sting: 3 }, fang_marks: { snakebite: 7 }, sting_mark: { scorpion_sting: 7 }, local_swelling: { snakebite: 2 }, bleeding: { snakebite: 3 }, ptosis: { snakebite: 3 },
  sting_systemic: { scorpion_sting: 3 }, swallowed: { kerosene: 8 }, breath_smell: { kerosene: 4 }, deformity: { fracture: 7 }, swollen_joint: { sprain: 6 },
});
// findings shared with the rows above: add their pull toward the new conditions without rewriting those rows
for (const [f, m] of Object.entries({ bp: { hypertension: 6 }, headache: { hypertension: 1 }, pallor: { anaemia: 4 }, fatigue: { anaemia: 3 }, edema: { kwashiorkor: 4 }, joints: { arthritis: 5 }, rr: { asthma: 1, kerosene: 2 }, temp: { febrile_fits: 1 } })) Object.assign(POINTS[f], m);
// ——— childbirth and the newborn (WTND chapter 19, pp.249–278)
EXAMS.push(
  { id: 'x_womb', label: 'Feel the womb through the belly', min: 2, reveals: ['womb'], only: woman },
  { id: 'x_baby', label: 'Look at the baby: cord stump, skin colour, jaw', min: 1, reveals: ['cord', 'jaundice', 'lockjaw'], only: baby },
  { id: 'x_breast', label: 'Examine the breasts', min: 1, reveals: ['breast'], only: woman },
);
Object.assign(POINTS, {
  labour_hx: { obstructed_labour: 8 }, bleeding_pv: { pph: 5, miscarriage: 4, ectopic: 2 }, pelvic_pain: { ectopic: 4, miscarriage: 2, puerperal_sepsis: 1 },
  womb: { pph: 3, obstructed_labour: 2, ectopic: 4, puerperal_sepsis: 2 }, discharge: { puerperal_sepsis: 7 }, postpartum: { puerperal_sepsis: 2, pph: 2, mastitis: 1 },
  fits_hx: { eclampsia: 14, newborn_tetanus: 4 }, lockjaw: { newborn_tetanus: 8 }, suck: { newborn_sepsis: 3, newborn_tetanus: 2, cold_baby: 2 },
  cord: { cord_infection: 8, newborn_sepsis: 1 }, jaundice: { newborn_jaundice: 6, newborn_sepsis: 1 }, breast: { mastitis: 9 },
});
// Shown text translates on read (i18n.js); the Korean lives in i18n/ko/items.js.
localize(QUESTIONS, ['group', 'label']);
localize(EXAMS, ['label']);
