// disease.js — illness in the body, hour by hour. Every patient (in the clinic or at home) is stepped
// by simulate(): their medicines are taken (or not), drugs act through pk.js, each condition's model
// moves on, water is lost and replaced, and death is rolled against the hour's hazard.
//
// Models (conditions.js `model`): viral, bacterial, malaria, wound, burn, scabies, worms, pain, heart,
// pregnancy, preeclampsia, labour, bleeding, fits, mycobacterial, tetanus, hiv. State lives on the condition record so
// it saves as plain JSON.
// Time: hour- and day-scale physiology runs in real hours; anything taking months (a pregnancy, pre-eclampsia
// worsening over its weeks) runs COMPRESS times faster (time.js).
import { COND } from './content/conditions.js';
import { ACTIVE, ACTIVES } from './content/actives.js';
import { ORG } from './content/organisms.js';
import { drugState, toxSigns, gutExposure, hill } from './pk.js';
import { makeRng, hashf } from './rng.js';
import { COMPRESS } from './time.js';
import { pregnancyHour, newbornHazard } from './people.js';
import { YEAR_DAYS } from './time.js';
import { msg, en } from './i18n.js';

const withEn = (m, text) => ({ ...m, en: text }); // a msg with its exact English (patient.js say())

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
  const hiv = p.conds?.find((c) => c.cd4 !== undefined); // HIV: defence falls with the CD4 count (WTND p.399)
  if (hiv) d *= lerp(0.45, 1, clamp(hiv.cd4 / 500, 0, 1));
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
      c.s = clamp(s, 0, 1) * c.sev * cutOf(P, x);
      let loss = 0;
      if (P.stool) loss += stoolLoss(p, P.stool, c.s, x);
      if (P.vomit && c.age < 48) loss += (5 / 1000 / 24) * p.weight * c.s * P.vomit;
      // measles kills the young and the thin; vitamin A cuts deaths ~60% under 2 (Huiming Y et al. Cochrane 2005;CD001479).
      // The 0.8 is calibrated: given on arrival, partway into the illness, it must land near that 60%.
      const vuln = (P.vuln ? P.vuln[ageBand(p.age)] : p.age < 2 ? 2.5 : p.age < 5 ? 1.5 : 0.6) / hostDefence(p) ** 2;
      const hazard = (P.hazard || 0) * c.s ** 2 * vuln * (1 - 0.8 * (P.measles ? x.ds.relief.vita || 0 : 0));
      return { loss, hazard, done: c.age >= c.D };
    },
  },
  bacterial: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.L = lerp(P.L0[0], P.L0[1], rng());
      c.age = since;
      c.sev = lerp(0.7, 1.2, rng());
    },
    step(p, c, dt0, x) {
      const P = COND.get(c.id).params;
      const dt = dt0 * (P.pace || 1); // a slow infection (months) runs on the game calendar, its treatment with it
      c.age += dt;
      const imm = P.imm * hostDefence(p) * Math.min(1, (c.age / P.onset) ** 2);
      const hosp = x.hosp ? 0.25 : 0; // antibiotic at the health centre: ~0.25 log10/h kill
      const ab = abx(c, x, dt, c.L);
      c.L = Math.min(P.Lmax, c.L + dt * (P.r * (1 - c.L / P.Lmax) * (1 - ab.inhib) - imm - hosp - ab.kill));
      c.s = clamp((c.L - P.Lsym) / (P.Lmax - P.Lsym), 0, 1) * c.sev;
      if (P.sequel && ab.kill > 0.05) c.abxH = (c.abxH || 0) + dt;
      // the infection climbs to the next organ (bladder -> kidney, middle ear -> mastoid), carrying its strain
      if (P.ascend && !c.ascended && c.s > P.ascend.minS && (!P.ascend.sex || p.sex === P.ascend.sex) && x.rng() < P.ascend.perH * dt) { c.ascended = true; (p.pending ||= []).push({ id: P.ascend.to, t: x.t, org: c.org, mic: { ...c.mic } }); }
      let loss = 0;
      if (P.stool) loss += stoolLoss(p, P.stool, c.s * 1.4, x);
      const vuln = p.age < 5 ? 1.6 : p.age >= 65 ? 1.6 : 0.5;
      // cured, but an untreated partner (or household) passes the same strain back (WTND pp.237, 220)
      const R = P.reinfect;
      if (c.L < 1 && R && !x.instr.has(R.instr) && makeRng(p.seed, 'reinfect', c.id, Math.floor(x.t))() < R.odds * Object.entries(R.cut || {}).reduce((k, [i, by]) => k * (x.instr.has(i) ? 1 - by : 1), 1)) (p.pending ||= []).push({ id: c.id, t: x.t + lerp(R.days[0], R.days[1], x.rng()) * 24 * HOUR, org: c.org, mic: { ...c.mic } });
      return { loss, hazard: P.hazard * c.s ** 3 * vuln / hostDefence(p) * (P.pace || 1), done: c.L < 1 };
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
      selectParasite(c, x, dt);
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
      const ab = abx(c, x, dt, c.I + 1);
      c.I = clamp(c.I + dt * (growth * (1 - ab.inhib) - imm - hosp - ab.kill) - (top.wound?.infect || 0) - (x.instr.has('hot_compress') ? dt * 0.012 : 0), 0, 9);
      const rate = (1 / (P.days * 24 + c.size * 12)) * (1 + (top.wound?.healBonus || 0)) * (c.I > 3 ? 0.15 : c.I > 2 ? 0.6 : 1);
      c.heal = clamp(c.heal + dt * rate, 0, 1);
      c.s = clamp(c.I / 7, 0, 1);
      // dirt in the first days lets tetanus spores grow in someone never vaccinated (WTND pp.182, 89); own hashed draw
      if (P.tetanus && !c.tet && c.age < 96 && !tetanusVaccinated(p) && hashf(p.seed, Math.floor(c.age), 7, 4093) < P.tetanus * c.dirt * dt) { c.tet = true; (p.pending ||= []).push({ id: 'tetanus', t: x.t }); }
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
      const ab = abx(c, x, dt, c.I + 1);
      c.I = clamp(c.I + dt * (0.03 * (0.3 + c.dirt) * (1 - c.I / 9) * (1 - ab.inhib) - 0.02 * hostDefence(p) - (x.hosp ? 0.3 : 0) - ab.kill) - (top.burn?.infect || 0) - (top.wound?.infect || 0), 0, 9);
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
      const kill = x.topical[P.on || 'scabies']?.killFrac || 0; // fraction killed by this hour's applications
      if (c.M > 0) {
        const before = c.M;
        c.M = c.M * Math.exp(P.growth * dt) * (1 - kill);
        if (c.M < 1 && x.rng() < 1 - c.M) c.M = 0;
        if (c.M === 0 && before > 0) c.resid = 1;              // the itch outlives the mites (~2 weeks)
      }
      if (!x.instr.has('treat_family') && x.rng() < (P.spread ?? 0.0015) * dt) c.M += 1; // the family passes it back
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
      if (P.bloodLoss) c.hb = Math.max(3, p.hb - wormBloodDrop(p, P, c.W, 0)); // months of it already
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
      if (P.bloodLoss) {
        // blood creeps toward what the worms allow; the marrow rebuilds ~0.04 g/dL a day, 3× that with iron
        const iron = x.ds.relief.iron || 0;
        const target = p.hb - wormBloodDrop(p, P, c.W, iron), step = ((0.04 + 0.08 * iron) * dt) / 24;
        c.hb += clamp(target - c.hb, -step, step);
        c.s = Math.max(c.s, clamp((p.hb - c.hb) / 5, 0, 1));
        return { loss: 0, hazard: c.hb < 5 ? 0.0006 * (5 - c.hb) ** 2 : 0, done: c.W === 0 && c.hb > p.hb - 0.5 };
      }
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
      c.s = c.p0 * 0.5 ** (c.age / (P.halfDays * 24)) * (x.instr.has(P.instr || 'rest_move') ? P.instrCut ?? 0.85 : 1);
      // `hazard` (a stroke): deaths cluster in the first days (`early`, hours), then the damage only slowly mends
      return { loss: 0, hazard: (P.hazard || 0) * c.s ** 2 * (P.early ? Math.exp(-c.age / P.early) : 1), done: c.s < 0.08 };
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
      if (x.hosp) { c.delivered = true; p.induce ||= x.t; return { loss: 0, hazard: 0, done: true }; } // the hospital delivers her
      c.sev = clamp(c.sev + dt * P.rise * COMPRESS / 24 * (0.6 + x.rng()), 0, 1.2); // worsens over weeks of pregnancy
      c.s = c.sev;
      // once severe, fits may begin (eclampsia); magnesium sulfate more than halves that (RR 0.42, Magpie Trial
      // Collaborative Group. Lancet 2002;359:1877)
      if (P.fits && !c.fitted && c.sev > P.fits.at && x.rng() < P.fits.perH * dt * (1 - 0.6 * (x.ds.relief.fits || 0))) { c.fitted = true; (p.pending ||= []).push({ id: 'eclampsia', t: x.t }); }
      return { loss: 0, hazard: c.sev > 0.7 ? P.hazard * (c.sev - 0.6) * 4 : 0, done: !p.pregnant };
    },
  },
  // ——— chronic illness and emergencies (WTND chapters 10, 11, 13, 22)
  // chronic: one level (pressure above normal, sugar, a goitre's size, an ulcer, missing haemoglobin, missing
  // nourishment) that settles toward a target over `tau` days. Medicines (`by`: relief keys, or one per patient with
  // `need`), an instruction and the body itself (`self`) lower the target; `worse` (a relief key) raises it.
  // Complications (`risk`) arise at perYear per game year, × `per` for each `step` of level. Slow processes are
  // compressed into game days in the condition data (time.js COMPRESS).
  chronic: {
    init(p, c, rng) {
      const P = COND.get(c.id).params;
      c.L = c.L0 = P.hbTo ? p.hb - lerp(P.hbTo[0], P.hbTo[1], rng()) : lerp(P.level[0], P.level[1], rng()); // hbTo: the Hb they walk in with
      if (Array.isArray(P.self)) c.self = lerp(P.self[0], P.self[1], rng());
      if (P.need) c.by = rng() < P.need ? P.by[0] : P.by[1];
      if (P.nut) setNutrition(p, P.nut - c.L);
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params, R = x.ds.relief;
      c.age += dt;
      let keep = 1 - (c.self ?? P.self ?? 0);
      for (const k of c.by ? [c.by] : P.by || []) keep *= 1 - (R[k] || 0);
      if (P.instr && x.instr.has(P.instr)) keep *= 1 - P.instrCut;
      c.L += (c.L0 * keep * (1 + (R[P.worse] || 0)) - c.L) * Math.min(1, dt / (P.tau * 24));
      c.s = clamp(c.L / P.full, 0, 1.5);
      if (P.hb) c.hb = p.hb - c.L;
      if (P.nut) setNutrition(p, P.nut - c.L);
      for (const r of P.risk || []) {
        if (p.conds.some((q) => q.id === r.to) || p.pending?.some((q) => q.id === r.to)) continue;
        if (x.rng() < (r.perYear * r.per ** (c.L / r.step) * dt) / (YEAR_DAYS * 24)) (p.pending ||= []).push({ id: r.to, t: x.t });
      }
      const hazard = P.hb ? (c.hb < 5 ? P.hazard * (5 - c.hb) ** 2 : 0) : (P.hazard || 0) * Math.max(0, c.L - (P.safe || 0)) ** 2;
      return { loss: 0, hazard, done: P.heal !== undefined && c.L < P.heal };
    },
  },
  // asthma: attacks narrow the airways (att) for hours to days, then ease to the inflamed baseline. A bronchodilator
  // (relief.airway) opens them while it is in the blood; a steroid (relief.steroid, building over ~6 h) shortens the
  // attack and makes new ones rarer. Colds bring attacks on (WTND p.167). Death comes only from the narrowest airways.
  asthma: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.base = lerp(P.base[0], P.base[1], rng());
      c.peak = lerp(P.attack[0], P.attack[1], rng());
      c.left = lerp(P.hours[0], P.hours[1], rng()) + since; // the attack they came with is still on
      c.att = 0; c.st = 0;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params, R = x.ds.relief;
      c.age += dt;
      c.st += ((R.steroid || 0) - c.st) * Math.min(1, dt / 6);
      c.left -= dt * (1 + P.steroidFaster * c.st);
      const cold = p.conds.some((q) => q.id === 'common_cold' || q.id === 'cough_child') ? 3 : 1;
      if (c.left <= 0 && x.rng() < (P.perWeek / 168) * dt * (c.base / 0.3) * cold * (1 - P.steroidFewer * c.st) * (x.instr.has('no_smoke') ? 1 - P.smoke : 1)) {
        c.peak = lerp(P.attack[0], P.attack[1], x.rng()); c.left = lerp(P.hours[0], P.hours[1], x.rng());
      }
      c.att += ((c.left > 0 ? c.peak : c.base) - c.att) * Math.min(1, dt / 2);
      c.s = c.att * (1 - (R.airway || 0)); // how narrow the airways are now
      return { loss: 0, hazard: P.hazard * Math.max(0, c.s - 0.6) ** 2, done: false };
    },
  },
  // fits: seizures come at `perDay` (a fever fit only while its fever lasts, `days`); `relief.seizure` prevents them,
  // scaled by how well this brain responds (resp). Now and then one does not stop (status, `status`): it ends by itself
  // at `stop` an hour, or with a drug in the blood, and kills at `hazard` an hour while it lasts. A fall in a fit can
  // land in the cooking fire (`injure`). The fit that brought them came `since` hours ago; some still fit on arrival.
  fits: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.rate = lerp(P.perDay[0], P.perDay[1], rng() ** 2);
      c.resp = lerp(0.6, 1.6, rng());
      if (P.days) c.D = lerp(P.days[0], P.days[1], rng()) * 24 + since;
      c.pre = rng() * since * 0.8; c.hold = since; c.arrive = rng() < (P.arrive || 0);
      c.n = 0; c.status = 0; c.ago = 1e6;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      const R = clamp((x.ds.relief.seizure || 0) * c.resp, 0, 0.98);
      c.age += dt; c.ago += dt;
      const fade = c.D ? clamp(1 - c.age / c.D, 0, 1) : 1;
      let hazard = 0;
      if (c.pre !== undefined && c.age >= c.pre) { delete c.pre; c.n++; c.ago = 0; if (c.arrive) c.status = 1; }
      else if (c.status) {
        hazard = P.hazard;
        if (c.age > c.hold && x.rng() < P.stop + (1 - P.stop) * R) c.status = 0;
      } else if (x.rng() < (c.rate * fade * (1 - R) * dt) / 24) {
        c.n++; c.ago = 0;
        if (x.rng() < P.status) { c.status = 1; c.hold = 0; }
        if (P.injure && x.rng() < P.injure.per) (p.pending ||= []).push({ id: P.injure.to, t: x.t });
      }
      c.s = c.status ? 1 : Math.max(c.D ? fade : 0.15, 0.15 + 0.6 * Math.exp(-c.ago / 12));
      return { loss: 0, hazard, done: !!c.D && c.age >= c.D && !c.status };
    },
  },
  // venom: a bite, sting or swallowed poison leaves a depot (D) that seeps into the body at `absorb` an hour (slower
  // with the limb splinted, `slow`); in the body (V) it wears off with half-life `half`. Venom per kg: a child takes
  // the same bite into a smaller body. Antivenom (`bind`, an active) neutralises venom by its level against the venom
  // left (ratio50). Some bites carry no venom (`dry`). Harm grows with V / v1.
  venom: {
    init(p, c, rng) {
      const P = COND.get(c.id).params;
      c.D = rng() < (P.dry || 0) ? 0 : (lerp(P.dose[0], P.dose[1], rng()) * 60) / p.weight;
      c.D0 = c.D; c.V = 0;
      if (P.neuro) c.neuro = rng() < P.neuro;
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params, av = x.ds.conc[P.bind] || 0;
      c.age += dt;
      const abs = c.D * (1 - Math.exp(-P.absorb * dt)) * (P.slow && x.instr.has(P.slow) ? 0.5 : 1);
      c.D -= abs; c.V = (c.V + abs) * Math.exp((-Math.LN2 / P.half) * dt);
      if (av > 0 && c.V > 0.001) c.V *= 1 - 0.9 * hill(av / c.V, P.ratio50, 2);
      c.s = clamp(c.V / P.v1, 0, 1.5);
      return { loss: 0, hazard: P.hazard * Math.max(0, c.s - 0.3) ** 2, done: c.age > 12 && c.D < 0.02 && c.s < 0.03 };
    },
  },

  // ——— childbirth and the newborn (WTND chapter 19)
  /** Obstructed labour: the baby does not come down. Each hour the baby may die; after a day the womb may tear. It
   *  ends when the head finally comes (resolve, often dead) or the hospital operates; either way she may then get
   *  childbirth fever (`after`). While it lasts it holds the birth back (`blocksBirth`, people.js). */
  labour: {
    init(p, c) { c.age = 0; p.labour ??= p.t; },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const end = (cs) => {
        p.induce ||= x.t;
        if (x.rng() < P.after.odds * (cs ? 0.5 : 1)) (p.pending ||= []).push({ id: P.after.id, t: x.t + 48 * HOUR });
        return { loss: 0, hazard: 0, done: true };
      };
      if (x.hosp) return end(true); // caesarean
      c.s = clamp(c.age / 36, 0.2, 1);
      if (p.foetus?.alive && x.rng() < P.foetal * c.s * dt) p.foetus.alive = false;
      if (x.rng() < P.resolve * dt) return end(false);
      return { loss: (P.loss * p.weight) / 1000, hazard: c.age > 24 ? P.hazard * c.s : 0, done: false };
    },
  },
  /** Bleeding (after birth, a miscarriage, a burst tubal pregnancy): c.rate ml/h, slowing as the womb clamps down
   *  (half-life `half` h). Uterotonics (relief.uterus: oxytocin, misoprostol, ergometrine) cut the flow and speed the
   *  clamping. Blood lost as a share of ~80 ml/kg decides shock, Hb and death; anaemic women die of less (WTND
   *  p.249). `rupture`: nothing bleeds until the tube bursts (per hour), unless it settles first (`resolve`).
   *  The hospital transfuses and empties the womb or removes the tube. What is lost stays lost (p.hb). */
  bleeding: {
    init(p, c, rng) {
      const P = COND.get(c.id).params;
      c.rate = P.rate[0] * Math.exp(gauss(rng) * P.rate[1]);
      c.lost = 0; c.hb = p.hb; c.shock = 0; c.age = 0;
      c.atonic = rng() < (P.atony ?? 1); // a tear or a retained placenta bleeds whatever the womb does
      if (P.lose && p.pregnant) p.foetus = { alive: false, harm: p.foetus?.harm || {} };
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const end = (hazard = 0) => {
        p.hb = Math.min(p.hb, c.hb);
        if (P.endsPregnancy && p.pregnant) { p.pregnant = 0; delete p.foetus; }
        return { loss: 0, hazard, done: true };
      };
      if (x.hosp) { c.hb = Math.max(c.hb, 9); return end(); }
      if (P.rupture && !c.rup) {
        c.s = 0.3;
        if (x.rng() < P.resolve * dt) return end();
        if (x.rng() >= P.rupture * dt) return { loss: 0, hazard: 0, done: false };
        c.rup = x.t;
      }
      const ut = c.atonic ? (x.ds.relief.uterus || 0) * P.drug : 0;
      c.lost += c.rate * (1 - ut) * dt;
      c.rate *= Math.exp(-dt * (Math.LN2 / P.half + 2 * ut));
      const f = c.lost / (p.weight * 80);
      c.hb = p.hb * (1 - f);
      c.shock = clamp((f - 0.15) / 0.25, 0, 1);
      c.s = clamp(Math.max(c.rate / 300, c.shock), 0, 1);
      const hazard = f > P.shock ? P.hazard * ((f - P.shock) / 0.1) ** 2 * (11 / p.hb) : 0;
      return c.rate < 10 ? end(hazard) : { loss: 0, hazard, done: false };
    },
  },
  /** Fits: eclampsia (worsens while pregnant, `rise` per gestational day; fits bring on labour, `labour` per hour; it
   *  settles after the birth, half-life `half` h) or tetanus spasms (`course`: [peak, end] days). Each fit risks death
   *  (`perFit`) and, in pregnancy, the baby (`foetal`). Anticonvulsants (relief.fits: magnesium sulfate, diazepam) and
   *  the hospital's care (×0.2) stop fits. */
  spasm: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.sev = c.sev0 = lerp(P.sev[0], P.sev[1], rng()); c.n = 0; c.age = 0;
      if (!P.course) c.last = p.t - since * HOUR; // eclampsia shows itself with a fit
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      if (P.course) { const pk = P.course[0] * 24, D = P.course[1] * 24; c.sev = c.sev0 * (c.age < pk ? 0.5 + (0.5 * c.age) / pk : clamp(1 - (c.age - pk) / (D - pk), 0, 1)); }
      else if (p.pregnant) { c.sev = Math.min(1.2, c.sev + (dt * P.rise * COMPRESS) / 24); if (x.hosp || x.rng() < P.labour * dt) p.induce ||= x.t; }
      else c.sev *= 0.5 ** (dt / P.half);
      const rate = P.fits * c.sev * (1 - (x.ds.relief.fits || 0)) * (x.hosp ? P.hosp ?? 0.2 : 1) * dt;
      const k = Math.floor(rate) + (x.rng() < rate % 1 ? 1 : 0);
      c.n += k; if (k) { c.last = x.t; p.fits = (p.fits || 0) + k; }
      c.s = clamp(c.sev, 0, 1);
      if (k && p.foetus?.alive && x.rng() < 1 - (1 - P.foetal) ** k) p.foetus.alive = false;
      return { loss: 0, hazard: 1 - (1 - P.perFit) ** k, done: P.course ? c.age >= P.course[1] * 24 : !p.pregnant && c.sev < 0.05 };
    },
  },
  // ——— infections (WTND chapters 13–18, 21 and pp.399–403)
  // Tuberculosis and leprosy: months to years, so they run `pace` (time.js COMPRESS) times faster, and so does the drugs'
  // work on them: six months of daily treatment is ~20 game days of daily doses. Two populations (log10 bacilli):
  // A, dividing, which makes the illness and which every drug kills; D, slow and semi-dormant, which only the
  // sterilising drugs reach (`abx.dormant`) and which wakes back into A: stop early and it relapses. Bacilli resistant
  // to one drug are always there by chance (organisms.js `mut`); they are followed in R and take over when the drugs
  // given leave them alone (one drug, or one that still works).
  mycobacterial: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.A = lerp(P.A0[0], P.A0[1], rng());
      c.cap = c.A + 0.06;                       // the load this person's immunity holds it to
      c.D = c.A + Math.log10(P.sleep / P.wake);
      c.sev = lerp(0.7, 1.2, rng()); c.waste = 0; c.nerve = 0; c.age = since;
    },
    step(p, c, dt0, x) {
      const P = COND.get(c.id).params, o = ORG.get(c.org), dt = dt0 * P.pace;
      c.age += dt;
      const k = mycoKill(c, c.mic, x), hosp = x.hosp ? P.hosp : 0;  // the health centre starts the national regimen
      const room = Math.max(0, 1 - 10 ** (c.A - c.cap)), imm = P.imm * hostDefence(p);
      c.A = Math.max(-3, c.A + dt * (P.r * room * (1 - k.inhib) - imm - k.kill - hosp));
      c.D -= dt * (k.dkill + hosp * 0.2);
      const nA = 10 ** c.A, nD = 10 ** c.D, sleep = P.sleep * dt * nA, wake = P.wake * dt * nD;
      c.A = Math.log10(Math.max(1e-3, nA + wake - sleep)); c.D = Math.log10(Math.max(1e-3, nD + sleep - wake));
      if (c.A < 0) c.A = -3; if (c.D < 0) c.D = -3;  // fewer than one bacillus: gone
      for (const [d, mut] of Object.entries(o.mut)) {
        if (!(d in c.mic) || c.res?.[d]) continue;
        const km = mycoKill(c, { ...c.mic, [d]: c.mic[d] * o.fold[d] }, x);
        let R = (c.R?.[d] ?? c.A - mut) + dt * (P.r * room * (1 - km.inhib) - imm - km.kill - hosp);
        R = Math.max(R, c.A - mut);              // fresh mutants keep coming from the dividing wild type
        if (R > 3 && R > c.A) { c.mic[d] *= o.fold[d]; (c.res ||= {})[d] = x.t; c.A = Math.log10(10 ** c.A + 10 ** R); c.R = {}; break; }
        (c.R ||= {})[d] = R;
      }
      c.s = clamp((c.A - P.Asym) / (P.Amax - P.Asym), 0, 1) * c.sev;
      c.waste = clamp(c.waste + dt * P.waste * (c.s > 0.1 ? c.s : -0.5), 0, 0.3);
      if (P.nerve) p.flags.nerve = Math.max(p.flags.nerve || 0, c.nerve = clamp(c.nerve + dt * P.nerve * clamp(c.A - 3, 0, 8) / 8, 0, 1));
      return { loss: 0, hazard: P.hazard * c.s ** 2 * (1 + 3 * c.waste) / hostDefence(p) * P.pace, done: c.A < 0 && c.D < 0 };
    },
  },
  // Tetanus: germs (log10 L) grow in a dirty wound and make toxin (F, free); free toxin binds to nerves (B, bound), and
  // bound toxin makes the stiffness and spasms until new nerve endings grow (weeks). Antibiotics kill the germ, antitoxin
  // mops up free toxin only, diazepam eases spasms. Death comes in spasms, choking and exhaustion (Yen LM, Thwaites CL.
  // Lancet 2019;393:1657). Rates are estimates, the hazard calibrated to case fatality.
  tetanus: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.L = lerp(P.L0[0], P.L0[1], rng()); c.F = 0; c.B = 0; c.age = since;
      c.vir = lerp(0.4, 1.6, rng());
    },
    step(p, c, dt, x) {
      const P = COND.get(c.id).params;
      c.age += dt;
      const ab = abx(c, x, dt, c.L), anti = x.ds.relief.antitoxin || 0;
      // the wound heals over ~2 weeks and the germ loses its airless pocket
      c.L = Math.max(-1, c.L + dt * (P.r * (1 - c.L / P.Lmax) * (1 - ab.inhib) - P.imm * hostDefence(p) * Math.min(1, c.age / P.heal) - ab.kill - (x.hosp ? 0.2 : 0)));
      const made = c.L > 0 ? P.toxin * c.vir * 10 ** (c.L - P.Lmax) * dt : 0;
      c.F = Math.max(0, (c.F + made) * (1 - anti) - c.F * P.bind * dt);
      c.B = Math.max(0, c.B + c.F * P.bind * dt - c.B * dt / P.recover);
      c.s = clamp(c.B, 0, 1.5);
      const vuln = p.age < 0.2 ? 2.5 : p.age >= 60 ? 1.6 : 1;
      const care = (1 - 0.6 * (x.ds.relief.spasm || 0)) * (x.hosp ? 0.5 : 1);
      return { loss: 0, hazard: P.hazard * clamp(c.s - 0.2, 0, 1.3) ** 2 * vuln * care / hostDefence(p), done: c.L <= 0 && c.F < 0.005 && c.B < 0.05 };
    },
  },
  // HIV: years, on the game calendar (`pace`). The CD4 count falls; below ~350 AIDS sets in (weight loss, fever,
  // diarrhoea), every defence weakens (hostDefence) and TB comes easily. No cure; the book's antiretrovirals belong to
  // the HIV programme and are not modelled here.
  hiv: {
    init(p, c, rng, since) {
      const P = COND.get(c.id).params;
      c.cd4 = lerp(P.cd4[0], P.cd4[1], rng()); c.waste = 0; c.age = since;
    },
    step(p, c, dt0, x) {
      const P = COND.get(c.id).params, dt = dt0 * P.pace;
      c.age += dt;
      c.cd4 = Math.max(0, c.cd4 - P.decline * dt);
      c.s = clamp((350 - c.cd4) / 300, 0, 1);
      c.waste = clamp(c.waste + dt * P.waste * (c.s - 0.2), 0, 0.35);
      if (!c.tb && x.rng() < P.tb * c.s * dt) { c.tb = true; (p.pending ||= []).push({ id: 'tb', t: x.t }); }
      return { loss: stoolLoss(p, P.stool, c.s * 0.5, x), hazard: P.hazard * c.s ** 2 * dt, done: false };
    },
  },
};
/** Share of a condition's course left by what was done: `cut` [{ instr | relief, by }] (kangaroo care, sunlight). */
const cutOf = (P, x) => (P.cut || []).reduce((k, e) => k * (1 - e.by * (e.instr ? +x.instr.has(e.instr) : x.ds.relief[e.relief] || 0)), 1);
/** At the birth, a medicine she was given to take then (encounter.js `atBirth`) becomes a dose she takes now. */
function takeAtBirth(p, t) {
  for (const r of [...(p.rx || [])]) if (r.atBirth && !r.stopped) { r.stopped = t; p.rx.push({ ...r.atBirth, start: t, perDay: 1, days: 1, route: 'oral', counselled: true }); }
}

/** How far blood-sucking worms pull haemoglobin down (g/dL): blood lost a day against the body's blood and
 *  iron. Iron in the diet or as tablets lets the marrow keep up with much of it. */
function wormBloodDrop(p, P, W, iron) {
  return clamp(((W * P.bloodLoss * 30) / p.weight) * (1 - 0.6 * iron), 0, 8);
}

/** Nourishment changes body weight with it (patient.js: weight scales with 0.82–1 of the median as nutrition 0–1). */
function setNutrition(p, n) {
  p.weight = Math.round(p.weight * (lerp(0.82, 1, n) / lerp(0.82, 1, p.nutrition)) * 100) / 100;
  p.nutrition = n;
}

function stoolLoss(p, S, s, x) {
  const mlKg = S.mlKg[ageBand(p.age)];
  const relief = x.ds.relief.stool || 0, worse = x.ds.worse.stool || 0;
  return (mlKg * p.weight / 1000 / 24) * s * (1 - relief) * (1 + worse);
}
/**
 * What antibiotics are doing to this infection's strain this hour: { kill (log10/h), inhib (share of growth
 * stopped) }. Free drug over the strain's MIC drives both. While free drug sits inside the selection window
 * (above the MIC, below window × MIC) a large population (pop, log10) can throw up a resistant mutant that
 * takes over: the strain's MIC for that drug jumps by the organism's fold (Drlica K. J Antimicrob
 * Chemother 2003;52:11, the mutant selection window). The per-hour odds are an estimate.
 */
function abx(c, x, dt, pop) {
  const out = { kill: 0, inhib: 0 };
  if (!c.mic) return out;
  for (const [a, free] of siteLevels(c, x)) {
    const m = a.abxAs || a.id; // benzylpenicillin is judged by the strain's penicillin MIC
    if (!(m in c.mic)) continue;
    const r = free / c.mic[m];
    const f = hill(r, a.abx.ec50, a.abx.hill);
    out.kill = Math.max(out.kill, a.abx.kmax * f);
    out.inhib = Math.max(out.inhib, f);
    if (r > 1 && r < a.abx.window && pop > 5 && !c.res?.[m] && x.rng() < 0.0004 * dt * (pop - 5)) {
      c.mic[m] *= ORG.get(c.org).fold[m] || 16;
      (c.res ||= {})[m] = x.t;
    }
  }
  return out;
}
/**
 * Malaria: a large parasite biomass (>10^11, hyperparasitaemia) under a drug level that only partly suppresses it
 * can select a resistant parasite, as a lone partner drug or artemisinin alone does (White NJ. J Clin Invest
 * 2004;113:1084). The per-hour odds are an estimate. The strain's EC50 multiplier jumps by the organism's fold.
 */
function selectParasite(c, x, dt) {
  if (!c.mic || c.P < 11) return;
  for (const [id, C] of Object.entries(x.ds.conc)) {
    const e = ACTIVE.get(id).effects?.find((f) => f.prr);
    if (!e || !(id in c.mic) || C <= 0 || c.res?.[id]) continue;
    const f = hill(C, e.ec50 * c.mic[id], e.hill || 1);
    if (f > 0.1 && f < 0.9 && x.rng() < 0.0005 * dt * (c.P - 11)) { c.mic[id] *= ORG.get(c.org).fold[id] || 3; (c.res ||= {})[id] = x.t; }
  }
}
/** Free antibiotic reaching the infection now: [[active, mg/L]]. Blood level × fu; behind the blood–brain barrier
 *  (`csf` on the condition) only the CSF share of it (`pk.csf`, 0.1 if unknown); plus ointment put on the infected
 *  surface (`site`, e.g. the eye) this hour. */
function siteLevels(c, x) {
  const P = COND.get(c.id).params, out = [];
  for (const [id, C] of Object.entries(x.ds.conc)) { const a = ACTIVE.get(id); if (a.abx && C > 0) out.push([a, C * (a.pk.fu ?? 1) * (P.csf ? a.pk.csf ?? 0.1 : 1)]); }
  for (const [id, C] of Object.entries(x.topical[P.site]?.conc || {})) out.push([ACTIVE.get(id), C]);
  return out;
}
/** Kill of mycobacteria by every drug at its site against these MICs: dividing bacilli (kill, log10/h: the strongest
 *  drug), growth stopped (inhib), and the slow semi-dormant ones (dkill: summed, as each sterilising drug reaches its
 *  own share of them). */
function mycoKill(c, mic, x) {
  const out = { kill: 0, inhib: 0, dkill: 0 };
  for (const [a, free] of siteLevels(c, x)) {
    const m = a.abxAs || a.id;
    if (!(m in mic)) continue;
    const f = hill(free / mic[m], a.abx.ec50, a.abx.hill);
    out.kill = Math.max(out.kill, a.abx.kmax * f); out.inhib = Math.max(out.inhib, f); out.dkill += a.abx.kmax * f * (a.abx.dormant || 0);
  }
  return out;
}
/** Has this person had the tetanus injections? Decided once from the seed, by age and sex: DTP3 ~80% of children,
 *  most women of childbearing age through antenatal TT (and so their newborns), few men past childhood (no boosters).
 *  Estimates from WHO/UNICEF immunization coverage (WUENIC) and Uganda DHS 2016. */
export function tetanusVaccinated(p) {
  if ((p.vacc?.tetanus || 0) >= 2) return true; // two doses given here (encounter.js)
  if (p.flags.ttVax === undefined) p.flags.ttVax = hashf(p.seed, 0, 0, 9101) < (p.age < 0.2 ? 0.75 : p.age < 15 ? 0.8 : p.sex === 'f' && p.age < 50 ? 0.6 : 0.2);
  return p.flags.ttVax;
}
/** The strain an infection is caught from: each drug's MIC, resistant with the valley's odds. */
export function pickStrain(c, orgId, rng, resist) {
  const o = ORG.get(orgId);
  const R = resist?.[orgId] || o.resist0;
  c.org = orgId; c.mic = {};
  const res0 = {};
  for (const [d, m] of Object.entries(o.mic)) {
    const res = res0[d] = o.link?.[d] && o.link[d] in res0 ? res0[o.link[d]] : rng() < (R[d] ?? 0);
    c.mic[d] = m * (res ? o.fold[d] : 1) * (o.scatter === false ? 1 : 2 ** Math.round((rng() - 0.5) * 2)); // ± one doubling dilution
  }
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
export function addCondition(p, id, rng, sinceH = 24, resist = null) {
  const def = COND.get(id);
  const c = { id, t0: p.t - sinceH * HOUR, sinceH };
  MODELS[def.model].init(p, c, rng, sinceH);
  if (def.params.org) pickStrain(c, def.params.org, makeRng(p.seed, 'strain', id), resist);
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

/** Advance a patient from p.t to toT (game minutes). Returns events [{t, kind, text, msg}]: `text` is English, `msg` the
 *  same to render in any language (say()/tm()). */
export function simulate(p, toT, C) {
  const ev = [];
  if (p.dead) { p.t = toT; return ev; }
  const rng = makeRng(p.seed, 'sim', Math.floor(p.t));
  while (p.t + HOUR <= toT && !p.dead) {
    const t0 = p.t, t1 = p.t + HOUR;
    const topical = {};
    const wormKills = {};
    // advice kept this hour; each line counts how often (asked about on the next visit: signs.js followUp)
    const instr = new Set();
    for (const r of p.rx || []) {
      if (!r.instr || r.stopped || (r.until ?? Infinity) <= t0) continue;
      const kept = rng() < (p.adh ?? 0.8) + 0.15;
      r.seen = (r.seen || 0) + 1;
      if (kept) { r.kept = (r.kept || 0) + 1; instr.add(r.instr); }
    }
    let fluidIn = 0, naLoad = 0;
    // complications and late sequels set in motion earlier (rheumatic fever, a kidney infection, an abscess)
    for (const q of [...(p.pending || [])]) {
      if (q.t >= t1) continue;
      p.pending.splice(p.pending.indexOf(q), 1);
      if (q.roll) {
        const sq = COND.get(q.roll).params.sequel;
        if (makeRng(p.seed, 'sequel', q.roll)() < sq.odds * (1 - sq.protect * Math.min(1, q.abxH / sq.fullH))) p.pending.push({ id: sq.to, t: q.t + lerp(sq.days[0], sq.days[1], rng()) * 24 * HOUR });
        continue;
      }
      const c = addCondition(p, q.id, rng, 0);
      if (q.mic) { c.org = q.org; c.mic = { ...q.mic }; }
      ev.push({ t: q.t, kind: 'onset', id: q.id, text: `${en(COND.get(q.id), 'name')} began`, msg: msg('{cond} began', { cond: en(COND.get(q.id), 'name') }) });
    }
    for (const rx of p.rx || []) {
      for (const [td, k] of dosesDue(rx, t0, t1)) {
        if (rx.left <= 0) { if (!rx.ranOut) { rx.ranOut = true; ev.push({ t: td, kind: 'ranout', text: `ran out of ${rx.name}`, msg: msg('ran out of {item}', { item: rx.name }) }); } continue; }
        // an injection is given by your hand, so it is never missed
        if (rx.route !== 'inj' && makeRng(p.seed, 'dose', rx.item, rx.start, k)() > takeChance(p, rx, instr)) { rx.missed = (rx.missed || 0) + 1; continue; }
        const amt = Math.min(rx.amount, rx.left);
        rx.left -= amt; rx.taken = (rx.taken || 0) + 1;
        applyDose(p, rx, amt, td, topical, wormKills);
        if (k === 0) idiosyncrasy(p, rx, td);
        // allergy: hives within the hour; now and then the throat swells (anaphylaxis): ~1 in 100 allergic exposures
        // by mouth, far more often by injection (estimates; Jerschow E et al. J Allergy Clin Immunol 2014;134:1318).
        // Most stop a medicine they take at home.
        const al = Object.keys(rx.actives || {}).find((id) => reactsTo(p, id, rx.item, rx.start));
        if (al) {
          if (!p.toxSeen.allergy) {
            p.toxSeen.allergy = td;
            const drug = en(ACTIVE.get(al), 'name'), text = `an itchy raised rash and swollen lips (allergic to ${drug.toLowerCase()})`;
            ev.push({ t: td, kind: 'tox', text, msg: withEn(msg('an itchy raised rash and swollen lips (allergic to {drug})', { drug }), text), active: al });
          }
          p.allergicUntil = td + 48 * HOUR;
          if (makeRng(p.seed, 'ana', rx.item, rx.start, k)() < (rx.route === 'inj' ? 0.1 : 0.01)) { p.ana = td; p.anaTo = al; ev.push({ t: td, kind: 'tox', text: 'the throat swells, wheezing, faint and cold (anaphylaxis)', msg: msg('the throat swells, wheezing, faint and cold (anaphylaxis)'), active: al }); }
          if (rx.route !== 'inj' && rng() < 0.6) { rx.stopped = td; rx.stopWhy = 'rash'; ev.push({ t: td, kind: 'stopped', text: `stopped ${rx.name} (the rash)`, msg: msg('stopped {item} (the rash)', { item: rx.name }) }); }
        }
        if (rx.fluid) { fluidIn += amt / 1000; naLoad += (amt / 1000) * rx.fluid.na; }
      }
      // stop when better: the classic way a course is cut short
      // someone who watches every dose (a treatment supporter, as TB programmes use) makes stopping far rarer
      if (!rx.instr && !rx.stopped && p.feelBetter && !rx.fluid && rng() < (rx.counselled ? 0.0015 : 0.008) * (instr.has('supporter') ? 0.1 : 1)) {
        rx.stopped = t0; rx.stopWhy = 'better'; ev.push({ t: t0, kind: 'stopped', text: `stopped ${rx.name} (felt better)`, msg: msg('stopped {item} (felt better)', { item: rx.name }) });
      }
    }
    const ds = drugState(p, t1);
    for (const q of p.pending || []) if (q.roll && q.mic && covers(ds, q.mic)) q.abxH++;
    if (p.pregnant) {
      const pe = pregnancyHour(p, ds, t1); // the foetus (people.js)
      ev.push(...pe);
      if (pe.some((e) => e.kind === 'birth' || e.kind === 'stillbirth')) takeAtBirth(p, t1);
    }
    const x = { ds, rng, t: t1, hosp: p.hospital && t1 >= p.hospital.from && t1 < p.hospital.until, instr, topical, wormKills };
    // anaphylaxis kills within the first hour or two; adrenaline within ~30 minutes mostly prevents that
    // (untreated odds are an estimate; Turner PJ et al. J Allergy Clin Immunol Pract 2017;5:1169)
    let loss = 0, hazard = p.ana !== undefined && t0 - p.ana < 2 * HOUR ? 0.1 * (rescued(p, p.ana) ? 0.1 : 1) : 0;
    if (p.age < 0.2) hazard += newbornHazard(p, ds);
    for (const c of [...p.conds]) {
      const def = COND.get(c.id);
      const r = MODELS[def.model].step(p, c, 1, x);
      loss += r.loss; hazard += r.hazard;
      if (r.hazard > (p.killer?.h || 0) || p.killer?.t !== t1) p.killer = { id: c.id, h: r.hazard, t: t1 };
      if (r.done) {
        // a sequel is decided once its window closes; antibiotic hours keep counting until then (the 10-day course)
        if (def.params.sequel) (p.pending ||= []).push({ roll: c.id, t: Math.max(t1, c.t0 + def.params.sequel.within * HOUR), abxH: c.abxH || 0, org: c.org, mic: c.mic });
        p.conds.splice(p.conds.indexOf(c), 1);
        p.healed.push({ id: c.id, t: t1 });
        ev.push({ t: t1, kind: 'healed', id: c.id, text: `${en(def, 'name')} is gone`, msg: msg('{cond} is gone', { cond: en(def, 'name') }) });
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
    for (const r of p.react || []) if (t1 >= r.t && t1 < r.t + r.hours * HOUR) tox.push(r);
    dependence(p, ds, tox);
    for (const s of tox) {
      hazard += s.harm * 0.01;
      if (!p.toxSeen[s.sign]) { p.toxSeen[s.sign] = t1; ev.push({ t: t1, kind: 'tox', text: en(s, 'text'), msg: en(s, 'text'), active: s.active }); } // content text: tm() looks it up
    }
    if (ds.conc.quinine > 5 && (p.age < 5 || p.pregnant) && rng() < 0.004) { hazard += 0.01; p.toxSeen.lowsugar ||= t1; }
    p.lastTox = tox.map((s) => s.sign);
    // feeling better? (drives "stop when better")
    const burden = p.conds.reduce((a, c) => a + (c.s || 0), 0);
    p.burden0 ??= Math.max(0.2, burden);
    p.feelBetter = burden < p.burden0 * 0.35;
    if (rng() < hazard) {
      p.dead = true; p.diedAt = t1;
      p.causeMsg = causeOfDeath(p, tox, d); // shown: say(p.causeMsg ?? p.cause)
      p.cause = p.causeMsg.en; // English, a fixed phrase (tests and logic read it)
      ev.push({ t: t1, kind: 'died', text: `died (${p.cause})`, msg: withEn(msg('died ({cause})', { cause: p.causeMsg }), `died (${p.cause})`) });
    }
    p.t = t1;
  }
  if (!p.dead) p.t = Math.max(p.t, Math.min(toT, p.t));
  return ev;
}

/** Is some antibiotic in the blood above this strain's MIC? */
const covers = (ds, mic) => Object.entries(ds.conc).some(([id, C]) => { const a = ACTIVE.get(id), m = a.abxAs || id; return a.abx && m in mic && C * (a.pk.fu ?? 1) > mic[m]; });
/** Does this dose meet an allergic reaction? A true allergy (p.allergy), or a foreign protein that sets one off in anyone
 *  (`reacts`, share of courses: horse-serum antivenoms). The clinic (encounter.js) uses the same draw. */
export const reactsTo = (p, id, item, start) => { const a = ACTIVE.get(id); return (!!p.allergy && a.allergen === p.allergy) || (a.reacts > 0 && makeRng(p.seed, 'reacts', item, start)() < a.reacts); };
const rescued = (p, ta) => (p.doses.sys.adrenaline || []).some(([td]) => td >= ta - 10 && td <= ta + 30);
const DEPENDENT = ACTIVES.filter((a) => a.dependence);
/** Steady use of an opioid builds dependence over ~2 weeks (and tolerance, pk.js); it fades about half as fast once
 *  stopped. Stopping while dependent brings withdrawal: miserable, rarely dangerous in adults. */
function dependence(p, ds, tox) {
  for (const a of DEPENDENT) {
    const D = a.dependence, C = ds.conc[a.id] || 0;
    let v = p.dep?.[a.id] || 0;
    if (!v && C < D.ec) continue;
    v = clamp(v + (C >= D.ec ? 1 : -0.5) / (D.days * 24), 0, 1);
    (p.dep ||= {})[a.id] = v;
    if (v > 0.5 && C < D.ec * 0.3) tox.push({ active: a.id, sign: D.sign, text: en(D, 'text'), harm: D.harm || 0 });
  }
}
/** Rare reactions that do not depend on the dose (a blistering rash from a sulfa, Reye syndrome after aspirin in a
 *  child with a virus): rolled once per course, at the first dose, from `idio` on the active. */
function idiosyncrasy(p, rx, td) {
  for (const id of Object.keys(rx.actives || {})) for (const r of ACTIVE.get(id).idio || []) {
    if (r.ageMax && p.age >= r.ageMax) continue;
    if (r.withModel && !p.conds.some((c) => COND.get(c.id).model === r.withModel)) continue;
    const g = makeRng(p.seed, 'idio', id, rx.start);
    if (g() < r.per) (p.react ||= []).push({ active: id, sign: r.sign, text: en(r, 'text'), harm: r.harm, t: td + lerp(r.days[0], r.days[1], g()) * 24 * HOUR, hours: r.hours });
  }
}
function takeChance(p, rx, instr) {
  let a = p.adh ?? 0.8;
  if (rx.counselled) a += 0.1;
  if (instr?.has('supporter')) a += 0.1;
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
    if (a.channel === 'systemic') { (p.doses.sys[id] ||= []).push(rx.route === 'inj' ? [td, mg, rx.inj?.ka ?? 3, 1] : [td, mg]); trimDoses(p.doses.sys[id], td); }
    else if (a.channel === 'gut') {
      p.doses.gut.push([td, id, mg]);
      if (p.doses.gut.length > 60) p.doses.gut.splice(0, p.doses.gut.length - 60);
      for (const e of a.gut.effects) if (e.on.startsWith('worms_')) (wormKills[e.on] ||= []).push(e.per * gutExposure(mg, e.perMg));
    }
  }
  for (const [id, strength] of Object.entries(rx.topical || {})) {
    const a = ACTIVE.get(id);
    const k = strength * (rx.q ?? 1);
    for (const T of [a.topical, ...(a.topical.also || [])]) {
      const tgt = topical[T.on] ||= {};
      if (T.kill) tgt.killFrac = 1 - (1 - (tgt.killFrac || 0)) * (1 - Math.min(0.95, T.kill * k));
      if (T.infect) tgt.infect = (tgt.infect || 0) + T.infect * k * 0.3;
      if (T.heal) tgt.healBonus = Math.max(tgt.healBonus || 0, T.heal * k);
      if (T.relief) tgt.relief = Math.max(tgt.relief || 0, T.relief * k);
      if (T.conc) (tgt.conc ||= {})[id] = Math.max(tgt.conc?.[id] || 0, T.conc * k); // mg/L on the surface this hour
    }
    p.lastTopical = td;
  }
}
function trimDoses(list, t) { while (list.length > 2 && t - list[0][0] > 40 * 24 * HOUR) list.shift(); }

/** Why they died: a msg (looked up at display) with `en`, the English phrase kept in p.cause. */
function causeOfDeath(p, tox, d) {
  const said = (m, text) => ({ ...(typeof m === 'string' ? { $: m } : m), en: text });
  const condName = (id) => en(COND.get(id), 'name');
  if (p.ana !== undefined && p.t - p.ana < 2 * HOUR) {
    const a = ACTIVE.get(p.anaTo), drug = a ? en(a, 'name') : p.allergy;
    return said(msg('anaphylaxis (allergic to {drug})', { drug }), 'anaphylaxis (allergic to ' + (a ? drug.toLowerCase() : p.allergy) + ')');
  }
  if (tox.some((s) => s.harm >= 0.2)) {
    const drug = en(ACTIVE.get(tox.find((s) => s.harm >= 0.2).active), 'name');
    return said(msg('poisoned by {drug}', { drug }), 'poisoned by ' + drug.split(' (')[0].toLowerCase());
  }
  if (d > 0.1) return said(msg('dehydration'), 'dehydration');
  if (p.killer?.t === p.t + HOUR && p.killer.h > 0 && COND.has(p.killer.id)) return said(condName(p.killer.id), condName(p.killer.id).toLowerCase());
  const worst = [...p.conds].sort((a, b) => (b.sev ?? b.s ?? 0) - (a.sev ?? a.s ?? 0))[0];
  return worst ? said(condName(worst.id), condName(worst.id).toLowerCase()) : said(msg('unknown'), 'unknown');
}

export const MODEL_NAMES = Object.keys(MODELS);
