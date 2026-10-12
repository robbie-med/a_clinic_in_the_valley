// world.js — the valley as you have changed it. The region is regenerated from the seed on load;
// only diffs are saved: objects/ground you changed (by string key) and per-tile state (picked plants
// regrowing, racks drying herbs, jars steeping, gardens growing, containers' contents).
import { createRegion, plantPotency, HABITATS } from './region.js';
import { makeInv, addItem } from './inventory.js';
import { DAY, HOUR, season, raining, inSeason } from './time.js';
import { DRY_HOURS } from './content/preparations.js';
import { hashf } from './rng.js';

export const WORLD_VERSION = 1;

export class World {
  constructor(C, meta, record = null) {
    this.C = C;
    this.meta = meta;
    this.R = createRegion(meta.seed, C);
    this.N = this.R.N;
    this.mods = new Map();   // i → { o?, g? }
    this.st = new Map();     // i → state
    this.dirty = true;
    if (record) this.applyRecord(record);
    this.lastSim = record?.t ?? meta.time;
  }
  get time() { return this.meta.time; }
  idx(x, y) { return y * this.N + x; }
  inb(x, y) { return x >= 0 && y >= 0 && x < this.N && y < this.N; }

  ground(x, y) { return this.inb(x, y) ? this.R.gKeys[this.R.ground[this.idx(x, y)]] : 'deep'; }
  groundDef(x, y) { return this.C.grounds.get(this.ground(x, y)); }
  obj(x, y) { if (!this.inb(x, y)) return null; const o = this.R.obj[this.idx(x, y)]; return o ? this.R.oKeys[o] : null; }
  objDef(x, y) { const o = this.obj(x, y); return o ? this.C.objects.get(o) : null; }
  state(x, y) { return this.st.get(this.idx(x, y)) || null; }
  habitat(x, y) { return HABITATS[this.R.hab[this.idx(x, y)]]; }

  setObj(x, y, key, st) {
    const i = this.idx(x, y);
    const m = this.mods.get(i) || {};
    m.o = key; this.mods.set(i, m);
    this.R.obj[i] = key ? this.R.oIdx.get(key) : 0;
    if (st !== undefined) { if (st) this.st.set(i, st); else this.st.delete(i); }
    this.dirty = true; this.onChange?.(x, y);
  }
  setGround(x, y, key) {
    const i = this.idx(x, y);
    const m = this.mods.get(i) || {};
    m.g = key; this.mods.set(i, m);
    this.R.ground[i] = this.R.gIdx.get(key);
    this.dirty = true; this.onChange?.(x, y);
  }
  setState(x, y, st) { const i = this.idx(x, y); if (st) this.st.set(i, st); else this.st.delete(i); this.dirty = true; this.onChange?.(x, y); }

  passable(x, y) {
    if (!this.inb(x, y)) return false;
    const g = this.groundDef(x, y);
    if (!g || g.water === 'deep') return false;
    const o = this.objDef(x, y);
    if (o && (o.door || o.blocks === false)) return true;
    return !(o && o.blocks);
  }
  /** Picked plants show as bare until they regrow; out-of-season plants have nothing to give. */
  plantReady(x, y) {
    const o = this.objDef(x, y);
    if (!o || o.kind !== 'plant') return false;
    const s = this.state(x, y);
    if (s?.regrowAt && this.time < s.regrowAt) return false;
    return inSeason(o.seasons, this.time);
  }
  plantPotency(x, y) { return plantPotency(this.R.seed, x, y); }
  indoor(x, y) { return !!this.groundDef(x, y)?.indoor; }

  /** Container inventory of an object (shelf, rack, jar), created on first use. */
  container(x, y) {
    const def = this.objDef(x, y);
    if (!def?.container && !def?.brews) return null;
    let s = this.state(x, y);
    if (!s) { s = {}; this.st.set(this.idx(x, y), s); }
    if (!s.inv && def.container) s.inv = makeInv(def.container);
    this.dirty = true;
    return s;
  }
  /** Every stock shelf's inventory (dispensing draws on these). */
  shelves() {
    const out = [];
    for (const [i, s] of this.st) {
      const x = i % this.N, y = Math.floor(i / this.N);
      if (this.objDef(x, y)?.stock && s.inv) out.push({ x, y, inv: s.inv });
    }
    return out;
  }

  // ——— time passing: regrowth, drying, steeping, gardens
  catchUp() {
    const now = this.time;
    if (now - this.lastSim < 10) return [];
    const ev = [];
    for (const [i, s] of [...this.st]) {
      const x = i % this.N, y = Math.floor(i / this.N);
      const def = this.objDef(x, y);
      if (s.regrowAt && now >= s.regrowAt) { delete s.regrowAt; if (!Object.keys(s).length) this.st.delete(i); this.onChange?.(x, y); }
      if (def?.dries && s.inv) this.dry(s, x, y, now, ev);
      if (def?.brews && s.brew && now >= s.brew.readyAt && !s.brew.done) { s.brew.done = true; ev.push({ kind: 'brewed', x, y, text: `${this.C.items.get(s.brew.out).name} is ready.` }); this.onChange?.(x, y); }
      if (def?.garden && s.plant && now >= s.plant.readyAt) { this.setObj(x, y, 'plant_' + s.plant.herb, null); ev.push({ kind: 'grown', x, y, text: `${this.C.items.get('fresh_' + s.plant.herb).name.split(' (')[0]} is ready in the garden.` }); }
    }
    this.lastSim = now;
    this.dirty = true;
    return ev;
  }
  dry(s, x, y, now, ev) {
    const C = this.C;
    s.since ||= {};
    for (let k = 0; k < s.inv.slots.length; k++) {
      const st = s.inv.slots[k];
      if (!st || !st.id.startsWith('fresh_')) continue;
      const herb = st.id.slice(6);
      if (!C.items.has('dried_' + herb)) continue;
      st.at ??= now;
      const need = DRY_HOURS[season(st.at)] * HOUR;
      if (now - st.at < need) continue;
      // mould: drying in the rains under the open sky
      const wet = !this.indoor(x, y) && (season(st.at) === 'rains' || season(st.at) === 'late_rains');
      const mould = wet && hashf(this.R.seed, x * 31 + k, Math.floor(st.at), 5) < 0.35;
      s.inv.slots[k] = mould ? null : { id: 'dried_' + herb, n: st.n, q: (st.q ?? 1) * 0.95, t: now };
      ev.push({ kind: 'dried', x, y, text: mould ? `The ${C.items.get(st.id).name.toLowerCase()} went mouldy on the rack in the damp.` : `${C.items.get('dried_' + herb).name} is dry.` });
    }
  }

  // ——— persistence: one record for the whole valley
  toRecord() {
    const m = {}, st = {};
    for (const [i, v] of this.mods) m[i] = v;
    for (const [i, v] of this.st) st[i] = v;
    return { k: 'valley', m, st, t: this.lastSim };
  }
  applyRecord(rec) {
    for (const [i, v] of Object.entries(rec.m || {})) {
      const k = +i;
      this.mods.set(k, v);
      if (v.g !== undefined && this.R.gIdx.has(v.g)) this.R.ground[k] = this.R.gIdx.get(v.g);
      if (v.o !== undefined) this.R.obj[k] = v.o && this.R.oIdx.has(v.o) ? this.R.oIdx.get(v.o) : 0;
    }
    for (const [i, v] of Object.entries(rec.st || {})) this.st.set(+i, v);
  }
}

/** Put the starting furniture into the clinic hut (first load of a new world). */
export function furnishClinic(W) {
  const c = W.R.clinic;
  const place = (x, y, key) => { if (!W.obj(x, y)) W.setObj(x, y, key, null); };
  place(c.x0 + 1, c.y0 + 1, 'shelf');
  place(c.x0 + 2, c.y0 + 1, 'shelf');
  place(c.x0 + c.w - 2, c.y0 + 1, 'exam_bed');
  place(c.x0 + c.w + 1, c.y0 + 2, 'hearth');
  place(c.x0 + c.w + 1, c.y0 + 4, 'drying_rack');
  for (let k = 0; k < 3; k++) place(c.out.x - 3 + k, c.out.y + 2, 'bench');
  const s = W.container(c.x0 + 1, c.y0 + 1);
  for (const [id, n] of [['salt', 200], ['sugar', 400], ['cloth', 6], ['soap', 2], ['honey', 250]]) addItem(s.inv, W.C, id, n, { q: 1, t: W.time });
}
