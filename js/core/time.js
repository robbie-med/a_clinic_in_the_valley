// time.js — the clock and the seasons. Time is game minutes since the world began. A year is 40 days:
// cool dry → hot dry → rains → late rains (10 days each). Malaria follows the rains with a lag,
// diarrhoea the heat and the first rains, coughs the cool season.
import { hashf } from './rng.js';
import { t } from './i18n.js';

export const DAY = 24 * 60;
export const HOUR = 60;
export const YEAR_DAYS = 40;
export const COMPRESS = 365 / YEAR_DAYS; // real days per game day for slow processes (months, years)
export const SEASONS = ['cool_dry', 'hot_dry', 'rains', 'late_rains'];
/** Season names in the current language (getters: they translate on every read). */
export const SEASON_NAMES = {
  get cool_dry() { return t('Cool dry season'); },
  get hot_dry() { return t('Hot dry season'); },
  get rains() { return t('The rains'); },
  get late_rains() { return t('Late rains'); },
};
export const REAL_SEC_PER_MIN = 0.45;      // a game day ≈ 11 real minutes
export const START_TIME = (8 + 5) * DAY + 7 * 60; // day 14 (hot dry season), 07:00

export const day = (t) => Math.floor(t / DAY) + 1;
export const minuteOfDay = (t) => ((t % DAY) + DAY) % DAY;
export function season(t) { return SEASONS[Math.floor((((day(t) - 1) % YEAR_DAYS) + YEAR_DAYS) % YEAR_DAYS / 10)]; }
export function dayOfSeason(t) { return ((day(t) - 1) % 10) + 1; }
export function clock(t) {
  const m = Math.floor(minuteOfDay(t));
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
/** 0 night … 1 full day. Sunrise ~6:00, sunset ~18:30 (near the equator days barely change). */
export function daylight(t) {
  const h = minuteOfDay(t) / 60;
  if (h < 5.5 || h > 19) return 0;
  if (h < 6.5) return h - 5.5;
  if (h > 18) return 19 - h;
  return 1;
}
const RAIN = { cool_dry: 0.05, hot_dry: 0.08, rains: 0.45, late_rains: 0.3 };
/** Is it raining over the region in this 3-hour block? */
export function raining(seed, t) { return hashf(seed, Math.floor(t / 180), 7, 3) < RAIN[season(t)]; }
export function inSeason(seasons, t) { return seasons === 'all' || seasons.includes(season(t)); }
