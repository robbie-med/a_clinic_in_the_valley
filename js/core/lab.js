// lab.js — doing a test: the sample, the method's own error, and the reader's eye. Pure. The truth comes from signs.js
// (bloodPicture); each method sees it through its known imprecision, and microscopy also through the skill of whoever
// reads the slide (you: your `lab` skill; a hired assistant: their own, which grows with every slide, faster when you
// check their work). A slide keeps what it holds (the counts drawn once from the sample), so reading the same slide
// again shows a second reader's error on the same cells: that is quality control.
import { LAB_TEST } from './content/lab.js';
import { bloodPicture } from './signs.js';
import { makeRng } from './rng.js';
import { msg, raw, t, tm } from './i18n.js';
import { level } from './crafting.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const gauss = (rng) => Math.sqrt(-2 * Math.log(Math.max(1e-9, rng()))) * Math.cos(2 * Math.PI * rng());
/** A Poisson draw (Knuth for small means, normal above). */
function poisson(mu, rng) {
  if (mu <= 0) return 0;
  if (mu > 40) return Math.max(0, Math.round(mu + Math.sqrt(mu) * gauss(rng)));
  let k = 0, p = 1; const L = Math.exp(-mu);
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
const binom = (n, pr, rng) => (n * pr > 30 ? clamp(Math.round(n * pr + Math.sqrt(n * pr * (1 - pr)) * gauss(rng)), 0, n) : Array.from({ length: n }).reduce((a) => a + (rng() < pr ? 1 : 0), 0));
const fmt = (v, d = 1) => raw(v.toFixed(d));

/** A reader's skill 0..1: you from your lab skill level, an assistant from their own record (staff.js). */
export const playerSkill = (P) => clamp(0.25 + 0.08 * level(P.skills?.lab), 0, 0.95);

/**
 * Take the sample: what is on the slide or in the tube, drawn once (the counts a reader will see). t: when.
 * Returns a sample record { test, pid, t, truth?, counts, q (slide clarity) }.
 */
export function takeSample(p, testId, t, slideQ = 1) {
  const T = LAB_TEST.get(testId), B = bloodPicture(p, t), rng = makeRng(p.seed, 'sample', testId, Math.floor(t));
  const s = { test: testId, pid: p.id, t, q: slideQ };
  switch (T.method) {
    case 'thick': {
      // ~0.25 µL of blood under the 100 fields a reader scans at ×1000 (WHO Basic malaria microscopy 2010: 100 fields ≈
      // 0.25 µL); the parasites there are Poisson
      s.counts = { para: poisson(B.para * 0.25, rng) };
      break;
    }
    case 'thin': {
      // 100 white cells in the order the film shows them; red cell picture
      const d = B.diff, n = 100, pick = (pr, left) => binom(left, clamp(pr, 0, 1), rng);
      const nN = pick(d.n / 100, n), nE = pick(d.e / (100 - d.n || 1), n - nN), nM = pick(d.m / (100 - d.n - d.e || 1), n - nN - nE);
      s.counts = { n: nN, e: nE, m: nM, l: n - nN - nE - nM, morph: B.morph, ring: B.para > 50 };
      break;
    }
    case 'chamber': {
      // four corner squares hold 0.4 µL of blood diluted 1:20: ~WBC(/µL)×0.02 cells, Poisson, plus pipetting (Thoma
      // pipette ~5%) and chamber filling (~4%) (Berkson J et al. Am J Physiol 1940;128:309; the volume errors are estimates)
      const mu = B.wbc * 1000 * 0.02 * Math.exp(0.05 * gauss(rng) + 0.04 * gauss(rng));
      s.counts = { cells: poisson(mu, rng) };
      break;
    }
    case 'retic': s.counts = { retic: binom(1000, clamp(B.retic / 100, 0, 1), rng) }; break;
    case 'sickle': s.counts = { sickle: B.sickle }; break;
    case 'katokatz': {
      // 41.7 mg of stool; eggs are clumped from day to day (negative binomial, k ~0.5; estimate)
      const day = (mu) => mu * (-Math.log(Math.max(1e-9, rng())) * 0.5 + -Math.log(Math.max(1e-9, rng())) * 0.5);
      s.counts = { hookworm: poisson(day(B.epg.hookworm * 0.0417), rng), ascaris: poisson(day(B.epg.ascaris * 0.0417), rng) };
      break;
    }
    default: s.truth = { hb: B.hb, wbc: B.wbc, mcv: B.mcv, diff: B.diff };
  }
  return s;
}

/**
 * Read a sample: the result as findings for the encounter ({ key: { v, m, pos, n } }, signs.js shape). reader: skill
 * 0..1. who: a key that makes each reading its own (a second reader of the same slide errs differently).
 */
export function readSample(p, s, reader, who = 'you') {
  const T = LAB_TEST.get(s.test), rng = makeRng(p.seed, 'read', s.test, Math.floor(s.t), who);
  const sk = clamp(reader * (0.6 + 0.4 * (s.q ?? 1)), 0, 1); // a cloudy slide hides what a good one shows
  const F = {};
  const set = (k, m, pos, n) => { F[k] = { v: tm(m), m, pos: !!pos, n }; };
  const B = s.truth || bloodPicture(p, s.t);
  switch (T.method) {
    case 'scale': {
      // the WHO colour scale: ten shades (3–10, 12, 14 g/dL; Stott GJ, Lewis SM. Bull World Health Organ 1995;73:369);
      // eyes match within about a shade (the spread is an estimate)
      const LEVELS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14], seen = B.hb + gauss(rng) * (0.8 + 0.5 * (1 - reader));
      const v = LEVELS.reduce((a, l) => (Math.abs(l - seen) < Math.abs(a - seen) ? l : a), LEVELS[0]);
      set('lab_hb', msg('Haemoglobin about {v} g/dL (colour scale).', { v }), v <= 10, v);
      break;
    }
    case 'sahli': {
      // visual matching in acid haematin: reads low and wide, SD ~1–1.5 g/dL (Whitehead RD et al. Ann N Y Acad Sci 2019;
      // 1450:147); an unpractised eye wider still (estimate)
      const v = Math.max(2, B.hb - 0.4 + gauss(rng) * (1.0 + 0.6 * (1 - reader)));
      set('lab_hb', msg('Haemoglobin {v} g/dL (Sahli).', { v: fmt(v) }), v < 11, v);
      break;
    }
    case 'meter': {
      const v = Math.max(2, B.hb + gauss(rng) * 0.6); // capillary blood in a meter, SD ~0.5–0.8 (Whitehead 2019)
      set('lab_hb', msg('Haemoglobin {v} g/dL (meter).', { v: fmt(v) }), v < 11, v);
      break;
    }
    case 'thick': {
      // Seeing a parasite: each one on the slide is found with a chance that rises with skill; a novice misses thin
      // infections, an expert finds ~50/µL (WHO microscopy QA manual 2016: competence levels). False positives (stain
      // debris, platelets) fall with skill. Density = parasites per 200 white cells × 8000/µL, the WHO convention.
      const c = s.counts, find = clamp(0.35 + 0.6 * sk, 0, 0.97);
      const seen = binom(c.para, find, rng), fake = rng() < 0.08 * (1 - sk) + 0.005 ? 1 + Math.floor(rng() * 2) : 0;
      const n = seen + fake;
      if (!n) set('lab_para', msg('No malaria parasites seen in 100 fields.'), false, 0);
      else {
        // counted against the white cells (×8000/µL, the WHO convention), which comes to about what was in the 0.25 µL
        const dens = Math.round((n / 0.25) * Math.exp(0.15 * gauss(rng)) / 10) * 10;
        set('lab_para', msg('Malaria parasites (ring forms): about {n} per µL.', { n: Math.max(10, dens) }), true, dens);
      }
      break;
    }
    case 'thin': {
      const c = s.counts, miss = (p0) => rng() < p0 * (1 - sk);
      const seen = c.morph.filter((m) => !miss(m === 'sickle' || m === 'ring_forms' ? 0.2 : 0.5));
      if (c.ring && !seen.includes('ring_forms') && !miss(0.6)) seen.push('ring_forms');
      const words = { microcytic: msg('small pale red cells'), macrocytic: msg('large red cells'), sickle: msg('sickle-shaped cells'), target: msg('target cells'), polychromasia: msg('many young (bluish) red cells'), hyperseg: msg('neutrophils with too many lobes'), ring_forms: msg('malaria ring forms') };
      set('lab_morph', seen.length ? msg('Red cells: {list}.', { list: seen.map((m) => words[m]).reduce((a, x) => (a ? msg('{a}, {b}', { a, b: x }) : x), null) }) : msg('Red cells look normal.'), seen.length > 0);
      // a 100-cell differential: binomial counting error (the reader's own slips besides, ±a few cells)
      const slip = () => Math.round(gauss(rng) * 2 * (1 - sk));
      const e = clamp(c.e + slip(), 0, 100), nn = clamp(c.n + slip(), 0, 100), l = clamp(100 - nn - e - c.m, 0, 100);
      set('lab_diff', msg('White cells: neutrophils {n}%, lymphocytes {l}%, eosinophils {e}%, monocytes {m}%.', { n: nn, l, e, m: c.m }), e > 6 || nn > 75 || nn < 35, e);
      break;
    }
    case 'chamber': {
      const v = s.counts.cells / 0.02 / 1000 * Math.exp(gauss(rng) * 0.05 * (1 - sk)); // ×10⁹/L
      set('lab_wbc', msg('White cells {v} ×10⁹/L.', { v: fmt(v) }), v > 11 || v < 4, v);
      break;
    }
    case 'retic': {
      const v = (s.counts.retic / 10) * Math.exp(gauss(rng) * 0.1 * (1 - sk));
      set('lab_retic', msg('Reticulocytes {v}%.', { v: fmt(v) }), v > 2.5, v);
      break;
    }
    case 'sickle': {
      // positive with trait or disease, which it cannot tell apart; a sealed drop that leaks air reads falsely negative
      // (estimates: sensitivity ~95%, false positives ~2%)
      const pos = s.counts.sickle ? rng() < 0.95 : rng() < 0.02;
      set('lab_sickle', pos ? msg('Sickling test positive: sickle haemoglobin present (trait or disease).') : msg('Sickling test negative.'), pos, pos ? 1 : 0);
      break;
    }
    case 'katokatz': {
      // eggs on the slide are seen with skill; hookworm eggs clear in the glycerol within an hour or two and are missed
      // more (Nikolay B et al. Int J Parasitol 2014;44:765)
      const c = s.counts, hw = binom(c.hookworm, clamp(0.6 + 0.35 * sk, 0, 0.97), rng), as = binom(c.ascaris, clamp(0.75 + 0.2 * sk, 0, 0.98), rng);
      const parts = [];
      if (hw) parts.push(msg('hookworm eggs, {n} per gram', { n: hw * 24 }));
      if (as) parts.push(msg('roundworm eggs, {n} per gram', { n: as * 24 }));
      set('lab_eggs', parts.length ? msg('Stool: {list}.', { list: parts.reduce((a, x) => (a ? msg('{a}, {b}', { a, b: x }) : x), null) }) : msg('Stool: no worm eggs seen.'), parts.length > 0, hw * 24);
      break;
    }
    case 'counter': {
      // 3-part counter: Hb CV ~1.5%, WBC ~3%, MCV ~1% (estimates from manufacturers' precision)
      const hb = B.hb * (1 + 0.015 * gauss(rng)), wbc = B.wbc * (1 + 0.03 * gauss(rng)), mcv = B.mcv * (1 + 0.01 * gauss(rng));
      const gran = clamp(B.diff.n + B.diff.e + gauss(rng) * 2, 0, 100), lym = clamp(B.diff.l + gauss(rng) * 2, 0, 100);
      set('lab_hb', msg('Haemoglobin {v} g/dL (counter).', { v: fmt(hb) }), hb < 11, hb);
      set('lab_wbc', msg('White cells {v} ×10⁹/L.', { v: fmt(wbc) }), wbc > 11 || wbc < 4, wbc);
      set('lab_mcv', msg('Red cell size (MCV) {v} fL.', { v: fmt(mcv, 0) }), mcv < 78 || mcv > 100, mcv);
      set('lab_diff3', msg('Granulocytes {g}%, lymphocytes {l}%.', { g: Math.round(gran), l: Math.round(lym) }), gran > 75, gran);
      break;
    }
  }
  return F;
}

/** Can this test be done here and now? null, or why not (as text). G: the game; T: the test. */
export function labBlocker(G, T, stockOf, tools) {
  for (const id of T.needs) if (!tools.has(id)) return t('You need a {tool}.', { tool: G.C.items.get(id).name });
  if (T.bench && !G.stations.has('lab')) return t('Needs a laboratory bench within reach.');
  if (T.station && !G.stations.has(T.station)) return t('Needs a blood counter within reach.');
  for (const [id, n] of T.uses) if (stockOf(G, id) < n) return t('You need {item}.', { item: G.C.items.get(id).name });
  return null;
}
