// store.js — saves in IndexedDB (copied from dont get lost; pattern from nongbu_game: timeouts so a stuck database
// never hangs the game). Two stores: 'worlds' (one meta record per world: player, time, journal,
// markers…) and 'chunks' (key "<worldId>|cx,cy" → chunk diff record).
import { t } from './core/i18n.js';
const DB = 'no-doctor', VER = 1;

function open(timeoutMs = 12000) {
  return new Promise((res, rej) => {
    const to = setTimeout(() => rej(new Error(t('IndexedDB open timed out'))), timeoutMs);
    const r = indexedDB.open(DB, VER);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains('worlds')) db.createObjectStore('worlds', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
    };
    r.onblocked = () => console.warn('[store] open blocked');
    r.onsuccess = () => { clearTimeout(to); res(r.result); };
    r.onerror = () => { clearTimeout(to); rej(r.error); };
  });
}
let dbp = null;
const db = () => (dbp ||= open().catch((e) => { dbp = null; throw e; }));
const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); });

export async function listWorlds() {
  try {
    const d = await db();
    const all = await req(d.transaction('worlds').objectStore('worlds').getAll());
    return all.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  } catch (e) { console.warn('[store] list failed', e); return []; }
}

export async function loadWorld(id) {
  const d = await db();
  const tx = d.transaction(['worlds', 'chunks']);
  const meta = await req(tx.objectStore('worlds').get(id));
  const recs = new Map();
  const range = IDBKeyRange.bound(id + '|', id + '|￿');
  const keys = await req(tx.objectStore('chunks').getAllKeys(range));
  const vals = await req(tx.objectStore('chunks').getAll(range));
  keys.forEach((k, i) => recs.set(k.slice(id.length + 1), vals[i]));
  return { meta, records: recs };
}

let saving = null;
/** Save meta + changed chunk records. Coalesces overlapping calls. */
export async function saveWorld(meta, records) {
  if (saving) await saving.catch(() => {});
  saving = (async () => {
    const d = await db();
    const tx = d.transaction(['worlds', 'chunks'], 'readwrite');
    meta.savedAt = Date.now();
    tx.objectStore('worlds').put(meta);
    const cs = tx.objectStore('chunks');
    for (const r of records) cs.put(r, meta.id + '|' + r.k);
    await done(tx);
    return true;
  })();
  try { return await saving; } catch (e) { console.warn('[store] save failed', e); return false; } finally { saving = null; }
}

export async function deleteWorld(id) {
  const d = await db();
  const tx = d.transaction(['worlds', 'chunks'], 'readwrite');
  tx.objectStore('worlds').delete(id);
  tx.objectStore('chunks').delete(IDBKeyRange.bound(id + '|', id + '|￿'));
  await done(tx);
}

/** Whole world as one JSON-able object (export / sync). */
export async function exportWorld(id) {
  const { meta, records } = await loadWorld(id);
  return { format: 'no-doctor', v: 1, meta, chunks: Object.fromEntries(records) };
}
export async function importWorld(data, { asNew = false } = {}) {
  if (data?.format !== 'no-doctor') throw new Error(t('Not a save from this game'));
  const meta = { ...data.meta };
  if (asNew) { meta.id = 'w' + Date.now().toString(36); meta.name += ' (copy)'; }
  const d = await db();
  const tx = d.transaction(['worlds', 'chunks'], 'readwrite');
  tx.objectStore('worlds').put(meta);
  const cs = tx.objectStore('chunks');
  cs.delete(IDBKeyRange.bound(meta.id + '|', meta.id + '|￿'));
  for (const [k, r] of Object.entries(data.chunks || {})) cs.put(r, meta.id + '|' + k);
  await done(tx);
  return meta;
}
