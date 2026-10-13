// i18n.js — every word the player reads goes through here. English is the source language and the key:
// `t('Hot to the touch.')` looks the sentence up in the current language's dictionary and falls back to
// the English. Pure (no DOM): core, UI and tests share it. Language packs live in `i18n/<code>/index.js`
// and are loaded on demand (`loadLang`), so English costs nothing.
//
//   t(key, vars)        — translate now. Vars fill `{name}`; in Korean `{name:이}` adds the right particle
//                         (이/가, 은/는, 을/를, 과/와, 으로/로, 이나/나, 이라/라, 아/야, 이에요/예요).
//   tc(ctx, key, vars)  — the same English with a different meaning (dictionary key `ctx|key`).
//   msg(key, vars)      — a translation to do LATER (saved text: ledger, patient records). JSON-safe:
//                         { $: key, v: vars }. Vars may be numbers, strings (looked up), nested msgs or
//                         person(name) markers. Render with tm().
//   tm(x)               — render a msg, a person marker or a plain string (looked up) in the current language.
//   localize(rows, paths) — turn content-table fields into getters that translate on every read, so a
//                         language switch reaches every table at once (`name`, `local[]`, `complaint[].t`).
//   personName(s)       — a generated person or place name, written in the current language's script.
//   person(s), raw(s)   — markers inside msg vars: a generated name, or text never to look up (typed by the player).
//   thing(kind, id)     — a content row by id inside a msg (an item), named in the current language when shown.
//   cite(s)             — a citation with its page words localized ("WTND pp.151–160" → "WTND 151–160쪽").
// Note: string vars given to t() are used as they are (translate them first); string vars inside a msg are looked up.
//
// Rules for keys: the first argument of t/tc/msg is always a plain string literal (no `${}`), so
// tools/i18n-check.mjs can find it. Build sentences from whole templates, never from fragments glued
// together: word order differs between languages.

export const LANGS = { en: { code: 'en', label: 'English', dict: new Map() } };
export const AVAILABLE = [['en', 'English'], ['ko', '한국어']]; // add a row (and i18n/<code>/) for a new language
let cur = LANGS.en;

/** Keys asked for in a language that lacks them (dev aid; tools/playtest.mjs dumps it). */
export const MISSING = new Set();
/** Every content string made translatable by localize() (tools/i18n-check.mjs checks each one). */
export const SOURCES = new Set();

export function register(pack) {
  pack.dict = pack.dict instanceof Map ? pack.dict : new Map(Object.entries(pack.dict || {}));
  LANGS[pack.code] = pack;
}
export const getLang = () => cur.code;
export function setLang(code) { cur = LANGS[code] || LANGS.en; return cur.code; }
/** Load a language pack (browser or Node), then switch to it. */
export async function loadLang(code) {
  if (!LANGS[code] && code !== 'en' && AVAILABLE.some(([c]) => c === code)) {
    try { await import(`./i18n/${code}/index.js`); } catch (e) { console.error('language pack', code, e); }
  }
  return setLang(code);
}

const has = (k) => cur.dict.has(k);
function look(key) {
  if (cur.code === 'en' || key === '' || key == null) return key;
  const v = cur.dict.get(key);
  if (v !== undefined) return v;
  MISSING.add(key);
  return key;
}

export function t(key, vars) {
  if (typeof key !== 'string') return key == null ? '' : tm(key);
  return fill(look(key), vars);
}
export function tc(ctx, key, vars) {
  if (cur.code === 'en') return fill(key, vars);
  const k = ctx + '|' + key;
  return fill(has(k) ? cur.dict.get(k) : look(key), vars);
}

export const msg = (key, vars) => (vars ? { $: key, v: vars } : { $: key });
export const person = (name) => ({ $n: name });
/** Render anything that may hold text: a msg, a person marker, a string (looked up), a number. */
export function tm(x) {
  if (x == null) return '';
  if (typeof x === 'string') return look(x);
  if (typeof x === 'number') return String(x);
  if (Array.isArray(x)) return x.map(tm).join(cur.sep ?? ' ');
  if (x.en != null && cur.code === 'en') return x.en; // a msg may carry its exact English (patient.js withEn)
  if (x.$n !== undefined) return personName(x.$n);
  if (x.$r !== undefined) return String(x.$r);
  if (x.$k !== undefined) return String(RESOLVE[x.$k]?.(x.id) ?? x.id);
  if (x.$ !== undefined) {
    const v = {};
    for (const [k, val] of Object.entries(x.v || {})) v[k] = typeof val === 'object' && val !== null ? tm(val) : typeof val === 'string' ? look(val) : val;
    return x.ctx ? tc(x.ctx, x.$, v) : fill(look(x.$), v);
  }
  return String(x);
}

/** A citation ("WTND pp.151–160; Smith 2001") with its page words in the current language. */
export function cite(s) { return cur.cite ? cur.cite(s) : s; }
/** Raw text inside a msg that must not be looked up (a clinic name the player typed). */
export const raw = (s) => ({ $r: s });
/** A content row by id inside a msg ({ $k: 'item', id }), named when shown (registered by the content: resolver()). */
export const thing = (kind, id) => ({ $k: kind, id });
const RESOLVE = {};
export function resolver(kind, fn) { RESOLVE[kind] = fn; }

/** A generated name (people, hamlets) in the current script; packs may provide `name(s)`. */
export function personName(s) { return cur.name ? cur.name(s) : s; }

function fill(s, vars) {
  if (!vars || typeof s !== 'string') return s;
  return s.replace(/\{(\w+)(?::([^}]+))?\}/g, (m, k, p) => {
    if (!(k in vars)) return m;
    let v = vars[k];
    if (v !== null && typeof v === 'object') v = tm(v);
    v = v == null ? '' : String(v);
    return p ? (cur.attach ? cur.attach(v, p) : v) : v;
  });
}

// ——— Korean particles (also used by the ko pack): pick the form that fits the last syllable.
const PAIRS = [['이', '가'], ['은', '는'], ['을', '를'], ['과', '와'], ['으로', '로'], ['이나', '나'], ['이라', '라'], ['아', '야'], ['이에요', '예요'], ['이랑', '랑'], ['이고', '고'], ['이며', '며'], ['이다', '다'], ['이면', '면']];
const DIGIT_FINAL = { 0: 1, 1: 8, 2: 0, 3: 1, 4: 0, 5: 0, 6: 1, 7: 8, 8: 8, 9: 0 }; // 영 일 이 삼 사 오 육 칠 팔 구: 0 none, 8 ㄹ, 1 other
/** 0 = no final consonant, 8 = ㄹ, else another final. */
export function finalOf(word) {
  const s = String(word).replace(/[\s)\]"'’”.,!?%°]+$/u, '');
  const ch = s.charAt(s.length - 1);
  if (!ch) return 0;
  const c = ch.charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28;
  if (/\d/.test(ch)) return DIGIT_FINAL[ch];
  if (/[lr]/i.test(ch)) return 8;
  if (/[mnkpbtg]/i.test(ch)) return 1;
  return 0;
}
export function josa(word, p) {
  const pair = PAIRS.find((x) => x.includes(p));
  if (!pair) return p;
  const f = finalOf(word);
  if (pair[0] === '으로') return f && f !== 8 ? '으로' : '로';
  return f ? pair[0] : pair[1];
}

// ——— content tables
const ORIG = Symbol('i18n.orig');
/**
 * Make fields of every row translate on read. Paths: 'name', 'teach.refer', 'local[]' (array of strings),
 * 'complaint[].t' (field of each object in an array), 'toxic[].text'. Writing a field sets its English.
 */
export function localize(rows, paths) {
  for (const row of rows) for (const path of paths) walk(row, path.split('.'));
  return rows;
}
function walk(obj, parts) {
  if (obj == null || typeof obj !== 'object') return;
  const [head, ...rest] = parts;
  const arr = head.endsWith('[]'), key = arr ? head.slice(0, -2) : head;
  if (!(key in obj)) return;
  if (!rest.length) {
    const store = (obj[ORIG] ||= {});
    const d = Object.getOwnPropertyDescriptor(obj, key);
    if (d?.get) return; // already localized
    store[key] = obj[key];
    const note = (v) => { if (typeof v === 'string') SOURCES.add(v); else if (Array.isArray(v)) v.forEach((x) => typeof x === 'string' && SOURCES.add(x)); };
    note(store[key]);
    Object.defineProperty(obj, key, {
      enumerable: true, configurable: true,
      get: () => { const v = store[key]; return Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? look(x) : x)) : typeof v === 'string' ? look(v) : v; },
      set: (v) => { store[key] = v; note(v); },
    });
    return;
  }
  const v = obj[key];
  if (arr && Array.isArray(v)) for (const x of v) walk(x, rest);
  else walk(v, rest);
}
/** The English behind a localized field (for logic that must not depend on the language). */
export const en = (row, key) => (row?.[ORIG] && key in row[ORIG] ? row[ORIG][key] : row?.[key]);

/** "a, b and c" in the current language. */
export function listJoin(items) {
  const a = items.filter((x) => x !== '' && x != null);
  if (cur.code !== 'en') return a.join(cur.listSep ?? ', ');
  return a.length < 3 ? a.join(' and ') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
