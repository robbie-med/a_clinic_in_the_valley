// flora_herbs.js — turns each generated flora row (content/flora.js) into the same shape as a
// hand-written herb (herbs.js), so gathering, drying, preparing, dosing and the handbook all work
// unchanged. Nothing here is per species: every number comes from the species' life form, the part
// used, or its measured content. Art is generic: one sprite per life form, tinted from the id.
import { FLORA } from './flora.js';

/** Which valley habitats a climate suits, and how well the valley suits it at all (0–1). */
export const CLIMATE = {
  wt: { name: 'wet tropical', fit: 1, habitat: { forest: 1, riverbank: 0.6, swamp: 0.4 } },
  sd: { name: 'seasonally dry tropical', fit: 1, habitat: { scrub: 0.8, field: 0.6, forest: 0.3 } },
  mt: { name: 'montane tropical', fit: 0.8, habitat: { highland: 1, forest: 0.3 } },
  st: { name: 'subtropical', fit: 0.7, habitat: { forest: 0.5, field: 0.5, scrub: 0.3 } },
  dr: { name: 'desert or dry shrubland', fit: 0.5, habitat: { scrub: 1 } },
  te: { name: 'temperate', fit: 0.25, habitat: { highland: 0.6 } },
  sa: { name: 'subalpine or subarctic', fit: 0.1, habitat: { highland: 0.3 } },
};

// Art is data, not code: each life form has a POOL of sprite keys, and a species picks one from the
// pool by a hash of its id, then tints it. Adding tiles later (e.g. the CC0 DCSS supplemental plant
// set) means adding keys to a pool here — no code change anywhere else.
const T = (...n) => n.map((i) => 'dngn/trees/' + i);
const P = (...n) => n.map((i) => 'mon/fungi_plants/' + i);
const FL = (...n) => n.map((i) => 'dngn/decor/flower_patch_' + i);
// DCSS Supplemental flowering grass (CC0), see tools/build_atlas.py EXTRA
const GF = ['blue', 'red', 'yellow'].flatMap((c) => [1, 2, 3].map((i) => `dngn/floor/grass/supp_flowers_${c}_${i}`));
export const LIFE_SPRITES = {
  tree: [...T('tree2', 'tree6', 'tree8', 'tree11', 'tree1', 'tree3', 'tree4', 'tree5', 'tree9', 'tree10', 'mangrove1', 'mangrove2')],
  shrub: P('bush2', 'bush3', 'bush4', 'bush', 'scrub_nettle', 'plant_07', 'plant_08', 'plant_06'),
  climber: P('briar_patch', 'plant_02', 'plant_01', 'plant_04', 'plant_06', 'plant_05'),
  succulent: [...P('oklob_sapling', 'oklob_plant', 'plant_09', 'plant_04', 'plant_10'), 'mon/humanoids/giants/cactus_giant'],
  epiphyte: P('plant_09', 'sacred_lotus', 'plant_10', 'plant_08', 'plant_03', 'scrub_nettle'),
  geophyte: [...P('plant_04', 'plant_05', 'plant_03', 'plant_10', 'plant_07', 'plant_08'), ...FL(0, 1)],
  herb: [...P('plant_01', 'plant_03', 'plant_07', 'plant_08', 'plant_10', 'plant_02', 'plant_06', 'plant_09'), ...FL(0, 1, 2, 3)],
  grass: [...P('plant_01', 'plant_05'), ...GF],
};
/** How each life form behaves: whether it blocks the way, how fast it comes back, when it is there. */
export const LIFE_FORM = {
  tree: { tree: true, regrow: 12, seasons: 'all' },
  shrub: { regrow: 8, seasons: 'all' },
  climber: { regrow: 7, seasons: 'all' },
  succulent: { regrow: 10, seasons: 'all' },
  epiphyte: { regrow: 10, seasons: 'all' },
  geophyte: { regrow: 20, seasons: ['rains', 'late_rains', 'cool_dry'] },
  herb: { regrow: 6, seasons: ['rains', 'late_rains', 'cool_dry'] },
  grass: { regrow: 5, seasons: ['rains', 'late_rains', 'cool_dry'] },
};
// A gathered unit: a realistic handful of that part, its dry fraction, the tool needed, the icon (one
// generic icon per part — swap the keys when better art arrives) and which preparations make sense
// (preparations.js ids; 'dry' is always possible).
export const PART = {
  leaf: { unit: 'handful of leaves', g: 20, dry: 0.3, icon: 'three-leaves', methods: ['infusion', 'tincture'] },
  shoot: { unit: 'handful of shoots', g: 20, dry: 0.3, icon: 'three-leaves', methods: ['infusion', 'tincture'] },
  plant: { unit: 'whole plant', g: 25, dry: 0.3, icon: 'three-leaves', methods: ['infusion', 'tincture'] },
  flower: { unit: 'handful of flowers', g: 10, dry: 0.2, icon: 'flowers', methods: ['infusion', 'tincture'] },
  bark: { unit: 'strip of bark', g: 20, dry: 0.55, tool: 'knife', icon: 'log', methods: ['decoction', 'tincture'] },
  wood: { unit: 'piece of wood', g: 25, dry: 0.5, tool: 'knife', icon: 'log', methods: ['decoction', 'tincture'] },
  stem: { unit: 'length of stem', g: 20, dry: 0.4, tool: 'knife', icon: 'curling-vines', methods: ['decoction', 'tincture'] },
  root: { unit: 'root', g: 30, dry: 0.3, tool: 'knife', icon: 'ground-sprout', methods: ['decoction', 'tincture'] },
  rhizome: { unit: 'rhizome', g: 30, dry: 0.25, tool: 'knife', icon: 'ground-sprout', methods: ['decoction', 'tincture'] },
  tuber: { unit: 'tuber', g: 60, dry: 0.25, tool: 'knife', icon: 'ground-sprout', methods: ['powder', 'decoction'] },
  bulb: { unit: 'bulb', g: 40, dry: 0.3, tool: 'knife', icon: 'garlic', methods: ['powder', 'decoction'] },
  seed: { unit: 'handful of seeds', g: 25, dry: 0.9, icon: 'plant-seed', methods: ['powder'] },
  fruit: { unit: 'fruit', g: 60, dry: 0.2, icon: 'hypersonic-melon', methods: ['powder', 'decoction'] },
};
const TINTS = ['#9ac070', '#7aa858', '#b0c888', '#88b07a', '#a8c0a0', '#c0c878', '#90b89a', '#b8b060'];
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; };

/** Folk uses, as the game names them (Duke ethnobotany, mapped in tools/build_flora.mjs). */
export const USE_NAMES = {
  fever: 'fever', malaria: 'malaria', watery_diarrhea: 'diarrhoea', dysentery: 'dysentery', cough: 'cough',
  common_cold: 'colds', pneumonia: 'chest infection', wound: 'wounds', wound_infected: 'boils and sores',
  burn: 'burns', worms: 'worms', itch: 'itching', scabies: 'scabies', pain: 'pain', back_pain: 'aches and rheumatism',
  heart_failure: 'dropsy', swelling: 'swelling (as a water medicine)', vomiting: 'to make vomiting', nausea: 'nausea',
  stomach_ache: 'stomach ache', cramp: 'cramps and colic', constipation: 'to purge', loose_stool: 'to bind the bowels',
  sore_throat: 'sore throat', earache: 'earache', antiseptic: 'to clean wounds', jaundice: 'yellow eyes (jaundice)',
  anaemia: 'weak blood', poison: 'a poison (for fish, arrows or worse)',
};

function toHerb(s) {
  const L = LIFE_FORM[s.l] || LIFE_FORM.herb, P = PART[s.p];
  const pool = LIFE_SPRITES[s.l] || LIFE_SPRITES.herb;
  const h = hash(s.i);
  const contains = {};
  for (const [cl, v] of Object.entries(s.k)) contains[cl] = [v[0], v[1]];
  return {
    id: s.i, flora: true, name: s.cn || s.n, latin: s.n, family: s.f, part: s.p, life: s.l, climate: s.c,
    estimated: Object.values(s.k).some((v) => v[2]),
    habitat: CLIMATE[s.c].habitat, seasons: L.seasons, density: 0, tree: !!L.tree,
    sprite: pool[h % pool.length], tint: TINTS[(h >>> 5) % TINTS.length], icon: P.icon, color: TINTS[(h >>> 5) % TINTS.length],
    unit: { name: P.unit, g: P.g }, dry: P.dry, tool: P.tool || null, regrowDays: L.regrow,
    contains, methods: ['dry', ...P.methods],
    evidence: 'traditional', uses: (s.u || []).map((u) => USE_NAMES[u] || u), folk: s.u || [],
    note: `${CLIMATE[s.c].name.replace(/^./, (c) => c.toUpperCase())} ${s.l}. People use the ${s.p}${s.u?.length ? ' for ' + (s.u || []).slice(0, 4).map((u) => USE_NAMES[u] || u).join(', ') : ' in their own traditions'}. What it can actually do here is whatever its compounds do.`,
    harms: [],
    ref: 'Duke JA, USDA Dr. Duke\'s Phytochemical and Ethnobotanical Databases (public domain); WCVP (Kew, CC BY 4.0)',
  };
}

export const FLORA_HERBS = FLORA.map(toHerb);
