// findings.js — what you can learn about a patient, and how. History questions (ask), examination
// (look / feel / listen / count) and measurements that need a tool. Each costs game minutes. The
// values come from the patient's real state (signs.js); this table says how to get at them.

export const QUESTIONS = [
  { id: 'q_duration', label: 'How long has this been going on?', min: 1, reveals: ['duration'] },
  { id: 'q_stool', label: 'Any loose stools? How many, what do they look like?', min: 2, reveals: ['stools', 'blood_stool', 'worms_seen', 'stool_frothy', 'stool_on_off', 'constipation'] },
  { id: 'q_vomit', label: 'Vomiting? Can (s)he keep drinks down?', min: 1, reveals: ['vomiting', 'drinking'] },
  { id: 'q_urine', label: 'Passing urine? What colour? Does it burn?', min: 1, reveals: ['urine', 'thirst', 'dysuria', 'frequency', 'cloudy_urine'] },
  { id: 'q_fever', label: 'Fever? Chills or sweats? Does it come and go?', min: 2, reveals: ['fever_hx', 'chills', 'fever_pattern', 'fever_rising', 'headache'] },
  { id: 'q_cough', label: 'Cough? Worse at night? Runny nose, sore throat?', min: 2, reveals: ['cough', 'night_cough', 'runny', 'throat'] },
  { id: 'q_breath', label: 'Short of breath? Lying flat, walking?', min: 1, reveals: ['breathless_walk', 'orthopnea'] },
  { id: 'q_itch', label: 'Itching? Where, and when is it worst?', min: 1, reveals: ['itch_night', 'itch_family', 'anal_itch'] },
  { id: 'q_pain', label: 'Where does it hurt? Since when, what makes it worse?', min: 2, reveals: ['pain_site', 'cramp', 'ear_pain'] },
  { id: 'q_rash', label: 'Any rash? Where did it start? Are the eyes red?', min: 1, reveals: ['rash_hx', 'red_eyes'] },
  { id: 'q_belly', label: 'Is the belly swollen with gas? Burping?', min: 1, reveals: ['bloating', 'burps'] },
  { id: 'q_tired', label: 'Tired or short of breath? (Children:) does (s)he eat earth?', min: 1, reveals: ['fatigue', 'pica'] },
  { id: 'q_injury', label: 'How did the injury happen? Was it cleaned?', min: 1, reveals: ['injury_how'] },
  { id: 'q_preg', label: 'Could you be pregnant? When was your last monthly bleeding?', min: 1, reveals: ['pregnancy', 'nausea_preg'], only: (p) => p.sex === 'f' && p.age >= 13 && p.age < 50 },
  { id: 'q_vision', label: 'Headache? Blurred vision or spots? Swelling of face/hands?', min: 1, reveals: ['headache', 'vision', 'face_swelling'] },
  { id: 'q_meds', label: 'Any medicines or remedies taken already?', min: 1, reveals: ['meds_taken', 'tox_symptoms'] },
  { id: 'q_allergy', label: 'Has any medicine ever given you a rash or swelling?', min: 1, reveals: ['allergy_hx'] },
  { id: 'q_eat', label: 'Eating? Losing weight?', min: 1, reveals: ['appetite', 'weight_loss'] },
];

export const EXAMS = [
  { id: 'x_general', label: 'Look: general condition', min: 1, reveals: ['alert', 'pallor', 'thin', 'flushed'] },
  { id: 'x_eyes', label: 'Look: eyes and mouth', min: 1, reveals: ['sunken_eyes', 'dry_mouth', 'tears', 'pupils', 'yellow_vision', 'red_eyes'] },
  { id: 'x_throat', label: 'Look in the throat and mouth (say "aah")', min: 1, reveals: ['tonsils', 'koplik'] },
  { id: 'x_ears', label: 'Look in and behind the ears', min: 1, reveals: ['ear_pus', 'mastoid'] },
  { id: 'x_neck', label: 'Feel the neck glands', min: 1, reveals: ['neck_glands'] },
  { id: 'x_pinch', label: 'Skin pinch on the belly', min: 1, reveals: ['skin_pinch'] },
  { id: 'x_fontanel', label: 'Feel the soft spot (baby)', min: 1, reveals: ['fontanel'], only: (p) => p.age < 1.5 },
  { id: 'x_forehead', label: 'Feel the forehead', min: 0.5, reveals: ['feels_hot'] },
  { id: 'x_thermo', label: 'Take the temperature', min: 3, tool: 'thermometer', reveals: ['temp'] },
  { id: 'x_rr', label: 'Count breaths for a minute', min: 1, tool: 'watch', reveals: ['rr'] },
  { id: 'x_pulse', label: 'Count the pulse for a minute', min: 1, tool: 'watch', reveals: ['hr', 'pulse_regular'] },
  { id: 'x_chest', label: 'Look at the chest breathing', min: 1, reveals: ['indrawing', 'grunting'] },
  { id: 'x_listen', label: 'Listen to the chest', min: 2, reveals: ['crackles'], better: 'stethoscope' },
  { id: 'x_belly', label: 'Feel the belly', min: 2, reveals: ['spleen', 'tender', 'pot_belly', 'suprapubic', 'rose_spots', 'bloating'] },
  { id: 'x_skin', label: 'Look at the skin (hands, wrists, waist)', min: 2, reveals: ['burrows', 'skin_sores', 'rash', 'measles_rash'], better: 'magnifier' },
  { id: 'x_wound', label: 'Examine the wound / burn', min: 2, reveals: ['wound_size', 'pus', 'redness', 'red_streaks', 'glands', 'burn_area', 'blisters', 'burn_deep'] },
  { id: 'x_feet', label: 'Press on the feet and shins', min: 1, reveals: ['edema'] },
  { id: 'x_joints', label: 'Look at and feel the joints', min: 1, reveals: ['joints'] },
  { id: 'x_weigh', label: 'Weigh', min: 2, tool: 'scale', reveals: ['weight'] },
  { id: 'x_muac', label: 'Arm circumference tape', min: 1, tool: 'muac_tape', reveals: ['muac'], only: (p) => p.age >= 0.5 && p.age < 5 },
  { id: 'x_bp', label: 'Blood pressure', min: 3, tool: 'bp_cuff', reveals: ['bp'] },
  { id: 'x_back', label: 'Examine the back, bend and lift; tap over the kidneys', min: 2, reveals: ['back_exam', 'loin_pain'] },
];

/** How strongly each finding points toward each condition (for the differential helper). */
export const POINTS = {
  stools: { watery_diarrhea: 3, dysentery: 2 }, blood_stool: { dysentery: 6, amoebiasis: 4 }, worms_seen: { ascaris: 6, pinworm: 3 },
  vomiting: { watery_diarrhea: 1, malaria: 1, nausea_pregnancy: 3 }, sunken_eyes: { watery_diarrhea: 2 }, skin_pinch: { watery_diarrhea: 2 },
  fever_hx: { malaria: 2, pneumonia: 2, dysentery: 1, typhoid: 2, measles: 1 }, chills: { malaria: 3 }, fever_pattern: { malaria: 4 }, headache: { malaria: 1, pre_eclampsia: 2, typhoid: 2 },
  temp: { malaria: 2, pneumonia: 2, dysentery: 1, typhoid: 2, measles: 1, strep_throat: 1 }, feels_hot: { malaria: 1, pneumonia: 1 },
  cough: { common_cold: 2, cough_child: 3, pneumonia: 2, measles: 1 }, night_cough: { cough_child: 3 }, runny: { common_cold: 4, measles: 1 }, throat: { common_cold: 2, strep_throat: 3 },
  rr: { pneumonia: 4 }, indrawing: { pneumonia: 5 }, grunting: { pneumonia: 4 }, crackles: { pneumonia: 3, heart_failure: 2 },
  spleen: { malaria: 3 }, pallor: { malaria: 2, hookworm: 3 }, itch_night: { scabies: 5 }, itch_family: { scabies: 3 }, burrows: { scabies: 6 }, anal_itch: { pinworm: 6 },
  pot_belly: { ascaris: 3 }, wound_size: { wound_minor: 3, wound_infected: 1 }, pus: { wound_infected: 5 }, redness: { wound_infected: 2 }, red_streaks: { wound_infected: 4 },
  burn_area: { burn_minor: 6 }, blisters: { burn_minor: 3 }, pain_site: { back_pain: 2 }, back_exam: { back_pain: 4 },
  edema: { heart_failure: 3, pre_eclampsia: 3 }, orthopnea: { heart_failure: 5 }, breathless_walk: { heart_failure: 3 },
  pregnancy: { nausea_pregnancy: 3, pre_eclampsia: 2 }, nausea_preg: { nausea_pregnancy: 5 }, vision: { pre_eclampsia: 4 }, face_swelling: { pre_eclampsia: 4 }, bp: { pre_eclampsia: 6, heart_failure: 1 },
  cramp: { dysentery: 1, watery_diarrhea: 1, amoebiasis: 1 },
  dysuria: { uti: 6 }, frequency: { uti: 3 }, cloudy_urine: { uti: 3 }, suprapubic: { uti: 3 }, loin_pain: { pyelonephritis: 6, uti: 1 },
  joints: { rheumatic_fever: 7 }, mastoid: { mastoiditis: 9 },
  ear_pain: { ear_infection: 5 }, ear_pus: { ear_infection: 6 }, tonsils: { strep_throat: 6 }, neck_glands: { strep_throat: 3, ear_infection: 1 },
  fever_rising: { typhoid: 5 }, constipation: { typhoid: 2 }, rose_spots: { typhoid: 5 }, tender: { typhoid: 1, dysentery: 1, amoebiasis: 1 },
  stool_frothy: { giardia: 5 }, stool_on_off: { amoebiasis: 6 }, bloating: { giardia: 3 }, burps: { giardia: 4 },
  pica: { hookworm: 4 }, fatigue: { hookworm: 2 },
  measles_rash: { measles: 6 }, rash_hx: { measles: 3 }, koplik: { measles: 7 }, red_eyes: { measles: 3 },
};

// ——— childbirth and the newborn (WTND chapter 19, pp.249–278)
const woman = (p) => p.sex === 'f' && p.age >= 13 && p.age < 50, baby = (p) => p.age < 0.25;
QUESTIONS.push(
  { id: 'q_birth', label: 'Labour, a birth, bleeding? When, how long, how much? Any fits?', min: 2, reveals: ['postpartum', 'labour_hx', 'bleeding_pv', 'pelvic_pain', 'discharge', 'fits_hx'], only: woman },
  { id: 'q_tt', label: 'Have you had tetanus injections, in this pregnancy or before?', min: 1, reveals: ['tt_hx'], only: woman },
  { id: 'q_baby', label: 'Does the baby suck well? Any fits or stiffness? Turning yellow?', min: 1, reveals: ['suck', 'fits_hx', 'jaundice'], only: baby },
);
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
