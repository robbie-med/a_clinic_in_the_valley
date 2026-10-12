// disease.js — illness in the body, hour by hour. Every patient (in the clinic or at home) is stepped
// by simulate(): their medicines are taken (or not), drugs act through pk.js, each condition's model
// moves on, water is lost and replaced, and death is rolled against the hour's hazard.
//
// Models (conditions.js `model`): viral, bacterial, malaria, wound, burn, scabies, worms, pain, heart,
// pregnancy, preeclampsia. State lives on the condition record so it saves as plain JSON.
import { COND } from './content/conditions.js';
import { ACTIVE } from './content/actives.js';
import { drugState, toxSigns, gutExposure } from './pk.js';
import { makeRng } from './rng.js';

export const HOUR = 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const bloodUl = (p) => p.weight * 80 * 1000; // ~80 ml/kg
const ageBand = (age) => (age < 2 ? 0 : age < 5 ? 1 : age < 15 ? 2 : 3);
/** Host defence 0..1+: small children, the old, the thin and the pregnant fight infection less well. */
export function hostDefence(p) {
  let d = 1;
  if (p.age < 1) d *= 0.6; else if (p.age < 5) d *= 0.75; else if (p.age >= 65) d *= 0.75;
  d *= lerp(0.55, 1, clamp(p.nutrition ?? 1, 0, 1));
  if (p.pregnant) d *= 0.9;
  return d;
}

// ————————————————————————————————————————————— models
// init(p, c, rng, sinceH): fill condition state as it is when the patient walks in (already ill for sinceH)
// step(p, c, dtH, x): advance; return { loss: L/h fluid, hazard: /h, done: bool }
// x = { ds (drugState), rng, t (game min), hosp (in hospital care), instr: Set of followed instructions }

const MODELS = {
  viral: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.D = Math.max(2, P.days[0] + (rng() * 2 - 1) * P.days[1]) * 24;
      c.age = since;
      c.sev = lerp(0.5, 1.2, rng()) * (p.age < 2 ? 1.15 : 1);
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const pk = P.peak * 24;
      const s = c.age < pk ? c.age / pk : clamp(1 - (c.age - pk) / (c.D - pk), 0, 1);
      c.s = clamp(s, 0, 1) * c.sev;
      let loss = 0;
      if (P.stool) loss += stoolLoss(p, P.stool, c.s, x);
      if (P.vomit && c.age < 48) loss += (5 / 1000 / 24) * p.weight * c.s * P.vomit;
      return { loss, hazard: 0, done: c.age >= c.D };
    },
  },
  bacterial: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.L = lerp(P.L0[0], P.L0[1], rng());
      c.age = since;
      c.sev = lerp(0.7, 1.2, rng());
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const imm = P.imm * hostDefence(p) * Math.min(1, (c.age / P.onset) ** 2);
      const hosp = x.hosp ? 0.25 : 0; // antibiotic at the health centre: ~0.25 log10/h kill
      c.L = Math.min(P.Lmax, c.L + dt * (P.r * (1 - c.L / P.Lmax) - imm - hosp));
      c.s = clamp((c.L - P.Lsym) / (P.Lmax - P.Lsym), 0, 1) * c.sev;
      let loss = 0;
      if (P.stool) loss += stoolLoss(p, P.stool, c.s * 1.4, x);
      const vuln = p.age < 5 ? 1.6 : p.age >= 65 ? 1.6 : 0.5;
      return { loss, hazard: P.hazard * c.s ** 3 * vuln / hostDefence(p), done: c.L < 1 };
    },
  },
  malaria: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.P = lerp(P.P0[0], P.P0[1], rng()) + Math.log10(p.weight / 30);
      c.I = p.immMalaria ?? clamp(0.1 + (p.age - 0.5) / 13, 0.1, 0.85) * (p.pregnant ? 0.7 : 1);
      c.phase = rng() * 48;
      c.mf = P.mf * Math.exp((rng() - 0.5) * 1.6);   // strains and hosts differ: ~6× to ~27× per cycle
      c.age = since;
      c.hb = p.hb;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const blood = Math.log10(bloodUl(p));
      if (c.para > 1000) c.acq = Math.min(0.35, (c.acq || 0) + dt * 0.02 / 24); // strain immunity builds over ~2 weeks
      const I = Math.min(0.95, c.I + (c.acq || 0));
      const cap = Math.log10(5e5) - 2.5 * I + blood;                     // parasite density the host allows
      const grow = (Math.log10(c.mf || P.mf) / 48) * clamp(1 - Math.exp((c.P - cap) * 2.3), -1, 1);
      const clear = 0.004 + 0.03 * I;                                     // spleen + acquired immunity
      const prr = (x.ds.prr.plasmodium || 0) + (x.hosp ? 4 : 0);          // drug (log10 per 48 h, net)
      const f = clamp(prr / 3, 0, 1);                                     // full drug effect stops growth
      c.P += dt * (grow * (1 - f) - clear - prr / 48);
      const para = 10 ** (c.P - blood);                                   // parasites per µL
      c.para = para;
      // anaemia: haemolysis with parasitaemia, slow recovery when low
      c.hb += dt * ((-P.hbDrop / 24) * clamp(para / 1e5, 0, 3) ** 0.8 + (para < 500 ? 0.0012 * (p.hb - c.hb) : 0));
      c.hb = clamp(c.hb, 2, p.hb + 0.5);
      const severe = clamp(Math.log10(para / 2e4) / 1.2, 0, 1.5) + clamp((6 - c.hb) / 2.5, 0, 1);
      c.sev = clamp(severe, 0, 1.5);
      c.s = clamp(Math.log10(Math.max(1, para) / lerp(P.pyro[0], P.pyro[1], I)) / 2.5, 0, 1);
      const vuln = (p.age < 5 ? 1.8 : 1) * (p.pregnant ? 1.6 : 1);
      if (c.P < 0) return { loss: 0, hazard: 0, done: true };
      return { loss: c.s * 0.0004 * p.weight / 24 * 10, hazard: P.hazard * c.sev ** 3 * vuln, done: false };
    },
  },
  wound: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.size = lerp(P.size[0], P.size[1], rng());
      c.dirt = lerp(P.dirt[0], P.dirt[1], rng());
      c.I = lerp(P.I0[0], P.I0[1], rng());
      c.heal = 0; c.age = since; c.vir = lerp(0.7, 1.6, rng());
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const top = x.topical; // { wound: {infect, heal}, ... }
      const hosp = x.hosp ? 0.3 : 0;
      const dressed = x.instr.has('dressing');
      c.dirt = clamp(c.dirt - dt * 0.0015 + (dressed ? 0 : dt * 0.001), 0, 1);
      const growth = 0.035 * (c.vir || 1) * (0.3 + c.dirt) * (1 - c.I / 9);
      const imm = 0.022 * hostDefence(p) * (c.I > 0.2 ? 1 : 0);
      c.I = clamp(c.I + dt * (growth - imm - hosp) - (top.wound?.infect || 0) - (x.instr.has('hot_compress') ? dt * 0.012 : 0), 0, 9);
      const rate = (1 / (P.days * 24 + c.size * 12)) * (1 + (top.wound?.healBonus || 0)) * (c.I > 3 ? 0.15 : c.I > 2 ? 0.6 : 1);
      c.heal = clamp(c.heal + dt * rate, 0, 1);
      c.s = clamp(c.I / 7, 0, 1);
      return { loss: 0, hazard: c.I > 6.5 ? 0.004 * (c.I - 6.5) ** 2 / hostDefence(p) : 0, done: c.heal >= 1 && c.I < 1.5 };
    },
  },
  burn: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.tbsa = lerp(P.tbsa[0], P.tbsa[1], rng()) * (p.age < 5 ? 1.3 : 1);
      c.deep = rng() < P.deep;
      c.I = 0.3; c.dirt = 0.3; c.heal = 0; c.age = since;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const top = x.topical;
      c.dirt = clamp(c.dirt - dt * 0.003 + (x.instr.has('dressing') ? 0 : dt * 0.001), 0, 1);
      c.I = clamp(c.I + dt * (0.03 * (0.3 + c.dirt) * (1 - c.I / 9) - 0.02 * hostDefence(p) - (x.hosp ? 0.3 : 0)) - (top.burn?.infect || 0) - (top.wound?.infect || 0), 0, 9);
      const rate = (1 / ((P.days + (c.deep ? 20 : 0)) * 24)) * (1 + (top.burn?.healBonus || 0) + (top.wound?.healBonus || 0)) * (c.I > 3 ? 0.2 : 1);
      c.heal = clamp(c.heal + dt * rate, 0, 1);
      c.s = clamp(c.tbsa / 10 + c.I / 9, 0, 1);
      const loss = c.age < 48 ? (c.tbsa * p.weight * 0.6 / 1000) / 24 * (1 - c.heal) : 0; // weeping burns lose water
      return { loss, hazard: c.I > 6.5 ? 0.004 * (c.I - 6.5) ** 2 : 0, done: c.heal >= 1 };
    },
  },
  scabies: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.M = lerp(P.mites[0], P.mites[1], rng());
      c.sens = lerp(P.sens[0], P.sens[1], rng());
      c.resid = 0; c.I = 0; c.age = since;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const kill = x.topical.scabies?.killFrac || 0;           // fraction surviving this hour's applications
      if (c.M > 0) {
        const before = c.M;
        c.M = c.M * Math.exp(P.growth * dt) * (1 - kill);
        if (c.M < 1 && x.rng() < 1 - c.M) c.M = 0;
        if (c.M === 0 && before > 0) c.resid = 1;              // the itch outlives the mites (~2 weeks)
      }
      if (!x.instr.has('treat_family') && x.rng() < 0.0015 * dt) c.M += 1; // the family passes it back
      c.resid = Math.max(0, c.resid - dt / (14 * 24));
      const itch = c.sens * Math.max(clamp(c.M / 12, 0, 1), c.resid * 0.6);
      c.s = itch;
      c.I = clamp(c.I + dt * (itch > 0.6 ? 0.004 : -0.01), 0, 3);   // scratched sores get infected
      return { loss: 0, hazard: 0, done: c.M === 0 && c.resid < 0.05 && c.I < 0.5 };
    },
  },
  worms: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.W = Math.round(lerp(P.worms[0], P.worms[1], rng() ** 1.5));
      c.age = since;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      for (const k of x.wormKills[P.target] || []) c.W = binom(c.W, 1 - k, x.rng);
      const die = 1 - Math.exp(-dt / (P.life * 24));
      c.W = binom(c.W, 1 - die, x.rng);
      if (P.reinfect) {
        const hyg = x.instr.has('hygiene') ? 0.1 : 1;
        const add = c.W * 0.03 / 24 * dt * hyg;
        c.W += Math.floor(add) + (x.rng() < add % 1 ? 1 : 0);
      }
      c.s = clamp(c.W / (P.heavy < 1e8 ? 30 : 60), 0, 1);
      return { loss: 0, hazard: P.heavy < 1e8 && c.W > P.heavy && p.age < 10 ? 0.0004 : 0, done: c.W === 0 };
    },
  },
  pain: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.p0 = lerp(P.pain[0], P.pain[1], rng());
      c.age = since;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      c.s = c.p0 * 0.5 ** (c.age / (P.halfDays * 24)) * (x.instr.has('rest_move') ? 0.85 : 1);
      return { loss: 0, hazard: 0, done: c.s < 0.08 };
    },
  },
  heart: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.V = lerp(P.V0[0], P.V0[1], rng());
      c.c = lerp(P.c[0], P.c[1], rng());
      c.age = since;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const ceff = c.c * (1 + x.ds.heart) + (x.hosp ? 0.15 : 0);
      const target = Math.max(0, (0.72 - ceff) * 16 - (x.instr.has('low_salt') ? 1 : 0));
      const diur = (x.ds.relief.fluid_out || 0) * 0.15 / 24;
      c.V = Math.max(0, c.V + dt * ((target - c.V) / (6 * 24) - diur));
      c.s = clamp(c.V / 6, 0, 1.3);
      return { loss: 0, hazard: c.V > 5 ? P.hazard * (c.V - 5) ** 2 : 0, done: false };
    },
  },
  pregnancy: {
    init(p, c, rng, since) { c.age = since; },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const w = p.pregnant;
      c.s = w < 5 ? 0 : w < P.peak ? (w - 5) / (P.peak - 5) : clamp(1 - (w - P.peak) / (P.end - P.peak), 0, 1);
      c.s *= p.nauseaSev ?? 0.8;
      const vomit = c.s * (1 - (x.ds.relief.nausea || 0));
      return { loss: vomit * 0.012 * p.weight / 24, hazard: 0, done: !w || w >= P.end };
    },
  },
  preeclampsia: {
    init(p, c, rng) { const P = COND.get(c.id).params; c.sev = lerp(P.sev[0], P.sev[1], rng()); c.age = 0; },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      if (x.hosp) { c.delivered = true; return { loss: 0, hazard: 0, done: true }; }
      c.sev = clamp(c.sev + dt * P.rise / 24 * (0.6 + x.rng()), 0, 1.2);
      c.s = c.sev;
      return { loss: 0, hazard: c.sev > 0.7 ? P.hazard * (c.sev - 0.6) * 4 : 0, done: !p.pregnant };
    },
  },
};

function stoolLoss(p, S, s, x) {
  const mlKg = S.mlKg[ageBand(p.age)];
  const relief = x.ds.relief.stool || 0, worse = x.ds.worse.stool || 0;
  return (mlKg * p.weight / 1000 / 24) * s * (1 - relief) * (1 + worse);
}
function binom(n, keep, rng) {
  if (n <= 0) return 0;
  if (n > 60) return Math.max(0, Math.round(n * keep + Math.sqrt(n * keep * (1 - keep)) * gauss(rng)));
  let k = 0;
  for (let i = 0; i < n; i++) if (rng() < keep) k++;
  return k;
}
const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());

// ————————————————————————————————————————————— conditions on a patient
export function addCondition(p, id, rng, sinceH = 24) {
  const def = COND.get(id);
  const c = { id, t0: p.t - sinceH * HOUR, sinceH };
  MODELS[def.model].init(p, c, rng, sinceH);
  // walk the illness forward silently so the state matches "ill for sinceH hours"
  const x = { ds: { relief: {}, worse: {}, prr: {}, heart: 0, conc: {} }, rng, t: p.t, hosp: false, instr: new Set(), topical: {}, wormKills: {} };
  c.age = 0;
  for (let h = 0; h < sinceH; h++) MODELS[def.model].step(p, c, 1, x);
  p.conds.push(c);
  return c;
}

// ————————————————————————————————————————————— taking medicine at home
/**
 * A prescription line: { item, q, left, amount, perDay, days, start, route, actives:{id:mgPerUnit},
 * topical:{id:strength}, fluid:{naMmol}, instr? }.  `left` is how much was dispensed (ml/g/apps).
 */
function dosesDue(rx, t0, t1) {
  const out = [];
  if (rx.stopped || rx.instr) return out;
  const every = (24 / rx.perDay) * HOUR;
  const end = rx.start + rx.days * 24 * HOUR;
  let k = Math.max(0, Math.ceil((t0 - rx.start) / every));
  for (let t = rx.start + k * every; t < t1 && t < end; t = rx.start + ++k * every) if (t >= t0) out.push([t, k]);
  return out;
}

/** Advance a patient from p.t to toT (game minutes). Returns events [{t, kind, text}]. */
export function simulate(p, toT, C) {
  const ev = [];
  if (p.dead) { p.t = toT; return ev; }
  const rng = makeRng(p.seed, 'sim', Math.floor(p.t));
  while (p.t + HOUR <= toT && !p.dead) {
    const t0 = p.t, t1 = p.t + HOUR;
    const topical = {};
    const wormKills = {};
    const instr = new Set((p.rx || []).filter((r) => r.instr && !r.stopped && (r.until ?? Infinity) > t0 && rng() < (p.adh ?? 0.8) + 0.15).map((r) => r.instr));
    let fluidIn = 0, naLoad = 0;
    for (const rx of p.rx || []) {
      for (const [td, k] of dosesDue(rx, t0, t1)) {
        if (rx.left <= 0) { if (!rx.ranOut) { rx.ranOut = true; ev.push({ t: td, kind: 'ranout', text: `ran out of ${rx.name}` }); } continue; }
        if (makeRng(p.seed, 'dose', rx.item, rx.start, k)() > takeChance(p, rx)) { rx.missed = (rx.missed || 0) + 1; continue; }
        const amt = Math.min(rx.amount, rx.left);
        rx.left -= amt; rx.taken = (rx.taken || 0) + 1;
        applyDose(p, rx, amt, td, topical, wormKills);
        if (rx.fluid) { fluidIn += amt / 1000; naLoad += (amt / 1000) * rx.fluid.na; }
      }
      // stop when better: the classic way a course is cut short
      if (!rx.instr && !rx.stopped && p.feelBetter && !rx.fluid && rng() < (rx.counselled ? 0.0015 : 0.008)) {
        rx.stopped = t0; ev.push({ t: t0, kind: 'stopped', text: `stopped ${rx.name} (felt better)` });
      }
    }
    if (p.pregnant) {
      p.pregnant += 1 / 168;
      if (p.pregnant >= 40) { p.pregnant = 0; p.delivered = t1; ev.push({ t: t1, kind: 'birth', text: 'gave birth' }); }
    }
    const ds = drugState(p, t1);
    const x = { ds, rng, t: t1, hosp: p.hospital && t1 >= p.hospital.from && t1 < p.hospital.until, instr, topical, wormKills };
    let loss = 0, hazard = 0;
    for (const c of [...p.conds]) {
      const def = COND.get(c.id);
      const r = MODELS[def.model].step(p, c, 1, x);
      loss += r.loss; hazard += r.hazard;
      if (r.done) {
        p.conds.splice(p.conds.indexOf(c), 1);
        p.healed.push({ id: c.id, t: t1 });
        ev.push({ t: t1, kind: 'healed', id: c.id, text: `${def.name} is gone` });
      }
    }
    // water: the sick drink some on their own; the rehydration drink does the real work
    const selfDrink = loss * (p.age < 2 ? 0.58 : p.age < 5 ? 0.66 : 0.78) * (p.hyd / p.weight > 0.08 ? 0.5 : 1);
    const absorbed = fluidIn * 0.9 * (1 - 0.3 * vomiting(p) * (1 - (ds.relief.nausea || 0)));
    if (x.hosp) p.hyd = Math.max(0, p.hyd - 0.2 * p.weight / 24);
    p.hyd = Math.max(0, p.hyd + loss - selfDrink - absorbed);
    const d = p.hyd / p.weight;
    if (d > 0.09) hazard += 0.03 * ((d - 0.09) / 0.03) ** 2;
    if (fluidIn > 0 && naLoad / fluidIn > 120) { hazard += 0.001 * (naLoad / fluidIn - 120) / 30; p.flags.hyperNa = t1; }
    // poisoning
    const tox = toxSigns(p, t1, ds);
    for (const s of tox) {
      hazard += s.harm * 0.01;
      if (!p.toxSeen[s.sign]) { p.toxSeen[s.sign] = t1; ev.push({ t: t1, kind: 'tox', text: s.text, active: s.active }); }
    }
    if (ds.conc.quinine > 5 && (p.age < 5 || p.pregnant) && rng() < 0.004) { hazard += 0.01; p.toxSeen.lowsugar ||= t1; }
    p.lastTox = tox.map((s) => s.sign);
    // feeling better? (drives "stop when better")
    const burden = p.conds.reduce((a, c) => a + (c.s || 0), 0);
    p.burden0 ??= Math.max(0.2, burden);
    p.feelBetter = burden < p.burden0 * 0.35;
    if (rng() < hazard) {
      p.dead = true; p.diedAt = t1;
      p.cause = causeOfDeath(p, tox, d);
      ev.push({ t: t1, kind: 'died', text: `died (${p.cause})` });
    }
    p.t = t1;
  }
  if (!p.dead) p.t = Math.max(p.t, Math.min(toT, p.t));
  return ev;
}

function takeChance(p, rx) {
  let a = p.adh ?? 0.8;
  if (rx.counselled) a += 0.1;
  if (rx.perDay > 3) a -= 0.08;
  if (rx.bitter) a -= 0.07;
  if (rx.route === 'topical' && rx.perDay >= 3) a -= 0.05;
  return clamp(a, 0.2, 0.98);
}
function vomiting(p) { return p.conds.some((c) => (c.id === 'watery_diarrhea' && c.age < 48) || c.id === 'nausea_pregnancy') ? 0.5 : 0; }

function applyDose(p, rx, amt, td, topical, wormKills) {
  for (const [id, perUnit] of Object.entries(rx.actives || {})) {
    const a = ACTIVE.get(id);
    const mg = perUnit * amt * (rx.q ?? 1);
    if (a.channel === 'systemic') { (p.doses.sys[id] ||= []).push([td, mg]); trimDoses(p.doses.sys[id], td); }
    else if (a.channel === 'gut') {
      p.doses.gut.push([td, id, mg]);
      if (p.doses.gut.length > 60) p.doses.gut.splice(0, p.doses.gut.length - 60);
      for (const e of a.gut.effects) if (e.on.startsWith('worms_')) (wormKills[e.on] ||= []).push(e.per * gutExposure(mg, e.perMg));
    }
  }
  for (const [id, strength] of Object.entries(rx.topical || {})) {
    const a = ACTIVE.get(id);
    const T = a.topical, k = strength * (rx.q ?? 1);
    const tgt = topical[T.on] ||= {};
    if (T.kill) tgt.killFrac = 1 - (1 - (tgt.killFrac || 0)) * (1 - Math.min(0.95, T.kill * k));
    if (T.infect) tgt.infect = (tgt.infect || 0) + T.infect * k * 0.3;
    if (T.heal) tgt.healBonus = Math.max(tgt.healBonus || 0, T.heal * k);
    if (T.relief) tgt.relief = Math.max(tgt.relief || 0, T.relief * k);
    p.lastTopical = td;
  }
}
function trimDoses(list, t) { while (list.length > 2 && t - list[0][0] > 40 * 24 * HOUR) list.shift(); }

function causeOfDeath(p, tox, d) {
  if (tox.some((s) => s.harm >= 0.2)) return 'poisoned by ' + ACTIVE.get(tox.find((s) => s.harm >= 0.2).active).name.split(' (')[0].toLowerCase();
  if (d > 0.1) return 'dehydration';
  const worst = [...p.conds].sort((a, b) => (b.sev ?? b.s ?? 0) - (a.sev ?? a.s ?? 0))[0];
  return worst ? COND.get(worst.id).name.toLowerCase() : 'unknown';
}

export const MODEL_NAMES = Object.keys(MODELS);
