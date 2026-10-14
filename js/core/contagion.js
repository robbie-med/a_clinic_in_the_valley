// contagion.js — who is infectious now, who is protected, and what passes on your waiting bench. Pure. The daily
// spread through houses and hamlets is village.js; the germs themselves are content/contagion.js.
import { CONTAGIOUS } from './content/contagion.js';
import { DAY, HOUR, YEAR_DAYS } from './time.js';
import { hashf, strHash, STREAM } from './rng.js';
import { msg } from './i18n.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const IDX = new Map([...CONTAGIOUS.keys()].map((k, i) => [k, i]));

/** Is this illness passing on its germ at time t? 1 or 0 (by days since it began, its level, or parasites). */
export function infectious(c, t, row = CONTAGIOUS.get(c.id)) {
  if (!row) return 0;
  if (row.infPara) return (c.para || 0) >= row.infPara ? 1 : 0;
  if (row.infS != null) return (c.s ?? 0) >= row.infS ? 1 : 0;
  const days = (t - c.t0) / DAY;
  return days >= row.inf[0] && days <= row.inf[1] ? 1 : 0;
}

/**
 * Is this person protected against this germ on day d? imm: their saved immunity { condId: untilDay | -1 }. Immunity
 * from an earlier illness; a vaccine (measles at 9 months: who.age ≥ vacc.from, given to `cover` of children, taking in
 * `eff` of them); or, for the immunising childhood illnesses, having had it before the valley began (most by age
 * `past`·2: the older, the likelier). Each person's own hashed rolls, so the answer never changes.
 */
export function immune(seed, id, row, d, age, ageAtStart, imm) {
  const u = imm?.[row.id];
  if (u === -1 || (u != null && u > d)) return true;
  const k = IDX.get(row.id), ih = strHash(id);
  if (row.vacc && age >= row.vacc.from && hashf(seed, ih, k, STREAM.inf + 400) < row.vacc.cover * row.vacc.eff) return true;
  if (row.sir && ageAtStart > 0 && hashf(seed, ih, k, STREAM.inf + 500) < 1 - Math.exp(-ageAtStart / row.sir.past)) return true;
  return false;
}

/**
 * The waiting bench, for `mins` game minutes: everyone sitting there breathes the same air and sits elbow to elbow.
 * Airborne germs by Wells–Riley: P = 1 − exp(−I·q·p·t/Q), with q the quanta an hour the sick person sheds (at their
 * illness's level), p ~0.48 m³ an hour breathed at rest, and Q the air the place changes in an hour: out in the open ~3000
 * m³, a small closed room ~150 (natural ventilation, windows shut: Escombe AR et al. PLoS Med 2007;4:e68; the volumes
 * are estimates). Skin and eye germs pass by touch (`contact` an hour, next to each other). Whoever catches something
 * gets it as an illness to come (p.pending), and the record keeps where it came from (caught: hindsight in the ledger).
 * sitting: patient records; isProtected(p, row): immunity or a vaccine (clinic.js). Returns [{ pid, cond, from }].
 */
export function benchExposure(seed, sitting, t, mins, indoor, isProtected = () => false) {
  const out = [], hours = mins / 60, Q = indoor ? 150 : 3000, breath = 0.48;
  for (const src of sitting) for (const c of src.conds) {
    const row = CONTAGIOUS.get(c.id);
    if (!row || !(row.quanta || row.contact) || !infectious(c, t, row)) continue;
    const level = clamp(c.s ?? 1, 0.2, 1);
    for (const dst of sitting) {
      if (dst === src || dst.dead || dst.conds.some((x) => x.id === c.id) || dst.pending?.some((x) => x.id === c.id) || dst.healed?.some((h) => h.id === c.id && row.imm === -1) || isProtected(dst, row)) continue;
      const dose = row.quanta ? (row.quanta * level * breath * hours) / Q : (row.contact || 0) * level * hours;
      // a slow germ (TB) mostly sleeps: ~1 in 10 infected fall ill, within a year or two (estimate)
      const pr = (1 - Math.exp(-dose)) * (row.slow ? 0.1 : 1);
      if (hashf(seed, strHash(dst.id), Math.floor(t / 10), STREAM.inf + 600 + IDX.get(c.id)) >= pr) continue;
      // measles shows ~10 days later, a cold or a sore throat in ~2 (real days); a slow one after a game year
      const latent = (row.sir ? 10 : row.slow ? YEAR_DAYS : 2) * DAY;
      (dst.pending ||= []).push({ id: c.id, t: t + latent, caught: 'bench', from: src.id });
      (dst.caught ||= []).push({ cond: c.id, t, from: src.id, where: 'bench' });
      out.push({ pid: dst.id, cond: c.id, from: src.id });
    }
  }
  return out;
}
/** Hindsight: what someone caught on your bench (encounter.js judge, the ledger). */
export const caughtMsg = (cond) => msg('caught {cond} on the waiting bench', { cond });
export { HOUR };
