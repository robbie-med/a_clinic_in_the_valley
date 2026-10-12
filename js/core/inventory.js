// inventory.js — slot inventories (player bag, chests, caches). Pure functions over plain objects so
// they save as JSON and run in tests. A stack is { id, n, q?, t? } — q = potency relative to the
// nominal strength of the item (herbs and preparations really vary), t = game minute it was made
// (for shelf life). Both are averaged, weighted by amount, when stacks merge — like pouring two
// batches into one bottle. (Copied from dont get lost/js/core/inventory.js; q added.)

export const makeInv = (size) => ({ slots: Array(size).fill(null) });

export function resize(inv, size) {
  const extra = [];
  if (size < inv.slots.length) for (const s of inv.slots.splice(size)) if (s) extra.push(s);
  while (inv.slots.length < size) inv.slots.push(null);
  return extra; // stacks that no longer fit (caller drops them)
}

const stackMax = (C, id) => C.items.get(id)?.stack ?? 50;

/** Add n of id; returns how many did NOT fit. */
export function addItem(inv, C, id, n = 1, o = {}) {
  const def = C.items.get(id);
  if (!def) throw new Error('unknown item ' + id);
  const max = stackMax(C, id);
  let left = n;
  if (max > 1 && o.dur === undefined) {
    for (const s of inv.slots) {
      if (!left) break;
      if (s && s.id === id && s.n < max) {
        const k = Math.min(left, max - s.n);
        if (o.t !== undefined && s.t !== undefined) s.t = (s.t * s.n + o.t * k) / (s.n + k);
        if (o.q !== undefined || s.q !== undefined) s.q = ((s.q ?? 1) * s.n + (o.q ?? 1) * k) / (s.n + k);
        s.n += k; left -= k;
      }
    }
  }
  for (let i = 0; i < inv.slots.length && left > 0; i++) {
    if (inv.slots[i]) continue;
    const k = Math.min(left, max);
    const st = { id, n: k };
    if (def.dur) st.dur = o.dur ?? def.dur;
    if (def.shelfDays) st.t = o.t ?? 0;
    if (o.q !== undefined) st.q = o.q;
    inv.slots[i] = st; left -= k;
  }
  return left;
}

export const count = (inv, id) => inv.slots.reduce((a, s) => a + (s && s.id === id ? s.n : 0), 0);

/** Item ids in this inventory carrying a tag, cheapest/most plentiful first. */
export function tagged(inv, C, tag) {
  const ids = new Map();
  for (const s of inv.slots) if (s && C.items.get(s.id).tags.includes(tag)) ids.set(s.id, (ids.get(s.id) || 0) + s.n);
  return [...ids.entries()].sort((a, b) => (C.items.get(a[0]).price - C.items.get(b[0]).price) || b[1] - a[1]);
}
export const countSpec = (inv, C, spec) => spec.startsWith('#') ? tagged(inv, C, spec.slice(1)).reduce((a, [, n]) => a + n, 0) : count(inv, spec);

/** Remove n of id (oldest food / most-worn tools first). Returns removed stacks (for returns/merging). */
export function remove(inv, id, n) {
  const order = inv.slots.map((s, i) => [s, i]).filter(([s]) => s && s.id === id).sort((a, b) => (a[0].t ?? 0) - (b[0].t ?? 0) || (a[0].dur ?? 0) - (b[0].dur ?? 0));
  let left = n;
  const taken = [];
  for (const [s, i] of order) {
    if (!left) break;
    const k = Math.min(left, s.n);
    s.n -= k; left -= k; taken.push({ ...s, n: k });
    if (s.n <= 0) inv.slots[i] = null;
  }
  return taken;
}
/** Remove n matching a spec ('id' or '#tag'). Returns the ids actually used. */
export function removeSpec(inv, C, spec, n) {
  if (!spec.startsWith('#')) { remove(inv, spec, n); return [[spec, n]]; }
  const used = [];
  let left = n;
  for (const [id, have] of tagged(inv, C, spec.slice(1))) {
    if (!left) break;
    const k = Math.min(left, have);
    remove(inv, id, k); used.push([id, k]); left -= k;
  }
  return used;
}

/** The best tool in the inventory for a role (highest power), as { stack, slot, def }. */
export function bestTool(inv, C, role) {
  let best = null;
  inv.slots.forEach((s, i) => {
    if (!s) return;
    const d = C.items.get(s.id);
    if (d.tool?.role === role && (!best || d.tool.power > best.def.tool.power)) best = { stack: s, slot: i, def: d };
  });
  return best;
}

export const freeSlots = (inv) => inv.slots.filter((s) => !s).length;
export const weightOf = (inv, C) => inv.slots.reduce((a, s) => a + (s ? C.items.get(s.id).weight * s.n : 0), 0);

/** Move a stack between inventories/slots (drag & drop). Merges when possible. */
export function moveStack(from, fi, to, ti, C, n) {
  const s = from.slots[fi];
  if (!s) return;
  const k = Math.min(n ?? s.n, s.n);
  const d = to.slots[ti];
  if (d && d.id === s.id && d.dur === undefined && s.dur === undefined) {
    const room = stackMax(C, s.id) - d.n, m = Math.min(room, k);
    if (s.t !== undefined && d.t !== undefined) d.t = (d.t * d.n + s.t * m) / (d.n + m);
    if (s.q !== undefined || d.q !== undefined) d.q = ((d.q ?? 1) * d.n + (s.q ?? 1) * m) / (d.n + m);
    d.n += m; s.n -= m;
    if (s.n <= 0) from.slots[fi] = null;
    return;
  }
  if (!d && k < s.n) { to.slots[ti] = { ...s, n: k }; s.n -= k; return; }
  from.slots[fi] = d; to.slots[ti] = s;
}

/** Sort: group by category then name. */
export function sortInv(inv, C, keep = 0) {
  const head = inv.slots.slice(0, keep), rest = inv.slots.slice(keep).filter(Boolean);
  const merged = makeInv(rest.length);
  for (const s of rest) if (s.dur !== undefined) merged.slots[merged.slots.indexOf(null)] = s; else addItem(merged, C, s.id, s.n, { t: s.t, q: s.q });
  const list = merged.slots.filter(Boolean).sort((a, b) => {
    const A = C.items.get(a.id), B = C.items.get(b.id);
    return A.cat.localeCompare(B.cat) || A.name.localeCompare(B.name);
  });
  inv.slots = [...head, ...list, ...Array(inv.slots.length - keep - list.length).fill(null)];
}
