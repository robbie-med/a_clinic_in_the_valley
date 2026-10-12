// herbs.js — real medicinal plants of the region. Each row: what it is, where and when it grows, the
// part you take, what that part contains (% of DRY weight, a range — plants and chemotypes really
// vary that much), how strong the evidence is, and what can go wrong.
//
// Units: one gathered `unit` is a realistic handful (see `unit`), weighed fresh; `dry` is the dry-mass
// fraction of the fresh part. A dried unit keeps the dry mass. Every plant on the map draws its own
// content from the range (hash of its position), so two willows beside each other differ.
//
// Habitats (region.js): village, field, scrub, forest, riverbank, swamp, highland.
// Seasons (time.js): cool_dry, hot_dry, rains, late_rains.
// Evidence grades: 'strong' (good trials), 'some' (small or mixed trials), 'traditional' (use and
// lab work only), 'harmful' (more risk than benefit as usually used).

export const HERBS = [
  {
    id: 'willow', name: 'White willow', latin: 'Salix alba', family: 'Salicaceae', part: 'bark',
    habitat: { riverbank: 1, swamp: 0.3 }, seasons: 'all', density: 0.03, tree: true,
    sprite: 'dngn/trees/tree5', tint: '#c8d8a8', icon: 'log', color: '#a07850',
    unit: { name: 'strip of bark', g: 20 }, dry: 0.55, tool: 'knife', regrowDays: 12,
    contains: { salicin: [0.5, 1.5] },
    evidence: 'some', uses: ['pain', 'fever', 'back pain', 'joint pain'],
    note: 'The bark that led to aspirin. Willow gives far less salicylate in the blood than aspirin; trials still found real relief of back pain at 240 mg salicin a day — more than a cup of tea gives.',
    harms: ['Same cautions as aspirin: not for children with flu or chickenpox (Reye syndrome), not with stomach ulcers.'],
    ref: 'ESCOP Salicis cortex; Chrubasik 2000; Vlachojannis 2009 (Phytother Res 23:897)',
  },
  {
    id: 'cinchona', name: 'Red cinchona', latin: 'Cinchona pubescens', family: 'Rubiaceae', part: 'bark',
    habitat: { highland: 1 }, seasons: 'all', density: 0.012, tree: true,
    sprite: 'dngn/trees/tree9', tint: '#e0b0a0', icon: 'log', color: '#9a4a3a',
    unit: { name: 'piece of bark', g: 25 }, dry: 0.6, tool: 'knife', regrowDays: 20,
    contains: { quinine: [1.5, 4] },
    evidence: 'strong', uses: ['malaria'],
    note: 'Jesuit\'s bark. Quinine is barely soluble in plain water as the free base; boiling the bark with something sour (lime juice) turns it into a soluble salt — that is why old recipes used wine or acid. The red bark of the wild tree holds much less quinine than the cultivated yellow kind.',
    harms: ['Cinchonism (ringing ears, nausea) is common at working doses.', 'Too much: blindness, deadly heart rhythm.', 'Low blood sugar, especially in pregnancy and children.'],
    ref: 'WTND p.365; Achan J et al. Malar J 2011;10:144 (quinine, an old anti-malarial drug)',
  },
  {
    id: 'artemisia', name: 'Sweet wormwood', latin: 'Artemisia annua', family: 'Asteraceae', part: 'leaf',
    habitat: { highland: 0.8, field: 0.3 }, seasons: ['rains', 'late_rains'], density: 0.02,
    sprite: 'mon/fungi_plants/plant_10', tint: '#9ad070', icon: 'three-leaves', color: '#7ab050',
    unit: { name: 'bunch of leaves', g: 30 }, dry: 0.25, tool: null, regrowDays: 8, garden: true,
    contains: { artemisinin: [0.1, 1.0] },
    evidence: 'harmful', uses: ['malaria (do not rely on it)'],
    note: 'Source of artemisinin, the most powerful antimalarial known. But as tea the dose is small and gone from the blood within hours: fevers clear, then the parasites come back. Using it alone breeds resistance. WHO advises against it.',
    harms: ['Recrudescence: the fever returns in days to weeks.', 'Monotherapy selects resistant parasites.'],
    ref: 'Räth 2004; Mueller 2004; WHO 2019 position statement',
  },
  {
    id: 'foxglove', name: 'Foxglove', latin: 'Digitalis purpurea', family: 'Plantaginaceae', part: 'leaf',
    habitat: { highland: 0.5 }, seasons: ['cool_dry', 'hot_dry'], density: 0.006,
    sprite: 'mon/fungi_plants/plant_02', tint: '#d080c0', icon: 'flowers', color: '#c060a0',
    unit: { name: 'leaf', g: 6 }, dry: 0.15, tool: null, regrowDays: 15, garden: true,
    contains: { digitoxin: [0.1, 0.4] },
    evidence: 'strong', uses: ['heart failure ("dropsy")'],
    note: 'William Withering\'s dropsy cure (1785). The leaf strength varies up to fourfold, which is why digitalis became the first drug standardised by assay. Dried powdered leaf, small doses, watch the pulse.',
    harms: ['Every part is poisonous. Nausea and yellow vision warn of excess; a slow irregular pulse can kill.', 'Looks like comfrey before it flowers.'],
    lookalike: 'comfrey',
    ref: 'Withering 1785; Goodman & Gilman 13e; WTND p.325',
  },
  {
    id: 'brugmansia', name: 'Angel\'s trumpet', latin: 'Brugmansia arborea', family: 'Solanaceae', part: 'leaf',
    habitat: { village: 0.6, field: 0.2 }, seasons: 'all', density: 0.008,
    sprite: 'mon/fungi_plants/bush', tint: '#e8e8c0', icon: 'curled-leaf', color: '#d8d8a0',
    unit: { name: 'leaf', g: 8 }, dry: 0.15, tool: null, regrowDays: 6,
    contains: { tropane: [0.15, 0.5] },
    evidence: 'traditional', uses: ['stomach and gut cramps (adults only)'],
    note: 'WTND: grind 1–2 leaves, soak a day in 100 ml water, give 10–15 drops every 4 hours to adults. The drops are a tiny dose; a swallowed cupful is poisoning.',
    harms: ['Anticholinergic poisoning: "dry as a bone, red as a beet, blind as a bat, mad as a hatter, hot as a hare".', 'Never for children.'],
    ref: 'WTND p.12',
  },
  {
    id: 'aloe', name: 'Aloe', latin: 'Aloe vera', family: 'Asphodelaceae', part: 'leaf',
    habitat: { scrub: 1, village: 0.3 }, seasons: 'all', density: 0.03,
    sprite: 'mon/fungi_plants/oklob_sapling', tint: '#90c8a0', icon: 'cactus', color: '#7ac08a',
    unit: { name: 'thick leaf', g: 150 }, dry: 0.02, // gel is 98% water tool: 'knife', regrowDays: 6, garden: true,
    contains: { aloe_gel: [0.7, 1.3], aloin: [0.5, 3] }, // topical actives: relative strength; aloin: % of dry leaf
    evidence: 'some', uses: ['minor burns', 'scrapes', 'itching'],
    note: 'Peel the leaf and lay the clear gel on a burn. The yellow sap just under the skin (aloin) is a harsh purgative — keep it out of anything drunk.',
    harms: ['Whole-leaf drinks cause cramping diarrhoea.'],
    ref: 'WTND p.13; Maenthaisong 2007',
  },
  {
    id: 'papaya', name: 'Papaya', latin: 'Carica papaya', family: 'Caricaceae', part: 'seeds',
    habitat: { village: 1, field: 0.4 }, seasons: 'all', density: 0.02, tree: true,
    sprite: 'dngn/trees/tree12', tint: '#a8e080', icon: 'hypersonic-melon', color: '#e0a040',
    unit: { name: 'handful of seeds', g: 25 }, dry: 0.3, tool: null, regrowDays: 7,
    contains: { papain_bitc: [0.2, 0.6] },
    evidence: 'some', uses: ['roundworm'],
    note: 'Dried, powdered seeds — 3 teaspoons in water or honey, 3 times a day for 7 days (WTND). One trial in Nigerian children cleared most stools of parasites.',
    harms: ['Modern worm medicine works better.'],
    ref: 'WTND p.13; Okeniyi 2007',
  },
  {
    id: 'guava', name: 'Guava', latin: 'Psidium guajava', family: 'Myrtaceae', part: 'leaf',
    habitat: { village: 0.6, field: 0.6, forest: 0.3 }, seasons: 'all', density: 0.025, tree: true,
    sprite: 'dngn/trees/tree7', tint: '#b0e090', icon: 'three-leaves', color: '#5aa050',
    unit: { name: 'handful of young leaves', g: 20 }, dry: 0.3, tool: null, regrowDays: 4,
    contains: { guava_flavonoid: [1.0, 2.5] },
    evidence: 'some', uses: ['diarrhoea cramps', 'fewer loose stools'],
    note: 'Leaf tea is one of the most used diarrhoea remedies in the tropics and does ease cramps and stool frequency a little. It does not replace the water lost — the rehydration drink does that.',
    harms: [],
    ref: 'Lozoya 2002; Gutiérrez 2008',
  },
  {
    id: 'neem', name: 'Neem', latin: 'Azadirachta indica', family: 'Meliaceae', part: 'leaf',
    habitat: { village: 0.8, scrub: 0.6, field: 0.3 }, seasons: 'all', density: 0.02, tree: true,
    sprite: 'dngn/trees/tree4', tint: '#90c070', icon: 'curled-leaf', color: '#4a8a3a',
    unit: { name: 'handful of leaves', g: 20 }, dry: 0.35, tool: null, regrowDays: 4,
    contains: { azadirachtin: [0.6, 1.4] },
    evidence: 'traditional', uses: ['scabies (weak)', 'lice'],
    note: 'Leaf paste with turmeric is a common scabies remedy. The only study had no control group.',
    harms: ['Neem oil swallowed by babies has caused fits and liver failure.'],
    ref: 'Charles 1992; Sinniah 1981',
  },
  {
    id: 'eucalyptus', name: 'Blue gum', latin: 'Eucalyptus globulus', family: 'Myrtaceae', part: 'leaf',
    habitat: { highland: 0.7, forest: 0.2 }, seasons: 'all', density: 0.02, tree: true,
    sprite: 'dngn/trees/tree1', tint: '#a0c0b8', icon: 'curled-leaf', color: '#7aa0a0',
    unit: { name: 'handful of leaves', g: 20 }, dry: 0.45, tool: null, regrowDays: 3,
    contains: { eucalyptol: [0.6, 1.4] },
    evidence: 'some', uses: ['blocked nose (steam)'],
    note: 'Breathing steam eases a stuffed nose (WTND p.164); the oil adds a little.',
    harms: ['The oil is poisonous swallowed, especially by children.'],
    ref: 'WTND p.164',
  },
  {
    id: 'ginger', name: 'Ginger', latin: 'Zingiber officinale', family: 'Zingiberaceae', part: 'root',
    habitat: { field: 0.3, forest: 0.2 }, seasons: ['rains', 'late_rains', 'cool_dry'], density: 0.01, garden: true,
    sprite: 'mon/fungi_plants/plant_04', tint: '#d0c080', icon: 'ground-sprout', color: '#d8b060',
    unit: { name: 'root', g: 30 }, dry: 0.15, tool: null, regrowDays: 10,
    contains: { gingerol: [1, 3] },
    evidence: 'some', uses: ['nausea of pregnancy', 'travel sickness'],
    note: 'About 1 g a day of dried root (a thumb of fresh) eases morning sickness for many women.',
    harms: ['Heartburn in large amounts.'],
    ref: 'WTND p.248; Cochrane 2015 CD007575',
  },
  {
    id: 'cornsilk', name: 'Corn silk', latin: 'Zea mays (stigmas)', family: 'Poaceae', part: 'silk',
    habitat: { field: 1 }, seasons: ['late_rains'], density: 0.015,
    sprite: 'mon/fungi_plants/plant_06', tint: '#e8d070', icon: 'corn', color: '#e0c050',
    unit: { name: 'handful of silk', g: 10 }, dry: 0.2, tool: null, regrowDays: 30,
    contains: { cornsilk_k: [100, 100] },
    evidence: 'traditional', uses: ['swollen feet (mild)'],
    note: 'WTND: a large handful boiled, 1–2 glasses. A gentle diuretic. Swollen feet can be heart failure or pre-eclampsia — find out which first.',
    harms: [],
    ref: 'WTND p.12, p.176',
  },
];

export const HERB = new Map(HERBS.map((h) => [h.id, h]));
