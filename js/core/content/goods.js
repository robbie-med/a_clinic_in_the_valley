// goods.js — everything that is not a herb or a remedy: kitchen ingredients for remedies, the tools
// of the trade, building materials, and what poor patients pay with. Prices are in shillings (sh).
// unit: 'g' / 'ml' (stack counts grams or millilitres) or omitted (counted one by one).

import { localize } from '../i18n.js';

export const INGREDIENTS = [
  { id: 'salt', name: 'Salt', unit: 'g', stack: 2000, price: 0.004, icon: 'salt-shaker', color: '#e8e8e8', note: 'For the rehydration drink: half a level teaspoon (about 2.5–3 g) to a litre.' },
  { id: 'sugar', name: 'Sugar', unit: 'g', stack: 5000, price: 0.006, icon: 'powder-bag', color: '#f0e8d0', note: '8 level teaspoons (about 40 g) to a litre of rehydration drink.' },
  { id: 'rice_flour', name: 'Rice flour', unit: 'g', stack: 5000, price: 0.005, icon: 'flour', color: '#f4f0e0', note: 'Cereal rehydration drink: 2 handfuls (50 g) cooked in a litre of water with salt.' },
  { id: 'lard', name: 'Lard', unit: 'g', stack: 2000, price: 0.01, icon: 'covered-jar', color: '#f0e0c0', note: 'Base for ointments: 10 parts lard to 1 part sulfur.' },
  { id: 'sulfur', name: 'Sulfur powder', unit: 'g', stack: 1000, price: 0.05, icon: 'powder-bag', color: '#e8d040', note: 'Precipitated sulfur. Mixed 1:10 with lard for scabies (WTND p.199).' },
  { id: 'turmeric', name: 'Turmeric', unit: 'g', stack: 1000, price: 0.02, icon: 'powder-bag', color: '#e0a020', note: 'Mixed with neem paste.' },
  { id: 'spirit', name: 'Local spirit (40%)', unit: 'ml', stack: 3000, price: 0.006, icon: 'water-bottle', color: '#c8e0f0', note: 'Distilled cane spirit, about 40% alcohol. Extracts alkaloids and glycosides that water leaves behind.' },
  { id: 'lime', name: 'Lime (fruit)', stack: 40, price: 0.3, icon: 'cut-lemon', color: '#a0d040', note: 'Its acid turns quinine into a salt that dissolves in water.' },
  { id: 'honey', name: 'Honey', unit: 'g', stack: 2000, price: 0.02, icon: 'honey-jar', color: '#e0a030', oral: true, topical: true, note: 'By mouth for cough (not under 1 year). On a clean cloth for wounds and burns.' },
  { id: 'garlic', name: 'Garlic bulb', stack: 40, price: 0.5, icon: 'garlic', color: '#f0e8d8', dryFrac: 0.35, unitG: 40, contains: { allicin: [0.8, 1.4] }, note: 'About 10 cloves.' },
  { id: 'soap', name: 'Bar of soap', stack: 20, price: 1, icon: 'stone-block', color: '#d0e0f0', note: 'Wash wounds, hands and the itch away.' },
  { id: 'cloth', name: 'Clean cloth strips', stack: 50, price: 0.3, icon: 'rolled-cloth', color: '#f0f0e8', note: 'Boiled cloth for dressings and bandages.' },
];

export const TOOLS = [
  { id: 'knife', name: 'Knife', price: 4, icon: 'bone-knife', color: '#c0c0c0', note: 'To cut bark and peel aloe.' },
  { id: 'watch', name: 'Watch with a second hand', price: 12, icon: 'sun', color: '#e0c080', note: 'Count breaths and pulse for a full minute.' },
  { id: 'thermometer', name: 'Thermometer', price: 10, icon: 'thermometer-hot', color: '#e06050', note: 'Under the arm for 3 minutes (WTND p.31).' },
  { id: 'scale', name: 'Hanging scale', price: 25, icon: 'scales', color: '#c0b080', note: 'Weigh the patient: doses go by body weight.' },
  { id: 'balance', name: 'Small balance (0.01 g)', price: 40, icon: 'scales', color: '#e0d0a0', note: 'Weigh powders to the hundredth of a gram — needed for strong leaves like foxglove.' },
  { id: 'spoons', name: 'Measuring spoons', price: 3, icon: 'cooking-pot', color: '#b0b0b0', note: 'Level teaspoons: rehydration drink and powder doses come out right.' },
  { id: 'dropper', name: 'Glass dropper', price: 2, icon: 'vial', color: '#a0d0e0', note: '20 drops ≈ 1 ml. For tinctures and soaks.' },
  { id: 'muac_tape', name: 'Arm (MUAC) tape', price: 2, icon: 'rope-coil', color: '#e04040', note: 'Mid-upper-arm circumference in children 6 months to 5 years.' },
  { id: 'magnifier', name: 'Hand lens', price: 6, icon: 'magnifying-glass', color: '#a0c0e0', note: 'See scabies burrows and fine detail.' },
  { id: 'syringe', name: 'Syringe and needles (glass, boilable)', price: 2, icon: 'syringe', color: '#d0e0f0', note: 'Boil 15 minutes before every injection (WTND p.67): a hearth in reach.' },
  { id: 'stethoscope', name: 'Stethoscope', price: 30, icon: 'stethoscope', color: '#3a3a3a', note: 'Hear crackles in the chest you would miss with an ear.' },
  { id: 'bp_cuff', name: 'Blood pressure cuff', price: 45, icon: 'heart-beats', color: '#4060a0', note: 'High blood pressure in pregnancy is pre-eclampsia until proved otherwise.' },
  { id: 'mortar', name: 'Mortar and pestle', price: 5, icon: 'pestle-mortar', color: '#a09080', note: 'Grind dried herbs to powder, crush garlic and neem.' },
  { id: 'cooking_pot', name: 'Cooking pot', price: 5, icon: 'cooking-pot', color: '#6a6a6a', note: 'Boil water, brew teas and decoctions.' },
];

export const MATERIALS = [
  { id: 'pole', name: 'Wooden pole', stack: 40, price: 0.8, icon: 'wood-stick', color: '#8a6a40' },
  { id: 'thatch', name: 'Bundle of thatch grass', stack: 40, price: 0.5, icon: 'wheat', color: '#d8c070' },
  { id: 'mud_brick', name: 'Sun-dried mud brick', stack: 99, price: 0.25, icon: 'clay-brick', color: '#a07050' },
  { id: 'plank', name: 'Plank', stack: 40, price: 1.5, icon: 'planks', color: '#b08850' },
  { id: 'nails', name: 'Nails (handful)', stack: 50, price: 0.5, icon: 'hammer-nails', color: '#909090' },
  { id: 'clay_jar', name: 'Clay jar', stack: 10, price: 1, icon: 'mason-jar', color: '#b07a50' },
];

/** What patients who cannot pay in coin bring instead. Traders buy them back. */
export const PRODUCE = [
  { id: 'eggs', name: 'Eggs', stack: 60, price: 0.4, icon: 'fried-eggs', color: '#f0e8d0' },
  { id: 'chicken', name: 'Chicken', stack: 10, price: 6, icon: 'chicken-leg', color: '#e0b080' },
  { id: 'maize', name: 'Maize cobs', stack: 60, price: 0.3, icon: 'corn', color: '#e8c040' },
  { id: 'beans', name: 'Beans (kg)', stack: 20, price: 1.2, icon: 'peas', color: '#8a4a3a' },
  { id: 'cassava', name: 'Cassava root', stack: 30, price: 0.5, icon: 'potato', color: '#c0a080' },
  { id: 'firewood', name: 'Firewood bundle', stack: 30, price: 0.5, icon: 'wood-pile', color: '#8a6a40' },
];
// Shown text translates on read (i18n.js); the Korean lives in i18n/ko/items.js.
for (const rows of [INGREDIENTS, TOOLS, MATERIALS, PRODUCE]) localize(rows, ['name', 'note']);
