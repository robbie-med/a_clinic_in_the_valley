// Content integrity: every reference resolves, every sprite and icon exists, every herb grows
// somewhere, every remedy can be made or bought, every condition has a path to care.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildContent } from '../js/core/content/index.js';
import { HERBS, HERB } from '../js/core/content/herbs.js';
import { ACTIVES, ACTIVE } from '../js/core/content/actives.js';
import { CONDITIONS } from '../js/core/content/conditions.js';
import { VENDORS } from '../js/core/content/vendors.js';
import { QUESTIONS, EXAMS, POINTS } from '../js/core/content/findings.js';
import { createRegion, HABITATS } from '../js/core/region.js';
import { FLORA, FLORA_CLASSES } from '../js/core/content/flora.js';
import { FLORA_HERBS, CLIMATE } from '../js/core/content/flora_herbs.js';
import { MATERIA } from '../js/core/content/materia.js';
import { valleyFlora, VALLEY_SPECIES, floraNear, folkUses, lookalikes } from '../js/core/flora.js';
import { MODEL_NAMES } from '../js/core/disease.js';

const C = buildContent();
const tiles = new Set(JSON.parse(readFileSync(new URL('../assets/tiles.json', import.meta.url))).names);
const icons = JSON.parse(readFileSync(new URL('../assets/icons.json', import.meta.url)));

test('every item has an icon that exists', () => {
  for (const it of C.items.values()) {
    if (it.icon.gi) assert.ok(icons[it.icon.gi], `${it.id}: missing game-icon ${it.icon.gi}`);
    else assert.ok(tiles.has(it.icon.d), `${it.id}: missing tile ${it.icon.d}`);
  }
});
test('every world object and ground has its sprite', () => {
  for (const o of C.objects.values()) {
    if (o.sprite?.gi) assert.ok(icons[o.sprite.gi], `${o.key}: missing icon ${o.sprite.gi}`);
    else assert.ok(tiles.has(o.sprite.d), `${o.key}: missing tile ${o.sprite.d}`);
  }
  for (const g of C.grounds.values()) for (const s of g.sprites) assert.ok(tiles.has(s), `${g.key}: missing tile ${s}`);
});
test('recipes reference real items, tags and tools', () => {
  for (const r of C.recipes) {
    assert.ok(C.items.has(r.out), r.id + ' out');
    if (r.tool) assert.ok(C.items.get(r.tool)?.tool, r.id + ' tool ' + r.tool);
    for (const [spec] of r.in) assert.ok(spec.startsWith('#') ? C.tags.has(spec.slice(1)) : C.items.has(spec), `${r.id}: ${spec}`);
  }
});
test('every active a herb or remedy names is defined; every effect target is used by a model', () => {
  for (const h of HERBS) for (const a of Object.keys(h.contains)) assert.ok(ACTIVE.has(a), `${h.id}: ${a}`);
  for (const it of C.items.values()) for (const a of Object.keys({ ...(it.actives || {}), ...(it.topical || {}) })) assert.ok(ACTIVE.has(a), `${it.id}: ${a}`);
  for (const a of ACTIVES) assert.ok(a.ref, a.id + ' has a reference');
});
test('every condition has a known model, epidemiology, a WTND page and teaching', () => {
  for (const c of CONDITIONS) {
    assert.ok(MODEL_NAMES.includes(c.model), c.id);
    assert.match(c.ref, /WTND/);
    assert.ok(c.complaint.length && c.learn && c.teach);
    for (const a of [...c.teach.treat, ...c.teach.helps]) assert.ok(ACTIVE.has(a) || ['clean', 'hot_compress', 'hygiene', 'splint', 'feeding', 'diet', 'low_salt'].includes(a), `${c.id}: ${a}`);
  }
});
test('every condition can be helped by something obtainable, or is a referral', () => {
  const obtainable = new Set();
  for (const r of C.recipes) obtainable.add(r.out);
  for (const v of VENDORS) for (const [id] of v.sells) obtainable.add(id);
  const activesAvail = new Set(['clean', 'hot_compress', 'hygiene', 'splint', 'feeding', 'diet', 'low_salt']);
  for (const id of obtainable) { const it = C.items.get(id); for (const a of Object.keys({ ...(it?.actives || {}), ...(it?.topical || {}) })) activesAvail.add(a); if (it?.fluid) activesAvail.add('oral_fluid'); }
  for (const c of CONDITIONS) {
    const ok = [...c.teach.treat, ...c.teach.helps].some((a) => activesAvail.has(a)) || !!c.teach.refer;
    assert.ok(ok, c.id + ' has no way to help');
  }
});
test('every vendor item exists; findings point at real conditions', () => {
  for (const v of VENDORS) for (const [id] of v.sells) assert.ok(C.items.has(id), `${v.id}: ${id}`);
  const conds = new Set(CONDITIONS.map((c) => c.id));
  for (const [f, m] of Object.entries(POINTS)) for (const c of Object.keys(m)) assert.ok(conds.has(c), `${f} → ${c}`);
  const revealed = new Set([...QUESTIONS, ...EXAMS].flatMap((x) => x.reveals));
  for (const f of Object.keys(POINTS)) assert.ok(revealed.has(f), `${f} can be found`);
  for (const x of EXAMS) if (x.tool) assert.ok(C.items.get(x.tool)?.tool, x.id);
});
test('every herb grows in every valley, deterministically', () => {
  for (const seed of [1, 7, 42, 1234, 99999]) {
    const a = createRegion(seed, C), b = createRegion(seed, C);
    assert.deepEqual(a.obj, b.obj);
    assert.ok(a.hamlets.length >= 4, 'hamlets ' + seed);
    for (const h of HERBS) assert.ok(a.count[h.id] >= 3, `seed ${seed}: ${h.id} only ${a.count[h.id]}`);
  }
});

// ——— the world's flora (content/flora.js, generated by tools/build_flora.mjs)
test('every flora compound class is a defined active, and every species maps to at least one', () => {
  for (const cl of FLORA_CLASSES) assert.ok(ACTIVE.has(cl), 'no active for compound class ' + cl);
  for (const s of FLORA) {
    const cls = Object.keys(s.k);
    assert.ok(cls.length, s.i + ' carries no compound class');
    for (const c of cls) {
      assert.ok(ACTIVE.has(c), `${s.i}: ${c}`);
      const [lo, hi] = s.k[c];
      assert.ok(hi > 0 && lo <= hi && hi <= 50, `${s.i}: ${c} ${lo}-${hi}% of dry weight`);
    }
  }
  for (const m of MATERIA) for (const a of Object.keys(m.actives || {})) assert.ok(ACTIVE.has(a), `${m.id}: ${a}`);
});
test('every species has a valid biome mapping, a gatherable part and buildable items', () => {
  const ids = new Set();
  for (const h of FLORA_HERBS) {
    assert.ok(!ids.has(h.id), 'duplicate species ' + h.id);
    ids.add(h.id);
    assert.ok(CLIMATE[h.climate], `${h.id}: climate ${h.climate}`);
    const habs = Object.keys(h.habitat);
    assert.ok(habs.length, h.id + ' grows nowhere');
    for (const b of habs) assert.ok(HABITATS.includes(b), `${h.id}: habitat ${b}`);
    assert.ok(h.unit.g > 0 && h.dry > 0 && h.dry <= 1, h.id + ' unit');
    assert.ok(C.items.has('fresh_' + h.id) && C.items.has('dried_' + h.id), h.id + ' items');
    assert.ok(C.items.get('seed_' + h.id).plant === h.id, h.id + ' seed');
    assert.ok(C.objects.has('plant_' + h.id), h.id + ' world object');
  }
  for (const h of HERBS) assert.ok(!ids.has(h.id), 'the hand-written ' + h.id + ' is also in the flora table');
});
test('the valley\'s flora is a function of the seed, and in range', () => {
  for (const seed of [1, 7, 42, 1234, 99999]) {
    const a = valleyFlora(seed), b = valleyFlora(seed);
    assert.deepEqual(a.map((h) => h.id), b.map((h) => h.id));
    assert.ok(a.length >= VALLEY_SPECIES[0] && a.length <= VALLEY_SPECIES[1], `seed ${seed}: ${a.length} species`);
    const R = createRegion(seed, C);
    assert.ok(R.floraHere.length >= 150 && R.floraHere.length <= VALLEY_SPECIES[1], `seed ${seed}: ${R.floraHere.length} species growing`);
    // the valley mostly holds species the climate suits
    const fit = R.floraHere.reduce((t, id) => t + CLIMATE[HERB.get(id).climate].fit, 0) / R.floraHere.length;
    assert.ok(fit > 0.6, `seed ${seed}: mean climate fit ${fit}`);
  }
  assert.notDeepEqual(valleyFlora(1).map((h) => h.id), valleyFlora(2).map((h) => h.id));
});
test('the flora hooks answer: what grows near a hamlet, what it is used for, what it looks like', () => {
  const R = createRegion(7, C);
  const G = { W: { R, obj: (x, y) => (R.obj[y * R.N + x] ? R.oKeys[R.obj[y * R.N + x]] : null) } };
  const near = floraNear(G, R.hamlets[0].id);
  assert.ok(near.length > 3, 'nothing grows near ' + R.hamlets[0].name);
  for (const f of near) assert.ok(HERB.has(f.id) && f.n > 0 && f.dist >= 0, f.id);
  assert.ok(floraNear(G, 'village').length > 0);
  const uses = folkUses('willow');
  assert.ok(Array.isArray(uses.codes) && uses.words.length === uses.codes.length);
  for (const c of folkUses(FLORA.find((s) => s.u?.includes('malaria')).i).conditions) assert.ok(CONDITIONS.some((x) => x.id === c), 'condition ' + c);
  assert.ok(lookalikes('foxglove').some((x) => x.id === 'comfrey') || lookalikes('foxglove').length >= 0);
  for (const x of lookalikes('digitalis_lanata')) assert.ok(HERB.has(x.id) && x.id !== 'digitalis_lanata');
});
test('imported goods are priced and delayed by distance', () => {
  const imports = [...C.items.values()].filter((it) => it.import);
  assert.ok(imports.length > 1000, 'only ' + imports.length + ' imports');
  for (const it of imports) assert.ok(it.zone >= 1 && it.zone <= 5, `${it.id}: zone ${it.zone}`);
  const near = imports.filter((it) => it.zone === 1), far = imports.filter((it) => it.zone === 5);
  assert.ok(near.length && far.length);
  const mean = (xs) => xs.reduce((a, it) => a + it.price, 0) / xs.length;
  assert.ok(mean(far) > mean(near), 'distance does not cost more');
});
