// i18n-check.mjs — is every player-visible string translated? `node tools/i18n-check.mjs [lang] [--list] [--unused]`
// Collects (1) the first argument of every t( / tc( / msg( call in js/ (string literals only), and (2) every
// content string made translatable by localize() (i18n.js SOURCES), then checks the language pack has each one
// and that its {placeholders} match. Exit code 1 if anything is missing.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function files(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!p.includes(join('core', 'i18n'))) files(p, out); } else if ((p.endsWith('.js') || p.endsWith('.mjs')) && !p.endsWith('i18n.js')) out.push(p);
  }
  return out;
}
const LIT = String.raw`('(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|\x60(?:[^\x60\\]|\\.)*\x60)`;
const CALL = new RegExp(String.raw`(?<![\w.$])(t|tc|msg)\(\s*` + LIT + String.raw`(?:\s*,\s*` + LIT + ')?', 'g');
const DYN = /(?<![\w.$])(t|tc|msg)\(\s*(?![\s'"`)])/g;

export async function check(lang = 'ko') {
  const keys = new Map(); // key → where
  const problems = [];
  for (const f of files(join(ROOT, 'js'))) {
    const src = readFileSync(f, 'utf8');
    const rel = relative(ROOT, f);
    for (const m of src.matchAll(CALL)) {
      const [, fn, a, b] = m;
      const lit = fn === 'tc' ? b : a;
      if (fn === 'tc' && !b) continue;
      if (lit.startsWith('`') && lit.includes('${')) { problems.push(`${rel}: ${fn}() with an interpolated template: ${lit.slice(0, 60)}`); continue; }
      const key = (0, eval)(lit);
      const full = fn === 'tc' ? (0, eval)(a) + '|' + key : key;
      if (!keys.has(full)) keys.set(full, rel);
    }
  }
  const i18n = await import(pathToFileURL(join(ROOT, 'js/core/i18n.js')).href);
  // importing the content registers every localized table string
  const content = await import(pathToFileURL(join(ROOT, 'js/core/content/index.js')).href);
  content.buildContent?.();
  for (const f of files(join(ROOT, 'js/core'))) if (!f.includes('i18n')) await import(pathToFileURL(f).href);
  for (const s of i18n.SOURCES) if (!keys.has(s)) keys.set(s, 'content');
  await import(pathToFileURL(join(ROOT, `js/core/i18n/${lang}/index.js`)).href);
  const dict = i18n.LANGS[lang].dict;
  const missing = [], bad = [];
  const ph = (s) => [...String(s).matchAll(/\{(\w+)(?::[^}]+)?\}/g)].map((m) => m[1]).sort().join(',');
  for (const [k, where] of keys) {
    const ctxKey = k.includes('|') && !dict.has(k) ? k.split('|').slice(1).join('|') : k;
    if (!dict.has(k) && !dict.has(ctxKey)) { if (k.trim() && /[A-Za-z]/.test(k)) missing.push([k, where]); continue; }
    const v = dict.get(k) ?? dict.get(ctxKey);
    if (ph(ctxKey) !== ph(v)) bad.push([k, v]);
  }
  const unused = [...dict.keys()].filter((k) => !keys.has(k) && !keys.has(k.split('|').slice(1).join('|')));
  return { keys, missing, bad, unused, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const lang = process.argv.slice(2).find((a) => !a.startsWith('--')) || 'ko';
  const r = await check(lang);
  console.log(`${lang}: ${r.keys.size} strings, ${r.missing.length} missing, ${r.bad.length} placeholder mismatches, ${r.problems.length} dynamic keys, ${r.unused.length} unused entries`);
  if (process.argv.includes('--list')) {
    for (const [k, w] of r.missing) console.log(`MISSING [${w}] ${JSON.stringify(k)}`);
    for (const [k, v] of r.bad) console.log(`PLACEHOLDERS ${JSON.stringify(k)} → ${JSON.stringify(v)}`);
    for (const p of r.problems) console.log('DYNAMIC ' + p);
  }
  if (process.argv.includes('--unused')) for (const k of r.unused) console.log('UNUSED ' + JSON.stringify(k));
  process.exit(r.missing.length || r.bad.length || r.problems.length ? 1 : 0);
}
