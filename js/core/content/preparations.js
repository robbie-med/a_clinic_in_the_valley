// preparations.js — how a plant becomes a medicine, and how much of each compound comes across.
//
// Extraction efficiency (fraction of the compound in the plant that ends up in the preparation) by
// method and compound. These are ESTIMATES from solubility (quinine base is near-insoluble in water,
// soluble as a salt in acid and in alcohol; artemisinin is poorly water-soluble and heat-labile;
// salicin and the cardiac glycosides dissolve in hot water) — not measured values. They exist so the
// choice of method matters the way it really does.
//
// Liquid volumes: ml of finished preparation per gram of DRY herb (a fresh herb counts by its dry mass).

import { localize } from '../i18n.js';

export const METHODS = {
  dry:            { name: 'Dried', verb: 'Dry on a rack', form: 'dried' },
  powder:         { name: 'Powder', verb: 'Grind to powder', form: 'powder', unit: 'g', tool: 'mortar', min: 10, shelfDays: 180 },
  infusion:       { name: 'Tea (infusion)', verb: 'Steep in just-boiled water, 10 minutes', form: 'liquid', unit: 'ml', mlPerG: 25, station: 'hearth', tool: 'cooking_pot', min: 12, shelfDays: 1 },
  decoction:      { name: 'Decoction', verb: 'Boil hard for 20 minutes', form: 'liquid', unit: 'ml', mlPerG: 20, station: 'hearth', tool: 'cooking_pot', min: 25, shelfDays: 2 },
  acid_decoction: { name: 'Sour decoction', verb: 'Boil 20 minutes with lime juice', form: 'liquid', unit: 'ml', mlPerG: 20, station: 'hearth', tool: 'cooking_pot', min: 25, shelfDays: 3, extra: [['lime', 1]] },
  cold_soak:      { name: 'Cold soak', verb: 'Grind and soak a day in water', form: 'liquid', unit: 'ml', mlPerG: 60, station: 'jar', tool: 'mortar', min: 5, hours: 24, shelfDays: 3 },
  tincture:       { name: 'Tincture', verb: 'Soak a week in spirit (1 g : 5 ml)', form: 'liquid', unit: 'ml', mlPerG: 5, station: 'jar', min: 5, hours: 168, shelfDays: 720, spirit: 5 },
};

// method → compound → fraction extracted. The flora compound classes (flora_actives.js) are in the
// same table: water pulls out tannins, berberine, caffeine and the anthraquinones well; alcohol takes
// the alkaloids and the essential-oil compounds; long boiling destroys thujone and much of the
// aconitine (which is why aconite root is boiled for hours before use) and drives off the volatiles.
export const EXTRACT = {
  powder:         { salicin: 0.9, quinine: 0.85, artemisinin: 0.85, digitoxin: 0.95, tropane: 0.95, gingerol: 1, papain_bitc: 1, guava_flavonoid: 0.8, aloin: 1, cornsilk_k: 0.9, tannin: 1, berberine: 1, emodin: 1, saponin: 1, oxalate: 1, cardenolide: 0.95, aconitine: 0.95, aristolochic: 0.95, pyrrolizidine: 0.95, ephedrine: 0.95, caffeine: 0.95, cyanogenic: 0.9, thujone: 0.6, coumarin: 0.8, glycyrrhizin: 1, thymol: 0.6, eugenol: 0.6, menthol: 0.5, eucalyptol: 0.5 },
  infusion:       { salicin: 0.5, quinine: 0.15, artemisinin: 0.4, digitoxin: 0.5, tropane: 0.7, gingerol: 0.5, guava_flavonoid: 0.5, cornsilk_k: 0.6, aloin: 0.7, tannin: 0.6, berberine: 0.6, emodin: 0.5, saponin: 0.5, oxalate: 0.7, cardenolide: 0.5, aconitine: 0.6, aristolochic: 0.5, pyrrolizidine: 0.6, ephedrine: 0.8, caffeine: 0.9, cyanogenic: 0.7, thujone: 0.3, coumarin: 0.5, glycyrrhizin: 0.6, thymol: 0.2, eugenol: 0.2, menthol: 0.2 },
  decoction:      { salicin: 0.7, quinine: 0.3, artemisinin: 0.25, digitoxin: 0.4, tropane: 0.7, gingerol: 0.6, guava_flavonoid: 0.6, cornsilk_k: 0.7, aloin: 0.8, tannin: 0.8, berberine: 0.8, emodin: 0.7, saponin: 0.7, oxalate: 0.85, cardenolide: 0.4, aconitine: 0.35, aristolochic: 0.6, pyrrolizidine: 0.7, ephedrine: 0.85, caffeine: 0.95, cyanogenic: 0.4, thujone: 0.15, coumarin: 0.6, glycyrrhizin: 0.8, thymol: 0.15, eugenol: 0.15, menthol: 0.1 },
  acid_decoction: { salicin: 0.65, quinine: 0.75, artemisinin: 0.2, digitoxin: 0.35, tropane: 0.8, gingerol: 0.55, guava_flavonoid: 0.55, cornsilk_k: 0.7, tannin: 0.8, berberine: 0.9, emodin: 0.6, saponin: 0.6, oxalate: 0.9, cardenolide: 0.3, aconitine: 0.3, aristolochic: 0.6, pyrrolizidine: 0.8, ephedrine: 0.9, caffeine: 0.95, cyanogenic: 0.3, thujone: 0.15, coumarin: 0.6, glycyrrhizin: 0.7, thymol: 0.15, eugenol: 0.15, menthol: 0.1 },
  cold_soak:      { salicin: 0.3, quinine: 0.1, artemisinin: 0.1, digitoxin: 0.3, tropane: 0.6, gingerol: 0.3, guava_flavonoid: 0.3, cornsilk_k: 0.4, aloin: 0.8, tannin: 0.4, berberine: 0.3, emodin: 0.3, saponin: 0.3, oxalate: 0.6, cardenolide: 0.3, aconitine: 0.4, aristolochic: 0.3, pyrrolizidine: 0.4, ephedrine: 0.6, caffeine: 0.6, cyanogenic: 0.5, thujone: 0.2, coumarin: 0.3, glycyrrhizin: 0.4, thymol: 0.15, eugenol: 0.15, menthol: 0.15 },
  tincture:       { salicin: 0.8, quinine: 0.65, artemisinin: 0.7, digitoxin: 0.85, tropane: 0.85, gingerol: 0.8, guava_flavonoid: 0.7, cornsilk_k: 0.5, tannin: 0.5, berberine: 0.85, emodin: 0.8, saponin: 0.6, oxalate: 0.4, cardenolide: 0.85, aconitine: 0.9, aristolochic: 0.85, pyrrolizidine: 0.85, ephedrine: 0.85, caffeine: 0.8, cyanogenic: 0.6, thujone: 0.9, coumarin: 0.9, glycyrrhizin: 0.7, thymol: 0.9, eugenol: 0.9, menthol: 0.9 },
};

// Which methods make sense for which herb (the rest are pointless or impossible).
export const HERB_METHODS = {
  willow: ['dry', 'powder', 'decoction', 'tincture'],
  cinchona: ['dry', 'powder', 'decoction', 'acid_decoction', 'tincture'],
  artemisia: ['dry', 'powder', 'infusion', 'tincture'],
  foxglove: ['dry', 'powder', 'infusion', 'tincture'],
  brugmansia: ['cold_soak', 'dry'],
  aloe: ['cold_soak'],
  papaya: ['dry', 'powder'],
  guava: ['dry', 'infusion', 'decoction'],
  ginger: ['dry', 'powder', 'infusion'],
  cornsilk: ['dry', 'decoction'],
  neem: [],
  eucalyptus: ['dry'],
};

/** Drying time (hours) by season; drying in the rains, outside, risks mould. */
export const DRY_HOURS = { cool_dry: 36, hot_dry: 24, rains: 72, late_rains: 48 };

/** Hand-made preparations that are not herb × method. Yields per batch; strength is relative. */
export const SPECIALS = [
  { id: 'aloe_gel', name: 'Aloe gel', unit: 'app', from: [['fresh_aloe', 1]], tool: 'knife', min: 3, n: 6, topical: { aloe_gel: 1 }, shelfDays: 3, icon: 'cactus', color: '#a0e0b0',
    note: 'The clear inner gel, skin and yellow sap removed. One application per small burn.' },
  { id: 'neem_paste', name: 'Neem and turmeric paste', unit: 'app', from: [['#herb_neem', 1], ['turmeric', 5]], tool: 'mortar', min: 8, n: 3, topical: { azadirachtin: 1 }, shelfDays: 2, icon: 'bubbling-bowl', color: '#5a8a3a',
    note: 'Ground fresh neem leaves with turmeric, rubbed on the skin.' },
  { id: 'sulfur_ointment', name: 'Sulfur ointment (1:10)', unit: 'app', from: [['sulfur', 10], ['lard', 100]], station: 'hearth', tool: 'cooking_pot', min: 15, n: 4, topical: { sulfur: 1 }, shelfDays: 365, icon: 'covered-jar', color: '#e8d860',
    note: '1 part sulfur to 10 parts lard, warmed and stirred. One application covers the body below the neck.' },
  { id: 'steam_eucalyptus', name: 'Eucalyptus steam bowl', unit: 'app', from: [['#herb_eucalyptus', 1]], station: 'hearth', tool: 'cooking_pot', min: 8, n: 3, topical: { eucalyptol: 1 }, shelfDays: 1, icon: 'bubbling-bowl', color: '#9ac0c0',
    note: 'Leaves in a bowl of just-boiled water; breathe the steam under a cloth.' },
  { id: 'garlic_drink', name: 'Garlic drink', unit: 'ml', from: [['garlic', 1]], tool: 'mortar', min: 5, n: 600, oralFrom: 'garlic', shelfDays: 1, icon: 'water-flask', color: '#f0f0e0',
    note: 'WTND: 4 crushed cloves in a glass of water, juice or milk, a glass a day for 3 weeks (pinworm).' },
  { id: 'ors_sugar', name: 'Rehydration drink (sugar–salt)', unit: 'ml', from: [['salt', 3], ['sugar', 40]], station: 'hearth', tool: 'cooking_pot', min: 10, n: 1000, fluid: true, shelfDays: 1, icon: 'water-flask', color: '#c8e8f8',
    note: '1 litre boiled water, ½ level teaspoon salt, 8 level teaspoons sugar. Taste: less salty than tears (WTND p.152).' },
  { id: 'ors_who', name: 'Rehydration drink (WHO sachet)', unit: 'ml', from: [['ors_packet', 1]], station: 'hearth', tool: 'cooking_pot', min: 8, n: 1000, fluid: { na: 75 }, shelfDays: 1, icon: 'water-flask', color: '#a8d8f8',
    note: 'One sachet stirred into a litre of boiled, cooled water. 75 mmol/L sodium. Throw away what is left after a day.' },
  { id: 'ors_cereal', name: 'Rehydration drink (rice)', unit: 'ml', from: [['salt', 3], ['rice_flour', 50]], station: 'hearth', tool: 'cooking_pot', min: 15, n: 1000, fluid: true, shelfDays: 0.33, icon: 'bowl-of-rice', color: '#f0f0e0',
    note: 'Powdered rice and salt boiled 5–7 minutes to a thin gruel. Spoils within hours in the heat.' },
];
// Shown text translates on read (i18n.js); the Korean lives in i18n/ko/items.js.
localize(Object.values(METHODS), ['name', 'verb']);
localize(SPECIALS, ['name', 'note']);
