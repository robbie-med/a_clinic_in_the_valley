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

const LIFE = {
  tree: { tree: true, sprites: ['dngn/trees/tree2', 'dngn/trees/tree6', 'dngn/trees/tree8', 'dngn/trees/tree11'], regrow: 12, seasons: 'all' },
  shrub: { sprites: ['mon/fungi_plants/bush2', 'mon/fungi_plants/bush3', 'mon/fungi_plants/bush4'], regrow: 8, seasons: 'all' },
  climber: { sprites: ['mon/fungi_plants/briar_patch'], regrow: 7, seasons: 'all' },
  succulent: { sprites: ['mon/fungi_plants/oklob_sapling'], regrow: 10, seasons: 'all' },
  epiphyte: { sprites: ['mon/fungi_plants/plant_09'], regrow: 10, seasons: 'all' },
  geophyte: { sprites: ['mon/fungi_plants/plant_04', 'mon/fungi_plants/plant_05'], regrow: 20, seasons: ['rains', 'late_rains', 'cool_dry'] },
  herb: { sprites: ['mon/fungi_plants/plant_01', 'mon/fungi_plants/plant_03', 'mon/fungi_plants/plant_07', 'mon/fungi_plants/plant_08', 'mon/fungi_plants/plant_10'], regrow: 6, seasons: ['rains', 'late_rains', 'cool_dry'] },
};
// A gathered unit: a realistic handful of that part, its dry fraction, the tool needed, the icon, and
// which preparations make sense (preparations.js ids; 'dry' is always possible).
const PART = {
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
  const L = LIFE[s.l] || LIFE.herb, P = PART[s.p];
  const h = hash(s.i);
  const contains = {};
  for (const [cl, v] of Object.entries(s.k)) contains[cl] = [v[0], v[1]];
  return {
    id: s.i, flora: true, name: s.cn || s.n, latin: s.n, family: s.f, part: s.p, life: s.l, climate: s.c,
    estimated: Object.values(s.k).some((v) => v[2]),
    habitat: CLIMATE[s.c].habitat, seasons: L.seasons, density: 0, tree: !!L.tree,
    sprite: L.sprites[h % L.sprites.length], tint: TINTS[(h >>> 5) % TINTS.length], icon: P.icon, color: TINTS[(h >>> 5) % TINTS.length],
    unit: { name: P.unit, g: P.g }, dry: P.dry, tool: P.tool || null, regrowDays: L.regrow,
    contains, methods: ['dry', ...P.methods],
    evidence: 'traditional', uses: (s.u || []).map((u) => USE_NAMES[u] || u), folk: s.u || [],
    note: `${CLIMATE[s.c].name.replace(/^./, (c) => c.toUpperCase())} ${s.l}. People use the ${s.p}${s.u?.length ? ' for ' + (s.u || []).slice(0, 4).map((u) => USE_NAMES[u] || u).join(', ') : ' in their own traditions'}. What it can actually do here is whatever its compounds do.`,
    harms: [],
    ref: 'Duke JA, USDA Dr. Duke\'s Phytochemical and Ethnobotanical Databases (public domain); WCVP (Kew, CC BY 4.0)',
  };
}

export const FLORA_HERBS = FLORA.map(toHerb);
