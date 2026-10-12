// materia.js — the non-plant materia medica: animal and mineral goods from other traditions. None of
// it grows in the valley; it comes by post from the town import catalogue (economy.js), weeks away and
// often not what the label says. A small hand table, because there is no open dataset for it — but the
// chemistry is real, and so is the toxicity (flora_actives.js).
//
// `fake` is the share of samples found to be adulterated or substituted in published market surveys.

export const MATERIA = [
  {
    id: 'antler_velvet', name: 'Deer antler velvet (ground)', unit: 'g', stack: 500, price: 0.9, pack: 50,
    actives: { antler_protein: 900 }, fake: 0.4, distance: 3,
    icon: 'powder-bag', color: '#d8c0a0',
    note: 'Lu rong, "staghorn". A tonic for weakness and ageing in Chinese and Korean medicine. Controlled trials find no effect; DNA studies of the market find cattle and gelatine sold as antler in a large share of samples.',
    ref: 'Sleivert G et al. Int J Sport Nutr Exerc Metab 2003;13:251; Wu F et al. J Ethnopharmacol 2013;145:403',
  },
  {
    id: 'cinnabar', name: 'Cinnabar (zhu sha, mercury ore)', unit: 'g', stack: 200, price: 2.5, pack: 20,
    actives: { mercury_sulfide: 850 }, fake: 0.1, distance: 3,
    icon: 'stone-pile', color: '#b03030',
    note: 'Mercuric sulfide, red mineral powder, used in traditional sedative pills. It treats nothing, and the mercury builds up in the kidneys and the nerves. Several countries have recalled pills containing it.',
    ref: 'Liu J et al. J Ethnopharmacol 2008;119:3; WHO Guidance on mercury in traditional medicines, 2017',
  },
  {
    id: 'realgar', name: 'Realgar (xiong huang, arsenic ore)', unit: 'g', stack: 200, price: 2, pack: 20,
    actives: { arsenic_sulfide: 900 }, fake: 0.1, distance: 3,
    icon: 'stone-pile', color: '#e08030',
    note: 'Arsenic disulfide, an orange mineral used on the skin and, in some traditions, by mouth for sores and parasites. By mouth it is arsenic poisoning, slow or fast.',
    ref: 'Liu J et al. J Ethnopharmacol 2008;119:3; IARC Monographs vol.100C (arsenic)',
  },
];
export const MATERIA_BY_ID = new Map(MATERIA.map((m) => [m.id, m]));
