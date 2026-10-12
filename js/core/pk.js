// pk.js — pharmacokinetics and pharmacodynamics. Pure functions over a patient's dose history.
//
// Systemic actives: one-compartment model with first-order absorption, summed over every dose:
//   C(t) = Σ F·D·ka / (V·(ka − ke)) · (e^(−ke·τ) − e^(−ka·τ)),   τ = hours since the dose
// V = vd (L/kg) × weight; ke = ln2 / t½. Each patient carries their own multipliers on clearance and
// volume (seeded, log-normal with the active's `spread`), so the same dose lands differently in each.
// Auto-induction (artemisinin) raises ke over days of continuous dosing.
import { ACTIVE } from './content/actives.js';

const LN2 = Math.LN2;
const HOUR = 60; // game minutes

/** Patient-specific PK parameters for an active. */
export function pkParams(p, a) {
  const k = p.pkv?.[a.id] || [1, 1];
  const V = a.pk.vd * p.weight * k[1];
  let ke = (LN2 / a.pk.half) * k[0];
  if (p.age < 1) ke *= 0.7;            // immature liver and kidney
  else if (p.age >= 70) ke *= 0.75;    // aged clearance
  return { F: a.pk.F, ka: a.pk.ka, ke, V };
}

/** Plasma concentration (mg/L) of a systemic active at game time t (minutes). */
export function conc(p, activeId, t) {
  const a = ACTIVE.get(activeId);
  const doses = p.doses?.sys?.[activeId];
  if (!a || a.channel !== 'systemic' || !doses?.length) return 0;
  const { F, ka, V } = pkParams(p, a);
  let { ke } = pkParams(p, a);
  if (a.pk.induce) ke *= induction(doses, t, a.pk.induce);
  let c = 0;
  for (const [td, mg] of doses) {
    const tau = (t - td) / HOUR;
    if (tau < 0) continue;
    if (tau > (LN2 / ke) * 12) continue; // < 0.03% left
    const ka2 = Math.abs(ka - ke) < 1e-6 ? ka * 1.0001 : ka;
    c += (F * mg * ka2) / (V * (ka2 - ke)) * (Math.exp(-ke * tau) - Math.exp(-ka2 * tau));
  }
  return Math.max(0, c);
}

/** Auto-induction factor: rises toward `max` over `days` of dosing, falls back after a 3-day gap. */
function induction(doses, t, { max, days }) {
  let start = null, last = null;
  for (const [td] of doses) {
    if (td > t) continue;
    if (last !== null && td - last > 3 * 24 * HOUR) start = td;
    if (start === null) start = td;
    last = td;
  }
  if (start === null || t - last > 3 * 24 * HOUR) return 1;
  const d = Math.min(1, (t - start) / (days * 24 * HOUR));
  return 1 + (max - 1) * d;
}

/** Hill/Emax fraction in [0,1]. */
export const hill = (c, ec50, h = 1) => (c <= 0 ? 0 : c ** h / (ec50 ** h + c ** h));

/** Exposure of a gut-acting dose: E = 1 − exp(−mg · perMg). */
export const gutExposure = (mg, perMg) => 1 - Math.exp(-mg * perMg);

/**
 * Everything the drugs are doing to a patient at time t:
 *   relief[on]   — fraction of a symptom taken away (0..1)
 *   worse[on]    — fraction a symptom is made worse
 *   prr[target]  — summed effective log10 parasite-reduction per 48 h
 *   heart        — inotropic effect (0..1)
 *   conc[active] — plasma levels, for toxicity and the lab
 */
export function drugState(p, t) {
  const out = { relief: {}, worse: {}, prr: {}, heart: 0, conc: {} };
  const relieve = (on, v) => { out.relief[on] = 1 - (1 - (out.relief[on] || 0)) * (1 - v); };
  const strain = p.conds?.find((c) => c.org === 'p_falciparum')?.mic; // a resistant parasite needs more drug
  for (const id of Object.keys(p.doses?.sys || {})) {
    const a = ACTIVE.get(id);
    const c = conc(p, id, t);
    out.conc[id] = c;
    if (c <= 0) continue;
    for (const e of a.effects || []) {
      const f = hill(c, e.ec50 * (e.prr ? strain?.[id] ?? 1 : 1), e.hill || 1);
      if (e.prr) out.prr[e.on] = (out.prr[e.on] || 0) + e.prr * f;
      else if (e.on === 'heart') out.heart = Math.max(out.heart, (e.emax || 1) * f);
      else relieve(e.on, (e.emax || 1) * f);
    }
  }
  for (const [td, id, mg] of p.doses?.gut || []) {
    const a = ACTIVE.get(id);
    if (!a?.gut) continue;
    const h = (t - td) / HOUR;
    if (h < 0 || h > a.gut.duration) continue;
    for (const e of a.gut.effects) {
      if (e.on.startsWith('worms_')) continue; // worm kills happen once, at the dose (disease.js)
      const v = e.per * gutExposure(mg, e.perMg);
      if (v >= 0) relieve(e.on, v); else out.worse[e.on] = Math.min(1.5, (out.worse[e.on] || 0) - v);
    }
  }
  return out;
}

/** Toxic signs present at time t: [{ active, sign, text, harm }]. */
export function toxSigns(p, t, ds = drugState(p, t)) {
  const out = [];
  for (const [id, c] of Object.entries(ds.conc)) {
    const a = ACTIVE.get(id);
    for (const x of a.toxic || []) if (c >= x.at) out.push({ active: id, ...x, c });
  }
  return out;
}

/** Steady-state average concentration for a regimen (for the handbook's dose helper). */
export function cssAvg(p, activeId, mgPerDose, perDay) {
  const a = ACTIVE.get(activeId);
  const { F, ke, V } = pkParams(p, a);
  const tau = 24 / perDay;
  return (F * mgPerDose) / (ke * V * tau);
}
