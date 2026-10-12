// noise.js — seeded simplex fields (simplex-noise by Jonas Wagner, vendored) and fractal helpers.
import { createNoise2D } from '../../vendor/simplex-noise.js';
import { makeRng } from './rng.js';

/** A 2D noise function seeded by (seed, name): n(x, y) → [-1, 1].
 *  Each field is shifted by a seeded offset: simplex noise is exactly 0 on its lattice points, so
 *  without the shift every world would have the same features (e.g. a river) through the origin. */
export function field(seed, name) {
  const rng = makeRng(seed, name, 'offset');
  const ox = 1000 + rng() * 9000, oy = 1000 + rng() * 9000;
  const n = createNoise2D(makeRng(seed, name));
  return (x, y) => n(x + ox, y + oy);
}

/** Fractal Brownian motion, normalised to about [-1, 1]. */
export function fbm(n, x, y, octaves = 4, lac = 2, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * n(x * freq, y * freq);
    norm += amp; amp *= gain; freq *= lac;
  }
  return sum / norm;
}

/** Ridged noise in [0, 1]: sharp crests where the base noise crosses zero (mountain spines). */
export function ridged(n, x, y, octaves = 4) {
  let amp = 0.5, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const v = 1 - Math.abs(n(x * freq, y * freq));
    sum += amp * v * v; norm += amp; amp *= 0.5; freq *= 2.1;
  }
  return sum / norm;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const lerp = (a, b, t) => a + (b - a) * t;
