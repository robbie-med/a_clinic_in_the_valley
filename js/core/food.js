// food.js — what each household grows, stores, buys and eats. Pure. A household lives on its maize and beans from one
// harvest to the next, digs cassava when they run short, buys grain while it has money, sells a chicken or a goat, and
// then eats less. Rain decides the harvest; illness in the growing season decides how much of the field was worked.
// The day's food sets each member's energy (weight: village.js) and the iron and folate their blood is built from
// (blood.js). One game day of eating is COMPRESS real days (time.js): food and weight are slow processes.
import { FOOD, FARM, PRICE, WAGE, GREENS_KG, kcalNeed, BREAST } from './content/food.js';
import { hashf, makeRng } from './rng.js';
import { YEAR_DAYS, COMPRESS, SEASONS } from './time.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** Day of the farm year (1..40), the year, the season of a game day. */
export const yday = (d) => ((((d - 1) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS) + 1;
export const yearOf = (d) => Math.floor((d - 1) / YEAR_DAYS);
export const seasonOf = (d) => SEASONS[Math.floor((yday(d) - 1) / 10)];

/** The rains of a year: × on the harvest. One year in six they fail, one in six they are good (content/food.js FARM). */
export function rainOf(seed, year) {
  const u = hashf(seed, year, 0, 5003);
  if (u < FARM.drought) return 0.3 + 0.2 * hashf(seed, year, 1, 5003);
  if (u > 1 - FARM.good) return 1.15;
  return 0.85 + 0.2 * hashf(seed, year, 2, 5003);
}
/** Grain price × on a day: lowest after the maize harvest, highest in the late rains before the next; a failed harvest
 *  drives it up through the year that follows (PRICE in content/food.js). */
export function priceMult(seed, d) {
  const y = yday(d), sinceHarvest = (y - FARM.maizeIn + YEAR_DAYS) % YEAR_DAYS;
  const lastCrop = rainOf(seed, yearOf(d) - (y >= FARM.maizeIn ? 1 : 0)); // the crop now being eaten grew last year
  return (1 + PRICE.lean * (sinceHarvest / YEAR_DAYS)) * (1 + PRICE.drought * clamp((1 - lastCrop) / 0.7, 0, 1));
}

/** Iron (mg), haem iron (mg) and folate (mg) per 1000 kcal of a diet given as kcal shares { food: share }. */
export function densityOf(shares) {
  let fe = 0, haem = 0, folate = 0, sum = 0;
  for (const [id, s] of Object.entries(shares)) {
    const f = FOOD.get(id);
    if (!f || s <= 0) continue;
    const kg = (s * 1000) / f.kcal;
    fe += kg * f.fe * (1 - f.haem); haem += kg * f.fe * f.haem; folate += kg * f.folate; sum += s;
  }
  return sum ? { fe: fe / sum, haem: haem / sum, folate: folate / sum } : { fe: 0, haem: 0, folate: 0 };
}

/**
 * A household when the valley first sees it: its field (ha), what is left of the last harvest, its cassava, money and
 * animals. wealth 0..1. d: the day.
 */
export function newHousehold(seed, key, wealth, d, kcalYear, members = 5) {
  const r = makeRng(seed, 'household', key);
  // land follows the family: ~0.15–0.35 ha a person, more for the better off (FARM.haPer)
  const per = lerp(FARM.haPer[0], FARM.haPer[1], r()) * (0.7 + 0.6 * wealth), ha = Math.max(FARM.ha[0], members * per);
  const hh = { ha: Math.round(ha * 100) / 100, per: Math.round(per * 1000) / 1000, maize: 0, beans: 0, cass: 0, cash: Math.round((10 + 120 * wealth * r()) * 10) / 10,
    chick: Math.round(2 + 8 * wealth * r()), goat: Math.floor(3 * wealth * r() + 0.3), lost: 0, r: 1, dens: densityOf({ maize: 0.75, beans: 0.15, cassava: 0.08, greens: 0.02 }) };
  // what is left: the last harvests, eaten down since (the household keeps about a year's food)
  const y = yday(d), sinceM = (y - FARM.maizeIn + YEAR_DAYS) % YEAR_DAYS, sinceB = (y - FARM.beansIn + YEAR_DAYS) % YEAR_DAYS;
  const exp = expectedYield(hh, 1);
  hh.maize = Math.round(Math.max(exp.maize * (1 - sinceM / YEAR_DAYS), kcalYear * 0.1 / FOOD.get('maize').kcal));
  hh.beans = Math.round(exp.beans * (1 - sinceB / YEAR_DAYS));
  hh.cass = Math.round(FARM.cassava.cap * (hh.ha / 1.1) * lerp(0.4, 0.9, r()));
  return hh;
}
/** Expected harvest (kg, after losses) at a given rain and share of the field work done. */
export function expectedYield(hh, rain, work = 1) {
  const kg = (c) => ((FARM[c].tHa[0] + FARM[c].tHa[1]) / 2) * 1000 * hh.ha * FARM[c].share * rain * work * (1 - FARM.loss);
  return { maize: kg('maize'), beans: kg('beans') };
}

/**
 * One game day of a household. members: [{ age, sex, weeks, lact, sick (0..1: how much illness takes the appetite and
 * the work for a few days), kgRel, bf (a breastfed baby) }]. ctx: { seed, d, key, extra (cash in: wages from the clinic) }.
 * Sets hh.r (share of energy needs eaten, up to ~1.08 when food is plentiful and someone is thin), hh.dens (iron,
 * haem iron and folate per 1000 kcal eaten) and returns notes: { harvest?, sold, bought, animals, short }.
 */
export function householdDay(hh, members, ctx) {
  const { seed, d } = ctx, y = yday(d), season = seasonOf(d), pm = priceMult(seed, d);
  const notes = { sold: 0, bought: 0, animals: 0, short: 0 };
  const adults = members.filter((m) => m.age >= 15 && m.age < 60), able = adults.reduce((a, m) => a + (1 - m.sick), 0);
  // ——— the farm year
  if (y === FARM.sow) {
    hh.lost = 0;
    // a growing family clears or is given more land at sowing time (a shrinking one keeps what it has)
    if (hh.per) hh.ha = Math.round(Math.max(hh.ha, Math.min(FARM.ha[1] * 2, members.length * hh.per)) * 100) / 100;
  }
  if (y > FARM.growing[0] && y <= FARM.growing[1]) hh.lost += adults.length - able + (ctx.away || 0); // adult-days not in the field
  const work = () => clamp(1 - (FARM.sickCost * hh.lost) / Math.max(1, adults.length * (FARM.growing[1] - FARM.growing[0])), 0.2, 1);
  if (y === FARM.beansIn) { const got = expectedYield(hh, rainOf(seed, yearOf(d)), work()).beans * lerp(0.85, 1.15, hashf(seed, d, 1, 5011)); hh.beans += Math.round(got); notes.harvest = 'beans'; }
  if (y === FARM.maizeIn) {
    const rain = rainOf(seed, yearOf(d) - 1);
    const got = expectedYield(hh, rain, work()).maize * lerp(0.85, 1.15, hashf(seed, d, 2, 5011));
    hh.maize += Math.round(got); notes.harvest = 'maize'; notes.rain = rain;
    // sell what is beyond a year's grain and a margin, at the low harvest price
    const keep = (yearKcal(members) * 0.8 * 1.15) / FOOD.get('maize').kcal;
    if (hh.maize > keep) { const sell = hh.maize - keep; hh.maize = keep; hh.cash += sell * PRICE.maize * pm * PRICE.sell; notes.sold = sell; }
  }
  const scale = hh.ha / 1.1; // the cassava plot follows the size of the farm
  hh.cass = Math.min(FARM.cassava.cap * scale, hh.cass + (lerp(FARM.cassava.kgYear[0], FARM.cassava.kgYear[1], hashf(seed, d, 3, 5011)) * scale) / YEAR_DAYS);
  // ——— income: casual work for neighbours, more in the dry months; wages from the clinic (ctx.extra)
  // (a wage a real day, so COMPRESS of them in a game day, for the share of days there is work)
  hh.cash += able * WAGE.labour * COMPRESS * (season === 'cool_dry' || season === 'hot_dry' ? WAGE.dry : WAGE.wet) + (ctx.extra || 0);
  // what is not needed for food goes on the rest of life (school fees, clothes, soap, salt, funerals): a household
  // keeps only a small buffer of cash (WAGE.keep, more for the better off; an estimate)
  const keep = WAGE.keep[0] + WAGE.keep[1] * (hh.ha / 1.1);
  if (hh.cash > keep) hh.cash = keep + (hh.cash - keep) * 0.5;
  // ——— eating: everyone over 6 months eats from the pot; a baby lives on breast milk
  const eaters = members.filter((m) => !m.bf || m.age >= 0.5);
  let need = eaters.reduce((a, m) => a + kcalNeed(m.age, m.sex, m.weeks, m.lact), 0) * COMPRESS;
  const stockKcal = hh.maize * FOOD.get('maize').kcal + hh.beans * FOOD.get('beans').kcal + hh.cass * FOOD.get('cassava').kcal;
  const thin = eaters.some((m) => m.kgRel < 0.97);
  if (thin && stockKcal > 30 * need) need *= 1.08; // food enough for a month: the thin eat back what they lost
  const eat = { greens: Math.min(need * 0.03, GREENS_KG[season] * eaters.length * COMPRESS * FOOD.get('greens').kcal) };
  let left = need - eat.greens;
  const take = (id, stock, cap) => { const f = FOOD.get(id), kc = Math.min(left, cap, hh[stock] * f.kcal); hh[stock] -= kc / f.kcal; left -= kc; eat[id] = (eat[id] || 0) + kc; };
  take('maize', 'maize', need * 0.72);
  take('beans', 'beans', need * 0.2);
  take('maize', 'maize', Infinity);
  take('beans', 'beans', Infinity);
  take('cassava', 'cass', Infinity);
  // buying grain, then selling animals to buy more
  const buy = () => {
    const price = PRICE.maize * pm, f = FOOD.get('maize');
    const kg = Math.min(left / f.kcal, Math.max(0, hh.cash) / price);
    if (kg <= 0) return;
    hh.cash -= kg * price; left -= kg * f.kcal; eat.maize = (eat.maize || 0) + kg * f.kcal; notes.bought += kg;
  };
  buy();
  while (left > 1 && hh.chick > 0) { hh.chick--; hh.cash += PRICE.chicken * PRICE.sell; notes.animals++; buy(); }
  while (left > 1 && hh.goat > 0) { hh.goat--; hh.cash += PRICE.goat * PRICE.sell; notes.animals++; buy(); }
  if (ctx.meat > 0) { const kc = Math.min(left > 0 ? left : need * 0.05, ctx.meat * FOOD.get('meat').kcal); eat.meat = kc; left -= kc; }
  notes.short = Math.max(0, left);
  const eaten = need - Math.max(0, left);
  hh.r = eaters.length ? clamp(eaten / (need / (thin && stockKcal > 30 * need ? 1.08 : 1)), 0, 1.08) : 1;
  const total = Object.values(eat).reduce((a, b) => a + b, 0);
  hh.dens = total > 0 ? densityOf(Object.fromEntries(Object.entries(eat).map(([k, v]) => [k, v / total]))) : hh.dens;
  hh.cash = Math.round(hh.cash * 10) / 10; hh.maize = Math.round(hh.maize * 10) / 10; hh.beans = Math.round(hh.beans * 10) / 10; hh.cass = Math.round(hh.cass * 10) / 10;
  return notes;
}
const yearKcal = (members) => members.reduce((a, m) => a + kcalNeed(m.age, m.sex), 0) * 365;

/**
 * What one member eats in a real day: { r (share of their energy need), nonHaem, haem, folate (mg eaten), abs (mg of
 * iron absorbed as such: breast milk's, ~half of it) }. A breastfed baby under 6 months lives on breast milk (less if
 * the mother is starving); the sick eat less (their share of the pot was cut, householdDay).
 */
export function dietOf(hh, m, motherR) {
  if (m.bf && m.age < 0.5) {
    const r = motherR == null ? 1 : clamp(0.6 + 0.5 * motherR, 0.6, 1);
    return { r, nonHaem: 0, haem: 0, folate: BREAST.folate * r, abs: BREAST.fe * BREAST.bio * r };
  }
  // r: the household's share of need, a slow process (each game day is COMPRESS real days of eating). ano: what an
  // acute illness takes off the appetite, for the real days it lasts (weight: village.js, disease.js bodyHour)
  const r = hh?.r ?? 1;
  const k = (kcalNeed(m.age, m.sex, m.weeks, m.lact) / 1000) * r * (m.diet ?? 1);
  const D = hh?.dens || densityOf({ maize: 0.75, beans: 0.15, cassava: 0.08, greens: 0.02 });
  return { r: clamp(r, 0, 1.08), ano: 0.5 * (m.ano || 0), nonHaem: D.fe * k, haem: D.haem * k, folate: D.folate * k, abs: 0 };
}

/**
 * Kin and neighbours share: a house that has run out gets grain from the houses of its hamlet that have more than they
 * will need before the next harvest, enough for a few weeks (an estimate; informal transfers are how most rural
 * families get through a bad patch). homes: [{ hh, need (kcal a game day) }] of one hamlet. Returns kg given.
 */
export function share(homes, d) {
  const toHarvest = ((FARM.maizeIn - yday(d) + YEAR_DAYS) % YEAR_DAYS) || YEAR_DAYS, kc = FOOD.get('maize').kcal;
  const days = (h) => (h.hh.maize * kc + h.hh.beans * FOOD.get('beans').kcal + h.hh.cass * FOOD.get('cassava').kcal) / Math.max(1, h.need);
  const poor = homes.filter((h) => days(h) < 1), rich = homes.filter((h) => days(h) > toHarvest * 1.3).sort((a, b) => days(b) - days(a));
  let given = 0;
  for (const h of poor) for (const g of rich) {
    const spare = g.hh.maize - (toHarvest * 1.3 * g.need) / kc;
    if (spare <= 0) continue;
    const kg = Math.min(spare * 0.5, (SHARE_DAYS * h.need) / kc);
    g.hh.maize -= kg; h.hh.maize += kg; given += kg;
    if (days(h) >= SHARE_DAYS) break;
  }
  return given;
}
const SHARE_DAYS = 3;

/** Relief food: once a hamlet has gone hungry for a while, a distribution brings each hungry house half a ration of
 *  maize a day (Sphere Handbook 2018: a full ration ~2100 kcal a person a day; half is what partial distributions give;
 *  the delay and share are estimates). homes: [{ hh, need }]. Returns kg given. */
export function relief(homes) {
  const kc = FOOD.get('maize').kcal;
  let given = 0;
  for (const h of homes) if (h.hh.r < 0.85) { const kg = (0.5 * h.need) / kc; h.hh.maize += kg; given += kg; }
  return given;
}
export const RELIEF_AFTER = 5; // game days of hunger before the trucks come

/** Payment in kind from the household's own stores: what a family can give when coins run out (clinic.js payment). */
export function kindFrom(hh, rest, rng) {
  const out = [];
  let left = rest;
  for (let k = 0; k < 4 && left > 0.2; k++) {
    if (left >= PRICE.chicken * 0.9 && hh.chick > 0 && rng() < 0.4) { hh.chick--; out.push(['chicken', 1]); left -= PRICE.chicken; continue; }
    if (hh.beans >= 1 && rng() < 0.5) { const n = Math.max(1, Math.min(12, Math.floor(left / 1.2), Math.floor(hh.beans))); hh.beans -= n; out.push(['beans', n]); left -= n * 1.2; continue; }
    const cobs = Math.floor(hh.maize / FOOD.get('maize').perItem);
    if (cobs >= 1) { const n = Math.max(1, Math.min(12, Math.floor(left / 0.3), cobs)); hh.maize -= n * FOOD.get('maize').perItem; out.push(['maize', n]); left -= n * 0.3; continue; }
    break;
  }
  return { kind: out, left: Math.max(0, Math.round(left * 10) / 10) };
}
