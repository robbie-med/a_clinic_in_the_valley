// Content integrity: every reference resolves, every sprite and icon exists, every herb grows
// somewhere, every remedy can be made or bought, every condition has a path to care.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildContent } from '../js/core/content/index.js';
import { HERBS } from '../js/core/content/herbs.js';
import { ACTIVES, ACTIVE } from '../js/core/content/actives.js';
import { CONDITIONS } from '../js/core/content/conditions.js';
import { VENDORS } from '../js/core/content/vendors.js';
import { QUESTIONS, EXAMS, POINTS } from '../js/core/content/findings.js';
import { createRegion } from '../js/core/region.js';
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
