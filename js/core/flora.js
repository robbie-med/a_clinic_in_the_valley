// flora.js — which of the world's species grow in THIS valley, and the small pure helpers the rest of
// the game (and later the patients) ask about them.
//
// The valley stays a function of the seed: `valleyFlora(seed)` picks the same subset every time, and
// region.js scatters it. Species that did not make the cut are still in the content table and can be
// bought as dried material or as seed from the town import catalogue (economy.js).
import { makeRng } from './rng.js';
import { FLORA_HERBS, CLIMATE, USE_NAMES } from './content/flora_herbs.js';
import { HERB } from './content/herbs.js';

export const VALLEY_SPECIES = [200, 400];   // how many of the world's species grow here
export const FLORA_COVER = 0.07;            // share of suitable tiles that carry a flora plant

/** The species of this valley: a weighted sample (by how well the climate suits them), seed-stable. */
export function valleyFlora(seed) {
  const rng = makeRng(seed, 'flora');
  const [lo, hi] = VALLEY_SPECIES;
  const n = lo + Math.floor(rng() * (hi - lo + 1));
  // A-Res weighted sampling without replacement: key = u^(1/weight), keep the largest n.
  return FLORA_HERBS
    .map((h) => [h, rng() ** (1 / CLIMATE[h.climate].fit)])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([h]) => h)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** How well the valley suits a species (0–1): bought seed of a temperate herb grows thin and weak. */
export const climateFit = (id) => CLIMATE[herb(id)?.climate]?.fit ?? 1;
const herb = (id) => HERB.get(id);

/** Every species growing within `r` tiles of a settlement, nearest first: [{ id, name, n, dist }]. */
export function floraNear(G, hamletId, r = 18) {
  const R = G.W.R;
  const s = hamletId === 'village' || !hamletId ? R.village : R.hamlets.find((x) => x.id === hamletId);
  if (!s) return [];
  const found = new Map();
  for (let y = Math.max(0, s.y - r); y <= Math.min(R.N - 1, s.y + r); y++) {
    for (let x = Math.max(0, s.x - r); x <= Math.min(R.N - 1, s.x + r); x++) {
      const o = G.W.obj(x, y);
      if (!o?.startsWith('plant_')) continue;
      const id = o.slice(6), d = Math.round(Math.hypot(x - s.x, y - s.y));
      const e = found.get(id);
      if (!e) found.set(id, { id, name: herb(id)?.name || id, n: 1, dist: d });
      else { e.n++; e.dist = Math.min(e.dist, d); }
    }
  }
  return [...found.values()].sort((a, b) => a.dist - b.dist);
}

/** Duke folk use → the game's conditions. A use with no condition stays a complaint in words. */
const USE_CONDS = {
  fever: ['malaria', 'typhoid', 'measles', 'chickenpox', 'puerperal_sepsis'],
  malaria: ['malaria'], watery_diarrhea: ['watery_diarrhea', 'cholera', 'giardia'], dysentery: ['dysentery', 'amoebiasis'],
  cough: ['cough_child', 'asthma', 'tb'], common_cold: ['common_cold'], pneumonia: ['pneumonia'], wound: ['wound_minor', 'snakebite'],
  wound_infected: ['wound_infected', 'impetigo', 'cellulitis'], burn: ['burn_minor'], worms: ['ascaris', 'pinworm', 'hookworm'],
  itch: ['scabies', 'tinea'], scabies: ['scabies'], pain: ['back_pain', 'sprain', 'fracture'], back_pain: ['back_pain', 'arthritis'],
  heart_failure: ['heart_failure'], swelling: ['heart_failure'], sore_throat: ['strep_throat'], earache: ['ear_infection'],
  nausea: ['nausea_pregnancy'], stomach_ache: ['ulcer'], cramp: ['ulcer'], loose_stool: ['watery_diarrhea'],
  jaundice: ['hepatitis', 'newborn_jaundice'], anaemia: ['hookworm', 'anaemia'], antiseptic: ['wound_minor'],
};

/**
 * What people say this species is for (USDA Duke ethnobotany):
 *   { codes, words, conditions } — raw use codes, the game's words for them, and the conditions
 * they point at. Traditional use only: whether it helps is decided by its compounds, not by this.
 */
export function folkUses(speciesId) {
  const h = herb(speciesId);
  const codes = h?.folk || [];
  return {
    codes,
    words: codes.map((c) => USE_NAMES[c] || c),
    conditions: [...new Set(codes.flatMap((c) => USE_CONDS[c] || []))],
  };
}

/** Plants this one is confused with: same genus first, then the same family. For misidentification. */
export function lookalikes(speciesId, limit = 6) {
  const h = herb(speciesId);
  if (!h) return [];
  const genus = (x) => (x.latin || x.name).split(' ')[0];
  const all = [...HERB.values()].filter((x) => x.id !== h.id);
  const same = (x) => (genus(x) === genus(h) ? 2 : x.family === h.family ? 1 : 0);
  const named = h.lookalike ? all.filter((x) => x.id === h.lookalike) : [];
  return [...named, ...all.filter((x) => same(x) > 0 && x.id !== h.lookalike).sort((a, b) => same(b) - same(a) || a.id.localeCompare(b.id))]
    .slice(0, limit)
    .map((x) => ({ id: x.id, name: x.name, latin: x.latin, why: genus(x) === genus(h) ? 'same genus' : 'same family' }));
}
