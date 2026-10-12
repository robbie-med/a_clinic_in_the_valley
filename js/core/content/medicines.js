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
];
