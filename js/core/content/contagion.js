// contagion.js (content) — germs that pass between people (core/village.js, core/contagion.js). Each row is keyed by
// the condition it causes. A person's daily risk of catching it is their background rate (content/village.js
// BACKGROUND × the condition's epi weight for them, season and hamlet), split into a share that comes from outside
// (1 − alpha: the water, the next valley) and a share that follows how many are infectious in their own hamlet now
// (alpha × infectious / the usual number), plus each infectious person in their own house (sar: the chance a member
// catches it over one illness). So clusters and outbreaks come and go, and on average it stays as common as the
// conditions table says. Immunising illnesses (`sir`) spread by contact alone: R0, the infectious days, a little
// importation, and immunity that the births slowly dilute, so they come back as epidemics.
//   inf: [from, to] days after it begins that a person is infectious; infS: or while the illness's level is at least
//   this (slow, chronic infections). imm: game days of immunity after it (slow: real days / COMPRESS), -1 for life.
//   quanta: infectious doses an hour shed into the air of a room (Wells–Riley), for the waiting bench; contact: the
//   chance an hour of sitting next to someone passes it on.
//   slow: the risk runs on the game calendar (×COMPRESS), as the illness does.
import { COMPRESS } from '../time.js';

export const CONTAGION = [
  // ——— faecal–oral: water, hands, flies
  { id: 'watery_diarrhea', route: 'faecal', alpha: 0.4, sar: 0.15, inf: [0, 7], imm: 30 / COMPRESS, ref: 'estimate (rotavirus, norovirus households)' },
  { id: 'dysentery', route: 'faecal', alpha: 0.5, sar: 0.25, inf: [0, 14], imm: 60 / COMPRESS, ref: 'estimate (Shigella household secondary attack 20–40%)' },
  { id: 'cholera', route: 'faecal', alpha: 0.9, sar: 0.2, inf: [0, 7], imm: 1095 / COMPRESS, import: 2e-6, ref: 'estimate (household contacts of cholera cases)' },
  { id: 'typhoid', route: 'faecal', alpha: 0.5, sar: 0.05, inf: [0, 28], imm: 365 / COMPRESS, ref: 'estimate' },
  { id: 'amoebiasis', route: 'faecal', alpha: 0.3, sar: 0.1, inf: [0, 30], imm: 0, ref: 'estimate' },
  { id: 'giardia', route: 'faecal', alpha: 0.3, sar: 0.1, inf: [0, 30], imm: 0, ref: 'estimate' },
  { id: 'hepatitis', route: 'faecal', alpha: 0.6, sar: 0.3, inf: [0, 10], imm: -1, ref: 'estimate (hepatitis A, households)' },
  // ——— air and droplets
  { id: 'common_cold', route: 'air', alpha: 0.7, sar: 0.25, inf: [0, 5], imm: 30 / COMPRESS, quanta: 5, ref: 'estimate' },
  { id: 'cough_child', route: 'air', alpha: 0.6, sar: 0.3, inf: [0, 14], imm: 60 / COMPRESS, quanta: 10, ref: 'estimate' },
  { id: 'strep_throat', route: 'air', alpha: 0.5, sar: 0.2, inf: [0, 10], imm: 90 / COMPRESS, quanta: 5, ref: 'estimate (group A strep, households ~25%)' },
  { id: 'meningitis', route: 'air', alpha: 0.3, sar: 0.01, inf: [0, 3], imm: 365 / COMPRESS, ref: 'estimate (meningococcal carriage passes; disease is rare)' },
  // measles: R0 12–18, infectious from 4 days before the rash to 4 after; ~93% protected by one dose given at 9 months
  // (Guerra FM et al. Lancet Infect Dis 2017;17:e420; WHO position paper on measles vaccines 2017); the index case of
  // an outbreak shed ~93 quanta a minute, later cases about a tenth of that (Riley EC et al. Am J Epidemiol
  // 1978;107:421)
  { id: 'measles', route: 'air', sir: { r0: 15, days: 8, past: 4 }, sar: 0.9, inf: [0, 8], imm: -1, vacc: { cover: 0.8, eff: 0.93, from: 0.75 }, import: 5e-6, quanta: 570, ref: 'Guerra FM et al. Lancet Infect Dis 2017;17:e420; Riley EC et al. Am J Epidemiol 1978;107:421' },
  { id: 'chickenpox', route: 'air', sir: { r0: 10, days: 7, past: 6 }, sar: 0.85, inf: [0, 7], imm: -1, import: 1e-5, quanta: 100, ref: 'estimate (R0 ~10, household attack ~85%)' },
  { id: 'mumps', route: 'air', sir: { r0: 6, days: 7, past: 7 }, sar: 0.35, inf: [0, 7], imm: -1, import: 5e-6, quanta: 30, ref: 'estimate' },
  // TB: households of a case carry most of the extra risk; Wells–Riley quanta 1–13 an hour for ordinary cases
  // (Escombe AR et al. PLoS Med 2007;4:e68)
  { id: 'tb', route: 'air', alpha: 0.5, sar: 0.05, infS: 0.2, slow: true, imm: 0, quanta: 13, ref: 'Escombe AR et al. PLoS Med 2007;4:e68 (quanta); household risk an estimate' },
  // ——— skin and eyes: touch, shared cloths, flies
  { id: 'scabies', route: 'contact', alpha: 0.5, sar: 0.2, infS: 0.1, imm: 0, contact: 0.01, ref: 'estimate' },
  { id: 'impetigo', route: 'contact', alpha: 0.5, sar: 0.25, inf: [0, 14], imm: 0, contact: 0.005, ref: 'estimate' },
  { id: 'tinea', route: 'contact', alpha: 0.3, sar: 0.15, infS: 0.1, imm: 0, contact: 0.002, ref: 'estimate' },
  { id: 'conjunctivitis', route: 'contact', alpha: 0.5, sar: 0.3, inf: [0, 10], imm: 0, contact: 0.01, ref: 'estimate' },
  { id: 'trachoma', route: 'contact', alpha: 0.5, sar: 0.2, infS: 0.1, imm: 0, ref: 'estimate' },
  // ——— mosquitoes: the bites follow the season and the swamp (conditionWeight); a share follows how many in the
  // hamlet carry parasites now (gametocytes). Sickle trait cuts uncomplicated malaria ~30% (IRR 0.69) and severe ~90%
  // (OR 0.09) (Taylor SM et al. Lancet Infect Dis 2012;12:457).
  { id: 'malaria', route: 'vector', alpha: 0.6, sar: 0, infPara: 1000, imm: 0, trait: 0.69, ref: 'Taylor SM et al. Lancet Infect Dis 2012;12:457' },
  // ——— sex: a partner in the same house (per game day while the partner is infectious), the rest from outside
  { id: 'gonorrhoea', route: 'sex', alpha: 0, partner: 0.1, inf: [0, 60], imm: 0, ref: 'estimate' },
  { id: 'chlamydia', route: 'sex', alpha: 0, partner: 0.05, inf: [0, 120], imm: 0, ref: 'estimate' },
  { id: 'trichomonas', route: 'sex', alpha: 0, partner: 0.05, inf: [0, 120], imm: 0, ref: 'estimate' },
  { id: 'syphilis', route: 'sex', alpha: 0, partner: 0.05, infS: 0.1, imm: 0, ref: 'estimate' },
  { id: 'chancroid', route: 'sex', alpha: 0, partner: 0.05, inf: [0, 30], imm: 0, ref: 'estimate' },
  // HIV: ~1 in 1000 acts, a game year of partnership is a real year (slow); ~10% a year to a negative partner without
  // treatment (estimate from serodiscordant couple cohorts)
  { id: 'hiv', route: 'sex', alpha: 0, partner: 0.1 / 365, infS: 0, slow: true, imm: 0, ref: 'estimate (serodiscordant couples, no treatment)' },
];
export const CONTAGIOUS = new Map(CONTAGION.map((c) => [c.id, c]));
