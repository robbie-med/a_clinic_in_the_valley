// food.js (content) — what the valley eats and grows: foods with their energy and the iron and folate they carry, what
// people need by age, the crops and their calendar, and prices. Numbers per kg of the food as stored (dry grain, fresh
// root, fresh leaves, raw meat). The household economy that uses them is core/food.js.
import { localize } from '../i18n.js';

// USDA FoodData Central, SR Legacy (public domain), per 100 g ×10: maize grain (20014), dry kidney beans (16027), raw
// cassava (11134), raw amaranth leaves (11003), raw goat meat (17168). About half the folate is lost in cooking
// (estimate); ~40% of the iron in meat is haem iron (estimate; Hallberg L. Annu Rev Nutr 1981;1:123).
export const FOODS = [
  { id: 'maize', name: 'Maize', kcal: 3650, fe: 27, haem: 0, folate: 0.19, item: 'maize', perItem: 0.25 },   // a cob ≈ 0.25 kg of grain
  { id: 'beans', name: 'Beans', kcal: 3330, fe: 82, haem: 0, folate: 3.94, item: 'beans', perItem: 1 },
  { id: 'cassava', name: 'Cassava', kcal: 1600, fe: 2.7, haem: 0, folate: 0.27, item: 'cassava', perItem: 1.5 },
  { id: 'greens', name: 'Wild greens', kcal: 230, fe: 23, haem: 0, folate: 0.85 },
  { id: 'meat', name: 'Meat', kcal: 1430, fe: 37, haem: 0.4, folate: 0.05, item: 'meat', perItem: 1 },
].map((f) => ({ ...f, folate: f.folate * 0.5 })); // mg of folate per kg as eaten, after cooking
export const FOOD = new Map(FOODS.map((f) => [f.id, f]));

/** Energy needed a day (kcal) by age and sex, rural and moderately active (FAO/WHO/UNU. Human energy requirements,
 *  2004, rounded). A baby under 6 months lives on breast milk. Pregnancy adds 85, 285 and 475 kcal by trimester and
 *  breastfeeding 505 (same report). */
const KCAL = [[0.5, 0, 0], [1, 700, 700], [2, 950, 950], [3, 1125, 1125], [5, 1250, 1250], [7, 1450, 1450], [10, 1750, 1750], [12, 1900, 2050], [15, 2100, 2400], [18, 2250, 2850], [50, 2300, 2900], [65, 2100, 2600], [Infinity, 1900, 2300]];
export function kcalNeed(age, sex, weeks = 0, lactating = false) {
  const row = KCAL.find(([a]) => age < a);
  let k = row[sex === 'm' ? 2 : 1];
  if (weeks) k += weeks < 14 ? 85 : weeks < 28 ? 285 : 475;
  if (lactating) k += 505;
  return k;
}
/** Energy in a kg of body weight gained or lost: ~7700 kcal in adults (Hall KD et al. Lancet 2011;378:826); a growing
 *  child's new tissue holds less (estimate). */
export const KCAL_PER_KG = (age) => (age < 15 ? 5000 : 7700);
/** Breast milk: ~0.35 mg of iron a litre, about half absorbed, ~0.75 L a day (estimates, standard infant nutrition). */
export const BREAST = { fe: 0.26, folate: 0.06, bio: 0.5 };

// The farm year (40 game days: cool dry, hot dry, the rains, late rains). Maize and beans are sown when the rains come
// (day 21 of the year); beans are lifted near the end of the rains, maize at the start of the cool dry season, so the
// late rains before it are the hungry months. Smallholder maize yields in East Africa ~1.5–2 t/ha, beans ~0.6
// (FAOSTAT, Uganda and Tanzania 2015–2020, rounded); 15–20% of grain is lost to pests and rot after harvest (APHLIS,
// African Postharvest Losses Information System). Cassava stays in the ground as the famine reserve, lifted as needed.
export const FARM = {
  sow: 21, beansIn: 33, maizeIn: 1, growing: [21, 40],
  maize: { tHa: [1.4, 2.0], share: 0.7 }, beans: { tHa: [0.5, 0.7], share: 0.3 }, loss: 0.17,
  cassava: { kgYear: [300, 900], cap: 900 }, // a maize valley's small cassava patch (~0.05–0.1 ha at ~9 t/ha fresh; estimate)
  ha: [0.4, 1.8], haPer: [0.15, 0.35], // field size; per member of the household (Uganda National Household Survey: ~0.2–0.3 ha a person, rounded)
  // one year in six the rains fail (yield × 0.3–0.5), one in six they are good (estimates, East African rainfall)
  drought: 1 / 6, good: 1 / 6,
  // every adult-day lost to illness in the growing season costs the field work (estimate)
  sickCost: 0.6,
  ref: 'FAOSTAT 2015–2020; APHLIS; FEWS NET East Africa seasonal calendars',
};
// Wild greens (amaranth, cowpea leaves, nightshade): ~150 g a person a day in the rains, ~50 g in the dry months (estimate).
export const GREENS_KG = { cool_dry: 0.05, hot_dry: 0.04, rains: 0.15, late_rains: 0.15 };

// Prices in shillings. A kg of maize grain costs about what a clinic visit does; it climbs through the dry months to the
// hungry season and jumps when the harvest fails (FEWS NET East Africa price bulletins: lean-season prices 50–100%
// above harvest, more in a drought; the shape is an estimate). Animals are sold when the food runs out.
export const PRICE = { maize: 1.5, beans: 2.5, cassava: 0.4, meat: 4, lean: 0.8, drought: 0.6, sell: 0.8, chicken: 6, goat: 60 };
// Casual farm work for neighbours: a day's wage buys a kg or two of maize (FEWS NET East Africa labour-to-cereal terms
// of trade, rounded); work is found on about half the days in the dry months and a quarter in the rains (estimates).
export const WAGE = { labour: 2, dry: 0.5, wet: 0.25, keep: [20, 60] };

// Starving: below ~75% of the median weight the risk of dying climbs steeply; a BMI of ~13 is about the end (Henry CJK.
// Eur J Clin Nutr 1990;44:329). Per real day; the shape is an estimate.
export const starveHazard = (kgRel) => (kgRel >= 0.8 ? 0 : 0.0005 * Math.exp((0.75 - kgRel) / 0.04));
/** Hunger lowers fertility: famine cut births by a third or more (Stein Z, Susser M. Hum Biol 1975;47:131). */
export const fertilityOf = (nutrition) => Math.min(1, Math.max(0.4, 0.3 + 0.8 * nutrition));
/** Nourishment 0..1+ from weight against the median for age (kgRel): 1 at the median, ~0.5 near 82% (wasted), 0 near 65%. */
export const nutritionOf = (kgRel) => Math.max(0, Math.min(1.15, (kgRel - 0.65) / 0.35));

localize(FOODS, ['name']);
