// actions.js — using a tile: gather a plant, cut grass or poles, open a rack/shelf/jar, plant in a
// garden bed, place what you hold, pick a built thing back up. Returns events for the scene:
// ['msg', text], ['gain', id, n], ['open', x, y], ['brew', x, y], ['sound', name], ['placed', x, y, id].
import { addItem, count, remove } from './inventory.js';
import { DAY, inSeason } from './time.js';
import { gainXp } from './crafting.js';
import { HERB } from './content/herbs.js';
import { climateFit } from './flora.js';
import { t, getLang } from './i18n.js';

/** Lower-case a mid-sentence noun in English only (other scripts have no case, or other rules). */
const lc = (s) => (getLang() === 'en' ? String(s).toLowerCase() : s);

export function newPlayer(x, y) {
  return { x, y, face: 0, inv: { slots: Array(24).fill(null) }, hot: 0, coins: 40, skills: { herbal: 0, diagnosis: 0, build: 0 }, stats: { walked: 0 }, known: {} };
}

export function useTile(G, x, y, slot = G.p.hot) {
  const { W, C, p } = G;
  const ev = [];
  const od = W.objDef(x, y);
  const held = p.inv.slots[slot];
  const hd = held && C.items.get(held.id);
  // plant in a garden bed
  if (od?.garden && hd?.plant) {
    const st = W.state(x, y);
    if (st?.plant) return [['msg', t('Something is already growing here.')]];
    remove(p.inv, held.id, 1);
    W.setState(x, y, { plant: { herb: hd.plant, readyAt: W.time + hd.growDays * DAY } });
    W.setObj(x, y, 'sprout', W.state(x, y));
    return [['msg', t('Planted. Ready in about {n} days.', { n: hd.growDays })], ['sound', 'place']];
  }
  if (od?.kind === 'sprout') {
    const st = W.state(x, y);
    return [['msg', st?.plant ? t('{herb} — {n} more days.', { herb: HERB.get(st.plant.herb).name, n: Math.max(1, Math.ceil((st.plant.readyAt - W.time) / DAY)) }) : t('A young plant.')]];
  }
  if (od?.kind === 'plant') {
    const herb = HERB.get(od.herb);
    const st = W.state(x, y);
    if (st?.regrowAt && W.time < st.regrowAt) return [['msg', t('Already harvested. It will be ready again in {n} days.', { n: Math.ceil((st.regrowAt - W.time) / DAY) })]];
    if (!inSeason(od.seasons, W.time)) return [['msg', t('{herb}: nothing to gather in this season.', { herb: herb.name })]];
    if (od.tool && !count(p.inv, od.tool)) return [['msg', t('You need a {tool} to take the {part}.', { tool: lc(C.items.get(od.tool).name), part: herb.part })]];
    const n = herb.tree ? 2 : 1;
    // a species out of its climate grows thin: a temperate herb in this valley is a weak one
    const left = addItem(p.inv, C, od.harvest, n, { q: W.plantPotency(x, y) * climateFit(od.herb), t: W.time });
    if (left === n) return [['msg', t('Your bag is full.')]];
    W.setState(x, y, { regrowAt: W.time + herb.regrowDays * DAY });
    G.meta.time += 4;
    p.known[herb.id] = 1;
    const lv = gainXp(p, 'herbal', 1);
    return [['gain', od.harvest, n - left], ['sound', 'pick'], ...(lv ? [['level', 'herbal', lv]] : [])];
  }
  if (od?.gives) {
    const st = W.state(x, y);
    if (st?.regrowAt && W.time < st.regrowAt) return [['msg', t('Nothing more to cut here for now.')]];
    if (od.tool && !count(p.inv, od.tool)) return [['msg', t('You need a {tool}.', { tool: lc(C.items.get(od.tool).name) })]];
    const [id, n] = od.gives;
    if (addItem(p.inv, C, id, n) === n) return [['msg', t('Your bag is full.')]];
    W.setState(x, y, { regrowAt: W.time + (od.regrowDays || 5) * DAY });
    G.meta.time += 6;
    return [['gain', id, n], ['sound', 'chop']];
  }
  if (od?.brews) return [['brew', x, y]];
  if (od?.container) return [['open', x, y]];
  if (od?.kind === 'well') return [['msg', t('Clean water. The hearth boils it for remedies.')]];
  if (od?.kind === 'sign') return [['msg', t('Your clinic sign. People come from the hamlets when your name is good.')]];
  // place what you hold
  if (hd?.place && !od) {
    if (hd.place.ground) {
      if (W.groundDef(x, y).water) return [['msg', t('Not on water.')]];
      W.setGround(x, y, hd.place.ground);
    } else {
      if (!W.passable(x, y) || W.groundDef(x, y).water) return [['msg', t('There is no room there.')]];
      W.setObj(x, y, hd.place.obj, null);
    }
    remove(p.inv, held.id, 1);
    gainXp(p, 'build', 2);
    return [['placed', x, y, held.id], ['sound', 'place']];
  }
  if (od?.built && od.item) return [['msg', t('{name}. (Hold nothing and use "Pick up" from the menu to move it.)', { name: od.name })]];
  if (od?.kind === 'crop') return [['msg', t('Someone\'s maize field.')]];
  return ev;
}

/** Pick a built object back up (with its contents spilled into your bag). */
export function pickUp(G, x, y) {
  const { W, C, p } = G;
  const od = W.objDef(x, y);
  if (!od?.built || !od.item) return [['msg', t('You cannot take that.')]];
  const st = W.state(x, y);
  if (st?.inv?.slots.some(Boolean) || st?.brew) return [['msg', t('Empty it first.')]];
  if (addItem(p.inv, C, od.item, 1)) return [['msg', t('Your bag is full.')]];
  W.setObj(x, y, null, null);
  return [['gain', od.item, 1]];
}
