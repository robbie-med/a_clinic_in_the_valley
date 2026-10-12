// history.test.mjs — what patients say must match what their bodies show, and advice fits the person in front of you.
import test from 'node:test';
import assert from 'node:assert/strict';
import { CONDITIONS } from '../js/core/content/conditions.js';
import { QUESTIONS } from '../js/core/content/findings.js';
import { makePatient, conditionWeight } from '../js/core/patient.js';
import { ask, startEncounter, adviceFor } from '../js/core/encounter.js';
import { signs } from '../js/core/signs.js';

const asked = new Map(QUESTIONS.flatMap((q) => q.reveals.map((k) => [k, q.id])));
const gameFor = (p) => ({ meta: { time: 0, clinic: { patients: { [p.id]: p } } }, W: { time: p.t }, p: { inv: { slots: [] } }, C: { items: new Map() } });

test('every claim in a complaint can be asked about, and every symptom word is claimed', () => {
  // a symptom named in the complaint must be one of its claims, so it is checked against the body
  const KW = [[/(?<!not )itch/i, ['itch']], [/fever/i, ['fever_hx', 'fever_rising']], [/cough/i, ['cough']], [/vomit/i, ['vomiting']],
    [/swell|swollen|lump/i, ['swelling_hx', 'bloating']], [/stool|diarrh|running like water/i, ['stools', 'blood_stool', 'stool_frothy', 'stool_on_off', 'worms_seen']]];
  for (const c of CONDITIONS) for (const { t, says } of c.complaint) {
    for (const k of says) assert.ok(asked.has(k), `${c.id}: no question asks about ${k}`);
    for (const [re, keys] of KW) if (re.test(t)) assert.ok(keys.some((k) => says.includes(k)), `${c.id}: “${t}” says ${re} but claims ${says}`);
  }
});

test('patients who walk in tell the truth: each claim is there when you ask (never "not noticed")', () => {
  let n = 0;
  for (let k = 0; k < 600; k++) {
    const p = makePatient({ seed: 3 + (k % 5), key: 'h' + k, t: 600 + (k % 7) * 1440, season: ['cool_dry', 'hot_dry', 'rains', 'late_rains'][k % 4] });
    const G = gameFor(p), enc = startEncounter(G, p.id);
    for (const key of p.says) {
      const text = ask(G, enc, asked.get(key));
      assert.ok(enc.found[key]?.pos && !/not noticed/.test(text), `${p.mainCond}: “${p.complaint}” but asked about ${key}: “${text}”`);
      n++;
    }
  }
  assert.ok(n > 600, 'claims checked ' + n);
});

test('every illness that walks in can come with a complaint that is wholly true', () => {
  for (const c of CONDITIONS.filter((x) => x.epi.w > 0)) {
    const band = c.epi.age?.find((b) => b[2] > 0);
    let ok = 0;
    for (let k = 0; k < 30 && !ok; k++) {
      const p = makePatient({ seed: 5, key: c.id + k, t: 600, season: 'rains', cond: c.id, age: band ? band[0] + (band[1] - band[0]) * ((k % 10) + 0.5) / 10 : undefined });
      if (c.complaint.some((x) => x.says.length === p.says.length && x.says.every((s) => p.says.includes(s)))) ok++;
    }
    assert.ok(ok, c.id + ': no patient could say any of its complaints truthfully');
  }
});

test('advice fits the person, never the diagnosis', () => {
  const boy = makePatient({ seed: 1, key: 'boy', t: 600, season: 'rains', cond: 'watery_diarrhea', age: 3, sex: 'm' });
  const ids = adviceFor(boy).map((x) => x.id);
  for (const no of ['miso_at_birth', 'clean_birth', 'treat_partner', 'kangaroo', 'low_salt']) assert.ok(!ids.includes(no), 'a 3-year-old boy offered ' + no);
  for (const yes of ['finish', 'danger_signs', 'boil_water', 'feeding']) assert.ok(ids.includes(yes), yes);
  const mum = makePatient({ seed: 1, key: 'mum', t: 600, season: 'rains', cond: 'nausea_pregnancy' });
  assert.ok(adviceFor(mum).some((x) => x.id === 'miso_at_birth'), 'a pregnant woman can be given misoprostol to take at the birth');
});

test('on a return visit they can say how it went: better or worse, doses missed, advice kept', () => {
  const p = makePatient({ seed: 2, key: 'back', t: 600, season: 'rains', cond: 'pneumonia', age: 30 });
  const before = p.conds.reduce((a, c) => a + c.s, 0);
  p.visits.push({ t: p.t, burden: before * 2 });
  p.rx.push({ item: 'amox_250', name: 'Amoxicillin 250 mg', start: p.t, left: 6, amount: 2, perDay: 3, days: 5, route: 'oral', missed: 2 });
  p.rx.push({ instr: 'danger_signs', name: 'Come back at once if worse', start: p.t, until: p.t + 1e6, seen: 10, kept: 3 });
  const F = signs(p, p.t + 60);
  assert.match(F.better.v, /better/);
  assert.match(F.doses.v, /missed 2 doses/);
  assert.match(F.advice_kept.v, /now and then/);
});

test('kept advice prevents what it should: a net cuts malaria by ~45%', () => {
  const malaria = CONDITIONS.find((c) => c.id === 'malaria'), person = { sex: 'f', age: 4, pregnant: 0 };
  const w0 = conditionWeight(malaria, person, 'rains', null), w1 = conditionWeight(malaria, { ...person, advice: { net: 1e9 } }, 'rains', null);
  assert.ok(Math.abs(w1 / w0 - 0.55) < 1e-9, 'ratio ' + w1 / w0);
});
