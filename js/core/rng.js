// rng.js — deterministic randomness. Same seed + same coordinates = same answer, forever.
// Alea (vendored) for sequences; an integer hash for per-tile decisions (fast, stateless).
import Alea from '../../vendor/alea.js';

/** A seeded sequence: rng() → [0,1). Pass any number of parts (strings/numbers). */
export const makeRng = (...parts) => Alea(...parts.map(String));

/** FNV-1a string → uint32. */
export function strHash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** Stateless hash of (seed, x, y, salt) → uint32 (murmur3 finaliser). */
export function hash(seed, x, y, salt = 0) {
  let h = (seed ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
/** Same, as a float in [0,1). */
export const hashf = (seed, x, y, salt = 0) => hash(seed, x, y, salt) / 4294967296;

/** Pick from an array with a [0,1) roll. */
export const pickBy = (arr, r) => arr[Math.min(arr.length - 1, Math.floor(r * arr.length))];

/** Weighted pick: entries [[value, weight], ...]. */
export function weighted(entries, r) {
  let total = 0;
  for (const e of entries) total += e[1];
  let t = r * total;
  for (const e of entries) { t -= e[1]; if (t < 0) return e[0]; }
  return entries[entries.length - 1][0];
}
