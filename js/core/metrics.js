// metrics.js — the clinic's numbers, the way a health-system manager would want them: volume and access,
// throughput, continuity of care, clinical quality (with hindsight, closed cases only), money, and reputation.
// Pure: reads the saved clinic (patients, their visits, the walk-outs) and computes; it changes nothing.
// Visits saved before these fields existed lack `min`, `wait`, `billed`, `kind`: each figure averages over the
// visits that have what it needs, and says how many that was.
import { DAY, day } from './time.js';

const CHECKUP = 'come for the check-up as you asked'; // clinic.js / encounter.js: the planned return's why
/** What brought a patient in, from returnWhy at the start of the consultation: new | planned | unplanned | thanks. */
export function visitKind(p) {
  if (!p.visits.length) return 'new';
  const why = p.returnWhy;
  if (why === 'thanks') return 'thanks';
  if (why && (why === CHECKUP || why.$ === CHECKUP)) return 'planned';
  return 'unplanned';
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const median = (xs) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
/** A share as { k, n, v } (v null when n is 0), so the UI can say "7 of 9". */
const share = (k, n) => ({ k, n, v: n ? k / n : null });

/**
 * days: how many game days back to look (null = all time). Visits count when they fall in the window; a patient's
 * outcome counts when it closed (recovered or died) in the window.
 */
export function clinicMetrics(cl, now, days = null) {
  const from = days == null ? -Infinity : now - days * DAY;
  const inWin = (t) => t != null && t >= from && t <= now;
  const seen = Object.values(cl.patients).filter((p) => p.visits.length);
  const visits = seen.flatMap((p) => p.visits.map((v, i) => ({ p, v, i }))).filter((x) => inWin(x.v.t));
  const n = visits.length;
  const kinds = { new: 0, planned: 0, unplanned: 0, thanks: 0 };
  for (const { v, i } of visits) kinds[v.kind ?? (i ? 'unplanned' : 'new')]++;
  const patients = new Set(visits.map((x) => x.p.id));
  const walkouts = (cl.walkouts || []).filter(inWin).length;
  // days the clinic has been seeing people, at most the window
  const firstDay = Math.min(...seen.map((p) => day(p.visits[0].t)), day(now));
  const span = Math.max(1, Math.min(days ?? Infinity, day(now) - firstDay + 1));

  // throughput
  const mins = visits.map((x) => x.v.min).filter((m) => m != null);
  const waits = visits.map((x) => x.v.wait).filter((m) => m != null);

  // continuity: of the check-ups you asked for, how many came; of everyone seen, how many you saw again
  const asked = visits.filter((x) => x.v.back > 0);
  const kept = asked.filter((x) => x.p.visits[x.i + 1]?.kind === 'planned').length;
  const repeat = [...patients].filter((id) => cl.patients[id].visits.length > 1).length;

  // quality, with hindsight: only patients whose story has ended (well again or dead)
  const closedAt = (p) => (p.dead ? p.diedAt : p.recovered || null);
  const closed = seen.filter((p) => inWin(closedAt(p)));
  const wellAgain = closed.filter((p) => !p.dead).length;
  const died = closed.filter((p) => p.dead);
  const harmDeaths = died.filter((p) => String(p.cause || '').startsWith('poisoned')).length;
  const judged = visits.filter((x) => x.p.recovered || x.p.dead).map((x) => x.v.judged).filter(Boolean);
  const abx = judged.filter((j) => j.needless?.length).length;
  const referable = judged.filter((j) => j.referredRight != null);

  // money
  const cash = visits.reduce((a, x) => a + (x.v.paid || 0), 0);
  const billedVisits = visits.filter((x) => x.v.billed != null);
  const billed = billedVisits.reduce((a, x) => a + x.v.billed, 0);
  const billedCash = billedVisits.reduce((a, x) => a + (x.v.paid || 0), 0);
  const owed = seen.reduce((a, p) => a + (p.dead ? 0 : p.debt || 0), 0);

  return {
    days, span,
    volume: {
      visits: n, patients: patients.size, perDay: n / span,
      newShare: share(kinds.new, n), kinds,
      walkouts, lwbs: share(walkouts, n + walkouts), missed: days == null ? cl.missed || 0 : null,
    },
    flow: {
      minPerVisit: avg(mins), medianWait: median(waits), within1h: share(waits.filter((w) => w <= 60).length, waits.length),
      timed: mins.length, perHour: mins.length ? 60 / avg(mins) : null,
    },
    continuity: {
      returnShare: share(n - kinds.new, n), repeatPatients: share(repeat, patients.size),
      visitsPerPatient: patients.size ? n / patients.size : null,
      followUpKept: share(kept, asked.length), bounceBacks: share(kinds.unplanned, n),
    },
    quality: {
      success: share(wellAgain, closed.length), mortality: share(died.length, closed.length), harmDeaths,
      dxRight: share(judged.filter((j) => j.dxRight).length, judged.length),
      harmful: share(judged.filter((j) => j.harmed.length).length, judged.length),
      needlessAbx: share(abx, judged.length),
      referRight: share(referable.filter((j) => j.referredRight).length, referable.length),
      referRate: share(visits.filter((x) => x.v.refer).length, n),
    },
    money: {
      cash, perVisit: n ? cash / n : null, billed, collection: share(billedCash, billed), owed,
      fee: cl.fee, markup: cl.markup,
    },
    // "Net Promoter Score": your name in the valley, 0..1, on the boardroom's −100..100 scale
    nps: Math.round((cl.rep ?? 0) * 200 - 100),
  };
}
