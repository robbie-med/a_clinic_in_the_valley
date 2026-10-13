// i18n.test.mjs — the game is wholly bilingual: every string has Korean, and a whole consultation run in Korean
// (every illness, every question, every examination, the advice) shows no English.
import test from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../tools/i18n-check.mjs';
import { loadLang, setLang, MISSING, tm, t } from '../js/core/i18n.js';
import { buildContent } from '../js/core/content/index.js';
import { CONDITIONS } from '../js/core/content/conditions.js';
import { QUESTIONS, EXAMS } from '../js/core/content/findings.js';
import { makePatient, complaintOf, say } from '../js/core/patient.js';
import { ask, examine, startEncounter, adviceFor, differential, PROCEDURES } from '../js/core/encounter.js';
import { who } from '../js/core/clinic.js';
import { FLORA } from '../js/core/content/flora.js';
import { HERBS } from '../js/core/content/herbs.js';

test('every string in the code and the content tables has Korean, with the same placeholders', async () => {
  const r = await check('ko');
  const show = (a) => a.slice(0, 15).map((x) => JSON.stringify(x)).join('\n');
  assert.equal(r.problems.length, 0, 'keys built at run time (the checker cannot see them):\n' + r.problems.slice(0, 15).join('\n'));
  assert.equal(r.missing.length, 0, `${r.missing.length} strings with no Korean:\n` + show(r.missing));
  assert.equal(r.bad.length, 0, 'placeholders differ:\n' + show(r.bad));
});

// English words a Korean screen may still show: units, abbreviations, the book's short name, Latin.
const ALLOWED = /^(mg|ml|kg|mmHg|min|MUAC|WTND|HIV|AIDS|ORS|TB|BCG|DMPA|INH|PID|MIC|MRSA|IU|SP|ACT|AL|g|L|h|cm|mm|x)$/i;
// Scientific (Latin) plant names stay Latin in every language: 75 species have no common name at all.
const LATIN = new Set([...FLORA.map((f) => f.n), ...HERBS.map((h) => h.latin)].filter(Boolean));
const LATIN_RE = new RegExp([...LATIN].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const english = (s) => String(s).replace(/<[^>]+>/g, ' ').replace(LATIN_RE, ' ').match(/[A-Za-z][A-Za-z'-]{2,}/g)?.filter((w) => !ALLOWED.test(w)) || [];

test('a consultation in Korean shows no English: complaint, every answer, every examination, advice', async () => {
  await loadLang('ko');
  try {
    const C = buildContent();
    const tools = [...C.items.values()].filter((it) => it.tool).map((it) => ({ id: it.id, n: 1 }));
    const seen = [];
    let k = 0;
    for (const c of CONDITIONS) {
      for (const age of [3, 30]) {
        let p;
        try { p = makePatient({ seed: 11, key: c.id + age, t: 600 + (k++ % 9) * 1440, season: 'rains', cond: c.id, age }); } catch { continue; }
        if (!p || p.mainCond !== c.id) continue;
        const G = { meta: { time: 0, clinic: { patients: { [p.id]: p } } }, W: { time: p.t }, p: { inv: { slots: tools } }, C };
        const enc = startEncounter(G, p.id);
        seen.push([c.id, 'complaint', complaintOf(p)], [c.id, 'who', who(p)]);
        for (const q of QUESTIONS) if (!q.only || q.only(p)) ask(G, enc, q.id);
        for (const x of EXAMS) if (!x.only || x.only(p)) examine(G, enc, x.id);
        for (const e of enc.log) seen.push([c.id, 'log', say(e.who)], [c.id, 'log', say(e.text)]);
        for (const d of differential(enc)) seen.push([c.id, 'differential', d.name]);
        for (const a of adviceFor(p)) seen.push([c.id, 'advice', a.label], [c.id, 'advice', a.group]);
      }
    }
    for (const pr of PROCEDURES) seen.push(['-', 'procedure', pr.label]);
    for (const it of C.items.values()) seen.push(['-', 'item', it.name]);
    const bad = seen.filter(([, , s]) => english(s).length);
    assert.equal(bad.length, 0, `${bad.length} Korean lines still hold English, e.g.:\n` + bad.slice(0, 12).map(([id, where, s]) => `${id} ${where}: ${s}`).join('\n'));
    assert.equal(MISSING.size, 0, `asked for at run time with no Korean (${MISSING.size}):\n` + [...MISSING].slice(0, 15).join('\n'));
  } finally { setLang('en'); }
});

test('English stays the source: t() of a key in English is the key', () => {
  setLang('en');
  assert.equal(t('Hot to the touch.'), 'Hot to the touch.');
  assert.equal(t('{n} days', { n: 3 }), '3 days');
});
