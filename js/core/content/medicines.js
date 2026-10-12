// medicines.js — factory-made medicines from the Green Pages, bought rather than made. Unlike a herb batch
// their strength is what the label says (unless a trader sold you a fake). `actives` are mg per tablet or
// per ml; `pack` is how many tablets (or ml) come in the box or bottle the traders sell.
//
// Prices are per tablet / ml in shillings, from the median supplier prices in the MSH International Medical
// Products Price Guide (2015), at about 1 sh ≈ US$0.80 (a chicken is 6 sh), before the trader's markup.

const tab = (id, name, actives, price, color, extra = {}) => ({ id, name, actives, price, pack: 100, stack: 1000, icon: 'pill', color, ...extra });
const syr = (id, name, actives, price, color, extra = {}) => ({ id, name, actives, price, unit: 'ml', pack: 100, stack: 2000, icon: 'medicines', color, shelfDays: 14, ...extra });

export const MEDICINES = [
  tab('amox_250', 'Amoxicillin 250 mg capsules', { amoxicillin: 250 }, 0.025, '#e8b040', { ref: 'WTND p.352' }),
  syr('amox_syrup', 'Amoxicillin syrup 125 mg in 5 ml', { amoxicillin: 25 }, 0.012, '#f0c860', { ref: 'WTND p.352', note: 'Mixed with clean water it keeps about two weeks.' }),
  tab('penv_250', 'Penicillin V 250 mg tablets', { penicillin_v: 250 }, 0.025, '#f0f0f0', { ref: 'WTND p.351' }),
  tab('diclox_250', 'Dicloxacillin 250 mg capsules', { dicloxacillin: 250 }, 0.08, '#c08040', { ref: 'WTND p.351' }),
  tab('cotrim_480', 'Cotrimoxazole 480 mg tablets', { cotrimoxazole: 80 }, 0.012, '#f4f4e8', { ref: 'WTND p.357', note: '400 mg sulfamethoxazole + 80 mg trimethoprim.' }),
  tab('cotrim_120', 'Cotrimoxazole 120 mg children\'s tablets', { cotrimoxazole: 20 }, 0.006, '#f8e8f0', { ref: 'WTND p.357', note: '100 mg sulfamethoxazole + 20 mg trimethoprim. Dissolves in a spoon of water.' }),
  tab('erythro_250', 'Erythromycin 250 mg tablets', { erythromycin: 250 }, 0.05, '#e070a0', { ref: 'WTND p.354' }),
  tab('doxy_100', 'Doxycycline 100 mg capsules', { doxycycline: 100 }, 0.012, '#80a0d0', { ref: 'WTND p.355' }),
  tab('chloram_250', 'Chloramphenicol 250 mg capsules', { chloramphenicol: 250 }, 0.035, '#a0a0a0', { ref: 'WTND p.356' }),
  tab('cipro_250', 'Ciprofloxacin 250 mg tablets', { ciprofloxacin: 250 }, 0.025, '#f0f0f8', { ref: 'WTND p.358' }),
  tab('cipro_500', 'Ciprofloxacin 500 mg tablets', { ciprofloxacin: 500 }, 0.035, '#e8e8f8', { ref: 'WTND p.358' }),

  tab('para_500', 'Paracetamol 500 mg tablets', { paracetamol: 500 }, 0.005, '#ffffff', { ref: 'WTND p.379' }),
  syr('para_syrup', 'Paracetamol syrup 120 mg in 5 ml', { paracetamol: 24 }, 0.006, '#f0a0a0', { ref: 'WTND p.379', shelfDays: 365 }),
  tab('ibu_200', 'Ibuprofen 200 mg tablets', { ibuprofen: 200 }, 0.008, '#f08060', { ref: 'WTND p.379' }),
  tab('asa_300', 'Aspirin 300 mg tablets', { aspirin: 300 }, 0.004, '#f8f8f0', { ref: 'WTND p.378' }),
  tab('codeine_30', 'Codeine 30 mg tablets', { codeine: 30 }, 0.05, '#e0e0ff', { ref: 'WTND p.383' }),

  tab('cq_150', 'Chloroquine 150 mg base tablets', { chloroquine: 150 }, 0.01, '#f0f0f0', { ref: 'WTND p.366', note: '250 mg chloroquine phosphate = 150 mg base. Doses are counted in base.' }),
  tab('al_20_120', 'Artemether–lumefantrine 20/120 mg tablets', { artemether: 20, lumefantrine: 120 }, 0.08, '#f0e0a0', { ref: 'WTND p.364', note: 'Coartem. 6 doses over 3 days: at 0, 8, 24, 36, 48 and 60 hours, with food or milk.' }),
  tab('as_50', 'Artesunate 50 mg tablets', { artesunate: 50 }, 0.12, '#f8f0e0', { ref: 'WTND p.364' }),
  tab('qn_300', 'Quinine sulfate 300 mg tablets', { quinine: 250 }, 0.06, '#ffffff', { ref: 'WTND p.365', note: '300 mg quinine sulfate ≈ 250 mg quinine base.' }),

  tab('meb_100', 'Mebendazole 100 mg chewable tablets', { mebendazole: 100 }, 0.012, '#f0c0e0', { ref: 'WTND p.373' }),
  tab('alb_400', 'Albendazole 400 mg tablets', { albendazole: 400 }, 0.04, '#f0e0f0', { ref: 'WTND p.374' }),
  { id: 'permethrin_cream', name: 'Permethrin 5% cream (30 g tube)', topical: { permethrin: 1 }, price: 1.5, pack: 10, stack: 40, icon: 'medical-pack', color: '#e0f0f8', ref: 'WTND p.372',
    note: 'One tube covers an adult from the neck down; half for a child. Wash off after 8–12 hours; repeat after a week.' },
  { id: 'bb_lotion', name: 'Benzyl benzoate 25% (one application)', topical: { benzyl_benzoate: 1 }, price: 0.4, pack: 10, stack: 40, icon: 'medicines', color: '#f8f0e0', ref: 'WTND p.372',
    note: 'Paint on the whole body below the neck. Stings on scratched skin. Dilute half-and-half with water for children.' },

  { id: 'ors_packet', name: 'ORS sachet (for 1 litre)', route: [], price: 0.09, pack: 50, stack: 400, icon: 'powder-bag', color: '#a0d0f0', ref: 'WTND p.381',
    note: 'WHO low-osmolarity salts. One sachet in one litre of clean water: the salt is always right.' },
  tab('metro_250', 'Metronidazole 250 mg tablets', { metronidazole: 250 }, 0.012, '#f0f0d0', { ref: 'WTND p.368' }),
  tab('iron_200', 'Ferrous sulfate 200 mg tablets', { iron: 65 }, 0.004, '#a04040', { ref: 'WTND p.392', note: '200 mg ferrous sulfate = 65 mg iron. Adults 1 tablet 1–3 times a day; children by weight.' }),
  tab('vita_200k', 'Vitamin A 200 000 IU capsules', { vitamin_a: 60 }, 0.03, '#f0c040', { ref: 'WTND p.391', note: 'Measles: one capsule on the first day and one the next (half for babies 6–12 months, a quarter under 6 months).' }),
  tab('zinc_20', 'Zinc sulfate 20 mg dispersible tablets', { zinc: 20 }, 0.04, '#d0d0e0', { ref: 'WTND p.381', note: 'Children with diarrhoea: 20 mg a day for 10–14 days (10 mg under 6 months).' }),

  // injections: given by your hand in the clinic (encounter.js injectNow). `inj.ka` is absorption from the muscle (/h).
  { id: 'benzathine_pen', name: 'Benzathine penicillin 2.4 MU vial', actives: { benzylpenicillin: 1440 }, inj: { ka: 0.0017 }, route: ['inj'], unit: 'vial', price: 0.4, pack: 50, stack: 200, icon: 'vial', color: '#f0f0f0', ref: 'WTND p.351',
    note: 'A depot: one injection keeps a low level of penicillin for 3–4 weeks. Into the buttock muscle of an adult, never a small child.' }, // ka: fitted to ~0.02–0.1 mg/L for 3–4 weeks (Kaplan EL et al. J Pediatr 1989;115:146)
  { id: 'benzylpen_1mu', name: 'Benzylpenicillin 1 MU vial (600 mg)', actives: { benzylpenicillin: 600 }, inj: { ka: 3 }, route: ['inj'], unit: 'vial', price: 0.2, pack: 50, stack: 200, icon: 'vial', color: '#f8f8f0', ref: 'WTND p.351',
    note: 'Short-acting: every 4–6 hours.' },
  { id: 'ceftriaxone_1g', name: 'Ceftriaxone 1 g vial', actives: { ceftriaxone: 1000 }, inj: { ka: 1.5 }, route: ['inj'], unit: 'vial', price: 0.6, pack: 25, stack: 100, icon: 'vial', color: '#f0e8d0', ref: 'WTND p.359',
    note: 'Once a day. Adults 1–2 g; children 50–80 mg/kg.' },
  { id: 'adrenaline_1mg', name: 'Adrenaline 1 mg/ml (1:1000) ampoule', actives: { adrenaline: 1 }, inj: { ka: 3 }, route: ['inj'], unit: 'ampoule', price: 0.25, pack: 10, stack: 50, icon: 'vial', color: '#f0d0d0', ref: 'WTND p.70',
    note: 'For allergic shock. Keep it with you whenever you inject penicillin.' },
  // ——— infections (WTND chapters 13–18, 21 and pp.399–403). Prices: MSH 2015 medians where listed, else estimates.
  // TB and leprosy courses run on the game calendar (time.js COMPRESS): six months of treatment is about 20 game days.
  tab('rhze_fdc', 'TB tablets RHZE (rifampicin 150, isoniazid 75, pyrazinamide 400, ethambutol 275 mg)', { rifampicin: 150, isoniazid: 75, pyrazinamide: 400, ethambutol: 275 }, 0.075, '#e07050',
    { ref: 'WTND pp.359–361', note: 'The first two months (about 7 game days): adults 38–54 kg 3 tablets once a day, 55–70 kg 4. Never stop early.' }),
  tab('rh_fdc', 'TB tablets RH (rifampicin 150, isoniazid 75 mg)', { rifampicin: 150, isoniazid: 75 }, 0.035, '#e09070',
    { ref: 'WTND pp.359–361', note: 'The last four months (about 13 game days), same number of tablets as before.' }),
  tab('inh_100', 'Isoniazid 100 mg tablets', { isoniazid: 100 }, 0.005, '#f0f0e0', { ref: 'WTND p.360' }),
  tab('rif_300', 'Rifampicin 300 mg capsules', { rifampicin: 300 }, 0.075, '#d04030', { ref: 'WTND pp.360, 362' }),
  tab('pza_400', 'Pyrazinamide 400 mg tablets', { pyrazinamide: 400 }, 0.025, '#f0e8d8', { ref: 'WTND p.361' }),
  tab('emb_400', 'Ethambutol 400 mg tablets', { ethambutol: 400 }, 0.03, '#e8e0f0', { ref: 'WTND p.361' }),
  { id: 'strep_1g', name: 'Streptomycin 1 g vial', actives: { streptomycin: 1000 }, inj: { ka: 2 }, route: ['inj'], unit: 'vial', price: 0.25, pack: 50, stack: 200, icon: 'vial', color: '#f0f0e0', ref: 'WTND p.361',
    note: 'Adults 15 mg/kg once a day into the muscle; under 50 kg or over 50 years, less. Deafness if overdone.' },
  tab('dapsone_100', 'Dapsone 100 mg tablets', { dapsone: 100 }, 0.02, '#f8f8f0', { ref: 'WTND p.362', note: 'Leprosy: adults 100 mg a day, with rifampicin.' }),
  tab('diaz_5', 'Diazepam 5 mg tablets', { diazepam: 5 }, 0.005, '#f0f0ff', { ref: 'WTND p.389', note: 'Tetanus: enough to stop most spasms. Ground up in water it can go into the rectum.' }),
  { id: 'tig_250', name: 'Tetanus immune globulin (human) 250 IU vial', actives: { tetanus_ig: 250 }, inj: { ka: 0.03 }, route: ['inj'], unit: 'vial', price: 10, pack: 10, stack: 40, icon: 'vial', color: '#f0e0d0', ref: 'WTND p.388',
    note: 'A wound in someone not vaccinated: 250 IU. Tetanus itself: the book gives 5000 IU.' },
  { id: 'tat_1500', name: 'Tetanus antitoxin (horse) 1500 IU ampoule', actives: { tetanus_antitoxin: 1500 }, inj: { ka: 0.05 }, route: ['inj'], unit: 'ampoule', price: 1.2, pack: 10, stack: 40, icon: 'vial', color: '#e8d8c0', ref: 'WTND pp.70, 388',
    note: 'Horse serum: allergic shock is common. Adrenaline ready. Prevention 1500–3000 IU; tetanus itself 40 000–50 000 IU.' },
  { id: 'tat_20000', name: 'Tetanus antitoxin (horse) 20 000 IU vial', actives: { tetanus_antitoxin: 20000 }, inj: { ka: 0.05 }, route: ['inj'], unit: 'vial', price: 10, pack: 5, stack: 20, icon: 'vial', color: '#e0d0b0', ref: 'WTND pp.70, 184, 388',
    note: 'Horse serum: allergic shock is common. Adrenaline ready.' },
  { id: 'tetra_eye', name: 'Tetracycline 1% eye ointment (one application)', topical: { tetracycline_eye: 1 }, price: 0.006, pack: 30, stack: 300, icon: 'medical-pack', color: '#f0e090', ref: 'WTND p.378',
    note: 'A little inside the pulled-down lower lid, 3–4 times a day. Trachoma: for a month (about 3 game days).' },
  { id: 'whitfield_oint', name: 'Whitfield\'s ointment (one application)', topical: { whitfield: 1 }, price: 0.025, pack: 30, stack: 300, icon: 'medical-pack', color: '#f0f0e8', ref: 'WTND p.371',
    note: 'Ringworm: twice a day, on and a little beyond the ring, for 3–4 weeks.' },
  { id: 'gv_paint', name: 'Gentian violet 0.5% (one painting)', topical: { gentian_violet: 1 }, price: 0.008, pack: 50, stack: 500, icon: 'medicines', color: '#8040c0', ref: 'WTND p.370',
    note: 'Paint impetigo sores after washing off the crusts, 3 times a day.' },
];
