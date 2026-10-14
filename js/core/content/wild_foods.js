// wild_foods.js (content) — the valley's plants that people eat: wild leaves cooked as a relish, fruits, and roots dug
// when the store is empty. Keyed by the flora species (content/flora_herbs.js), so a food grows only where the valley
// grows it. The household's own crops are content/food.js; foraging is core/food.js and core/village.js.
//   part: what is eaten (may differ from the part the medicine table measured); food: per kg as eaten, cooked where
//   it is cooked (kcal, iron mg, haem share 0, folate mg after cooking); harvest: kg one plant gives at a picking (it then
//   regrows over the species' regrowDays); famine: eaten mostly when there is nothing else (bitter, laborious or risky).
// Nutrients: USDA FoodData Central, SR Legacy (public domain), per 100 g ×10 — amaranth leaves, purslane, jute potherb,
// vinespinach (basella), drumstick (moringa) leaves, blanched nettles, tamarinds, figs, prickly pears, java plum,
// groundcherries, blackberries, yam, taro, balsam-pear (bitter gourd) pods; all raw unless said, rounded. Where USDA has
// no entry the nearest leaf is used and marked `estimated`. Folate
// halved for cooked leaves and roots (estimate). Which plants are eaten: Maundu PM, Ngugi GW, Kabuye CHS. Traditional
// food plants of Kenya. KENRIK, 1999; FAO. Traditional food plants (Food and Nutrition Paper 42), 1988.
import { localize } from '../i18n.js';

const leaf = (kcal, fe, folate) => ({ kcal, fe, haem: 0, folate: folate * 0.5 });
const raw = (kcal, fe, folate) => ({ kcal, fe, haem: 0, folate });
export const WILD_FOODS = [
  { id: 'amaranthus_spinosus', part: 'leaf', how: 'Young leaves cooked as a relish.', food: leaf(230, 23.2, 0.85), harvest: 0.3 },
  { id: 'portulaca_oleracea', part: 'leaf', how: 'Leaves and stems cooked, or eaten raw.', food: leaf(200, 19.9, 0.12), harvest: 0.3 },
  // Black nightshade: the cooked leaves are a favourite relish; the green berries are poisonous (no USDA entry: amaranth's values)
  { id: 'solanum_nigrum', part: 'leaf', how: 'Leaves boiled, the water thrown away. Never the green berries.', food: leaf(230, 23.2, 0.85), harvest: 0.3, estimated: true },
  { id: 'corchorus_olitorius', part: 'leaf', how: 'Leaves cooked into a slippery relish.', food: leaf(340, 47.6, 1.23), harvest: 0.3 },
  { id: 'basella_alba', part: 'leaf', how: 'Leaves and tips cooked.', food: leaf(190, 12, 1.4), harvest: 0.3 },
  { id: 'bidens_pilosa', part: 'leaf', how: 'Young leaves cooked, mostly in hungry times.', food: leaf(230, 23.2, 0.85), harvest: 0.2, famine: true, estimated: true },
  { id: 'moringa_oleifera', part: 'leaf', how: 'Leaves cooked or dried and pounded.', food: leaf(640, 40, 0.4), harvest: 0.4 },
  { id: 'urtica_dioica', part: 'leaf', how: 'Young tops boiled (cooking takes the sting away).', food: leaf(420, 16.4, 0.14), harvest: 0.2 },
  { id: 'tamarindus_indica', part: 'fruit', how: 'The sour pulp around the seeds.', food: raw(2390, 28, 0.14), harvest: 1.5 },
  { id: 'ficus_carica', part: 'fruit', how: 'Ripe figs.', food: raw(740, 3.7, 0.06), harvest: 1.5 },
  { id: 'opuntia_ficus_indica', part: 'fruit', how: 'The fruit, peeled of its spines.', food: raw(410, 3, 0.06), harvest: 1.5 },
  { id: 'syzygium_cumini', part: 'fruit', how: 'Ripe purple fruit.', food: raw(600, 1.9, 0), harvest: 1.5 },
  { id: 'physalis_peruviana', part: 'fruit', how: 'Ripe berries in their husks.', food: raw(530, 10, 0.07), harvest: 0.3 },
  { id: 'rubus_fruticosus', part: 'fruit', how: 'Ripe berries.', food: raw(430, 6.2, 0.25), harvest: 0.3 },
  { id: 'momordica_charantia', part: 'fruit', how: 'The bitter young fruit, cooked.', food: leaf(170, 4.3, 0.72), harvest: 0.3 },
  { id: 'dioscorea_alata', part: 'root', how: 'The tuber, peeled and boiled.', food: leaf(1180, 5.4, 0.23), harvest: 2 },
  // Air potato: wild forms are bitter and poisonous unless sliced, soaked and boiled for days (a famine food)
  { id: 'dioscorea_bulbifera', part: 'root', how: 'Bitter wild bulbils, eaten only after slicing, soaking and boiling for days.', food: leaf(1180, 5.4, 0.23), harvest: 1.5, famine: true, estimated: true },
  { id: 'colocasia_esculenta', part: 'root', how: 'The corm, always well cooked (raw, it burns the mouth).', food: leaf(1120, 5.5, 0.22), harvest: 2 },
];
export const WILD_FOOD = new Map(WILD_FOODS.map((w) => [w.id, w]));
/** Compound classes that make a plant mistaken for a food dangerous (content/flora_actives.js). */
export const TOXIC_CLASSES = ['pyrrolizidine', 'tropane', 'cardenolide', 'aconitine', 'aristolochic', 'cyanogenic'];
// How much one person can gather in a real day of foraging (kg as eaten): leaves are quick to pick and light, fruit and
// roots heavier (estimates). Foraging takes the day that could have gone to paid work.
export const FORAGE_KG = { leaf: 2, fruit: 5, root: 4 };
// The chance a hungry household's day of foraging brings home a poisonous lookalike, when one grows nearby (estimate:
// famine-food poisonings are well known, e.g. pyrrolizidine outbreaks; the rate is a guess). A meal is ~200 g.
export const MISPICK_FOOD = 0.02, MEAL_G = 200;

localize(WILD_FOODS, ['how']);
