// The infection chapters of WTND (13–18, 21, pp.399–403): untreated, rightly treated and wrongly treated, each condition
// lands in broad bands around the cited outcomes. Slow infections (TB, leprosy, syphilis, trachoma, HIV) run on the game
// calendar: 40 game days ≈ a real year, six months of TB treatment ≈ 20 game days.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { simulate, HOUR } from '../js/core/disease.js';

const DAY = 24 * HOUR;
function cohort(cond, n, { days, rx, setup, tag = '', ...o }) {
  const ps = [];
  for (let i = 0; i < n; i++) {
    const p = makePatient({ seed: 777, key: cond + tag + i, t: 0, season: 'rains', hamlet: { mosquito: 0.6, water: 0.5 }, cond, ...o });
    setup?.(p);
    if (rx) p.rx = rx(p);
    simulate(p, days * DAY);
    ps.push(p);
  }
  const share = (f) => ps.filter(f).length / n;
  return { ps, dead: share((p) => p.dead), cured: share((p) => !p.dead && !p.conds.some((c) => c.id === cond)), res: share((p) => p.conds.some((c) => Object.keys(c.res || {}).length)), share };
}
const line = (actives, perDay, days, extra = {}) => ({ name: 'x', item: Object.keys(actives).join('+') + (extra.start || 0), start: 0, amount: 1, perDay, days, left: 9999, counselled: true, actives, q: 1, ...extra });
const one = (active, mg, perDay, days, extra) => line({ [active]: mg }, perDay, days, extra);
const inj = (active, mg, ka, start = 0) => one(active, mg, 1, 1, { route: 'inj', inj: { ka }, start });
const top = (active, perDay, days) => ({ name: active, item: active, start: 0, amount: 1, perDay, days, left: 999, counselled: true, topical: { [active]: 1 }, q: 1 });
const instr = (id) => ({ instr: id, name: id, start: 0, until: 90 * DAY });
const had = (id) => (p) => [...p.conds, ...p.healed].some((c) => c.id === id);
const ors = (litres) => () => [{ name: 'ors', item: 'ors', start: 0, amount: (litres * 1000) / 12, perDay: 12, days: 5, left: 1e9, fluid: { na: 75 }, q: 1 }];

// ——— tuberculosis (WTND pp.179–180, 359–361)
const RHZE = { rifampicin: 150, isoniazid: 75, pyrazinamide: 400, ethambutol: 275 }, RH = { rifampicin: 150, isoniazid: 75 };
const tbCourse = (intensive, continuation, tabs = 4) => () => [line(RHZE, 1, intensive, { amount: tabs }), ...(continuation ? [line(RH, 1, continuation, { amount: tabs, start: intensive * DAY })] : []), instr('supporter')];
test('TB: untreated it slowly kills; six months of four then two drugs cures; two months relapses; isoniazid alone breeds resistance', () => {
  const o = { age: 30, sex: 'm', days: 40 }, n = 80;
  const none = cohort('tb', n, o);
  const six = cohort('tb', n, { ...o, rx: tbCourse(7, 13) });     // 2 + 4 months
  const two = cohort('tb', n, { ...o, rx: tbCourse(7, 0) });      // intensive phase only
  const self = cohort('tb', n, { ...o, rx: () => tbCourse(7, 13)().slice(0, 2) }); // no one watches the doses
  const inh = cohort('tb', n, { ...o, rx: () => [one('isoniazid', 300, 1, 20), instr('supporter')] });
  assert.ok(none.dead > 0.1 && none.dead < 0.4 && none.cured === 0, `untreated: ${none.dead} dead, ${none.cured} cured`); // ~20%/year (Tiemersma 2011)
  assert.ok(six.cured > 0.8 && six.res < 0.05, `six months: ${six.cured} cured, ${six.res} resistant`);
  assert.ok(two.cured < 0.4, 'two months: ' + two.cured);
  assert.ok(self.cured < six.cured - 0.1, `self-run ${self.cured} vs watched ${six.cured}`);
  assert.ok(inh.res > 0.3 && inh.cured < 0.1, `isoniazid alone: ${inh.res} resistant`); // BMRC 1952: most resistant within months
});
test('TB of the neck glands: chronic untreated, cured by the same course', () => {
  const none = cohort('tb_nodes', 40, { age: 20, days: 40 });
  const six = cohort('tb_nodes', 40, { age: 20, days: 40, rx: tbCourse(7, 13, 3) });
  assert.equal(none.cured, 0);
  assert.ok(six.cured > 0.8, 'six months ' + six.cured);
});

// ——— leprosy (WTND pp.191–192, 362–363)
test('leprosy: untreated the nerves die slowly; dapsone with rifampicin for a year cures; dapsone alone mostly does not', () => {
  const o = { age: 35, days: 60 }, n = 50;
  const none = cohort('leprosy', n, o);
  const mdt = cohort('leprosy', n, { ...o, rx: () => [one('dapsone', 100, 1, 40), one('rifampicin', 600, 1, 40), instr('supporter')] });
  const dap = cohort('leprosy', n, { ...o, rx: () => [one('dapsone', 100, 1, 40), instr('supporter')] });
  const nerve = none.ps.reduce((a, p) => a + (p.flags.nerve || 0), 0) / n;
  assert.ok(none.cured === 0 && nerve > 0.15, `untreated: cured ${none.cured}, nerve damage ${nerve}`);
  assert.ok(mdt.cured > 0.8, 'dapsone + rifampicin ' + mdt.cured);
  assert.ok(dap.cured < 0.4, 'dapsone alone ' + dap.cured);
});

// ——— tetanus (WTND pp.182–184, 388–390)
test('tetanus: about half die untreated; antitoxin, metronidazole and diazepam save some; newborns nearly all die', () => {
  const o = { age: 30, sex: 'm', days: 40 }, n = 120;
  const none = cohort('tetanus', n, o);
  const care = cohort('tetanus', n, { ...o, rx: () => [inj('tetanus_ig', 5000, 0.03), one('metronidazole', 500, 3, 7), one('diazepam', 10, 3, 21)] });
  const baby = cohort('tetanus', 60, { age: 0.02, days: 30 });
  assert.ok(none.dead > 0.35 && none.dead < 0.7, 'untreated ' + none.dead); // ~43% even in African hospitals (Woldeamanuel 2016)
  assert.ok(care.dead < none.dead - 0.1, `treated ${care.dead} vs untreated ${none.dead}`);
  assert.ok(baby.dead > 0.7, 'newborn ' + baby.dead);
});
test('dirty wounds give tetanus now and then, only to the unvaccinated', () => {
  const bare = cohort('wound_minor', 3000, { age: 30, sex: 'm', days: 25, tag: 'tt', setup: (p) => { p.flags.ttVax = false; } });
  const vax = cohort('wound_minor', 1500, { age: 30, sex: 'm', days: 25, tag: 'tt', setup: (p) => { p.flags.ttVax = true; } });
  const t = bare.share(had('tetanus'));
  assert.ok(t > 0.0005 && t < 0.01, 'unvaccinated ' + t);
  assert.equal(vax.share(had('tetanus')), 0);
});
test('horse antitoxin: about 1 in 10 react to it, a few with allergic shock', () => {
  const r = cohort('back_pain', 1500, { age: 30, days: 1, tag: 'tat', rx: () => [inj('tetanus_antitoxin', 1500, 0.05)] });
  const hives = r.share((p) => p.toxSeen.allergy !== undefined), shock = r.share((p) => p.ana !== undefined);
  assert.ok(hives > 0.05 && hives < 0.15, 'reactions ' + hives);
  assert.ok(shock > 0 && shock < 0.03, 'shock ' + shock);
});

// ——— meningitis (WTND p.185)
test('meningitis: nearly always fatal untreated; injected ceftriaxone saves most; a drug that misses the germ does nothing', () => {
  const o = { age: 4, days: 14 }, n = 100;
  const none = cohort('meningitis', n, o);
  const cef = cohort('meningitis', n, { ...o, rx: (p) => Array.from({ length: 5 }, (_, i) => inj('ceftriaxone', 100 * p.weight, 1.5, i * DAY)) });
  const metro = cohort('meningitis', n, { ...o, rx: (p) => [one('metronidazole', 7.5 * p.weight, 3, 7)] });
  assert.ok(none.dead > 0.8, 'untreated ' + none.dead);
  assert.ok(cef.dead < 0.15, 'ceftriaxone ' + cef.dead);
  assert.ok(metro.dead > 0.8, 'metronidazole ' + metro.dead);
});

// ——— cholera (WTND pp.158, 152)
test('cholera: dehydration kills untreated; the rehydration drink prevents it; doxycycline shortens it', () => {
  const o = { age: 25, sex: 'm', days: 10 }, n = 150;
  const none = cohort('cholera', n, o);
  const fluid = cohort('cholera', n, { ...o, rx: ors(8) });
  const day3 = cohort('cholera', n, { ...o, days: 3, rx: ors(8) });
  const day3doxy = cohort('cholera', n, { ...o, days: 3, rx: (p) => [...ors(8)(p), one('doxycycline', 300, 1, 1)] });
  assert.ok(none.dead > 0.15 && none.dead < 0.5, 'untreated ' + none.dead);
  assert.ok(fluid.dead < 0.03, 'ORS ' + fluid.dead);
  assert.ok(day3doxy.cured > day3.cured + 0.1, `well by day 3: doxycycline ${day3doxy.cured} vs ORS alone ${day3.cured}`);
});

// ——— hepatitis (WTND p.172)
test('hepatitis: passes in weeks; the liver fails in ~1% of adults, fewer children; antibiotics change nothing', () => {
  const adult = cohort('hepatitis', 500, { age: 30, days: 50 });
  const child = cohort('hepatitis', 500, { age: 4, days: 50 });
  const amox = cohort('hepatitis', 500, { age: 30, days: 50, rx: () => [one('amoxicillin', 500, 3, 7)] });
  assert.ok(adult.dead > 0.002 && adult.dead < 0.03 && adult.cured > 0.95, `adults ${adult.dead} dead`);
  assert.ok(child.dead < adult.dead, `children ${child.dead}`);
  assert.equal(amox.dead, adult.dead);
});

// ——— infections spread by sex (WTND pp.236–243, 402–403)
test('gonorrhoea: ceftriaxone cures, but an untreated partner gives it back; penicillin is resisted; women can get PID', () => {
  const o = { age: 25, sex: 'm', days: 30 }, n = 100;
  const cef = cohort('gonorrhoea', n, { ...o, rx: () => [inj('ceftriaxone', 250, 1.5)] });
  const both = cohort('gonorrhoea', n, { ...o, rx: () => [inj('ceftriaxone', 250, 1.5), instr('treat_partner')] });
  const amox = cohort('gonorrhoea', n, { ...o, rx: () => [one('amoxicillin', 500, 3, 7), instr('treat_partner')] });
  const women = cohort('gonorrhoea', 300, { age: 25, sex: 'f', days: 40 });
  assert.ok(both.cured > 0.85, 'with the partner ' + both.cured);
  assert.ok(cef.cured < both.cured - 0.2, `without the partner ${cef.cured}`);
  assert.ok(amox.cured < 0.35, 'amoxicillin ' + amox.cured);
  const pid = women.share(had('pid'));
  assert.ok(pid > 0.03 && pid < 0.3, 'PID untreated ' + pid);
});
test('chlamydia, trichomonas and chancroid: the right medicine and the partner cure; the wrong one does not', () => {
  const f = { age: 25, sex: 'f', days: 30 }, m = { age: 25, sex: 'm', days: 30 }, n = 80;
  const ch0 = cohort('chlamydia', n, f), ch1 = cohort('chlamydia', n, { ...f, rx: () => [one('doxycycline', 100, 2, 7), instr('treat_partner')] });
  const tr = cohort('trichomonas', n, { ...f, rx: () => [one('metronidazole', 2000, 1, 1), instr('treat_partner')] });
  assert.ok(ch0.cured === 0 && ch1.cured > 0.85, `chlamydia: none ${ch0.cured}, doxycycline ${ch1.cured}`);
  assert.ok(tr.cured > 0.7, 'trichomonas: one 2 g dose of metronidazole ' + tr.cured); // ~85–90% in trials
  const cipro = cohort('chancroid', n, { ...m, rx: () => [one('ciprofloxacin', 500, 2, 3), instr('treat_partner')] });
  const doxy = cohort('chancroid', n, { ...m, rx: () => [one('doxycycline', 100, 2, 7), instr('treat_partner')] });
  assert.ok(cipro.cured > doxy.cured + 0.4, `chancroid: ciprofloxacin ${cipro.cured} vs doxycycline ${doxy.cured}`);
});
test('syphilis: one benzathine injection cures; untreated it stays, and kills many babies in pregnancy', () => {
  const o = { age: 25, sex: 'm', days: 20 };
  assert.equal(cohort('syphilis', 60, o).cured, 0);
  assert.ok(cohort('syphilis', 60, { ...o, rx: () => [inj('benzylpenicillin', 1440, 0.0017), instr('treat_partner')] }).cured > 0.95);
  const loss = (cond) => {
    let n = 0, bad = 0;
    for (let i = 0; i < 200; i++) {
      const p = makePatient({ seed: 5, key: 'preg' + cond + i, t: 0, season: 'rains', cond, age: 24, sex: 'f' });
      p.pregnant = 14;
      const out = simulate(p, 200 * DAY).find((e) => ['birth', 'stillbirth', 'miscarriage'].includes(e.kind));
      n++; if (out && out.kind !== 'birth') bad++;
    }
    return bad / n;
  };
  const syph = loss('syphilis'), ctrl = loss('back_pain');
  assert.ok(syph > ctrl + 0.1, `babies lost: syphilis ${syph} vs none ${ctrl}`); // ~21% more (Gomez 2013)
});

// ——— HIV (WTND pp.399–401)
test('HIV: untreated AIDS kills over a (game) year, and brings TB', () => {
  const r = cohort('hiv', 100, { age: 30, days: 40 });
  assert.ok(r.dead > 0.08 && r.dead < 0.4 && r.cured === 0, 'deaths ' + r.dead);
  assert.ok(r.share(had('tb')) > 0.02, 'TB ' + r.share(had('tb')));
});

// ——— skin (WTND pp.202, 205, 212)
test('skin: dicloxacillin clears impetigo, penicillin cellulitis, Whitfield\'s ointment ringworm', () => {
  const imp0 = cohort('impetigo', 100, { age: 5, days: 14 });
  const imp1 = cohort('impetigo', 100, { age: 5, days: 14, rx: (p) => [one('dicloxacillin', 12 * p.weight, 4, 7)] });
  const gv = cohort('impetigo', 100, { age: 5, days: 14, rx: () => [top('gentian_violet', 3, 7)] });
  assert.ok(imp1.cured > imp0.cured + 0.4 && gv.cured > imp0.cured, `impetigo: dicloxacillin ${imp1.cured}, gentian violet ${gv.cured}, none ${imp0.cured}`);
  const cel0 = cohort('cellulitis', 100, { age: 50, days: 7 });
  const cel1 = cohort('cellulitis', 100, { age: 50, days: 7, rx: () => [one('penicillin_v', 500, 4, 7)] });
  assert.ok(cel1.cured > cel0.cured + 0.3, `cellulitis by day 7: penicillin ${cel1.cured} vs none ${cel0.cured}`);
  const tin0 = cohort('tinea', 80, { age: 8, days: 30 });
  const tin1 = cohort('tinea', 80, { age: 8, days: 30, rx: () => [top('whitfield', 2, 28)] });
  assert.ok(tin0.cured === 0 && tin1.cured > 0.5, `ringworm: Whitfield ${tin1.cured}`);
});

// ——— eyes (WTND pp.217–220, 378)
test('eyes: ointment speeds pink eye; trachoma needs the whole household treated; a scratched eye heals', () => {
  const c0 = cohort('conjunctivitis', 100, { age: 4, days: 4 }), c1 = cohort('conjunctivitis', 100, { age: 4, days: 4, rx: () => [top('tetracycline_eye', 4, 7)] });
  assert.ok(c1.cured > c0.cured + 0.3, `pink eye by day 4: ointment ${c1.cured} vs none ${c0.cured}`); // Sheikh 2012: 64% vs 41% by day 2–5
  assert.ok(cohort('conjunctivitis', 100, { age: 4, days: 12 }).cured > 0.9, 'pink eye passes by itself');
  const t0 = cohort('trachoma', 80, { age: 6, days: 30 });
  const t1 = cohort('trachoma', 80, { age: 6, days: 30, rx: () => [top('tetracycline_eye', 3, 3)] });
  const t2 = cohort('trachoma', 80, { age: 6, days: 30, rx: () => [top('tetracycline_eye', 3, 3), instr('treat_family')] });
  assert.ok(t0.cured === 0 && t2.cured > 0.8 && t1.cured < t2.cured - 0.2, `trachoma: none ${t0.cured}, ointment ${t1.cured}, with household ${t2.cured}`);
  const e0 = cohort('eye_injury', 100, { age: 30, days: 10 }), e1 = cohort('eye_injury', 100, { age: 30, days: 10, rx: () => [top('tetracycline_eye', 4, 5)] });
  assert.ok(e1.cured >= e0.cured && e1.cured > 0.9, `eye injury: ointment ${e1.cured}, none ${e0.cured}`);
});

test('chickenpox and mumps pass by themselves', () => {
  assert.ok(cohort('chickenpox', 60, { age: 5, days: 20 }).cured > 0.95);
  assert.ok(cohort('mumps', 60, { age: 8, days: 20 }).cured > 0.95);
});
