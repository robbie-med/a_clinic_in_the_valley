// The laboratory (js/core/lab.js): each method sees the true blood through its own error, and microscopy through the
// reader's eye. Bands from the method references in content/lab.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { takeSample, readSample } from '../js/core/lab.js';
import { bloodPicture } from '../js/core/signs.js';

const pt = (cond, i, o = {}) => makePatient({ seed: 77, key: cond + i, t: 0, season: 'rains', hamlet: { mosquito: 0.6, water: 0.5 }, cond, ...o });
const sd = (xs) => { const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length); };

test('Sahli reads haemoglobin with an SD of ~1–1.6 g/dL; the meter within ~0.8', () => {
  const p = pt('back_pain', 1), truth = bloodPicture(p, 0).hb, sahli = [], meter = [];
  for (let k = 0; k < 300; k++) {
    sahli.push(readSample(p, takeSample(p, 'l_hb_sahli', k * 60), 0.5, 'r' + k).lab_hb.n - truth);
    meter.push(readSample(p, takeSample(p, 'l_hb_meter', k * 60), 0.5, 'r' + k).lab_hb.n - truth);
  }
  assert.ok(sd(sahli) > 0.9 && sd(sahli) < 1.7, 'Sahli SD ' + sd(sahli));
  assert.ok(sd(meter) > 0.4 && sd(meter) < 0.85, 'meter SD ' + sd(meter));
});
test('a thick film finds a heavy infection every time and a thin one more often with skill', () => {
  let heavy = 0, thinNovice = 0, thinExpert = 0, n = 0;
  for (let i = 0; i < 60; i++) {
    const p = pt('malaria', i);
    const B = bloodPicture(p, 0);
    const s = takeSample(p, 'l_thick', 0);
    const nov = readSample(p, s, 0.2, 'a').lab_para.pos, exp = readSample(p, s, 0.9, 'b').lab_para.pos;
    if (B.para > 20000) { n++; if (nov) heavy++; }
    if (B.para > 0 && B.para < 400) { thinNovice += nov; thinExpert += exp; }
  }
  if (n) assert.equal(heavy, n);
  assert.ok(thinExpert >= thinNovice, `expert ${thinExpert} vs novice ${thinNovice}`);
});
test('a slide without parasites is mostly read as negative, more so by a skilled reader', () => {
  let fpNovice = 0, fpExpert = 0;
  for (let i = 0; i < 200; i++) {
    const p = pt('back_pain', i), s = takeSample(p, 'l_thick', 0);
    fpNovice += readSample(p, s, 0.1, 'a').lab_para.pos; fpExpert += readSample(p, s, 0.9, 'b').lab_para.pos;
  }
  assert.ok(fpNovice / 200 < 0.15 && fpExpert / 200 < 0.04, `false positives ${fpNovice}, ${fpExpert}`);
  assert.ok(fpExpert <= fpNovice);
});
test('Kato-Katz misses some light hookworm infections (sensitivity ~50–90%)', () => {
  let pos = 0, n = 0;
  for (let i = 0; i < 120; i++) {
    const p = pt('hookworm', i), hw = p.conds.find((c) => c.id === 'hookworm');
    hw.W = 2 + (i % 4); // light
    n++; pos += readSample(p, takeSample(p, 'l_stool', 0), 0.6, 'x').lab_eggs.pos;
  }
  assert.ok(pos / n > 0.3 && pos / n < 0.95, 'sensitivity ' + pos / n);
});
test('the counting chamber is within ~20% of the true white count', () => {
  const p = pt('pneumonia', 3), truth = bloodPicture(p, 0).wbc, errs = [];
  for (let k = 0; k < 200; k++) errs.push(readSample(p, takeSample(p, 'l_wbc', k * 60), 0.6, 'c' + k).lab_wbc.n / truth - 1);
  assert.ok(sd(errs) > 0.03 && sd(errs) < 0.2, 'CV ' + sd(errs));
});
test('re-reading the same slide shows the same cells through a second eye', () => {
  const p = pt('malaria', 5), s = takeSample(p, 'l_thick', 0);
  const a = readSample(p, s, 0.95, 'one').lab_para, b = readSample(p, s, 0.95, 'two').lab_para;
  assert.equal(a.pos, b.pos);
});
