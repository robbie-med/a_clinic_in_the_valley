// vendors.js — who sells what, and when they come. The village shop is always there in daylight;
// the market is every seventh day; the herb seller and the tool peddler wander in on their own
// rhythm (seeded). Herb sellers' wares vary in strength, and now and then are not what they claim.
// sells: [itemId, [min, max] stock (in the item's unit), price multiplier]

export const VENDORS = [
  {
    id: 'duka', name: 'Village shop', who: 'Shopkeeper', fixed: true, open: [8 * 60, 18 * 60], look: { base: 'player/base/human2_m', hair: 'player/hair/short_black' },
    greet: 'Karibu. Salt, sugar, soap, cloth, a few medicines — and building things in the back.',
    sells: [['salt', [500, 2000], 1.3], ['sugar', [1000, 4000], 1.3], ['rice_flour', [500, 3000], 1.3], ['soap', [3, 10], 1.3], ['cloth', [10, 30], 1.4],
      ['spirit', [500, 2000], 1.4], ['lard', [200, 1000], 1.4], ['pole', [6, 20], 1.2], ['thatch', [6, 20], 1.2], ['mud_brick', [20, 80], 1.2], ['plank', [4, 16], 1.3],
      ['nails', [4, 12], 1.3], ['clay_jar', [2, 6], 1.3], ['knife', [1, 2], 1.3], ['cooking_pot', [1, 2], 1.3],
      ['para_500', [100, 300], 2], ['asa_300', [0, 200], 2], ['ors_packet', [50, 150], 1.6]],
    buys: ['produce'], fakes: 0.05,
  },
  {
    id: 'market', name: 'Market day', who: 'Market women', every: 7, offset: 3, open: [8 * 60, 15 * 60], look: { base: 'player/base/human_f', hair: 'player/hair/long_red' },
    greet: 'Fresh today! Honey, garlic, ginger, limes — and we buy your eggs and maize.',
    sells: [['honey', [250, 1500], 1.1], ['garlic', [4, 20], 1.1], ['fresh_ginger', [3, 12], 1.1], ['lime', [5, 30], 1.1], ['turmeric', [50, 300], 1.1],
      ['salt', [500, 2000], 1.1], ['sugar', [1000, 4000], 1.1], ['lard', [200, 1000], 1.1], ['eggs', [6, 30], 1.2], ['fresh_cornsilk', [0, 10], 1], ['seed_cornsilk', [5, 20], 1],
      ['amox_250', [0, 200], 2.5], ['cotrim_480', [0, 200], 2.5], ['cq_150', [0, 300], 2.5], ['para_500', [0, 200], 2.5], ['codeine_30', [0, 100], 2.5]], // loose tablets from the medicine seller's tray
    buys: ['produce', 'herb'], fakes: 0.15,
  },
  {
    id: 'herbalist', name: 'Travelling herb seller', who: 'Herb seller', wander: [4, 7], stay: 2, open: [9 * 60, 16 * 60], look: { base: 'player/base/human3_f', hair: 'player/hair/long_yellow' },
    greet: 'Bark from the high forests, leaves from the far hills. Strong medicine, my sister.',
    sells: [['dried_cinchona', [2, 10], 1.6], ['dried_artemisia', [2, 10], 1.4], ['dried_foxglove', [0, 6], 1.8], ['dried_willow', [2, 8], 1.3], ['powder_papaya', [0, 60], 1.3],
      ['dried_eucalyptus', [2, 8], 1.2], ['cutting_aloe', [1, 4], 1.2], ['seed_artemisia', [0, 6], 1.5], ['seed_foxglove', [0, 4], 1.8], ['fresh_ginger', [2, 6], 1.2]],
    buys: ['herb'], adulterate: 0.15,
  },
  {
    id: 'peddler', name: 'Tool peddler', who: 'Peddler', wander: [6, 10], stay: 1, open: [9 * 60, 17 * 60], look: { base: 'player/base/human_m', hair: 'player/hair/brown1' },
    greet: 'Tools from the town! Thermometers, scales, spoons — real ones.',
    sells: [['thermometer', [1, 2], 1.2], ['watch', [0, 1], 1.2], ['scale', [0, 1], 1.2], ['spoons', [1, 3], 1.2], ['dropper', [1, 4], 1.2], ['muac_tape', [1, 4], 1.2],
      ['magnifier', [0, 2], 1.2], ['mortar', [1, 2], 1.2], ['cooking_pot', [1, 2], 1.2], ['knife', [1, 2], 1.2], ['sulfur', [100, 500], 1.3], ['clay_jar', [2, 8], 1.2],
      ['stethoscope', [0, 1], 1.25], ['syringe', [1, 3], 1.25], ['bp_cuff', [0, 1], 1.25], ['balance', [0, 1], 1.25]],
    buys: [],
  },
  {
    id: 'stores', name: 'Mission medical stores', who: 'Storekeeper', wander: [9, 13], stay: 1, open: [9 * 60, 16 * 60], look: { base: 'player/base/human2_f', hair: 'player/hair/pigtails_brown' },
    greet: 'From the mission stores in town. Proper medicines, sealed boxes, fair prices. Cash only.',
    sells: [['amox_250', [100, 500], 1.15], ['amox_syrup', [200, 1000], 1.15], ['penv_250', [0, 300], 1.15], ['diclox_250', [0, 200], 1.2], ['cotrim_480', [100, 500], 1.15], ['cotrim_120', [100, 300], 1.15],
      ['erythro_250', [0, 200], 1.2], ['doxy_100', [100, 300], 1.15], ['chloram_250', [0, 200], 1.2], ['cipro_250', [0, 200], 1.2], ['cipro_500', [100, 300], 1.2],
      ['para_500', [100, 500], 1.15], ['para_syrup', [100, 500], 1.15], ['ibu_200', [100, 300], 1.15], ['codeine_30', [0, 200], 1.2],
      ['al_20_120', [100, 600], 1.15], ['as_50', [0, 200], 1.2], ['qn_300', [100, 300], 1.15], ['cq_150', [100, 300], 1.15],
      ['meb_100', [100, 300], 1.15], ['alb_400', [100, 200], 1.15], ['permethrin_cream', [10, 30], 1.15], ['bb_lotion', [10, 30], 1.15],
      ['ors_packet', [50, 300], 1.15], ['zinc_20', [100, 300], 1.15], ['metro_250', [100, 300], 1.15], ['iron_200', [100, 500], 1.15], ['vita_200k', [100, 200], 1.15],
      ['benzathine_pen', [0, 20], 1.2], ['benzylpen_1mu', [0, 30], 1.2], ['ceftriaxone_1g', [0, 20], 1.2], ['adrenaline_1mg', [5, 20], 1.2], ['syringe', [1, 4], 1.2]],
    buys: [], fakes: 0.01,
  },
];
export const VENDOR = new Map(VENDORS.map((v) => [v.id, v]));
