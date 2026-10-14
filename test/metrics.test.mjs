// The ledger's metrics tab: figures computed from saved visits, windows by time, old saves without the new fields.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinicMetrics, visitKind } from '../js/core/metrics.js';
import { msg } from '../js/core/i18n.js';
import { DAY } from '../js/core/time.js';

const J = (o = {}) => ({ dxRight: true, helped: [], harmed: [], needless: [], referredRight: null, ...o });
const T = (d, h = 9) => (d - 1) * DAY + h * 60;
function clinic() {
  const patients = {
    a: { id: 'a', recovered: T(5), debt: 0, visits: [
      { t: T(2), kind: 'new', min: 20, wait: 30, paid: 3, billed: 3, back: 2, judged: J() },
      { t: T(4), kind: 'planned', min: 10, wait: 90, paid: 1, billed: 2, judged: J() }] },
    b: { id: 'b', dead: true, diedAt: T(6), cause: 'poisoned (iron)', debt: 4, visits: [
      { t: T(3), kind: 'new', min: 30, wait: 20, paid: 2, billed: 6, refer: true, judged: J({ dxRight: false, harmed: ['iron'], needless: ['amoxicillin'], referredRight: true }) }] },
    c: { id: 'c', debt: 1, visits: [{ t: T(30), kind: 'new', min: 15, wait: 10, paid: 2, billed: 3, judged: J() }] },
    // an old save: no kind, min, wait or billed
    d: { id: 'd', recovered: T(31), visits: [{ t: T(29), paid: 1, judged: J() }, { t: T(30), paid: 1, judged: J() }] },
    e: { id: 'e', visits: [] }, // walked in, never seen
  };
  return { rep: 0.65, fee: 1, markup: 1.3, missed: 2, walkouts: [T(3), T(30)], patients };
}

test('all-time figures add up', () => {
  const M = clinicMetrics(clinic(), T(31, 18));
  assert.equal(M.volume.visits, 6);
  assert.equal(M.volume.patients, 4);
  assert.deepEqual(M.volume.kinds, { new: 4, planned: 1, unplanned: 1, thanks: 0 }); // d's second, old visit counts as unplanned
  assert.equal(M.volume.lwbs.k, 2);
  assert.equal(M.volume.missed, 2);
  assert.equal(M.flow.timed, 4);
  assert.equal(M.flow.minPerVisit, 18.75);
  assert.equal(M.flow.medianWait, 25);
  assert.deepEqual([M.continuity.followUpKept.k, M.continuity.followUpKept.n], [1, 1]);
  assert.deepEqual([M.quality.success.k, M.quality.success.n], [2, 3]);
  assert.equal(M.quality.harmDeaths, 1);
  assert.deepEqual([M.quality.needlessAbx.k, M.quality.needlessAbx.n], [1, 5]); // c is still ill: not judged yet
  assert.deepEqual([M.quality.referRight.k, M.quality.referRight.n], [1, 1]);
  assert.equal(M.money.cash, 10);
  assert.equal(M.money.billed, 14);
  assert.equal(M.money.owed, 1, 'the dead owe nothing');
  assert.equal(M.nps, 30);
});

test('a window counts only what happened in it', () => {
  const M = clinicMetrics(clinic(), T(31, 18), 10);
  assert.equal(M.volume.visits, 3);
  assert.equal(M.volume.missed, null);
  assert.equal(M.volume.walkouts, 1);
  assert.deepEqual([M.quality.success.k, M.quality.success.n], [1, 1]);
  assert.equal(M.span, 10);
});

test('an empty clinic gives blanks, not NaN', () => {
  const M = clinicMetrics({ rep: 0.3, patients: {} }, T(14));
  assert.equal(M.volume.visits, 0);
  assert.equal(M.flow.minPerVisit, null);
  assert.equal(M.quality.success.v, null);
  assert.equal(M.money.perVisit, null);
});

test('what brought them in', () => {
  assert.equal(visitKind({ visits: [] }), 'new');
  assert.equal(visitKind({ visits: [{}], returnWhy: msg('come for the check-up as you asked') }), 'planned');
  assert.equal(visitKind({ visits: [{}], returnWhy: 'thanks' }), 'thanks');
  assert.equal(visitKind({ visits: [{}], returnWhy: msg('getting worse') }), 'unplanned');
});
