// index.js — builds every item, recipe, world object and ground from the small tables beside it.
// Ids are stable strings (saves use them): fresh_<herb>, dried_<herb>, powder_<herb>,
// <method>_<herb> for liquid preparations, the specials by their own id, goods by theirs.
import { HERBS, HERB } from './herbs.js';
import { FLORA_HERBS, CLIMATE } from './flora_herbs.js';
import { MATERIA } from './materia.js';
import { ACTIVE } from './actives.js';
import { METHODS, EXTRACT, HERB_METHODS, SPECIALS } from './preparations.js';
import { INGREDIENTS, TOOLS, MATERIALS, PRODUCE } from './goods.js';
import { PLACEABLES } from './build.js';
import { MEDICINES } from './medicines.js';
import { pixelIcon } from './pixel_icons.js';

const mid = ([a, b]) => (a + b) / 2;

/** Nominal mg of each systemic/gut active per unit (g or ml) of a herb preparation. */
export function nominalActives(herb, method) {
  const out = {};
  for (const [id, range] of Object.entries(herb.contains)) {
    const a = ACTIVE.get(id);
    if (!a || a.channel === 'topical') continue;
    const mgPerGdry = mid(range) * 10;           // % of dry weight → mg per g
    if (method === 'powder') out[id] = mgPerGdry * (EXTRACT.powder[id] ?? 0.8);
    else {
      const m = METHODS[method];
      out[id] = (mgPerGdry * (EXTRACT[method]?.[id] ?? 0)) / m.mlPerG;
    }
    out[id] = Math.round(out[id] * 10000) / 10000;
  }
  return out;
}

export function buildContent() {
  const items = new Map(), recipes = [], tags = new Map(), objects = new Map(), grounds = new Map();
  const C = { items, recipes, tags, objects, grounds, herbs: HERBS, flora: FLORA_HERBS };
  const add = (it) => {
    if (items.has(it.id)) throw new Error('duplicate item ' + it.id);
    it.tags ||= []; it.stack ??= it.unit ? 5000 : 50; it.price ??= 0.5; it.cat ||= 'misc';
    items.set(it.id, it);
    for (const t of it.tags) { if (!tags.has(t)) tags.set(t, []); tags.get(t).push(it.id); }
    return it;
  };
  const gi = (name, c) => ({ gi: name, c });

  // ——— herbs: fresh, dried, powder, liquids. The same loop builds the world's flora (flora_herbs.js),
  // whose methods come from the part used rather than a hand-written list.
  for (const h of [...HERBS, ...FLORA_HERBS]) {
    const hMethods = h.methods || HERB_METHODS[h.id] || [];
    const dryG = h.unit.g * h.dry;
    const rarity = h.flora ? 2 : h.density < 0.01 ? 3 : h.density < 0.02 ? 1.6 : 1;
    const base = { herb: h.id, dryG, contains: h.contains, icon: gi(h.icon, h.color) };
    add({ ...base, id: 'fresh_' + h.id, name: `${h.name} ${h.part} (fresh)`, cat: 'herb', form: 'fresh', unitName: h.unit.name, stack: 40, price: 0.3 * rarity, shelfDays: 3,
      tags: ['herb', 'herb_' + h.id, 'fresh'] });
    if (hMethods.includes('dry') || h.id === 'neem' || h.id === 'eucalyptus')
      add({ ...base, id: 'dried_' + h.id, name: `${h.name} ${h.part} (dried)`, cat: 'herb', form: 'dried', unitName: h.unit.name, stack: 60, price: 0.5 * rarity, shelfDays: 240,
        icon: gi(h.icon, shadeHex(h.color, 0.7)), tags: ['herb', 'herb_' + h.id, 'dried'] });
    for (const m of hMethods) {
      if (m === 'dry') continue;
      const M = METHODS[m];
      const id = (m === 'powder' ? 'powder_' : m + '_') + h.id;
      const actives = nominalActives(h, m);
      add({ id, name: `${h.name} ${M.name.toLowerCase()}`, cat: 'remedy', herb: h.id, method: m, unit: M.unit, stack: M.unit === 'ml' ? 5000 : 2000,
        price: (0.5 * rarity) / (m === 'powder' ? dryG : dryG * M.mlPerG) * 1.5, shelfDays: M.shelfDays, actives, route: ['oral'],
        bitter: h.flora ? !!(h.contains.tannin || h.contains.berberine || h.contains.quinine) : h.id === 'cinchona' || h.id === 'artemisia' || h.id === 'willow', icon: gi(m === 'powder' ? 'powder-bag' : m === 'tincture' ? 'vial' : 'teapot-leaves', h.color),
        tags: ['remedy', 'remedy_' + h.id] });
      const spec = m === 'powder' || m === 'tincture' ? 'dried_' + h.id : '#herb_' + h.id;
      const inputs = [[spec, 1], ...(M.extra || [])];
      if (M.spirit) inputs.push(['spirit', Math.round(dryG * M.spirit)]);
      recipes.push({ id: 'make_' + id, out: id, method: m, herb: h.id, in: inputs, station: M.station || null, tool: M.tool || null, min: M.min, hours: M.hours || 0,
        yields: m === 'powder' ? dryG : dryG * M.mlPerG });
    }
  }
  // ——— hand preparations
  for (const s of SPECIALS) {
    const it = { id: s.id, name: s.name, cat: 'remedy', unit: s.unit, stack: s.unit === 'app' ? 40 : 5000, shelfDays: s.shelfDays, note: s.note, icon: gi(s.icon, s.color), tags: ['remedy'] };
    if (s.topical) { it.topical = s.topical; it.route = ['topical']; }
    if (s.fluid) { it.fluid = { na: s.fluid.na ?? 47 }; it.route = ['oral']; }
    if (s.oralFrom) {
      const g = INGREDIENTS.find((x) => x.id === s.oralFrom);
      const act = {};
      for (const [id, r] of Object.entries(g.contains)) act[id] = Math.round((mid(r) * 10 * g.unitG * g.dryFrac) / s.n * 10000) / 10000;
      it.actives = act; it.route = ['oral'];
    }
    it.price = s.unit === 'ml' ? 0.002 : 0.8;
    add(it);
    recipes.push({ id: 'make_' + s.id, out: s.id, special: true, in: s.from, station: s.station || null, tool: s.tool || null, min: s.min, yields: s.n, hours: 0 });
  }
  // ——— goods
  for (const g of INGREDIENTS) {
    const it = add({ ...g, cat: 'ingredient', icon: gi(g.icon, g.color), tags: ['ingredient'] });
    if (g.id === 'honey') { it.actives = { honey: 1000 }; it.topical = { honey: 1 }; it.route = ['oral', 'topical']; it.appG = 15; }
  }
  for (const m of MEDICINES) add({ ...m, cat: 'medicine', route: m.route ?? (m.topical ? ['topical'] : ['oral']), icon: gi(m.icon, m.color), tags: ['medicine'] });
  for (const t of TOOLS) add({ ...t, cat: 'tool', stack: 1, tool: t.id, icon: gi(t.icon, t.color), tags: ['tool'] });
  for (const m of MATERIALS) add({ ...m, cat: 'material', icon: gi(m.icon, m.color), tags: ['material'] });
  for (const p of PRODUCE) add({ ...p, cat: 'produce', icon: gi(p.icon, p.color), tags: ['produce'] });

  // ——— garden: seeds and cuttings
  const plantables = [['cutting_aloe', 'Aloe cutting', 'aloe', 6, 'seedling'], ['seed_artemisia', 'Sweet wormwood seed', 'artemisia', 10, 'plant-seed'],
    ['seed_foxglove', 'Foxglove seed', 'foxglove', 20, 'plant-seed'], ['seed_cornsilk', 'Maize seed', 'cornsilk', 14, 'plant-seed']];
  for (const [id, name, herb, days, icon] of plantables) add({ id, name, cat: 'seed', plant: herb, growDays: days, stack: 40, price: id === 'seed_foxglove' ? 1.2 : 0.4, icon: gi(icon, HERB.get(herb).color), tags: ['seed'] });
  items.get('fresh_ginger').plant = 'ginger'; items.get('fresh_ginger').growDays = 12;

  // ——— buildables: an item you place, an object in the world, a workbench recipe
  for (const b of PLACEABLES) {
    add({ id: b.id, name: b.name, cat: 'build', stack: 20, price: b.price, note: b.note, place: b.floor ? { ground: b.ground } : { obj: b.id },
      icon: b.sprite?.gi ? b.sprite : b.sprite?.d ? { d: b.sprite.d, t: b.sprite.t } : gi('stone-path', '#a08060'), tags: ['build'] });
    if (!b.floor) objects.set(b.id, { key: b.id, name: b.name, kind: b.wall ? 'wall' : b.door ? 'door' : 'built', built: true, item: b.id, ...b });
    recipes.push({ id: 'make_' + b.id, out: b.id, build: true, in: b.cost, station: b.id === 'workbench' || b.floor || b.wall || b.id === 'hearth' || b.id === 'herb_bed' ? null : 'bench', tool: null, min: 20, yields: 1, hours: 0 });
  }

  // ——— the import trade: dried material and seed of every species in the world table, priced by how
  // far it has to come (how badly the valley's climate suits it stands in for distance) and arriving in
  // weeks, not days (economy.js). Seed can be planted; it grows as well as the climate allows.
  const GROW = { tree: 60, shrub: 30, climber: 20, succulent: 25, epiphyte: 25, geophyte: 20, herb: 10 };
  for (const h of FLORA_HERBS) {
    const zone = 1 + Math.round((1 - CLIMATE[h.climate].fit) * 4);
    for (const id of ['dried_' + h.id, 'powder_' + h.id]) {
      const it = items.get(id);
      if (!it) continue;
      it.import = true; it.zone = zone; it.price = Math.round(it.price * (1 + 0.35 * zone) * 100) / 100;
    }
    add({ id: 'seed_' + h.id, name: `${h.name} seed`, cat: 'seed', plant: h.id, growDays: GROW[h.life] || 14, stack: 40,
      price: Math.round((0.4 + 0.3 * zone) * 100) / 100, import: true, zone, icon: gi('plant-seed', h.color), tags: ['seed'],
      note: `Sown in a garden bed. ${CLIMATE[h.climate].name.replace(/^./, (c) => c.toUpperCase())} species: here it will grow ${CLIMATE[h.climate].fit >= 0.9 ? 'well' : CLIMATE[h.climate].fit >= 0.6 ? 'fairly well' : CLIMATE[h.climate].fit >= 0.4 ? 'poorly' : 'badly, and weak'}.` });
  }

  // ——— non-plant materia medica: import only (materia.js)
  for (const m of MATERIA) add({ ...m, cat: 'materia', route: m.topical ? ['topical'] : ['oral'], import: true, zone: m.distance ?? 3, icon: gi(m.icon, m.color), tags: ['materia'] });

  // ——— the wild: medicinal plants, scenery, the village
  for (const h of [...HERBS, ...FLORA_HERBS]) objects.set('plant_' + h.id, { key: 'plant_' + h.id, name: h.name, kind: 'plant', herb: h.id, tree: !!h.tree, blocks: !!h.tree, sprite: { d: h.sprite, t: h.tint },
    harvest: 'fresh_' + h.id, regrowDays: h.regrowDays, tool: h.tool, seasons: h.seasons });
  const O = (key, def) => objects.set(key, { key, ...def });
  for (let i = 1; i <= 13; i++) O('tree_' + i, { name: 'Tree', kind: 'tree', blocks: true, sprite: { d: 'dngn/trees/tree' + i }, gives: ['pole', 1], tool: 'knife', regrowDays: 10 });
  O('mangrove', { name: 'Swamp tree', kind: 'tree', blocks: true, sprite: { d: 'dngn/trees/mangrove1' } });
  O('bush', { name: 'Bush', kind: 'bush', blocks: false, sprite: { d: 'mon/fungi_plants/bush3' } });
  O('tall_grass', { name: 'Tall grass', kind: 'grass', blocks: false, sprite: { d: 'mon/fungi_plants/plant_01', t: '#d8c878' }, gives: ['thatch', 1], tool: 'knife', regrowDays: 5 });
  O('rock', { name: 'Rock', kind: 'rock', blocks: true, sprite: { gi: 'stone-pile', c: '#8a8478' } });
  O('house_wall', { name: 'House wall', kind: 'wall', blocks: true, sprite: { d: 'dngn/wall/sandstone_wall0', t: '#c89870' } });
  O('house_door', { name: 'Door', kind: 'door', door: true, blocks: false, sprite: { d: 'dngn/doors/open_door' } });
  O('clinic_wall', { name: 'Clinic wall', kind: 'wall', blocks: true, built: true, sprite: { d: 'dngn/wall/sandstone_wall1', t: '#f4ece0' } });
  O('clinic_door', { name: 'Clinic door', kind: 'door', door: true, blocks: false, sprite: { d: 'dngn/doors/open_door' } });
  O('well', { name: 'Well', kind: 'well', blocks: true, sprite: { gi: 'well', c: '#8a9aaa' } });
  O('stall', { name: 'Market stall', kind: 'stall', blocks: true, sprite: { gi: 'table', c: '#c09050' } });
  O('crop', { name: 'Maize', kind: 'crop', blocks: false, sprite: { gi: 'corn', c: '#d0c050' } });
  O('sprout', { name: 'Young plant', kind: 'sprout', blocks: false, sprite: { gi: 'sprout', c: '#6ab04a' } });
  O('sign', { name: 'Clinic sign', kind: 'sign', blocks: true, sprite: { gi: 'hospital-cross', c: '#e04040' } });

  // ——— grounds
  const G = (key, def) => grounds.set(key, { key, walk: 1, ...def });
  const range = (base, n, from = 0) => Array.from({ length: n }, (_, i) => base + (i + from));
  G('grass', { name: 'Grass', sprites: range('dngn/floor/grass/grass', 6), color: '#5c8a3c' });
  G('dry_grass', { name: 'Dry grass', sprites: range('dngn/floor/grass/grass', 6), tint: '#d8c890', color: '#a8a060' });
  G('forest_floor', { name: 'Forest floor', sprites: range('dngn/floor/grass/grass-dark', 6), color: '#2f5a28' });
  G('highland', { name: 'Highland', sprites: range('dngn/floor/grass/grass', 6), tint: '#a8d0b0', color: '#6a9a6a' });
  G('rock', { name: 'Rock', sprites: range('dngn/floor/limestone', 10), color: '#9a948a' });
  G('dirt', { name: 'Bare earth', sprites: range('dngn/floor/dirt', 3), color: '#8a6a4a' });
  G('field', { name: 'Field', sprites: ['dngn/floor/dirt_full'], tint: '#a08060', color: '#7a5a3a' });
  G('path', { name: 'Path', sprites: range('dngn/floor/sand', 8, 1), tint: '#c8a070', color: '#b09a70', walk: 1.2 });
  G('yard', { name: 'Yard', sprites: range('dngn/floor/sand', 8, 1), tint: '#d8b888', color: '#c8a878', walk: 1.1 });
  G('clinic_floor', { name: 'Clinic floor', sprites: range('dngn/floor/sand', 8, 1), tint: '#fff4e4', color: '#d8c8a8', walk: 1.1, indoor: true });
  G('house_floor', { name: 'House floor', sprites: range('dngn/floor/dirt', 3), tint: '#d8b898', color: '#b09070', indoor: true });
  G('sand', { name: 'Sand', sprites: range('dngn/floor/sand', 8, 1), color: '#d8c080', walk: 0.9 });
  G('mud', { name: 'Mud', sprites: range('dngn/floor/mud', 4), color: '#5a4a3a', walk: 0.7 });
  G('swamp', { name: 'Swamp', sprites: range('dngn/floor/swamp', 4), color: '#4a5a3a', walk: 0.6 });
  G('shallow', { name: 'Shallow water', sprites: ['dngn/water/shallow_water', 'dngn/water/shallow_water2'], color: '#4a8ab0', walk: 0.5, water: 'shallow' });
  G('deep', { name: 'Deep water', sprites: ['dngn/water/deep_water', 'dngn/water/deep_water2'], color: '#2a5a8a', walk: 0, water: 'deep' });
  for (const it of items.values()) { const px = pixelIcon(it); if (px) it.icon = px; }  // pixel art where the table has it
  return C;
}

function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f))).toString(16).padStart(2, '0');
  return '#' + c(16) + c(8) + c(0);
}
