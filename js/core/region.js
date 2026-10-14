// region.js — the valley, as a pure function of the seed. A bounded map (SIZE × SIZE tiles): highlands
// in one corner, a river running down from them, swamp where it slows, forest where it is wet, dry
// scrub where it is not, the village with its market and your clinic, and hamlets along the paths.
// Generated whole at load (it is small); the World keeps only what you change.
import { field, fbm, clamp, smooth } from './noise.js';
import { hash, hashf, makeRng, pickBy } from './rng.js';
import { HERBS } from './content/herbs.js';
import { valleyFlora, FLORA_COVER } from './flora.js';
import { expand } from './lore.js';

export const SIZE = 160;
export const HABITATS = ['village', 'field', 'scrub', 'forest', 'riverbank', 'swamp', 'highland'];

const NAMES = {
  origin: ['#a##b#', '#a##c#', '#d##b#'],
  a: ['Ki', 'Ma', 'Nya', 'Bu', 'Lu', 'Ka', 'Mwa', 'Ru', 'Tu', 'Ndo', 'Si', 'Ki', 'Mu'],
  b: ['bale', 'senga', 'rongo', 'tama', 'lindi', 'wani', 'kuru', 'sozi', 'nanga', 'pera'],
  c: ['ni', 'wa', 'to', 'mbe'], d: ['Ngo', 'Ba', 'Za', 'Ho'],
};

export function createRegion(seed, C) {
  const S = seed >>> 0;
  const N = SIZE;
  const gKeys = [...C.grounds.keys()], gIdx = new Map(gKeys.map((k, i) => [k, i]));
  const oKeys = [null, ...C.objects.keys()], oIdx = new Map(oKeys.map((k, i) => [k, i]));
  const ground = new Uint8Array(N * N), obj = new Uint16Array(N * N), hab = new Uint8Array(N * N);
  const I = (x, y) => y * N + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const setG = (x, y, k) => { if (inb(x, y)) ground[I(x, y)] = gIdx.get(k); };
  const setO = (x, y, k) => { if (inb(x, y)) obj[I(x, y)] = k ? oIdx.get(k) : 0; };
  const getG = (x, y) => gKeys[ground[I(x, y)]];
  const rng = makeRng(S, 'region');
  const nMoist = field(S, 'moist'), nElev = field(S, 'elev'), nWarp = field(S, 'warp'), nDetail = field(S, 'detail');

  // ——— highlands in a corner; the river starts there and runs to the far edge
  const corner = Math.floor(rng() * 4);
  const hx = corner % 2 ? N - 1 : 0, hy = corner < 2 ? 0 : N - 1;
  const elev = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const dc = Math.hypot(x - hx, y - hy) / N;
    elev[I(x, y)] = clamp(1.15 - dc * 1.6 + fbm(nElev, x / 40, y / 40, 4) * 0.35, 0, 1);
  }
  // river: a wobbling line from near the highland corner to the opposite side
  const river = [];
  const sx = Math.abs(hx - N * 0.18), sy = Math.abs(hy - N * 0.18);
  const ex = N - 1 - hx + (hx ? 1 : -1) * N * 0.1 * rng(), ey = N - 1 - hy;
  for (let i = 0; i <= 400; i++) {
    const t = i / 400;
    const bx = sx + (ex - sx) * t, by = sy + (ey - sy) * t;
    const w = nWarp(t * 3.5, 0.5) * 22 + nWarp(t * 9, 4.1) * 6;
    const nx = -(ey - sy), ny = ex - sx, nl = Math.hypot(nx, ny);
    river.push([bx + (nx / nl) * w, by + (ny / nl) * w]);
  }
  const riverDist = new Float32Array(N * N).fill(1e9);
  for (const [rx, ry] of river) {
    const x0 = Math.max(0, Math.floor(rx - 12)), x1 = Math.min(N - 1, Math.ceil(rx + 12)), y0 = Math.max(0, Math.floor(ry - 12)), y1 = Math.min(N - 1, Math.ceil(ry + 12));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const d = Math.hypot(x - rx, y - ry); if (d < riverDist[I(x, y)]) riverDist[I(x, y)] = d; }
  }

  // ——— base terrain and habitats
  const H = (name) => HABITATS.indexOf(name);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = I(x, y), e = elev[i], rd = riverDist[i];
    const m = fbm(nMoist, x / 30, y / 30, 4) + (rd < 14 ? (14 - rd) / 20 : 0) - e * 0.2;
    let g = 'grass', h = 'field';
    if (e > 0.72) { g = e > 0.88 && nDetail(x / 6, y / 6) > 0.35 ? 'rock' : 'highland'; h = 'highland'; }
    else if (rd < 1.4 + e * 0.6) { g = 'deep'; h = 'riverbank'; }
    else if (rd < 2.6) { g = 'shallow'; h = 'riverbank'; }
    else if (rd < 4.5) { g = m > 0.3 && e < 0.45 ? 'mud' : 'sand'; h = 'riverbank'; }
    else if (m > 0.42 && e < 0.4 && rd < 18) { g = 'swamp'; h = 'swamp'; }
    else if (m > 0.18) { g = 'forest_floor'; h = 'forest'; }
    else if (m < -0.2) { g = 'dry_grass'; h = 'scrub'; }
    setG(x, y, g); hab[i] = H(h);
  }

  // ——— the village: dry ground within reach of the river, away from the highland corner
  let best = null;
  for (let k = 0; k < 400; k++) {
    const x = 40 + Math.floor(rng() * (N - 80)), y = 40 + Math.floor(rng() * (N - 80));
    const rd = riverDist[I(x, y)];
    if (rd < 9 || rd > 20 || elev[I(x, y)] > 0.6) continue;
    const score = -Math.abs(rd - 12) - Math.hypot(x - N / 2, y - N / 2) * 0.15;
    if (!best || score > best.score) best = { x, y, score };
  }
  best ||= { x: N >> 1, y: N >> 1 };
  const V = { x: best.x, y: best.y };
  const clear = (x0, y0, x1, y1, g = 'yard') => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (inb(x, y)) { setG(x, y, g); setO(x, y, null); hab[I(x, y)] = H('village'); }
  };
  clear(V.x - 13, V.y - 11, V.x + 13, V.y + 11, 'yard');
  // market square with stalls and the well
  const square = { x: V.x, y: V.y };
  for (let y = -3; y <= 3; y++) for (let x = -4; x <= 4; x++) setG(V.x + x, V.y + y, 'path');
  setO(V.x, V.y, 'well');
  const stalls = [[-3, -2], [3, -2], [-3, 2], [3, 2]].map(([dx, dy]) => { setO(V.x + dx, V.y + dy, 'stall'); return { x: V.x + dx, y: V.y + dy + (dy < 0 ? -1 : 1) }; });
  // houses: rectangle walls with a door
  const houses = [];
  const house = (x0, y0, w, h, doorSide, kind = 'house') => {
    const wall = kind === 'clinic' ? 'clinic_wall' : 'house_wall', door = kind === 'clinic' ? 'clinic_door' : 'house_door';
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (!inb(x, y)) continue;
      const edge = x === x0 || y === y0 || x === x0 + w - 1 || y === y0 + h - 1;
      setG(x, y, kind === 'clinic' ? 'clinic_floor' : 'house_floor');
      setO(x, y, edge ? wall : null);
      hab[I(x, y)] = H('village');
    }
    const dx = doorSide === 'S' ? x0 + (w >> 1) : doorSide === 'N' ? x0 + (w >> 1) : doorSide === 'W' ? x0 : x0 + w - 1;
    const dy = doorSide === 'S' ? y0 + h - 1 : doorSide === 'N' ? y0 : y0 + (h >> 1);
    setO(dx, dy, door);
    const out = { x: dx + (doorSide === 'W' ? -1 : doorSide === 'E' ? 1 : 0), y: dy + (doorSide === 'S' ? 1 : doorSide === 'N' ? -1 : 0) };
    const hs = { x0, y0, w, h, door: { x: dx, y: dy }, out, kind };
    houses.push(hs);
    return hs;
  };
  // the clinic: north of the square, door facing it
  const clinic = house(V.x - 4, V.y - 11, 9, 6, 'S', 'clinic');
  clinic.inside = { x: V.x, y: V.y - 8 };
  clinic.wait = { x: V.x - 3, y: V.y - 4 };
  setO(V.x + 3, V.y - 4, 'sign');
  // the shop (duka): east of the square
  const duka = house(V.x + 7, V.y - 2, 5, 5, 'W');
  duka.inside = { x: V.x + 9, y: V.y };
  // village houses
  for (const [dx, dy, side] of [[-12, -4, 'E'], [-12, 3, 'E'], [6, 6, 'N'], [-6, 6, 'N'], [8, -10, 'S'], [-11, -10, 'S']]) house(V.x + dx, V.y + dy, 5, 4, side);

  // ——— hamlets out in the valley
  const hamlets = [];
  for (let k = 0, tries = 0; k < 6 && tries < 600; tries++) {
    const a = rng() * Math.PI * 2, r = 30 + rng() * 45;
    const x = Math.round(V.x + Math.cos(a) * r), y = Math.round(V.y + Math.sin(a) * r);
    if (x < 8 || y < 8 || x > N - 9 || y > N - 9) continue;
    const g = getG(x, y);
    if (g === 'deep' || g === 'shallow' || riverDist[I(x, y)] < 6) continue;
    if (hamlets.some((h) => Math.hypot(h.x - x, h.y - y) < 22)) continue;
    const nh = 3 + Math.floor(rng() * 3);
    clear(x - 7, y - 6, x + 7, y + 6, 'yard');
    const hh = [];
    for (let j = 0; j < nh; j++) {
      const hx2 = x - 6 + (j % 3) * 5, hy2 = y - 5 + Math.floor(j / 3) * 6;
      hh.push(house(hx2, hy2, 4, 4, 'S'));
    }
    // malaria where there is standing water; diarrhoea where the river is the water source
    let swamp = 0;
    for (let yy = y - 14; yy <= y + 14; yy++) for (let xx = x - 14; xx <= x + 14; xx++) if (inb(xx, yy) && getG(xx, yy) === 'swamp') swamp++;
    const name = cap(expand('#origin#', NAMES, makeRng(S, 'hamlet', k)));
    hamlets.push({ id: 'h' + k, name, x, y, houses: hh, mosquito: clamp(0.25 + swamp / 120 + (elev[I(x, y)] < 0.35 ? 0.2 : 0) - elev[I(x, y)] * 0.4, 0.05, 1),
      water: clamp(1 - riverDist[I(x, y)] / 40, 0.1, 1), crowd: clamp(nh / 6, 0.3, 1), wealth: clamp(0.25 + rng() * 0.5, 0.1, 0.9), dist: Math.round(Math.hypot(x - V.x, y - V.y)) });
    k++;
  }
  const village = { id: 'village', name: cap(expand('#origin#', NAMES, makeRng(S, 'village'))), x: V.x, y: V.y, mosquito: 0.4, water: 0.5, crowd: 0.8, wealth: 0.5, dist: 0, houses: houses.filter((h) => h.kind === 'house') };

  // ——— paths from the square to every hamlet (fords where they cross the river)
  for (const h of hamlets) {
    let x = V.x, y = V.y;
    for (let s = 0; s < 400 && (x !== h.x || y !== h.y); s++) {
      const dx = Math.sign(h.x - x), dy = Math.sign(h.y - y);
      if (dx && (hash(S, x, y, s) % 3 !== 0 || !dy)) x += dx; else y += dy;
      for (const [ax, ay] of [[0, 0], [1, 0]]) {
        const g = getG(x + ax, y + ay);
        if (g === 'deep' || g === 'shallow') setG(x + ax, y + ay, 'shallow');
        else if (g !== 'yard' && g !== 'house_floor' && g !== 'clinic_floor' && !obj[I(x + ax, y + ay)]) setG(x + ax, y + ay, 'path');
      }
    }
  }

  // ——— fields around settlements
  const fields = [];
  for (const s of [village, ...hamlets]) {
    for (let k = 0; k < 3; k++) {
      const fx = s.x + Math.round((rng() - 0.5) * 34), fy = s.y + Math.round((rng() - 0.5) * 34);
      const fw = 6 + Math.floor(rng() * 6), fh = 5 + Math.floor(rng() * 5);
      fields.push({ s: s.id, x: fx, y: fy, w: fw, h: fh });
      for (let y = fy; y < fy + fh; y++) for (let x = fx; x < fx + fw; x++) {
        if (!inb(x, y)) continue;
        const g = getG(x, y);
        if (!['grass', 'dry_grass', 'forest_floor', 'highland'].includes(g) || obj[I(x, y)]) continue;
        setG(x, y, 'field'); hab[I(x, y)] = H('field');
        if ((x + y) % 2 === 0) setO(x, y, 'crop');
      }
    }
  }

  // ——— vegetation: medicinal plants first (by habitat), then scenery.
  // The 12 hand-written herbs grow by their own density; this valley's share of the world's flora
  // (flora.js, chosen from the seed) spreads over FLORA_COVER of the suitable tiles between them.
  const flora = valleyFlora(S);
  const herbBy = HABITATS.map((hab) => {
    const mine = flora.filter((x) => x.habitat[hab]);
    const sum = mine.reduce((a, x) => a + x.habitat[hab], 0);
    const rows = [...HERBS.filter((x) => x.habitat[hab]).map((x) => [x, x.habitat[hab] * x.density]),
      ...mine.map((x) => [x, (x.habitat[hab] * FLORA_COVER) / (sum || 1)])];
    let acc = 0;
    const cum = rows.map(([x, w]) => [x, (acc += w)]);
    return { total: acc, cum };
  });
  const count = Object.fromEntries([...HERBS, ...flora].map((h) => [h.id, 0]));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = I(x, y);
    if (obj[i]) continue;
    const g = getG(x, y);
    if (g === 'deep' || g === 'shallow' || g === 'path' || g === 'house_floor' || g === 'clinic_floor' || g === 'yard' && Math.hypot(x - V.x, y - V.y) < 14) continue;
    const habitat = HABITATS[hab[i]];
    const r = hashf(S, x, y, 11);
    const H = herbBy[hab[i]];
    if (g !== 'crop' && r < H.total) {
      for (const [herb, upto] of H.cum) if (r < upto) { setO(x, y, 'plant_' + herb.id); count[herb.id]++; break; }
      continue;
    }
    const r2 = hashf(S, x, y, 12);
    if (habitat === 'forest' && r2 < 0.22) setO(x, y, 'tree_' + (1 + hash(S, x, y, 13) % 13));
    else if (habitat === 'swamp' && r2 < 0.08) setO(x, y, 'mangrove');
    else if (habitat === 'highland' && r2 < 0.05) setO(x, y, r2 < 0.02 ? 'rock' : 'tree_' + (1 + hash(S, x, y, 13) % 13));
    else if ((habitat === 'scrub' || habitat === 'field') && r2 < 0.05) setO(x, y, r2 < 0.035 ? 'tall_grass' : 'bush');
    else if (habitat === 'riverbank' && g !== 'deep' && g !== 'shallow' && r2 < 0.04) setO(x, y, 'tall_grass');
    else if (r2 < 0.012) setO(x, y, 'tree_' + (1 + hash(S, x, y, 13) % 13));
  }
  // every herb exists somewhere: if a habitat was too small, plant a few at the best spots
  for (const h of HERBS) {
    let k = 0;
    for (let tries = 0; count[h.id] < 4 && tries < 4000; tries++) {
      const x = Math.floor(hashf(S, tries, k, 99 + h.id.length) * N), y = Math.floor(hashf(S, k, tries, 98 + h.id.length) * N);
      const i = I(x, y), g = getG(x, y);
      if (obj[i] || g === 'deep' || g === 'shallow' || g === 'path' || g.endsWith('floor') || g === 'yard') continue;
      if (!h.habitat[HABITATS[hab[i]]] && tries < 3000) continue;
      setO(x, y, 'plant_' + h.id); count[h.id]++; k++;
    }
  }
  // sand banks along the river, where clean sand can be dug (glass, content/goods.js); placed last so nothing else moves
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!obj[I(x, y)] && getG(x, y) === 'sand' && hashf(S, x, y, 41) < 0.05) setO(x, y, 'sand_bank');
  const spawn = { x: clinic.out.x + 0.5, y: clinic.out.y + 1.5 };
  // which of the world's species actually came up in this valley (the rest are trade-only)
  const floraHere = flora.filter((h) => count[h.id] > 0).map((h) => h.id);
  return { seed: S, N, ground, obj, hab, gKeys, gIdx, oKeys, oIdx, village, hamlets, clinic, duka, square, stalls, spawn, count, floraHere, riverDist, fields };
}

/** The stable per-plant strength factor: plants of one species really differ in content. */
export function plantPotency(seed, x, y) { return 0.55 + hashf(seed, x, y, 31) * 0.9; }
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export { pickBy };
