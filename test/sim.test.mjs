// The medicine behaves like medicine: untreated illness runs its course, the right treatment at the
// right dose beats none, too little or too short fails, too much poisons, and the same seed gives
// the same outcome. Outcome rates over many seeded patients must stay within broad, sensible bands.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePatient } from '../js/core/patient.js';
import { simulate, HOUR } from '../js/core/disease.js';
import { conc, pkParams } from '../js/core/pk.js';
import { ACTIVE } from '../js/core/content/actives.js';
import { baseResistance } from '../js/core/content/organisms.js';
import { newClinic, resistance, selectPressure, fadeResistance } from '../js/core/clinic.js';

const DAY = 24 * HOUR;
function cohort(cond, n, { age, sex, days, rx, resist, tag = '' }) {
  const r = { dead: 0, cured: 0, poisoned: 0 };
  for (let i = 0; i < n; i++) {
    const p = makePatient({ seed: 777, key: cond + tag + i, t: 0, season: 'rains', hamlet: { mosquito: 0.6, water: 0.5 }, cond, age, sex, resist });
    if (rx) p.rx = rx(p);
    simulate(p, days * DAY);
    if (p.dead) { r.dead++; if (p.cause.startsWith('poisoned')) r.poisoned++; } else if (!p.conds.some((c) => c.id === cond)) r.cured++;
  }
  for (const k of Object.keys(r)) r[k] /= n;
  return r;
}
const quinine = (mgkg, days = 7) => (p) => [{ name: 'q', item: 'x', start: 0, amount: 1, perDay: 3, days, left: 99, counselled: true, actives: { quinine: mgkg * p.weight }, q: 1 }];
const ors = (na = 47) => (p) => [{ name: 'ors', item: 'o', start: 0, amount: 1000 / 6, perDay: 6, days: 5, left: 1e9, fluid: { na }, q: 1 }];

test('one-compartment PK matches the closed form for a single dose', () => {
  const p = makePatient({ seed: 1, key: 'pk', t: 0, season: 'rains', cond: 'back_pain', age: 40, sex: 'm' });
  p.doses.sys.quinine = [[0, 600]];
  const a = ACTIVE.get('quinine');
  const { F, ka, ke, V } = pkParams(p, a);
  for (const h of [1, 3, 8, 24]) {
    const expect = (F * 600 * ka) / (V * (ka - ke)) * (Math.exp(-ke * h) - Math.exp(-ka * h));
    assert.ok(Math.abs(conc(p, 'quinine', h * HOUR) - expect) < 1e-9, 'h=' + h);
  }
});
test('same seed, same course', () => {
  const run = () => { const p = makePatient({ seed: 5, key: 'det', t: 0, season: 'rains', cond: 'malaria', age: 3 }); p.rx = quinine(10)(p); simulate(p, 20 * DAY); return JSON.stringify(p.conds) + p.dead; };
  assert.equal(run(), run());
});
test('malaria: a full course of quinine beats a short one beats none; overdose poisons', () => {
  const none = cohort('malaria', 300, { age: 3, days: 30 });
  const full = cohort('malaria', 300, { age: 3, days: 30, rx: quinine(10) });
  const short = cohort('malaria', 300, { age: 3, days: 30, rx: quinine(10, 3) });
  const over = cohort('malaria', 300, { age: 3, days: 30, rx: quinine(25) });
  assert.ok(full.cured > 0.7, 'full course cures most: ' + full.cured);
  assert.ok(short.cured < full.cured * 0.3, 'short course mostly recrudesces: ' + short.cured);
  assert.ok(none.dead > full.dead, `untreated ${none.dead} vs treated ${full.dead}`);
  assert.ok(none.dead > 0.01 && none.dead < 0.2, 'untreated child malaria mortality plausible: ' + none.dead);
  assert.ok(over.poisoned > 0.08, 'overdose poisons: ' + over.poisoned);
  assert.ok(full.poisoned < 0.02, 'standard dose rarely poisons: ' + full.poisoned);
});
test('diarrhoea: rehydration drink prevents death from dehydration', () => {
  const none = cohort('watery_diarrhea', 300, { age: 1, days: 10 });
  const fluid = cohort('watery_diarrhea', 300, { age: 1, days: 10, rx: ors() });
  assert.ok(none.dead > 0.01 && none.dead < 0.15, 'untreated: ' + none.dead);
  assert.ok(fluid.dead < none.dead / 3, `ORS ${fluid.dead} vs none ${none.dead}`);
});
test('self-limiting and chronic illnesses behave', () => {
  assert.ok(cohort('common_cold', 100, { days: 14 }).cured > 0.95, 'colds pass');
  assert.equal(cohort('scabies', 60, { age: 8, days: 20 }).cured, 0, 'scabies does not cure itself');
  assert.equal(cohort('heart_failure', 60, { age: 70, days: 20 }).cured, 0, 'heart failure is chronic');
});

// ——— antibiotics: kill depends on the strain's MIC, so resistance decides the outcome
const course = (active, mgkg, perDay, days) => (p) => [{ name: active, item: 'x', start: 0, amount: 1, perDay, days, left: 999, counselled: true, actives: { [active]: mgkg * p.weight }, q: 1 }];
const adult = (active, mg, perDay, days) => () => [{ name: active, item: 'x', start: 0, amount: 1, perDay, days, left: 999, counselled: true, actives: { [active]: mg }, q: 1 }];
const allResistant = (org, drug) => { const R = baseResistance(); R[org][drug] = 1; return R; };
test('pneumonia: amoxicillin cuts child deaths; cotrimoxazole, mostly resisted, helps less', () => {
  const none = cohort('pneumonia', 300, { age: 2, days: 21 });
  const amox = cohort('pneumonia', 300, { age: 2, days: 21, rx: course('amoxicillin', 40, 2, 5) });
  const cotrim = cohort('pneumonia', 300, { age: 2, days: 21, rx: course('cotrimoxazole', 4, 2, 5) });
  assert.ok(none.dead > 0.02 && none.dead < 0.15, 'untreated child pneumonia: ' + none.dead);
  assert.ok(amox.dead < none.dead / 3, `amoxicillin ${amox.dead} vs none ${none.dead}`);
  assert.ok(cotrim.dead >= amox.dead, `cotrimoxazole ${cotrim.dead} vs amoxicillin ${amox.dead}`);
});
test('infected wound: dicloxacillin heals; amoxicillin meets penicillinase; MRSA defeats dicloxacillin', () => {
  const none = cohort('wound_infected', 200, { age: 20, days: 21 });
  const diclox = cohort('wound_infected', 200, { age: 20, days: 21, rx: adult('dicloxacillin', 500, 4, 7) });
  const amox = cohort('wound_infected', 200, { age: 20, days: 21, rx: adult('amoxicillin', 500, 3, 7) });
  const mrsa = cohort('wound_infected', 200, { age: 20, days: 21, rx: adult('dicloxacillin', 500, 4, 7), resist: allResistant('s_aureus', 'dicloxacillin') });
  assert.ok(diclox.cured > 0.6 && diclox.cured > none.cured * 3, `dicloxacillin ${diclox.cured} vs none ${none.cured}`);
  assert.ok(amox.cured < diclox.cured * 0.6, `amoxicillin ${amox.cured} vs dicloxacillin ${diclox.cured}`);
  assert.ok(mrsa.cured < none.cured + 0.05, `MRSA ${mrsa.cured} vs none ${none.cured}`);
});
test('the valley: antibiotic use raises resistance over decades, and it fades slowly without it', () => {
  const cl = newClinic();
  const r0 = resistance(cl).s_pneumoniae.amoxicillin;
  for (let i = 0; i < 40; i++) selectPressure(cl, 'amoxicillin');
  assert.ok(resistance(cl).s_pneumoniae.amoxicillin < r0 + 0.01, 'a busy season barely moves it');
  for (let i = 40; i < 3000; i++) selectPressure(cl, 'amoxicillin'); // a few courses a day for ~20 game years
  const r1 = resistance(cl).s_pneumoniae.amoxicillin;
  assert.ok(r1 > r0 + 0.1, `3000 courses: ${r0} → ${r1}`);
  assert.equal(resistance(cl).shigella.amoxicillin > baseResistance().shigella.amoxicillin, true, 'every organism the drug touches is selected');
  fadeResistance(cl, 1); fadeResistance(cl, 101); // 100 days pass in one jump (slept, away)
  const r2 = resistance(cl).s_pneumoniae.amoxicillin;
  assert.ok(r2 < r1 && r2 > r0, `after 100 days without: ${r2}`);
  const e0 = resistance(cl).e_coli.ciprofloxacin;
  selectPressure(cl, 'ciprofloxacin', 6, 'shigella');
  assert.equal(resistance(cl).e_coli.ciprofloxacin, e0, 'a resistant Shigella spreading at home leaves E. coli alone');
});
test('penicillin allergy shows itself on the first doses', () => {
  let allergic = 0, reacted = 0;
  for (let i = 0; i < 600; i++) {
    const p = makePatient({ seed: 3, key: 'al' + i, t: 0, season: 'rains', cond: 'back_pain', age: 30 });
    if (p.allergy !== 'penicillin') continue;
    allergic++;
    p.rx = adult('amoxicillin', 500, 3, 5)();
    simulate(p, 2 * DAY);
    if (p.toxSeen.allergy) reacted++;
  }
  assert.ok(allergic > 3 && allergic < 30, 'about 2% are truly allergic: ' + allergic);
  assert.equal(reacted, allergic);
});
// ——— antimalarials and overdoses (WHO Guidelines for malaria 2023; Riou 1988; Prescott 1983)
const sensitive = (drug) => { const R = baseResistance(); R.p_falciparum[drug] = 0; return R; };
const al = (p) => [{ name: 'al', item: 'x', start: 0, amount: p.weight < 15 ? 1 : 2, perDay: 2, days: 3, left: 999, counselled: true, actives: { artemether: 20, lumefantrine: 120 }, q: 1 }];
const cq = (p) => [course('chloroquine', 10, 1, 2)(p)[0], { ...course('chloroquine', 5, 1, 1)(p)[0], item: 'y', start: 2 * DAY }];
test('malaria: artemether–lumefantrine cures; artesunate alone needs 7 days', () => {
  const o = { age: 3, days: 42 };
  const AL = cohort('malaria', 200, { ...o, rx: al });
  const as3 = cohort('malaria', 200, { ...o, rx: course('artesunate', 4, 1, 3) });
  const as7 = cohort('malaria', 200, { ...o, rx: course('artesunate', 4, 1, 7) });
  assert.ok(AL.cured > 0.9, 'AL 3 days: ' + AL.cured);
  assert.ok(as3.cured < 0.7 && as7.cured > 0.75 && as3.cured < as7.cured - 0.2, `artesunate 3 days ${as3.cured} vs 7 days ${as7.cured}`);
});
test('malaria: chloroquine cures sensitive parasites, fails resistant ones; 40 mg/kg at once poisons', () => {
  const o = { age: 3, days: 42 };
  const sens = cohort('malaria', 200, { ...o, rx: cq, resist: sensitive('chloroquine') });
  const res = cohort('malaria', 200, { ...o, rx: cq, resist: allResistant('p_falciparum', 'chloroquine') });
  const over = cohort('malaria', 200, { ...o, rx: course('chloroquine', 40, 1, 1) });
  assert.ok(sens.cured > 0.85, 'sensitive: ' + sens.cured);
  assert.ok(res.cured < 0.3, 'resistant: ' + res.cured);
  assert.ok(sens.poisoned < 0.02 && res.poisoned < 0.02, `standard course poisons ${sens.poisoned}, ${res.poisoned}`);
  assert.ok(over.poisoned > 0.1, '40 mg/kg at once: ' + over.poisoned);
});
test('paracetamol: the right dose never poisons; a massive overdose does', () => {
  const child = cohort('common_cold', 200, { age: 3, days: 7, rx: course('paracetamol', 15, 4, 5) });
  const adultStd = cohort('common_cold', 200, { age: 30, days: 7, rx: adult('paracetamol', 1000, 4, 5) });
  const over = cohort('common_cold', 300, { age: 30, days: 4, rx: adult('paracetamol', 20000, 1, 1) });
  assert.equal(child.poisoned + adultStd.poisoned, 0, `standard dosing poisons: child ${child.poisoned}, adult ${adultStd.poisoned}`);
  assert.ok(over.poisoned > 0.02, '20 g at once: ' + over.poisoned);
});

// ——— phase 2c: more of the book
test('typhoid kills about one in ten untreated; ciprofloxacin, where it still works, prevents that', () => {
  const none = cohort('typhoid', 200, { age: 15, days: 49 });
  const cipro = cohort('typhoid', 200, { age: 15, days: 49, rx: course('ciprofloxacin', 15, 2, 7), resist: allResistant('s_typhi', 'chloramphenicol') });
  assert.ok(none.dead > 0.05 && none.dead < 0.25, 'untreated typhoid: ' + none.dead);
  assert.ok(cipro.dead < none.dead / 5 && cipro.cured > 0.9, `ciprofloxacin ${JSON.stringify(cipro)}`);
});
test('measles: vitamin A cuts deaths in toddlers by roughly half or more', () => {
  const none = cohort('measles', 400, { age: 1.5, days: 21 });
  const vitA = cohort('measles', 400, { age: 1.5, days: 21, rx: adult('vitamin_a', 60, 1, 2) });
  assert.ok(none.dead > 0.02 && none.dead < 0.15, 'untreated measles: ' + none.dead);
  assert.ok(vitA.dead <= none.dead * 0.6, `vitamin A ${vitA.dead} vs none ${none.dead}`);
});
test('hookworm: albendazole kills the worms, iron rebuilds the blood; untreated it never ends', () => {
  const none = cohort('hookworm', 200, { age: 8, days: 60 });
  const alb = cohort('hookworm', 200, { age: 8, days: 60, rx: adult('albendazole', 400, 1, 1) });
  const both = cohort('hookworm', 200, { age: 8, days: 60, rx: () => [...adult('albendazole', 400, 1, 1)(), ...adult('iron', 65, 1, 60)()] });
  assert.equal(none.cured, 0);
  assert.ok(both.cured > alb.cured + 0.1, `with iron ${both.cured} vs without ${alb.cured}`);
});
test('urine infection: ciprofloxacin cures; cotrimoxazole fails where E. coli resists it', () => {
  const cipro = cohort('uti', 200, { age: 30, sex: 'f', days: 21, rx: adult('ciprofloxacin', 500, 2, 3), resist: allResistant('e_coli', 'cotrimoxazole') });
  const cotrim = cohort('uti', 200, { age: 30, sex: 'f', days: 21, rx: adult('cotrimoxazole', 160, 2, 3), resist: allResistant('e_coli', 'cotrimoxazole') });
  assert.ok(cipro.cured > 0.9, 'ciprofloxacin ' + cipro.cured);
  assert.ok(cotrim.cured < cipro.cured - 0.3, `cotrimoxazole against resistant E. coli ${cotrim.cured}`);
});
test('amoebas and giardia: metronidazole cures; amoebic dysentery drags on without it', () => {
  const none = cohort('amoebiasis', 150, { age: 20, days: 28 });
  const amoeba = cohort('amoebiasis', 150, { age: 20, days: 28, rx: adult('metronidazole', 750, 3, 7) });
  const giardia = cohort('giardia', 150, { age: 5, days: 28, rx: course('metronidazole', 5, 3, 5) });
  assert.ok(none.cured < 0.1, 'untreated amoebiasis ' + none.cured);
  assert.ok(amoeba.cured > 0.9 && giardia.cured > 0.9, `metronidazole: amoeba ${amoeba.cured}, giardia ${giardia.cured}`);
});
