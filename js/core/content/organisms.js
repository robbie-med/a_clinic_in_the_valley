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
];

export const ORG = new Map(ORGANISMS.map((o) => [o.id, o]));

/** A fresh resistance index for a new valley: { org: { drug: share resistant } }. */
export function baseResistance() {
  const out = {};
  for (const o of ORGANISMS) out[o.id] = { ...o.resist0 };
  return out;
}
