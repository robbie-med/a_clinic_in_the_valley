// organisms.js — the bacteria behind the bacterial illnesses, and how each antibiotic fares against them.
//
// mic:    modal MIC (mg/L) of the wild type, from the EUCAST MIC distributions. A drug missing from the
//         table does nothing to that organism (intrinsic resistance), e.g. penicillin on Shigella.
// fold:   how many times higher the MIC of a resistant strain is (acquired resistance, roughly the gap
//         between the wild-type mode and the resistant population).
// resist0: share of strains already resistant in the valley when you arrive. Estimates for rural East
//         Africa from the systematic reviews cited; the valley's own index then moves with use (clinic.js).
// For cotrimoxazole the MIC is given as its trimethoprim part (EUCAST convention), matching actives.js.
// For the malaria parasite (`parasite: true`) `mic` is a multiplier on each drug's EC50 in actives.js (1 = the
// wild type), and `fold` is how much a resistant strain raises it.

import { localize } from '../i18n.js';

export const ORGANISMS = [
  {
    id: 's_pneumoniae', name: 'Pneumococcus (Streptococcus pneumoniae)',
    mic: { amoxicillin: 0.016, penicillin_v: 0.016, dicloxacillin: 0.12, cotrimoxazole: 0.25, erythromycin: 0.06, doxycycline: 0.12, chloramphenicol: 2, ciprofloxacin: 1, ceftriaxone: 0.016 },
    fold: { amoxicillin: 64, penicillin_v: 128, cotrimoxazole: 16, erythromycin: 256, doxycycline: 64, chloramphenicol: 8, ciprofloxacin: 8, dicloxacillin: 64, ceftriaxone: 64 },
    resist0: { ceftriaxone: 0.02, penicillin_v: 0.25, amoxicillin: 0.08, dicloxacillin: 0.25, cotrimoxazole: 0.6, erythromycin: 0.12, doxycycline: 0.3, chloramphenicol: 0.15, ciprofloxacin: 0.03 },
    ref: 'EUCAST MIC distributions (S. pneumoniae); Iroh Tam PY et al. Pneumonia 2017;9:4; Tadesse BT et al. BMC Infect Dis 2017;17:616',
  },
  {
    id: 'shigella', name: 'Shigella',
    mic: { ciprofloxacin: 0.016, cotrimoxazole: 0.25, amoxicillin: 2, chloramphenicol: 4, doxycycline: 2, ceftriaxone: 0.03 },
    fold: { ciprofloxacin: 64, cotrimoxazole: 64, amoxicillin: 64, chloramphenicol: 16, doxycycline: 16, ceftriaxone: 256 },
    resist0: { ceftriaxone: 0.05, ciprofloxacin: 0.08, cotrimoxazole: 0.8, amoxicillin: 0.7, chloramphenicol: 0.5, doxycycline: 0.65 },
    ref: 'EUCAST MIC distributions (Shigella spp., E. coli as proxy); Tadesse BT et al. BMC Infect Dis 2017;17:616; WHO Guidelines for the control of shigellosis 2005',
  },
  {
    id: 's_aureus', name: 'Staphylococcus aureus',
    mic: { dicloxacillin: 0.25, penicillin_v: 0.03, amoxicillin: 0.25, cotrimoxazole: 0.06, erythromycin: 0.25, doxycycline: 0.12, chloramphenicol: 4, ciprofloxacin: 0.25, ceftriaxone: 2 },
    // MRSA resists every penicillin and cephalosporin at once: its ceftriaxone draw is the dicloxacillin one
    link: { ceftriaxone: 'dicloxacillin' },
    fold: { ceftriaxone: 32, dicloxacillin: 64, penicillin_v: 512, amoxicillin: 128, cotrimoxazole: 64, erythromycin: 256, doxycycline: 64, chloramphenicol: 8, ciprofloxacin: 32 },
    // penicillinase is near-universal; MRSA (dicloxacillin-resistant) is the one that matters.
    resist0: { ceftriaxone: 0.15, penicillin_v: 0.9, amoxicillin: 0.88, dicloxacillin: 0.15, cotrimoxazole: 0.3, erythromycin: 0.2, doxycycline: 0.35, chloramphenicol: 0.2, ciprofloxacin: 0.15 },
    ref: 'EUCAST MIC distributions (S. aureus); Falagas ME et al. PLoS One 2013;8:e68024 (MRSA in Africa); Tadesse BT et al. BMC Infect Dis 2017;17:616',
  },
  {
    id: 'e_coli', name: 'Escherichia coli (urinary)',
    mic: { amoxicillin: 4, cotrimoxazole: 0.06, ciprofloxacin: 0.016, doxycycline: 2, chloramphenicol: 4, ceftriaxone: 0.06 },
    // ESBL strains resist ceftriaxone
    fold: { amoxicillin: 64, cotrimoxazole: 128, ciprofloxacin: 64, doxycycline: 16, chloramphenicol: 8, ceftriaxone: 512 },
    resist0: { ceftriaxone: 0.25, amoxicillin: 0.75, cotrimoxazole: 0.7, ciprofloxacin: 0.2, doxycycline: 0.6, chloramphenicol: 0.4 },
    ref: 'EUCAST MIC distributions (E. coli); Tadesse BT et al. BMC Infect Dis 2017;17:616; Odongo I et al. Infect Drug Resist 2020;13:2185 (UTI, Uganda)',
  },
  {
    id: 's_pyogenes', name: 'Group A Streptococcus (S. pyogenes)',
    // Has never become resistant to penicillin.
    mic: { penicillin_v: 0.016, amoxicillin: 0.016, dicloxacillin: 0.03, erythromycin: 0.03, doxycycline: 0.25, cotrimoxazole: 0.25, chloramphenicol: 2, ciprofloxacin: 0.5, ceftriaxone: 0.016 },
    fold: { erythromycin: 256, doxycycline: 64, cotrimoxazole: 16, chloramphenicol: 8, ciprofloxacin: 8 },
    resist0: { erythromycin: 0.1, doxycycline: 0.4, cotrimoxazole: 0.3, chloramphenicol: 0.1, ciprofloxacin: 0.05 },
    ref: 'EUCAST MIC distributions (S. pyogenes); Shulman ST et al. Clin Infect Dis 2012;55:1279',
  },
  {
    id: 's_typhi', name: 'Salmonella Typhi',
    mic: { ciprofloxacin: 0.016, chloramphenicol: 4, amoxicillin: 1, cotrimoxazole: 0.06, ceftriaxone: 0.12 },
    fold: { ciprofloxacin: 32, chloramphenicol: 16, amoxicillin: 64, cotrimoxazole: 128, ceftriaxone: 256 },
    // multidrug-resistant typhoid (chloramphenicol + ampicillin + cotrimoxazole) and falling ciprofloxacin susceptibility
    resist0: { ciprofloxacin: 0.3, chloramphenicol: 0.4, amoxicillin: 0.45, cotrimoxazole: 0.45, ceftriaxone: 0.02 },
    ref: 'EUCAST MIC distributions (Salmonella); Britto CD et al. PLoS Negl Trop Dis 2018;12:e0006779 (typhoid resistance, Africa)',
  },
  {
    id: 'e_histolytica', name: 'Amoeba (Entamoeba histolytica)',
    mic: { metronidazole: 1 },
    fold: { metronidazole: 4 },
    resist0: { metronidazole: 0 },
    ref: 'Upcroft P, Upcroft JA. Clin Microbiol Rev 2001;14:150 (drug susceptibility of amitochondriate protozoa)',
  },
  {
    id: 'g_lamblia', name: 'Giardia (Giardia lamblia)',
    mic: { metronidazole: 1 },
    fold: { metronidazole: 4 },
    resist0: { metronidazole: 0.05 },
    ref: 'Upcroft P, Upcroft JA. Clin Microbiol Rev 2001;14:150; Lalle M, Hanevik K. Infect Drug Resist 2018;11:1921 (treatment failure)',
  },
  {
    id: 'p_falciparum', name: 'Malaria parasite (Plasmodium falciparum)', parasite: true, scatter: false,
    mic: { chloroquine: 1, quinine: 1, artemisinin: 1, artemether: 1, artesunate: 1, lumefantrine: 1 },
    // pfcrt K76T raises chloroquine IC50 ~5–10×; kelch13 mutants clear slowly under artemisinins (partial
    // resistance, now spreading in East Africa); quinine and lumefantrine susceptibility has drifted little.
    fold: { chloroquine: 8, quinine: 3, artemisinin: 2.5, artemether: 2.5, artesunate: 2.5, lumefantrine: 3 },
    resist0: { chloroquine: 0.6, quinine: 0.03, artemisinin: 0.04, artemether: 0.04, artesunate: 0.04, lumefantrine: 0.03 },
    ref: 'WHO World malaria report 2023 (drug efficacy and resistance); Mwanza S et al. Malar J 2016;15:584 (chloroquine sensitivity returning after withdrawal); Balikagala B et al. N Engl J Med 2021;385:1163 (artemisinin partial resistance, Uganda)',
  },

  // ——— infections (WTND chapters 13–18, 21 and pp.399–403)
  // `mut`: −log10 share of a mycobacterial population already resistant to each drug by chance (pre-existing
  // mutants); the mycobacterial model (disease.js) follows these mutants and lets them take over when only one drug
  // is working on them.
  {
    id: 'm_tuberculosis', name: 'Tuberculosis bacillus (Mycobacterium tuberculosis)', scatter: false,
    mic: { isoniazid: 0.06, rifampicin: 0.125, pyrazinamide: 25, ethambutol: 1, streptomycin: 0.5 },
    fold: { isoniazid: 128, rifampicin: 128, pyrazinamide: 8, ethambutol: 8, streptomycin: 64 },
    mut: { isoniazid: 6, rifampicin: 8, pyrazinamide: 5, ethambutol: 6, streptomycin: 6 },
    // new patients in Uganda: any isoniazid resistance ~5%, MDR ~1.4%
    resist0: { isoniazid: 0.05, rifampicin: 0.015, pyrazinamide: 0.02, ethambutol: 0.02, streptomycin: 0.05 },
    ref: 'Schön T et al. Clin Microbiol Infect 2020;26:1488 (EUCAST reference MICs, M. tuberculosis; pyrazinamide at acid pH); David HL. Appl Microbiol 1970;20:810 (mutant frequencies); Lukoye D et al. PLoS One 2013;8:e70763 (Uganda drug resistance survey)',
  },
  {
    id: 'm_leprae', name: 'Leprosy bacillus (Mycobacterium leprae)', scatter: false,
    // it cannot be grown in a dish: MICs are from the mouse footpad
    mic: { dapsone: 0.003, rifampicin: 0.3 },
    fold: { dapsone: 64, rifampicin: 64 },
    mut: { dapsone: 6, rifampicin: 7 },
    resist0: { dapsone: 0.05, rifampicin: 0.03 },
    ref: 'Ji B. Lepr Rev 1985;56:265 (drug susceptibility of M. leprae, mouse footpad); Cambau E et al. Clin Microbiol Infect 2018;24:1305 (WHO leprosy resistance surveillance)',
  },
  {
    id: 'c_tetani', name: 'Tetanus germ (Clostridium tetani)',
    mic: { metronidazole: 0.25, penicillin_v: 0.06, doxycycline: 0.25 },
    fold: { metronidazole: 4, penicillin_v: 8, doxycycline: 16 },
    resist0: { metronidazole: 0, penicillin_v: 0.01, doxycycline: 0.1 },
    ref: 'EUCAST MIC distributions (Clostridium, anaerobes); Yen LM, Thwaites CL. Lancet 2019;393:1657',
  },
  {
    id: 'n_meningitidis', name: 'Meningococcus (Neisseria meningitidis)',
    mic: { penicillin_v: 0.06, amoxicillin: 0.06, ceftriaxone: 0.002, chloramphenicol: 1, ciprofloxacin: 0.004, cotrimoxazole: 0.12, doxycycline: 0.25 },
    fold: { penicillin_v: 8, amoxicillin: 8, ceftriaxone: 16, chloramphenicol: 16, ciprofloxacin: 32, cotrimoxazole: 64, doxycycline: 16 },
    resist0: { penicillin_v: 0.1, amoxicillin: 0.08, ceftriaxone: 0, chloramphenicol: 0.01, ciprofloxacin: 0.01, cotrimoxazole: 0.5, doxycycline: 0.05 },
    ref: 'EUCAST MIC distributions (N. meningitidis); WHO Managing meningitis epidemics in Africa, 2015; Nau R et al. Clin Microbiol Rev 2010;23:858',
  },
  {
    id: 'v_cholerae', name: 'Cholera germ (Vibrio cholerae O1)',
    mic: { doxycycline: 0.25, ciprofloxacin: 0.008, cotrimoxazole: 0.12, erythromycin: 2, chloramphenicol: 1, amoxicillin: 2 },
    fold: { doxycycline: 32, ciprofloxacin: 32, cotrimoxazole: 128, erythromycin: 16, chloramphenicol: 16, amoxicillin: 32 },
    // the SXT element carries cotrimoxazole and chloramphenicol resistance together
    link: { chloramphenicol: 'cotrimoxazole' },
    resist0: { doxycycline: 0.3, ciprofloxacin: 0.2, cotrimoxazole: 0.85, erythromycin: 0.2, chloramphenicol: 0.85, amoxicillin: 0.6 },
    ref: 'EUCAST MIC distributions (Vibrio); Das B et al. Vaccine 2020;38 Suppl 1:A83 (resistance in V. cholerae)',
  },
  {
    id: 'n_gonorrhoeae', name: 'Gonococcus (Neisseria gonorrhoeae)',
    mic: { penicillin_v: 0.06, amoxicillin: 0.25, ceftriaxone: 0.004, ciprofloxacin: 0.004, doxycycline: 0.25, cotrimoxazole: 1, erythromycin: 0.25 },
    fold: { penicillin_v: 256, amoxicillin: 128, ceftriaxone: 32, ciprofloxacin: 256, doxycycline: 64, cotrimoxazole: 16, erythromycin: 32 },
    link: { amoxicillin: 'penicillin_v' }, // penicillinase-producing strains resist both
    resist0: { penicillin_v: 0.8, amoxicillin: 0.8, ceftriaxone: 0.01, ciprofloxacin: 0.6, doxycycline: 0.8, cotrimoxazole: 0.7, erythromycin: 0.3 },
    ref: 'EUCAST MIC distributions (N. gonorrhoeae); Unemo M et al. Lancet Microbe 2021;2:e627 (WHO gonococcal resistance surveillance)',
  },
  {
    id: 'c_trachomatis', name: 'Chlamydia (Chlamydia trachomatis)',
    // no resistance that matters in practice has been seen
    mic: { doxycycline: 0.06, erythromycin: 0.5, amoxicillin: 1, ciprofloxacin: 1 },
    fold: { doxycycline: 4, erythromycin: 4, amoxicillin: 4, ciprofloxacin: 8 },
    resist0: { doxycycline: 0, erythromycin: 0, amoxicillin: 0, ciprofloxacin: 0.02 },
    ref: 'Suchland RJ et al. Antimicrob Agents Chemother 2003;47:636 (chlamydial MICs); WHO guidelines for the treatment of Chlamydia trachomatis 2016',
  },
  {
    id: 't_pallidum', name: 'Syphilis germ (Treponema pallidum)', scatter: false,
    // ~0.018 mg/L of penicillin is treponemicidal (Idsoe 1972); the MIC here is free drug. It has never resisted penicillin.
    mic: { penicillin_v: 0.005, amoxicillin: 0.01, ceftriaxone: 0.005, doxycycline: 0.1, erythromycin: 0.01 },
    fold: { erythromycin: 256, doxycycline: 4 },
    resist0: { erythromycin: 0.2, doxycycline: 0 },
    ref: 'Idsoe O et al. Bull World Health Organ 1972;47 Suppl:1; Stamm LV. Antimicrob Agents Chemother 2010;54:583',
  },
  {
    id: 'h_ducreyi', name: 'Chancroid germ (Haemophilus ducreyi)',
    mic: { ciprofloxacin: 0.004, erythromycin: 0.03, ceftriaxone: 0.004, doxycycline: 1, cotrimoxazole: 0.5, amoxicillin: 0.5 },
    fold: { ciprofloxacin: 32, erythromycin: 16, ceftriaxone: 16, doxycycline: 16, cotrimoxazole: 32, amoxicillin: 64 },
    resist0: { ciprofloxacin: 0.05, erythromycin: 0.05, ceftriaxone: 0.01, doxycycline: 0.8, cotrimoxazole: 0.6, amoxicillin: 0.8 },
    ref: 'Lewis DA. Sex Transm Infect 2003;79:68 (chancroid)',
  },
  {
    id: 't_vaginalis', name: 'Trichomonas (Trichomonas vaginalis)',
    mic: { metronidazole: 1 },
    fold: { metronidazole: 8 },
    resist0: { metronidazole: 0.04 },
    ref: 'Upcroft P, Upcroft JA. Clin Microbiol Rev 2001;14:150; Kirkcaldy RD et al. Emerg Infect Dis 2012;18:939 (4% resistant)',
  },
  {
    id: 'h_influenzae', name: 'Haemophilus influenzae (eye)',
    mic: { amoxicillin: 0.5, doxycycline: 0.5, chloramphenicol: 0.5, ciprofloxacin: 0.016, cotrimoxazole: 0.06, ceftriaxone: 0.004, erythromycin: 4 },
    fold: { amoxicillin: 32, doxycycline: 16, chloramphenicol: 16, ciprofloxacin: 32, cotrimoxazole: 64, ceftriaxone: 16, erythromycin: 8 },
    resist0: { amoxicillin: 0.2, doxycycline: 0.1, chloramphenicol: 0.1, ciprofloxacin: 0.01, cotrimoxazole: 0.5, ceftriaxone: 0.01, erythromycin: 0.1 },
    ref: 'EUCAST MIC distributions (H. influenzae); Tadesse BT et al. BMC Infect Dis 2017;17:616',
  },
];

// Shown text translates on read (i18n.js); the Korean lives in i18n/ko/actives.js. `ref` is a citation (cite()).
localize(ORGANISMS, ['name']);
export const ORG = new Map(ORGANISMS.map((o) => [o.id, o]));

/** A fresh resistance index for a new valley: { org: { drug: share resistant } }. */
export function baseResistance() {
  const out = {};
  for (const o of ORGANISMS) out[o.id] = { ...o.resist0 };
  return out;
}

// ——— childbirth and the newborn (WTND pp.275–276, 358): gentamicin against the germs above that it covers.
// [organism, wild-type modal MIC (EUCAST), resistant fold, share resistant at the start (Tadesse BT et al. BMC Infect
// Dis 2017;17:616, rounded)]. Added here rather than in each row so this section merges as one block.
for (const [id, mic, fold, r0] of [['e_coli', 0.5, 32, 0.3], ['s_aureus', 0.25, 64, 0.15]]) {
  const o = ORG.get(id);
  o.mic.gentamicin = mic; o.fold.gentamicin = fold; o.resist0.gentamicin = r0;
}
